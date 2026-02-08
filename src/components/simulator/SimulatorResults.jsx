import React, { useState } from 'react';
import { Download, ChevronDown, ChevronUp, TrendingDown, Zap, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SimulatorResults = ({ results, formData, user }) => {
  const [expandedPlan, setExpandedPlan] = useState(null);

  const handleExportPDF = async () => {
    const jsPDF = (await import('jspdf')).default;
    const doc = new jsPDF();

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    let yPos = margin;

    doc.setFillColor(26, 32, 44);
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('MP GRUPO', margin, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Consultor: ${user?.name || 'N/A'}`, margin, 30);

    const dateStr = new Date().toLocaleDateString('pt-PT');
    const dateWidth = doc.getTextWidth(dateStr);
    doc.text(dateStr, pageWidth - margin - dateWidth, 30);

    yPos = 50;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Simulacao de Poupanca Energetica', margin, yPos);
    yPos += 15;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    doc.text(`Tipo de Energia: ${formData.energyType}`, margin, yPos);
    yPos += 7;

    if (formData.energyType === 'eletricidade' || formData.energyType === 'dual') {
      doc.text(`Potencia: ${formData.power} kVA`, margin, yPos);
      yPos += 7;
      doc.text(`Tarifa: ${formData.tariffType}`, margin, yPos);
      yPos += 7;
      const totalElec = Object.values(formData.consumption).reduce((a, b) => parseFloat(a || 0) + parseFloat(b || 0), 0);
      doc.text(`Consumo Eletricidade: ${totalElec.toFixed(0)} kWh/mes`, margin, yPos);
      yPos += 7;
    }

    if (formData.energyType === 'gas' || formData.energyType === 'dual') {
      doc.text(`Consumo Gas: ${formData.gasConsumption} m3/mes`, margin, yPos);
      yPos += 7;
    }

    yPos += 5;

    if (results.bestSavings > 0) {
      doc.setFillColor(220, 252, 231);
      doc.roundedRect(margin, yPos, contentWidth, 20, 3, 3, 'F');
      doc.setTextColor(22, 163, 74);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`Melhor poupanca possivel: ${results.bestSavings.toFixed(2)} EUR/mes`, margin + 5, yPos + 12);
      yPos += 30;
    } else {
      yPos += 10;
    }

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Planos Recomendados', margin, yPos);
    yPos += 10;

    const rankedPlans = results.plans.slice(0, 5);

    rankedPlans.forEach((plan, index) => {
      if (yPos > pageHeight - 60) {
        doc.addPage();
        yPos = margin;
      }

      doc.setFillColor(249, 250, 251);
      doc.roundedRect(margin, yPos, contentWidth, 35, 2, 2, 'F');

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(`${index + 1}. ${plan.operatorName} - ${plan.planName}`, margin + 5, yPos + 8);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Custo Mensal: ${plan.monthlyCost.toFixed(2)} EUR`, margin + 5, yPos + 16);

      if (plan.savings > 0) {
        doc.setTextColor(22, 163, 74);
        doc.text(`Poupanca: ${plan.savings.toFixed(2)} EUR/mes`, margin + 5, yPos + 24);
      } else if (plan.savings < 0) {
        doc.setTextColor(220, 38, 38);
        doc.text(`Aumento: ${Math.abs(plan.savings).toFixed(2)} EUR/mes`, margin + 5, yPos + 24);
      } else {
        doc.setTextColor(107, 114, 128);
        doc.text('Sem alteracao', margin + 5, yPos + 24);
      }

      if (plan.discount > 0) {
        doc.setTextColor(37, 99, 235);
        doc.text(`Desconto: ${plan.discount}%`, margin + 5, yPos + 30);
      }

      yPos += 42;
    });

    const hasContacts = user?.contact_phone || user?.contact_email;

    if (hasContacts) {
      if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = margin;
      } else {
        yPos = pageHeight - 35;
      }

      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 7;

      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'normal');

      if (user.contact_phone) {
        doc.text(`Telefone: ${user.contact_phone}`, margin, yPos);
        yPos += 6;
      }

      if (user.contact_email) {
        doc.text(`Email: ${user.contact_email}`, margin, yPos);
      }
    }

    doc.save(`simulacao-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const PlanCard = ({ plan, index }) => {
    const isExpanded = expandedPlan === index;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        className="glass-ultra rounded-lg overflow-hidden"
      >
        <div className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-gold-400">#{index + 1}</span>
                <h3 className="text-base font-semibold text-white">{plan.operatorName}</h3>
              </div>
              <p className="text-sm text-dark-300">{plan.planName}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-white">{plan.monthlyCost.toFixed(2)} €</p>
              <p className="text-xs text-dark-400">por mes</p>
            </div>
          </div>

          {plan.savings !== 0 && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
              plan.savings > 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            }`}>
              <TrendingDown className={`w-4 h-4 ${plan.savings < 0 ? 'rotate-180' : ''}`} />
              <span className="text-sm font-medium">
                {plan.savings > 0 ? 'Poupa' : 'Aumenta'} {Math.abs(plan.savings).toFixed(2)} €/mes
              </span>
            </div>
          )}

          {plan.discount > 0 && (
            <div className="mt-2 text-xs text-blue-400">
              Desconto aplicado: {plan.discount}%
            </div>
          )}

          <button
            onClick={() => setExpandedPlan(isExpanded ? null : index)}
            className="w-full mt-3 flex items-center justify-center gap-2 text-xs text-dark-300 hover:text-white transition-colors py-2 hover:bg-white/5 rounded-lg"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {isExpanded ? 'Ocultar detalhes' : 'Ver detalhes'}
          </button>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-3 pt-3 border-t border-white/[0.06] space-y-2 text-sm"
              >
                {plan.electricityCost !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-dark-300 flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Eletricidade
                    </span>
                    <span className="text-white font-medium">{plan.electricityCost.toFixed(2)} €</span>
                  </div>
                )}
                {plan.gasCost !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-dark-300 flex items-center gap-2">
                      <Flame className="w-4 h-4" />
                      Gas Natural
                    </span>
                    <span className="text-white font-medium">{plan.gasCost.toFixed(2)} €</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="glass-ultra rounded-xl p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Resultados da Simulacao</h2>
            <p className="text-sm text-dark-300">
              Encontramos {results.plans.length} planos disponiveis
            </p>
          </div>
          <button
            onClick={handleExportPDF}
            className="btn-gold flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Exportar PDF
          </button>
        </div>

        {results.bestSavings > 0 && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <TrendingDown className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-dark-200">Melhor poupanca possivel</p>
                <p className="text-2xl font-bold text-green-400">
                  {results.bestSavings.toFixed(2)} €<span className="text-sm font-normal">/mes</span>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {results.plans.map((plan, index) => (
          <PlanCard key={index} plan={plan} index={index} />
        ))}
      </div>

      {results.plans.length === 0 && (
        <div className="glass-ultra rounded-xl p-8 text-center">
          <p className="text-dark-300">
            Nao foram encontrados planos para os criterios especificados.
          </p>
        </div>
      )}
    </div>
  );
};

export default SimulatorResults;
