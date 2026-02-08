import React from 'react';
import { ArrowRight, ArrowLeft, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { motion } from 'framer-motion';
import { POTENCIAS_PORTUGAL, OPERADORAS_PORTUGAL_ERSE, CICLOS_HORARIOS } from '../../services/energySimulatorService';

const ElectricityFormStep = ({ formData, onChange, onNext, onBack, tipoEnergia }) => {
  const handleInputChange = (field, value) => {
    onChange({
      ...formData,
      [field]: value
    });
  };

  const handleConsumosChange = (field, value) => {
    onChange({
      ...formData,
      consumos: {
        ...formData.consumos,
        [field]: value
      }
    });
  };

  const handlePrecosChange = (field, value) => {
    onChange({
      ...formData,
      precos: {
        ...formData.precos,
        [field]: value
      }
    });
  };

  const canProceed = () => {
    if (!formData.operadora_atual || !formData.potencia || !formData.valor_potencia_dia || !formData.dias || !formData.ciclo) {
      return false;
    }

    if (formData.ciclo === 'simples') {
      return formData.consumos.energia && formData.precos.energia;
    } else if (formData.ciclo === 'bi-horario') {
      return formData.consumos.vazio && formData.precos.vazio && formData.consumos.fora_vazio && formData.precos.fora_vazio;
    } else if (formData.ciclo === 'tri-horario') {
      return formData.consumos.vazio && formData.precos.vazio && formData.consumos.cheia && formData.precos.cheia && formData.consumos.ponta && formData.precos.ponta;
    }

    return false;
  };

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="border-white/10 bg-dark-800/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-2xl text-white">Dados de Eletricidade</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-white">Operadora Atual</Label>
                <Select value={formData.operadora_atual} onValueChange={(value) => handleInputChange('operadora_atual', value)}>
                  <SelectTrigger className="bg-dark-700 border-white/10 text-white">
                    <SelectValue placeholder="Selecione a operadora" />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERADORAS_PORTUGAL_ERSE.map((op) => (
                      <SelectItem key={op} value={op}>{op}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-white">Potência Contratada (kVA)</Label>
                <Select value={formData.potencia} onValueChange={(value) => handleInputChange('potencia', value)}>
                  <SelectTrigger className="bg-dark-700 border-white/10 text-white">
                    <SelectValue placeholder="Selecione a potência" />
                  </SelectTrigger>
                  <SelectContent>
                    {POTENCIAS_PORTUGAL.map((p) => (
                      <SelectItem key={p} value={p.toString()}>{p} kVA</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-white">Valor Diário de Potência (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.valor_potencia_dia}
                  onChange={(e) => handleInputChange('valor_potencia_dia', e.target.value)}
                  className="bg-dark-700 border-white/10 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white">Dias de Fatura</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="30"
                  value={formData.dias}
                  onChange={(e) => handleInputChange('dias', e.target.value)}
                  className="bg-dark-700 border-white/10 text-white"
                />
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-white text-lg font-semibold">Ciclo Horário</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {CICLOS_HORARIOS.map((ciclo) => (
                  <Card
                    key={ciclo.value}
                    className={`cursor-pointer transition-all duration-200 ${
                      formData.ciclo === ciclo.value
                        ? 'bg-gold-400/20 border-gold-400 shadow-lg'
                        : 'bg-dark-700 border-white/10 hover:border-white/20'
                    }`}
                    onClick={() => handleInputChange('ciclo', ciclo.value)}
                  >
                    <CardContent className="p-4 text-center">
                      <p className="font-semibold text-white">{ciclo.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {formData.ciclo && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <Label className="text-white text-lg font-semibold">Consumos e Preços</Label>

                {formData.ciclo === 'simples' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-white">Energia (kWh)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={formData.consumos.energia}
                        onChange={(e) => handleConsumosChange('energia', e.target.value)}
                        className="bg-dark-700 border-white/10 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white">Preço Energia (€/kWh)</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        min="0"
                        placeholder="0.0000"
                        value={formData.precos.energia}
                        onChange={(e) => handlePrecosChange('energia', e.target.value)}
                        className="bg-dark-700 border-white/10 text-white"
                      />
                    </div>
                  </div>
                )}

                {formData.ciclo === 'bi-horario' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-white">Vazio (kWh)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={formData.consumos.vazio}
                          onChange={(e) => handleConsumosChange('vazio', e.target.value)}
                          className="bg-dark-700 border-white/10 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-white">Preço Vazio (€/kWh)</Label>
                        <Input
                          type="number"
                          step="0.0001"
                          min="0"
                          placeholder="0.0000"
                          value={formData.precos.vazio}
                          onChange={(e) => handlePrecosChange('vazio', e.target.value)}
                          className="bg-dark-700 border-white/10 text-white"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-white">Fora Vazio (kWh)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={formData.consumos.fora_vazio}
                          onChange={(e) => handleConsumosChange('fora_vazio', e.target.value)}
                          className="bg-dark-700 border-white/10 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-white">Preço Fora Vazio (€/kWh)</Label>
                        <Input
                          type="number"
                          step="0.0001"
                          min="0"
                          placeholder="0.0000"
                          value={formData.precos.fora_vazio}
                          onChange={(e) => handlePrecosChange('fora_vazio', e.target.value)}
                          className="bg-dark-700 border-white/10 text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {formData.ciclo === 'tri-horario' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-white">Vazio (kWh)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={formData.consumos.vazio}
                          onChange={(e) => handleConsumosChange('vazio', e.target.value)}
                          className="bg-dark-700 border-white/10 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-white">Preço Vazio (€/kWh)</Label>
                        <Input
                          type="number"
                          step="0.0001"
                          min="0"
                          placeholder="0.0000"
                          value={formData.precos.vazio}
                          onChange={(e) => handlePrecosChange('vazio', e.target.value)}
                          className="bg-dark-700 border-white/10 text-white"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-white">Cheias (kWh)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={formData.consumos.cheia}
                          onChange={(e) => handleConsumosChange('cheia', e.target.value)}
                          className="bg-dark-700 border-white/10 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-white">Preço Cheias (€/kWh)</Label>
                        <Input
                          type="number"
                          step="0.0001"
                          min="0"
                          placeholder="0.0000"
                          value={formData.precos.cheia}
                          onChange={(e) => handlePrecosChange('cheia', e.target.value)}
                          className="bg-dark-700 border-white/10 text-white"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-white">Ponta (kWh)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={formData.consumos.ponta}
                          onChange={(e) => handleConsumosChange('ponta', e.target.value)}
                          className="bg-dark-700 border-white/10 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-white">Preço Ponta (€/kWh)</Label>
                        <Input
                          type="number"
                          step="0.0001"
                          min="0"
                          placeholder="0.0000"
                          value={formData.precos.ponta}
                          onChange={(e) => handlePrecosChange('ponta', e.target.value)}
                          className="bg-dark-700 border-white/10 text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            <div className="space-y-4 pt-4 border-t border-white/10">
              <Label className="text-white text-lg font-semibold">Opções Adicionais</Label>
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="debito-direto"
                  checked={formData.tem_debito_direto}
                  onCheckedChange={(checked) => handleInputChange('tem_debito_direto', checked)}
                  className="border-white/20"
                />
                <label htmlFor="debito-direto" className="text-white cursor-pointer">
                  Tenho Débito Direto
                </label>
              </div>
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="fatura-eletronica"
                  checked={formData.tem_fatura_eletronica}
                  onCheckedChange={(checked) => handleInputChange('tem_fatura_eletronica', checked)}
                  className="border-white/20"
                />
                <label htmlFor="fatura-eletronica" className="text-white cursor-pointer">
                  Tenho Fatura Eletrónica
                </label>
              </div>
            </div>

            <div className="flex justify-between pt-6">
              <Button
                onClick={onBack}
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              <Button
                onClick={onNext}
                disabled={!canProceed()}
                className="bg-gold-400 hover:bg-gold-500 text-dark-900 font-semibold"
              >
                {tipoEnergia === 'eletricidade' ? 'Ver Resultados' : 'Continuar para Gás'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default ElectricityFormStep;
