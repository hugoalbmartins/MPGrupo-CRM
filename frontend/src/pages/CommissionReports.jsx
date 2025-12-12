import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { partnersService } from "../services/partnersService";
import { salesService } from "../services/salesService";
import * as XLSX from 'xlsx';

const CommissionReports = ({ user }) => {
  const [partners, setPartners] = useState([]);
  const [selectedPartner, setSelectedPartner] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);

  const companyInfo = {
    name: "Marcio & Sandra lda",
    address: "Avenida rainha Santa Isabel lote 8 loja 1, 5000-434 Vila Real",
    nif: "518162796"
  };

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

  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const getAvailableYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear; i >= currentYear - 5; i--) {
      years.push(i);
    }
    return years;
  };

  const generateCommissionReport = async (partnerId) => {
    try {
      setLoading(true);

      const allSales = await salesService.getAll();

      const filteredSales = allSales.filter(sale => {
        const saleDate = new Date(sale.date);
        const saleMonth = saleDate.getMonth() + 1;
        const saleYear = saleDate.getFullYear();

        const matchesPartner = !partnerId || sale.partner_id === partnerId;
        const matchesDate = saleMonth === selectedMonth && saleYear === selectedYear;
        const isPaid = sale.paid_by_operator === true;

        return matchesPartner && matchesDate && isPaid;
      });

      if (filteredSales.length === 0) {
        toast.error("Nenhuma venda encontrada com os critérios selecionados");
        return;
      }

      const partner = partners.find(p => p.id === partnerId);
      const partnerName = partner?.name || "Todos os Parceiros";

      const workbook = XLSX.utils.book_new();

      const headerRows = [
        [companyInfo.name],
        [companyInfo.address],
        [`NIF: ${companyInfo.nif}`],
        [],
        [`AUTO DE COMISSÕES - ${months[selectedMonth - 1]} ${selectedYear}`],
        [`Parceiro: ${partnerName}`],
        [],
        ["Nome Cliente", "NIF Cliente", "CPE", "CUI", "REQ", "Data Ativação", "Valor (€)"]
      ];

      const dataRows = filteredSales.map(sale => [
        sale.client_name || "",
        sale.client_nif || "",
        sale.cpe || "",
        sale.cui || "",
        sale.requisition || "",
        sale.paid_date ? new Date(sale.paid_date).toLocaleDateString('pt-PT') : "",
        sale.commission || 0
      ]);

      const totalCommission = filteredSales.reduce((sum, sale) => sum + (sale.commission || 0), 0);
      const iva = totalCommission * 0.23;
      const totalWithIva = totalCommission + iva;

      const summaryRows = [
        [],
        ["", "", "", "", "", "Total:", totalCommission.toFixed(2)],
        ["", "", "", "", "", "IVA (23%):", iva.toFixed(2)],
        ["", "", "", "", "", "Total c/ IVA:", totalWithIva.toFixed(2)]
      ];

      const allRows = [...headerRows, ...dataRows, ...summaryRows];
      const worksheet = XLSX.utils.aoa_to_sheet(allRows);

      worksheet['!cols'] = [
        { wch: 30 },
        { wch: 15 },
        { wch: 20 },
        { wch: 20 },
        { wch: 15 },
        { wch: 15 },
        { wch: 12 }
      ];

      const range = XLSX.utils.decode_range(worksheet['!ref']);
      for (let R = 0; R <= 2; R++) {
        for (let C = 0; C <= 6; C++) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          if (!worksheet[cellAddress]) worksheet[cellAddress] = { t: 's', v: '' };
          worksheet[cellAddress].s = {
            font: { bold: true, sz: 12 },
            alignment: { horizontal: 'left' }
          };
        }
      }

      const titleRow = 4;
      for (let C = 0; C <= 6; C++) {
        const cellAddress = XLSX.utils.encode_cell({ r: titleRow, c: C });
        if (!worksheet[cellAddress]) worksheet[cellAddress] = { t: 's', v: '' };
        worksheet[cellAddress].s = {
          font: { bold: true, sz: 14 },
          alignment: { horizontal: 'center' }
        };
      }

      const headerRow = 7;
      for (let C = 0; C <= 6; C++) {
        const cellAddress = XLSX.utils.encode_cell({ r: headerRow, c: C });
        if (!worksheet[cellAddress]) worksheet[cellAddress] = { t: 's', v: '' };
        worksheet[cellAddress].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: "CCCCCC" } },
          alignment: { horizontal: 'center' }
        };
      }

      XLSX.utils.book_append_sheet(workbook, worksheet, "Auto de Comissões");

      const fileName = `Auto_Comissoes_${partnerName.replace(/\s+/g, '_')}_${months[selectedMonth - 1]}_${selectedYear}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast.success("Auto de comissões gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
      toast.error("Erro ao gerar auto de comissões");
    } finally {
      setLoading(false);
    }
  };

  const generateAllReports = async () => {
    try {
      setLoading(true);

      const allSales = await salesService.getAll();

      const partnersWithSales = new Set(
        allSales
          .filter(sale => {
            const saleDate = new Date(sale.date);
            const saleMonth = saleDate.getMonth() + 1;
            const saleYear = saleDate.getFullYear();
            return saleMonth === selectedMonth && saleYear === selectedYear && sale.paid_by_operator === true;
          })
          .map(sale => sale.partner_id)
      );

      if (partnersWithSales.size === 0) {
        toast.error("Nenhuma venda paga encontrada para o período selecionado");
        return;
      }

      for (const partnerId of partnersWithSales) {
        await generateCommissionReport(partnerId);
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      toast.success(`${partnersWithSales.size} auto(s) de comissões gerados com sucesso!`);
    } catch (error) {
      console.error("Erro ao gerar relatórios:", error);
      toast.error("Erro ao gerar autos de comissões");
    } finally {
      setLoading(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Acesso restrito a administradores</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Autos de Comissões</h1>
      </div>

      <Card className="p-6">
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Informações Importantes</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>Os autos de comissões incluem apenas vendas marcadas como pagas pelo operador</li>
              <li>O relatório contém: nome do cliente, NIF, CPE, CUI, REQ (quando existentes), data de ativação e valor</li>
              <li>São calculados automaticamente: Total, IVA (23%) e Total com IVA</li>
              <li>Pode gerar autos individuais por parceiro ou massivamente para todos os parceiros com vendas pagas</li>
            </ul>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Mês</Label>
              <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month, index) => (
                    <SelectItem key={index + 1} value={(index + 1).toString()}>
                      {month}
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
                  {getAvailableYears().map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Parceiro (Individual)</Label>
              <Select value={selectedPartner} onValueChange={setSelectedPartner}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um parceiro..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {partners.map(partner => (
                    <SelectItem key={partner.id} value={partner.id}>
                      {partner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-4 pt-4 border-t">
            <Button
              onClick={() => selectedPartner ? generateCommissionReport(selectedPartner) : toast.error("Selecione um parceiro")}
              disabled={loading || !selectedPartner}
              className="btn-primary"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              {loading ? "Gerando..." : "Gerar Auto Individual"}
            </Button>

            <Button
              onClick={generateAllReports}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              {loading ? "Gerando..." : "Gerar Todos os Autos"}
            </Button>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700">
            <p className="font-semibold mb-2">Informações da Empresa (incluídas no auto):</p>
            <p>{companyInfo.name}</p>
            <p>{companyInfo.address}</p>
            <p>NIF: {companyInfo.nif}</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default CommissionReports;
