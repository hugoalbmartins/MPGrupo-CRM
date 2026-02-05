import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CommissionConfig {
  id: string;
  operator_id: string;
  service_type: string;
  commission_mode: string;
  commission_value: string;
  partner_type: string;
  client_type: string;
  min_sales: number;
  service_types: string[];
  activation_type: string | null;
  direct_debit_bonus: string;
  electronic_invoice_bonus: string;
}

async function calculateCommission(
  operator: any,
  saleData: any,
  supabase: any
): Promise<number> {
  if (operator.commission_mode === "manual") {
    return 0.0;
  }

  const clientType = saleData.customer_type || saleData.client_type || "particular";
  const scope = saleData.scope;

  let partnerType = "D2D";
  let d2dLevel: string | null = null;
  if (saleData.isAdminSale && saleData.isCommissioned) {
    partnerType = "REV";
  } else if (saleData.partner_id) {
    const { data: partner } = await supabase
      .from("partners")
      .select("partner_type")
      .eq("id", saleData.partner_id)
      .maybeSingle();

    partnerType = partner?.partner_type || "D2D";

    if (partnerType === "D2D") {
      const { data: levelData } = await supabase
        .from("partner_d2d_operator_levels")
        .select("d2d_level")
        .eq("partner_id", saleData.partner_id)
        .eq("operator_id", operator.id)
        .maybeSingle();

      d2dLevel = levelData?.d2d_level || null;
      if (!d2dLevel) {
        console.warn(`D2D partner ${saleData.partner_id} has no level for operator ${operator.id}`);
        return 0.0;
      }
    }
  }

  if (scope === "energia" && saleData.energy_sale_type === "dual") {
    const electricityResult = await calculateSingleEnergyCommission(
      operator,
      { ...saleData, energy_sale_type: "eletricidade" },
      supabase,
      "eletricidade",
      clientType,
      partnerType,
      false,
      d2dLevel
    );

    const gasResult = await calculateSingleEnergyCommission(
      operator,
      { ...saleData, energy_sale_type: "gas" },
      supabase,
      "gas",
      clientType,
      partnerType,
      false,
      d2dLevel
    );

    let bonuses = 0;
    const config = electricityResult.config || gasResult.config;
    if (config) {
      if (saleData.has_direct_debit) {
        bonuses += parseFloat(config.direct_debit_bonus || 0);
      }
      if (saleData.has_electronic_invoice) {
        bonuses += parseFloat(config.electronic_invoice_bonus || 0);
      }
    }

    const totalCommission = electricityResult.base + gasResult.base + bonuses;
    console.log(`Dual sale ${saleData.sale_code}: Electricity base=${electricityResult.base}, Gas base=${gasResult.base}, Bonuses=${bonuses} (DD+FE once), Total=${totalCommission}`);
    return totalCommission;
  }

  let serviceType = null;
  let activationType = null;
  let refidOperationType = null;

  if (scope === "telecomunicacoes") {
    serviceType = saleData.service_type;
    activationType = saleData.activation_type;

    if (serviceType === "REFID" || serviceType === "Refid") {
      refidOperationType = saleData.refid_type;
    }
  } else if (scope === "energia") {
    serviceType = saleData.energy_sale_type || operator.energy_type || "eletricidade";
  }

  let query = supabase
    .from("commission_configurations")
    .select("*")
    .eq("operator_id", operator.id)
    .eq("client_type", clientType)
    .eq("partner_type", partnerType);

  if (partnerType === "D2D" && d2dLevel) {
    query = query.eq("d2d_level", d2dLevel);
  }

  if (activationType && !refidOperationType) {
    query = query.eq("activation_type", activationType);
  }

  if (refidOperationType) {
    query = query.eq("refid_operation_type", refidOperationType);
    console.log(`Applying refid_operation_type filter: ${refidOperationType}`);
  }

  query = query.order("min_sales", { ascending: false });

  const { data: allCommissionConfigs, error } = await query;

  if (error) {
    console.warn(`Error fetching commission configs for operator: ${operator.name}`, error);
    return 0.0;
  }

  let commissionConfigs: CommissionConfig[] = allCommissionConfigs || [];

  if (serviceType && commissionConfigs.length > 0) {
    commissionConfigs = commissionConfigs.filter((config: CommissionConfig) => {
      if (config.service_type === serviceType) {
        return true;
      }
      if (config.service_types && Array.isArray(config.service_types)) {
        return config.service_types.includes(serviceType);
      }
      return false;
    });
  }

  if (commissionConfigs.length === 0) {
    console.warn(`No commission config found for operator: ${operator.name}, client_type: ${clientType}, partner_type: ${partnerType}, service_type: ${serviceType}, refid_type: ${refidOperationType}`);
    return 0.0;
  }

  const searchPartnerId = saleData.partner_id;
  let partnerSalesAtOperator = 0;

  if (searchPartnerId) {
    let countQuery = supabase
      .from("sales")
      .select("*", { count: "exact", head: true })
      .eq("partner_id", searchPartnerId)
      .eq("operator_id", operator.id);

    if (scope === "energia" && serviceType) {
      countQuery = countQuery.eq("scope", "energia");
    } else if (scope === "telecomunicacoes") {
      countQuery = countQuery.eq("scope", "telecomunicacoes");
    }

    const { count } = await countQuery;
    partnerSalesAtOperator = count || 0;
  }

  const applicableTier = commissionConfigs.find(
    (config: CommissionConfig) => partnerSalesAtOperator >= (config.min_sales || 0)
  ) || commissionConfigs[commissionConfigs.length - 1];

  if (!applicableTier) {
    return 0.0;
  }

  let baseCommission = 0;

  if (applicableTier.commission_mode === "monthly_multiplier") {
    let monthlyValue = parseFloat(saleData.monthly_value || 0);

    if ((saleData.service_type === "REFID" || saleData.service_type === "Refid") && saleData.contracted_monthly_fee) {
      monthlyValue = parseFloat(saleData.contracted_monthly_fee);
    }

    const multiplier = parseFloat(applicableTier.commission_value || 0);
    baseCommission = monthlyValue * multiplier;
  } else if (applicableTier.commission_mode === "fixed_value") {
    baseCommission = parseFloat(applicableTier.commission_value || 0);
  } else {
    baseCommission = parseFloat(applicableTier.commission_value || 0);
  }

  let bonuses = 0;
  if (saleData.has_direct_debit) {
    bonuses += parseFloat(applicableTier.direct_debit_bonus || 0);
  }
  if (saleData.has_electronic_invoice) {
    bonuses += parseFloat(applicableTier.electronic_invoice_bonus || 0);
  }

  return baseCommission + bonuses;
}

async function calculateSingleEnergyCommission(
  operator: any,
  saleData: any,
  supabase: any,
  energyType: string,
  clientType: string,
  partnerType: string,
  includeBonuses = true,
  d2dLevel: string | null = null
): Promise<{ base: number; bonuses: number; config: CommissionConfig | null }> {
  let query = supabase
    .from("commission_configurations")
    .select("*")
    .eq("operator_id", operator.id)
    .eq("client_type", clientType)
    .eq("partner_type", partnerType);

  if (partnerType === "D2D" && d2dLevel) {
    query = query.eq("d2d_level", d2dLevel);
  }

  query = query.order("min_sales", { ascending: false });

  const { data: allCommissionConfigs, error } = await query;

  if (error || !allCommissionConfigs || allCommissionConfigs.length === 0) {
    console.warn(`No commission configs found for energy type: ${energyType}`);
    return { base: 0.0, bonuses: 0.0, config: null };
  }

  let commissionConfigs = allCommissionConfigs.filter((config: CommissionConfig) => {
    if (config.service_type === energyType) {
      return true;
    }
    if (config.service_types && Array.isArray(config.service_types)) {
      return config.service_types.includes(energyType);
    }
    return false;
  });

  if (commissionConfigs.length === 0) {
    console.warn(`No commission config found for energy type: ${energyType}`);
    return { base: 0.0, bonuses: 0.0, config: null };
  }

  const searchPartnerId = saleData.partner_id;
  let partnerSalesAtOperator = 0;

  if (searchPartnerId) {
    const countQuery = supabase
      .from("sales")
      .select("*", { count: "exact", head: true })
      .eq("partner_id", searchPartnerId)
      .eq("operator_id", operator.id)
      .eq("scope", "energia");

    const { count } = await countQuery;
    partnerSalesAtOperator = count || 0;
  }

  const applicableTier = commissionConfigs.find(
    (config: CommissionConfig) => partnerSalesAtOperator >= (config.min_sales || 0)
  ) || commissionConfigs[commissionConfigs.length - 1];

  if (!applicableTier) {
    return { base: 0.0, bonuses: 0.0, config: null };
  }

  let baseCommission = 0;

  if (applicableTier.commission_mode === "fixed_value") {
    baseCommission = parseFloat(applicableTier.commission_value || 0);
  } else if (applicableTier.commission_mode === "monthly_multiplier") {
    const monthlyValue = parseFloat(saleData.monthly_value || 0);
    const multiplier = parseFloat(applicableTier.commission_value || 0);
    baseCommission = monthlyValue * multiplier;
  } else {
    baseCommission = parseFloat(applicableTier.commission_value || 0);
  }

  let bonuses = 0;
  if (includeBonuses) {
    if (saleData.has_direct_debit) {
      bonuses += parseFloat(applicableTier.direct_debit_bonus || 0);
    }
    if (saleData.has_electronic_invoice) {
      bonuses += parseFloat(applicableTier.electronic_invoice_bonus || 0);
    }
  }

  return { base: baseCommission, bonuses: bonuses, config: applicableTier };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("Iniciando recálculo de comissões...");

    const { data: allSales, error: salesError } = await supabaseClient
      .from("sales")
      .select("*")
      .order("created_at", { ascending: true });

    if (salesError) {
      throw salesError;
    }

    if (!allSales || allSales.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Nenhuma venda encontrada",
          total: 0,
          success_count: 0,
          failed: 0,
          skipped: 0,
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    console.log(`Encontradas ${allSales.length} vendas para processar`);

    const { data: operators, error: operatorsError } = await supabaseClient
      .from("operators")
      .select("*");

    if (operatorsError) {
      throw operatorsError;
    }

    const operatorsMap: { [key: string]: any } = {};
    operators.forEach((op: any) => {
      operatorsMap[op.id] = op;
    });

    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const sale of allSales) {
      try {
        if (sale.manual_commission && parseFloat(sale.manual_commission) > 0) {
          console.log(`Skipping sale ${sale.sale_code} - has manual commission`);
          skippedCount++;
          continue;
        }

        const operator = operatorsMap[sale.operator_id];
        if (!operator) {
          console.warn(`Operator not found for sale ${sale.sale_code}`);
          failedCount++;
          continue;
        }

        if (operator.commission_mode === "manual") {
          console.log(`Skipping sale ${sale.sale_code} - operator has manual commission mode`);
          skippedCount++;
          continue;
        }

        let energySaleType = sale.energy_sale_type;
        if (sale.scope === "energia" && !energySaleType) {
          if (operator.energy_type) {
            energySaleType = operator.energy_type;
          } else {
            energySaleType = "eletricidade";
          }
          console.log(`Inferring energy_sale_type for sale ${sale.sale_code}: ${energySaleType}`);
        }

        const saleData = {
          ...sale,
          energy_sale_type: energySaleType,
          isAdminSale: !sale.partner_id,
          isCommissioned: true,
        };

        const newCommission = await calculateCommission(operator, saleData, supabaseClient);
        const oldCommission = parseFloat(sale.calculated_commission || 0);

        if (Math.abs(newCommission - oldCommission) > 0.01) {
          const updateData: any = {
            calculated_commission: newCommission,
          };

          if (sale.scope === "energia" && !sale.energy_sale_type && energySaleType) {
            updateData.energy_sale_type = energySaleType;
          }

          const { error: updateError } = await supabaseClient
            .from("sales")
            .update(updateData)
            .eq("id", sale.id);

          if (updateError) {
            console.error(`Failed to update sale ${sale.sale_code}:`, updateError);
            failedCount++;
          } else {
            console.log(`Updated sale ${sale.sale_code}: commission ${oldCommission} -> ${newCommission}`);
            successCount++;
          }
        } else {
          console.log(`Sale ${sale.sale_code} already has correct commission: ${newCommission}`);
          skippedCount++;
        }
      } catch (error) {
        console.error(`Error processing sale ${sale.sale_code}:`, error);
        failedCount++;
      }
    }

    const result = {
      success: true,
      message: "Recálculo concluído",
      total: allSales.length,
      success_count: successCount,
      failed: failedCount,
      skipped: skippedCount,
    };

    console.log("Commission recalculation complete:", result);

    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error in recalculate-commissions:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
