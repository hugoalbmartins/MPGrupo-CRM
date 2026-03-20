import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboardService';
import { supabase } from '../lib/supabase';

export const useDashboardStats = (year, month) => {
  return useQuery({
    queryKey: ['dashboardStats', year, month],
    queryFn: () => dashboardService.getStats(year, month),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const useProposalStats = () => {
  return useQuery({
    queryKey: ['proposalStats'],
    queryFn: () => dashboardService.getProposalStats(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

const getWeekRange = (weekKey) => {
  if (!weekKey) {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return {
      start: monday.toISOString().split('T')[0],
      end: sunday.toISOString().split('T')[0],
    };
  }
  const [year, week] = weekKey.split('-W').map(Number);
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const firstMonday = new Date(jan4);
  firstMonday.setDate(jan4.getDate() - dayOfWeek + 1);
  const monday = new Date(firstMonday);
  monday.setDate(firstMonday.getDate() + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  };
};

export const getAvailableWeeks = () => {
  const weeks = [];
  const now = new Date();
  for (let i = 0; i < 52; i++) {
    const date = new Date(now);
    date.setDate(now.getDate() - i * 7);
    const day = date.getDay();
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    const monday = new Date(date);
    monday.setDate(date.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const year = monday.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (monday - startOfYear) / 86400000;
    const weekNum = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);

    const key = `${year}-W${String(weekNum).padStart(2, '0')}`;
    const label = `${monday.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })} - ${sunday.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;

    if (!weeks.find(w => w.key === key)) {
      weeks.push({ key, label, monday, sunday });
    }
  }
  return weeks;
};

export const getAvailableMonths = () => {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      label: date.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }),
    });
  }
  return months;
};

const getDayRange = (dayKey) => {
  const date = dayKey ? new Date(dayKey) : new Date();
  const start = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return { start, end: start };
};

export const getAvailableDays = () => {
  const days = [];
  const now = new Date();
  for (let i = 0; i < 90; i++) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    days.push({
      key,
      label: date.toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }),
    });
  }
  return days;
};

export const usePartnerStats = (user, filterMode = 'mensal', filterKey = null) => {
  return useQuery({
    queryKey: ['partnerStats', filterMode, filterKey],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let startDate, endDate;

      if (filterMode === 'week') {
        const range = getWeekRange(filterKey);
        startDate = range.start;
        endDate = range.end;
      } else if (filterMode === 'day') {
        const range = getDayRange(filterKey);
        startDate = range.start;
        endDate = range.end;
      } else if (filterMode === 'mensal' && filterKey) {
        const [year, month] = filterKey.split('-').map(Number);
        startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
        endDate = new Date(year, month, 0).toISOString().split('T')[0];
      } else {
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      }

      const [salesResult, partnersResult] = await Promise.all([
        supabase
          .from('sales')
          .select('*, partners(name), operators(name, id)')
          .gte('date', startDate)
          .lte('date', endDate)
          .neq('status', 'Em proposta'),
        supabase.from('partners').select('id, name'),
      ]);

      const currentSales = salesResult.data || [];
      const partners = partnersResult.data || [];

      const partnerMap = {};
      const operatorSet = {};

      currentSales.forEach(sale => {
        const partnerId = sale.partner_id || 'admin_commissioned';

        if (!partnerMap[partnerId]) {
          let partnerName = 'Desconhecido';
          if (partnerId === 'admin_commissioned') {
            partnerName = user?.name ? `${user.name} (Admin)` : 'Admin Comissionado';
          } else {
            const partner = sale.partners || partners.find(p => p.id === partnerId);
            partnerName = partner?.name || 'Desconhecido';
          }
          partnerMap[partnerId] = { name: partnerName, operators: {}, total: 0 };
        }

        const commission = parseFloat(sale.manual_commission || sale.calculated_commission || 0);
        const operatorName = sale.operators?.name || 'Desconhecido';
        const operatorId = sale.operators?.id || sale.operator_id;

        if (operatorId && operatorName !== 'Desconhecido') {
          operatorSet[operatorId] = operatorName;
        }

        if (!partnerMap[partnerId].operators[operatorName]) {
          partnerMap[partnerId].operators[operatorName] = 0;
        }
        partnerMap[partnerId].operators[operatorName]++;
        partnerMap[partnerId].total += commission;
      });

      const sortedStats = Object.values(partnerMap)
        .filter(p => p.total > 0 || Object.values(p.operators).some(v => v > 0))
        .sort((a, b) => b.total - a.total);

      const activeOperators = Object.entries(operatorSet).map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return { stats: sortedStats, operators: activeOperators };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const useProposals = (filterType) => {
  return useQuery({
    queryKey: ['proposals', filterType],
    queryFn: async () => {
      const { data: proposals } = await supabase
        .from('sales')
        .select('*, partners(name), operators(name)')
        .eq('status', 'Em proposta')
        .order('created_at', { ascending: false });

      if (!proposals) {
        return [];
      }

      const now = new Date();
      let filtered = [];

      if (filterType === 'all') {
        filtered = proposals;
      } else if (filterType === 'up_to_7') {
        filtered = proposals.filter(p => {
          const daysElapsed = Math.floor((now - new Date(p.created_at)) / (1000 * 60 * 60 * 24));
          return daysElapsed <= 7;
        });
      } else if (filterType === 'from_7_to_14') {
        filtered = proposals.filter(p => {
          const daysElapsed = Math.floor((now - new Date(p.created_at)) / (1000 * 60 * 60 * 24));
          return daysElapsed > 7 && daysElapsed <= 14;
        });
      } else if (filterType === 'over_14') {
        filtered = proposals.filter(p => {
          const daysElapsed = Math.floor((now - new Date(p.created_at)) / (1000 * 60 * 60 * 24));
          return daysElapsed > 14;
        });
      }

      return filtered;
    },
    enabled: !!filterType,
    staleTime: 3 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};
