import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Download, FileText, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { commissionReportsService } from "../services/commissionReportsService";

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const CommissionReportsPartner = ({ user }) => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([]);

  useEffect(() => {
    if (user?.partner_id) {
      fetchReports();
    } else {
      setLoading(false);
      setReports([]);
    }
  }, [user, selectedYear]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const data = await commissionReportsService.getByPartnerId(user.partner_id, selectedYear);
      setReports(data);

      const years = [...new Set(data.map(r => r.year))];
      setAvailableYears(years.sort((a, b) => b - a));
    } catch (error) {
      console.error("Erro ao carregar autos:", error);
      toast.error("Erro ao carregar autos de comissao");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (report) => {
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user?.partner_id) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Autos de Comissao</h1>
          <p className="text-dark-300 mt-2">Consulte e faca download dos seus autos de comissao emitidos</p>
        </div>
        <div className="glass-ultra p-12">
          <div className="text-center">
            <FileText className="w-16 h-16 text-orange-400/50 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              Configuracao Pendente
            </h3>
            <p className="text-dark-300 max-w-md mx-auto">
              O seu utilizador ainda nao esta associado a um parceiro no sistema. Por favor, contacte o administrador para concluir a configuracao da sua conta.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Autos de Comissao</h1>
          <p className="text-dark-300 mt-2">Consulte e faca download dos seus autos de comissao emitidos</p>
        </div>

        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-dark-400" />
          <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
            <SelectTrigger className="w-32 glass-input">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.length > 0 ? (
                availableYears.map(year => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value={new Date().getFullYear().toString()}>
                  {new Date().getFullYear()}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="glass-ultra p-12">
          <div className="text-center">
            <FileText className="w-16 h-16 text-dark-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              Nenhum auto disponivel
            </h3>
            <p className="text-dark-300">
              Nao existem autos de comissao emitidos para o ano selecionado
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map(report => (
            <div key={report.id} className="glass-ultra p-6 hover:border-gold-400/30 transition-all">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">{MONTHS[report.month - 1]} {report.year}</h3>
                <span className="text-sm text-dark-400">V{report.version}</span>
              </div>

              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-dark-400">Emitido em:</span>
                  <span className="font-medium text-dark-200">{formatDate(report.created_at)}</span>
                </div>
                {report.emailed_at && (
                  <div className="flex justify-between">
                    <span className="text-dark-400">Email enviado:</span>
                    <span className="font-medium text-green-400">Sim</span>
                  </div>
                )}
                {report.creator && (
                  <div className="flex justify-between">
                    <span className="text-dark-400">Emitido por:</span>
                    <span className="font-medium text-dark-200">{report.creator.name}</span>
                  </div>
                )}
              </div>

              <Button
                onClick={() => handleDownload(report)}
                className="btn-gold w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CommissionReportsPartner;
