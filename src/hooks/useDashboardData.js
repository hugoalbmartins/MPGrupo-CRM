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

export const usePartnerStats = (user) => {
  return useQuery({
    queryKey: ['partnerStats'],
    queryFn: async () => {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      const startDate = new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];

      const [salesResult, partnersResult, operatorsResult] = await Promise.all([
        supabase
          .from('sales')
          .select('*, partners(name), operators(name)')
          .gte('date', startDate)
          .lt('date', endDate)
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
        .filter(p => p.total > 0)
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
