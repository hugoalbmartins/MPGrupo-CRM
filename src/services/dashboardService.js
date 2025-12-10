import { supabase } from '../lib/supabase';

export const dashboardService = {
  async getStats(year, month) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: currentUser } = await supabase
      .from('users')
      .select('role, partner_id')
      .eq('id', user.id)
      .single();

    const now = new Date();
    const selectedYear = year || now.getFullYear();
    const selectedMonth = month || now.getMonth() + 1;

    switch (currentUser.role) {
      case 'admin':
        return await getAdminDashboard(selectedYear, selectedMonth);
      case 'bo':
        return await getBODashboard(selectedYear, selectedMonth);
      case 'partner':
        const { data: partner } = await supabase
          .from('partners')
          .select('id')
          .eq('user_id', user.id)
          .single();
        return await getPartnerDashboard(partner?.id, selectedYear, selectedMonth);
      case 'partner_commercial':
        return await getCommercialDashboard(user.id, selectedYear, selectedMonth);
      default:
        return { total_sales: 0 };
    }
  }
};

function getMonthRange(year, month) {
  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const endDate = month === 12
    ? new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0))
    : new Date(Date.UTC(year, month, 1, 0, 0, 0));

  return {
    start: startDate.toISOString(),
    end: endDate.toISOString()
  };
}

async function getLast12MonthsData() {
  const now = new Date();
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const { data: sales } = await supabase
    .from('sales')
    .select('sale_date, scope')
    .gte('sale_date', twelveMonthsAgo.toISOString().split('T')[0]);

  const monthlyData = {};

  if (sales) {
    sales.forEach(sale => {
      const date = new Date(sale.sale_date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData[key]) {
        monthlyData[key] = {
          year: date.getFullYear(),
          month_num: date.getMonth() + 1,
          telecomunicacoes: 0,
          energia: 0,
          solar: 0,
          dual: 0
        };
      }

      monthlyData[key][sale.scope] = (monthlyData[key][sale.scope] || 0) + 1;
    });
  }

  const result = [];
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    result.push(monthlyData[key] || {
      year: date.getFullYear(),
      month_num: date.getMonth() + 1,
      telecomunicacoes: 0,
      energia: 0,
      solar: 0,
      dual: 0
    });
  }

  return result;
}

async function getAdminDashboard(year, month) {
  const { start, end } = getMonthRange(year, month);

  const { data: sales } = await supabase
    .from('sales')
    .select('*')
    .gte('sale_date', start.split('T')[0])
    .lt('sale_date', end.split('T')[0]);

  const { count: partnerCount } = await supabase
    .from('partners')
    .select('*', { count: 'exact', head: true });

  const last12Months = await getLast12MonthsData();

  const stats = {
    total_sales: sales?.length || 0,
    total_partners: partnerCount || 0,
    telecomunicacoes: { count: 0, monthly_total: 0 },
    energia: { count: 0 },
    solar: { count: 0 },
    dual: { count: 0 },
    by_status: {},
    by_partner: {},
    by_operator: {},
    total_commission: 0,
    commission_to_pay: 0,
    paid_by_operator: 0,
    unpaid_by_operator: 0,
    commission_by_type: {},
    selected_month: month,
    selected_year: year,
    last_12_months: last12Months
  };

  if (sales) {
    sales.forEach(sale => {
      const scope = sale.scope || '';
      const commission = sale.calculated_commission || 0;
      const status = sale.status || 'Pendente';

      if (scope === 'telecomunicacoes') {
        stats.telecomunicacoes.count++;
        stats.telecomunicacoes.monthly_total += sale.monthly_value || 0;
      } else if (scope === 'energia') {
        stats.energia.count++;
      } else if (scope === 'solar') {
        stats.solar.count++;
      } else if (scope === 'dual') {
        stats.dual.count++;
      }

      stats.by_status[status] = (stats.by_status[status] || 0) + 1;

      if (!stats.by_partner[sale.partner_id]) {
        stats.by_partner[sale.partner_id] = { count: 0, commission: 0 };
      }
      stats.by_partner[sale.partner_id].count++;
      stats.by_partner[sale.partner_id].commission += commission;

      stats.by_operator[sale.operator_id] = (stats.by_operator[sale.operator_id] || 0) + 1;

      stats.total_commission += commission;

      if (sale.paid_to_operator) {
        stats.paid_by_operator++;
      } else {
        stats.unpaid_by_operator++;
        if (status === 'Ativo') {
          stats.commission_to_pay += commission;
        }
      }

      stats.commission_by_type[scope] = (stats.commission_by_type[scope] || 0) + commission;
    });
  }

  return stats;
}

async function getBODashboard(year, month) {
  const { start, end } = getMonthRange(year, month);

  const { data: sales } = await supabase
    .from('sales')
    .select('*')
    .gte('sale_date', start.split('T')[0])
    .lt('sale_date', end.split('T')[0]);

  const last12Months = await getLast12MonthsData();

  const stats = {
    total_sales: sales?.length || 0,
    telecomunicacoes: { count: 0, monthly_total: 0 },
    energia: { count: 0 },
    solar: { count: 0 },
    dual: { count: 0 },
    by_status: {},
    by_partner: {},
    selected_month: month,
    selected_year: year,
    last_12_months: last12Months
  };

  if (sales) {
    sales.forEach(sale => {
      const scope = sale.scope || '';
      const status = sale.status || 'Pendente';

      if (scope === 'telecomunicacoes') {
        stats.telecomunicacoes.count++;
        stats.telecomunicacoes.monthly_total += sale.monthly_value || 0;
      } else if (scope === 'energia') {
        stats.energia.count++;
      } else if (scope === 'solar') {
        stats.solar.count++;
      } else if (scope === 'dual') {
        stats.dual.count++;
      }

      stats.by_status[status] = (stats.by_status[status] || 0) + 1;

      if (!stats.by_partner[sale.partner_id]) {
        stats.by_partner[sale.partner_id] = { count: 0 };
      }
      stats.by_partner[sale.partner_id].count++;
    });
  }

  return stats;
}

async function getPartnerDashboard(partnerId, year, month) {
  const { start, end } = getMonthRange(year, month);

  const { data: sales } = await supabase
    .from('sales')
    .select('*')
    .eq('partner_id', partnerId)
    .gte('sale_date', start.split('T')[0])
    .lt('sale_date', end.split('T')[0]);

  const last12Months = await getLast12MonthsData();

  const stats = {
    total_sales: sales?.length || 0,
    telecomunicacoes: { count: 0, monthly_total: 0 },
    energia: { count: 0 },
    solar: { count: 0 },
    dual: { count: 0 },
    by_status: {},
    total_commission: 0,
    commission_pending: 0,
    commission_paid: 0,
    commission_by_status: {},
    commission_by_type: {},
    selected_month: month,
    selected_year: year,
    last_12_months: last12Months
  };

  if (sales) {
    sales.forEach(sale => {
      const scope = sale.scope || '';
      const commission = sale.calculated_commission || 0;
      const status = sale.status || 'Pendente';

      if (scope === 'telecomunicacoes') {
        stats.telecomunicacoes.count++;
        stats.telecomunicacoes.monthly_total += sale.monthly_value || 0;
      } else if (scope === 'energia') {
        stats.energia.count++;
      } else if (scope === 'solar') {
        stats.solar.count++;
      } else if (scope === 'dual') {
        stats.dual.count++;
      }

      stats.by_status[status] = (stats.by_status[status] || 0) + 1;

      stats.total_commission += commission;

      if (sale.paid_to_operator) {
        stats.commission_paid += commission;
      } else {
        stats.commission_pending += commission;
      }

      stats.commission_by_status[status] = (stats.commission_by_status[status] || 0) + commission;
      stats.commission_by_type[scope] = (stats.commission_by_type[scope] || 0) + commission;
    });
  }

  return stats;
}

async function getCommercialDashboard(userId, year, month) {
  const { start, end } = getMonthRange(year, month);

  const { data: sales } = await supabase
    .from('sales')
    .select('*')
    .eq('created_by_user_id', userId)
    .gte('sale_date', start.split('T')[0])
    .lt('sale_date', end.split('T')[0]);

  const last12Months = await getLast12MonthsData();

  const stats = {
    total_sales: sales?.length || 0,
    telecomunicacoes: { count: 0, monthly_total: 0 },
    energia: { count: 0 },
    solar: { count: 0 },
    dual: { count: 0 },
    by_status: {},
    selected_month: month,
    selected_year: year,
    last_12_months: last12Months
  };

  if (sales) {
    sales.forEach(sale => {
      const scope = sale.scope || '';
      const status = sale.status || 'Pendente';

      if (scope === 'telecomunicacoes') {
        stats.telecomunicacoes.count++;
        stats.telecomunicacoes.monthly_total += sale.monthly_value || 0;
      } else if (scope === 'energia') {
        stats.energia.count++;
      } else if (scope === 'solar') {
        stats.solar.count++;
      } else if (scope === 'dual') {
        stats.dual.count++;
      }

      stats.by_status[status] = (stats.by_status[status] || 0) + 1;
    });
  }

  return stats;
}
