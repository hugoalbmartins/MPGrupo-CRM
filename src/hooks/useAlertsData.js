import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alertsService } from '../services/alertsService';
import { toast } from 'sonner';

export const useAlerts = (filters = {}) => {
  return useQuery({
    queryKey: ['alerts', filters],
    queryFn: () => alertsService.getAlerts(filters),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
};

export const useArchivedAlerts = () => {
  return useQuery({
    queryKey: ['alerts', 'archived'],
    queryFn: () => alertsService.getArchivedAlerts(),
    staleTime: 5 * 60 * 1000,
  });
};

export const useAlert = (alertId) => {
  return useQuery({
    queryKey: ['alert', alertId],
    queryFn: () => alertsService.getAlert(alertId),
    enabled: !!alertId,
    staleTime: 2 * 60 * 1000,
  });
};

export const useMarkAlertAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (alertId) => alertsService.markAsRead(alertId),
    onMutate: async (alertId) => {
      await queryClient.cancelQueries({ queryKey: ['alerts'] });
      const previousAlerts = queryClient.getQueryData(['alerts']);

      queryClient.setQueryData(['alerts'], (old) => {
        if (!old) return old;
        return old.map(alert =>
          alert.id === alertId ? { ...alert, is_read: true } : alert
        );
      });

      return { previousAlerts };
    },
    onError: (err, alertId, context) => {
      queryClient.setQueryData(['alerts'], context.previousAlerts);
      toast.error('Erro ao marcar alerta como lido');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
};

export const useArchiveAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (alertId) => alertsService.archiveAlert(alertId),
    onMutate: async (alertId) => {
      await queryClient.cancelQueries({ queryKey: ['alerts'] });
      const previousAlerts = queryClient.getQueryData(['alerts']);

      queryClient.setQueryData(['alerts'], (old) =>
        old?.filter((alert) => alert.id !== alertId)
      );

      return { previousAlerts };
    },
    onError: (err, alertId, context) => {
      queryClient.setQueryData(['alerts'], context.previousAlerts);
      toast.error('Erro ao arquivar alerta');
    },
    onSuccess: () => {
      toast.success('Alerta arquivado com sucesso');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alerts', 'archived'] });
    },
  });
};

export const useUnarchiveAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (alertId) => alertsService.unarchiveAlert(alertId),
    onMutate: async (alertId) => {
      await queryClient.cancelQueries({ queryKey: ['alerts', 'archived'] });
      const previousArchivedAlerts = queryClient.getQueryData(['alerts', 'archived']);

      queryClient.setQueryData(['alerts', 'archived'], (old) =>
        old?.filter((alert) => alert.id !== alertId)
      );

      return { previousArchivedAlerts };
    },
    onError: (err, alertId, context) => {
      queryClient.setQueryData(['alerts', 'archived'], context.previousArchivedAlerts);
      toast.error('Erro ao desarquivar alerta');
    },
    onSuccess: () => {
      toast.success('Alerta desarquivado com sucesso');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alerts', 'archived'] });
    },
  });
};

export const useDeleteAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (alertId) => alertsService.deleteAlert(alertId),
    onMutate: async (alertId) => {
      await queryClient.cancelQueries({ queryKey: ['alerts'] });
      const previousAlerts = queryClient.getQueryData(['alerts']);

      queryClient.setQueryData(['alerts'], (old) =>
        old?.filter((alert) => alert.id !== alertId)
      );

      return { previousAlerts };
    },
    onError: (err, alertId, context) => {
      queryClient.setQueryData(['alerts'], context.previousAlerts);
      toast.error('Erro ao eliminar alerta');
    },
    onSuccess: () => {
      toast.success('Alerta eliminado com sucesso');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
};
