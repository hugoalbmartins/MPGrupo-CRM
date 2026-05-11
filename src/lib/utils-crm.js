export function generateStrongPassword(length = 8) {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%^&*';

  const password = [
    uppercase[Math.floor(Math.random() * uppercase.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
  ];

  const allChars = uppercase + lowercase + digits + special;
  for (let i = 0; i < length - 3; i++) {
    password.push(allChars[Math.floor(Math.random() * allChars.length)]);
  }

  for (let i = password.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [password[i], password[j]] = [password[j], password[i]];
  }

  return password.join('');
}

export function validatePassword(password) {
  return /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/.test(password);
}

export function validateCPE(cpe) {
  return /^PT0002\d{12}[A-Z]{2}$/i.test(cpe);
}

export function validateCUI(cui) {
  return /^PT\d{16}[A-Z]{2}$/i.test(cui);
}

export function validateNIF(nif) {
  const cleaned = nif.replace(/\D/g, '');

  if (cleaned.length !== 9 || !/^\d+$/.test(cleaned)) {
    return {
      valid: false,
      message: 'NIF inválido: deve ter 9 dígitos'
    };
  }

  if (cleaned[0] === '5') {
    const isValid = validateNIFCheckDigit(cleaned);
    return {
      valid: isValid,
      message: isValid ? '' : 'NIF inválido: dígito de controlo CRC incorreto'
    };
  }

  return {
    valid: true,
    message: ''
  };
}

export function validateNIFCheckDigit(nif) {
  if (nif.length !== 9) return false;

  const multipliers = [9, 8, 7, 6, 5, 4, 3, 2];
  const total = multipliers.reduce((sum, mult, i) => sum + parseInt(nif[i]) * mult, 0);

  let checkDigit = 11 - (total % 11);
  if (checkDigit >= 10) checkDigit = 0;

  return checkDigit === parseInt(nif[8]);
}

export async function generatePartnerCode(partnerType, supabase) {
  try {
    console.log('generatePartnerCode: Starting for type', partnerType);

    const { data: existing, error } = await supabase
      .from('partners')
      .select('partner_code')
      .ilike('partner_code', `${partnerType}%`);

    if (error) {
      console.error('generatePartnerCode: Query error:', error);
      throw error;
    }

    const usedNumbers = (existing || [])
      .map(p => parseInt(p.partner_code.replace(partnerType, ''), 10))
      .filter(n => !isNaN(n));

    let number = 1001;
    if (usedNumbers.length > 0) {
      number = Math.max(...usedNumbers) + 1;
    }

    let code = `${partnerType}${number}`;

    const existingCodes = new Set((existing || []).map(p => p.partner_code));
    while (existingCodes.has(code)) {
      number++;
      code = `${partnerType}${number}`;
    }

    console.log('generatePartnerCode: Generated code', code);
    return code;
  } catch (error) {
    console.error('generatePartnerCode: Failed:', error);
    throw error;
  }
}

function normalizeToAscii(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]/g, '');
}

export async function generateSaleCode(partnerId, saleDate, supabase) {
  let namePrefix = 'ADM';

  if (partnerId) {
    const { data: partner } = await supabase
      .from('partners')
      .select('name, created_at')
      .eq('id', partnerId)
      .maybeSingle();

    if (partner) {
      const normalizedName = normalizeToAscii(partner.name);
      const base3 = normalizedName.substring(0, 3).toUpperCase();
      const base2 = normalizedName.substring(0, 2).toUpperCase();

      const { data: conflicting } = await supabase
        .from('partners')
        .select('id, created_at')
        .ilike('name', `${partner.name.substring(0, 3)}%`)
        .order('created_at', { ascending: true });

      if (!conflicting || conflicting.length <= 1) {
        namePrefix = base3;
      } else {
        const index = conflicting.findIndex(p => p.id === partnerId);
        if (index <= 0) {
          namePrefix = base3;
        } else {
          namePrefix = `${base2}${index}`;
        }
      }
    }
  }

  const date = new Date(saleDate);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);

  const query = partnerId
    ? supabase.from('sales').select('sale_code').eq('partner_id', partnerId)
    : supabase.from('sales').select('sale_code').is('partner_id', null);

  const { data: allSales } = await query;

  let maxSequence = 0;
  if (allSales && allSales.length > 0) {
    for (const sale of allSales) {
      let code = sale.sale_code || '';
      const underscoreIdx = code.lastIndexOf('_');
      if (underscoreIdx > 0) {
        code = code.substring(0, underscoreIdx);
      }
      if (code.length >= 9) {
        const seqStr = code.substring(3, 7);
        const seq = parseInt(seqStr, 10);
        if (!isNaN(seq) && seq > maxSequence) {
          maxSequence = seq;
        }
      }
    }
  }

  const sequence = String(maxSequence + 1).padStart(4, '0');
  return `${namePrefix}${sequence}${month}${year}`;
}

async function calculateSingleEnergyCommission(operator, saleData, supabase, energyType, clientType, partnerType, includeBonuses = true, d2dLevel = null, revLevel = null) {
  let query = supabase
    .from('commission_configurations')
    .select('*')
    .eq('operator_id', operator.id)
    .eq('client_type', clientType)
    .eq('partner_type', partnerType);

  if (partnerType === 'D2D' && d2dLevel) {
    query = query.eq('d2d_level', d2dLevel);
  }

  if ((partnerType === 'REV' || partnerType === 'Rev+') && revLevel) {
    query = query.eq('rev_level', revLevel);
  }

  query = query.order('min_sales', { ascending: false });

  const { data: allCommissionConfigs, error } = await query;

  if (error || !allCommissionConfigs || allCommissionConfigs.length === 0) {
    console.warn(`No commission configs found for energy type: ${energyType}`);
    return { base: 0.0, bonuses: 0.0, config: null };
  }

  let commissionConfigs = allCommissionConfigs.filter(config => {
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

  const byPowerConfigs = commissionConfigs.filter(c => c.tier_mode === 'by_power');
  const regularConfigs = commissionConfigs.filter(c => c.tier_mode !== 'by_power');

  if (byPowerConfigs.length > 0) {
    if (saleData.power) {
      const powerConfig = byPowerConfigs.find(c => c.power_value === saleData.power);
      if (powerConfig) {
        let baseCommission = parseFloat(powerConfig.commission_value || 0);
        let bonuses = 0;
        if (includeBonuses) {
          if (saleData.has_direct_debit) bonuses += parseFloat(powerConfig.direct_debit_bonus || 0);
          if (saleData.has_electronic_invoice) bonuses += parseFloat(powerConfig.electronic_invoice_bonus || 0);
        }
        return { base: baseCommission, bonuses, config: powerConfig };
      }
    }
    if (regularConfigs.length === 0) {
      console.warn(`No by_power config for power: ${saleData.power}, energy type: ${energyType}`);
      return { base: 0.0, bonuses: 0.0, config: null };
    }
  }

  const tieredConfigs = regularConfigs.length > 0 ? regularConfigs : commissionConfigs;

  const searchPartnerId = saleData.partner_id;
  let partnerSalesAtOperator = 0;

  if (searchPartnerId) {
    const saleDateField = saleData.activation_date || saleData.paid_date || saleData.date;
    const saleDate = new Date(saleDateField);
    const saleMonth = saleDate.getMonth() + 1;
    const saleYear = saleDate.getFullYear();

    const startOfMonth = new Date(saleYear, saleMonth - 1, 1).toISOString().split('T')[0];
    const endOfMonth = new Date(saleYear, saleMonth, 0).toISOString().split('T')[0];

    const countQuery = supabase
      .from('sales')
      .select('*', { count: 'exact', head: true })
      .eq('partner_id', searchPartnerId)
      .eq('operator_id', operator.id)
      .eq('scope', 'energia')
      .gte('activation_date', startOfMonth)
      .lte('activation_date', endOfMonth);

    const { count } = await countQuery;
    partnerSalesAtOperator = count || 0;
  }

  const applicableTier = tieredConfigs.find(config =>
    partnerSalesAtOperator >= (config.min_sales || 0)
  ) || tieredConfigs[tieredConfigs.length - 1];

  if (!applicableTier) {
    return { base: 0.0, bonuses: 0.0, config: null };
  }

  let baseCommission = 0;

  if (applicableTier.commission_mode === 'fixed_value') {
    baseCommission = parseFloat(applicableTier.commission_value || 0);
  } else if (applicableTier.commission_mode === 'monthly_multiplier') {
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

export async function calculateCommission(operator, saleData, supabase) {
  if (operator.commission_mode === 'manual') {
    return 0.0;
  }

  const clientType = saleData.customer_type || saleData.client_type || 'particular';
  const scope = saleData.scope;

  let partnerType = 'D2D';
  let d2dLevel = null;
  let revLevel = null;

  if (saleData.partner_id) {
    const { data: partner } = await supabase
      .from('partners')
      .select('partner_type')
      .eq('id', saleData.partner_id)
      .maybeSingle();

    partnerType = partner?.partner_type || 'D2D';

    if (partnerType === 'D2D') {
      const { data: levelData } = await supabase
        .from('partner_d2d_operator_levels')
        .select('d2d_level')
        .eq('partner_id', saleData.partner_id)
        .eq('operator_id', operator.id)
        .maybeSingle();

      d2dLevel = levelData?.d2d_level || null;
      if (!d2dLevel) {
        console.warn(`D2D partner ${saleData.partner_id} has no level for operator ${operator.id}, defaulting to Nv1`);
        d2dLevel = 'Nv1';
      }
    } else if (partnerType === 'REV' || partnerType === 'Rev+') {
      const { data: levelData } = await supabase
        .from('partner_rev_operator_levels')
        .select('rev_level')
        .eq('partner_id', saleData.partner_id)
        .eq('operator_id', operator.id)
        .maybeSingle();

      revLevel = levelData?.rev_level || null;
      if (!revLevel) {
        console.warn(`${partnerType} partner ${saleData.partner_id} has no level for operator ${operator.id}, defaulting to 1`);
        revLevel = 1;
      }
    }
  }

  if (scope === 'energia' && saleData.energy_sale_type === 'dual') {
    const electricityResult = await calculateSingleEnergyCommission(
      operator,
      { ...saleData, energy_sale_type: 'eletricidade' },
      supabase,
      'eletricidade',
      clientType,
      partnerType,
      false,
      d2dLevel,
      revLevel
    );

    const gasResult = await calculateSingleEnergyCommission(
      operator,
      { ...saleData, energy_sale_type: 'gas' },
      supabase,
      'gas',
      clientType,
      partnerType,
      false,
      d2dLevel,
      revLevel
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

  if (scope === 'telecomunicacoes') {
    serviceType = saleData.service_type;
    activationType = saleData.activation_type;

    if (serviceType === 'REFID' || serviceType === 'Refid') {
      refidOperationType = saleData.refid_type;
      console.log(`REFID sale detected: refid_type=${refidOperationType}, service_type=${serviceType}`);
    }
  } else if (scope === 'energia') {
    serviceType = saleData.energy_sale_type || operator.energy_type || 'eletricidade';
  }

  let query = supabase
    .from('commission_configurations')
    .select('*')
    .eq('operator_id', operator.id)
    .eq('client_type', clientType)
    .eq('partner_type', partnerType);

  if (partnerType === 'D2D' && d2dLevel) {
    query = query.eq('d2d_level', d2dLevel);
  }

  if ((partnerType === 'REV' || partnerType === 'Rev+') && revLevel) {
    query = query.eq('rev_level', revLevel);
  }

  if (refidOperationType) {
    query = query.eq('refid_operation_type', refidOperationType);
    console.log(`Applying refid_operation_type filter: ${refidOperationType}`);
  }

  query = query.order('min_sales', { ascending: false });

  const { data: allCommissionConfigs, error } = await query;

  if (error) {
    console.warn(`Error fetching commission configs for operator: ${operator.name}`, error);
    return 0.0;
  }

  let commissionConfigs = allCommissionConfigs || [];

  if (serviceType && commissionConfigs.length > 0) {
    commissionConfigs = commissionConfigs.filter(config => {
      if (config.service_type === serviceType) {
        return true;
      }
      if (config.service_types && Array.isArray(config.service_types)) {
        return config.service_types.includes(serviceType);
      }
      return false;
    });
  }

  if (saleData.activation_type && commissionConfigs.length > 0) {
    commissionConfigs = commissionConfigs.filter(config => {
      if (!config.activation_type || config.activation_type === 'all') {
        return true;
      }
      return config.activation_type === saleData.activation_type;
    });
  }

  const saleTechnology = saleData.technology || 'Fibra';
  const isSATSale = saleTechnology === 'SAT';
  const satMode = operator.sat_commission_mode;

  if (isSATSale && satMode === 'individual' && commissionConfigs.length > 0) {
    commissionConfigs = commissionConfigs.filter(config => config.technology === 'SAT');
  } else if (commissionConfigs.length > 0) {
    commissionConfigs = commissionConfigs.filter(config => !config.technology || config.technology === 'Fibra');
  }

  if (commissionConfigs.length === 0) {
    console.warn(`No commission config found for operator: ${operator.name}, client_type: ${clientType}, partner_type: ${partnerType}, service_type: ${serviceType}, activation_type: ${saleData.activation_type}, refid_type: ${refidOperationType}, technology: ${saleTechnology}`);
    return 0.0;
  }

  const searchPartnerId = saleData.partner_id;
  let partnerSalesAtOperator = 0;

  if (searchPartnerId) {
    const saleDateField = saleData.activation_date || saleData.paid_date || saleData.date;
    const saleDate = new Date(saleDateField);
    const saleMonth = saleDate.getMonth() + 1;
    const saleYear = saleDate.getFullYear();

    const startOfMonth = new Date(saleYear, saleMonth - 1, 1).toISOString().split('T')[0];
    const endOfMonth = new Date(saleYear, saleMonth, 0).toISOString().split('T')[0];

    let countQuery = supabase
      .from('sales')
      .select('*', { count: 'exact', head: true })
      .eq('partner_id', searchPartnerId)
      .eq('operator_id', operator.id)
      .gte('activation_date', startOfMonth)
      .lte('activation_date', endOfMonth);

    if (scope === 'energia' && serviceType) {
      countQuery = countQuery.eq('scope', 'energia');
    } else if (scope === 'telecomunicacoes') {
      countQuery = countQuery.eq('scope', 'telecomunicacoes');

      if (saleData.activation_type && ['M2', 'M3', 'M4', 'Movel'].includes(saleData.activation_type)) {
        countQuery = countQuery.eq('activation_type', saleData.activation_type);
      }

      if (serviceType) {
        countQuery = countQuery.eq('service_type', serviceType);
      }
    }

    const { count } = await countQuery;
    partnerSalesAtOperator = count || 0;
  }

  const applicableTier = commissionConfigs.find(config =>
    partnerSalesAtOperator >= (config.min_sales || 0)
  ) || commissionConfigs[commissionConfigs.length - 1];

  if (!applicableTier) {
    return 0.0;
  }

  let baseCommission = 0;

  if (applicableTier.commission_mode === 'monthly_multiplier') {
    let monthlyValue = parseFloat(saleData.monthly_value || 0);

    if ((saleData.service_type === 'REFID' || saleData.service_type === 'Refid') && saleData.contracted_monthly_fee) {
      monthlyValue = parseFloat(saleData.contracted_monthly_fee);
    }

    const multiplier = parseFloat(applicableTier.commission_value || 0);
    baseCommission = monthlyValue * multiplier;
  } else if (applicableTier.commission_mode === 'fixed_value') {
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

  let additionalServiceBonus = 0;
  if (saleData.additional_services && saleData.additional_services !== 'Nenhum') {
    const { data: addlServiceConfig } = await supabase
      .from('commission_configurations')
      .select('commission_value')
      .eq('operator_id', operator.id)
      .eq('service_type', 'additional_service')
      .eq('additional_service_name', saleData.additional_services)
      .eq('client_type', clientType)
      .eq('partner_type', partnerType)
      .eq(partnerType === 'D2D' ? 'd2d_level' : 'rev_level', partnerType === 'D2D' ? d2dLevel : revLevel)
      .maybeSingle();

    if (addlServiceConfig) {
      additionalServiceBonus = parseFloat(addlServiceConfig.commission_value || 0);
    }
  }

  let totalCommission = baseCommission + bonuses + additionalServiceBonus;

  if (isSATSale && satMode === 'percentage' && operator.sat_commission_percentage) {
    const pct = parseFloat(operator.sat_commission_percentage) / 100;
    totalCommission = totalCommission * pct;
  }

  // Apply quantity multiplier for scopes with counting_mode = 'by_quantity'
  if (scope && scope !== 'telecomunicacoes' && scope !== 'energia') {
    try {
      const { data: scopeData } = await supabase
        .from('scopes')
        .select('counting_mode, quantity_field')
        .eq('slug', scope)
        .maybeSingle();

      if (scopeData && scopeData.counting_mode === 'by_quantity' && scopeData.quantity_field) {
        const qtyField = scopeData.quantity_field;
        let quantity = 1;

        // Check custom_fields first, then sale data directly
        if (saleData.custom_fields && saleData.custom_fields[qtyField] !== undefined) {
          quantity = parseInt(saleData.custom_fields[qtyField]) || 1;
        } else if (saleData[qtyField] !== undefined) {
          quantity = parseInt(saleData[qtyField]) || 1;
        }

        if (quantity > 1) {
          console.log(`Scope ${scope} uses by_quantity mode: ${qtyField}=${quantity}, commission ${totalCommission} x ${quantity} = ${totalCommission * quantity}`);
          totalCommission = totalCommission * quantity;
        }
      }
    } catch (e) {
      console.warn('Error fetching scope counting mode:', e);
    }
  }

  return totalCommission;
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  }).format(value || 0);
}

export function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('pt-PT');
}

export function formatDateTime(date) {
  if (!date) return '';
  return new Date(date).toLocaleString('pt-PT');
}

export function getSaleUnitCount(sale) {
  if (!sale) return 0;

  if (sale.is_multipoint && sale.multipoint_count > 0) {
    return sale.multipoint_count;
  }

  return 1;
}

export function getTotalUnitsFromSales(sales) {
  if (!sales || !Array.isArray(sales)) return 0;

  return sales.reduce((total, sale) => {
    return total + getSaleUnitCount(sale);
  }, 0);
}
