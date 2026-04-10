import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { FileDown, Download, FileText, Trash2, Calendar, CircleCheck as CheckCircle, Loader as Loader2, Banknote, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { partnersService } from "../services/partnersService";
import { commissionReportsService } from "../services/commissionReportsService";
import { salesService } from "../services/salesService";
import { advancesService } from "../services/advancesService";
import { supabase } from "../lib/supabase";
import { useConfirm } from "@/components/ui/confirm-dialog";

const CommissionReports = ({ user }) => {
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [selectedPartner, setSelectedPartner] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState(null);
  const [partnerTypeFilter, setPartnerTypeFilter] = useState("all");
  const [cutoffDate, setCutoffDate] = useState("");

  const [advanceDialog, setAdvanceDialog] = useState(null);
  const [advanceSelections, setAdvanceSelections] = useState({});
  const [pendingPrintArgs, setPendingPrintArgs] = useState(null);

  const { data: partners = [], isLoading: partnersLoading } = useQuery({
    queryKey: ['partners'],
    queryFn: () => partnersService.getAll(),
    staleTime: 10 * 60 * 1000,
  });

  const { data: emittedReports = [], isLoading: reportsLoading, refetch: refetchReports } = useQuery({
    queryKey: ['commissionReports', filterYear, filterMonth],
    queryFn: () => commissionReportsService.getAll(filterYear, filterMonth),
    staleTime: 2 * 60 * 1000,
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async ({ reportId, userId }) => {
      await commissionReportsService.validatePayment(reportId, userId);
    },
    onSuccess: () => {
      toast.success('Auto validado como pago com sucesso');
      queryClient.invalidateQueries({ queryKey: ['commissionReports'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao validar pagamento');
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: (reportId) => commissionReportsService.delete(reportId),
    onSuccess: () => {
      toast.success('Auto eliminado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['commissionReports'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao eliminar auto');
    },
  });

  const months = [
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' },
    { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' },
    { value: 12, label: 'Dezembro' }
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  useEffect(() => {
    commissionReportsService.getLatestEmittedReport().then(latestReport => {
      if (latestReport) {
        setFilterYear(latestReport.year);
        setFilterMonth(latestReport.month);
      }
    });
  }, []);

  const handleValidatePayment = async (reportId) => {
    const ok = await confirm({
      title: 'Validar pagamento',
      description: 'Confirma que este auto foi pago? Esta acao nao pode ser revertida e o auto ficara bloqueado.',
      confirmLabel: 'Confirmar pagamento',
      confirmVariant: 'success',
    });
    if (!ok) return;

    markAsPaidMutation.mutate({
      reportId,
      userId: user.id
    });
  };

  const handleDeleteReport = async (reportId, isPaidValidated) => {
    if (isPaidValidated) {
      toast.error("Nao e possivel eliminar um auto validado como pago");
      return;
    }

    const ok = await confirm({
      title: 'Eliminar auto',
      description: 'Tem a certeza que deseja eliminar este auto?',
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;

    deleteReportMutation.mutate(reportId);
  };

  const handleDownloadReport = async (report) => {
    try {
      const blob = await commissionReportsService.downloadFile(report.file_path);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = report.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("Download iniciado");
    } catch (error) {
      console.error("Erro ao fazer download:", error);
      toast.error("Erro ao fazer download do auto");
    }
  };

  const filterSalesByMonth = (sales) => {
    const cutoff = cutoffDate ? new Date(cutoffDate + 'T23:59:59') : null;

    return sales.filter(sale => {
      if (!sale.activation_date) return false;

      let saleDate;
      const dateField = sale.activation_date;
      if (typeof dateField === 'string' && dateField.includes('T')) {
        saleDate = new Date(dateField);
      } else {
        const parts = dateField.split('-');
        saleDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      }

      if (cutoff) {
        return saleDate <= cutoff;
      }

      const saleMonth = saleDate.getMonth() + 1;
      const saleYear = saleDate.getFullYear();
      return saleMonth === selectedMonth && saleYear === selectedYear;
    });
  };

  const getFilteredPartners = () => {
    if (partnerTypeFilter === 'all') return partners;
    if (partnerTypeFilter === 'individual') {
      return selectedPartner ? partners.filter(p => p.id === selectedPartner) : [];
    }
    return partners.filter(p => p.partner_type === partnerTypeFilter);
  };

  const openPrintWindow = async (partnerId, settledAdvances) => {
    const allSales = await salesService.getAll(null, true);
    const activePaidSales = allSales.filter(sale => sale.status === 'Ativo' && sale.paid_to_operator === true);
    const filteredByMonth = filterSalesByMonth(activePaidSales);
    let finalSales = filteredByMonth.filter(s => s.partner_id === partnerId);

    const partner = partners.find(p => p.id === partnerId);
    if (!partner) { toast.error("Parceiro nao encontrado"); return; }

    const settledSaleIds = await commissionReportsService.getSettledSalesForPartner(partnerId, selectedMonth, selectedYear);
    if (settledSaleIds.length > 0) {
      finalSales = finalSales.filter(sale => !settledSaleIds.includes(sale.id));
    }
    if (finalSales.length === 0) {
      const monthName = months.find(m => m.value === selectedMonth)?.label;
      toast.error(settledSaleIds.length > 0
        ? `Todas as vendas de ${monthName}/${selectedYear} para ${partner.name} ja foram liquidadas em auto anterior.`
        : `Nao existem vendas pagas para ${partner.name} no mes de ${monthName}/${selectedYear}`);
      return;
    }

    const pendingChargebacks = await commissionReportsService.getPendingChargebacksForPartner(partnerId);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error("Sessao expirada."); return; }

    const monthName = months.find(m => m.value === selectedMonth)?.label;
    const printWindow = window.open('', '_blank');
    if (!printWindow) { toast.error("Popup bloqueado. Por favor, permita popups para este site."); return; }

    const salesIds = finalSales.map(sale => sale.id);

    const today = new Date();
    const retentionRefDate = new Date(selectedYear, selectedMonth - 1, 1);
    const sixMonthsAgo = new Date(retentionRefDate);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const refundMonthStart = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth(), 1);
    const refundMonthEnd = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth() + 1, 0);
    const refundMonthLabel = sixMonthsAgo.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });

    let totalCommissions = 0;
    let totalRetentions = 0;
    let totalRefunds = 0;
    let totalChargebacks = 0;

    const salesRowsData = finalSales.map(sale => {
      const commission = parseFloat(sale.manual_commission || sale.calculated_commission || 0);
      const ddValue = sale.has_direct_debit ? parseFloat(sale.direct_debit_value || 0) : 0;
      const feValue = sale.has_electronic_invoice ? parseFloat(sale.electronic_invoice_value || 0) : 0;
      const totalComm = commission + ddValue + feValue;
      const retentionValue = parseFloat(sale.retention_value || 0);
      totalCommissions += totalComm;
      totalRetentions += retentionValue;
      return { sale, totalComm, retentionValue };
    });

    const refundSales = finalSales.filter(sale => {
      const saleDate = new Date(sale.activation_date || sale.date);
      return sale.retention_value > 0 && saleDate >= refundMonthStart && saleDate <= refundMonthEnd;
    });
    refundSales.forEach(sale => { totalRefunds += parseFloat(sale.retention_value || 0); });

    pendingChargebacks.forEach(cb => { totalChargebacks += parseFloat(cb.chargeback_amount || 0); });

    const totalAdvancesSettled = (settledAdvances || []).reduce((sum, a) => sum + a.settle_amount, 0);

    const isVatExempt = partner.is_vat_exempt === true;
    const totalSemIVA = totalCommissions - totalRetentions - totalAdvancesSettled + totalRefunds - totalChargebacks;
    const iva = totalSemIVA * 0.23;
    const totalComIVA = totalSemIVA * 1.23;

    const salesRows = salesRowsData.map(({ sale, totalComm, retentionValue }) => `
      <tr>
        <td>${sale.client_name || '-'}</td>
        <td>${sale.client_nif || '-'}</td>
        <td>${sale.cpe || '-'}</td>
        <td>${sale.cui || '-'}</td>
        <td>${sale.request_number || '-'}</td>
        <td style="text-align:right">\u20AC${totalComm.toFixed(2)}</td>
        <td style="text-align:right; color:#b91c1c">${retentionValue > 0 ? '\u20AC' + retentionValue.toFixed(2) : '-'}</td>
      </tr>
    `).join('');

    const refundTableHtml = (totalRefunds > 0 && refundSales.length > 0) ? `
      <div style="margin-top:18px;">
        <table style="width:100%;border-collapse:collapse;font-size:9px;">
          <thead>
            <tr>
              <th colspan="5" style="background:#1F4E78;color:white;padding:6px 4px;text-align:left;font-weight:bold;font-size:9px;">
                Retencoes a Devolver — Mes de referencia: ${refundMonthLabel}
              </th>
              <th style="background:#1F4E78;color:white;padding:6px 4px;text-align:right;font-weight:bold;font-size:9px;visibility:hidden">-</th>
              <th style="background:#166534;color:white;padding:6px 4px;text-align:right;font-weight:bold;font-size:9px;">A Devolver (\u20AC)</th>
            </tr>
          </thead>
          <tbody>
            ${refundSales.map(sale => `
              <tr>
                <td style="padding:5px 4px;border:1px solid #ddd;">${sale.client_name || '-'}</td>
                <td style="padding:5px 4px;border:1px solid #ddd;">${sale.client_nif || '-'}</td>
                <td style="padding:5px 4px;border:1px solid #ddd;">${sale.cpe || '-'}</td>
                <td style="padding:5px 4px;border:1px solid #ddd;">${sale.cui || '-'}</td>
                <td style="padding:5px 4px;border:1px solid #ddd;">${sale.request_number || '-'}</td>
                <td style="padding:5px 4px;border:1px solid #ddd;"></td>
                <td style="padding:5px 4px;border:1px solid #ddd;text-align:right;color:#166534;font-weight:bold;">\u20AC${parseFloat(sale.retention_value || 0).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : '';

    const chargebackTableHtml = pendingChargebacks.length > 0 ? `
      <div style="margin-top:18px;">
        <table style="width:100%;border-collapse:collapse;font-size:9px;">
          <thead>
            <tr>
              <th style="background:#7f1d1d;color:white;padding:6px 4px;text-align:left;font-weight:bold;font-size:9px;">Nome Cliente</th>
              <th style="background:#7f1d1d;color:white;padding:6px 4px;text-align:left;font-weight:bold;font-size:9px;">NIF</th>
              <th style="background:#7f1d1d;color:white;padding:6px 4px;text-align:left;font-weight:bold;font-size:9px;">REQ</th>
              <th style="background:#7f1d1d;color:white;padding:6px 4px;text-align:left;font-weight:bold;font-size:9px;">Motivo</th>
              <th style="background:#7f1d1d;color:white;padding:6px 4px;text-align:left;font-weight:bold;font-size:9px;">Data Motivo</th>
              <th style="background:#7f1d1d;color:white;padding:6px 4px;text-align:right;font-weight:bold;font-size:9px;">Comissao Orig. (\u20AC)</th>
              <th style="background:#7f1d1d;color:white;padding:6px 4px;text-align:right;font-weight:bold;font-size:9px;">% CB</th>
              <th style="background:#7f1d1d;color:white;padding:6px 4px;text-align:right;font-weight:bold;font-size:9px;">A Descontar (\u20AC)</th>
            </tr>
          </thead>
          <tbody>
            ${pendingChargebacks.map(cb => `
              <tr>
                <td style="padding:5px 4px;border:1px solid #ddd;">${cb.sale?.client_name || '-'}</td>
                <td style="padding:5px 4px;border:1px solid #ddd;font-family:monospace;">${cb.sale?.client_nif || '-'}</td>
                <td style="padding:5px 4px;border:1px solid #ddd;">${cb.sale?.request_number || '-'}</td>
                <td style="padding:5px 4px;border:1px solid #ddd;">${cb.reason || '-'}</td>
                <td style="padding:5px 4px;border:1px solid #ddd;">${cb.reason_date ? new Date(cb.reason_date).toLocaleDateString('pt-PT') : '-'}</td>
                <td style="padding:5px 4px;border:1px solid #ddd;text-align:right;">\u20AC${parseFloat(cb.commission_amount || 0).toFixed(2)}</td>
                <td style="padding:5px 4px;border:1px solid #ddd;text-align:right;">${parseFloat(cb.percentage || 0).toFixed(0)}%</td>
                <td style="padding:5px 4px;border:1px solid #ddd;text-align:right;color:#b91c1c;font-weight:bold;">-\u20AC${parseFloat(cb.chargeback_amount || 0).toFixed(2)}</td>
              </tr>
            `).join('')}
            <tr style="background:#fee2e2;font-weight:bold;">
              <td colspan="7" style="text-align:right;border-top:2px solid #b91c1c;color:#7f1d1d;">TOTAL CHARGEBACKS:</td>
              <td style="text-align:right;border-top:2px solid #b91c1c;color:#7f1d1d;">-\u20AC${totalChargebacks.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    ` : '';

    const chargebacksLineHtml = totalChargebacks > 0 ? `
      <tr style="background-color:#fee2e2 !important;">
        <td colspan="6" style="text-align:right;font-weight:bold;color:#7f1d1d;border-top:1px solid #fca5a5;">Chargebacks:</td>
        <td style="text-align:right;font-weight:bold;color:#7f1d1d;border-top:1px solid #fca5a5;">-\u20AC${totalChargebacks.toFixed(2)}</td>
      </tr>
    ` : '';

    const advancesLineHtml = totalAdvancesSettled > 0 ? `
      <tr style="background-color:#fff3cd !important;">
        <td colspan="6" style="text-align:right;font-weight:bold;color:#92400e;border-top:1px solid #f59e0b;">Adiantamentos:</td>
        <td style="text-align:right;font-weight:bold;color:#92400e;border-top:1px solid #f59e0b;">-\u20AC${totalAdvancesSettled.toFixed(2)}</td>
      </tr>
    ` : '';

    const retentionsLineHtml = totalRetentions > 0 ? `
      <tr style="background-color:#fee2e2 !important;">
        <td colspan="6" style="text-align:right;font-weight:bold;color:#991b1b;border-top:1px solid #fca5a5;">Retencoes:</td>
        <td style="text-align:right;font-weight:bold;color:#991b1b;border-top:1px solid #fca5a5;">-\u20AC${totalRetentions.toFixed(2)}</td>
      </tr>
    ` : '';

    const refundsLineHtml = totalRefunds > 0 ? `
      <tr style="background-color:#dcfce7 !important;">
        <td colspan="6" style="text-align:right;font-weight:bold;color:#166534;border-top:1px solid #86efac;">Retencoes a Devolver:</td>
        <td style="text-align:right;font-weight:bold;color:#166534;border-top:1px solid #86efac;">+\u20AC${totalRefunds.toFixed(2)}</td>
      </tr>
    ` : '';

    const advancesJson = JSON.stringify(settledAdvances || []);

    printWindow.reportData = {
      partnerId,
      partnerName: partner.name,
      partnerEmail: partner.email,
      month: selectedMonth,
      monthName,
      year: selectedYear,
      userId: user.id,
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
      supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      accessToken: session.access_token,
      salesIds,
      settledAdvances: settledAdvances || [],
      chargebackIds: pendingChargebacks.map(cb => cb.id),
    };

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Auto de Comissoes - ${partner.name} - ${monthName}/${selectedYear}</title>
        <style>
          @media print {
            @page { size: A4 landscape; margin: 10mm; }
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          }
          body { font-family: Arial, sans-serif; margin: 15px; color: #333; max-width: 100%; }
          .header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:15px; border-bottom:2px solid #1F4E78; padding-bottom:10px; }
          .header-left { flex:1; }
          .header-logo { flex-shrink:0; margin-left:20px; }
          .header-logo img { height:45px; width:auto; }
          .company-name { font-size:14px; font-weight:bold; color:#1F4E78; margin-bottom:3px; }
          .company-details { font-size:9px; color:#666; line-height:1.4; }
          .title { font-size:16px; font-weight:bold; color:#1F4E78; text-align:center; margin:12px 0; padding:8px; background-color:#f0f4f8; border-radius:4px; }
          table { width:100%; border-collapse:collapse; margin:10px 0; font-size:9px; }
          th { background-color:#1F4E78; color:white; padding:6px 4px; text-align:left; font-weight:bold; font-size:9px; }
          td { padding:5px 4px; border:1px solid #ddd; }
          tr:nth-child(even) { background-color:#f9f9f9; }
          .total-row { background-color:#e8f0f7 !important; font-weight:bold; font-size:11px; }
          .total-row td { border-top:2px solid #1F4E78; }
          .iva-section { background-color:#f0f4f8; border:2px dashed #94a3b8; border-radius:6px; padding:8px; margin-top:4px; }
          .footer { margin-top:20px; text-align:right; font-size:8px; color:#666; }
          .no-print { margin:20px 0; text-align:center; }
          @media print { .no-print { display:none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <div class="company-name">MARCIO &amp; SANDRA LDA</div>
            <div class="company-details">
              Avenida rainha Santa Isabel Lt 8 loja 1<br>
              5000-434 Vila Real<br>
              NIF: 518162796
            </div>
          </div>
          <div class="header-logo">
            <img src="${window.location.origin}/logo.png" alt="Logo MP Grupo" onerror="this.style.display='none'" />
          </div>
        </div>

        <div class="title">AUTO DE COMISSOES - ${partner.name} - ${monthName}/${selectedYear}</div>

        <table>
          <thead>
            <tr>
              <th>Nome Cliente</th>
              <th>NIF</th>
              <th>CPE</th>
              <th>CUI</th>
              <th>REQ</th>
              <th style="text-align:right">Comissao (\u20AC)</th>
              <th style="text-align:right">A Reter (\u20AC)</th>
            </tr>
          </thead>
          <tbody>
            ${salesRows}
            <tr class="total-row">
              <td colspan="5" style="text-align:right;font-weight:bold;">Total Comissoes:</td>
              <td style="text-align:right;font-weight:bold;">\u20AC${totalCommissions.toFixed(2)}</td>
              <td style="text-align:right;font-weight:bold;color:#991b1b;">${totalRetentions > 0 ? '-\u20AC' + totalRetentions.toFixed(2) : '-'}</td>
            </tr>
            ${chargebacksLineHtml}
            ${advancesLineHtml}
            ${retentionsLineHtml}
            ${refundsLineHtml}
            <tr class="total-row" style="font-size:12px;">
              <td colspan="6" style="text-align:right;font-weight:bold;border-top:2px solid #1F4E78;">${isVatExempt ? 'TOTAL:' : 'TOTAL S/IVA:'}</td>
              <td style="text-align:right;font-weight:bold;border-top:2px solid #1F4E78;">\u20AC${totalSemIVA.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        ${refundTableHtml}

        ${chargebackTableHtml}

        ${isVatExempt ? `
        <div style="margin-top:10px;padding:8px;background:#fef3c7;border:1px solid #d97706;border-radius:6px;font-size:9px;color:#92400e;font-weight:bold;">
          Parceiro isento de IVA — valores apresentados sem IVA
        </div>
        ` : `
        <div class="iva-section" style="margin-top:10px;">
          <table style="margin:0;">
            <tbody>
              <tr style="background:#e2e8f0;">
                <td colspan="6" style="text-align:right;font-weight:bold;color:#475569;">IVA 23%:</td>
                <td style="text-align:right;font-weight:bold;color:#475569;">\u20AC${iva.toFixed(2)}</td>
              </tr>
              <tr style="background:#cbd5e1;">
                <td colspan="6" style="text-align:right;font-weight:bold;color:#1e293b;font-size:12px;">TOTAL C/IVA:</td>
                <td style="text-align:right;font-weight:bold;color:#1e293b;font-size:12px;">\u20AC${totalComIVA.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        `}

        <div class="footer">
          Documento gerado em ${new Date().toLocaleDateString('pt-PT')} as ${new Date().toLocaleTimeString('pt-PT')}
        </div>

        <div class="no-print" style="display:flex;gap:10px;margin-top:20px;justify-content:center;">
          <button id="approveBtn" onclick="approveAndRegister()" style="padding:10px 20px;font-size:16px;cursor:pointer;background-color:#10b981;color:white;border:none;border-radius:5px;">
            Aprovar e Registrar Auto
          </button>
          <button onclick="window.print()" style="padding:10px 20px;font-size:16px;cursor:pointer;background-color:#1F4E78;color:white;border:none;border-radius:5px;">
            Imprimir
          </button>
          <button onclick="window.close()" style="padding:10px 20px;font-size:16px;cursor:pointer;background-color:#6c757d;color:white;border:none;border-radius:5px;">
            Fechar
          </button>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"></script>
        <script>
          let librariesReady = false;
          let checkAttempts = 0;
          const maxAttempts = 50;

          function checkLibraries() {
            checkAttempts++;
            const btn = document.getElementById('approveBtn');
            if (typeof html2canvas !== 'undefined' && typeof window.jspdf !== 'undefined') {
              librariesReady = true;
              if (btn) { btn.disabled = false; btn.textContent = 'Aprovar e Registrar Auto'; btn.style.opacity = '1'; }
              return true;
            }
            if (checkAttempts < maxAttempts) {
              setTimeout(checkLibraries, 100);
            } else {
              if (btn) { btn.disabled = false; btn.textContent = 'Tentar Registar (bibliotecas nao carregadas)'; btn.style.opacity = '1'; btn.style.backgroundColor = '#f59e0b'; }
            }
            return false;
          }

          window.addEventListener('DOMContentLoaded', function() {
            const approveBtn = document.getElementById('approveBtn');
            if (approveBtn) { approveBtn.disabled = true; approveBtn.textContent = 'Carregando bibliotecas...'; approveBtn.style.opacity = '0.6'; }
            checkLibraries();
          });

          async function approveAndRegister() {
            const btn = document.getElementById('approveBtn');
            btn.disabled = true; btn.textContent = 'Processando...'; btn.style.opacity = '0.6';
            try {
              if (typeof window.jspdf === 'undefined') throw new Error('jsPDF library not loaded');
              if (typeof html2canvas === 'undefined') throw new Error('html2canvas library not loaded');

              const { jsPDF } = window.jspdf;
              btn.textContent = 'Capturando imagem...';
              const canvas = await html2canvas(document.body, { scale: 1, useCORS: true, logging: false, allowTaint: true });
              btn.textContent = 'Gerando PDF...';
              const imgData = canvas.toDataURL('image/jpeg', 0.85);
              const pdf = new jsPDF('l', 'mm', 'a4');
              const pdfWidth = pdf.internal.pageSize.getWidth();
              const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
              pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
              const pdfBlob = pdf.output('blob');
              const data = window.reportData;

              btn.textContent = 'Verificando versao...';
              const versionResponse = await fetch(\`\${data.supabaseUrl}/rest/v1/commission_reports?partner_id=eq.\${data.partnerId}&month=eq.\${data.month}&year=eq.\${data.year}&select=version&order=version.desc&limit=1\`, {
                headers: { 'apikey': data.supabaseKey, 'Authorization': \`Bearer \${data.accessToken}\` }
              });
              const versionData = await versionResponse.json();
              const version = versionData.length > 0 ? versionData[0].version + 1 : 1;

              const monthNames = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
              const mName = monthNames[data.month - 1];
              const fileName = \`\${data.partnerName.replace(/[^a-zA-Z0-9]/g, '_')}_Auto_\${mName}_\${data.year}_V\${version}.pdf\`;
              const filePath = \`\${data.partnerId}/\${data.year}/\${fileName}\`;

              btn.textContent = 'Enviando PDF...';
              const uploadResponse = await fetch(\`\${data.supabaseUrl}/storage/v1/object/commission-reports/\${filePath}\`, {
                method: 'POST',
                headers: { 'apikey': data.supabaseKey, 'Authorization': \`Bearer \${data.accessToken}\`, 'Content-Type': 'application/pdf', 'x-upsert': 'true' },
                body: pdfBlob
              });
              if (!uploadResponse.ok) throw new Error('Erro ao fazer upload do PDF: ' + await uploadResponse.text());

              if (data.settledAdvances && data.settledAdvances.length > 0) {
                btn.textContent = 'Liquidando adiantamentos...';
                for (const adv of data.settledAdvances) {
                  const newSettled = (adv.settled_amount || 0) + adv.settle_amount;
                  const isFullySettled = newSettled >= adv.amount;
                  const updateBody = { settled_amount: newSettled, is_settled: isFullySettled, settled_by: data.userId };
                  if (isFullySettled) updateBody.settled_at = new Date().toISOString();
                  await fetch(\`\${data.supabaseUrl}/rest/v1/partner_advances?id=eq.\${adv.id}\`, {
                    method: 'PATCH',
                    headers: { 'apikey': data.supabaseKey, 'Authorization': \`Bearer \${data.accessToken}\`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
                    body: JSON.stringify(updateBody)
                  });
                }
              }

              if (data.chargebackIds && data.chargebackIds.length > 0) {
                btn.textContent = 'Liquidando chargebacks...';
                const reportInsertResp = await fetch(\`\${data.supabaseUrl}/rest/v1/commission_reports?partner_id=eq.\${data.partnerId}&month=eq.\${data.month}&year=eq.\${data.year}&order=version.desc&limit=1\`, {
                  headers: { 'apikey': data.supabaseKey, 'Authorization': \`Bearer \${data.accessToken}\` }
                });
                const reportRows = await reportInsertResp.json();
                const reportId = reportRows && reportRows[0] ? reportRows[0].id : null;
                if (reportId) {
                  for (const cbId of data.chargebackIds) {
                    await fetch(\`\${data.supabaseUrl}/rest/v1/chargebacks?id=eq.\${cbId}\`, {
                      method: 'PATCH',
                      headers: { 'apikey': data.supabaseKey, 'Authorization': \`Bearer \${data.accessToken}\`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
                      body: JSON.stringify({ commission_report_id: reportId })
                    });
                  }
                }
              }

              btn.textContent = 'Enviando email...';
              const emailData = { partnerId: data.partnerId, partnerEmail: data.partnerEmail, partnerName: data.partnerName, month: data.month, year: data.year, userId: data.userId, filePath, fileName, version, salesIds: data.salesIds || [] };
              const response = await fetch(\`\${data.supabaseUrl}/functions/v1/send-commission-report-email\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${data.accessToken}\` },
                body: JSON.stringify(emailData)
              });
              if (!response.ok) {
                const errorText = await response.text();
                try { const ed = JSON.parse(errorText); throw new Error(ed.error || \`Erro (\${response.status})\`); } catch(e) { throw new Error(\`Erro (\${response.status}): \${errorText.substring(0, 200)}\`); }
              }

              btn.textContent = 'Concluido!'; btn.style.backgroundColor = '#10b981'; btn.style.opacity = '1';
              setTimeout(() => {
                alert('Auto aprovado e registrado com sucesso! Email enviado ao parceiro.');
                if (window.opener) { try { window.opener.location.reload(); } catch(e) {} }
                setTimeout(() => window.close(), 300);
              }, 100);
            } catch (error) {
              btn.style.opacity = '1'; btn.disabled = false; btn.textContent = 'Aprovar e Registrar Auto'; btn.style.backgroundColor = '#10b981';
              alert('Erro ao processar auto: ' + error.message);
            }
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    toast.success(`Auto de comissoes de ${partner.name} aberto em nova janela`);
  };

  const printCommissionReport = async (partnerId) => {
    setLoading(true);
    try {
      if (!cutoffDate && !selectedMonth) {
        toast.error("Por favor, selecione um mes ou data limite");
        setLoading(false);
        return;
      }

      const pendingAdvances = await advancesService.getPendingByPartnerId(partnerId);

      if (pendingAdvances.length > 0) {
        const partner = partners.find(p => p.id === partnerId);
        const initialSelections = {};
        pendingAdvances.forEach(adv => {
          const remaining = parseFloat(adv.amount) - parseFloat(adv.settled_amount || 0);
          initialSelections[adv.id] = { selected: true, amount: remaining.toFixed(2), advance: adv };
        });
        setAdvanceSelections(initialSelections);
        setAdvanceDialog({ partnerId, partnerName: partner?.name, advances: pendingAdvances });
        setLoading(false);
        return;
      }

      await openPrintWindow(partnerId, []);
    } catch (error) {
      toast.error("Erro ao gerar auto para impressao");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdvanceDialogConfirm = async () => {
    const { partnerId } = advanceDialog;
    const settledAdvances = Object.entries(advanceSelections)
      .filter(([, v]) => v.selected)
      .map(([id, v]) => {
        const adv = v.advance;
        const settleAmount = Math.min(parseFloat(v.amount) || 0, parseFloat(adv.amount) - parseFloat(adv.settled_amount || 0));
        return { id, amount: parseFloat(adv.amount), settled_amount: parseFloat(adv.settled_amount || 0), settle_amount: settleAmount };
      })
      .filter(a => a.settle_amount > 0);

    setAdvanceDialog(null);
    setLoading(true);
    try {
      await openPrintWindow(partnerId, settledAdvances);
    } catch (error) {
      toast.error("Erro ao gerar auto");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const generateCommissionReport = async (partnerId = null) => {
    setLoading(true);
    try {
      const allSales = await salesService.getAll(null, true);
      const paidSales = allSales.filter(sale => sale.paid_to_operator === true);
      const filteredByMonth = filterSalesByMonth(paidSales);
      const finalSales = partnerId
        ? filteredByMonth.filter(s => s.partner_id === partnerId)
        : filteredByMonth;

      if (finalSales.length === 0) {
        const monthName = months.find(m => m.value === selectedMonth)?.label;
        toast.error(`Nao existem vendas pagas para o mes de ${monthName}/${selectedYear}`);
        setLoading(false);
        return;
      }

      const XLSX = await import('xlsx');

      if (partnerId) {
        await generateSinglePartnerReport(partnerId, finalSales, XLSX);
      } else {
        await generateAllPartnersReport(finalSales, XLSX);
      }

      toast.success("Auto de comissoes gerado com sucesso!");
    } catch (error) {
      toast.error("Erro ao gerar auto de comissoes");
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSinglePartnerReport = async (partnerId, sales, XLSX) => {
    const partner = partners.find(p => p.id === partnerId);
    if (!partner) return;

    const partnerSales = sales.filter(s => s.partner_id === partnerId);

    const wb = XLSX.utils.book_new();
    const ws = createStyledWorksheet(partner, partnerSales, XLSX);

    XLSX.utils.book_append_sheet(wb, ws, partner.name.substring(0, 31));

    const monthName = months.find(m => m.value === selectedMonth)?.label;
    const fileName = `Auto_Comissoes_${partner.name.replace(/\s+/g, '_')}_${monthName}_${selectedYear}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const generateAllPartnersReport = async (sales, XLSX) => {
    const wb = XLSX.utils.book_new();

    const partnerGroups = {};
    sales.forEach(sale => {
      if (!partnerGroups[sale.partner_id]) {
        partnerGroups[sale.partner_id] = [];
      }
      partnerGroups[sale.partner_id].push(sale);
    });

    for (const [partnerId, partnerSales] of Object.entries(partnerGroups)) {
      const partner = partners.find(p => p.id === partnerId);
      if (!partner) continue;

      const ws = createStyledWorksheet(partner, partnerSales, XLSX);
      XLSX.utils.book_append_sheet(wb, ws, partner.name.substring(0, 31));
    }

    const monthName = months.find(m => m.value === selectedMonth)?.label;
    const fileName = `Autos_Comissoes_Todos_${monthName}_${selectedYear}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handleBulkPrintCommissionReports = async () => {
    if (!cutoffDate && !selectedMonth) {
      toast.error("Por favor, selecione um mes ou data limite");
      return;
    }

    setLoading(true);
    try {
      const allSales = await salesService.getAll(null, true);
      const paidSales = allSales.filter(sale => sale.paid_to_operator === true);
      const filteredByPeriod = filterSalesByMonth(paidSales);

      const filteredPartners = getFilteredPartners();
      const filteredPartnerIds = new Set(filteredPartners.map(p => p.id));

      const partnerIdsSales = [...new Set(filteredByPeriod.filter(s => filteredPartnerIds.has(s.partner_id)).map(s => s.partner_id))];

      if (partnerIdsSales.length === 0) {
        const periodLabel = cutoffDate ? `até ${new Date(cutoffDate).toLocaleDateString('pt-PT')}` : `${months.find(m => m.value === selectedMonth)?.label}/${selectedYear}`;
        toast.error(`Nao existem parceiros com vendas elegiveis para emissao no periodo ${periodLabel}`);
        setLoading(false);
        return;
      }

      const periodLabel = cutoffDate ? `até ${new Date(cutoffDate).toLocaleDateString('pt-PT')}` : `${months.find(m => m.value === selectedMonth)?.label}/${selectedYear}`;
      const ok = await confirm({
        title: `Emitir autos — ${periodLabel}`,
        description: `Serao abertas ${partnerIdsSales.length} janela(s) individuais para ${partnerIdsSales.length} parceiro(s) com vendas no periodo.`,
        confirmLabel: 'Continuar',
        confirmVariant: 'success',
      });
      if (!ok) {
        setLoading(false);
        return;
      }

      let openedWindows = 0;
      for (const pid of partnerIdsSales) {
        await new Promise(resolve => setTimeout(resolve, 500));
        try {
          await printCommissionReport(pid);
          openedWindows++;
        } catch (error) {
          const pName = partners.find(p => p.id === pid)?.name || pid;
          toast.error(`Erro ao gerar auto para ${pName}`);
        }
      }

      toast.success(`${openedWindows} janela(s) de auto aberta(s) com sucesso`);
    } catch (error) {
      toast.error("Erro ao emitir autos em massa: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const createStyledWorksheet = (partner, sales, XLSX) => {
    const data = [];

    data.push(['']);
    data.push(['']);
    data.push(['MARCIO & SANDRA LDA']);
    data.push(['Avenida rainha Santa Isabel Lt 8 loja 1']);
    data.push(['5000-434 Vila Real']);
    data.push(['NIF: 518162796']);
    data.push([]);

    const monthName = months.find(m => m.value === selectedMonth)?.label;
    data.push([`AUTO DE COMISSOES - ${partner.name} - ${monthName}/${selectedYear}`]);
    data.push([]);
    data.push([]);

    data.push(['Nome Cliente', 'NIF', 'CPE', 'CUI', 'REQ', 'Data Ativacao', 'Valor (\u20AC)']);

    const headerRow = data.length - 1;

    let total = 0;
    sales.forEach(sale => {
      const commission = parseFloat(sale.manual_commission || sale.calculated_commission || 0);
      total += commission;

      const saleDate = sale.activation_date || sale.paid_date || sale.date;
      data.push([
        sale.client_name || '',
        sale.client_nif || '',
        sale.cpe || '',
        sale.cui || '',
        sale.request_number || '',
        saleDate ? new Date(saleDate).toLocaleDateString('pt-PT') : '',
        commission.toFixed(2)
      ]);
    });

    data.push([]);
    data.push(['', '', '', '', '', 'TOTAL S/IVA:', total.toFixed(2)]);
    data.push(['', '', '', '', '', 'IVA 23%:', (total * 0.23).toFixed(2)]);
    data.push(['', '', '', '', '', 'TOTAL C/IVA:', (total * 1.23).toFixed(2)]);
    data.push([]);
    data.push(['ATENÇÃO - IVA: Caso seja isento de IVA, desconsidere o "TOTAL C/IVA" e emita fatura apenas pelo "TOTAL S/IVA".']);
    data.push([]);

    const ws = XLSX.utils.aoa_to_sheet(data);

    ws['!cols'] = [
      { wch: 35 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 },
      { wch: 14 },
      { wch: 12 }
    ];

    const range = XLSX.utils.decode_range(ws['!ref']);

    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell_address = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cell_address]) continue;

        if (!ws[cell_address].s) ws[cell_address].s = {};

        if (R === 0 || R === 1) {
          continue;
        }
        else if (R === 2) {
          ws[cell_address].s = {
            font: { bold: true, sz: 14, color: { rgb: "1F4E78" } },
            alignment: { horizontal: "left", vertical: "center" }
          };
        }
        else if (R >= 3 && R <= 5) {
          ws[cell_address].s = {
            font: { sz: 10 },
            alignment: { horizontal: "left", vertical: "center" }
          };
        }
        else if (R === 7) {
          ws[cell_address].s = {
            font: { bold: true, sz: 12, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "1F4E78" } },
            alignment: { horizontal: "center", vertical: "center" }
          };
        }
        else if (R === headerRow) {
          ws[cell_address].s = {
            font: { bold: true, sz: 11, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "4472C4" } },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
              top: { style: "thin", color: { rgb: "000000" } },
              bottom: { style: "thin", color: { rgb: "000000" } },
              left: { style: "thin", color: { rgb: "000000" } },
              right: { style: "thin", color: { rgb: "000000" } }
            }
          };
        }
        else if (R > headerRow && R < range.e.r - 3) {
          ws[cell_address].s = {
            font: { sz: 10 },
            alignment: { horizontal: C === 6 ? "right" : "left", vertical: "center" },
            border: {
              top: { style: "thin", color: { rgb: "D0D0D0" } },
              bottom: { style: "thin", color: { rgb: "D0D0D0" } },
              left: { style: "thin", color: { rgb: "D0D0D0" } },
              right: { style: "thin", color: { rgb: "D0D0D0" } }
            }
          };

          if (R % 2 === 0) {
            ws[cell_address].s.fill = { fgColor: { rgb: "F2F2F2" } };
          }
        }
        else if (R >= range.e.r - 2) {
          ws[cell_address].s = {
            font: { bold: true, sz: 11 },
            alignment: { horizontal: "right", vertical: "center" },
            border: {
              top: { style: R === range.e.r - 2 ? "double" : "thin", color: { rgb: "000000" } }
            }
          };

          if (R === range.e.r) {
            ws[cell_address].s.fill = { fgColor: { rgb: "E7E6E6" } };
          }
        }
      }
    }

    if (!ws['!rows']) ws['!rows'] = [];
    ws['!rows'][0] = { hpt: 50 };
    ws['!rows'][1] = { hpt: 10 };
    ws['!rows'][2] = { hpt: 20 };
    ws['!rows'][7] = { hpt: 25 };
    ws['!rows'][headerRow] = { hpt: 22 };

    if (!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } });

    ws['A1'].v = 'MARCIO & SANDRA LDA';
    ws['A1'].t = 's';

    return ws;
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64 animate-fade-in">
        <p className="text-slate-400">Acesso negado. Apenas administradores podem aceder a esta pagina.</p>
      </div>
    );
  }

  if ((reportsLoading || partnersLoading) && emittedReports.length === 0) {
    return (
      <div className="space-y-6 p-6 animate-fade-in">
        <div className="h-10 bg-dark-700 rounded-lg w-1/3 animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map(i => (
            <div key={i} className="bg-dark-850 border border-white/[0.06] p-6 h-96 animate-pulse rounded-lg">
              <div className="h-6 bg-dark-700 rounded w-1/2 mb-4"></div>
              <div className="space-y-3">
                <div className="h-4 bg-dark-700 rounded w-full"></div>
                <div className="h-4 bg-dark-700 rounded w-3/4"></div>
                <div className="h-4 bg-dark-700 rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 animate-fade-in">
      {confirmDialog}
      <div className="flex justify-between items-center animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold text-white">Autos de Comissoes</h1>
          <p className="font-medium mt-1 text-slate-400">Gere autos de comissoes para parceiros (apenas vendas pagas)</p>
        </div>
      </div>

      <Card className="bg-dark-850 border border-white/[0.06]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <FileDown className="w-5 h-5 text-cyber-400" />
            Emissao de Autos
          </CardTitle>
          <CardDescription className="text-slate-400">
            Configure o periodo e selecione os parceiros para emitir autos de comissoes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-slate-300 text-sm mb-1.5 block">Mes de Referencia</Label>
              <Select
                value={selectedMonth?.toString() || ""}
                onValueChange={(v) => { setSelectedMonth(parseInt(v)); setCutoffDate(""); }}
              >
                <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {months.map(month => (
                    <SelectItem key={month.value} value={month.value.toString()}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300 text-sm mb-1.5 block">Ano</Label>
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300 text-sm mb-1.5 block">
                Data Limite (opcional)
              </Label>
              <Input
                type="date"
                value={cutoffDate}
                onChange={(e) => { setCutoffDate(e.target.value); if (e.target.value) setSelectedMonth(null); }}
                className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
              />
              {cutoffDate && (
                <p className="text-xs text-cyber-400 mt-1">
                  Apenas vendas ate {new Date(cutoffDate).toLocaleDateString('pt-PT')} (ignora mes/ano)
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300 text-sm mb-1.5 block">Filtrar por Tipo de Parceiro</Label>
              <Select value={partnerTypeFilter} onValueChange={(v) => { setPartnerTypeFilter(v); setSelectedPartner(""); }}>
                <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Parceiros</SelectItem>
                  <SelectItem value="D2D">D2D</SelectItem>
                  <SelectItem value="REV">REV</SelectItem>
                  <SelectItem value="Rev+">Rev+</SelectItem>
                  <SelectItem value="individual">Parceiro Individual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {partnerTypeFilter === 'individual' && (
              <div>
                <Label className="text-slate-300 text-sm mb-1.5 block">Selecionar Parceiro</Label>
                <Select value={selectedPartner} onValueChange={setSelectedPartner}>
                  <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20">
                    <SelectValue placeholder="Escolha um parceiro..." />
                  </SelectTrigger>
                  <SelectContent>
                    {partners.map(partner => (
                      <SelectItem key={partner.id} value={partner.id}>
                        {partner.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="border-t border-dark-700 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">PDF Interativo</p>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    const pid = partnerTypeFilter === 'individual' ? selectedPartner : null;
                    if (!pid && partnerTypeFilter === 'individual') { toast.error("Selecione um parceiro"); return; }
                    if (pid) {
                      printCommissionReport(pid);
                    } else {
                      handleBulkPrintCommissionReports();
                    }
                  }}
                  disabled={loading || (!cutoffDate && !selectedMonth) || (partnerTypeFilter === 'individual' && !selectedPartner)}
                  className="flex-1 bg-gradient-to-r from-cyber-500 to-cyber-600 text-white hover:from-cyber-600 hover:to-cyber-700"
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
                  {partnerTypeFilter === 'individual' ? 'Pre-visualizar PDF' : 'Emitir PDFs'}
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                {partnerTypeFilter === 'individual'
                  ? 'Abre janela de pre-visualizacao para o parceiro selecionado'
                  : 'Abre uma janela individual para cada parceiro com vendas no periodo'}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Exportar Excel</p>
              <Button
                onClick={() => {
                  const pid = partnerTypeFilter === 'individual' ? selectedPartner : null;
                  generateCommissionReport(pid === '' ? null : pid);
                }}
                disabled={loading || (!cutoffDate && !selectedMonth) || (partnerTypeFilter === 'individual' && !selectedPartner)}
                className="w-full bg-gradient-to-r from-cyber-500 to-cyber-600 text-white hover:from-cyber-600 hover:to-cyber-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar Excel
              </Button>
              <p className="text-xs text-slate-500">Gera ficheiro .xlsx com todos os parceiros filtrados</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-dark-850 border border-white/[0.06]">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2 text-white">
              <FileText className="w-5 h-5 text-cyber-400" />
              Autos Emitidos
            </CardTitle>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              <Select value={filterMonth?.toString() || "all"} onValueChange={(v) => setFilterMonth(v === "all" ? null : parseInt(v))}>
                <SelectTrigger className="w-32 bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {months.map(month => (
                    <SelectItem key={month.value} value={month.value.toString()}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterYear.toString()} onValueChange={(v) => setFilterYear(parseInt(v))}>
                <SelectTrigger className="w-28 bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <CardDescription className="text-slate-400">
            Lista de todos os autos registrados no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {emittedReports.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <FileText className="w-12 h-12 text-slate-500 mx-auto mb-3" />
              <p>Nenhum auto emitido para o periodo selecionado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {emittedReports.map(report => (
                <div
                  key={report.id}
                  className={`flex items-center justify-between p-4 rounded-lg transition-all duration-200 ${
                    report.paid_validated_at
                      ? 'bg-green-500/10 border-2 border-green-500/20'
                      : 'bg-dark-900 border border-dark-700 hover:border-cyber-500/30 hover:shadow-md'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">
                        {report.partner?.name || 'Parceiro Desconhecido'}
                      </span>
                      {report.paid_validated_at && (
                        <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Pago
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-slate-400 mt-1">
                      {months.find(m => m.value === report.month)?.label} {report.year} - Versao {report.version}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Emitido em {new Date(report.created_at).toLocaleDateString('pt-PT')} por {report.creator?.name || 'Sistema'}
                      {report.emailed_at && (
                        <span className="ml-2 text-green-400">-- Email enviado</span>
                      )}
                    </div>
                    {report.paid_validated_at && (
                      <div className="text-xs text-green-400 mt-1">
                        Validado como pago em {new Date(report.paid_validated_at).toLocaleDateString('pt-PT')} por {report.validator?.name || 'Sistema'}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownloadReport(report)}
                      title="Download PDF"
                      className="bg-dark-900 border-dark-700 text-slate-300 hover:border-cyber-500/30 hover:text-cyber-400"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    {!report.paid_validated_at && (
                      <Button
                        size="sm"
                        onClick={() => handleValidatePayment(report.id)}
                        title="Validar como Pago"
                        className="bg-gradient-to-r from-cyber-500 to-cyber-600 text-white hover:from-cyber-600 hover:to-cyber-700"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteReport(report.id, report.paid_validated_at)}
                      title={report.paid_validated_at ? "Nao e possivel eliminar auto validado" : "Eliminar"}
                      disabled={report.paid_validated_at}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-dark-850 border border-white/[0.06]">
        <CardHeader>
          <CardTitle className="text-white">Informacoes Importantes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-400">
          <p><strong className="text-white">Regras de Emissao:</strong></p>
          <p>-- Autos podem ser emitidos em qualquer altura, sem restricao de datas</p>
          <p>-- Selecione um mes/ano OU uma data limite para filtrar as vendas a incluir</p>
          <p>-- Apenas vendas pagas pelo operador sao incluidas no auto</p>
          <p>-- Vendas ja incluidas em autos validados como pagos nao serao duplicadas em novos autos do mesmo mes</p>

          <p className="pt-2"><strong className="text-white">Processo:</strong></p>
          <p>-- Configure o periodo (mes/ano ou data limite) e o filtro de parceiros</p>
          <p>-- Clique em "Pre-visualizar PDF" (parceiro individual) ou "Emitir PDFs" (todos/tipo)</p>
          <p>-- No popup, clique em "Aprovar e Registrar Auto" para registar e enviar email ao parceiro</p>

          <p className="pt-2"><strong className="text-white">Validacao de Pagamento:</strong></p>
          <p>-- Apos receber o pagamento do parceiro, valide o auto clicando no botao verde</p>
          <p>-- Autos validados ficam bloqueados e nao podem ser eliminados ou editados</p>
          <p>-- A listagem filtra automaticamente pelo ultimo mes emitido</p>
        </CardContent>
      </Card>

      {advanceDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-fade-in">
          <div className="bg-dark-850 border border-amber-500/30 rounded-xl shadow-2xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-5 border-b border-dark-700">
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-bold text-white">Adiantamentos Pendentes</h2>
              </div>
              <button onClick={() => setAdvanceDialog(null)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-300">
                O parceiro <strong className="text-white">{advanceDialog.partnerName}</strong> tem adiantamentos pendentes.
                Selecione quais liquidar neste auto:
              </p>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {advanceDialog.advances.map(adv => {
                  const remaining = parseFloat(adv.amount) - parseFloat(adv.settled_amount || 0);
                  const sel = advanceSelections[adv.id];
                  return (
                    <div key={adv.id} className={`p-3 rounded-lg border transition-all ${sel?.selected ? 'bg-amber-500/10 border-amber-500/30' : 'bg-dark-900 border-dark-700'}`}>
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={sel?.selected || false}
                          onChange={e => setAdvanceSelections(prev => ({ ...prev, [adv.id]: { ...prev[adv.id], selected: e.target.checked } }))}
                          className="mt-1 accent-amber-400 w-4 h-4 cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-white font-medium">€{parseFloat(adv.amount).toFixed(2)}</span>
                            <span className="text-xs text-slate-400">{new Date(adv.advance_date).toLocaleDateString('pt-PT')}</span>
                          </div>
                          {adv.notes && <p className="text-xs text-slate-500 mt-1">{adv.notes}</p>}
                          <div className="flex items-center gap-2 mt-2">
                            <Label className="text-xs text-slate-400 whitespace-nowrap">Valor a liquidar (€):</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              max={remaining}
                              value={sel?.amount || ''}
                              disabled={!sel?.selected}
                              onChange={e => setAdvanceSelections(prev => ({ ...prev, [adv.id]: { ...prev[adv.id], amount: e.target.value } }))}
                              className="h-7 text-sm bg-dark-900 border-dark-700 focus:border-amber-500 text-white disabled:opacity-40"
                            />
                            <span className="text-xs text-slate-500 whitespace-nowrap">/ €{remaining.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="bg-dark-900 border border-dark-700 rounded-lg p-3 text-sm text-slate-400">
                Total a deduzir no auto: <strong className="text-amber-400">
                  €{Object.entries(advanceSelections).filter(([,v]) => v.selected).reduce((sum, [,v]) => sum + (parseFloat(v.amount) || 0), 0).toFixed(2)}
                </strong>
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-dark-700">
              <Button
                variant="outline"
                onClick={() => {
                  const noSelectAll = {};
                  advanceDialog.advances.forEach(adv => {
                    noSelectAll[adv.id] = { ...advanceSelections[adv.id], selected: false };
                  });
                  setAdvanceSelections(noSelectAll);
                }}
                className="border-dark-700 text-slate-300"
              >
                Nao Liquidar Nenhum
              </Button>
              <Button
                onClick={handleAdvanceDialogConfirm}
                className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700"
              >
                Continuar e Gerar Auto
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommissionReports;
