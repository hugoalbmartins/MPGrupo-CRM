import React, { useState } from "react";
import { toast } from "sonner";
import { Upload, Download, FileSpreadsheet, X, CheckCircle2, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { salesService } from "../services/salesService";
import * as ProgressPrimitive from "@radix-ui/react-progress";

const SalesImport = ({ open, onOpenChange, onImportComplete }) => {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);

  if (!open) {
    return null;
  }

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
        toast.error("Por favor, selecione um ficheiro Excel (.xlsx ou .xls)");
        return;
      }
      setFile(selectedFile);
      setResults(null);
    }
  };

  const parseDate = (dateStr) => {
    if (!dateStr) return null;

    if (dateStr instanceof Date) {
      return dateStr.toISOString().split('T')[0];
    }

    const str = String(dateStr).trim();
    if (!str) return null;

    const formats = [
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
      /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/,
    ];

    for (const format of formats) {
      const match = str.match(format);
      if (match) {
        let day, month, year;

        if (format.source.startsWith('^(\\d{4})')) {
          [, year, month, day] = match;
        } else {
          [, day, month, year] = match;
        }

        day = parseInt(day, 10);
        month = parseInt(month, 10);
        year = parseInt(year, 10);

        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          const date = new Date(year, month - 1, day);
          if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          }
        }
      }
    }

    const excelDate = parseFloat(str);
    if (!isNaN(excelDate) && excelDate > 25569 && excelDate < 73050) {
      const date = new Date((excelDate - 25569) * 86400 * 1000);
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth() + 1;
      const day = date.getUTCDate();
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    return null;
  };

  const parseBooleanValue = (value) => {
    if (typeof value === 'boolean') return value;
    const str = String(value).trim().toLowerCase();
    return str === 'sim' || str === 'yes' || str === 'true' || str === '1';
  };

  const parseNumericValue = (value) => {
    if (!value) return null;
    const str = String(value).replace(/[€\s]/g, '').replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  };

  const normalizeEnergySaleType = (value) => {
    if (!value) return null;

    const str = String(value).trim().toLowerCase();
    if (!str) return null;

    const normalized = str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (normalized === 'eletricidade' || normalized === 'electricidade' || normalized === 'eletrico' || normalized === 'electrico') {
      return 'eletricidade';
    }

    if (normalized === 'gas' || normalized === 'gás') {
      return 'gas';
    }

    if (normalized === 'dual') {
      return 'dual';
    }

    return null;
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Selecione um ficheiro para importar");
      return;
    }

    setImporting(true);
    setProgress(0);
    setResults(null);

    try {
      const XLSX = await import('xlsx');
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        toast.error("O ficheiro não contém dados");
        setImporting(false);
        return;
      }

      const successfulImports = [];
      const failedImports = [];
      let processedCount = 0;

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const rowNumber = i + 2;

        try {
          const saleData = {
            date: parseDate(row['Data']),
            partner_id: row['ID Parceiro'],
            scope: row['Âmbito'],
            client_type: row['Tipo Cliente'],
            client_name: row['Nome Cliente'],
            client_nif: row['NIF'],
            client_contact: row['Contacto'],
            client_email: row['Email'] || null,
            client_iban: row['IBAN'] || null,
            has_direct_debit: parseBooleanValue(row['Débito Direto']),
            has_electronic_invoice: parseBooleanValue(row['Fatura Eletrónica']),
            street: row['Morada'] || null,
            postal_code: row['Código Postal'] || null,
            locality: row['Localidade'] || null,
            installation_address: row['Morada Instalação'] || null,
            operator_id: row['ID Operadora'],
            service_type: row['Tipo Serviço'] || null,
            activation_type: row['Tipo Ativação'] || null,
            monthly_value: parseNumericValue(row['Valor Mensal']),
            energy_sale_type: normalizeEnergySaleType(row['Tipo Venda Energia']),
            paid_to_operator: parseBooleanValue(row['Paga Operador']),
            payment_date: parseDate(row['Data Pagamento']),
            cpe: row['CPE'] || null,
            power: row['Potência'] || null,
            cui: row['CUI'] || null,
            tier: row['Escalão'] || null,
            entry_type: row['Tipo Entrada'] || null,
            status: row['Status'] || 'pendente',
            request_number: row['Nº Requisição'] || null,
            observations: row['Observações'] || null,
          };

          if (!saleData.date) {
            throw new Error("Data inválida ou em falta");
          }
          if (!saleData.partner_id) {
            throw new Error("ID Parceiro em falta");
          }
          if (!saleData.scope) {
            throw new Error("Âmbito em falta");
          }
          if (!saleData.client_type) {
            throw new Error("Tipo Cliente em falta");
          }
          if (!saleData.client_name) {
            throw new Error("Nome Cliente em falta");
          }
          if (!saleData.client_nif) {
            throw new Error("NIF em falta");
          }
          if (!saleData.client_contact) {
            throw new Error("Contacto em falta");
          }
          if (!saleData.operator_id) {
            throw new Error("ID Operadora em falta");
          }

          const result = await salesService.createSale(saleData);

          successfulImports.push({
            row: rowNumber,
            clientName: saleData.client_name,
            saleCode: result.sale_code
          });

        } catch (error) {
          console.error(`Erro na linha ${rowNumber}:`, error);
          failedImports.push({
            row: rowNumber,
            clientName: row['Nome Cliente'] || 'N/A',
            error: error.message
          });
        }

        processedCount++;
        setProgress((processedCount / jsonData.length) * 100);
      }

      setResults({
        total: jsonData.length,
        successful: successfulImports.length,
        failed: failedImports.length,
        successfulImports,
        failedImports
      });

      if (successfulImports.length > 0) {
        toast.success(`${successfulImports.length} vendas importadas com sucesso!`);
        if (onImportComplete) {
          onImportComplete();
        }
      }

      if (failedImports.length > 0) {
        toast.error(`${failedImports.length} vendas falharam na importação`);
      }

    } catch (error) {
      console.error('Erro ao importar ficheiro:', error);
      toast.error(`Erro ao processar ficheiro: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const XLSX = await import('xlsx');

      const templateData = [{
        'Data': '',
        'ID Parceiro': '',
        'Âmbito': '',
        'Tipo Cliente': '',
        'Nome Cliente': '',
        'NIF': '',
        'Contacto': '',
        'Email': '',
        'IBAN': '',
        'Débito Direto': '',
        'Fatura Eletrónica': '',
        'Morada': '',
        'Código Postal': '',
        'Localidade': '',
        'Morada Instalação': '',
        'ID Operadora': '',
        'Tipo Serviço': '',
        'Tipo Ativação': '',
        'Valor Mensal': '',
        'Tipo Venda Energia': '',
        'Paga Operador': '',
        'Data Pagamento': '',
        'CPE': '',
        'Potência': '',
        'CUI': '',
        'Escalão': '',
        'Tipo Entrada': '',
        'Status': '',
        'Nº Requisição': '',
        'Observações': ''
      }];

      const ws = XLSX.utils.json_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Vendas");

      XLSX.writeFile(wb, `template_importacao_vendas.xlsx`);
      toast.success("Template descarregado com sucesso");
    } catch (error) {
      console.error('Erro ao criar template:', error);
      toast.error("Erro ao descarregar template");
    }
  };

  const handleClose = () => {
    setFile(null);
    setResults(null);
    setProgress(0);
    onOpenChange(false);
  };

  const downloadResultsReport = async () => {
    if (!results) return;

    try {
      const XLSX = await import('xlsx');

      const reportData = [];

      if (results.successfulImports.length > 0) {
        reportData.push({ 'Tipo': 'VENDAS IMPORTADAS COM SUCESSO', 'Linha': '', 'Cliente': '', 'Código Venda': '', 'Erro': '' });
        results.successfulImports.forEach(item => {
          reportData.push({
            'Tipo': 'Sucesso',
            'Linha': item.row,
            'Cliente': item.clientName,
            'Código Venda': item.saleCode,
            'Erro': ''
          });
        });
        reportData.push({ 'Tipo': '', 'Linha': '', 'Cliente': '', 'Código Venda': '', 'Erro': '' });
      }

      if (results.failedImports.length > 0) {
        reportData.push({ 'Tipo': 'VENDAS COM ERRO', 'Linha': '', 'Cliente': '', 'Código Venda': '', 'Erro': '' });
        results.failedImports.forEach(item => {
          reportData.push({
            'Tipo': 'Erro',
            'Linha': item.row,
            'Cliente': item.clientName,
            'Código Venda': '',
            'Erro': item.error
          });
        });
      }

      const ws = XLSX.utils.json_to_sheet(reportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Relatório");

      const timestamp = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `relatorio_importacao_${timestamp}.xlsx`);
      toast.success("Relatório descarregado com sucesso");
    } catch (error) {
      console.error('Erro ao criar relatório:', error);
      toast.error("Erro ao descarregar relatório");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importação de Vendas
          </DialogTitle>
          <DialogDescription>
            Importe vendas em massa através de um ficheiro Excel
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Template de Importação</h3>
                <p className="text-sm text-gray-500">
                  Descarregue o template base com as colunas necessárias
                </p>
              </div>
              <Button
                variant="outline"
                onClick={downloadTemplate}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Descarregar Template
              </Button>
            </div>

            <Alert>
              <FileSpreadsheet className="h-4 w-4" />
              <AlertDescription>
                <strong>Instruções:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                  <li>Descarregue o template e preencha os dados das vendas</li>
                  <li>O ID Parceiro e ID Operadora devem ser os IDs existentes no sistema</li>
                  <li>As datas podem estar em qualquer formato (DD/MM/AAAA, AAAA-MM-DD, etc.)</li>
                  <li>Paga Operador deve ser "Sim" ou "Não"</li>
                  <li>Campos opcionais podem ficar em branco</li>
                  <li>Se houver erros em algumas linhas, as restantes serão importadas</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>

          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                disabled={importing}
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <FileSpreadsheet className="h-12 w-12 text-gray-400" />
                {file ? (
                  <div className="space-y-1">
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      Clique para selecionar outro ficheiro
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="font-medium">Clique para selecionar ficheiro</p>
                    <p className="text-sm text-gray-500">
                      Formatos suportados: .xlsx, .xls
                    </p>
                  </div>
                )}
              </label>
            </div>

            {importing && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>A importar vendas...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <ProgressPrimitive.Root
                  className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200"
                  value={progress}
                >
                  <ProgressPrimitive.Indicator
                    className="h-full w-full flex-1 bg-blue-600 transition-all"
                    style={{ transform: `translateX(-${100 - (progress || 0)}%)` }}
                  />
                </ProgressPrimitive.Root>
              </div>
            )}

            {results && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600">{results.total}</div>
                    <div className="text-sm text-blue-600">Total</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600">{results.successful}</div>
                    <div className="text-sm text-green-600">Sucesso</div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-red-600">{results.failed}</div>
                    <div className="text-sm text-red-600">Erros</div>
                  </div>
                </div>

                {results.successfulImports.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      Vendas Importadas ({results.successfulImports.length})
                    </h4>
                    <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-1">
                      {results.successfulImports.map((item, idx) => (
                        <div key={idx} className="text-sm flex justify-between">
                          <span>Linha {item.row}: {item.clientName}</span>
                          <span className="text-gray-500">{item.saleCode}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {results.failedImports.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2 text-red-600">
                      <AlertCircle className="h-4 w-4" />
                      Vendas com Erro ({results.failedImports.length})
                    </h4>
                    <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-1">
                      {results.failedImports.map((item, idx) => (
                        <div key={idx} className="text-sm space-y-1">
                          <div className="flex justify-between">
                            <span className="font-medium">Linha {item.row}: {item.clientName}</span>
                          </div>
                          <div className="text-red-600 text-xs pl-4">{item.error}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  onClick={downloadResultsReport}
                  variant="outline"
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Descarregar Relatório Completo
                </Button>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose} disabled={importing}>
              Fechar
            </Button>
            <Button
              onClick={handleImport}
              disabled={!file || importing}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              {importing ? 'A Importar...' : 'Importar Vendas'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SalesImport;
