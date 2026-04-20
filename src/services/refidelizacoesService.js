import { supabase } from '../lib/supabase';

function calcContactDate(activatedAt, prazo, unidade) {
  const base = new Date(activatedAt);
  if (unidade === 'meses') {
    base.setMonth(base.getMonth() + prazo);
  } else {
    base.setDate(base.getDate() + prazo);
  }
  base.setDate(base.getDate() + 1);
  return base;
}

export const refidelizacoesService = {
  async getAll({ user = null, partnerId = null, operatorId = null } = {}) {
    const isPartner = user?.role === 'partner' || user?.role === 'partner_commercial';

    let query = supabase
      .from('sales')
      .select(`
        id, sale_code, client_name, client_nif, cpe, cui, activated_at,
        partner_id, partner_name, operator_id, operator_name,
        status, scope, refidelizacao_prazo, refidelizacao_unidade,
        refidelizado, refidelizado_at, refidelizado_sale_id,
        operators!sales_operator_id_fkey(
          id, name, refidelizacao_prazo, refidelizacao_unidade
        )
      `)
      .eq('status', 'Ativo')
      .neq('refidelizado', true)
      .not('activated_at', 'is', null);

    if (isPartner && user?.partner_id) {
      query = query.eq('partner_id', user.partner_id);
    } else if (partnerId) {
      query = query.eq('partner_id', partnerId);
    }

    if (operatorId) {
      query = query.eq('operator_id', operatorId);
    }

    const { data, error } = await query.order('activated_at', { ascending: true });

    if (error) throw error;
    if (!data) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() + 2);

    const eligible = [];

    for (const sale of data) {
      const hasSaleOverride = sale.refidelizacao_prazo != null;
      const prazo = hasSaleOverride ? sale.refidelizacao_prazo : sale.operators?.refidelizacao_prazo;
      const unidade = hasSaleOverride
        ? (sale.refidelizacao_unidade || 'dias')
        : (sale.operators?.refidelizacao_unidade || 'dias');

      if (!prazo) continue;

      const contactDate = calcContactDate(sale.activated_at, prazo, unidade);
      contactDate.setHours(0, 0, 0, 0);

      if (contactDate <= cutoff) {
        eligible.push({
          ...sale,
          contact_date: contactDate.toISOString().split('T')[0],
          prazo_efetivo: prazo,
          unidade_efetiva: unidade,
          status_refidelizacao: contactDate <= today ? 'pronto' : 'brevemente'
        });
      }
    }

    const autoRefidelized = await this._detectAutoRefidelizados(eligible);
    const result = eligible.filter(s => !autoRefidelized.has(s.id));

    result.sort((a, b) => new Date(a.contact_date) - new Date(b.contact_date));

    return result;
  },

  async _detectAutoRefidelizados(eligibleSales) {
    const refidelizedIds = new Set();
    if (eligibleSales.length === 0) return refidelizedIds;

    const nifs = [...new Set(eligibleSales.map(s => s.client_nif).filter(Boolean))];
    if (nifs.length === 0) return refidelizedIds;

    const { data: newerSales, error } = await supabase
      .from('sales')
      .select('id, client_nif, cpe, cui, scope, operator_id, activated_at, created_at')
      .in('client_nif', nifs)
      .eq('status', 'Ativo')
      .order('created_at', { ascending: false });

    if (error || !newerSales) return refidelizedIds;

    const newerByNif = {};
    for (const ns of newerSales) {
      if (!newerByNif[ns.client_nif]) newerByNif[ns.client_nif] = [];
      newerByNif[ns.client_nif].push(ns);
    }

    const toMark = [];

    for (const sale of eligibleSales) {
      const candidates = newerByNif[sale.client_nif] || [];
      const newerSale = candidates.find(c => {
        if (c.id === sale.id) return false;
        if (c.operator_id !== sale.operator_id) return false;
        if (new Date(c.created_at) <= new Date(sale.created_at || sale.activated_at)) return false;

        if (sale.scope === 'energia' || sale.scope === 'energy') {
          const saleCpeOrCui = sale.cpe || sale.cui;
          const candCpeOrCui = c.cpe || c.cui;
          if (saleCpeOrCui && candCpeOrCui && saleCpeOrCui === candCpeOrCui) return true;
          return false;
        }

        return true;
      });

      if (newerSale) {
        refidelizedIds.add(sale.id);
        toMark.push({ id: sale.id, refidelizado_sale_id: newerSale.id });
      }
    }

    if (toMark.length > 0) {
      for (const item of toMark) {
        await supabase
          .from('sales')
          .update({
            refidelizado: true,
            refidelizado_at: new Date().toISOString(),
            refidelizado_sale_id: item.refidelizado_sale_id,
          })
          .eq('id', item.id);
      }
    }

    return refidelizedIds;
  },

  async markAsRefidelizado(saleId, userId) {
    const { error } = await supabase
      .from('sales')
      .update({
        refidelizado: true,
        refidelizado_at: new Date().toISOString(),
        refidelizado_por: userId,
      })
      .eq('id', saleId);

    if (error) throw error;
  },

  async unmarkRefidelizado(saleId) {
    const { error } = await supabase
      .from('sales')
      .update({
        refidelizado: false,
        refidelizado_at: null,
        refidelizado_por: null,
        refidelizado_sale_id: null,
      })
      .eq('id', saleId);

    if (error) throw error;
  },

  async getPartners() {
    const { data, error } = await supabase
      .from('partners')
      .select('id, name')
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async getSaleDetail(saleId) {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .eq('id', saleId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }
};
