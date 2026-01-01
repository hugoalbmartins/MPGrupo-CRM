import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Save, Info } from "lucide-react";
import { toast } from "sonner";
import { operatorsService } from "../services/operatorsService";

const CommissionWizard = ({ operator, onSave, onCancel }) => {
  const [step, setStep] = useState(1);
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentConfig, setCurrentConfig] = useState({
    commission_mode: 'fixed_value',
    has_retention: false,
    retention_percentage: 0,
    retention_months: 0
  });

  useEffect(() => {
    loadConfigs();
  }, [operator?.id]);

  const loadConfigs = async () => {
    if (!operator?.id) {
      setLoading(false);
      return;
    }

    try {
      const data = await operatorsService.getCommissionConfigs(operator.id);
      setConfigs(data);

      if (data.length > 0) {
        setCurrentConfig({
          commission_mode: data[0].commission_mode,
          has_retention: data[0].has_retention || false,
          retention_percentage: data[0].retention_percentage || 0,
          retention_months: data[0].retention_months || 0
        });
      }
    } catch (error) {
      console.error('Error loading configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const isTelecom = operator?.scope === 'telecomunicacoes';
  const isEnergy = operator?.scope === 'energia';

  const getServiceTypes = () => {
    if (isTelecom) {
      return operator?.activation_types || ['NI', 'MC', 'REFID'];
    }
    if (isEnergy) {
      return operator?.allowed_energy_types || ['eletricidade', 'gas'];
    }
    return ['default'];
  };

  const getClientTypes = () => {
    return operator?.allowed_client_types || ['particular', 'empresarial'];
  };

  const handleNext = () => {
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleSaveAll = async () => {
    try {
      await operatorsService.saveCommissionConfigs(operator.id, configs);
      toast.success('Configurações guardadas com sucesso!');
      onSave?.();
    } catch (error) {
      console.error('Error saving configs:', error);
      toast.error('Erro ao guardar configurações');
    }
  };

  const addConfig = (serviceType, clientType) => {
    const newConfig = {
      partner_type: 'D2D',
      client_type: clientType,
      service_type: serviceType,
      commission_mode: currentConfig.commission_mode,
      commission_value: 0,
      min_sales: 0,
      has_retention: currentConfig.has_retention,
      retention_percentage: currentConfig.retention_percentage,
      retention_months: currentConfig.retention_months,
      direct_debit_value: 0,
      electronic_invoice_value: 0
    };

    setConfigs([...configs, newConfig]);
  };

  const updateConfig = (index, field, value) => {
    const newConfigs = [...configs];
    newConfigs[index][field] = parseFloat(value) || 0;
    setConfigs(newConfigs);
  };

  const removeConfig = (index) => {
    const newConfigs = [...configs];
    newConfigs.splice(index, 1);
    setConfigs(newConfigs);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Indicator */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}
            >
              {s}
            </div>
          ))}
        </div>
        <div className="text-sm text-gray-600">
          Passo {step} de 3
        </div>
      </div>

      {/* Step 1: Commission Mode */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Passo 1: Modo de Cálculo de Comissões</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">Como funciona?</p>
                  <p>Escolha como as comissões serão calculadas para esta operadora.</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  currentConfig.commission_mode === 'fixed_value'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
                onClick={() => setCurrentConfig({ ...currentConfig, commission_mode: 'fixed_value' })}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    checked={currentConfig.commission_mode === 'fixed_value'}
                    onChange={() => setCurrentConfig({ ...currentConfig, commission_mode: 'fixed_value' })}
                    className="mt-1"
                  />
                  <div>
                    <h3 className="font-semibold text-gray-900">Valor Fixo</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Comissão definida em euros para cada venda. Ideal para energia e solar.
                    </p>
                  </div>
                </div>
              </div>

              {isTelecom && (
                <div
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    currentConfig.commission_mode === 'monthly_multiplier'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                  onClick={() => setCurrentConfig({ ...currentConfig, commission_mode: 'monthly_multiplier' })}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      checked={currentConfig.commission_mode === 'monthly_multiplier'}
                      onChange={() => setCurrentConfig({ ...currentConfig, commission_mode: 'monthly_multiplier' })}
                      className="mt-1"
                    />
                    <div>
                      <h3 className="font-semibold text-gray-900">Múltiplo da Mensalidade</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Comissão calculada multiplicando o valor da mensalidade. Apenas para telecomunicações.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  currentConfig.commission_mode === 'per_contract'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
                onClick={() => setCurrentConfig({ ...currentConfig, commission_mode: 'per_contract' })}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    checked={currentConfig.commission_mode === 'per_contract'}
                    onChange={() => setCurrentConfig({ ...currentConfig, commission_mode: 'per_contract' })}
                    className="mt-1"
                  />
                  <div>
                    <h3 className="font-semibold text-gray-900">Definida por Contrato</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Administradores definem o valor da comissão manualmente na edição de cada venda.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Retention Configuration */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Passo 2: Configuração de Retenção</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">O que é retenção?</p>
                  <p>Parte da comissão pode ser retida temporariamente e paga ao parceiro após um período definido.</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="has_retention"
                  checked={currentConfig.has_retention}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, has_retention: e.target.checked })}
                  className="w-5 h-5"
                />
                <Label htmlFor="has_retention" className="text-base font-semibold cursor-pointer">
                  Aplicar retenção de comissões
                </Label>
              </div>

              {currentConfig.has_retention && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-8">
                  <div>
                    <Label>Percentagem de Retenção (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={currentConfig.retention_percentage}
                      onChange={(e) => setCurrentConfig({ ...currentConfig, retention_percentage: parseFloat(e.target.value) || 0 })}
                      placeholder="Ex: 10"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Percentagem da comissão a reter temporariamente
                    </p>
                  </div>
                  <div>
                    <Label>Período de Retenção (meses)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={currentConfig.retention_months}
                      onChange={(e) => setCurrentConfig({ ...currentConfig, retention_months: parseInt(e.target.value) || 0 })}
                      placeholder="Ex: 3"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Número de meses até liberação da retenção
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Commission Values by Service Type */}
      {step === 3 && currentConfig.commission_mode !== 'per_contract' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Passo 3: Valores de Comissão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">Configure por tipo de serviço</p>
                  <p>
                    {isTelecom && 'Defina valores para cada tipo de ativação (NI, MC, REFID).'}
                    {isEnergy && 'Defina valores para eletricidade e gás separadamente.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {getServiceTypes().map((serviceType) => (
                <div key={serviceType}>
                  <h3 className="font-semibold text-lg text-gray-900 mb-4">
                    {serviceType === 'eletricidade' ? '⚡ Eletricidade' :
                     serviceType === 'gas' ? '🔥 Gás' : serviceType}
                  </h3>

                  {getClientTypes().map((clientType) => {
                    const existingConfig = configs.find(
                      c => c.service_type === serviceType && c.client_type === clientType
                    );

                    if (!existingConfig) {
                      return (
                        <div key={clientType} className="mb-4">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => addConfig(serviceType, clientType)}
                            className="w-full"
                          >
                            + Adicionar configuração para {clientType}
                          </Button>
                        </div>
                      );
                    }

                    const configIndex = configs.findIndex(c => c === existingConfig);

                    return (
                      <Card key={clientType} className="mb-4 border-2">
                        <CardContent className="pt-6">
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="font-semibold text-gray-900 capitalize">
                              {clientType}
                            </h4>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeConfig(configIndex)}
                              className="text-red-600 hover:text-red-700"
                            >
                              Remover
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label>
                                {currentConfig.commission_mode === 'monthly_multiplier'
                                  ? 'Multiplicador'
                                  : 'Valor da Comissão (€)'}
                              </Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={existingConfig.commission_value || 0}
                                onChange={(e) => updateConfig(configIndex, 'commission_value', e.target.value)}
                                placeholder={currentConfig.commission_mode === 'monthly_multiplier' ? 'Ex: 1.5' : 'Ex: 50.00'}
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                {currentConfig.commission_mode === 'monthly_multiplier'
                                  ? 'Multiplica o valor da mensalidade'
                                  : 'Valor fixo em euros'}
                              </p>
                            </div>

                            <div>
                              <Label>Mínimo de Vendas (Patamar)</Label>
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                value={existingConfig.min_sales || 0}
                                onChange={(e) => updateConfig(configIndex, 'min_sales', e.target.value)}
                                placeholder="Ex: 0, 50, 100"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                A partir de quantas vendas este valor aplica
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 for per_contract mode */}
      {step === 3 && currentConfig.commission_mode === 'per_contract' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Passo 3: Confirmação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
              <h3 className="font-semibold text-yellow-900 mb-2 text-lg">
                Comissão Definida por Contrato
              </h3>
              <p className="text-yellow-800 mb-4">
                Para esta operadora, os administradores definirão o valor da comissão manualmente na edição de cada venda.
              </p>
              <p className="text-sm text-yellow-700">
                Não é necessário configurar valores de comissão neste momento.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center pt-4 border-t">
        <div className="flex gap-3">
          {step > 1 && (
            <Button type="button" variant="outline" onClick={handleBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        </div>

        <div>
          {step < 3 ? (
            <Button type="button" onClick={handleNext} className="btn-primary">
              Próximo
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button type="button" onClick={handleSaveAll} className="btn-primary">
              <Save className="w-4 h-4 mr-2" />
              Guardar Configuração
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommissionWizard;
