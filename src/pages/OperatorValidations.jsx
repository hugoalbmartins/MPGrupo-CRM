import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, Download, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

            return {
              lineNumber: index + 2,
              cpe: normalizedRow.cpe?.toString().trim() || null,
              cui: normalizedRow.cui?.toString().trim() || null,
              req: normalizedRow.req?.toString().trim() || null,
              date: normalizedRow.data || normalizedRow.date || null,
              paidByOperator: normalizedRow['pago pelo operador']?.toString().toUpperCase() === 'SIM' ||
                             normalizedRow['paid']?.toString().toUpperCase() === 'SIM' ||
                             normalizedRow['pago']?.toString().toUpperCase() === 'SIM'
            };
          });

          const validRows = processedData.filter(row =>
            row.cpe || row.cui || row.req
          );

          if (validRows.length === 0) {
            reject(new Error('Nenhum registo válido encontrado no ficheiro. Certifique-se que tem colunas: CPE, CUI ou REQ'));
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

      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const sixtyDaysAgoStr = sixtyDaysAgo.toISOString().split('T')[0];

      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .gte('date', sixtyDaysAgoStr)
        .or('paid_to_operator.eq.false,electricity_paid.eq.false,gas_paid.eq.false');

      if (salesError) throw salesError;

      const results = {
        processed: excelData.length,
        matched: 0,
        partiallyMatched: 0,
        notFound: [],
        updated: []
      };

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
            status: 'Ativo',
            operator_validated: true,
            operator_validation_date: new Date().toISOString()
          };

          const isDualEnergy = matchedSale.scope === 'energia' &&
                              matchedSale.energy_sale_type === 'dual';

          if (isDualEnergy) {
            const hasCPE = excelRow.cpe &&
                          matchedSale.cpe?.toUpperCase() === excelRow.cpe.toUpperCase();
            const hasCUI = excelRow.cui &&
                          matchedSale.cui?.toUpperCase() === excelRow.cui.toUpperCase();

            if (hasCPE && !hasCUI) {
              updates.electricity_paid = excelRow.paidByOperator;
              if (excelRow.paidByOperator) {
                updates.electricity_payment_date = excelRow.date || new Date().toISOString().split('T')[0];
              }
              updates.is_partial_payment = true;
              results.partiallyMatched++;
            } else if (hasCUI && !hasCPE) {
              updates.gas_paid = excelRow.paidByOperator;
              if (excelRow.paidByOperator) {
                updates.gas_payment_date = excelRow.date || new Date().toISOString().split('T')[0];
              }
              updates.is_partial_payment = true;
              results.partiallyMatched++;
            } else if (hasCPE && hasCUI) {
              updates.electricity_paid = excelRow.paidByOperator;
              updates.gas_paid = excelRow.paidByOperator;
              if (excelRow.paidByOperator) {
                const paymentDate = excelRow.date || new Date().toISOString().split('T')[0];
                updates.electricity_payment_date = paymentDate;
                updates.gas_payment_date = paymentDate;
                updates.payment_date = paymentDate;
              }
              updates.paid_to_operator = excelRow.paidByOperator;
              updates.is_partial_payment = false;
              results.matched++;
            }
          } else {
            updates.paid_to_operator = excelRow.paidByOperator;
            if (excelRow.paidByOperator) {
              updates.payment_date = excelRow.date || new Date().toISOString().split('T')[0];
            }
            results.matched++;
          }

          const { error: updateError } = await supabase
            .from('sales')
            .update(updates)
            .eq('id', matchedSale.id);

          if (updateError) {
            console.error('Error updating sale:', updateError);
          } else {
            results.updated.push({
              saleCode: matchedSale.sale_code,
              clientName: matchedSale.client_name,
              cpe: excelRow.cpe,
              cui: excelRow.cui,
              req: excelRow.req,
              paid: excelRow.paidByOperator
            });
          }
        } else {
          results.notFound.push({
            lineNumber: excelRow.lineNumber,
            cpe: excelRow.cpe,
            cui: excelRow.cui,
            req: excelRow.req
          });
        }
      }

      const { data: validationRecord, error: recordError } = await supabase
        .from('operator_validations')
        .insert({
          user_id: user.id,
          filename: file.name,
          records_processed: results.processed,
          sales_updated: results.matched + results.partiallyMatched,
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

      toast.success(`Validação concluída! ${results.matched + results.partiallyMatched} vendas atualizadas.`);

      setFile(null);
      const fileInput = document.getElementById('excel-file-input');
      if (fileInput) fileInput.value = '';

    } catch (error) {
      console.error('Validation error:', error);
      toast.error(error.message || 'Erro ao processar validação');
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

      const message = `Validação de ativações concluída para ficheiro "${filename}". ${results.notFound.length} registo(s) não encontrado(s) nas vendas.`;

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
    XLSX.utils.book_append_sheet(wb, ws, 'Não Encontrados');
    XLSX.writeFile(wb, `registos_nao_encontrados_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (user?.role !== 'admin' && user?.role !== 'bo') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Acesso restrito a Administradores e Back Office</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Validação de Ativações</h1>
          <p className="text-gray-600 mt-1">Upload de autos de operadoras para validação automática</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload de Ficheiro Excel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              <strong>Formato do ficheiro Excel:</strong> O ficheiro deve conter as colunas:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li><strong>CPE</strong>: Código do ponto de entrega (eletricidade)</li>
                <li><strong>CUI</strong>: Código único de instalação (gás)</li>
                <li><strong>REQ</strong>: Número de requisição (telecomunicações)</li>
                <li><strong>Data</strong>: Data de ativação/pagamento</li>
                <li><strong>Pago pelo operador</strong>: SIM ou NÃO</li>
              </ul>
              <p className="mt-2 text-sm">
                ℹ️ O sistema irá pesquisar vendas dos últimos 60 dias e atualizar automaticamente as correspondências.
              </p>
            </AlertDescription>
          </Alert>

          <div>
            <input
              id="excel-file-input"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {file && (
              <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                <FileSpreadsheet className="w-4 h-4" />
                <span>{file.name}</span>
              </div>
            )}
          </div>

          <Button
            onClick={handleValidation}
            disabled={!file || processing}
            className="btn-primary w-full"
          >
            {processing ? (
              <>
                <div className="spinner w-4 h-4 mr-2"></div>
                A processar...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Processar Validação
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {currentReport && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Resultado da Validação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Registos Processados</p>
                <p className="text-2xl font-bold text-blue-600">{currentReport.processed}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Vendas Atualizadas</p>
                <p className="text-2xl font-bold text-green-600">{currentReport.matched}</p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Parcialmente Pagas</p>
                <p className="text-2xl font-bold text-orange-600">{currentReport.partiallyMatched}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Não Encontrados</p>
                <p className="text-2xl font-bold text-red-600">{currentReport.notFound.length}</p>
              </div>
            </div>

            {currentReport.notFound.length > 0 && (
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-gray-900">Registos Não Encontrados</h3>
                  <Button onClick={downloadReport} variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Exportar Excel
                  </Button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Linha</th>
                        <th className="px-4 py-2 text-left">CPE</th>
                        <th className="px-4 py-2 text-left">CUI</th>
                        <th className="px-4 py-2 text-left">REQ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentReport.notFound.map((record, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-4 py-2">{record.lineNumber}</td>
                          <td className="px-4 py-2">{record.cpe || '-'}</td>
                          <td className="px-4 py-2">{record.cui || '-'}</td>
                          <td className="px-4 py-2">{record.req || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Histórico de Validações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {validationHistory.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Nenhuma validação realizada ainda</p>
          ) : (
            <div className="space-y-3">
              {validationHistory.map((validation) => (
                <div key={validation.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{validation.filename}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(validation.created_at).toLocaleString('pt-PT')}
                    </p>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <div className="text-center">
                      <p className="text-gray-600">Processados</p>
                      <p className="font-semibold">{validation.records_processed}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-600">Atualizados</p>
                      <p className="font-semibold text-green-600">{validation.sales_updated}</p>
                    </div>
                    {validation.not_found && validation.not_found.length > 0 && (
                      <div className="text-center">
                        <p className="text-gray-600">Não Encontrados</p>
                        <p className="font-semibold text-red-600">{validation.not_found.length}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OperatorValidations;
