import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { partnersService } from '../services/partnersService';
import { toast } from 'sonner';

export const usePartners = () => {
  return useQuery({
    queryKey: ['partners'],
    queryFn: () => partnersService.getPartners(),
    staleTime: 5 * 60 * 1000,
  });
};

export const usePartner = (partnerId) => {
  return useQuery({
    queryKey: ['partner', partnerId],
    queryFn: () => partnersService.getPartner(partnerId),
    enabled: !!partnerId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useCreatePartner = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (partnerData) => partnersService.createPartner(partnerData),
    onMutate: async (newPartner) => {
      await queryClient.cancelQueries({ queryKey: ['partners'] });
      const previousPartners = queryClient.getQueryData(['partners']);

      queryClient.setQueryData(['partners'], (old) => {
        if (!old) return [{ ...newPartner, id: 'temp-' + Date.now() }];
        return [...old, { ...newPartner, id: 'temp-' + Date.now() }];
      });

      return { previousPartners };
    },
    onError: (err, newPartner, context) => {
      queryClient.setQueryData(['partners'], context.previousPartners);
      toast.error('Erro ao criar parceiro');
    },
    onSuccess: () => {
      toast.success('Parceiro criado com sucesso');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
    },
  });
};

export const useUpdatePartner = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ partnerId, updates }) => partnersService.updatePartner(partnerId, updates),
    onMutate: async ({ partnerId, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['partner', partnerId] });
      const previousPartner = queryClient.getQueryData(['partner', partnerId]);

      queryClient.setQueryData(['partner', partnerId], (old) => ({
        ...old,
        ...updates,
      }));

      return { previousPartner };
    },
    onError: (err, { partnerId }, context) => {
      queryClient.setQueryData(['partner', partnerId], context.previousPartner);
      toast.error('Erro ao atualizar parceiro');
    },
    onSuccess: () => {
      toast.success('Parceiro atualizado com sucesso');
    },
    onSettled: (data, error, { partnerId }) => {
      queryClient.invalidateQueries({ queryKey: ['partner', partnerId] });
      queryClient.invalidateQueries({ queryKey: ['partners'] });
    },
  });
};

export const useDeletePartner = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (partnerId) => partnersService.deletePartner(partnerId),
    onMutate: async (partnerId) => {
      await queryClient.cancelQueries({ queryKey: ['partners'] });
      const previousPartners = queryClient.getQueryData(['partners']);

      queryClient.setQueryData(['partners'], (old) =>
        old?.filter((partner) => partner.id !== partnerId)
      );

      return { previousPartners };
    },
    onError: (err, partnerId, context) => {
      queryClient.setQueryData(['partners'], context.previousPartners);
      toast.error('Erro ao eliminar parceiro');
    },
    onSuccess: () => {
      toast.success('Parceiro eliminado com sucesso');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
    },
  });
};
