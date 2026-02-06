import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, Download, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

const OperatorValidations = ({ user }) => {
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
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
    }
  };

  const processExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);

          const processedData = jsonData.map((row, index) => {
            const normalizedRow = {};
            Object.keys(row).forEach(key => {
              const normalizedKey = key.toLowerCase().trim();
              normalizedRow[normalizedKey] = row[key];
            });

            const paidValue = normalizedRow['pago pelo operador'] ||
                             normalizedRow['pago operador'] ||
                             normalizedRow['paid'] ||
                             normalizedRow['pago'] ||
                             normalizedRow['pago pela operadora'] ||
                             normalizedRow['validado'] ||
                             '';

            return {
              lineNumber: index + 2,
              cpe: normalizedRow.cpe?.toString().trim() || null,
              cui: normalizedRow.cui?.toString().trim() || null,
              req: normalizedRow.req?.toString().trim() || normalizedRow['requisição']?.toString().trim() || normalizedRow['requisicao']?.toString().trim() || null,
              date: normalizedRow.data || normalizedRow.date || null,
              paidByOperator: paidValue?.toString().toUpperCase() === 'SIM' ||
                             paidValue?.toString().toUpperCase() === 'YES' ||
                             paidValue?.toString().toUpperCase() === 'S' ||
                             paidValue?.toString() === '1' ||
                             paidValue === true
            };
          });

          const validRows = processedData.filter(row =>
            row.cpe || row.cui || row.req
          );

          if (validRows.length === 0) {
            reject(new Error('Nenhum registo valido encontrado no ficheiro. Certifique-se que tem colunas: CPE, CUI ou REQ'));
            return;
          }

          resolve(validRows);
        } catch (error) {
          reject(new Error('Erro ao processar ficheiro Excel: ' + error.message));
        }
      };

      reader.onerror = () => {
        reject(new Error('Erro ao ler ficheiro'));
      };

      reader.readAsArrayBuffer(file);
    });
  };

  const handleValidation = async () => {
    if (!file) {
      toast.error('Por favor selecione um ficheiro Excel');
      return;
    }

    setProcessing(true);
    setCurrentReport(null);

    try {
      const excelData = await processExcelFile(file);

      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split('T')[0];

      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .gte('date', ninetyDaysAgoStr)
        .or('paid_to_operator.is.null,paid_to_operator.eq.false,electricity_paid.is.null,electricity_paid.eq.false,gas_paid.is.null,gas_paid.eq.false');

      if (salesError) throw salesError;

      const results = {
        processed: excelData.length,
        matched: 0,
        partiallyMatched: 0,
        notFound: [],
        updated: []
      };

      const batchUpdates = [];

      for (const excelRow of excelData) {
        let matchedSale = null;

        if (excelRow.cpe) {
          matchedSale = sales.find(sale =>
            sale.cpe?.toUpperCase() === excelRow.cpe.toUpperCase()
          );
        }

        if (!matchedSale && excelRow.cui) {
          matchedSale = sales.find(sale =>
            sale.cui?.toUpperCase() === excelRow.cui.toUpperCase()
          );
        }

        if (!matchedSale && excelRow.req) {
          matchedSale = sales.find(sale =>
            sale.request_number?.toUpperCase() === excelRow.req.toUpperCase()
          );
        }

        if (matchedSale) {
          const updates = {
            sale_id: matchedSale.id,
            status: 'Ativo',
            operator_validated: true,
            operator_validation_date: new Date().toISOString()
          };

          const isEnergy = matchedSale.scope === 'energia';
          const isDualEnergy = isEnergy && matchedSale.energy_sale_type === 'dual';
          const paymentDate = excelRow.date || new Date().toISOString().split('T')[0];

          if (isDualEnergy) {
            const hasCPE = excelRow.cpe &&
                          matchedSale.cpe?.toUpperCase() === excelRow.cpe.toUpperCase();
            const hasCUI = excelRow.cui &&
                          matchedSale.cui?.toUpperCase() === excelRow.cui.toUpperCase();

            if (hasCPE && !hasCUI) {
              updates.electricity_paid = excelRow.paidByOperator;
              if (excelRow.paidByOperator) {
                updates.electricity_payment_date = paymentDate;
              }
              updates.is_partial_payment = true;
              results.partiallyMatched++;
            } else if (hasCUI && !hasCPE) {
              updates.gas_paid = excelRow.paidByOperator;
              if (excelRow.paidByOperator) {
                updates.gas_payment_date = paymentDate;
              }
              updates.is_partial_payment = true;
              results.partiallyMatched++;
            } else {
              updates.electricity_paid = excelRow.paidByOperator;
              updates.gas_paid = excelRow.paidByOperator;
              if (excelRow.paidByOperator) {
                updates.electricity_payment_date = paymentDate;
                updates.gas_payment_date = paymentDate;
              }
              updates.paid_to_operator = excelRow.paidByOperator;
              updates.is_partial_payment = false;
              results.matched++;
            }
          } else if (isEnergy && matchedSale.energy_sale_type === 'eletricidade') {
            updates.electricity_paid = excelRow.paidByOperator;
            updates.paid_to_operator = excelRow.paidByOperator;
            if (excelRow.paidByOperator) {
              updates.electricity_payment_date = paymentDate;
              updates.payment_date = paymentDate;
            }
            results.matched++;
          } else if (isEnergy && matchedSale.energy_sale_type === 'gas') {
            updates.gas_paid = excelRow.paidByOperator;
            updates.paid_to_operator = excelRow.paidByOperator;
            if (excelRow.paidByOperator) {
              updates.gas_payment_date = paymentDate;
              updates.payment_date = paymentDate;
            }
            results.matched++;
          } else {
            updates.paid_to_operator = excelRow.paidByOperator;
            if (excelRow.paidByOperator) {
              updates.payment_date = paymentDate;
            }
            results.matched++;
          }

          batchUpdates.push({
            updates,
            saleCode: matchedSale.sale_code,
            clientName: matchedSale.client_name,
            cpe: excelRow.cpe,
            cui: excelRow.cui,
            req: excelRow.req,
            paid: excelRow.paidByOperator
          });
        } else {
          results.notFound.push({
            lineNumber: excelRow.lineNumber,
            cpe: excelRow.cpe,
            cui: excelRow.cui,
            req: excelRow.req
          });
        }
      }

      if (batchUpdates.length > 0) {
        const rpcPayload = batchUpdates.map(item => item.updates);

        const { data: rpcResult, error: rpcError } = await supabase
          .rpc('batch_validate_sales', { p_updates: rpcPayload });

        if (rpcError) {
          console.error('Batch validation RPC error:', rpcError);
          toast.error('Erro ao atualizar vendas: ' + rpcError.message);
        } else {
          const updatedIds = rpcResult?.updated_ids || [];
          const rpcErrors = rpcResult?.errors || [];

          if (rpcErrors.length > 0) {
            console.warn('Validation update warnings:', rpcErrors);
          }

          for (const item of batchUpdates) {
            if (updatedIds.includes(item.updates.sale_id)) {
              results.updated.push({
                saleCode: item.saleCode,
                clientName: item.clientName,
                cpe: item.cpe,
                cui: item.cui,
                req: item.req,
                paid: item.paid
              });
            }
          }
        }
      }

      const { data: validationRecord, error: recordError } = await supabase
        .from('operator_validations')
        .insert({
          user_id: user.id,
          filename: file.name,
          records_processed: results.processed,
          sales_updated: results.updated.length,
          partially_paid: results.partiallyMatched,
          not_found: results.notFound
        })
        .select()
        .single();

      if (recordError) {
        console.error('Error saving validation record:', recordError);
      }

      setCurrentReport(results);
      fetchValidationHistory();

      if (results.notFound.length > 0) {
        await sendNotificationsToAdminsAndBO(results, file.name);
      }

      toast.success(`Validacao concluida! ${results.updated.length} vendas atualizadas.`);

      setFile(null);
      const fileInput = document.getElementById('excel-file-input');
      if (fileInput) fileInput.value = '';

    } catch (error) {
      console.error('Validation error:', error);
      toast.error(error.message || 'Erro ao processar validacao');
    } finally {
      setProcessing(false);
    }
  };

  const sendNotificationsToAdminsAndBO = async (results, filename) => {
    try {
      const { data: adminsAndBO } = await supabase
        .from('users')
        .select('id, name, email')
        .in('role', ['admin', 'bo']);

      if (!adminsAndBO || adminsAndBO.length === 0) return;

      const message = `Validacao de ativacoes concluida para ficheiro "${filename}". ${results.notFound.length} registo(s) nao encontrado(s) nas vendas.`;

      const userIds = adminsAndBO.map(u => u.id);

      await supabase
        .from('alerts')
        .insert({
          type: 'operator_validation',
          sale_id: null,
          sale_code: 'VALIDATION',
          message,
          user_ids: userIds,
          created_by: user.id,
          created_by_name: user.name
        });

    } catch (error) {
      console.error('Error sending notifications:', error);
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
        <p className="text-dark-300">Acesso restrito a Administradores e Back Office</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Validacao de Ativacoes</h1>
          <p className="text-dark-300 mt-1">Upload de autos de operadoras para validacao automatica</p>
        </div>
      </div>

      <div className="glass-ultra p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Upload className="w-5 h-5 text-gold-400" />
          Upload de Ficheiro Excel
        </h2>

        <div className="bg-dark-800 border border-dark-600 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-gold-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-dark-200">
              <strong className="text-white">Formato do ficheiro Excel:</strong> O ficheiro deve conter as colunas:
              <ul className="list-disc list-inside mt-2 space-y-1 text-dark-300">
                <li><strong className="text-dark-200">CPE</strong>: Codigo do ponto de entrega (eletricidade)</li>
                <li><strong className="text-dark-200">CUI</strong>: Codigo unico de instalacao (gas)</li>
                <li><strong className="text-dark-200">REQ</strong>: Numero de requisicao (telecomunicacoes)</li>
                <li><strong className="text-dark-200">Data</strong>: Data de ativacao/pagamento</li>
                <li><strong className="text-dark-200">Pago pelo operador</strong>: SIM ou NAO</li>
              </ul>
              <p className="mt-2 text-dark-400">
                O sistema ira pesquisar vendas dos ultimos 90 dias e atualizar automaticamente as correspondencias.
              </p>
            </div>
          </div>
        </div>

        <div>
          <input
            id="excel-file-input"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="block w-full text-sm text-dark-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gold-400/10 file:text-gold-400 hover:file:bg-gold-400/20"
          />
          {file && (
            <div className="mt-2 flex items-center gap-2 text-sm text-dark-200">
              <FileSpreadsheet className="w-4 h-4" />
              <span>{file.name}</span>
            </div>
          )}
        </div>

        <Button
          onClick={handleValidation}
          disabled={!file || processing}
          className="btn-gold w-full"
        >
          {processing ? (
            <>
              <div className="spinner w-4 h-4 mr-2"></div>
              A processar...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Processar Validacao
            </>
          )}
        </Button>
      </div>

      {currentReport && (
        <div className="glass-ultra p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            Resultado da Validacao
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl">
              <p className="text-sm text-dark-300">Registos Processados</p>
              <p className="text-2xl font-bold text-blue-400">{currentReport.processed}</p>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl">
              <p className="text-sm text-dark-300">Vendas Atualizadas</p>
              <p className="text-2xl font-bold text-green-400">{currentReport.updated.length}</p>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl">
              <p className="text-sm text-dark-300">Parcialmente Pagas</p>
              <p className="text-2xl font-bold text-orange-400">{currentReport.partiallyMatched}</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl">
              <p className="text-sm text-dark-300">Nao Encontrados</p>
              <p className="text-2xl font-bold text-red-400">{currentReport.notFound.length}</p>
            </div>
          </div>

          {currentReport.notFound.length > 0 && (
            <div className="border-t border-dark-600 pt-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-white">Registos Nao Encontrados</h3>
                <Button onClick={downloadReport} className="btn-secondary" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Exportar Excel
                </Button>
              </div>
              <div className="max-h-64 overflow-y-auto table-container">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left">Linha</th>
                      <th className="px-4 py-2 text-left">CPE</th>
                      <th className="px-4 py-2 text-left">CUI</th>
                      <th className="px-4 py-2 text-left">REQ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentReport.notFound.map((record, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 text-dark-200">{record.lineNumber}</td>
                        <td className="px-4 py-2 text-dark-200">{record.cpe || '-'}</td>
                        <td className="px-4 py-2 text-dark-200">{record.cui || '-'}</td>
                        <td className="px-4 py-2 text-dark-200">{record.req || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="glass-ultra p-6">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-gold-400" />
          Historico de Validacoes
        </h2>

        {validationHistory.length === 0 ? (
          <p className="text-dark-400 text-center py-8">Nenhuma validacao realizada ainda</p>
        ) : (
          <div className="space-y-3">
            {validationHistory.map((validation) => (
              <div key={validation.id} className="flex items-center justify-between p-4 bg-dark-800/50 border border-dark-600 rounded-xl">
                <div className="flex-1">
                  <p className="font-medium text-white">{validation.filename}</p>
                  <p className="text-sm text-dark-300">
                    {new Date(validation.created_at).toLocaleString('pt-PT')}
                  </p>
                </div>
                <div className="flex gap-4 text-sm">
                  <div className="text-center">
                    <p className="text-dark-400">Processados</p>
                    <p className="font-semibold text-white">{validation.records_processed}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-dark-400">Atualizados</p>
                    <p className="font-semibold text-green-400">{validation.sales_updated}</p>
                  </div>
                  {validation.not_found && validation.not_found.length > 0 && (
                    <div className="text-center">
                      <p className="text-dark-400">Nao Encontrados</p>
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
