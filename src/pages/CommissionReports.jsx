import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { FileDown, Download, FileText, Trash2, Calendar, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { partnersService } from "../services/partnersService";
import { commissionReportsService } from "../services/commissionReportsService";
import { salesService } from "../services/salesService";
import { supabase } from "../lib/supabase";

const CommissionReports = ({ user }) => {
  const queryClient = useQueryClient();
  const [selectedPartner, setSelectedPartner] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState(null);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

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
    initializeFilters();
  }, []);

  useEffect(() => {
    checkAvailableMonths();
  }, [selectedYear]);

  const initializeFilters = async () => {
    const latestReport = await commissionReportsService.getLatestEmittedReport();
    if (latestReport) {
      setFilterYear(latestReport.year);
      setFilterMonth(latestReport.month);
    }
  };

  const checkAvailableMonths = async () => {
    setCheckingAvailability(true);
    const available = [];

    for (let month = 1; month <= 12; month++) {
      try {
        const isAvailable = await commissionReportsService.isMonthAvailableForEmission(month, selectedYear);
        if (isAvailable) {
          available.push(month);
        }
      } catch (error) {
        console.error(`Erro ao verificar mes ${month}:`, error);
      }
    }

    setAvailableMonths(available);

    if (available.length > 0 && !selectedMonth) {
      setSelectedMonth(available[available.length - 1]);
    } else if (selectedMonth && !available.includes(selectedMonth)) {
      setSelectedMonth(available[available.length - 1] || null);
    }

    setCheckingAvailability(false);
  };

  const handleValidatePayment = async (reportId) => {
    if (!window.confirm("Confirma que este auto foi pago? Esta acao nao pode ser revertida e o auto ficara bloqueado.")) {
      return;
    }

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

    if (!window.confirm("Tem certeza que deseja eliminar este auto?")) return;

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
    return sales.filter(sale => {
      const dateField = sale.activation_date || sale.paid_date || sale.date;

      if (!dateField) {
        return false;
      }

      let saleDate;
      if (typeof dateField === 'string' && dateField.includes('T')) {
        saleDate = new Date(dateField);
      } else {
        const parts = dateField.split('-');
        saleDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      }

      const saleMonth = saleDate.getMonth() + 1;
      const saleYear = saleDate.getFullYear();

      return saleMonth === selectedMonth && saleYear === selectedYear;
    });
  };

  const printCommissionReport = async (partnerId) => {
    setLoading(true);
    try {
      if (!selectedMonth) {
        toast.error("Por favor, selecione um mes disponivel");
        setLoading(false);
        return;
      }

      const isAvailable = await commissionReportsService.isMonthAvailableForEmission(selectedMonth, selectedYear);
      if (!isAvailable) {
        const monthName = months.find(m => m.value === selectedMonth)?.label;
        toast.error(`O mes de ${monthName}/${selectedYear} ainda nao esta disponivel para emissao. Autos so podem ser emitidos apos o dia 22 do mes seguinte.`);
        setLoading(false);
        return;
      }

      const allSales = await salesService.getAll(null, true);
      const paidSales = allSales.filter(sale => sale.paid_to_operator === true);
      const filteredByMonth = filterSalesByMonth(paidSales);
      let finalSales = filteredByMonth.filter(s => s.partner_id === partnerId);

      const partner = partners.find(p => p.id === partnerId);
      if (!partner) {
        toast.error("Parceiro nao encontrado");
        setLoading(false);
        return;
      }

      const settledSaleIds = await commissionReportsService.getSettledSalesForPartner(partnerId, selectedMonth, selectedYear);

      if (settledSaleIds.length > 0) {
        finalSales = finalSales.filter(sale => !settledSaleIds.includes(sale.id));
      }

      if (finalSales.length === 0) {
        const monthName = months.find(m => m.value === selectedMonth)?.label;
        if (settledSaleIds.length > 0) {
          toast.error(`Todas as vendas de ${monthName}/${selectedYear} para ${partner.name} ja foram liquidadas em auto anterior.`);
        } else {
          toast.error(`Nao existem vendas pagas para ${partner.name} no mes de ${monthName}/${selectedYear}`);
        }
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessao expirada. Por favor, faca login novamente.");
        setLoading(false);
        return;
      }

      const monthName = months.find(m => m.value === selectedMonth)?.label;
      const printWindow = window.open('', '_blank');

      if (!printWindow) {
        toast.error("Popup bloqueado. Por favor, permita popups para este site.");
        setLoading(false);
        return;
      }

      const salesIds = finalSales.map(sale => sale.id);

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
        salesIds: salesIds
      };

      let total = 0;
      const salesRows = finalSales.map(sale => {
        const commission = parseFloat(sale.manual_commission || sale.calculated_commission || 0);
        const ddValue = sale.has_direct_debit ? parseFloat(sale.direct_debit_value || 0) : 0;
        const feValue = sale.has_electronic_invoice ? parseFloat(sale.electronic_invoice_value || 0) : 0;
        const totalComm = commission + ddValue + feValue;
        total += totalComm;

        return `
          <tr>
            <td>${sale.client_name}</td>
            <td>${sale.client_nif}</td>
            <td>${sale.operator?.name || '-'}</td>
            <td>${sale.cpe || '-'}</td>
            <td>${sale.cui || '-'}</td>
            <td>${sale.request_number || '-'}</td>
            <td>${sale.activation_date ? new Date(sale.activation_date).toLocaleDateString('pt-PT') : '-'}</td>
            <td>${sale.has_direct_debit ? 'Sim' : 'Nao'}</td>
            <td>${sale.has_electronic_invoice ? 'Sim' : 'Nao'}</td>
            <td style="text-align: right">\u20AC${totalComm.toFixed(2)}</td>
          </tr>
        `;
      }).join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Auto de Comissoes - ${partner.name} - ${monthName}/${selectedYear}</title>
          <style>
            @media print {
              @page {
                size: A4 landscape;
                margin: 10mm;
              }
              body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            }
            body {
              font-family: Arial, sans-serif;
              margin: 15px;
              color: #333;
              max-width: 100%;
            }
            .header {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              margin-bottom: 15px;
              border-bottom: 2px solid #1F4E78;
              padding-bottom: 10px;
            }
            .header-left {
              flex: 1;
            }
            .header-logo {
              flex-shrink: 0;
              margin-left: 20px;
            }
            .header-logo img {
              height: 45px;
              width: auto;
            }
            .company-name {
              font-size: 14px;
              font-weight: bold;
              color: #1F4E78;
              margin-bottom: 3px;
            }
            .company-details {
              font-size: 9px;
              color: #666;
              line-height: 1.4;
            }
            .title {
              font-size: 16px;
              font-weight: bold;
              color: #1F4E78;
              text-align: center;
              margin: 12px 0;
              padding: 8px;
              background-color: #f0f4f8;
              border-radius: 4px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 10px 0;
              font-size: 9px;
            }
            th {
              background-color: #1F4E78;
              color: white;
              padding: 6px 4px;
              text-align: left;
              font-weight: bold;
              font-size: 9px;
            }
            td {
              padding: 5px 4px;
              border: 1px solid #ddd;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .total-row {
              background-color: #e8f0f7 !important;
              font-weight: bold;
              font-size: 11px;
            }
            .total-row td {
              border-top: 2px solid #1F4E78;
            }
            .footer {
              margin-top: 20px;
              text-align: right;
              font-size: 8px;
              color: #666;
            }
            .no-print {
              margin: 20px 0;
              text-align: center;
            }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-left">
              <div class="company-name">MARCIO & SANDRA LDA</div>
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

          <div class="title">
            AUTO DE COMISSOES - ${partner.name} - ${monthName}/${selectedYear}
          </div>

          <table>
            <thead>
              <tr>
                <th>Nome Cliente</th>
                <th>NIF</th>
                <th>Operadora</th>
                <th>CPE</th>
                <th>CUI</th>
                <th>REQ</th>
                <th>Data Ativacao</th>
                <th>DD</th>
                <th>FE</th>
                <th style="text-align: right">Valor (\u20AC)</th>
              </tr>
            </thead>
            <tbody>
              ${salesRows}
              <tr class="total-row">
                <td colspan="9" style="text-align: right; font-weight: bold;">TOTAL S/IVA:</td>
                <td style="text-align: right; font-weight: bold;">\u20AC${total.toFixed(2)}</td>
              </tr>
              <tr class="total-row">
                <td colspan="9" style="text-align: right; font-weight: bold;">IVA 23%:</td>
                <td style="text-align: right; font-weight: bold;">\u20AC${(total * 0.23).toFixed(2)}</td>
              </tr>
              <tr class="total-row">
                <td colspan="9" style="text-align: right; font-weight: bold; background-color: #d4edda !important;">TOTAL C/IVA:</td>
                <td style="text-align: right; font-weight: bold; background-color: #d4edda !important;">\u20AC${(total * 1.23).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <div style="margin-top: 15px; padding: 12px; background-color: #fff3cd; border: 2px solid #ffc107; border-radius: 6px; font-size: 11px; color: #856404;">
            <strong style="display: block; margin-bottom: 5px;">⚠️ ATENÇÃO - IVA:</strong>
            <p style="margin: 0;">Caso seja isento de IVA, o parceiro deve desconsiderar o valor "TOTAL C/IVA" e emitir fatura apenas pelo valor indicado em "TOTAL S/IVA" (Total de Comissões sem IVA).</p>
          </div>

          <div class="footer">
            Documento gerado em ${new Date().toLocaleDateString('pt-PT')} as ${new Date().toLocaleTimeString('pt-PT')}
          </div>

          <div class="no-print" style="display: flex; gap: 10px; margin-top: 20px; justify-content: center;">
            <button id="approveBtn" onclick="approveAndRegister()" style="padding: 10px 20px; font-size: 16px; cursor: pointer; background-color: #10b981; color: white; border: none; border-radius: 5px;">
              Aprovar e Registrar Auto
            </button>
            <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer; background-color: #1F4E78; color: white; border: none; border-radius: 5px;">
              Imprimir
            </button>
            <button onclick="window.close()" style="padding: 10px 20px; font-size: 16px; cursor: pointer; background-color: #6c757d; color: white; border: none; border-radius: 5px;">
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
                if (btn) {
                  btn.disabled = false;
                  btn.textContent = 'Aprovar e Registrar Auto';
                  btn.style.opacity = '1';
                }
                console.log('Libraries loaded successfully');
                return true;
              }

              if (checkAttempts < maxAttempts) {
                setTimeout(checkLibraries, 100);
              } else {
                console.error('Libraries failed to load after ' + maxAttempts + ' attempts');
                if (btn) {
                  btn.disabled = false;
                  btn.textContent = 'Tentar Registar (bibliotecas nao carregadas)';
                  btn.style.opacity = '1';
                  btn.style.backgroundColor = '#f59e0b';
                }
              }
              return false;
            }

            window.addEventListener('DOMContentLoaded', function() {
              const approveBtn = document.getElementById('approveBtn');
              if (approveBtn) {
                approveBtn.disabled = true;
                approveBtn.textContent = 'Carregando bibliotecas...';
                approveBtn.style.opacity = '0.6';
              }
              checkLibraries();
            });

            async function approveAndRegister() {
              const btn = document.getElementById('approveBtn');

              if (typeof window.jspdf === 'undefined' || typeof html2canvas === 'undefined') {
                alert('Bibliotecas nao carregadas. A funcionalidade pode nao funcionar corretamente. Deseja continuar mesmo assim?');
                if (!confirm('Continuar sem bibliotecas carregadas?')) {
                  return;
                }
              }

              btn.disabled = true;
              btn.textContent = 'Processando...';
              btn.style.opacity = '0.6';

              try {
                if (typeof window.jspdf === 'undefined') {
                  throw new Error('jsPDF library not loaded');
                }
                if (typeof html2canvas === 'undefined') {
                  throw new Error('html2canvas library not loaded');
                }

                const { jsPDF } = window.jspdf;
                const element = document.body;

                btn.textContent = 'Capturando imagem...';
                const canvas = await html2canvas(element, {
                  scale: 1,
                  useCORS: true,
                  logging: false,
                  allowTaint: true
                });

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
                  headers: {
                    'apikey': data.supabaseKey,
                    'Authorization': \`Bearer \${data.accessToken}\`
                  }
                });

                const versionData = await versionResponse.json();
                const version = versionData.length > 0 ? versionData[0].version + 1 : 1;

                const monthNames = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
                const monthName = monthNames[data.month - 1];
                const fileName = \`\${data.partnerName.replace(/[^a-zA-Z0-9]/g, '_')}_Auto_\${monthName}_\${data.year}_V\${version}.pdf\`;
                const filePath = \`\${data.partnerId}/\${data.year}/\${fileName}\`;

                btn.textContent = 'Enviando PDF...';
                const uploadResponse = await fetch(\`\${data.supabaseUrl}/storage/v1/object/commission-reports/\${filePath}\`, {
                  method: 'POST',
                  headers: {
                    'apikey': data.supabaseKey,
                    'Authorization': \`Bearer \${data.accessToken}\`,
                    'Content-Type': 'application/pdf',
                    'x-upsert': 'true'
                  },
                  body: pdfBlob
                });

                if (!uploadResponse.ok) {
                  const uploadError = await uploadResponse.text();
                  throw new Error('Erro ao fazer upload do PDF: ' + uploadError);
                }

                btn.textContent = 'Enviando email...';

                const emailData = {
                  partnerId: data.partnerId,
                  partnerEmail: data.partnerEmail,
                  partnerName: data.partnerName,
                  month: data.month,
                  year: data.year,
                  userId: data.userId,
                  filePath: filePath,
                  fileName: fileName,
                  version: version,
                  salesIds: data.salesIds || []
                };

                const response = await fetch(\`\${data.supabaseUrl}/functions/v1/send-commission-report-email\`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': \`Bearer \${data.accessToken}\`
                  },
                  body: JSON.stringify(emailData)
                });

                const responseStatus = response.status;

                if (!response.ok) {
                  const errorText = await response.text();
                  let errorData;
                  try {
                    errorData = JSON.parse(errorText);
                  } catch (e) {
                    throw new Error(\`Erro do servidor (\${responseStatus}): \${errorText.substring(0, 200)}\`);
                  }
                  throw new Error(errorData.error || \`Erro ao registrar auto (\${responseStatus})\`);
                }

                let result;
                try {
                  result = await response.json();
                } catch (jsonError) {
                  result = { success: true };
                }

                btn.textContent = 'Concluido!';
                btn.style.backgroundColor = '#10b981';
                btn.style.opacity = '1';

                setTimeout(() => {
                  alert('Auto aprovado e registrado com sucesso! Email enviado ao parceiro.');

                  if (window.opener) {
                    try {
                      window.opener.location.reload();
                    } catch (e) {
                      console.error('Failed to reload opener:', e);
                    }
                  }

                  setTimeout(() => {
                    window.close();
                  }, 300);
                }, 100);

              } catch (error) {
                console.error('Error:', error);

                btn.style.opacity = '1';
                btn.disabled = false;
                btn.textContent = 'Aprovar e Registrar Auto';
                btn.style.backgroundColor = '#10b981';

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
    } catch (error) {
      toast.error("Erro ao gerar auto para impressao");
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
    if (!selectedMonth) {
      toast.error("Por favor, selecione um mes");
      return;
    }

    setLoading(true);
    try {
      const isAvailable = await commissionReportsService.isMonthAvailableForEmission(selectedMonth, selectedYear);
      if (!isAvailable) {
        const monthName = months.find(m => m.value === selectedMonth)?.label;
        toast.error(`O mes de ${monthName}/${selectedYear} ainda nao esta disponivel para emissao. Autos so podem ser emitidos apos o dia 22 do mes seguinte.`);
        setLoading(false);
        return;
      }

      const partnersWithSales = await commissionReportsService.getPartnersWithSalesForMonth(selectedMonth, selectedYear);

      if (!partnersWithSales || partnersWithSales.length === 0) {
        const monthName = months.find(m => m.value === selectedMonth)?.label;
        toast.error(`Nao existem parceiros com vendas elegiveis para emissao no mes de ${monthName}/${selectedYear}`);
        setLoading(false);
        return;
      }

      const monthName = months.find(m => m.value === selectedMonth)?.label;
      const confirmMsg = `Sera aberta uma janela individual para cada um dos ${partnersWithSales.length} parceiro(s) com vendas em ${monthName}/${selectedYear}:\n\n${partnersWithSales.map(p => `\u2022 ${p.partner_name} (${p.sales_count} venda(s), \u20AC${parseFloat(p.total_commission).toFixed(2)})`).join('\n')}\n\nDeseja continuar?`;

      if (!window.confirm(confirmMsg)) {
        setLoading(false);
        return;
      }

      let openedWindows = 0;
      for (const partnerData of partnersWithSales) {
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
          await printCommissionReport(partnerData.partner_id);
          openedWindows++;
        } catch (error) {
          console.error(`Erro ao gerar auto para ${partnerData.partner_name}:`, error);
          toast.error(`Erro ao gerar auto para ${partnerData.partner_name}`);
        }
      }

      toast.success(`${openedWindows} janela(s) de auto aberta(s) com sucesso`);
    } catch (error) {
      console.error("Erro ao emitir autos em massa:", error);
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
      <div className="flex justify-between items-center animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold text-white">Autos de Comissoes</h1>
          <p className="font-medium mt-1 text-slate-400">Gere autos de comissoes para parceiros (apenas vendas pagas)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-dark-850 border border-white/[0.06] hover:scale-[1.01] transition-transform duration-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <FileDown className="w-5 h-5 text-cyber-400" />
              Auto Individual
            </CardTitle>
            <CardDescription className="text-slate-400">
              Gere auto de comissoes para um parceiro especifico
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-slate-300">Selecionar Parceiro</Label>
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">
                  Mes {checkingAvailability && <span className="text-xs text-slate-500">(verificando...)</span>}
                </Label>
                <Select
                  value={selectedMonth?.toString() || ""}
                  onValueChange={(v) => setSelectedMonth(parseInt(v))}
                  disabled={checkingAvailability || availableMonths.length === 0}
                >
                  <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20">
                    <SelectValue placeholder={availableMonths.length === 0 ? "Nenhum mes disponivel" : "Selecione..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {months
                      .filter(month => availableMonths.includes(month.value))
                      .map(month => (
                        <SelectItem key={month.value} value={month.value.toString()}>
                          {month.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {availableMonths.length === 0 && !checkingAvailability && (
                  <p className="text-xs text-cyber-400 mt-1">Autos so podem ser emitidos apos o dia 22 do mes seguinte</p>
                )}
              </div>
              <div>
                <Label className="text-slate-300">Ano</Label>
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
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button
                  onClick={() => printCommissionReport(selectedPartner)}
                  disabled={!selectedPartner || !selectedMonth || loading || checkingAvailability}
                  className="flex-1 bg-gradient-to-r from-cyber-500 to-cyber-600 text-white hover:from-cyber-600 hover:to-cyber-700"
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Pre-visualizar
                </Button>
                <Button
                  onClick={() => generateCommissionReport(selectedPartner)}
                  disabled={!selectedPartner || !selectedMonth || loading || checkingAvailability}
                  className="flex-1 bg-gradient-to-r from-cyber-500 to-cyber-600 text-white hover:from-cyber-600 hover:to-cyber-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Excel
                </Button>
              </div>
              <Button
                onClick={handleBulkPrintCommissionReports}
                disabled={!selectedMonth || loading || checkingAvailability}
                className="w-full bg-gradient-to-r from-cyber-500 to-cyber-600 text-white hover:from-cyber-600 hover:to-cyber-700"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
                Emitir PDFs para Todos os Parceiros
              </Button>
              <p className="text-xs text-slate-500 text-center">
                Abre janela individual para cada parceiro com vendas no mes
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-dark-850 border border-white/[0.06] hover:scale-[1.01] transition-transform duration-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <FileDown className="w-5 h-5 text-neon-400" />
              Autos de Todos os Parceiros
            </CardTitle>
            <CardDescription className="text-slate-400">
              Gere autos de comissoes para todos os parceiros (um ficheiro com multiplas abas)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">
                  Mes {checkingAvailability && <span className="text-xs text-slate-500">(verificando...)</span>}
                </Label>
                <Select
                  value={selectedMonth?.toString() || ""}
                  onValueChange={(v) => setSelectedMonth(parseInt(v))}
                  disabled={checkingAvailability || availableMonths.length === 0}
                >
                  <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20">
                    <SelectValue placeholder={availableMonths.length === 0 ? "Nenhum mes disponivel" : "Selecione..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {months
                      .filter(month => availableMonths.includes(month.value))
                      .map(month => (
                        <SelectItem key={month.value} value={month.value.toString()}>
                          {month.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {availableMonths.length === 0 && !checkingAvailability && (
                  <p className="text-xs text-cyber-400 mt-1">Autos so podem ser emitidos apos o dia 22 do mes seguinte</p>
                )}
              </div>
              <div>
                <Label className="text-slate-300">Ano</Label>
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
            </div>
            <div className="bg-cyber-500/10 border border-cyber-500/20 rounded-lg p-4">
              <p className="text-sm text-cyber-400">
                Sera criado um ficheiro Excel com uma aba para cada parceiro que tenha vendas pagas no periodo selecionado.
              </p>
            </div>
            <Button
              onClick={() => generateCommissionReport(null)}
              disabled={!selectedMonth || loading || checkingAvailability}
              className="w-full bg-gradient-to-r from-cyber-500 to-cyber-600 text-white hover:from-cyber-600 hover:to-cyber-700"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Gerar Todos os Autos
            </Button>
          </CardContent>
        </Card>
      </div>

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
          <p>-- Autos so podem ser emitidos apos o dia 22 do mes seguinte (ex: auto de Novembro so apos 22 de Dezembro)</p>
          <p>-- Apenas vendas com data de ativacao no periodo selecionado e pagas pelo operador sao incluidas</p>
          <p>-- Vendas ja incluidas em autos validados como pagos nao serao duplicadas em novos autos do mesmo mes</p>

          <p className="pt-2"><strong className="text-white">Processo:</strong></p>
          <p>-- Selecione o mes e ano disponiveis para gerar o auto</p>
          <p>-- Clique em "Pre-visualizar" para rever o auto antes de aprovar</p>
          <p>-- No popup, clique em "Aprovar e Registrar Auto" para registar e enviar email ao parceiro</p>

          <p className="pt-2"><strong className="text-white">Validacao de Pagamento:</strong></p>
          <p>-- Apos receber o pagamento do parceiro, valide o auto clicando no botao verde</p>
          <p>-- Autos validados ficam bloqueados e nao podem ser eliminados ou editados</p>
          <p>-- A listagem filtra automaticamente pelo ultimo mes emitido</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default CommissionReports;
