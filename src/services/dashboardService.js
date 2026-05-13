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
        return await getAdminDashboard(selectedYear, selectedMonth, user.id, currentUser.is_commissioned, currentUser.partner_id);
      case 'bo':
        return await getBODashboard(selectedYear, selectedMonth);
      case 'partner':
        const { data: partner } = await supabase
          .from('partners')
          .select('id, partner_type')
          .eq('user_id', user.id)
          .single();
        const dashboardData = await getPartnerDashboard(partner?.id, selectedYear, selectedMonth);
        return { ...dashboardData, partner_type: partner?.partner_type };
      case 'partner_commercial':
        return await getCommercialDashboard(user.id, selectedYear, selectedMonth);
      case 'gestor_nv1':
        return await getManagerLevel1Dashboard(user.id, selectedYear, selectedMonth);
      default:
        return { total_sales: 0 };
    }
  },

  async getProposalStats() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: currentUser } = await supabase
      .from('users')
      .select('role, partner_id, is_commissioned')
      .eq('id', user.id)
      .single();

    switch (currentUser.role) {
      case 'admin':
        return await getAdminProposalStats(user.id, currentUser.is_commissioned, currentUser.partner_id);
      case 'bo':
        return await getBOProposalStats();
      case 'partner':
        const { data: partner } = await supabase
          .from('partners')
          .select('id')
          .eq('user_id', user.id)
          .single();
        return await getPartnerProposalStats(partner?.id);
      case 'gestor_nv1':
        return await getManagerProposalStats(user.id);
      default:
        return { total_proposals: 0 };
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

async function fetchScopesMeta() {
  const { data } = await supabase
    .from('scopes')
    .select('slug, display_name, icon, color, sort_order, counting_mode, quantity_field')
    .eq('active', true)
    .order('sort_order');
  return data || [];
}

function getSaleQuantity(sale, scopesMetaMap) {
  const scope = sale.scope || '';
  const scopeMeta = scopesMetaMap[scope];
  if (!scopeMeta || scopeMeta.counting_mode !== 'by_quantity' || !scopeMeta.quantity_field) {
    return 1;
  }
  const qtyField = scopeMeta.quantity_field;
  if (sale.custom_fields && sale.custom_fields[qtyField] !== undefined) {
    return parseInt(sale.custom_fields[qtyField]) || 1;
  }
  if (sale[qtyField] !== undefined) {
    return parseInt(sale[qtyField]) || 1;
  }
  return 1;
}

function buildByScope(sales, scopesMetaMap = {}) {
  const byScope = {};
  if (!sales) return byScope;
  for (const sale of sales) {
    const scope = sale.scope || '';
    if (!scope) continue;
    if (!byScope[scope]) {
      byScope[scope] = { count: 0, monthly_total: 0, electricity: 0, gas: 0, dual: 0, by_operator: {} };
    }
    const qty = getSaleQuantity(sale, scopesMetaMap);
    byScope[scope].count += qty;
    if (scope === 'telecomunicacoes') {
      byScope[scope].monthly_total += sale.monthly_value || 0;
      if (sale.operator_id) {
        byScope[scope].by_operator[sale.operator_id] = (byScope[scope].by_operator[sale.operator_id] || 0) + qty;
      }
    }
    if (scope === 'energia') {
      const et = sale.energy_sale_type || 'eletricidade';
      if (et === 'eletricidade') byScope[scope].electricity += qty;
      else if (et === 'gas') byScope[scope].gas += qty;
      else if (et === 'dual') { byScope[scope].dual += qty; byScope[scope].electricity += qty; byScope[scope].gas += qty; }
    }
  }
  return byScope;
}

async function calculateRetentions(year, month, partnerId = null) {
  const { start, end } = getMonthRange(year, month);

  let currentQuery = supabase
    .from('sales')
    .select('*, operator_id')
    .gte('date', start.split('T')[0])
    .lt('date', end.split('T')[0]);
  if (partnerId) currentQuery = currentQuery.eq('partner_id', partnerId);
  const { data: currentSales } = await currentQuery;

  const { data: allCommissionConfigs } = await supabase
    .from('commission_configurations')
    .select('operator_id, service_type, has_retention, retention_percentage');

  const configMap = {};
  if (allCommissionConfigs) {
    allCommissionConfigs.forEach(config => {
      const key = `${config.operator_id}_${config.service_type}`;
      configMap[key] = config;
    });
  }

  let currentMonthRetentions = 0;

  if (currentSales) {
    for (const sale of currentSales) {
      const serviceTypeToMatch = sale.scope === 'energia'
        ? (sale.energy_sale_type || 'eletricidade')
        : sale.service_type;

      if (!serviceTypeToMatch) continue;

      const key = `${sale.operator_id}_${serviceTypeToMatch}`;
      const commissionConfig = configMap[key];

      if (commissionConfig?.has_retention) {
        const commission = parseFloat(sale.calculated_commission || 0);
        const retentionPct = parseFloat(commissionConfig.retention_percentage || 0);
        currentMonthRetentions += (commission * retentionPct) / 100;
      }
    }
  }

  const paymentDate = new Date(year, month - 1, 1);
  const sixMonthsAgo = new Date(paymentDate);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const returnStartDate = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth(), 1);
  const returnEndDate = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth() + 1, 1);

  let returnQuery = supabase
    .from('sales')
    .select('*, operator_id')
    .gte('date', returnStartDate.toISOString().split('T')[0])
    .lt('date', returnEndDate.toISOString().split('T')[0]);
  if (partnerId) returnQuery = returnQuery.eq('partner_id', partnerId);
  const { data: returnSales } = await returnQuery;

  let retentionsToReturn = 0;
  let returnPeriod = `${sixMonthsAgo.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}`;

  if (returnSales) {
    for (const sale of returnSales) {
      const serviceTypeToMatch = sale.scope === 'energia'
        ? (sale.energy_sale_type || 'eletricidade')
        : sale.service_type;

      if (!serviceTypeToMatch) continue;

      const key = `${sale.operator_id}_${serviceTypeToMatch}`;
      const commissionConfig = configMap[key];

      if (commissionConfig?.has_retention) {
        const commission = parseFloat(sale.calculated_commission || 0);
        const retentionPct = parseFloat(commissionConfig.retention_percentage || 0);
        retentionsToReturn += (commission * retentionPct) / 100;
      }
    }
  }

  const returnDate = new Date(year, month + 5, 1);
  const returnYear = returnDate.getFullYear();
  const returnMonth = returnDate.getMonth() + 1;

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

  const { data: allCommissionConfigs } = await supabase
    .from('commission_configurations')
    .select('operator_id, service_type, has_retention, retention_percentage');

  const configMap = {};
  if (allCommissionConfigs) {
    allCommissionConfigs.forEach(config => {
      const key = `${config.operator_id}_${config.service_type}`;
      configMap[key] = config;
    });
  }

  for (const sale of sales) {
    const commission = parseFloat(sale.calculated_commission || sale.manual_commission || 0);
    totalGross += commission;

    const serviceTypeToMatch = sale.scope === 'energia'
      ? (sale.energy_sale_type || 'eletricidade')
      : sale.service_type;

    if (!serviceTypeToMatch) continue;

    const key = `${sale.operator_id}_${serviceTypeToMatch}`;
    const commissionConfig = configMap[key];

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

async function getLast12MonthsData(partnerId = null) {
  const now = new Date();
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  let query = supabase
    .from('sales')
    .select('date, scope, custom_fields, ev_outlet_count')
    .gte('date', twelveMonthsAgo.toISOString().split('T')[0])
    .neq('status', 'Em proposta');

  if (partnerId) {
    query = query.eq('partner_id', partnerId);
  }

  const [salesResult, scopesMeta] = await Promise.all([
    query,
    fetchScopesMeta()
  ]);

  const { data: sales } = salesResult;
  const scopesMetaMap = {};
  scopesMeta.forEach(s => { scopesMetaMap[s.slug] = s; });

  const allScopes = new Set();
  const monthlyData = {};

  if (sales) {
    sales.forEach(sale => {
      const date = new Date(sale.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData[key]) {
        monthlyData[key] = {
          year: date.getFullYear(),
          month_num: date.getMonth() + 1,
        };
      }

      const scope = sale.scope || '';
      if (scope) {
        allScopes.add(scope);
        const qty = getSaleQuantity(sale, scopesMetaMap);
        monthlyData[key][scope] = (monthlyData[key][scope] || 0) + qty;
      }
    });
  }

  const result = [];
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    const entry = monthlyData[key] || {
      year: date.getFullYear(),
      month_num: date.getMonth() + 1,
    };
    allScopes.forEach(s => { if (entry[s] === undefined) entry[s] = 0; });
    result.push(entry);
  }

  return result;
}

async function getAdminDashboard(year, month, adminId, isCommissioned, adminPartnerId = null) {
  const { start, end } = getMonthRange(year, month);

  const [salesResult, partnerCountResult, last12Months, allCommissionConfigs, scopesResult] = await Promise.all([
    supabase
      .from('sales')
      .select('*')
      .gte('date', start.split('T')[0])
      .lt('date', end.split('T')[0])
      .neq('status', 'Em proposta'),
    supabase
      .from('partners')
      .select('*', { count: 'exact', head: true }),
    getLast12MonthsData(),
    supabase
      .from('commission_configurations')
      .select('operator_id, service_type, has_retention, retention_percentage'),
    supabase
      .from('scopes')
      .select('slug, display_name, icon, color, sort_order, counting_mode, quantity_field')
      .eq('active', true)
      .order('sort_order')
  ]);

  const sales = salesResult.data;
  const partnerCount = partnerCountResult.count;

  const configMap = {};
  if (allCommissionConfigs.data) {
    allCommissionConfigs.data.forEach(config => {
      const key = `${config.operator_id}_${config.service_type}`;
      configMap[key] = config;
    });
  }

  const scopesMeta = scopesResult.data || [];
  const scopesMetaMap = {};
  scopesMeta.forEach(s => { scopesMetaMap[s.slug] = s; });
  const retentions = await calculateRetentions(year, month);
  const netCommissions = await calculateNetCommission(sales);

  const stats = {
    total_sales: 0,
    total_partners: partnerCount || 0,
    telecomunicacoes: { count: 0, monthly_total: 0 },
    energia: { count: 0, electricity: 0, gas: 0, dual: 0 },
    solar: { count: 0 },
    mobilidade_eletrica: { count: 0 },
    by_scope: {},
    scopes_meta: scopesMeta,
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
    admin_retention: 0,
    current_month_retentions: retentions.current_month,
    retentions_to_return: retentions.to_return,
    dd_count: 0,
    fe_count: 0
  };

  if (sales) {
    for (const sale of sales) {
      const scope = sale.scope || '';
      const commission = sale.manual_commission || sale.calculated_commission || 0;
      const status = sale.status || 'Pendente';
      const qty = getSaleQuantity(sale, scopesMetaMap);

      stats.total_sales += qty;

      if (scope === 'telecomunicacoes') {
        stats.telecomunicacoes.count += qty;
        stats.telecomunicacoes.monthly_total += sale.monthly_value || 0;
      } else if (scope === 'energia') {
        stats.energia.count += qty;

        const energyType = sale.energy_sale_type || 'eletricidade';
        if (energyType === 'eletricidade') {
          stats.energia.electricity += qty;
        } else if (energyType === 'gas') {
          stats.energia.gas += qty;
        } else if (energyType === 'dual') {
          stats.energia.dual += qty;
          stats.energia.electricity += qty;
          stats.energia.gas += qty;
        }
      } else if (scope === 'solar') {
        stats.solar.count += qty;
      } else if (scope === 'mobilidade_eletrica') {
        stats.mobilidade_eletrica.count += qty;
      }

      stats.by_status[status] = (stats.by_status[status] || 0) + 1;

      if (!stats.by_partner[sale.partner_id]) {
        stats.by_partner[sale.partner_id] = { count: 0, commission: 0 };
      }
      stats.by_partner[sale.partner_id].count += qty;
      stats.by_partner[sale.partner_id].commission += commission;

      stats.by_operator[sale.operator_id] = (stats.by_operator[sale.operator_id] || 0) + qty;

      if (sale.paid_to_operator) {
        stats.paid_by_operator++;
        if (status === 'Ativo') {
          stats.commission_to_pay += commission;
        }
      } else {
        stats.unpaid_by_operator++;
      }

      stats.commission_by_type[scope] = (stats.commission_by_type[scope] || 0) + commission;

      if (sale.has_direct_debit) stats.dd_count++;
      if (sale.has_electronic_invoice) stats.fe_count++;

      const isAdminOwnSale = isCommissioned && (
        (adminPartnerId && sale.partner_id === adminPartnerId) ||
        (!adminPartnerId && sale.created_by_user_id === adminId && !sale.partner_id)
      );

      if (isAdminOwnSale) {
        stats.admin_sales_count++;
        if (sale.paid_to_operator || sale.electricity_paid || sale.gas_paid) {
          stats.admin_commission_paid += commission;
        } else {
          stats.admin_commission_pending += commission;
        }

        const serviceTypeToMatch = sale.scope === 'energia'
          ? (sale.energy_sale_type || 'eletricidade')
          : sale.service_type;

        if (serviceTypeToMatch) {
          const key = `${sale.operator_id}_${serviceTypeToMatch}`;
          const commissionConfig = configMap[key];

          if (commissionConfig?.has_retention) {
            const retentionPct = parseFloat(commissionConfig.retention_percentage || 0);
            stats.admin_retention += (commission * retentionPct) / 100;
          }
        }
      }
    }
  }

  stats.by_scope = buildByScope(sales, scopesMetaMap);
  return stats;
}

async function getBODashboard(year, month) {
  const { start, end } = getMonthRange(year, month);

  const [salesResult, last12Months, scopesMeta] = await Promise.all([
    supabase
      .from('sales')
      .select('*')
      .gte('date', start.split('T')[0])
      .lt('date', end.split('T')[0])
      .neq('status', 'Em proposta'),
    getLast12MonthsData(),
    fetchScopesMeta()
  ]);

  const sales = salesResult.data;
  const scopesMetaMap = {};
  scopesMeta.forEach(s => { scopesMetaMap[s.slug] = s; });

  const stats = {
    total_sales: 0,
    telecomunicacoes: { count: 0, monthly_total: 0 },
    energia: { count: 0, electricity: 0, gas: 0, dual: 0 },
    solar: { count: 0 },
    mobilidade_eletrica: { count: 0 },
    by_scope: {},
    scopes_meta: scopesMeta,
    by_status: {},
    by_partner: {},
    selected_month: month,
    selected_year: year,
    last_12_months: last12Months,
    dd_count: 0,
    fe_count: 0
  };

  if (sales) {
    sales.forEach(sale => {
      const scope = sale.scope || '';
      const status = sale.status || 'Pendente';
      const qty = getSaleQuantity(sale, scopesMetaMap);

      stats.total_sales += qty;

      if (scope === 'telecomunicacoes') {
        stats.telecomunicacoes.count += qty;
        stats.telecomunicacoes.monthly_total += sale.monthly_value || 0;
      } else if (scope === 'energia') {
        stats.energia.count += qty;

        const energyType = sale.energy_sale_type || 'eletricidade';
        if (energyType === 'eletricidade') {
          stats.energia.electricity += qty;
        } else if (energyType === 'gas') {
          stats.energia.gas += qty;
        } else if (energyType === 'dual') {
          stats.energia.dual += qty;
          stats.energia.electricity += qty;
          stats.energia.gas += qty;
        }
      } else if (scope === 'solar') {
        stats.solar.count += qty;
      } else if (scope === 'mobilidade_eletrica') {
        stats.mobilidade_eletrica.count += qty;
      }

      stats.by_status[status] = (stats.by_status[status] || 0) + 1;

      if (!stats.by_partner[sale.partner_id]) {
        stats.by_partner[sale.partner_id] = { count: 0 };
      }
      stats.by_partner[sale.partner_id].count += qty;

      if (sale.has_direct_debit) stats.dd_count++;
      if (sale.has_electronic_invoice) stats.fe_count++;
    });
  }

  stats.by_scope = buildByScope(sales, scopesMetaMap);
  return stats;
}

async function getPartnerDashboard(partnerId, year, month) {
  const { start, end } = getMonthRange(year, month);

  const [salesResult, last12Months, operatorsResult, scopesMeta] = await Promise.all([
    supabase
      .from('sales')
      .select('*')
      .eq('partner_id', partnerId)
      .gte('date', start.split('T')[0])
      .lt('date', end.split('T')[0])
      .neq('status', 'Em proposta'),
    getLast12MonthsData(partnerId),
    supabase
      .from('operators')
      .select('id, name')
      .eq('hidden', false),
    fetchScopesMeta()
  ]);

  const sales = salesResult.data;
  const operators = operatorsResult.data || [];
  const scopesMetaMap = {};
  scopesMeta.forEach(s => { scopesMetaMap[s.slug] = s; });
  const retentions = await calculateRetentions(year, month, partnerId);
  const netCommissions = await calculateNetCommission(sales);

  const stats = {
    total_sales: 0,
    telecomunicacoes: { count: 0, monthly_total: 0 },
    energia: { count: 0, electricity: 0, gas: 0, dual: 0 },
    solar: { count: 0 },
    mobilidade_eletrica: { count: 0 },
    by_scope: {},
    scopes_meta: scopesMeta,
    by_status: {},
    by_operator: {},
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
    retentions_to_return: retentions.to_return,
    dd_count: 0,
    fe_count: 0
  };

  if (sales) {
    sales.forEach(sale => {
      const scope = sale.scope || '';
      const commission = sale.manual_commission || sale.calculated_commission || 0;
      const status = sale.status || 'Pendente';
      const qty = getSaleQuantity(sale, scopesMetaMap);

      stats.total_sales += qty;

      if (scope === 'telecomunicacoes') {
        stats.telecomunicacoes.count += qty;
        stats.telecomunicacoes.monthly_total += sale.monthly_value || 0;
      } else if (scope === 'energia') {
        stats.energia.count += qty;

        const energyType = sale.energy_sale_type || 'eletricidade';
        if (energyType === 'eletricidade') {
          stats.energia.electricity += qty;
        } else if (energyType === 'gas') {
          stats.energia.gas += qty;
        } else if (energyType === 'dual') {
          stats.energia.dual += qty;
          stats.energia.electricity += qty;
          stats.energia.gas += qty;
        }
      } else if (scope === 'solar') {
        stats.solar.count += qty;
      } else if (scope === 'mobilidade_eletrica') {
        stats.mobilidade_eletrica.count += qty;
      }

      stats.by_status[status] = (stats.by_status[status] || 0) + 1;
      stats.by_operator[sale.operator_id] = (stats.by_operator[sale.operator_id] || 0) + qty;

      if (sale.paid_to_operator) {
        stats.commission_paid += commission;
      } else {
        stats.commission_pending += commission;
      }

      stats.commission_by_status[status] = (stats.commission_by_status[status] || 0) + commission;
      stats.commission_by_type[scope] = (stats.commission_by_type[scope] || 0) + commission;

      if (sale.has_direct_debit) stats.dd_count++;
      if (sale.has_electronic_invoice) stats.fe_count++;
    });
  }

  stats.by_scope = buildByScope(sales, scopesMetaMap);

  const operatorStats = operators.map(op => ({
    id: op.id,
    name: op.name,
    count: stats.by_operator[op.id] || 0
  }));

  return { ...stats, operator_stats: operatorStats };
}

async function getCommercialDashboard(userId, year, month) {
  const { start, end } = getMonthRange(year, month);

  const [salesResult, last12Months, scopesMeta] = await Promise.all([
    supabase
      .from('sales')
      .select('*')
      .eq('created_by_user_id', userId)
      .gte('date', start.split('T')[0])
      .lt('date', end.split('T')[0])
      .neq('status', 'Em proposta'),
    getLast12MonthsData(),
    fetchScopesMeta()
  ]);

  const sales = salesResult.data;
  const scopesMetaMap = {};
  scopesMeta.forEach(s => { scopesMetaMap[s.slug] = s; });

  const stats = {
    total_sales: 0,
    telecomunicacoes: { count: 0, monthly_total: 0 },
    energia: { count: 0, electricity: 0, gas: 0, dual: 0 },
    solar: { count: 0 },
    mobilidade_eletrica: { count: 0 },
    by_scope: {},
    scopes_meta: scopesMeta,
    by_status: {},
    selected_month: month,
    selected_year: year,
    last_12_months: last12Months,
    dd_count: 0,
    fe_count: 0
  };

  if (sales) {
    sales.forEach(sale => {
      const scope = sale.scope || '';
      const status = sale.status || 'Pendente';
      const qty = getSaleQuantity(sale, scopesMetaMap);

      stats.total_sales += qty;

      if (scope === 'telecomunicacoes') {
        stats.telecomunicacoes.count += qty;
        stats.telecomunicacoes.monthly_total += sale.monthly_value || 0;
      } else if (scope === 'energia') {
        stats.energia.count += qty;
        const energyType = sale.energy_sale_type || 'eletricidade';
        if (energyType === 'eletricidade') stats.energia.electricity += qty;
        else if (energyType === 'gas') stats.energia.gas += qty;
        else if (energyType === 'dual') { stats.energia.dual += qty; stats.energia.electricity += qty; stats.energia.gas += qty; }
      } else if (scope === 'solar') {
        stats.solar.count += qty;
      } else if (scope === 'mobilidade_eletrica') {
        stats.mobilidade_eletrica.count += qty;
      }

      stats.by_status[status] = (stats.by_status[status] || 0) + 1;

      if (sale.has_direct_debit) stats.dd_count++;
      if (sale.has_electronic_invoice) stats.fe_count++;
    });
  }

  stats.by_scope = buildByScope(sales, scopesMetaMap);
  return stats;
}

async function getManagerLevel1Dashboard(managerId, year, month) {
  const { start, end } = getMonthRange(year, month);

  const [salesResult, ownSalesResult, managerUserResult, objectivesResult, last12Months, allCommissionConfigs, scopesMeta] = await Promise.all([
    supabase
      .from('sales')
      .select('*')
      .or(`created_by_user_id.eq.${managerId},partner_id.in.(SELECT id FROM partners WHERE manager_id = '${managerId}')`)
      .gte('date', start.split('T')[0])
      .lt('date', end.split('T')[0])
      .neq('status', 'Em proposta'),
    supabase
      .from('sales')
      .select('*')
      .eq('created_by_user_id', managerId)
      .gte('date', start.split('T')[0])
      .lt('date', end.split('T')[0])
      .neq('status', 'Em proposta'),
    supabase
      .from('users')
      .select('commission_type')
      .eq('id', managerId)
      .single(),
    supabase
      .from('manager_objectives')
      .select(`
        *,
        operator:operators(id, name, scope)
      `)
      .eq('manager_id', managerId)
      .eq('year', year)
      .eq('month', month),
    getLast12MonthsData(),
    supabase
      .from('commission_configurations')
      .select('*'),
    fetchScopesMeta()
  ]);

  const sales = salesResult.data;
  const ownSales = ownSalesResult.data;
  const managerUser = managerUserResult.data;
  const objectives = objectivesResult.data;

  const configMap = {};
  if (allCommissionConfigs.data) {
    allCommissionConfigs.data.forEach(config => {
      const key = `${config.operator_id}_${config.partner_type}_${config.client_type}_${config.service_type}`;
      if (!configMap[key]) {
        configMap[key] = [];
      }
      configMap[key].push(config);
    });
  }

  let ownCommissionGross = 0;
  let ownRetention = 0;

  if (ownSales && ownSales.length > 0 && managerUser?.commission_type) {
    const commissionType = managerUser.commission_type;

    for (const sale of ownSales) {
      const clientType = sale.client_type === 'empresarial' ? 'empresarial' : 'particular';
      const key = `${sale.operator_id}_${commissionType}_${clientType}_${sale.service_type}`;
      const configs = configMap[key] || [];

      if (configs.length > 0) {
        const relevantConfigs = configs.filter(c => {
          if (sale.scope === 'telecomunicacoes') {
            return c.service_type === sale.service_type ||
                   (c.service_types && c.service_types.includes(sale.service_type));
          } else if (sale.scope === 'energia') {
            if (sale.energy_sale_type === 'dual') {
              return c.service_type === 'eletricidade' || c.service_type === 'gas';
            } else {
              return c.service_type === sale.energy_sale_type;
            }
          }
          return false;
        });

        for (const config of relevantConfigs) {
          if (config.commission_mode === 'fixed_value') {
            ownCommissionGross += parseFloat(config.commission_value || 0);
          } else if (config.commission_mode === 'monthly_multiplier' && sale.monthly_value) {
            ownCommissionGross += parseFloat(sale.monthly_value) * parseFloat(config.commission_value || 0);
          }

          if (config.has_retention) {
            const retValue = (parseFloat(config.commission_value || 0) * parseFloat(config.retention_percentage || 0)) / 100;
            ownRetention += retValue;
          }
        }
      }
    }
  }

  const objectivesProgress = (objectives || []).map(obj => {
    const operatorSales = (sales || []).filter(s => s.operator_id === obj.operator_id);

    const electricityCount = operatorSales.filter(
      s => s.scope === 'energia' && (s.energy_sale_type === 'eletricidade' || s.energy_sale_type === 'dual')
    ).length;

    const gasCount = operatorSales.filter(
      s => s.scope === 'energia' && (s.energy_sale_type === 'gas' || s.energy_sale_type === 'dual')
    ).length;

    const tvCount = operatorSales.filter(
      s => s.scope === 'telecomunicacoes' && s.has_tv
    ).length;

    const fiberCount = operatorSales.filter(
      s => s.scope === 'telecomunicacoes' && (s.has_net || s.has_lr)
    ).length;

    return {
      operator_name: obj.operator?.name,
      operator_scope: obj.operator?.scope,
      targets: {
        electricity: obj.electricity_target,
        gas: obj.gas_target,
        tv: obj.tv_target,
        fiber: obj.fiber_target,
      },
      actual: {
        electricity: electricityCount,
        gas: gasCount,
        tv: tvCount,
        fiber: fiberCount,
      },
      percentage: {
        electricity: obj.electricity_target > 0 ? (electricityCount / obj.electricity_target) * 100 : 0,
        gas: obj.gas_target > 0 ? (gasCount / obj.gas_target) * 100 : 0,
        tv: obj.tv_target > 0 ? (tvCount / obj.tv_target) * 100 : 0,
        fiber: obj.fiber_target > 0 ? (fiberCount / obj.fiber_target) * 100 : 0,
      },
    };
  });

  const scopesMetaMap = {};
  scopesMeta.forEach(s => { scopesMetaMap[s.slug] = s; });

  const stats = {
    total_sales: 0,
    telecomunicacoes: { count: 0, monthly_total: 0 },
    energia: { count: 0, electricity: 0, gas: 0, dual: 0 },
    solar: { count: 0 },
    mobilidade_eletrica: { count: 0 },
    by_scope: {},
    scopes_meta: scopesMeta,
    own_commission_gross: ownCommissionGross,
    own_retention: ownRetention,
    objectives_progress: objectivesProgress,
    selected_month: month,
    selected_year: year,
    last_12_months: last12Months,
    dd_count: 0,
    fe_count: 0
  };

  if (sales) {
    sales.forEach(sale => {
      const scope = sale.scope || '';
      const qty = getSaleQuantity(sale, scopesMetaMap);

      stats.total_sales += qty;

      if (scope === 'telecomunicacoes') {
        stats.telecomunicacoes.count += qty;
        stats.telecomunicacoes.monthly_total += sale.monthly_value || 0;
      } else if (scope === 'energia') {
        stats.energia.count += qty;

        const energyType = sale.energy_sale_type || 'eletricidade';
        if (energyType === 'eletricidade') {
          stats.energia.electricity += qty;
        } else if (energyType === 'gas') {
          stats.energia.gas += qty;
        } else if (energyType === 'dual') {
          stats.energia.dual += qty;
          stats.energia.electricity += qty;
          stats.energia.gas += qty;
        }
      } else if (scope === 'solar') {
        stats.solar.count += qty;
      } else if (scope === 'mobilidade_eletrica') {
        stats.mobilidade_eletrica.count += qty;
      }

      if (sale.has_direct_debit) stats.dd_count++;
      if (sale.has_electronic_invoice) stats.fe_count++;
    });
  }

  stats.by_scope = buildByScope(sales, scopesMetaMap);
  return stats;
}

async function getAdminProposalStats(adminId, isCommissioned, adminPartnerId = null) {
  const [proposalsResult, adminUserResult] = await Promise.all([
    supabase
      .from('sales')
      .select('*, partners(name)')
      .eq('status', 'Em proposta'),
    supabase
      .from('users')
      .select('name')
      .eq('id', adminId)
      .maybeSingle()
  ]);

  const proposals = proposalsResult.data;
  const adminUser = adminUserResult.data;
  const adminName = adminUser?.name ? `${adminUser.name} (Admin)` : 'Admin Comissionado';
  const now = new Date();
  const stats = {
    total_proposals: proposals?.length || 0,
    total_commission: 0,
    own_commission: 0,
    by_age: {
      up_to_7: 0,
      from_7_to_14: 0,
      over_14: 0
    },
    by_scope: {
      telecomunicacoes: 0,
      energia: 0,
      solar: 0,
      mobilidade_eletrica: 0
    },
    by_partner: {}
  };

  if (proposals) {
    for (const proposal of proposals) {
      const createdDate = new Date(proposal.created_at);
      const daysElapsed = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
      const commission = parseFloat(proposal.manual_commission || proposal.calculated_commission || 0);

      stats.total_commission += commission;

      if (daysElapsed <= 7) {
        stats.by_age.up_to_7++;
      } else if (daysElapsed <= 14) {
        stats.by_age.from_7_to_14++;
      } else {
        stats.by_age.over_14++;
      }

      stats.by_scope[proposal.scope] = (stats.by_scope[proposal.scope] || 0) + 1;

      const partnerKey = proposal.partner_id || 'admin_commissioned';
      const partnerNameDisplay = proposal.partner_id
        ? (proposal.partners?.name || 'Desconhecido')
        : adminName;

      if (!stats.by_partner[partnerKey]) {
        stats.by_partner[partnerKey] = {
          name: partnerNameDisplay,
          count: 0,
          commission: 0
        };
      }
      stats.by_partner[partnerKey].count++;
      stats.by_partner[partnerKey].commission += commission;

      const isAdminOwnProposal = isCommissioned && (
        (adminPartnerId && proposal.partner_id === adminPartnerId) ||
        (!adminPartnerId && proposal.created_by_user_id === adminId && !proposal.partner_id)
      );

      if (isAdminOwnProposal) {
        stats.own_commission += commission;
      }
    }
  }

  return stats;
}

async function getBOProposalStats() {
  const { data: proposals } = await supabase
    .from('sales')
    .select('*, partners(name)')
    .eq('status', 'Em proposta');

  const now = new Date();
  const stats = {
    total_proposals: proposals?.length || 0,
    by_age: {
      up_to_7: 0,
      from_7_to_14: 0,
      over_14: 0
    },
    by_scope: {
      telecomunicacoes: 0,
      energia: 0,
      solar: 0,
      mobilidade_eletrica: 0
    },
    by_partner: {}
  };

  if (proposals) {
    proposals.forEach(proposal => {
      const createdDate = new Date(proposal.created_at);
      const daysElapsed = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));

      if (daysElapsed <= 7) {
        stats.by_age.up_to_7++;
      } else if (daysElapsed <= 14) {
        stats.by_age.from_7_to_14++;
      } else {
        stats.by_age.over_14++;
      }

      stats.by_scope[proposal.scope] = (stats.by_scope[proposal.scope] || 0) + 1;

      const partnerKey = proposal.partner_id || 'admin';
      const partnerName = proposal.partners?.name || 'Admin';

      if (!stats.by_partner[partnerKey]) {
        stats.by_partner[partnerKey] = {
          name: partnerName,
          count: 0
        };
      }
      stats.by_partner[partnerKey].count++;
    });
  }

  return stats;
}

async function getPartnerProposalStats(partnerId) {
  const { data: proposals } = await supabase
    .from('sales')
    .select('*')
    .eq('partner_id', partnerId)
    .eq('status', 'Em proposta');

  const now = new Date();
  const stats = {
    total_proposals: proposals?.length || 0,
    total_commission: 0,
    by_age: {
      up_to_7: 0,
      from_7_to_14: 0,
      over_14: 0
    },
    by_scope: {
      telecomunicacoes: 0,
      energia: 0,
      solar: 0,
      dual: 0
    }
  };

  if (proposals) {
    proposals.forEach(proposal => {
      const createdDate = new Date(proposal.created_at);
      const daysElapsed = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
      const commission = parseFloat(proposal.manual_commission || proposal.calculated_commission || 0);

      stats.total_commission += commission;

      if (daysElapsed <= 7) {
        stats.by_age.up_to_7++;
      } else if (daysElapsed <= 14) {
        stats.by_age.from_7_to_14++;
      } else {
        stats.by_age.over_14++;
      }

      stats.by_scope[proposal.scope] = (stats.by_scope[proposal.scope] || 0) + 1;
    });
  }

  return stats;
}

async function getManagerProposalStats(managerId) {
  const { data: proposals } = await supabase
    .from('sales')
    .select('*, partners(name)')
    .eq('status', 'Em proposta')
    .or(`created_by_user_id.eq.${managerId},partner_id.in.(SELECT id FROM partners WHERE manager_id = '${managerId}')`);

  const now = new Date();
  const stats = {
    total_proposals: proposals?.length || 0,
    total_commission: 0,
    own_commission: 0,
    by_age: {
      up_to_7: 0,
      from_7_to_14: 0,
      over_14: 0
    },
    by_scope: {
      telecomunicacoes: 0,
      energia: 0,
      solar: 0,
      mobilidade_eletrica: 0
    },
    by_partner: {}
  };

  if (proposals) {
    for (const proposal of proposals) {
      const createdDate = new Date(proposal.created_at);
      const daysElapsed = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
      const commission = parseFloat(proposal.manual_commission || proposal.calculated_commission || 0);

      stats.total_commission += commission;

      if (daysElapsed <= 7) {
        stats.by_age.up_to_7++;
      } else if (daysElapsed <= 14) {
        stats.by_age.from_7_to_14++;
      } else {
        stats.by_age.over_14++;
      }

      stats.by_scope[proposal.scope] = (stats.by_scope[proposal.scope] || 0) + 1;

      const partnerKey = proposal.partner_id || 'own';
      const partnerName = proposal.partners?.name || 'Vendas Próprias';

      if (!stats.by_partner[partnerKey]) {
        stats.by_partner[partnerKey] = {
          name: partnerName,
          count: 0,
          commission: 0
        };
      }
      stats.by_partner[partnerKey].count++;
      stats.by_partner[partnerKey].commission += commission;

      if (proposal.created_by_user_id === managerId) {
        stats.own_commission += commission;
      }
    }
  }

  return stats;
}
