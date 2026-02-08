import React from 'react';
import { ArrowRight, ArrowLeft, Flame } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { motion } from 'framer-motion';
import { ESCALOES_GAS } from '../../services/energySimulatorService';

const GasFormStep = ({ formData, onChange, onNext, onBack, eletricidadeData }) => {
  const handleInputChange = (field, value) => {
    onChange({
      ...formData,
      [field]: value
    });
  };

  const canProceed = () => {
    return formData.escalao && formData.dias && formData.valor_diario && formData.consumo_kwh && formData.preco_kwh;
  };

  const diasDefault = eletricidadeData?.dias || '30';

  React.useEffect(() => {
    if (!formData.dias && diasDefault) {
      handleInputChange('dias', diasDefault);
    }
  }, [diasDefault]);

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
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
                <Flame className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-2xl text-white">Dados de Gás Natural</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-white">Escalão de Consumo</Label>
                <Select value={formData.escalao} onValueChange={(value) => handleInputChange('escalao', value)}>
                  <SelectTrigger className="bg-dark-700 border-white/10 text-white">
                    <SelectValue placeholder="Selecione o escalão" />
                  </SelectTrigger>
                  <SelectContent>
                    {ESCALOES_GAS.map((escalao) => (
                      <SelectItem key={escalao.value} value={escalao.value}>
                        {escalao.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

              <div className="space-y-2">
                <Label className="text-white">Valor Diário Atual (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.valor_diario}
                  onChange={(e) => handleInputChange('valor_diario', e.target.value)}
                  className="bg-dark-700 border-white/10 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white">Consumo (kWh)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.consumo_kwh}
                  onChange={(e) => handleInputChange('consumo_kwh', e.target.value)}
                  className="bg-dark-700 border-white/10 text-white"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="text-white">Preço Energia Atual (€/kWh)</Label>
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder="0.0000"
                  value={formData.preco_kwh}
                  onChange={(e) => handleInputChange('preco_kwh', e.target.value)}
                  className="bg-dark-700 border-white/10 text-white"
                />
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <p className="text-blue-400 text-sm">
                <strong>Nota:</strong> Os valores de débito direto e fatura eletrónica são herdados dos dados de eletricidade (se aplicável).
              </p>
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
                Ver Resultados
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default GasFormStep;
