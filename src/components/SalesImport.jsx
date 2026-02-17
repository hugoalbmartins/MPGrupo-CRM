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
    const str = String(value).replace(/[\u20AC\s]/g, '').replace(',', '.');
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

    if (normalized === 'gas' || normalized === 'gas') {
      return 'gas';
    }

    if (normalized === 'dual') {
      return 'dual';
    }

    return null;
  };

  const normalizeScope = (value) => {
    if (!value) return null;

    const str = String(value).trim().toLowerCase();
    if (!str) return null;

    const normalized = str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (normalized.includes('telecomunicac') || normalized.includes('telco')) {
      return 'telecomunicacoes';
    }

    if (normalized === 'energia') {
      return 'energia';
    }

    if (normalized === 'solar') {
      return 'solar';
    }

    if (normalized === 'dual') {
      return 'dual';
    }

    return null;
  };

  const normalizeClientType = (value) => {
    if (!value) return null;

    const str = String(value).trim().toLowerCase();
    if (!str) return null;

    const normalized = str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (normalized.includes('particula')) {
      return 'particular';
    }

    if (normalized.includes('empresar')) {
      return 'empresarial';
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
        toast.error("O ficheiro nao contem dados");
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
            scope: normalizeScope(row['\u00C2mbito']),
            client_type: normalizeClientType(row['Tipo Cliente']),
            client_name: row['Nome Cliente'],
            client_nif: row['NIF'],
            client_contact: row['Contacto'],
            client_email: row['Email'] || null,
            client_iban: row['IBAN'] || null,
            has_direct_debit: parseBooleanValue(row['D\u00E9bito Direto']),
            has_electronic_invoice: parseBooleanValue(row['Fatura Eletr\u00F3nica']),
            street: row['Morada'] || null,
            postal_code: row['C\u00F3digo Postal'] || null,
            locality: row['Localidade'] || null,
            installation_address: row['Morada Instala\u00E7\u00E3o'] || null,
            operator_id: row['ID Operadora'],
            service_type: row['Tipo Servi\u00E7o'] || null,
            activation_type: row['Tipo Ativa\u00E7\u00E3o'] || null,
            monthly_value: parseNumericValue(row['Valor Mensal']),
            energy_sale_type: normalizeEnergySaleType(row['Tipo Venda Energia']),
            paid_to_operator: parseBooleanValue(row['Paga Operador']),
            payment_date: parseDate(row['Data Pagamento']),
            cpe: row['CPE'] || null,
            power: row['Pot\u00EAncia'] || null,
            cui: row['CUI'] || null,
            tier: row['Escal\u00E3o'] || null,
            entry_type: row['Tipo Entrada'] || null,
            status: row['Status'] || 'pendente',
            request_number: row['N\u00BA Requisi\u00E7\u00E3o'] || null,
            observations: row['Observa\u00E7\u00F5es'] || null,
          };

          if (!saleData.date) {
            throw new Error("Data invalida ou em falta");
          }
          if (!saleData.partner_id) {
            throw new Error("ID Parceiro em falta");
          }
          if (!saleData.scope) {
            throw new Error(`Ambito invalido: "${row['\u00C2mbito']}". Valores validos: telecomunicacoes, energia, solar, dual`);
          }
          if (!saleData.client_type) {
            throw new Error(`Tipo Cliente invalido: "${row['Tipo Cliente']}". Valores validos: particular, empresarial`);
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

          const result = await salesService.createSale({ ...saleData, is_bulk_import: true });

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
        toast.error(`${failedImports.length} vendas falharam na importacao`);
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
        '\u00C2mbito': '',
        'Tipo Cliente': '',
        'Nome Cliente': '',
        'NIF': '',
        'Contacto': '',
        'Email': '',
        'IBAN': '',
        'D\u00E9bito Direto': '',
        'Fatura Eletr\u00F3nica': '',
        'Morada': '',
        'C\u00F3digo Postal': '',
        'Localidade': '',
        'Morada Instala\u00E7\u00E3o': '',
        'ID Operadora': '',
        'Tipo Servi\u00E7o': '',
        'Tipo Ativa\u00E7\u00E3o': '',
        'Valor Mensal': '',
        'Tipo Venda Energia': '',
        'Paga Operador': '',
        'Data Pagamento': '',
        'CPE': '',
        'Pot\u00EAncia': '',
        'CUI': '',
        'Escal\u00E3o': '',
        'Tipo Entrada': '',
        'Status': '',
        'N\u00BA Requisi\u00E7\u00E3o': '',
        'Observa\u00E7\u00F5es': ''
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
        reportData.push({ 'Tipo': 'VENDAS IMPORTADAS COM SUCESSO', 'Linha': '', 'Cliente': '', 'Codigo Venda': '', 'Erro': '' });
        results.successfulImports.forEach(item => {
          reportData.push({
            'Tipo': 'Sucesso',
            'Linha': item.row,
            'Cliente': item.clientName,
            'Codigo Venda': item.saleCode,
            'Erro': ''
          });
        });
        reportData.push({ 'Tipo': '', 'Linha': '', 'Cliente': '', 'Codigo Venda': '', 'Erro': '' });
      }

      if (results.failedImports.length > 0) {
        reportData.push({ 'Tipo': 'VENDAS COM ERRO', 'Linha': '', 'Cliente': '', 'Codigo Venda': '', 'Erro': '' });
        results.failedImports.forEach(item => {
          reportData.push({
            'Tipo': 'Erro',
            'Linha': item.row,
            'Cliente': item.clientName,
            'Codigo Venda': '',
            'Erro': item.error
          });
        });
      }

      const ws = XLSX.utils.json_to_sheet(reportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Relatorio");

      const timestamp = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `relatorio_importacao_${timestamp}.xlsx`);
      toast.success("Relatorio descarregado com sucesso");
    } catch (error) {
      console.error('Erro ao criar relatorio:', error);
      toast.error("Erro ao descarregar relatorio");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-dark-850 border border-cyber-500/10 max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Upload className="h-5 w-5 text-cyber-400" />
            Importacao de Vendas
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Importe vendas em massa atraves de um ficheiro Excel
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-white">Template de Importacao</h3>
                <p className="text-sm text-slate-400">
                  Descarregue o template base com as colunas necessarias
                </p>
              </div>
              <Button
                variant="outline"
                onClick={downloadTemplate}
                className="flex items-center gap-2 bg-dark-900 border-dark-700 text-cyber-400 hover:text-cyber-300 hover:border-cyber-500/30"
              >
                <Download className="h-4 w-4" />
                Descarregar Template
              </Button>
            </div>

            <Alert className="bg-cyber-500/10 border border-cyber-500/20">
              <FileSpreadsheet className="h-4 w-4 text-cyber-400" />
              <AlertDescription className="text-slate-300">
                <strong className="text-white">Instrucoes:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                  <li>Descarregue o template e preencha os dados das vendas</li>
                  <li>O ID Parceiro e ID Operadora devem ser os IDs existentes no sistema</li>
                  <li>As datas podem estar em qualquer formato (DD/MM/AAAA, AAAA-MM-DD, etc.)</li>
                  <li>Paga Operador deve ser "Sim" ou "Nao"</li>
                  <li>Campos opcionais podem ficar em branco</li>
                  <li>Se houver erros em algumas linhas, as restantes serao importadas</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>

          <div className="space-y-4">
            <div className="border-2 border-dashed border-dark-700 rounded-lg p-6 text-center hover:border-cyber-500/30 transition-colors">
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
                <FileSpreadsheet className="h-12 w-12 text-slate-500" />
                {file ? (
                  <div className="space-y-1">
                    <p className="font-medium text-white">{file.name}</p>
                    <p className="text-sm text-slate-400">
                      Clique para selecionar outro ficheiro
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="font-medium text-slate-300">Clique para selecionar ficheiro</p>
                    <p className="text-sm text-slate-500">
                      Formatos suportados: .xlsx, .xls
                    </p>
                  </div>
                )}
              </label>
            </div>

            {importing && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-300">A importar vendas...</span>
                  <span className="text-cyber-400">{Math.round(progress)}%</span>
                </div>
                <ProgressPrimitive.Root
                  className="relative h-2 w-full overflow-hidden rounded-full bg-dark-700"
                  value={progress}
                >
                  <ProgressPrimitive.Indicator
                    className="h-full w-full flex-1 bg-cyber-500 transition-all"
                    style={{ transform: `translateX(-${100 - (progress || 0)}%)` }}
                  />
                </ProgressPrimitive.Root>
              </div>
            )}

            {results && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-cyber-500/10 border border-cyber-500/20 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-cyber-400">{results.total}</div>
                    <div className="text-sm text-cyber-400">Total</div>
                  </div>
                  <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-400">{results.successful}</div>
                    <div className="text-sm text-green-400">Sucesso</div>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-red-400">{results.failed}</div>
                    <div className="text-sm text-red-400">Erros</div>
                  </div>
                </div>

                {results.successfulImports.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2 text-green-400">
                      <CheckCircle2 className="h-4 w-4" />
                      Vendas Importadas ({results.successfulImports.length})
                    </h4>
                    <div className="max-h-40 overflow-y-auto border border-dark-700 rounded p-2 space-y-1 bg-dark-900">
                      {results.successfulImports.map((item, idx) => (
                        <div key={idx} className="text-sm flex justify-between">
                          <span className="text-slate-300">Linha {item.row}: {item.clientName}</span>
                          <span className="text-slate-500">{item.saleCode}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {results.failedImports.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2 text-red-400">
                      <AlertCircle className="h-4 w-4" />
                      Vendas com Erro ({results.failedImports.length})
                    </h4>
                    <div className="max-h-40 overflow-y-auto border border-dark-700 rounded p-2 space-y-1 bg-dark-900">
                      {results.failedImports.map((item, idx) => (
                        <div key={idx} className="text-sm space-y-1">
                          <div className="flex justify-between">
                            <span className="font-medium text-slate-300">Linha {item.row}: {item.clientName}</span>
                          </div>
                          <div className="text-red-400 text-xs pl-4">{item.error}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  onClick={downloadResultsReport}
                  variant="outline"
                  className="w-full bg-dark-900 border-dark-700 text-cyber-400 hover:text-cyber-300 hover:border-cyber-500/30"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Descarregar Relatorio Completo
                </Button>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={importing}
              className="bg-dark-900 border-dark-700 text-slate-300 hover:border-dark-600 hover:bg-dark-800"
            >
              Fechar
            </Button>
            <Button
              onClick={handleImport}
              disabled={!file || importing}
              className="flex items-center gap-2 bg-gradient-to-r from-cyber-500 to-cyber-600 text-white hover:from-cyber-600 hover:to-cyber-700"
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
