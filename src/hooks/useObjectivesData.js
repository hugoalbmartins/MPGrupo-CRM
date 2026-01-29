import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { objectivesService } from '../services/objectivesService';
import { toast } from 'sonner';

export const useObjectives = (filters = {}) => {
  return useQuery({
    queryKey: ['objectives', filters],
    queryFn: () => objectivesService.getObjectives(filters),
    staleTime: 5 * 60 * 1000,
  });
};

export const useObjective = (objectiveId) => {
  return useQuery({
    queryKey: ['objective', objectiveId],
    queryFn: () => objectivesService.getObjective(objectiveId),
    enabled: !!objectiveId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useCreateObjective = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (objectiveData) => objectivesService.createObjective(objectiveData),
    onMutate: async (newObjective) => {
      await queryClient.cancelQueries({ queryKey: ['objectives'] });
      const previousObjectives = queryClient.getQueryData(['objectives']);

      queryClient.setQueryData(['objectives'], (old) => {
        if (!old) return [{ ...newObjective, id: 'temp-' + Date.now() }];
        return [...old, { ...newObjective, id: 'temp-' + Date.now() }];
      });

      return { previousObjectives };
    },
    onError: (err, newObjective, context) => {
      queryClient.setQueryData(['objectives'], context.previousObjectives);
      toast.error('Erro ao criar objetivo');
    },
    onSuccess: () => {
      toast.success('Objetivo criado com sucesso');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
    },
  });
};

export const useUpdateObjective = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ objectiveId, updates }) => objectivesService.updateObjective(objectiveId, updates),
    onMutate: async ({ objectiveId, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['objective', objectiveId] });
      const previousObjective = queryClient.getQueryData(['objective', objectiveId]);

      queryClient.setQueryData(['objective', objectiveId], (old) => ({
        ...old,
        ...updates,
      }));

      return { previousObjective };
    },
    onError: (err, { objectiveId }, context) => {
      queryClient.setQueryData(['objective', objectiveId], context.previousObjective);
      toast.error('Erro ao atualizar objetivo');
    },
    onSuccess: () => {
      toast.success('Objetivo atualizado com sucesso');
    },
    onSettled: (data, error, { objectiveId }) => {
      queryClient.invalidateQueries({ queryKey: ['objective', objectiveId] });
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
    },
  });
};

export const useDeleteObjective = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (objectiveId) => objectivesService.deleteObjective(objectiveId),
    onMutate: async (objectiveId) => {
      await queryClient.cancelQueries({ queryKey: ['objectives'] });
      const previousObjectives = queryClient.getQueryData(['objectives']);

      queryClient.setQueryData(['objectives'], (old) =>
        old?.filter((objective) => objective.id !== objectiveId)
      );

      return { previousObjectives };
    },
    onError: (err, objectiveId, context) => {
      queryClient.setQueryData(['objectives'], context.previousObjectives);
      toast.error('Erro ao eliminar objetivo');
    },
    onSuccess: () => {
      toast.success('Objetivo eliminado com sucesso');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
    },
  });
};
