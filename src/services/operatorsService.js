import { supabase } from '../lib/supabase';

export const operatorsService = {
  async getAll(includeHidden = false, scope = null) {
    let query = supabase
      .from('operators')
      .select('*')
      .eq('active', true);

    if (!includeHidden) {
      query = query.eq('hidden', false);
    }

    if (scope) {
      query = query.or(`scope.eq.${scope},scope.eq.dual`);
    }

    const { data, error } = await query.order('name');

    if (error) throw error;
    return data || [];
  },

  async getHidden() {
    const { data, error } = await supabase
      .from('operators')
      .select('*')
      .eq('active', true)
      .eq('hidden', true)
      .order('name');

    if (error) throw error;
    return data || [];
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('operators')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async create(operatorData) {
    const { data, error } = await supabase
      .from('operators')
      .insert({
        name: operatorData.name,
        scope: operatorData.scope,
        energy_type: operatorData.energy_type || null,
        activation_types: operatorData.activation_types || [],
        allowed_client_types: operatorData.allowed_client_types || ['particular', 'empresarial'],
        allowed_energy_types: operatorData.allowed_energy_types || [],
        commission_mode: operatorData.commission_mode || 'tier',
        pays_direct_debit: operatorData.pays_direct_debit || false,
        pays_electronic_invoice: operatorData.pays_electronic_invoice || false,
        active: true,
        hidden: false
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id, operatorData) {
    const updateData = {
      name: operatorData.name,
      scope: operatorData.scope,
      energy_type: operatorData.energy_type || null
    };

    if (operatorData.hasOwnProperty('pays_direct_debit')) {
      updateData.pays_direct_debit = operatorData.pays_direct_debit;
    }
    if (operatorData.hasOwnProperty('pays_electronic_invoice')) {
      updateData.pays_electronic_invoice = operatorData.pays_electronic_invoice;
    }

    const { data, error } = await supabase
      .from('operators')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async toggleVisibility(id) {
    const { data: operator } = await supabase
      .from('operators')
      .select('hidden')
      .eq('id', id)
      .single();

    const newHidden = !operator.hidden;

    const { data, error } = await supabase
      .from('operators')
      .update({ hidden: newHidden })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('operators')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async getCommissionConfigs(operatorId) {
    const { data, error } = await supabase
      .from('commission_configurations')
      .select('*')
      .eq('operator_id', operatorId)
      .order('service_type, client_type, min_sales');

    if (error) throw error;
    return data || [];
  },

  async saveCommissionConfigs(operatorId, configs) {
    const { data: { user } } = await supabase.auth.getUser();

    await supabase
      .from('commission_configurations')
      .delete()
      .eq('operator_id', operatorId);

    if (configs.length === 0) {
      return [];
    }

    const configsToInsert = configs.map(config => {
      const serviceTypes = config.service_types || [config.service_type];
      const hasRefid = serviceTypes.includes('REFID');
      const hasNIorMC = serviceTypes.includes('NI') || serviceTypes.includes('MC');

      return {
        operator_id: operatorId,
        partner_type: config.partner_type || 'D2D',
        client_type: config.client_type,
        service_type: config.service_type,
        service_types: serviceTypes,
        commission_mode: config.commission_mode || 'fixed_value',
        commission_value: config.commission_value || 0,
        min_sales: config.min_sales || 0,
        has_retention: config.has_retention || false,
        retention_percentage: config.retention_percentage || 0,
        retention_months: config.retention_months || 0,
        direct_debit_bonus: config.direct_debit_bonus || 0,
        electronic_invoice_bonus: config.electronic_invoice_bonus || 0,
        tier_mode: config.tier_mode || 'by_quantity',
        monthly_value_min: config.monthly_value_min || 0,
        monthly_value_max: config.monthly_value_max || 0,
        refid_operation_type: hasRefid ? (config.refid_operation_type || 'both') : null,
        activation_type: hasNIorMC ? (config.activation_type || null) : null,
        created_by: user?.id,
        updated_by: user?.id
      };
    });

    const { data, error } = await supabase
      .from('commission_configurations')
      .insert(configsToInsert)
      .select();

    if (error) throw error;
    return data;
  }
};
