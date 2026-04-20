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
        id, sale_code, client_name, client_nif, activated_at,
        partner_id, partner_name, operator_id, operator_name,
        status, scope, refidelizacao_prazo, refidelizacao_unidade,
        operators!sales_operator_id_fkey(
          id, name, refidelizacao_prazo, refidelizacao_unidade
        )
      `)
      .eq('status', 'Ativo')
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

    const result = [];

    for (const sale of data) {
      const prazo = sale.refidelizacao_prazo ?? sale.operators?.refidelizacao_prazo;
      const unidade = sale.refidelizacao_unidade ?? sale.operators?.refidelizacao_unidade ?? 'dias';

      if (!prazo) continue;

      const contactDate = calcContactDate(sale.activated_at, prazo, unidade);
      contactDate.setHours(0, 0, 0, 0);

      if (contactDate <= cutoff) {
        result.push({
          ...sale,
          contact_date: contactDate.toISOString().split('T')[0],
          prazo_efetivo: prazo,
          unidade_efetiva: unidade,
          status_refidelizacao: contactDate <= today ? 'pronto' : 'brevemente'
        });
      }
    }

    result.sort((a, b) => new Date(a.contact_date) - new Date(b.contact_date));

    return result;
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
