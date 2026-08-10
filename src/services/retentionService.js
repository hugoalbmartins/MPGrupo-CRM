import { supabase } from '../lib/supabase';

export const retentionService = {
  async getEntriesByPartner(partnerId) {
    const { data, error } = await supabase
      .from('partner_retention_entries')
      .select('*, partner:partners(id, name), creator:created_by(id, name)')
      .eq('partner_id', partnerId)
      .order('reference_year', { ascending: false })
      .order('reference_month', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getAllEntries(filters = {}) {
    let query = supabase
      .from('partner_retention_entries')
      .select('*, partner:partners(id, name), creator:created_by(id, name)');

    if (filters.partnerId) {
      query = query.eq('partner_id', filters.partnerId);
    }
    if (filters.refunded !== undefined) {
      query = query.eq('refunded', filters.refunded);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getPendingRefundsForPartner(partnerId, month, year) {
    const { data, error } = await supabase
      .from('partner_retention_entries')
      .select('*')
      .eq('partner_id', partnerId)
      .eq('refunded', false)
      .is('commission_report_id', null)
      .or(`refund_year.lt.${year},and(refund_year.eq.${year},refund_month.lte.${month})`);

    if (error) throw error;
    return data || [];
  },

  async create(entryData) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Nao autenticado');

    const { data, error } = await supabase
      .from('partner_retention_entries')
      .insert({
        partner_id: entryData.partner_id,
        amount: entryData.amount,
        refund_month: entryData.refund_month,
        refund_year: entryData.refund_year,
        reference_month: entryData.reference_month,
        reference_year: entryData.reference_year,
        description: entryData.description || null,
        source: entryData.source || 'manual',
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('partner_retention_entries')
      .update({
        ...(updates.amount !== undefined && { amount: updates.amount }),
        ...(updates.refund_month !== undefined && { refund_month: updates.refund_month }),
        ...(updates.refund_year !== undefined && { refund_year: updates.refund_year }),
        ...(updates.reference_month !== undefined && { reference_month: updates.reference_month }),
        ...(updates.reference_year !== undefined && { reference_year: updates.reference_year }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.refunded !== undefined && { refunded: updates.refunded }),
        ...(updates.refunded_at !== undefined && { refunded_at: updates.refunded_at }),
        ...(updates.commission_report_id !== undefined && { commission_report_id: updates.commission_report_id }),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('partner_retention_entries')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async markAsRefunded(ids, reportId) {
    const { error } = await supabase
      .from('partner_retention_entries')
      .update({
        refunded: true,
        refunded_at: new Date().toISOString(),
        commission_report_id: reportId,
      })
      .in('id', ids);

    if (error) throw error;
  },

  async getRetentionSummaryByPartner(partnerId) {
    const { data, error } = await supabase.rpc('get_partner_retention_summary', {
      p_partner_id: partnerId,
    });

    if (error) throw error;
    return data?.[0] || { total_retained: 0, total_refunded: 0, total_pending: 0, entries_count: 0 };
  },

  async getRetentionOverview() {
    const { data: entries, error } = await supabase
      .from('partner_retention_entries')
      .select('partner_id, amount, refunded, refund_month, refund_year, partner:partners(id, name, partner_type)')
      .order('partner_id');

    if (error) throw error;

    const byPartner = {};
    (entries || []).forEach(entry => {
      const pid = entry.partner_id;
      if (!byPartner[pid]) {
        byPartner[pid] = {
          partner_id: pid,
          partner_name: entry.partner?.name || 'Desconhecido',
          partner_type: entry.partner?.partner_type || '-',
          total_retained: 0,
          total_refunded: 0,
          total_pending: 0,
          entries_count: 0,
        };
      }
      byPartner[pid].entries_count++;
      if (entry.refunded) {
        byPartner[pid].total_refunded += parseFloat(entry.amount || 0);
      } else {
        byPartner[pid].total_retained += parseFloat(entry.amount || 0);
        byPartner[pid].total_pending += parseFloat(entry.amount || 0);
      }
    });

    return Object.values(byPartner);
  },

  async syncSalesRetentions(partnerId, month, year) {
    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select('id, retention_value, retention_months, activation_date, client_name')
      .eq('partner_id', partnerId)
      .eq('status', 'Ativo')
      .gt('retention_value', 0);

    if (salesError) throw salesError;

    const filteredSales = (sales || []).filter(sale => {
      if (!sale.activation_date) return false;
      const d = new Date(sale.activation_date);
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    });

    const { data: existing, error: existError } = await supabase
      .from('partner_retention_entries')
      .select('id')
      .eq('partner_id', partnerId)
      .eq('source', 'sales')
      .eq('reference_month', month)
      .eq('reference_year', year);

    if (existError) throw existError;

    if (existing && existing.length > 0) {
      return { synced: 0, alreadyExists: true };
    }

    const totalRetention = filteredSales.reduce((sum, s) => sum + parseFloat(s.retention_value || 0), 0);
    if (totalRetention <= 0) {
      return { synced: 0, noRetention: true };
    }

    const retMonths = filteredSales[0]?.retention_months || 6;
    const refundDate = new Date(year, month - 1 + retMonths, 1);

    await retentionService.create({
      partner_id: partnerId,
      amount: totalRetention,
      refund_month: refundDate.getMonth() + 1,
      refund_year: refundDate.getFullYear(),
      reference_month: month,
      reference_year: year,
      description: `Retencao de vendas (${filteredSales.length} vendas) - ${month.toString().padStart(2, '0')}/${year}`,
      source: 'sales',
    });

    return { synced: filteredSales.length, total: totalRetention };
  },
};
