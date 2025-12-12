import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Download, FileText, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { commissionReportsService } from "../services/commissionReportsService";

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
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
      toast.error("Erro ao carregar autos de comissão");
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Autos de Comissão</h1>
          <p className="text-gray-600 mt-2">Consulte e faça download dos seus autos de comissão emitidos</p>
        </div>

        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-gray-600" />
          <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
            <SelectTrigger className="w-32">
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
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Nenhum auto disponível
              </h3>
              <p className="text-gray-600">
                Não existem autos de comissão emitidos para o ano selecionado
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map(report => (
            <Card key={report.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-lg">
                  <span>{MONTHS[report.month - 1]} {report.year}</span>
                  <span className="text-sm font-normal text-gray-600">V{report.version}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Emitido em:</span>
                    <span className="font-medium">{formatDate(report.created_at)}</span>
                  </div>
                  {report.emailed_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Email enviado:</span>
                      <span className="font-medium text-green-600">Sim</span>
                    </div>
                  )}
                  {report.creator && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Emitido por:</span>
                      <span className="font-medium">{report.creator.name}</span>
                    </div>
                  )}
                </div>

                <Button
                  onClick={() => handleDownload(report)}
                  className="w-full"
                  variant="default"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default CommissionReportsPartner;
