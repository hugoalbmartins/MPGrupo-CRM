import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salesService } from '../services/salesService';
import { toast } from 'sonner';

export const useSales = (filters) => {
  return useQuery({
    queryKey: ['sales', filters],
    queryFn: () => salesService.getSales(filters),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const useSale = (saleId) => {
  return useQuery({
    queryKey: ['sale', saleId],
    queryFn: () => salesService.getSale(saleId),
    enabled: !!saleId,
    staleTime: 1 * 60 * 1000,
  });
};

export const useCreateSale = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (saleData) => salesService.createSale(saleData),
    onMutate: async (newSale) => {
      await queryClient.cancelQueries({ queryKey: ['sales'] });
      const previousSales = queryClient.getQueryData(['sales']);

      queryClient.setQueryData(['sales'], (old) => {
        if (!old) return [{ ...newSale, id: 'temp-' + Date.now() }];
        return [{ ...newSale, id: 'temp-' + Date.now() }, ...old];
      });

      return { previousSales };
    },
    onError: (err, newSale, context) => {
      queryClient.setQueryData(['sales'], context.previousSales);
      toast.error('Erro ao criar venda');
    },
    onSuccess: () => {
      toast.success('Venda criada com sucesso');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    },
  });
};

export const useUpdateSale = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ saleId, updates }) => salesService.updateSale(saleId, updates),
    onMutate: async ({ saleId, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['sale', saleId] });
      const previousSale = queryClient.getQueryData(['sale', saleId]);

      queryClient.setQueryData(['sale', saleId], (old) => ({
        ...old,
        ...updates,
      }));

      return { previousSale };
    },
    onError: (err, { saleId }, context) => {
      queryClient.setQueryData(['sale', saleId], context.previousSale);
      toast.error('Erro ao atualizar venda');
    },
    onSuccess: () => {
      toast.success('Venda atualizada com sucesso');
    },
    onSettled: (data, error, { saleId }) => {
      queryClient.invalidateQueries({ queryKey: ['sale', saleId] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    },
  });
};

export const useDeleteSale = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (saleId) => salesService.deleteSale(saleId),
    onMutate: async (saleId) => {
      await queryClient.cancelQueries({ queryKey: ['sales'] });
      const previousSales = queryClient.getQueryData(['sales']);

      queryClient.setQueryData(['sales'], (old) =>
        old?.filter((sale) => sale.id !== saleId)
      );

      return { previousSales };
    },
    onError: (err, saleId, context) => {
      queryClient.setQueryData(['sales'], context.previousSales);
      toast.error('Erro ao eliminar venda');
    },
    onSuccess: () => {
      toast.success('Venda eliminada com sucesso');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    },
  });
};
