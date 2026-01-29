import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { operatorsService } from '../services/operatorsService';
import { toast } from 'sonner';

export const useOperators = (includeHidden = false) => {
  return useQuery({
    queryKey: ['operators', includeHidden],
    queryFn: () => operatorsService.getOperators(includeHidden),
    staleTime: 5 * 60 * 1000,
  });
};

export const useOperator = (operatorId) => {
  return useQuery({
    queryKey: ['operator', operatorId],
    queryFn: () => operatorsService.getOperator(operatorId),
    enabled: !!operatorId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useCreateOperator = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (operatorData) => operatorsService.createOperator(operatorData),
    onMutate: async (newOperator) => {
      await queryClient.cancelQueries({ queryKey: ['operators'] });
      const previousOperators = queryClient.getQueryData(['operators']);

      queryClient.setQueryData(['operators'], (old) => {
        if (!old) return [{ ...newOperator, id: 'temp-' + Date.now() }];
        return [...old, { ...newOperator, id: 'temp-' + Date.now() }];
      });

      return { previousOperators };
    },
    onError: (err, newOperator, context) => {
      queryClient.setQueryData(['operators'], context.previousOperators);
      toast.error('Erro ao criar operadora');
    },
    onSuccess: () => {
      toast.success('Operadora criada com sucesso');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['operators'] });
    },
  });
};

export const useUpdateOperator = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ operatorId, updates }) => operatorsService.updateOperator(operatorId, updates),
    onMutate: async ({ operatorId, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['operator', operatorId] });
      const previousOperator = queryClient.getQueryData(['operator', operatorId]);

      queryClient.setQueryData(['operator', operatorId], (old) => ({
        ...old,
        ...updates,
      }));

      return { previousOperator };
    },
    onError: (err, { operatorId }, context) => {
      queryClient.setQueryData(['operator', operatorId], context.previousOperator);
      toast.error('Erro ao atualizar operadora');
    },
    onSuccess: () => {
      toast.success('Operadora atualizada com sucesso');
    },
    onSettled: (data, error, { operatorId }) => {
      queryClient.invalidateQueries({ queryKey: ['operator', operatorId] });
      queryClient.invalidateQueries({ queryKey: ['operators'] });
    },
  });
};

export const useDeleteOperator = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (operatorId) => operatorsService.deleteOperator(operatorId),
    onMutate: async (operatorId) => {
      await queryClient.cancelQueries({ queryKey: ['operators'] });
      const previousOperators = queryClient.getQueryData(['operators']);

      queryClient.setQueryData(['operators'], (old) =>
        old?.filter((operator) => operator.id !== operatorId)
      );

      return { previousOperators };
    },
    onError: (err, operatorId, context) => {
      queryClient.setQueryData(['operators'], context.previousOperators);
      toast.error('Erro ao eliminar operadora');
    },
    onSuccess: () => {
      toast.success('Operadora eliminada com sucesso');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['operators'] });
    },
  });
};
