import React, { useState } from 'react';
import { ArrowLeft, Download, ChevronDown, ChevronUp, TrendingUp, CircleAlert as AlertCircle, Gift, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';

const ResultsStep = ({ simulationData, onBack, onNewSimulation, user }) => {
  const [expandedOperator, setExpandedOperator] = useState(null);
  const { custoAtual, resultados, todosResultados } = simulationData;

  const formDataEl = simulationData.formData?.eletricidade || simulationData.formData || {};
  const formDataGas = simulationData.formData?.gas || simulationData.formData || {};

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatUnitPrice = (value) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 6,
      maximumFractionDigits: 6
    }).format(value);
  };

  const exportToPDF = async (operadora = null) => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      const colW = (pageWidth - margin * 2) / 5;
      let yPos = 20;

      const checkPageBreak = (needed = 10) => {
        if (yPos + needed > 280) {
          doc.addPage();
          yPos = 20;
        }
      };

      const drawSectionTitle = (title, r, g, b) => {
        checkPageBreak(12);
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.setFillColor(r, g, b);
        doc.rect(margin - 2, yPos - 5, pageWidth - 2 * margin + 4, 9, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text(title, margin, yPos);
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'normal');
        yPos += 8;
      };

      const drawTableHeader = (cols) => {
        checkPageBreak(8);
        doc.setFontSize(8);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(80, 80, 80);
        cols.forEach((col, i) => {
          const xPos = margin + i * colW + (i > 0 ? colW * 0.05 : 0);
          doc.text(col.label, xPos + (i === 0 ? 0 : colW * 0.95), yPos, { align: i === 0 ? 'left' : 'right' });
        });
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, yPos + 1.5, pageWidth - margin, yPos + 1.5);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(0, 0, 0);
        yPos += 6;
      };

      const drawTableRow = (label, sublabel, values, highlight = false) => {
        checkPageBreak(10);
        doc.setFontSize(8.5);
        if (highlight) {
          doc.setFillColor(240, 255, 240);
          doc.rect(margin - 2, yPos - 5, pageWidth - 2 * margin + 4, 9, 'F');
        }
        doc.setFont(undefined, 'bold');
        doc.setTextColor(30, 30, 30);
        doc.text(label, margin, yPos);
        if (sublabel) {
          doc.setFont(undefined, 'normal');
          doc.setFontSize(7);
          doc.setTextColor(120, 120, 120);
          doc.text(sublabel, margin, yPos + 3.5);
        }
        doc.setFont(undefined, 'normal');
        doc.setFontSize(8.5);
        values.forEach((val, i) => {
          if (val === null || val === undefined) return;
          const xPos = margin + (i + 1) * colW + colW * 0.95;
          const isDiscount = i === 1 || i === 3;
          doc.setTextColor(isDiscount ? 22 : 50, isDiscount ? 163 : 50, isDiscount ? 74 : 50);
          doc.text(String(val), xPos, yPos, { align: 'right' });
        });
        doc.setTextColor(0, 0, 0);
        yPos += sublabel ? 7 : 6;
      };

      const partnerName = user?.name || 'MP GRUPO';

      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(40, 120, 200);
      doc.text(partnerName, margin, yPos);
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('O seu comercial de energias.', margin, yPos + 6);
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text('Simulação de Energia', pageWidth - margin, yPos, { align: 'right' });
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`Data: ${new Date().toLocaleDateString('pt-PT')}`, pageWidth - margin, yPos + 6, { align: 'right' });
      yPos += 16;
      doc.setDrawColor(40, 120, 200);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 8;

      const formData = simulationData.formData || {};
      const elForm = formData.eletricidade || formData;
      const gasForm = formData.gas || formData;
      const hasDD = formData.tem_debito_direto || elForm.tem_debito_direto;
      const hasFE = formData.tem_fatura_eletronica || elForm.tem_fatura_eletronica;

      drawSectionTitle('Dados do Consumo Atual', 60, 80, 120);

      doc.setFontSize(8.5);
      doc.setTextColor(50, 50, 50);

      const tipoLabel = formData.tipo_energia === 'dual' ? 'Dual (Eletricidade + Gás)' : formData.tipo_energia === 'gas' ? 'Gás Natural' : 'Eletricidade';
      doc.text(`Tipo de Energia: ${tipoLabel}`, margin, yPos);
      yPos += 5;

      if (elForm.operadora_atual) {
        doc.text(`Operadora Atual: ${elForm.operadora_atual}`, margin, yPos);
        yPos += 5;
      }

      const condStr = [];
      if (hasDD) condStr.push('Débito Direto');
      if (hasFE) condStr.push('Fatura Eletrónica');
      if (condStr.length > 0) {
        doc.text(`Condições Atuais: ${condStr.join(' + ')}`, margin, yPos);
        yPos += 5;
      }

      if (custoAtual.eletricidade > 0 || custoAtual.gas > 0) {
        yPos += 2;
        if (custoAtual.eletricidade > 0) {
          doc.text(`Custo Mensal Eletricidade: ${formatCurrency(custoAtual.eletricidade)}`, margin + 5, yPos);
          yPos += 5;
        }
        if (custoAtual.gas > 0) {
          doc.text(`Custo Mensal Gás: ${formatCurrency(custoAtual.gas)}`, margin + 5, yPos);
          yPos += 5;
        }
      }

      doc.setFont(undefined, 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 30, 30);
      doc.text(`Custo Total Mensal Atual: ${formatCurrency(custoAtual.total)}`, margin, yPos);
      doc.setFont(undefined, 'normal');
      yPos += 10;

      if (formData.tipo_energia !== 'gas' && elForm.potencia) {
        doc.setFontSize(8.5);
        doc.setTextColor(50, 50, 50);
        const cicloLabel = elForm.ciclo === 'simples' ? 'Simples' : elForm.ciclo === 'bi-horario' ? 'Bi-horário' : elForm.ciclo === 'tri-horario' ? 'Tri-horário' : (elForm.ciclo || '');
        const elDetails = [];
        if (elForm.potencia) elDetails.push(`Potência: ${elForm.potencia} kW`);
        if (cicloLabel) elDetails.push(`Ciclo: ${cicloLabel}`);
        if (elForm.dias) elDetails.push(`Dias: ${elForm.dias}`);
        if (elDetails.length > 0) {
          doc.text(elDetails.join('   |   '), margin, yPos);
          yPos += 5;
        }
        const consumos = elForm.consumos || {};
        const consumoDetails = [];
        if (consumos.energia) consumoDetails.push(`Simples: ${consumos.energia} kWh`);
        if (consumos.vazio) consumoDetails.push(`Vazio: ${consumos.vazio} kWh`);
        if (consumos.fora_vazio) consumoDetails.push(`Fora Vazio: ${consumos.fora_vazio} kWh`);
        if (consumos.cheia) consumoDetails.push(`Cheia: ${consumos.cheia} kWh`);
        if (consumos.ponta) consumoDetails.push(`Ponta: ${consumos.ponta} kWh`);
        if (consumoDetails.length > 0) {
          doc.text(`Consumos: ${consumoDetails.join('   ')}`, margin, yPos);
          yPos += 5;
        }
      }

      if (formData.tipo_energia !== 'eletricidade' && gasForm.consumo_kwh) {
        doc.setFontSize(8.5);
        doc.setTextColor(50, 50, 50);
        const gasDetails = [];
        if (gasForm.escalao) gasDetails.push(`Escalão: ${gasForm.escalao}`);
        if (gasForm.consumo_kwh) gasDetails.push(`Consumo: ${gasForm.consumo_kwh} kWh`);
        if (gasForm.dias) gasDetails.push(`Dias: ${gasForm.dias}`);
        if (gasDetails.length > 0) {
          doc.text(gasDetails.join('   |   '), margin, yPos);
          yPos += 5;
        }
      }

      yPos += 5;

      const operadorasParaPDF = operadora ? [resultados.find(r => r.operadora.id === operadora.id)] : resultados;

      operadorasParaPDF.forEach((resultado, index) => {
        checkPageBreak(20);

        const headerColor = index === 0 ? [22, 163, 74] : index === 1 ? [37, 99, 235] : [107, 114, 128];
        drawSectionTitle(
          `${index + 1}. ${resultado.operadora.nome}${index === 0 ? '  ★ Melhor Opção' : ''}`,
          headerColor[0], headerColor[1], headerColor[2]
        );

        doc.setFontSize(9);
        doc.setTextColor(30, 30, 30);

        const col1X = margin;
        const col2X = margin + (pageWidth - 2 * margin) / 3;
        const col3X = margin + 2 * (pageWidth - 2 * margin) / 3;

        doc.setFont(undefined, 'normal');
        doc.text(`Custo Mensal: ${formatCurrency(resultado.custoNovaOperadora.total)}`, col1X, yPos);

        doc.setFont(undefined, 'bold');
        doc.setTextColor(22, 163, 74);
        doc.text(`Poupança Mensal: ${formatCurrency(resultado.poupancaMensal)}`, col2X, yPos);
        doc.text(`Poupança Anual: ${formatCurrency(resultado.poupancaAnual)}`, col3X, yPos);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(0, 0, 0);
        yPos += 7;

        if (resultado.custoNovaOperadora.eletricidade > 0 && resultado.custoNovaOperadora.gas > 0) {
          doc.setFontSize(8);
          doc.setTextColor(80, 80, 80);
          doc.text(`  Eletricidade: ${formatCurrency(resultado.custoNovaOperadora.eletricidade)}   Gás: ${formatCurrency(resultado.custoNovaOperadora.gas)}`, margin, yPos);
          yPos += 5;
          doc.setTextColor(0, 0, 0);
        }

        yPos += 3;

        if (resultado.detalhesCalculo.eletricidade) {
          const det = resultado.detalhesCalculo.eletricidade;
          checkPageBreak(50);

          doc.setFontSize(9);
          doc.setFont(undefined, 'bold');
          doc.setTextColor(30, 30, 30);
          doc.text('Eletricidade — Detalhe de Preços e Custos', margin, yPos);
          yPos += 5;

          drawTableHeader([
            { label: 'Componente' },
            { label: 'Preço Unit.' },
            { label: 'Preço c/ Desc.' },
            { label: 'Total s/ Desc.' },
            { label: 'Total c/ Desc.' }
          ]);

          drawTableRow(
            'Potência', '(€/kW/dia)',
            [
              formatUnitPrice(det.precoPotenciaUnitario),
              formatUnitPrice(det.precoPotenciaUnitarioComDesconto),
              formatCurrency(det.custoPotenciaSemDesconto),
              formatCurrency(det.custoPotenciaComDesconto)
            ]
          );

          if (det.descontoPotencia > 0) {
            doc.setFontSize(7.5);
            doc.setTextColor(100, 100, 100);
            doc.text(`  Desconto aplicado: ${det.descontoPotencia}%`, margin + 5, yPos + 2);
            yPos += 5;
            doc.setTextColor(0, 0, 0);
          }

          if (typeof det.precoEnergiaUnitario === 'number') {
            drawTableRow(
              'Energia', '(€/kWh)',
              [
                formatUnitPrice(det.precoEnergiaUnitario),
                formatUnitPrice(det.precoEnergiaUnitarioComDesconto),
                formatCurrency(det.custoEnergiaSemDesconto),
                formatCurrency(det.custoEnergiaComDesconto)
              ]
            );
            if (det.descontoEnergia > 0) {
              doc.setFontSize(7.5);
              doc.setTextColor(100, 100, 100);
              doc.text(`  Desconto aplicado: ${det.descontoEnergia}%`, margin + 5, yPos + 2);
              yPos += 5;
              doc.setTextColor(0, 0, 0);
            }
          } else if (det.precoEnergiaUnitario) {
            const periodoLabels = { vazio: 'Energia Vazio', fora_vazio: 'Energia Fora Vazio', cheia: 'Energia Cheia', ponta: 'Energia Ponta' };
            Object.entries(det.precoEnergiaUnitario).forEach(([periodo, preco]) => {
              const precoComDesc = det.precoEnergiaUnitarioComDesconto?.[periodo] || 0;
              drawTableRow(
                periodoLabels[periodo] || periodo, '(€/kWh)',
                [formatUnitPrice(preco), formatUnitPrice(precoComDesc), '—', '—']
              );
            });
            drawTableRow(
              'Total Energia', null,
              [null, null, formatCurrency(det.custoEnergiaSemDesconto), formatCurrency(det.custoEnergiaComDesconto)]
            );
            if (det.descontoEnergia > 0) {
              doc.setFontSize(7.5);
              doc.setTextColor(100, 100, 100);
              doc.text(`  Desconto aplicado: ${det.descontoEnergia}%`, margin + 5, yPos + 2);
              yPos += 5;
              doc.setTextColor(0, 0, 0);
            }
          }

          checkPageBreak(8);
          doc.setDrawColor(200, 200, 200);
          doc.line(margin, yPos - 1, pageWidth - margin, yPos - 1);
          drawTableRow(
            'TOTAL ELETRICIDADE', null,
            [null, null,
              formatCurrency(det.custoPotenciaSemDesconto + det.custoEnergiaSemDesconto),
              formatCurrency(det.custoPotenciaComDesconto + det.custoEnergiaComDesconto)
            ],
            true
          );
          yPos += 3;
        }

        if (resultado.detalhesCalculo.gas) {
          const det = resultado.detalhesCalculo.gas;
          checkPageBreak(45);

          doc.setFontSize(9);
          doc.setFont(undefined, 'bold');
          doc.setTextColor(30, 30, 30);
          doc.text('Gás Natural — Detalhe de Preços e Custos', margin, yPos);
          yPos += 5;

          drawTableHeader([
            { label: 'Componente' },
            { label: 'Preço Unit.' },
            { label: 'Preço c/ Desc.' },
            { label: 'Total s/ Desc.' },
            { label: 'Total c/ Desc.' }
          ]);

          drawTableRow(
            'Valor Diário', '(€/dia)',
            [
              formatUnitPrice(det.precoDiarioUnitario),
              formatUnitPrice(det.precoDiarioUnitarioComDesconto),
              formatCurrency(det.custoDiarioSemDesconto),
              formatCurrency(det.custoDiarioComDesconto)
            ]
          );
          if (det.descontoDiario > 0) {
            doc.setFontSize(7.5);
            doc.setTextColor(100, 100, 100);
            doc.text(`  Desconto aplicado: ${det.descontoDiario}%`, margin + 5, yPos + 2);
            yPos += 5;
            doc.setTextColor(0, 0, 0);
          }

          drawTableRow(
            'Energia', '(€/kWh)',
            [
              formatUnitPrice(det.precoEnergiaUnitario),
              formatUnitPrice(det.precoEnergiaUnitarioComDesconto),
              formatCurrency(det.custoEnergiaSemDesconto),
              formatCurrency(det.custoEnergiaComDesconto)
            ]
          );
          if (det.descontoEnergia > 0) {
            doc.setFontSize(7.5);
            doc.setTextColor(100, 100, 100);
            doc.text(`  Desconto aplicado: ${det.descontoEnergia}%`, margin + 5, yPos + 2);
            yPos += 5;
            doc.setTextColor(0, 0, 0);
          }

          checkPageBreak(8);
          doc.setDrawColor(200, 200, 200);
          doc.line(margin, yPos - 1, pageWidth - margin, yPos - 1);
          drawTableRow(
            'TOTAL GÁS', null,
            [null, null,
              formatCurrency(det.custoDiarioSemDesconto + det.custoEnergiaSemDesconto),
              formatCurrency(det.custoDiarioComDesconto + det.custoEnergiaComDesconto)
            ],
            true
          );
          yPos += 3;
        }

        if (resultado.descontoMensalCampanha > 0) {
          checkPageBreak(35);
          doc.setFillColor(255, 243, 220);
          doc.rect(margin - 2, yPos - 2, pageWidth - 2 * margin + 4, 34, 'F');
          doc.setDrawColor(255, 180, 60);
          doc.rect(margin - 2, yPos - 2, pageWidth - 2 * margin + 4, 34);
          doc.setFontSize(9);
          doc.setFont(undefined, 'bold');
          doc.setTextColor(160, 80, 0);
          doc.text('CAMPANHA ESPECIAL', margin, yPos + 4);
          doc.setFont(undefined, 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(100, 50, 0);
          doc.text(`Duração: ${resultado.duracaoCampanha} meses`, margin, yPos + 11);
          doc.text(`Custo mensal com campanha: ${formatCurrency(resultado.custoComCampanha)}`, margin, yPos + 17);
          doc.text(`Desconto adicional mensal: ${formatCurrency(resultado.descontoMensalCampanha)}`, margin + (pageWidth - 2 * margin) / 2, yPos + 17);
          doc.setFont(undefined, 'bold');
          doc.setTextColor(130, 60, 0);
          doc.text(`Poupança c/ campanha: ${formatCurrency(resultado.poupancaMensalComCampanha)}/mês  |  Anual: ${formatCurrency(resultado.poupancaAnualComCampanha)}`, margin, yPos + 25);
          const descCamp = resultado.detalhesCalculo.eletricidade?.campanha?.descricao_desconto_temporario || resultado.detalhesCalculo.gas?.campanha?.descricao_desconto_temporario;
          if (descCamp) {
            doc.setFont(undefined, 'italic');
            doc.setFontSize(7.5);
            doc.setTextColor(120, 70, 10);
            doc.text(descCamp, margin, yPos + 30);
          }
          doc.setTextColor(0, 0, 0);
          yPos += 40;
        }

        yPos += 5;
      });

      checkPageBreak(20);
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 5;

      doc.setFontSize(7.5);
      doc.setTextColor(120, 120, 120);
      doc.text('Nota: Esta simulação não considera a tarifa social de energia. Se é beneficiário da tarifa social, consulte os valores específicos junto da sua operadora.', margin, yPos, { maxWidth: pageWidth - 2 * margin });
      yPos += 9;

      doc.setFont(undefined, 'bold');
      doc.setTextColor(40, 120, 200);
      doc.text(`${partnerName} — Comparador de Energia`, margin, yPos);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(100, 100, 100);
      const contactParts = [];
      if (user?.contact_email) contactParts.push(user.contact_email);
      if (user?.contact_phone) contactParts.push(user.contact_phone);
      if (contactParts.length > 0) {
        doc.text(`Contacto: ${contactParts.join(' | ')}`, margin, yPos + 5);
      }

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

      {canImproveDiscount && resultados.length > 0 && (() => {
        const melhorResultado = resultados[0];
        const detalhes = melhorResultado.detalhesCalculo;

        let descontoAdicional = 0;

        if (detalhes.eletricidade) {
          const campanha = detalhes.eletricidade.campanha || {};
          const descontoAtualPot = hasDD && hasFE ? parseFloat(campanha.desconto_dd_fe_potencia || 0)
                                 : hasDD ? parseFloat(campanha.desconto_dd_potencia || 0)
                                 : hasFE ? parseFloat(campanha.desconto_fe_potencia || 0)
                                 : parseFloat(campanha.desconto_base_potencia || 0);
          const descontoMaxPot = parseFloat(campanha.desconto_dd_fe_potencia || 0);
          const diferencaPot = descontoMaxPot - descontoAtualPot;

          const descontoAtualEng = hasDD && hasFE ? parseFloat(campanha.desconto_dd_fe_energia || 0)
                                 : hasDD ? parseFloat(campanha.desconto_dd_energia || 0)
                                 : hasFE ? parseFloat(campanha.desconto_fe_energia || 0)
                                 : parseFloat(campanha.desconto_base_energia || 0);
          const descontoMaxEng = parseFloat(campanha.desconto_dd_fe_energia || 0);
          const diferencaEng = descontoMaxEng - descontoAtualEng;

          const custoPot = detalhes.eletricidade.custoPotenciaSemDesconto || 0;
          const custoEng = detalhes.eletricidade.custoEnergiaSemDesconto || 0;

          descontoAdicional += (custoPot * diferencaPot / 100) + (custoEng * diferencaEng / 100);
        }

        if (detalhes.gas) {
          const campanha = detalhes.gas.campanha || {};
          const descontoAtualDiario = hasDD && hasFE ? parseFloat(campanha.desconto_dd_fe_potencia || 0)
                                    : hasDD ? parseFloat(campanha.desconto_dd_potencia || 0)
                                    : hasFE ? parseFloat(campanha.desconto_fe_potencia || 0)
                                    : parseFloat(campanha.desconto_base_potencia || 0);
          const descontoMaxDiario = parseFloat(campanha.desconto_dd_fe_potencia || 0);
          const diferencaDiario = descontoMaxDiario - descontoAtualDiario;

          const descontoAtualEng = hasDD && hasFE ? parseFloat(campanha.desconto_dd_fe_energia || 0)
                                 : hasDD ? parseFloat(campanha.desconto_dd_energia || 0)
                                 : hasFE ? parseFloat(campanha.desconto_fe_energia || 0)
                                 : parseFloat(campanha.desconto_base_energia || 0);
          const descontoMaxEng = parseFloat(campanha.desconto_dd_fe_energia || 0);
          const diferencaEng = descontoMaxEng - descontoAtualEng;

          const custoDiario = detalhes.gas.custoDiarioSemDesconto || 0;
          const custoEng = detalhes.gas.custoEnergiaSemDesconto || 0;

          descontoAdicional += (custoDiario * diferencaDiario / 100) + (custoEng * diferencaEng / 100);
        }

        return (
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
                {descontoAdicional > 0 && (
                  <> Com ambos, pouparia mais <strong>{formatCurrency(descontoAdicional)}/mês</strong>.</>
                )}
              </AlertDescription>
            </Alert>
          </motion.div>
        );
      })()}

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
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-3">
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

                    {resultado.descontoMensalCampanha > 0 && (
                      <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 p-3 rounded-lg border border-amber-500/30 mb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <Gift className="w-4 h-4 text-amber-400" />
                          <span className="font-semibold text-amber-300 text-sm">Campanha Especial</span>
                        </div>
                        <p className="text-sm text-amber-200">
                          Durante <strong>{resultado.duracaoCampanha} meses</strong>, o custo mensal será de{' '}
                          <strong className="text-amber-100">{formatCurrency(resultado.custoComCampanha)}</strong>
                          {' '}(desconto adicional de <strong>{formatCurrency(resultado.descontoMensalCampanha)}/mês</strong>)
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
                    <div className="text-right">
                      {resultado.descontoMensalCampanha > 0 ? (
                        <>
                          <p className="text-dark-400 text-sm mb-1">Poupança c/ Campanha</p>
                          <p className="text-3xl font-bold text-amber-400">{formatCurrency(resultado.poupancaMensalComCampanha)}</p>
                          <p className="text-dark-300 text-sm">
                            Sem campanha: <span className="text-green-400 font-semibold">{formatCurrency(resultado.poupancaMensal)}/mês</span>
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-dark-400 text-sm mb-1">Poupança Mensal</p>
                          <p className="text-3xl font-bold text-green-400">{formatCurrency(resultado.poupancaMensal)}</p>
                          <p className="text-dark-300 text-sm">
                            Anual: <span className="text-green-400 font-semibold">{formatCurrency(resultado.poupancaAnual)}</span>
                          </p>
                        </>
                      )}
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
                            <h5 className="font-semibold text-white mb-4">Detalhamento Eletricidade</h5>
                            <div className="space-y-3">
                              <div className="grid grid-cols-4 gap-2 pb-2 border-b border-white/10">
                                <span className="text-dark-300 text-xs font-medium col-span-1">Componente</span>
                                <span className="text-slate-400 text-xs font-medium text-right">Consumo Cliente</span>
                                <span className="text-blue-400 text-xs font-medium text-right">Preço Unit. c/ Desc.</span>
                                <span className="text-green-400 text-xs font-medium text-right">Total c/ Desc.</span>
                              </div>
                              <div className="grid grid-cols-4 gap-2 items-center">
                                <div className="col-span-1">
                                  <span className="text-white text-sm">Potência</span>
                                  <p className="text-dark-400 text-xs">(€/kW/dia)</p>
                                </div>
                                <div className="text-slate-300 text-xs text-right">
                                  {formDataEl.potencia ? <span>{formDataEl.potencia} kVA</span> : <span>—</span>}
                                  {formDataEl.dias && <p className="text-dark-400">{formDataEl.dias} dias</p>}
                                </div>
                                <span className="text-blue-400 text-xs text-right font-semibold">{formatUnitPrice(resultado.detalhesCalculo.eletricidade.precoPotenciaUnitarioComDesconto)}</span>
                                <span className="text-green-400 text-sm text-right font-semibold">{formatCurrency(resultado.detalhesCalculo.eletricidade.custoPotenciaComDesconto)}</span>
                              </div>
                              {typeof resultado.detalhesCalculo.eletricidade.precoEnergiaUnitario === 'number' ? (
                                <div className="grid grid-cols-4 gap-2 items-center">
                                  <div className="col-span-1">
                                    <span className="text-white text-sm">Energia</span>
                                    <p className="text-dark-400 text-xs">(€/kWh)</p>
                                  </div>
                                  <span className="text-slate-300 text-xs text-right">
                                    {formDataEl.consumos?.energia ? `${formDataEl.consumos.energia} kWh` : '—'}
                                  </span>
                                  <span className="text-blue-400 text-xs text-right font-semibold">{formatUnitPrice(resultado.detalhesCalculo.eletricidade.precoEnergiaUnitarioComDesconto)}</span>
                                  <span className="text-green-400 text-sm text-right font-semibold">{formatCurrency(resultado.detalhesCalculo.eletricidade.custoEnergiaComDesconto)}</span>
                                </div>
                              ) : (
                                <>
                                  {Object.entries(resultado.detalhesCalculo.eletricidade.precoEnergiaUnitario || {}).map(([periodo, preco]) => {
                                    const periodoLabel = periodo === 'vazio' ? 'Energia Vazio' : periodo === 'fora_vazio' ? 'Energia Fora Vazio' : periodo === 'cheia' ? 'Energia Cheia' : 'Energia Ponta';
                                    const precoComDesc = resultado.detalhesCalculo.eletricidade.precoEnergiaUnitarioComDesconto?.[periodo] || 0;
                                    const consumoPeriodo = formDataEl.consumos?.[periodo];
                                    return (
                                      <div key={periodo} className="grid grid-cols-4 gap-2 items-center">
                                        <div className="col-span-1">
                                          <span className="text-white text-sm">{periodoLabel}</span>
                                          <p className="text-dark-400 text-xs">(€/kWh)</p>
                                        </div>
                                        <span className="text-slate-300 text-xs text-right">
                                          {consumoPeriodo ? `${consumoPeriodo} kWh` : '—'}
                                        </span>
                                        <span className="text-blue-400 text-xs text-right font-semibold">{formatUnitPrice(precoComDesc)}</span>
                                        <span className="text-dark-400 text-xs text-right">—</span>
                                      </div>
                                    );
                                  })}
                                  <div className="grid grid-cols-4 gap-2 items-center">
                                    <span className="text-dark-400 text-xs col-span-2">Total Energia</span>
                                    <span className="text-dark-400 text-xs text-right">—</span>
                                    <span className="text-green-400 text-xs text-right font-semibold">{formatCurrency(resultado.detalhesCalculo.eletricidade.custoEnergiaComDesconto)}</span>
                                  </div>
                                </>
                              )}
                              <div className="grid grid-cols-4 gap-2 items-center pt-2 border-t border-white/10">
                                <span className="text-white text-sm font-semibold col-span-3">Total Eletricidade</span>
                                <span className="text-green-400 text-sm text-right font-semibold">
                                  {formatCurrency(resultado.detalhesCalculo.eletricidade.custoPotenciaComDesconto + resultado.detalhesCalculo.eletricidade.custoEnergiaComDesconto)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {resultado.detalhesCalculo.gas && (
                          <div className="bg-dark-700/30 p-4 rounded-lg">
                            <h5 className="font-semibold text-white mb-4">Detalhamento Gás Natural</h5>
                            <div className="space-y-3">
                              <div className="grid grid-cols-4 gap-2 pb-2 border-b border-white/10">
                                <span className="text-dark-300 text-xs font-medium col-span-1">Componente</span>
                                <span className="text-slate-400 text-xs font-medium text-right">Consumo Cliente</span>
                                <span className="text-blue-400 text-xs font-medium text-right">Preço Unit. c/ Desc.</span>
                                <span className="text-green-400 text-xs font-medium text-right">Total c/ Desc.</span>
                              </div>
                              <div className="grid grid-cols-4 gap-2 items-center">
                                <div className="col-span-1">
                                  <span className="text-white text-sm">Valor Diário</span>
                                  <p className="text-dark-400 text-xs">(€/dia)</p>
                                </div>
                                <div className="text-slate-300 text-xs text-right">
                                  {formDataGas.valor_diario ? <span>{formDataGas.valor_diario} €/dia</span> : <span>—</span>}
                                  {formDataGas.dias && <p className="text-dark-400">{formDataGas.dias} dias</p>}
                                </div>
                                <span className="text-blue-400 text-xs text-right font-semibold">{formatUnitPrice(resultado.detalhesCalculo.gas.precoDiarioUnitarioComDesconto)}</span>
                                <span className="text-green-400 text-sm text-right font-semibold">{formatCurrency(resultado.detalhesCalculo.gas.custoDiarioComDesconto)}</span>
                              </div>
                              <div className="grid grid-cols-4 gap-2 items-center">
                                <div className="col-span-1">
                                  <span className="text-white text-sm">Energia</span>
                                  <p className="text-dark-400 text-xs">(€/kWh)</p>
                                </div>
                                <span className="text-slate-300 text-xs text-right">
                                  {formDataGas.consumo_kwh ? `${formDataGas.consumo_kwh} kWh` : '—'}
                                </span>
                                <span className="text-blue-400 text-xs text-right font-semibold">{formatUnitPrice(resultado.detalhesCalculo.gas.precoEnergiaUnitarioComDesconto)}</span>
                                <span className="text-green-400 text-sm text-right font-semibold">{formatCurrency(resultado.detalhesCalculo.gas.custoEnergiaComDesconto)}</span>
                              </div>
                              <div className="grid grid-cols-4 gap-2 items-center pt-2 border-t border-white/10">
                                <span className="text-white text-sm font-semibold col-span-3">Total Gás</span>
                                <span className="text-green-400 text-sm text-right font-semibold">
                                  {formatCurrency(resultado.detalhesCalculo.gas.custoDiarioComDesconto + resultado.detalhesCalculo.gas.custoEnergiaComDesconto)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {resultado.descontoMensalCampanha > 0 && (
                          <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 p-4 rounded-lg border border-amber-500/30">
                            <div className="flex items-start gap-3">
                              <Gift className="w-5 h-5 text-amber-400 flex-shrink-0 mt-1" />
                              <div>
                                <h5 className="font-semibold text-amber-300 mb-2">Campanha Especial Disponível!</h5>
                                <div className="text-sm text-amber-200 space-y-1">
                                  <p>Desconto adicional: <strong>{formatCurrency(resultado.descontoMensalCampanha)}/mês</strong></p>
                                  <p>Duração: <strong>{resultado.duracaoCampanha} meses</strong></p>
                                  <p>Custo mensal com campanha: <strong className="text-amber-100">{formatCurrency(resultado.custoComCampanha)}</strong></p>
                                  <p>Poupança com campanha: <strong className="text-amber-100">{formatCurrency(resultado.poupancaMensalComCampanha)}/mês</strong></p>
                                  {(resultado.detalhesCalculo.eletricidade?.campanha?.descricao_desconto_temporario || resultado.detalhesCalculo.gas?.campanha?.descricao_desconto_temporario) && (
                                    <p className="italic opacity-80">{resultado.detalhesCalculo.eletricidade?.campanha?.descricao_desconto_temporario || resultado.detalhesCalculo.gas?.campanha?.descricao_desconto_temporario}</p>
                                  )}
                                </div>
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
