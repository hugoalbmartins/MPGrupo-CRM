import { supabase } from '../lib/supabase';

export const operatorsService = {
  async getOperators(includeHidden = false, scope = null) {
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

  async getAll(includeHidden = false, scope = null) {
    return this.getOperators(includeHidden, scope);
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

  async getOperator(id) {
    const { data, error } = await supabase
      .from('operators')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async getById(id) {
    return this.getOperator(id);
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
    if (operatorData.hasOwnProperty('refidelizacao_prazo')) {
      updateData.refidelizacao_prazo = operatorData.refidelizacao_prazo || null;
    }
    if (operatorData.hasOwnProperty('refidelizacao_unidade')) {
      updateData.refidelizacao_unidade = operatorData.refidelizacao_unidade || 'dias';
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

  async updateSettings(id, settingsData) {
    const updateData = {};
    if (settingsData.hasOwnProperty('activation_types')) {
      updateData.activation_types = settingsData.activation_types;
    }
    if (settingsData.hasOwnProperty('allowed_energy_types')) {
      updateData.allowed_energy_types = settingsData.allowed_energy_types;
    }
    if (settingsData.hasOwnProperty('allowed_client_types')) {
      updateData.allowed_client_types = settingsData.allowed_client_types;
    }
    if (settingsData.hasOwnProperty('energy_type')) {
      updateData.energy_type = settingsData.energy_type;
    }
    if (settingsData.hasOwnProperty('pays_direct_debit')) {
      updateData.pays_direct_debit = settingsData.pays_direct_debit;
    }
    if (settingsData.hasOwnProperty('pays_electronic_invoice')) {
      updateData.pays_electronic_invoice = settingsData.pays_electronic_invoice;
    }
    if (settingsData.hasOwnProperty('requires_voltage_type')) {
      updateData.requires_voltage_type = settingsData.requires_voltage_type;
    }
    if (settingsData.hasOwnProperty('requires_additional_services')) {
      updateData.requires_additional_services = settingsData.requires_additional_services;
    }
    if (settingsData.hasOwnProperty('requires_email')) {
      updateData.requires_email = settingsData.requires_email;
    }
    if (settingsData.hasOwnProperty('requires_attachment')) {
      updateData.requires_attachment = settingsData.requires_attachment;
    }
    if (settingsData.hasOwnProperty('additional_services_list')) {
      updateData.additional_services_list = settingsData.additional_services_list;
    }
    if (settingsData.hasOwnProperty('notification_emails')) {
      updateData.notification_emails = settingsData.notification_emails;
    }
    if (settingsData.hasOwnProperty('notification_user_ids')) {
      updateData.notification_user_ids = settingsData.notification_user_ids;
    }
    if (settingsData.hasOwnProperty('email_fields')) {
      updateData.email_fields = settingsData.email_fields;
    }
    if (settingsData.hasOwnProperty('email_envio')) {
      updateData.email_envio = settingsData.email_envio || null;
    }
    if (settingsData.hasOwnProperty('email_envio_password')) {
      updateData.email_envio_password = settingsData.email_envio_password || null;
    }
    if (settingsData.hasOwnProperty('refidelizacao_prazo')) {
      updateData.refidelizacao_prazo = settingsData.refidelizacao_prazo || null;
    }
    if (settingsData.hasOwnProperty('refidelizacao_unidade')) {
      updateData.refidelizacao_unidade = settingsData.refidelizacao_unidade || 'dias';
    }
    if (settingsData.hasOwnProperty('allowed_sale_types')) {
      updateData.allowed_sale_types = settingsData.allowed_sale_types && settingsData.allowed_sale_types.length > 0
        ? settingsData.allowed_sale_types
        : ['normal', 'multiponto', 'multilocal'];
    }

    const { data, error } = await supabase
      .from('operators')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle();

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
    const seen = new Set();
    const deduplicatedConfigs = configs.filter(config => {
      const key = [
        config.partner_type || 'D2D',
        config.partner_type === 'D2D' ? (config.d2d_level || 'Nv1') : null,
        (config.partner_type === 'REV' || config.partner_type === 'Rev+') ? (config.rev_level || 1) : null,
        config.client_type,
        config.service_type,
        config.tier_mode || 'by_quantity',
        config.min_sales || 0,
        config.monthly_value_min || 0,
        config.monthly_value_max || 0,
        config.activation_type || null,
        config.refid_operation_type || null,
        config.tier_mode === 'by_power' ? (config.power_value || null) : null,
        config.service_type === 'additional_service' ? (config.additional_service_name || null) : null,
      ].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const configsPayload = deduplicatedConfigs.map(config => {
      const serviceTypes = config.service_types?.length > 0
        ? config.service_types
        : (config.service_type ? [config.service_type] : []);
      const hasRefid = serviceTypes.includes('REFID');
      const hasNIorMC = serviceTypes.includes('NI') || serviceTypes.includes('MC');

      return {
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
        d2d_level: config.partner_type === 'D2D' ? (config.d2d_level || 'Nv1') : null,
        rev_level: (config.partner_type === 'REV' || config.partner_type === 'Rev+') ? (config.rev_level || 1) : null,
        power_value: config.tier_mode === 'by_power' ? (config.power_value || null) : null,
        additional_service_name: config.service_type === 'additional_service' ? (config.additional_service_name || null) : null,
      };
    });

    const { error } = await supabase.rpc('save_commission_configs', {
      p_operator_id: operatorId,
      p_configs: configsPayload,
    });

    if (error) throw error;
    return configsPayload;
  }
};
