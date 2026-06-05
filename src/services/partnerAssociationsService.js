import { supabase } from '../lib/supabase';

export const partnerAssociationsService = {
  async getAll() {
    const { data, error } = await supabase
      .from('partner_associations')
      .select(`
        *,
        primary_partner:partners!partner_associations_primary_partner_id_fkey(id, name, partner_code),
        secondary_partner:partners!partner_associations_secondary_partner_id_fkey(id, name, partner_code)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getByPartnerId(partnerId) {
    const { data, error } = await supabase
      .from('partner_associations')
      .select(`
        *,
        primary_partner:partners!partner_associations_primary_partner_id_fkey(id, name, partner_code),
        secondary_partner:partners!partner_associations_secondary_partner_id_fkey(id, name, partner_code)
      `)
      .or(`primary_partner_id.eq.${partnerId},secondary_partner_id.eq.${partnerId}`)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  },

  async create(primaryPartnerId, secondaryPartnerId, createdBy) {
    const { data, error } = await supabase
      .from('partner_associations')
      .insert({
        primary_partner_id: primaryPartnerId,
        secondary_partner_id: secondaryPartnerId,
        created_by: createdBy
      })
      .select(`
        *,
        primary_partner:partners!partner_associations_primary_partner_id_fkey(id, name, partner_code),
        secondary_partner:partners!partner_associations_secondary_partner_id_fkey(id, name, partner_code)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  async delete(associationId) {
    const { data: assoc } = await supabase
      .from('partner_associations')
      .select('primary_partner_id, secondary_partner_id')
      .eq('id', associationId)
      .single();

    if (assoc) {
      await supabase.rpc('clear_partner_association_sales', {
        p_primary_partner_id: assoc.primary_partner_id,
        p_secondary_partner_id: assoc.secondary_partner_id
      });
    }

    const { error } = await supabase
      .from('partner_associations')
      .delete()
      .eq('id', associationId);

    if (error) throw error;
  },

  async syncExistingSales(primaryPartnerId, secondaryPartnerId) {
    const { data, error } = await supabase.rpc('sync_partner_association_sales', {
      p_primary_partner_id: primaryPartnerId,
      p_secondary_partner_id: secondaryPartnerId
    });

    if (error) throw error;
    return data;
  }
};
