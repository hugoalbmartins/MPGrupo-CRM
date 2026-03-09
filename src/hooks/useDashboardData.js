import { useQuery } from '@tanstack/react-query';
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

export const usePartnerStats = (user, filterMode = 'month', weekKey = null) => {
  return useQuery({
    queryKey: ['partnerStats', filterMode, weekKey],
    queryFn: async () => {
      let startDate, endDate;

      if (filterMode === 'week') {
        const range = getWeekRange(weekKey);
        startDate = range.start;
        endDate = range.end;
      } else {
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        startDate = new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0];
        endDate = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
      }

      const [salesResult, partnersResult, operatorsResult] = await Promise.all([
        supabase
          .from('sales')
          .select('*, partners(name), operators(name)')
          .gte('date', startDate)
          .lte('date', endDate)
          .neq('status', 'Em proposta'),
        supabase.from('partners').select('id, name'),
        supabase.from('operators').select('id, name').eq('hidden', false)
      ]);

      const currentMonthSales = salesResult.data || [];
      const partners = partnersResult.data || [];
      const allOperators = operatorsResult.data || [];

      const partnerMap = {};

      currentMonthSales.forEach(sale => {
        const partnerId = sale.partner_id || 'admin_commissioned';

        if (!partnerMap[partnerId]) {
          let partnerName = 'Desconhecido';

          if (partnerId === 'admin_commissioned') {
            partnerName = user?.name ? `${user.name} (Admin)` : 'Admin Comissionado';
          } else {
            const partner = sale.partners || partners.find(p => p.id === partnerId);
            partnerName = partner?.name || 'Desconhecido';
          }

          partnerMap[partnerId] = {
            name: partnerName,
            operators: {},
            total: 0
          };
        }

        const commission = parseFloat(sale.manual_commission || sale.calculated_commission || 0);
        const operatorName = sale.operators?.name || 'Desconhecido';

        if (!partnerMap[partnerId].operators[operatorName]) {
          partnerMap[partnerId].operators[operatorName] = 0;
        }

        partnerMap[partnerId].operators[operatorName]++;
        partnerMap[partnerId].total += commission;
      });

      const sortedStats = Object.values(partnerMap)
        .filter(p => p.total > 0 || Object.values(p.operators).some(v => v > 0))
        .sort((a, b) => b.total - a.total);

      return { stats: sortedStats, operators: allOperators };
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
