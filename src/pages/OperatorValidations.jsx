import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CircleCheck as CheckCircle, Circle as XCircle, TriangleAlert as AlertTriangle, Download, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

const VALID_STATUSES = [
  "Para registo",
  "Pendente",
  "Registado",
  "Ativo",
  "Concluido",
  "Cancelado",
  "Recusado",
  "Em proposta",
];

const normalizeStatus = (value) => {
  if (!value) return null;
  const v = String(value).trim().toLowerCase();
  const map = {
    'ativo': 'Ativo',
    'activo': 'Ativo',
    'active': 'Ativo',
    'pendente': 'Pendente',
    'pending': 'Pendente',
    'registado': 'Registado',
    'registered': 'Registado',
    'para registo': 'Para registo',
    'concluido': 'Concluido',
    'concluído': 'Concluido',
    'completed': 'Concluido',
    'cancelado': 'Cancelado',
    'cancelled': 'Cancelado',
    'canceled': 'Cancelado',
    'recusado': 'Recusado',
    'refused': 'Recusado',
    'em proposta': 'Em proposta',
  };
  return map[v] || (VALID_STATUSES.find(s => s.toLowerCase() === v) ? VALID_STATUSES.find(s => s.toLowerCase() === v) : null);
};

const OperatorValidations = ({ user }) => {
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [validationHistory, setValidationHistory] = useState([]);
  const [currentReport, setCurrentReport] = useState(null);

  useEffect(() => {
    fetchValidationHistory();
  }, []);

  const fetchValidationHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('operator_validations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setValidationHistory(data || []);
    } catch (error) {
      console.error('Error fetching validation history:', error);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (!selectedFile.name.match(/\.(xlsx|xls)$/)) {
        toast.error('Por favor selecione um ficheiro Excel (.xlsx ou .xls)');
        return;
      }
      setFile(selectedFile);
      setCurrentReport(null);
    }
  };

  const parseDate = (value) => {
    if (!value) return null;
    if (typeof value === 'number') {
      const excelDate = new Date((value - 25569) * 86400 * 1000);
      return excelDate.toISOString().split('T')[0];
    }
    if (typeof value === 'string') {
      const parts = value.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
      if (parts) {
        const year = parts[3].length === 2 ? '20' + parts[3] : parts[3];
        return `${year}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
      }
    }
    return null;
  };

  const parseBool = (value) => {
    if (!value) return false;
    const v = String(value).trim().toUpperCase();
    return v === 'SIM' || v === 'YES' || v === 'S' || v === '1' || v === 'TRUE' || value === true;
  };

  const parseExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);

          const rows = jsonData.map((row, index) => {
            const norm = {};
            Object.keys(row).forEach(key => {
              norm[key.toLowerCase().trim()] = row[key];
            });

            const statusRaw = norm['status'] || norm['estado'] || '';
            const status = normalizeStatus(statusRaw);

            const activationDateRaw = norm['data de ativação'] || norm['data de ativacao'] ||
              norm['data ativação'] || norm['data ativacao'] || norm['data ativação'] ||
              norm['data'] || norm['date'] || null;
            const activationDate = parseDate(activationDateRaw);

            const paidRaw = norm['pago pelo operador'] || norm['pago operador'] ||
              norm['paid'] || norm['pago'] || norm['pago pela operadora'] || norm['validado'] || '';
            const isPaid = parseBool(paidRaw);

            const paymentDateRaw = norm['data de pagamento'] || norm['data pagamento'] ||
              norm['payment date'] || null;
            const paymentDate = parseDate(paymentDateRaw);

            const cleanIdentifier = (val) => {
              if (!val) return null;
              return String(val).replace(/\s+/g, '').trim() || null;
            };

            return {
              lineNumber: index + 2,
              cpe: cleanIdentifier(norm.cpe),
              cui: cleanIdentifier(norm.cui),
              req: cleanIdentifier(norm.req || norm['requisição'] || norm['requisicao']),
              status,
              activationDate,
              paidByOperator: isPaid,
              paymentDate,
            };
          });

          const validRows = rows.filter(r => r.cpe || r.cui || r.req);

          if (validRows.length === 0) {
            reject(new Error('Nenhum registo valido encontrado. O ficheiro deve ter colunas: CPE, CUI ou REQ'));
            return;
          }

          const rowsWithoutStatus = validRows.filter(r => !r.status);
          if (rowsWithoutStatus.length > 0) {
            reject(new Error(`${rowsWithoutStatus.length} registo(s) sem estado valido. O ficheiro deve conter coluna "Status" ou "Estado" com valores validos (ex: Ativo, Pendente, Registado, Cancelado...)`));
            return;
          }

          resolve(validRows);
        } catch (error) {
          reject(new Error('Erro ao processar ficheiro: ' + error.message));
        }
      };

      reader.onerror = () => reject(new Error('Erro ao ler ficheiro'));
      reader.readAsArrayBuffer(file);
    });
  };

  const normalizeIdentifier = (value) => {
    if (!value) return null;
    return String(value).toUpperCase().replace(/\s+/g, '').trim();
  };

  const handleValidation = async () => {
    if (!file) {
      toast.error('Por favor selecione um ficheiro Excel');
      return;
    }

    setProcessing(true);
    setCurrentReport(null);
    setProgress({ current: 0, total: 0 });

    try {
      const excelRows = await parseExcelFile(file);

      const lookbackDate = new Date();
      lookbackDate.setDate(lookbackDate.getDate() - 365);
      const dateStr = lookbackDate.toISOString().split('T')[0];

      const [salesResult, energyPointsResult] = await Promise.all([
        supabase
          .from('sales')
          .select('id, sale_code, date, status, scope, energy_sale_type, cpe, cui, request_number, client_name, operator_validated, paid_to_operator, electricity_paid, gas_paid')
          .gte('date', dateStr),
        supabase
          .from('sales_energy_points')
          .select('id, sale_id, point_type, point_code')
      ]);

      if (salesResult.error) throw salesResult.error;
      const sales = salesResult.data || [];
      const energyPoints = energyPointsResult.data || [];

      const pointsBySaleId = {};
      for (const ep of energyPoints) {
        if (!pointsBySaleId[ep.sale_id]) pointsBySaleId[ep.sale_id] = [];
        pointsBySaleId[ep.sale_id].push(ep);
      }

      const cpeIndex = {};
      const cuiIndex = {};
      const reqIndex = {};

      for (const sale of sales) {
        if (sale.cpe) {
          const normalized = normalizeIdentifier(sale.cpe);
          if (normalized && !cpeIndex[normalized]) cpeIndex[normalized] = sale;
        }
        if (sale.cui) {
          const normalized = normalizeIdentifier(sale.cui);
          if (normalized && !cuiIndex[normalized]) cuiIndex[normalized] = sale;
        }
        if (sale.request_number) {
          const normalized = normalizeIdentifier(sale.request_number);
          if (normalized && !reqIndex[normalized]) reqIndex[normalized] = sale;
        }
      }

      for (const ep of energyPoints) {
        const normalized = normalizeIdentifier(ep.point_code);
        if (!normalized) continue;
        if (ep.point_type === 'cpe' && !cpeIndex[normalized]) {
          const sale = sales.find(s => s.id === ep.sale_id);
          if (sale) cpeIndex[normalized] = sale;
        }
        if (ep.point_type === 'cui' && !cuiIndex[normalized]) {
          const sale = sales.find(s => s.id === ep.sale_id);
          if (sale) cuiIndex[normalized] = sale;
        }
      }

      const results = {
        processed: excelRows.length,
        matched: 0,
        updated: [],
        errors: [],
        notFound: []
      };

      const matchedSales = [];

      for (const row of excelRows) {
        let matched = null;

        if (row.cpe) {
          const normalized = normalizeIdentifier(row.cpe);
          matched = cpeIndex[normalized] || null;
        }
        if (!matched && row.cui) {
          const normalized = normalizeIdentifier(row.cui);
          matched = cuiIndex[normalized] || null;
        }
        if (!matched && row.req) {
          const normalized = normalizeIdentifier(row.req);
          matched = reqIndex[normalized] || null;
        }

        if (matched) {
          matchedSales.push({ sale: matched, row });
        } else {
          results.notFound.push({
            lineNumber: row.lineNumber,
            cpe: row.cpe,
            cui: row.cui,
            req: row.req
          });
        }
      }

      setProgress({ current: 0, total: matchedSales.length });

      for (let i = 0; i < matchedSales.length; i++) {
        const { sale, row } = matchedSales[i];
        const rowStatus = row.status;
        const isAtivo = rowStatus === 'Ativo';

        const updateData = {
          status: rowStatus,
        };

        if (isAtivo) {
          const activationDate = row.activationDate || new Date().toISOString().split('T')[0];
          updateData.operator_validated = true;
          updateData.operator_validation_date = new Date().toISOString();
          updateData.activated_at = activationDate;
          updateData.activation_date = activationDate;
        }

        if (row.paidByOperator) {
          const payDate = row.paymentDate || row.activationDate || new Date().toISOString().split('T')[0];
          updateData.paid_to_operator = true;
          updateData.payment_date = payDate;

          if (sale.scope === 'energia') {
            if (sale.energy_sale_type === 'dual') {
              updateData.electricity_paid = true;
              updateData.electricity_payment_date = payDate;
              updateData.gas_paid = true;
              updateData.gas_payment_date = payDate;
              updateData.is_partial_payment = false;
            } else if (sale.energy_sale_type === 'eletricidade') {
              updateData.electricity_paid = true;
              updateData.electricity_payment_date = payDate;
            } else if (sale.energy_sale_type === 'gas') {
              updateData.gas_paid = true;
              updateData.gas_payment_date = payDate;
            }
          }
        }

        const { error: updateError } = await supabase
          .from('sales')
          .update(updateData)
          .eq('id', sale.id);

        if (updateError) {
          console.error(`Erro ao atualizar venda ${sale.sale_code}:`, updateError);
          results.errors.push({ saleCode: sale.sale_code, error: updateError.message });
        } else {
          results.updated.push({
            saleCode: sale.sale_code,
            clientName: sale.client_name,
            cpe: row.cpe,
            cui: row.cui,
            req: row.req,
            status: rowStatus,
            paid: row.paidByOperator,
            activationDate: isAtivo ? (row.activationDate || new Date().toISOString().split('T')[0]) : null,
            paymentDate: row.paidByOperator ? (row.paymentDate || row.activationDate || null) : null,
          });
        }

        setProgress({ current: i + 1, total: matchedSales.length });
      }

      results.matched = results.updated.length;

      await supabase
        .from('operator_validations')
        .insert({
          user_id: user.id,
          filename: file.name,
          records_processed: results.processed,
          sales_updated: results.updated.length,
          partially_paid: 0,
          not_found: results.notFound
        });

      setCurrentReport(results);
      fetchValidationHistory();

      if (results.errors.length > 0) {
        toast.error(`${results.errors.length} erro(s) ao atualizar vendas`);
      }
      if (results.notFound.length > 0) {
        toast.warning(`${results.notFound.length} registo(s) nao encontrado(s)`);
      }
      if (results.updated.length > 0) {
        toast.success(`${results.updated.length} venda(s) atualizada(s) com sucesso!`);
      }

      setFile(null);
      const fileInput = document.getElementById('excel-file-input');
      if (fileInput) fileInput.value = '';

    } catch (error) {
      console.error('Validation error:', error);
      toast.error(error.message || 'Erro ao processar validacao');
    } finally {
      setProcessing(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const downloadReport = () => {
    if (!currentReport || currentReport.notFound.length === 0) return;

    const ws = XLSX.utils.json_to_sheet(currentReport.notFound);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Nao Encontrados');
    XLSX.writeFile(wb, `registos_nao_encontrados_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (user?.role !== 'admin' && user?.role !== 'bo') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-300">Acesso restrito a Administradores e Back Office</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Validacao de Ativacoes</h1>
          <p className="text-slate-300 mt-1">Upload de ficheiros de operadoras para validacao automatica</p>
        </div>
      </div>

      <div className="bg-dark-850 border border-white/[0.06] rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Upload className="w-5 h-5 text-cyber-400" />
          Upload de Ficheiro Excel
        </h2>

        <div className="bg-dark-900 border border-dark-700 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-cyber-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-slate-300">
              <strong className="text-white">Formato do ficheiro Excel:</strong> O ficheiro deve conter as seguintes colunas:
              <div className="mt-3 space-y-3">
                <div className="p-3 rounded-lg bg-dark-800 border border-dark-700">
                  <p className="font-semibold text-white text-xs uppercase tracking-wider mb-2">Colunas de identificacao (pelo menos uma obrigatoria)</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li><strong className="text-slate-300">CPE</strong> - Codigo do ponto de entrega (eletricidade)</li>
                    <li><strong className="text-slate-300">CUI</strong> - Codigo unico de instalacao (gas)</li>
                    <li><strong className="text-slate-300">REQ</strong> - Numero de requisicao (telecomunicacoes)</li>
                  </ul>
                </div>

                <div className="p-3 rounded-lg bg-dark-800 border border-dark-700">
                  <p className="font-semibold text-white text-xs uppercase tracking-wider mb-2">Coluna de estado (obrigatoria)</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li><strong className="text-slate-300">Status</strong> ou <strong className="text-slate-300">Estado</strong> - Estado a aplicar a cada venda (ex: Ativo, Pendente, Registado, Cancelado, Recusado, Concluido, Para registo, Em proposta)</li>
                  </ul>
                </div>

                <div className="p-3 rounded-lg bg-dark-800 border border-dark-700">
                  <p className="font-semibold text-white text-xs uppercase tracking-wider mb-2">Colunas opcionais</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li><strong className="text-slate-300">Data de ativacao</strong> - Data de ativacao da venda (preenchida automaticamente quando estado e "Ativo")</li>
                    <li><strong className="text-slate-300">Pago pelo operador</strong> - Se o operador ja pagou (SIM/NAO)</li>
                    <li><strong className="text-slate-300">Data de pagamento</strong> - Data do pagamento pelo operador</li>
                  </ul>
                </div>
              </div>
              <p className="mt-3 text-slate-500">
                O sistema pesquisa vendas dos ultimos 90 dias e aplica o estado que constar em cada linha do ficheiro.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Ficheiro Excel</label>
            <input
              id="excel-file-input"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-cyber-500/10 file:text-cyber-400 hover:file:bg-cyber-500/20"
            />
            {file && (
              <div className="mt-2 flex items-center gap-2 text-sm text-slate-300">
                <FileSpreadsheet className="w-4 h-4" />
                <span>{file.name}</span>
              </div>
            )}
          </div>
        </div>

        <Button
          onClick={handleValidation}
          disabled={!file || processing}
          className="bg-gradient-to-r from-cyber-500 to-cyber-600 text-white hover:from-cyber-400 hover:to-cyber-500 w-full"
        >
          {processing ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              A processar... {progress.total > 0 ? `(${progress.current}/${progress.total})` : ''}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Processar Validacoes
            </span>
          )}
        </Button>
      </div>

      {currentReport && (
        <div className="bg-dark-850 border border-white/[0.06] rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            Resultado da Validacao
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl">
              <p className="text-sm text-slate-400">Registos Processados</p>
              <p className="text-2xl font-bold text-blue-400">{currentReport.processed}</p>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl">
              <p className="text-sm text-slate-400">Vendas Atualizadas</p>
              <p className="text-2xl font-bold text-green-400">{currentReport.updated.length}</p>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl">
              <p className="text-sm text-slate-400">Erros</p>
              <p className="text-2xl font-bold text-orange-400">{currentReport.errors.length}</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl">
              <p className="text-sm text-slate-400">Nao Encontrados</p>
              <p className="text-2xl font-bold text-red-400">{currentReport.notFound.length}</p>
            </div>
          </div>

          {currentReport.updated.length > 0 && (
            <div className="border-t border-dark-700 pt-4">
              <h3 className="font-semibold text-white mb-3">Vendas Atualizadas</h3>
              <div className="max-h-48 overflow-y-auto scrollbar-premium bg-dark-900 rounded-xl border border-dark-700">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-dark-700">
                      <th className="px-4 py-2 text-left text-xs font-semibold text-cyber-400">Codigo</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-cyber-400">Cliente</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-cyber-400">Estado</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-cyber-400">Pago</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-cyber-400">Data Ativacao</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-cyber-400">Data Pagamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentReport.updated.map((item, idx) => (
                      <tr key={idx} className="border-b border-dark-800">
                        <td className="px-4 py-2 text-white">{item.saleCode}</td>
                        <td className="px-4 py-2 text-slate-300">{item.clientName || '-'}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            item.status === 'Ativo' ? 'bg-emerald-500/10 text-emerald-400' :
                            item.status === 'Cancelado' || item.status === 'Recusado' ? 'bg-red-500/10 text-red-400' :
                            item.status === 'Concluido' ? 'bg-blue-500/10 text-blue-400' :
                            'bg-slate-500/10 text-slate-300'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          {item.paid ? (
                            <span className="text-green-400">Sim</span>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-slate-300">{item.activationDate || '-'}</td>
                        <td className="px-4 py-2 text-slate-300">{item.paymentDate || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {currentReport.errors.length > 0 && (
            <div className="border-t border-dark-700 pt-4">
              <h3 className="font-semibold text-orange-400 mb-3">Erros ao Atualizar</h3>
              <div className="space-y-1">
                {currentReport.errors.map((err, idx) => (
                  <div key={idx} className="text-sm text-red-400">
                    <XCircle className="w-3 h-3 inline mr-1" />
                    {err.saleCode}: {err.error}
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentReport.notFound.length > 0 && (
            <div className="border-t border-dark-700 pt-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-white">Registos Nao Encontrados</h3>
                <Button onClick={downloadReport} className="bg-dark-900 border border-dark-700 text-slate-300 hover:border-cyber-500/30" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Exportar Excel
                </Button>
              </div>
              <div className="max-h-48 overflow-y-auto scrollbar-premium bg-dark-900 rounded-xl border border-dark-700">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-dark-700">
                      <th className="px-4 py-2 text-left text-xs font-semibold text-cyber-400">Linha</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-cyber-400">CPE</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-cyber-400">CUI</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-cyber-400">REQ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentReport.notFound.map((record, idx) => (
                      <tr key={idx} className="border-b border-dark-800">
                        <td className="px-4 py-2 text-slate-300">{record.lineNumber}</td>
                        <td className="px-4 py-2 text-slate-300">{record.cpe || '-'}</td>
                        <td className="px-4 py-2 text-slate-300">{record.cui || '-'}</td>
                        <td className="px-4 py-2 text-slate-300">{record.req || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-dark-850 border border-white/[0.06] rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-cyber-400" />
          Historico de Validacoes
        </h2>

        {validationHistory.length === 0 ? (
          <p className="text-center py-8 text-slate-500">Nenhuma validacao realizada ainda</p>
        ) : (
          <div className="space-y-3">
            {validationHistory.map((validation) => (
              <div key={validation.id} className="flex items-center justify-between p-4 rounded-xl bg-dark-900/50 border border-dark-700">
                <div className="flex-1">
                  <p className="font-medium text-white">{validation.filename}</p>
                  <p className="text-sm text-slate-400">
                    {new Date(validation.created_at).toLocaleString('pt-PT')}
                  </p>
                </div>
                <div className="flex gap-4 text-sm">
                  <div className="text-center">
                    <p className="text-slate-500">Processados</p>
                    <p className="font-semibold text-white">{validation.records_processed}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-500">Atualizados</p>
                    <p className="font-semibold text-green-400">{validation.sales_updated}</p>
                  </div>
                  {validation.not_found && validation.not_found.length > 0 && (
                    <div className="text-center">
                      <p className="text-slate-500">Nao Encontrados</p>
                      <p className="font-semibold text-red-400">{validation.not_found.length}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OperatorValidations;
