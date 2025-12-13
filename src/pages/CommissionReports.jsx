import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { FileDown, Download, FileText, Trash2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { partnersService } from "../services/partnersService";
import { salesService } from "../services/salesService";
import { commissionReportsService } from "../services/commissionReportsService";
import { supabase } from "../lib/supabase";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const CommissionReports = ({ user }) => {
  const [partners, setPartners] = useState([]);
  const [selectedPartner, setSelectedPartner] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [emittedReports, setEmittedReports] = useState([]);
  const [showReportsDialog, setShowReportsDialog] = useState(false);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

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
    fetchPartners();
    fetchEmittedReports();
  }, [filterYear]);

  const fetchPartners = async () => {
    try {
      const data = await partnersService.getAll();
      setPartners(data);
    } catch (error) {
      toast.error("Erro ao carregar parceiros");
    }
  };

  const fetchEmittedReports = async () => {
    try {
      const data = await commissionReportsService.getAll(filterYear);
      setEmittedReports(data);
    } catch (error) {
      console.error("Erro ao carregar autos emitidos:", error);
    }
  };

  const registerCommissionReport = async (partnerId) => {
    try {
      const partner = partners.find(p => p.id === partnerId);
      if (!partner) {
        toast.error("Parceiro não encontrado");
        return;
      }

      const monthName = months.find(m => m.value === selectedMonth)?.label;
      const version = await commissionReportsService.getNextVersion(partnerId, selectedMonth, selectedYear);

      const fileName = `${partner.name}_Auto_${monthName}_${selectedYear}_V${version}.pdf`;
      const filePath = `${partnerId}/${selectedYear}/${fileName}`;

      const reportData = {
        partner_id: partnerId,
        month: selectedMonth,
        year: selectedYear,
        version: version,
        file_name: fileName,
        file_path: filePath,
        created_by: user.id
      };

      const newReport = await commissionReportsService.create(reportData);

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-commission-report-email`;
      await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          partnerEmail: partner.email,
          partnerName: partner.name,
          month: monthName,
          year: selectedYear,
          reportId: newReport.id
        })
      });

      await commissionReportsService.markAsEmailed(newReport.id);

      toast.success(`Auto registrado e email enviado para ${partner.name}`);
      fetchEmittedReports();
    } catch (error) {
      console.error("Erro ao registrar auto:", error);
      toast.error("Erro ao registrar auto de comissão");
    }
  };

  const handleDeleteReport = async (reportId) => {
    if (!window.confirm("Tem certeza que deseja eliminar este auto?")) return;

    try {
      await commissionReportsService.delete(reportId);
      toast.success("Auto eliminado com sucesso");
      fetchEmittedReports();
    } catch (error) {
      toast.error("Erro ao eliminar auto");
    }
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
    console.log(`Filtrando vendas para ${selectedMonth}/${selectedYear}`);

    return sales.filter(sale => {
      const dateField = sale.activation_date || sale.paid_date || sale.date;

      if (!dateField) {
        console.log(`Venda ${sale.sale_code} sem nenhuma data`);
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

      const matches = saleMonth === selectedMonth && saleYear === selectedYear;

      console.log(`Venda ${sale.sale_code}: ${dateField} -> ${saleMonth}/${saleYear} - Match: ${matches}`);

      return matches;
    });
  };

  const printCommissionReport = async (partnerId) => {
    setLoading(true);
    try {
      const allSales = await salesService.getAll();
      const paidSales = allSales.filter(sale => sale.paid_to_operator === true);
      const filteredByMonth = filterSalesByMonth(paidSales);
      const finalSales = filteredByMonth.filter(s => s.partner_id === partnerId);

      const partner = partners.find(p => p.id === partnerId);
      if (!partner) {
        toast.error("Parceiro não encontrado");
        setLoading(false);
        return;
      }

      if (finalSales.length === 0) {
        const monthName = months.find(m => m.value === selectedMonth)?.label;
        toast.error(`Não existem vendas pagas para ${partner.name} no mês de ${monthName}/${selectedYear}`);
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

      printWindow.reportData = {
        partnerId,
        partnerName: partner.name,
        partnerEmail: partner.email,
        month: selectedMonth,
        monthName,
        year: selectedYear,
        userId: user.id,
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
        supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY
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
            <td>${sale.cpe || '-'}</td>
            <td>${sale.cui || '-'}</td>
            <td>${sale.request_number || '-'}</td>
            <td>${sale.activation_date ? new Date(sale.activation_date).toLocaleDateString('pt-PT') : '-'}</td>
            <td>${sale.has_direct_debit ? 'Sim' : 'Não'}</td>
            <td>${sale.has_electronic_invoice ? 'Sim' : 'Não'}</td>
            <td style="text-align: right">€${totalComm.toFixed(2)}</td>
          </tr>
        `;
      }).join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Auto de Comissões - ${partner.name} - ${monthName}/${selectedYear}</title>
          <style>
            @media print {
              @page { margin: 15mm; }
              body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            }
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              color: #333;
            }
            .header {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              margin-bottom: 30px;
              border-bottom: 3px solid #1F4E78;
              padding-bottom: 15px;
            }
            .header-left {
              flex: 1;
            }
            .header-logo {
              flex-shrink: 0;
              margin-left: 20px;
            }
            .header-logo img {
              height: 60px;
              width: auto;
            }
            .company-name {
              font-size: 18px;
              font-weight: bold;
              color: #1F4E78;
              margin-bottom: 5px;
            }
            .company-details {
              font-size: 11px;
              color: #666;
              line-height: 1.5;
            }
            .title {
              font-size: 20px;
              font-weight: bold;
              color: #1F4E78;
              text-align: center;
              margin: 25px 0;
              padding: 10px;
              background-color: #f0f4f8;
              border-radius: 5px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
              font-size: 11px;
            }
            th {
              background-color: #1F4E78;
              color: white;
              padding: 10px 8px;
              text-align: left;
              font-weight: bold;
              font-size: 11px;
            }
            td {
              padding: 8px;
              border: 1px solid #ddd;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .total-row {
              background-color: #e8f0f7 !important;
              font-weight: bold;
              font-size: 13px;
            }
            .total-row td {
              border-top: 2px solid #1F4E78;
            }
            .footer {
              margin-top: 40px;
              text-align: right;
              font-size: 10px;
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
            AUTO DE COMISSÕES - ${partner.name} - ${monthName}/${selectedYear}
          </div>

          <table>
            <thead>
              <tr>
                <th>Nome Cliente</th>
                <th>NIF</th>
                <th>CPE</th>
                <th>CUI</th>
                <th>REQ</th>
                <th>Data Ativação</th>
                <th>DD</th>
                <th>FE</th>
                <th style="text-align: right">Valor (€)</th>
              </tr>
            </thead>
            <tbody>
              ${salesRows}
              <tr class="total-row">
                <td colspan="8" style="text-align: right">TOTAL:</td>
                <td style="text-align: right">€${total.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <div class="footer">
            Documento gerado em ${new Date().toLocaleDateString('pt-PT')} às ${new Date().toLocaleTimeString('pt-PT')}
          </div>

          <div class="no-print" style="display: flex; gap: 10px; margin-top: 20px; justify-content: center;">
            <button id="approveBtn" onclick="approveAndRegister()" style="padding: 10px 20px; font-size: 16px; cursor: pointer; background-color: #10b981; color: white; border: none; border-radius: 5px;">
              ✅ Aprovar e Registrar Auto
            </button>
            <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer; background-color: #1F4E78; color: white; border: none; border-radius: 5px;">
              🖨️ Imprimir
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
                  btn.textContent = '✅ Aprovar e Registrar Auto';
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
                  btn.textContent = '⚠️ Tentar Registar (bibliotecas não carregadas)';
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
                approveBtn.textContent = '⏳ Carregando bibliotecas...';
                approveBtn.style.opacity = '0.6';
              }
              checkLibraries();
            });

            async function approveAndRegister() {
              const btn = document.getElementById('approveBtn');

              if (typeof window.jspdf === 'undefined' || typeof html2canvas === 'undefined') {
                alert('Bibliotecas não carregadas. A funcionalidade pode não funcionar corretamente. Deseja continuar mesmo assim?');
                if (!confirm('Continuar sem bibliotecas carregadas?')) {
                  return;
                }
              }

              btn.disabled = true;
              btn.textContent = '⏳ Processando...';

              try {
                console.log('Starting PDF generation...');

                if (typeof window.jspdf === 'undefined') {
                  throw new Error('jsPDF library not loaded');
                }
                if (typeof html2canvas === 'undefined') {
                  throw new Error('html2canvas library not loaded');
                }

                const { jsPDF } = window.jspdf;
                const element = document.body;

                console.log('Capturing screenshot with html2canvas...');
                const canvas = await html2canvas(element, {
                  scale: 2,
                  useCORS: true,
                  logging: false,
                  allowTaint: true
                });

                console.log('Canvas created, generating PDF...');
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                console.log('PDF generated, converting to blob...');
                const pdfBlob = pdf.output('blob');
                console.log('PDF blob created, size:', pdfBlob.size);

                const data = window.reportData;

                console.log('Sending data to edge function:', {
                  partnerId: data.partnerId,
                  partnerEmail: data.partnerEmail,
                  partnerName: data.partnerName,
                  month: data.month,
                  year: data.year,
                  userId: data.userId,
                  pdfSize: pdfBlob.size
                });

                const response = await fetch(\`\${data.supabaseUrl}/functions/v1/send-commission-report-email\`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': \`Bearer \${data.supabaseKey}\`
                  },
                  body: JSON.stringify({
                    partnerId: data.partnerId,
                    partnerEmail: data.partnerEmail,
                    partnerName: data.partnerName,
                    month: data.month,
                    year: data.year,
                    userId: data.userId,
                    pdfBase64: await blobToBase64(pdfBlob)
                  })
                });

                console.log('Response status:', response.status);

                if (!response.ok) {
                  const errorText = await response.text();
                  console.error('Response error text:', errorText);
                  let errorData;
                  try {
                    errorData = JSON.parse(errorText);
                    console.error('Parsed error data:', errorData);
                  } catch (e) {
                    console.error('Failed to parse error:', e);
                    throw new Error(\`Erro do servidor (${response.status}): \${errorText.substring(0, 200)}\`);
                  }
                  throw new Error(errorData.error || \`Erro ao registrar auto (${response.status})\`);
                }

                const result = await response.json();
                console.log('Success response:', result);

                alert('Auto aprovado e registrado com sucesso! Email enviado ao parceiro.');
                if (window.opener) {
                  window.opener.location.reload();
                }
                window.close();
              } catch (error) {
                console.error('Full error:', error);
                alert('Erro ao processar auto: ' + error.message);
                btn.disabled = false;
                btn.textContent = '✅ Aprovar e Registrar Auto';
              }
            }

            function blobToBase64(blob) {
              return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
            }
          </script>
        </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      toast.success(`Auto de comissões de ${partner.name} aberto em nova janela`);
    } catch (error) {
      toast.error("Erro ao gerar auto para impressão");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const generateCommissionReport = async (partnerId = null) => {
    setLoading(true);
    try {
      const allSales = await salesService.getAll();
      console.log(`Total de vendas: ${allSales.length}`);

      const paidSales = allSales.filter(sale => sale.paid_to_operator === true);
      console.log(`Vendas pagas pelo operador: ${paidSales.length}`);

      if (paidSales.length > 0) {
        console.log('Exemplo de venda paga:', {
          sale_code: paidSales[0].sale_code,
          activation_date: paidSales[0].activation_date,
          paid_date: paidSales[0].paid_date,
          date: paidSales[0].date,
          paid_to_operator: paidSales[0].paid_to_operator
        });
      }

      const filteredByMonth = filterSalesByMonth(paidSales);
      console.log(`Vendas após filtro de mês: ${filteredByMonth.length}`);

      const finalSales = partnerId
        ? filteredByMonth.filter(s => s.partner_id === partnerId)
        : filteredByMonth;

      console.log(`Vendas finais: ${finalSales.length}`);

      if (finalSales.length === 0) {
        const monthName = months.find(m => m.value === selectedMonth)?.label;
        toast.error(`Não existem vendas pagas para o mês de ${monthName}/${selectedYear}`);
        setLoading(false);
        return;
      }

      const XLSX = await import('xlsx');

      if (partnerId) {
        await generateSinglePartnerReport(partnerId, finalSales, XLSX);
      } else {
        await generateAllPartnersReport(finalSales, XLSX);
      }

      toast.success("Auto de comissões gerado com sucesso!");
    } catch (error) {
      toast.error("Erro ao gerar auto de comissões");
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
    data.push([`AUTO DE COMISSÕES - ${partner.name} - ${monthName}/${selectedYear}`]);
    data.push([]);
    data.push([]);

    data.push(['Nome Cliente', 'NIF', 'CPE', 'CUI', 'REQ', 'Data Ativação', 'Valor (€)']);

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
    data.push(['', '', '', '', '', 'Total:', total.toFixed(2)]);
    data.push(['', '', '', '', '', 'IVA (23%):', (total * 0.23).toFixed(2)]);
    data.push(['', '', '', '', '', 'Total c/ IVA:', (total * 1.23).toFixed(2)]);

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

    ws['A1'].v = '📊 MARCIO & SANDRA LDA';
    ws['A1'].t = 's';

    return ws;
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Acesso negado. Apenas administradores podem aceder a esta página.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Autos de Comissões</h1>
          <p className="text-gray-600 mt-1">Gere autos de comissões para parceiros (apenas vendas pagas)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileDown className="w-5 h-5 text-blue-600" />
              Auto Individual
            </CardTitle>
            <CardDescription>
              Gere auto de comissões para um parceiro específico
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Selecionar Parceiro</Label>
              <Select value={selectedPartner} onValueChange={setSelectedPartner}>
                <SelectTrigger>
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
                <Label>Mês</Label>
                <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
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
                <Label>Ano</Label>
                <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                  <SelectTrigger>
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
                  disabled={!selectedPartner || loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  👁️ Pré-visualizar
                </Button>
                <Button
                  onClick={() => generateCommissionReport(selectedPartner)}
                  disabled={!selectedPartner || loading}
                  className="flex-1 btn-primary"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Excel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileDown className="w-5 h-5 text-green-600" />
              Autos de Todos os Parceiros
            </CardTitle>
            <CardDescription>
              Gere autos de comissões para todos os parceiros (um ficheiro com múltiplas abas)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Mês</Label>
                <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
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
                <Label>Ano</Label>
                <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                  <SelectTrigger>
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
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                Será criado um ficheiro Excel com uma aba para cada parceiro que tenha vendas pagas no período selecionado.
              </p>
            </div>
            <Button
              onClick={() => generateCommissionReport(null)}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Gerar Todos os Autos
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Autos Emitidos
            </CardTitle>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-600" />
              <Select value={filterYear.toString()} onValueChange={(v) => setFilterYear(parseInt(v))}>
                <SelectTrigger className="w-28">
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
          <CardDescription>
            Lista de todos os autos registrados no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {emittedReports.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p>Nenhum auto emitido para o ano selecionado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {emittedReports.map(report => (
                <div key={report.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">
                      {report.partner?.name || 'Parceiro Desconhecido'}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {months.find(m => m.value === report.month)?.label} {report.year} - Versão {report.version}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Emitido em {new Date(report.created_at).toLocaleDateString('pt-PT')} por {report.creator?.name || 'Sistema'}
                      {report.emailed_at && (
                        <span className="ml-2 text-green-600">• Email enviado</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownloadReport(report)}
                      title="Download PDF"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteReport(report.id)}
                      title="Eliminar"
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

      <Card>
        <CardHeader>
          <CardTitle>Informações Importantes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-600">
          <p>• Selecione o mês e ano para filtrar as vendas a incluir no auto</p>
          <p>• Apenas vendas com data de ativação no período selecionado e pagas pelo operador são incluídas</p>
          <p>• Os valores de comissão apresentados incluem o cálculo automático ou comissão manual definida</p>
          <p>• O auto inclui cabeçalho com dados da empresa (Marcio & Sandra lda)</p>
          <p>• Os totais incluem subtotal, IVA (23%) e total com IVA</p>
          <p>• Após gerar o auto, clique em "Registrar Auto Emitido" para notificar o parceiro por email</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default CommissionReports;
