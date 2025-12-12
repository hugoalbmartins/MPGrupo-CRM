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
        commission_mode: operatorData.commission_mode || 'tier',
        pays_direct_debit: operatorData.pays_direct_debit || false,
        pays_electronic_invoice: operatorData.pays_electronic_invoice || false,
        active: true,
        hidden: false,
        commission_config: operatorData.commission_config || {}
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
      energy_type: operatorData.energy_type || null,
      commission_config: operatorData.commission_config || {}
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
  }
};
