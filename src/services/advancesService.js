import { supabase } from '../lib/supabase';

export const advancesService = {
  async getAll() {
    const { data, error } = await supabase
      .from('partner_advances')
      .select('*, partner:partners(id, name), creator:created_by(id, name), settler:settled_by(id, name)')
      .order('advance_date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getByPartnerId(partnerId) {
    const { data, error } = await supabase
      .from('partner_advances')
      .select('*, partner:partners(id, name)')
      .eq('partner_id', partnerId)
      .order('advance_date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getPendingByPartnerId(partnerId) {
    const { data, error } = await supabase
      .from('partner_advances')
      .select('*')
      .eq('partner_id', partnerId)
      .eq('is_settled', false)
      .is('commission_report_id', null)
      .order('advance_date', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async create(advanceData) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('partner_advances')
      .insert({
        partner_id: advanceData.partner_id,
        amount: advanceData.amount,
        advance_date: advanceData.advance_date,
        notes: advanceData.notes || null,
        created_by: user.id,
      })
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async settleAdvances(settlementItems, userId) {
    for (const item of settlementItems) {
      const remaining = item.amount - item.settled_amount;
      const settleNow = item.settle_amount;

      const newSettled = item.settled_amount + settleNow;
      const isFullySettled = newSettled >= item.amount;

      const updateData = {
        settled_amount: newSettled,
        is_settled: isFullySettled,
        settled_by: userId,
      };

      if (isFullySettled) {
        updateData.settled_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('partner_advances')
        .update(updateData)
        .eq('id', item.id);

      if (error) throw error;
    }
  },

  async delete(id) {
    const { error } = await supabase
      .from('partner_advances')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async markAsSettled(id, userId) {
    const { data: advance } = await supabase
      .from('partner_advances')
      .select('amount')
      .eq('id', id)
      .maybeSingle();

    const { error } = await supabase
      .from('partner_advances')
      .update({
        is_settled: true,
        settled_amount: advance?.amount || 0,
        settled_at: new Date().toISOString(),
        settled_by: userId,
      })
      .eq('id', id);

    if (error) throw error;
  },
};
