import { supabase } from '../lib/supabase';

export const recalculateAllCommissions = async () => {
  try {
    console.log('Starting commission recalculation via edge function...');

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recalculate-commissions`;
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to recalculate commissions: ${errorText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Unknown error');
    }

    console.log('Commission recalculation complete:', result);

    return {
      total: result.total,
      success: result.success_count,
      failed: result.failed,
      skipped: result.skipped
    };
  } catch (error) {
    console.error('Error in recalculateAllCommissions:', error);
    throw error;
  }
};

export const recalculateSaleCommission = async (saleId) => {
  try {
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('*')
      .eq('id', saleId)
      .maybeSingle();

    if (saleError) throw saleError;
    if (!sale) throw new Error('Sale not found');

    const { data: operator, error: operatorError } = await supabase
      .from('operators')
      .select('*')
      .eq('id', sale.operator_id)
      .maybeSingle();

    if (operatorError) throw operatorError;
    if (!operator) throw new Error('Operator not found');

    if (operator.commission_mode === 'manual') {
      console.log('Operator has manual commission mode, skipping recalculation');
      return sale.calculated_commission;
    }

    let energySaleType = sale.energy_sale_type;
    if (sale.scope === 'energia' && !energySaleType) {
      if (operator.energy_type) {
        energySaleType = operator.energy_type;
      } else {
        energySaleType = 'eletricidade';
      }
    }

    const saleData = {
      ...sale,
      energy_sale_type: energySaleType,
      isAdminSale: !sale.partner_id,
      isCommissioned: true
    };

    const newCommission = await calculateCommission(operator, saleData, supabase);

    const updateData = {
      calculated_commission: newCommission
    };

    if (sale.scope === 'energia' && !sale.energy_sale_type && energySaleType) {
      updateData.energy_sale_type = energySaleType;
    }

    const { error: updateError } = await supabase
      .from('sales')
      .update(updateData)
      .eq('id', saleId);

    if (updateError) throw updateError;

    return newCommission;
  } catch (error) {
    console.error('Error recalculating sale commission:', error);
    throw error;
  }
};
