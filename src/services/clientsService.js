import { supabase } from '../lib/supabase';

export const clientsService = {
  async findByNif(nif) {
    const cleanNif = (nif || '').toString().trim();
    if (!cleanNif) return null;

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('client_nif', cleanNif)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getAll() {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getByPartner(partnerId) {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async upsert(clientData) {
    const { data, error } = await supabase
      .from('clients')
      .upsert(clientData, { onConflict: 'client_nif' })
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async update(id, updateData) {
    const { data, error } = await supabase
      .from('clients')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async checkDuplicates({ contact, email, iban, excludeNif }) {
    const reasons = [];

    if (contact && contact.trim()) {
      const { data } = await supabase
        .from('clients')
        .select('id, client_nif, client_name')
        .eq('client_contact', contact.trim())
        .neq('client_nif', excludeNif || '')
        .limit(1)
        .maybeSingle();
      if (data) reasons.push('Contacto móvel duplicado');
    }

    if (email && email.trim()) {
      const { data } = await supabase
        .from('clients')
        .select('id, client_nif, client_name')
        .eq('client_email', email.trim())
        .neq('client_nif', excludeNif || '')
        .limit(1)
        .maybeSingle();
      if (data) reasons.push('Email duplicado');
    }

    if (iban && iban.trim()) {
      const { data } = await supabase
        .from('clients')
        .select('id, client_nif, client_name')
        .eq('client_iban', iban.trim())
        .neq('client_nif', excludeNif || '')
        .limit(1)
        .maybeSingle();
      if (data) reasons.push('IBAN duplicado');
    }

    return reasons;
  },
};
