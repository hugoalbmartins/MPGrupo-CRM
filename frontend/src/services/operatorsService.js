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
    const { data, error } = await supabase
      .from('operators')
      .update({
        name: operatorData.name,
        scope: operatorData.scope,
        energy_type: operatorData.energy_type || null,
        commission_config: operatorData.commission_config || {}
      })
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
