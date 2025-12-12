import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { FileDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { partnersService } from "../services/partnersService";
import { salesService } from "../services/salesService";

const CommissionReports = ({ user }) => {
  const [partners, setPartners] = useState([]);
  const [selectedPartner, setSelectedPartner] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);

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
  }, []);

  const fetchPartners = async () => {
    try {
      const data = await partnersService.getAll();
      setPartners(data);
    } catch (error) {
      toast.error("Erro ao carregar parceiros");
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

    data.push(['MARCIO & SANDRA LDA']);
    data.push(['Avenida rainha Santa Isabel Lt 8 loja 1']);
    data.push(['5000-434 Vila Real']);
    data.push(['NIF: 518162796']);
    data.push([]);

    const monthName = months.find(m => m.value === selectedMonth)?.label;
    data.push([`AUTO DE COMISSÕES - ${partner.name} - ${monthName}/${selectedYear}`]);
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

        if (R === 0) {
          ws[cell_address].s = {
            font: { bold: true, sz: 14, color: { rgb: "1F4E78" } },
            alignment: { horizontal: "left", vertical: "center" }
          };
        }
        else if (R >= 1 && R <= 3) {
          ws[cell_address].s = {
            font: { sz: 10 },
            alignment: { horizontal: "left", vertical: "center" }
          };
        }
        else if (R === 5) {
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
    ws['!rows'][0] = { hpt: 20 };
    ws['!rows'][5] = { hpt: 25 };
    ws['!rows'][headerRow] = { hpt: 22 };

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
            <Button
              onClick={() => generateCommissionReport(selectedPartner)}
              disabled={!selectedPartner || loading}
              className="w-full btn-primary"
            >
              <Download className="w-4 h-4 mr-2" />
              Gerar Auto Individual
            </Button>
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
          <CardTitle>Informações Importantes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-600">
          <p>• Selecione o mês e ano para filtrar as vendas a incluir no auto</p>
          <p>• Apenas vendas com data de ativação no período selecionado e pagas pelo operador são incluídas</p>
          <p>• Os valores de comissão apresentados incluem o cálculo automático ou comissão manual definida</p>
          <p>• O auto inclui cabeçalho com dados da empresa (Marcio & Sandra lda)</p>
          <p>• Os totais incluem subtotal, IVA (23%) e total com IVA</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default CommissionReports;
