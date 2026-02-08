import React from 'react';
import { Zap, Flame } from 'lucide-react';

const SimulatorForm = ({ formData, setFormData, operators, onSubmit }) => {
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleConsumptionChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      consumption: { ...prev.consumption, [field]: value }
    }));
  };

  const isValid = () => {
    if (!formData.energyType || !formData.operatorId) return false;

    if (formData.energyType === 'eletricidade' || formData.energyType === 'dual') {
      if (!formData.power || !formData.tariffType) return false;
      const { vazio, fora_vazio, ponta, cheia } = formData.consumption;
      if (!vazio && !fora_vazio && !ponta && !cheia) return false;
    }

    if (formData.energyType === 'gas' || formData.energyType === 'dual') {
      if (!formData.gasConsumption) return false;
    }

    return true;
  };

  return (
    <div className="glass-ultra rounded-xl p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-dark-200 mb-2">
            Tipo de Energia
          </label>
          <select
            value={formData.energyType}
            onChange={(e) => handleChange('energyType', e.target.value)}
            className="glass-input w-full"
          >
            <option value="">Selecione...</option>
            <option value="eletricidade">Eletricidade</option>
            <option value="gas">Gas Natural</option>
            <option value="dual">Dual (Eletricidade + Gas)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-200 mb-2">
            Operadora Atual
          </label>
          <select
            value={formData.operatorId}
            onChange={(e) => handleChange('operatorId', e.target.value)}
            className="glass-input w-full"
          >
            <option value="">Selecione...</option>
            {operators.map(op => (
              <option key={op.id} value={op.id}>{op.name}</option>
            ))}
          </select>
        </div>
      </div>

      {(formData.energyType === 'eletricidade' || formData.energyType === 'dual') && (
        <div className="border-t border-white/[0.06] pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-semibold text-white">Dados Eletricidade</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Potencia Contratada (kVA)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.power}
                onChange={(e) => handleChange('power', e.target.value)}
                className="glass-input w-full"
                placeholder="Ex: 6.9"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Tipo de Tarifa
              </label>
              <select
                value={formData.tariffType}
                onChange={(e) => handleChange('tariffType', e.target.value)}
                className="glass-input w-full"
              >
                <option value="">Selecione...</option>
                <option value="simples">Simples</option>
                <option value="bi-horario">Bi-horario</option>
                <option value="tri-horario">Tri-horario</option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Consumo Mensal (kWh)
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-dark-300 mb-1">Vazio</label>
                <input
                  type="number"
                  value={formData.consumption.vazio}
                  onChange={(e) => handleConsumptionChange('vazio', e.target.value)}
                  className="glass-input w-full"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-dark-300 mb-1">Fora Vazio</label>
                <input
                  type="number"
                  value={formData.consumption.fora_vazio}
                  onChange={(e) => handleConsumptionChange('fora_vazio', e.target.value)}
                  className="glass-input w-full"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-dark-300 mb-1">Ponta</label>
                <input
                  type="number"
                  value={formData.consumption.ponta}
                  onChange={(e) => handleConsumptionChange('ponta', e.target.value)}
                  className="glass-input w-full"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-dark-300 mb-1">Cheia</label>
                <input
                  type="number"
                  value={formData.consumption.cheia}
                  onChange={(e) => handleConsumptionChange('cheia', e.target.value)}
                  className="glass-input w-full"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Valor Fatura Atual (€/mes)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.currentBill}
              onChange={(e) => handleChange('currentBill', e.target.value)}
              className="glass-input w-full"
              placeholder="Ex: 85.50"
            />
          </div>
        </div>
      )}

      {(formData.energyType === 'gas' || formData.energyType === 'dual') && (
        <div className="border-t border-white/[0.06] pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-5 h-5 text-orange-400" />
            <h3 className="text-base font-semibold text-white">Dados Gas Natural</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Consumo Mensal (m³)
              </label>
              <input
                type="number"
                value={formData.gasConsumption}
                onChange={(e) => handleChange('gasConsumption', e.target.value)}
                className="glass-input w-full"
                placeholder="Ex: 120"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Valor Fatura Atual (€/mes)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.currentGasBill}
                onChange={(e) => handleChange('currentGasBill', e.target.value)}
                className="glass-input w-full"
                placeholder="Ex: 45.00"
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-4">
        <button
          onClick={onSubmit}
          disabled={!isValid()}
          className="btn-gold px-8 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Simular Poupanca
        </button>
      </div>
    </div>
  );
};

export default SimulatorForm;
