import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commissionReportsService } from '../services/commissionReportsService';
import { toast } from 'sonner';

export const useCommissionReports = (filters = {}) => {
  return useQuery({
    queryKey: ['commissionReports', filters],
    queryFn: () => commissionReportsService.getReports(filters),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
};

export const useCommissionReport = (reportId) => {
  return useQuery({
    queryKey: ['commissionReport', reportId],
    queryFn: () => commissionReportsService.getReport(reportId),
    enabled: !!reportId,
    staleTime: 2 * 60 * 1000,
  });
};

export const useGenerateCommissionReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reportData) => commissionReportsService.generateReport(reportData),
    onSuccess: () => {
      toast.success('Relatório gerado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['commissionReports'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao gerar relatório');
    },
  });
};

export const useValidateCommissionReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reportId, validationData }) =>
      commissionReportsService.validateReport(reportId, validationData),
    onMutate: async ({ reportId, validationData }) => {
      await queryClient.cancelQueries({ queryKey: ['commissionReport', reportId] });
      const previousReport = queryClient.getQueryData(['commissionReport', reportId]);

      queryClient.setQueryData(['commissionReport', reportId], (old) => ({
        ...old,
        validation_status: validationData.status,
        validated_by: validationData.userId,
        validated_at: new Date().toISOString(),
      }));

      return { previousReport };
    },
    onError: (err, { reportId }, context) => {
      queryClient.setQueryData(['commissionReport', reportId], context.previousReport);
      toast.error('Erro ao validar relatório');
    },
    onSuccess: () => {
      toast.success('Relatório validado com sucesso');
    },
    onSettled: (data, error, { reportId }) => {
      queryClient.invalidateQueries({ queryKey: ['commissionReport', reportId] });
      queryClient.invalidateQueries({ queryKey: ['commissionReports'] });
    },
  });
};

export const useMarkReportAsPaid = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reportId, paymentData }) =>
      commissionReportsService.markAsPaid(reportId, paymentData),
    onMutate: async ({ reportId, paymentData }) => {
      await queryClient.cancelQueries({ queryKey: ['commissionReport', reportId] });
      const previousReport = queryClient.getQueryData(['commissionReport', reportId]);

      queryClient.setQueryData(['commissionReport', reportId], (old) => ({
        ...old,
        payment_status: 'Pago',
        payment_date: paymentData.paymentDate,
        payment_proof_url: paymentData.proofUrl,
      }));

      return { previousReport };
    },
    onError: (err, { reportId }, context) => {
      queryClient.setQueryData(['commissionReport', reportId], context.previousReport);
      toast.error('Erro ao marcar relatório como pago');
    },
    onSuccess: () => {
      toast.success('Relatório marcado como pago');
    },
    onSettled: (data, error, { reportId }) => {
      queryClient.invalidateQueries({ queryKey: ['commissionReport', reportId] });
      queryClient.invalidateQueries({ queryKey: ['commissionReports'] });
    },
  });
};

export const useDeleteCommissionReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reportId) => commissionReportsService.deleteReport(reportId),
    onMutate: async (reportId) => {
      await queryClient.cancelQueries({ queryKey: ['commissionReports'] });
      const previousReports = queryClient.getQueryData(['commissionReports']);

      queryClient.setQueryData(['commissionReports'], (old) =>
        old?.filter((report) => report.id !== reportId)
      );

      return { previousReports };
    },
    onError: (err, reportId, context) => {
      queryClient.setQueryData(['commissionReports'], context.previousReports);
      toast.error('Erro ao eliminar relatório');
    },
    onSuccess: () => {
      toast.success('Relatório eliminado com sucesso');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['commissionReports'] });
    },
  });
};
