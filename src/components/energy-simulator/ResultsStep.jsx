import React, { useState } from 'react';
import { ArrowLeft, Download, MessageCircle, ChevronDown, ChevronUp, TrendingUp, AlertCircle, Gift, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';

const ResultsStep = ({ simulationData, onBack, onNewSimulation }) => {
  const [expandedOperator, setExpandedOperator] = useState(null);
  const { custoAtual, resultados, todosResultados } = simulationData;

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    }).format(value);
  };

  const exportToPDF = async (operadora = null) => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let yPos = 20;

      doc.setFontSize(20);
      doc.setTextColor(255, 193, 7);
      doc.text('MP GRUPO', margin, yPos);
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('Simulação de Energia', margin, yPos + 7);
      yPos += 20;

      doc.setFontSize(10);
      doc.text(`Data: ${new Date().toLocaleDateString('pt-PT')}`, margin, yPos);
      yPos += 10;

      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Custo Atual Mensal', margin, yPos);
      yPos += 8;
      doc.setFont(undefined, 'normal');
      doc.setFontSize(10);
      doc.text(`Total: ${formatCurrency(custoAtual.total)}`, margin, yPos);
      if (custoAtual.eletricidade > 0) {
        yPos += 6;
        doc.text(`Eletricidade: ${formatCurrency(custoAtual.eletricidade)}`, margin + 5, yPos);
      }
      if (custoAtual.gas > 0) {
        yPos += 6;
        doc.text(`Gás: ${formatCurrency(custoAtual.gas)}`, margin + 5, yPos);
      }
      yPos += 15;

      const operadorasParaPDF = operadora ? [resultados.find(r => r.operadora.id === operadora.id)] : resultados;

      operadorasParaPDF.forEach((resultado, index) => {
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.setFillColor(34, 197, 94);
        doc.rect(margin - 2, yPos - 6, pageWidth - 2 * margin + 4, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text(resultado.operadora.nome, margin, yPos);
        yPos += 12;

        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);

        doc.text(`Custo Mensal: ${formatCurrency(resultado.custoNovaOperadora.total)}`, margin, yPos);
        yPos += 6;
        doc.setFont(undefined, 'bold');
        doc.setTextColor(22, 163, 74);
        doc.text(`Poupança Mensal: ${formatCurrency(resultado.poupancaMensal)}`, margin, yPos);
        yPos += 6;
        doc.text(`Poupança Anual: ${formatCurrency(resultado.poupancaAnual)}`, margin, yPos);
        yPos += 10;

        doc.setFont(undefined, 'normal');
        doc.setTextColor(0, 0, 0);

        if (resultado.detalhesCalculo.eletricidade) {
          const det = resultado.detalhesCalculo.eletricidade;
          doc.text('Eletricidade:', margin, yPos);
          yPos += 6;
          doc.text(`  Potência: ${formatCurrency(det.custoPotenciaComDesconto)} (desconto: ${det.descontoPotencia}%)`, margin, yPos);
          yPos += 6;
          doc.text(`  Energia: ${formatCurrency(det.custoEnergiaComDesconto)} (desconto: ${det.descontoEnergia}%)`, margin, yPos);
          yPos += 8;
        }

        if (resultado.detalhesCalculo.gas) {
          const det = resultado.detalhesCalculo.gas;
          doc.text('Gás:', margin, yPos);
          yPos += 6;
          doc.text(`  Diário: ${formatCurrency(det.custoDiarioComDesconto)} (desconto: ${det.descontoDiario}%)`, margin, yPos);
          yPos += 6;
          doc.text(`  Energia: ${formatCurrency(det.custoEnergiaComDesconto)} (desconto: ${det.descontoEnergia}%)`, margin, yPos);
          yPos += 8;
        }

        if (resultado.detalhesCalculo.eletricidade?.campanhaAplicavel || resultado.detalhesCalculo.gas?.campanhaAplicavel) {
          const campanha = resultado.detalhesCalculo.eletricidade?.campanha || resultado.detalhesCalculo.gas?.campanha;
          if (campanha.desconto_mensal_temporario > 0) {
            doc.setFillColor(147, 51, 234);
            doc.rect(margin - 2, yPos - 2, pageWidth - 2 * margin + 4, 20, 'F');
            doc.setTextColor(255, 255, 255);
            doc.text('CAMPANHA ESPECIAL', margin, yPos + 3);
            yPos += 8;
            doc.text(`Desconto adicional: ${formatCurrency(campanha.desconto_mensal_temporario)}/mês`, margin, yPos);
            yPos += 6;
            doc.text(`Duração: ${campanha.duracao_meses_desconto} meses`, margin, yPos);
            yPos += 10;
            doc.setTextColor(0, 0, 0);
          }
        }

        yPos += 5;
      });

      yPos += 10;
      if (yPos > 260) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text('MP GRUPO - Comparador de Energia', margin, yPos);
      yPos += 4;
      doc.text('Contacto: geral@mpgrupo.pt | Tel: +351 XXX XXX XXX', margin, yPos);

      const fileName = operadora
        ? `MPGrupo_Simulacao_${operadora.nome.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
        : `MPGrupo_Simulacao_${new Date().toISOString().split('T')[0]}.pdf`;

      doc.save(fileName);
      toast.success('PDF exportado com sucesso!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Erro ao exportar PDF');
    }
  };

  const sendWhatsApp = (operadora = null, isAdesao = false) => {
    const baseNumber = '351XXXXXXXXX';

    let message = `Olá! Fiz uma simulação no simulador MP GRUPO.\n\n`;
    message += `*Custo Atual:* ${formatCurrency(custoAtual.total)}/mês\n\n`;

    if (operadora) {
      const resultado = resultados.find(r => r.operadora.id === operadora.id);
      if (resultado) {
        message += `*Operadora de Interesse:* ${operadora.nome}\n`;
        message += `*Novo Custo:* ${formatCurrency(resultado.custoNovaOperadora.total)}/mês\n`;
        message += `*Poupança Mensal:* ${formatCurrency(resultado.poupancaMensal)}\n`;
        message += `*Poupança Anual:* ${formatCurrency(resultado.poupancaAnual)}\n\n`;

        if (isAdesao) {
          message += `Gostaria de aderir a esta operadora. Podem contactar-me?\n`;
        } else {
          message += `Gostaria de mais informações sobre esta simulação.\n`;
        }
      }
    } else {
      message += `*Melhores Resultados:*\n`;
      resultados.slice(0, 3).forEach((r, i) => {
        message += `${i + 1}. ${r.operadora.nome}: ${formatCurrency(r.poupancaMensal)}/mês\n`;
      });
      message += `\nGostaria de mais informações.\n`;
    }

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${baseNumber}?text=${encodedMessage}`;

    window.open(whatsappUrl, '_blank');
  };

  const toggleExpanded = (operadoraId) => {
    setExpandedOperator(expandedOperator === operadoraId ? null : operadoraId);
  };

  const hasDD = simulationData.formData?.tem_debito_direto || simulationData.formData?.eletricidade?.tem_debito_direto;
  const hasFE = simulationData.formData?.tem_fatura_eletronica || simulationData.formData?.eletricidade?.tem_fatura_eletronica;
  const canImproveDiscount = !hasDD || !hasFE;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="border-white/10 bg-dark-800/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-2xl text-white flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-green-500" />
              Custo Atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {custoAtual.eletricidade > 0 && (
                <div className="bg-dark-700/50 p-4 rounded-lg">
                  <p className="text-dark-400 text-sm mb-1">Eletricidade</p>
                  <p className="text-2xl font-bold text-white">{formatCurrency(custoAtual.eletricidade)}</p>
                </div>
              )}
              {custoAtual.gas > 0 && (
                <div className="bg-dark-700/50 p-4 rounded-lg">
                  <p className="text-dark-400 text-sm mb-1">Gás</p>
                  <p className="text-2xl font-bold text-white">{formatCurrency(custoAtual.gas)}</p>
                </div>
              )}
              <div className="bg-gradient-to-br from-gold-400/20 to-gold-600/20 p-4 rounded-lg border border-gold-400/30">
                <p className="text-gold-400 text-sm mb-1">Total Mensal</p>
                <p className="text-3xl font-bold text-white">{formatCurrency(custoAtual.total)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {canImproveDiscount && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Alert className="bg-blue-500/10 border-blue-500/30">
            <AlertCircle className="h-4 w-4 text-blue-400" />
            <AlertDescription className="text-blue-300">
              <strong>Poupança Adicional Disponível!</strong> Pode obter descontos maiores aderindo a{' '}
              {!hasDD && !hasFE ? 'Débito Direto e Fatura Eletrónica' : !hasDD ? 'Débito Direto' : 'Fatura Eletrónica'}.
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold text-white">
            Melhores Opções para Si
          </h3>
          <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
            {resultados.length} {resultados.length === 1 ? 'resultado' : 'resultados'}
          </Badge>
        </div>

        {resultados.length === 0 && (
          <Alert className="bg-yellow-500/10 border-yellow-500/30">
            <AlertCircle className="h-4 w-4 text-yellow-400" />
            <AlertDescription className="text-yellow-300">
              Não foram encontradas operadoras com poupanças disponíveis para o seu perfil de consumo.
            </AlertDescription>
          </Alert>
        )}

        {resultados.map((resultado, index) => (
          <motion.div
            key={resultado.operadora.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 + index * 0.1 }}
          >
            <Card className={`border-white/10 bg-dark-800/50 backdrop-blur-sm overflow-hidden ${index === 0 ? 'ring-2 ring-green-500/50' : ''}`}>
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {resultado.operadora.logotipo_url && (
                      <img
                        src={resultado.operadora.logotipo_url}
                        alt={resultado.operadora.nome}
                        className="w-16 h-16 object-contain rounded-lg bg-white/5 p-2"
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-xl font-bold text-white">{resultado.operadora.nome}</h4>
                        {index === 0 && (
                          <Badge className="bg-green-500 text-white">Melhor Opção</Badge>
                        )}
                      </div>
                      <p className="text-dark-300 text-sm">
                        Novo custo: <span className="text-white font-semibold">{formatCurrency(resultado.custoNovaOperadora.total)}/mês</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
                    <div className="text-right">
                      <p className="text-dark-400 text-sm mb-1">Poupança Mensal</p>
                      <p className="text-3xl font-bold text-green-400">{formatCurrency(resultado.poupancaMensal)}</p>
                      <p className="text-dark-300 text-sm">
                        Anual: <span className="text-green-400 font-semibold">{formatCurrency(resultado.poupancaAnual)}</span>
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        onClick={() => toggleExpanded(resultado.operadora.id)}
                        variant="outline"
                        className="border-white/20 text-white hover:bg-white/10"
                      >
                        {expandedOperator === resultado.operadora.id ? (
                          <>
                            Ocultar Detalhes <ChevronUp className="w-4 h-4 ml-2" />
                          </>
                        ) : (
                          <>
                            Ver Detalhes <ChevronDown className="w-4 h-4 ml-2" />
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => sendWhatsApp(resultado.operadora, true)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Quero Aderir
                      </Button>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedOperator === resultado.operadora.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-6 pt-6 border-t border-white/10 space-y-4">
                        {resultado.detalhesCalculo.eletricidade && (
                          <div className="bg-dark-700/30 p-4 rounded-lg">
                            <h5 className="font-semibold text-white mb-3">Eletricidade</h5>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-dark-400">Potência (sem desconto)</p>
                                <p className="text-white">{formatCurrency(resultado.detalhesCalculo.eletricidade.custoPotenciaSemDesconto)}</p>
                              </div>
                              <div>
                                <p className="text-dark-400">Potência (com desconto {resultado.detalhesCalculo.eletricidade.descontoPotencia}%)</p>
                                <p className="text-green-400 font-semibold">{formatCurrency(resultado.detalhesCalculo.eletricidade.custoPotenciaComDesconto)}</p>
                              </div>
                              <div>
                                <p className="text-dark-400">Energia (sem desconto)</p>
                                <p className="text-white">{formatCurrency(resultado.detalhesCalculo.eletricidade.custoEnergiaSemDesconto)}</p>
                              </div>
                              <div>
                                <p className="text-dark-400">Energia (com desconto {resultado.detalhesCalculo.eletricidade.descontoEnergia}%)</p>
                                <p className="text-green-400 font-semibold">{formatCurrency(resultado.detalhesCalculo.eletricidade.custoEnergiaComDesconto)}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {resultado.detalhesCalculo.gas && (
                          <div className="bg-dark-700/30 p-4 rounded-lg">
                            <h5 className="font-semibold text-white mb-3">Gás Natural</h5>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-dark-400">Diário (sem desconto)</p>
                                <p className="text-white">{formatCurrency(resultado.detalhesCalculo.gas.custoDiarioSemDesconto)}</p>
                              </div>
                              <div>
                                <p className="text-dark-400">Diário (com desconto {resultado.detalhesCalculo.gas.descontoDiario}%)</p>
                                <p className="text-green-400 font-semibold">{formatCurrency(resultado.detalhesCalculo.gas.custoDiarioComDesconto)}</p>
                              </div>
                              <div>
                                <p className="text-dark-400">Energia (sem desconto)</p>
                                <p className="text-white">{formatCurrency(resultado.detalhesCalculo.gas.custoEnergiaSemDesconto)}</p>
                              </div>
                              <div>
                                <p className="text-dark-400">Energia (com desconto {resultado.detalhesCalculo.gas.descontoEnergia}%)</p>
                                <p className="text-green-400 font-semibold">{formatCurrency(resultado.detalhesCalculo.gas.custoEnergiaComDesconto)}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {(resultado.detalhesCalculo.eletricidade?.campanhaAplicavel || resultado.detalhesCalculo.gas?.campanhaAplicavel) && (
                          <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 p-4 rounded-lg border border-purple-500/30">
                            <div className="flex items-start gap-3">
                              <Gift className="w-5 h-5 text-purple-400 flex-shrink-0 mt-1" />
                              <div>
                                <h5 className="font-semibold text-purple-300 mb-2">Campanha Especial Disponível!</h5>
                                {resultado.detalhesCalculo.eletricidade?.campanha && (
                                  <div className="text-sm text-purple-200 space-y-1">
                                    <p>Desconto adicional: <strong>{formatCurrency(resultado.detalhesCalculo.eletricidade.campanha.desconto_mensal_temporario)}/mês</strong></p>
                                    <p>Duração: <strong>{resultado.detalhesCalculo.eletricidade.campanha.duracao_meses_desconto} meses</strong></p>
                                    {resultado.detalhesCalculo.eletricidade.campanha.descricao_desconto_temporario && (
                                      <p className="italic">{resultado.detalhesCalculo.eletricidade.campanha.descricao_desconto_temporario}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => exportToPDF(resultado.operadora)}
                            variant="outline"
                            className="border-white/20 text-white hover:bg-white/10"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Exportar Esta Opção
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="bg-dark-800/30 p-4 rounded-lg border border-white/10">
        <p className="text-dark-300 text-sm">
          <strong>Nota:</strong> Esta simulação não considera a tarifa social de energia. Se é beneficiário da tarifa social, consulte os valores específicos junto da sua operadora.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 justify-center">
        <Button
          onClick={onBack}
          variant="outline"
          className="border-white/20 text-white hover:bg-white/10"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <Button
          onClick={() => exportToPDF()}
          variant="outline"
          className="border-white/20 text-white hover:bg-white/10"
        >
          <Download className="w-4 h-4 mr-2" />
          Exportar Todas
        </Button>
        <Button
          onClick={() => sendWhatsApp()}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <MessageCircle className="w-4 h-4 mr-2" />
          Contactar por WhatsApp
        </Button>
        <Button
          onClick={onNewSimulation}
          className="bg-gold-400 hover:bg-gold-500 text-dark-900 font-semibold"
        >
          <X className="w-4 h-4 mr-2" />
          Nova Simulação
        </Button>
      </div>
    </div>
  );
};

export default ResultsStep;
