import { supabase } from '../lib/supabase';

export const dashboardService = {
  async getStats(year, month) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: currentUser } = await supabase
      .from('users')
      .select('role, partner_id, is_commissioned')
      .eq('id', user.id)
      .single();

    const now = new Date();
    const selectedYear = year || now.getFullYear();
    const selectedMonth = month || now.getMonth() + 1;

    switch (currentUser.role) {
      case 'admin':
        return await getAdminDashboard(selectedYear, selectedMonth, user.id, currentUser.is_commissioned);
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

async function calculateRetentions(year, month) {
  const { start, end } = getMonthRange(year, month);

  const { data: currentSales } = await supabase
    .from('sales')
    .select('*, operator_id')
    .gte('date', start.split('T')[0])
    .lt('date', end.split('T')[0]);

  let currentMonthRetentions = 0;

  if (currentSales) {
    for (const sale of currentSales) {
      const serviceTypeToMatch = sale.scope === 'energia'
        ? (sale.energy_sale_type || 'eletricidade')
        : sale.service_type;

      if (!serviceTypeToMatch) continue;

      const { data: commissionConfigs } = await supabase
        .from('commission_configurations')
        .select('has_retention, retention_percentage')
        .eq('operator_id', sale.operator_id)
        .eq('service_type', serviceTypeToMatch)
        .limit(1);

      const commissionConfig = commissionConfigs?.[0];

      if (commissionConfig?.has_retention) {
        const commission = parseFloat(sale.calculated_commission || 0);
        const retentionPct = parseFloat(commissionConfig.retention_percentage || 0);
        currentMonthRetentions += (commission * retentionPct) / 100;
      }
    }
  }

  const returnDate = new Date(year, month + 5, 1);
  const returnYear = returnDate.getFullYear();
  const returnMonth = returnDate.getMonth() + 1;

  const paymentDate = new Date(year, month - 1, 1);
  const sixMonthsAgo = new Date(paymentDate);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const returnStartDate = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth(), 1);
  const returnEndDate = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth() + 1, 1);

  const { data: returnSales } = await supabase
    .from('sales')
    .select('*, operator_id')
    .gte('date', returnStartDate.toISOString().split('T')[0])
    .lt('date', returnEndDate.toISOString().split('T')[0]);

  let retentionsToReturn = 0;
  let returnPeriod = `${sixMonthsAgo.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}`;

  if (returnSales) {
    for (const sale of returnSales) {
      const serviceTypeToMatch = sale.scope === 'energia'
        ? (sale.energy_sale_type || 'eletricidade')
        : sale.service_type;

      if (!serviceTypeToMatch) continue;

      const { data: commissionConfigs } = await supabase
        .from('commission_configurations')
        .select('has_retention, retention_percentage')
        .eq('operator_id', sale.operator_id)
        .eq('service_type', serviceTypeToMatch)
        .limit(1);

      const commissionConfig = commissionConfigs?.[0];

      if (commissionConfig?.has_retention) {
        const commission = parseFloat(sale.calculated_commission || 0);
        const retentionPct = parseFloat(commissionConfig.retention_percentage || 0);
        retentionsToReturn += (commission * retentionPct) / 100;
      }
    }
  }

  return {
    current_month: currentMonthRetentions,
    to_return: retentionsToReturn,
    return_period: returnPeriod,
    return_date: `01/${String(returnMonth).padStart(2, '0')}/${returnYear}`
  };
}

async function calculateNetCommission(sales) {
  let totalGross = 0;
  let totalRetention = 0;

  if (!sales || sales.length === 0) {
    return { gross: 0, retention: 0, net: 0 };
  }

  for (const sale of sales) {
    const commission = parseFloat(sale.calculated_commission || sale.manual_commission || 0);
    totalGross += commission;

    const serviceTypeToMatch = sale.scope === 'energia'
      ? (sale.energy_sale_type || 'eletricidade')
      : sale.service_type;

    if (!serviceTypeToMatch) continue;

    const { data: commissionConfigs } = await supabase
      .from('commission_configurations')
      .select('has_retention, retention_percentage')
      .eq('operator_id', sale.operator_id)
      .eq('service_type', serviceTypeToMatch)
      .limit(1);

    const commissionConfig = commissionConfigs?.[0];

    if (commissionConfig?.has_retention) {
      const retentionPct = parseFloat(commissionConfig.retention_percentage || 0);
      totalRetention += (commission * retentionPct) / 100;
    }
  }

  return {
    gross: totalGross,
    retention: totalRetention,
    net: totalGross - totalRetention
  };
}

async function getLast12MonthsData() {
  const now = new Date();
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const { data: sales } = await supabase
    .from('sales')
    .select('date, scope')
    .gte('date', twelveMonthsAgo.toISOString().split('T')[0]);

  const monthlyData = {};

  if (sales) {
    sales.forEach(sale => {
      const date = new Date(sale.date);
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

async function getAdminDashboard(year, month, adminId, isCommissioned) {
  const { start, end } = getMonthRange(year, month);

  const { data: sales } = await supabase
    .from('sales')
    .select('*')
    .gte('date', start.split('T')[0])
    .lt('date', end.split('T')[0]);

  const { count: partnerCount } = await supabase
    .from('partners')
    .select('*', { count: 'exact', head: true });

  const last12Months = await getLast12MonthsData();

  const retentions = await calculateRetentions(year, month);
  const netCommissions = await calculateNetCommission(sales);

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
    total_commission_gross: netCommissions.gross,
    total_commission: netCommissions.net,
    total_retention: netCommissions.retention,
    commission_to_pay: 0,
    paid_by_operator: 0,
    unpaid_by_operator: 0,
    commission_by_type: {},
    selected_month: month,
    selected_year: year,
    last_12_months: last12Months,
    admin_sales_count: 0,
    admin_commission_pending: 0,
    admin_commission_paid: 0,
    current_month_retentions: retentions.current_month,
    retentions_to_return: retentions.to_return
  };

  if (sales) {
    sales.forEach(sale => {
      const scope = sale.scope || '';
      const commission = sale.manual_commission || sale.calculated_commission || 0;
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

      if (sale.paid_to_operator) {
        stats.paid_by_operator++;
        if (status === 'Ativo') {
          stats.commission_to_pay += commission;
        }
      } else {
        stats.unpaid_by_operator++;
      }

      stats.commission_by_type[scope] = (stats.commission_by_type[scope] || 0) + commission;

      if (isCommissioned && sale.created_by_user_id === adminId && !sale.partner_id) {
        stats.admin_sales_count++;
        if (sale.paid_to_operator || sale.electricity_paid || sale.gas_paid) {
          stats.admin_commission_paid += commission;
        } else {
          stats.admin_commission_pending += commission;
        }
      }
    });
  }

  return stats;
}

async function getBODashboard(year, month) {
  const { start, end } = getMonthRange(year, month);

  const { data: sales } = await supabase
    .from('sales')
    .select('*')
    .gte('date', start.split('T')[0])
    .lt('date', end.split('T')[0]);

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
    .gte('date', start.split('T')[0])
    .lt('date', end.split('T')[0]);

  const last12Months = await getLast12MonthsData();
  const retentions = await calculateRetentions(year, month);
  const netCommissions = await calculateNetCommission(sales);

  const stats = {
    total_sales: sales?.length || 0,
    telecomunicacoes: { count: 0, monthly_total: 0 },
    energia: { count: 0 },
    solar: { count: 0 },
    dual: { count: 0 },
    by_status: {},
    total_commission_gross: netCommissions.gross,
    total_commission: netCommissions.net,
    total_retention: netCommissions.retention,
    commission_pending: 0,
    commission_paid: 0,
    commission_by_status: {},
    commission_by_type: {},
    selected_month: month,
    selected_year: year,
    last_12_months: last12Months,
    current_month_retentions: retentions.current_month,
    retentions_to_return: retentions.to_return
  };

  if (sales) {
    sales.forEach(sale => {
      const scope = sale.scope || '';
      const commission = sale.manual_commission || sale.calculated_commission || 0;
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
    .gte('date', start.split('T')[0])
    .lt('date', end.split('T')[0]);

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
