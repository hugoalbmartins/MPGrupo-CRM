import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, ArrowRight, Save, Info, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { operatorsService } from "../services/operatorsService";

const CommissionWizard = ({ operator, onSave, onCancel }) => {
  const [step, setStep] = useState(1);
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [retentionConfig, setRetentionConfig] = useState({
    has_retention: false,
    retention_percentage: 0,
    retention_months: 0
  });
  const [selectedServiceTypes, setSelectedServiceTypes] = useState([]);
  const [activePartnerTab, setActivePartnerTab] = useState('D2D');
  const [refidOperationType, setRefidOperationType] = useState('both');
  const [activationType, setActivationType] = useState('M2');

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
        setRetentionConfig({
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
      return ['NI', 'MC', 'REFID'];
    }
    if (isEnergy) {
      return operator?.allowed_energy_types || ['eletricidade', 'gas'];
    }
    return ['default'];
  };

  const getClientTypes = () => {
    return operator?.allowed_client_types || ['particular', 'empresarial'];
  };

  const getPartnerTypes = () => {
    return ['D2D', 'Rev', 'Rev+'];
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

  const toggleServiceType = (type) => {
    setSelectedServiceTypes(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type);
      }
      return [...prev, type];
    });
  };

  const addConfig = (serviceTypes, clientType, partnerType, refidOpType, actType) => {
    if (serviceTypes.length === 0) {
      toast.error('Selecione pelo menos um tipo de serviço');
      return;
    }

    const hasRefid = serviceTypes.includes('REFID');
    const hasNIorMC = serviceTypes.includes('NI') || serviceTypes.includes('MC');

    const newConfig = {
      partner_type: partnerType,
      client_type: clientType,
      service_type: serviceTypes[0],
      service_types: serviceTypes,
      commission_mode: 'fixed_value',
      commission_value: 0,
      min_sales: 0,
      has_retention: retentionConfig.has_retention,
      retention_percentage: retentionConfig.retention_percentage,
      retention_months: retentionConfig.retention_months,
      direct_debit_value: 0,
      electronic_invoice_value: 0,
      tier_mode: 'by_quantity',
      monthly_value_min: 0,
      monthly_value_max: 0,
      refid_operation_type: hasRefid ? refidOpType : null,
      activation_type: hasNIorMC ? actType : null
    };

    setConfigs([...configs, newConfig]);
    setSelectedServiceTypes([]);
    setRefidOperationType('both');
    setActivationType('M2');
  };

  const updateConfig = (index, field, value) => {
    const newConfigs = [...configs];
    if (field === 'commission_mode' || field === 'tier_mode' || field === 'refid_operation_type' || field === 'activation_type') {
      newConfigs[index][field] = value;
    } else {
      newConfigs[index][field] = parseFloat(value) || 0;
    }
    setConfigs(newConfigs);
  };

  const removeConfig = (index) => {
    const newConfigs = [...configs];
    newConfigs.splice(index, 1);
    setConfigs(newConfigs);
  };

  const getServiceTypeLabel = (serviceTypes) => {
    if (!serviceTypes || serviceTypes.length === 0) return 'N/A';
    if (serviceTypes.length === 1) {
      const type = serviceTypes[0];
      if (type === 'eletricidade') return '⚡ Eletricidade';
      if (type === 'gas') return '🔥 Gás';
      return type;
    }
    return serviceTypes.join(' + ');
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          {[1, 2].map(s => (
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
          Passo {step} de 2
        </div>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Passo 1: Configuração de Retenção (Opcional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">O que é retenção?</p>
                  <p>Parte da comissão pode ser retida temporariamente e paga ao parceiro após um período definido. Esta configuração aplica-se a todas as comissões desta operadora.</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="has_retention"
                  checked={retentionConfig.has_retention}
                  onChange={(e) => setRetentionConfig({ ...retentionConfig, has_retention: e.target.checked })}
                  className="w-5 h-5"
                />
                <Label htmlFor="has_retention" className="text-base font-semibold cursor-pointer">
                  Aplicar retenção de comissões
                </Label>
              </div>

              {retentionConfig.has_retention && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-8">
                  <div>
                    <Label>Percentagem de Retenção (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={retentionConfig.retention_percentage}
                      onChange={(e) => setRetentionConfig({ ...retentionConfig, retention_percentage: parseFloat(e.target.value) || 0 })}
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
                      value={retentionConfig.retention_months}
                      onChange={(e) => setRetentionConfig({ ...retentionConfig, retention_months: parseInt(e.target.value) || 0 })}
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

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Passo 2: Valores de Comissão e Patamares</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">Configure por tipo de parceiro</p>
                  <p>
                    Cada configuração pode ter o seu próprio modo de cálculo e patamar. Selecione os tipos de serviço e defina como as comissões serão calculadas para cada combinação.
                  </p>
                </div>
              </div>
            </div>

            <Tabs value={activePartnerTab} onValueChange={setActivePartnerTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                {getPartnerTypes().map((partnerType) => (
                  <TabsTrigger key={partnerType} value={partnerType}>
                    {partnerType}
                  </TabsTrigger>
                ))}
              </TabsList>

              {getPartnerTypes().map((partnerType) => (
                <TabsContent key={partnerType} value={partnerType} className="space-y-6 mt-6">
                  {getClientTypes().map((clientType) => (
                    <div key={clientType} className="border rounded-lg p-4">
                      <h3 className="font-semibold text-lg text-gray-900 mb-4 capitalize">
                        {clientType}
                      </h3>

                      <div className="mb-4">
                        <Label className="mb-2 block">Selecionar Tipos de Serviço</Label>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {getServiceTypes().map((serviceType) => (
                            <button
                              key={serviceType}
                              type="button"
                              onClick={() => toggleServiceType(serviceType)}
                              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                selectedServiceTypes.includes(serviceType)
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                            >
                              {serviceType === 'eletricidade' ? '⚡ Eletricidade' :
                               serviceType === 'gas' ? '🔥 Gás' : serviceType}
                            </button>
                          ))}
                        </div>

                        {selectedServiceTypes.includes('REFID') && (
                          <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <Label className="text-sm font-semibold text-amber-900 mb-2 block">
                              Tipo de Operação REFID
                            </Label>
                            <Select value={refidOperationType} onValueChange={setRefidOperationType}>
                              <SelectTrigger className="bg-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="both">Ambos (Upsell e Downsell)</SelectItem>
                                <SelectItem value="upsell">Apenas Upsell (cliente aumenta mensalidade)</SelectItem>
                                <SelectItem value="downsell">Apenas Downsell (cliente reduz mensalidade)</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-amber-700 mt-1">
                              {refidOperationType === 'both' && 'Esta comissão aplica-se tanto a upsell como downsell'}
                              {refidOperationType === 'upsell' && 'Esta comissão aplica-se apenas quando cliente aumenta a mensalidade'}
                              {refidOperationType === 'downsell' && 'Esta comissão aplica-se apenas quando cliente reduz a mensalidade'}
                            </p>
                          </div>
                        )}

                        {(selectedServiceTypes.includes('NI') || selectedServiceTypes.includes('MC')) && (
                          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <Label className="text-sm font-semibold text-blue-900 mb-2 block">
                              Tipo de Ativação
                            </Label>
                            <Select value={activationType} onValueChange={setActivationType}>
                              <SelectTrigger className="bg-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="M2">M2</SelectItem>
                                <SelectItem value="M3">M3</SelectItem>
                                <SelectItem value="M4">M4</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-blue-700 mt-1">
                              Selecione o tipo de ativação para este tipo de serviço
                            </p>
                          </div>
                        )}

                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => addConfig(selectedServiceTypes, clientType, partnerType, refidOperationType, activationType)}
                          disabled={selectedServiceTypes.length === 0}
                          className="w-full"
                        >
                          + Adicionar Configuração para {selectedServiceTypes.length > 0 ? selectedServiceTypes.join(' + ') : '(selecione tipos)'}
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {configs
                          .map((config, index) => ({ config, index }))
                          .filter(({ config }) => config.client_type === clientType && config.partner_type === partnerType)
                          .map(({ config, index }) => (
                            <Card key={index} className="border-2">
                              <CardContent className="pt-6">
                                <div className="flex justify-between items-center mb-4">
                                  <div>
                                    <h4 className="font-semibold text-gray-900">
                                      {getServiceTypeLabel(config.service_types || [config.service_type])}
                                    </h4>
                                    {config.refid_operation_type && (
                                      <p className="text-xs text-amber-700 mt-1">
                                        {config.refid_operation_type === 'both' && 'Upsell e Downsell'}
                                        {config.refid_operation_type === 'upsell' && 'Apenas Upsell'}
                                        {config.refid_operation_type === 'downsell' && 'Apenas Downsell'}
                                      </p>
                                    )}
                                    {config.activation_type && (
                                      <p className="text-xs text-blue-700 mt-1">
                                        Ativação: {config.activation_type}
                                      </p>
                                    )}
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeConfig(index)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>

                                <div className="space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <Label>Modo de Comissão</Label>
                                      <Select
                                        value={config.commission_mode || 'fixed_value'}
                                        onValueChange={(v) => updateConfig(index, 'commission_mode', v)}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="fixed_value">Valor Fixo</SelectItem>
                                          {isTelecom && <SelectItem value="monthly_multiplier">Múltiplo Mensalidade</SelectItem>}
                                          <SelectItem value="per_contract">Por Contrato</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    {config.commission_mode !== 'per_contract' && (
                                      <div>
                                        <Label>Modo de Patamar</Label>
                                        <Select
                                          value={config.tier_mode || 'by_quantity'}
                                          onValueChange={(v) => updateConfig(index, 'tier_mode', v)}
                                        >
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="by_quantity">Por Quantidade</SelectItem>
                                            {isTelecom && <SelectItem value="by_monthly_value">Por Valor Mensal</SelectItem>}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    )}
                                  </div>

                                  {config.commission_mode !== 'per_contract' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div>
                                        <Label>
                                          {config.commission_mode === 'monthly_multiplier'
                                            ? 'Multiplicador'
                                            : 'Valor da Comissão (€)'}
                                        </Label>
                                        <Input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={config.commission_value || 0}
                                          onChange={(e) => updateConfig(index, 'commission_value', e.target.value)}
                                          placeholder={config.commission_mode === 'monthly_multiplier' ? 'Ex: 1.5' : 'Ex: 50.00'}
                                        />
                                      </div>

                                      {config.tier_mode === 'by_quantity' && (
                                        <div>
                                          <Label>Mínimo de Vendas</Label>
                                          <Input
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={config.min_sales || 0}
                                            onChange={(e) => updateConfig(index, 'min_sales', e.target.value)}
                                            placeholder="Ex: 0, 50, 100"
                                          />
                                          <p className="text-xs text-gray-500 mt-1">
                                            A partir de quantas vendas este valor aplica
                                          </p>
                                        </div>
                                      )}

                                      {config.tier_mode === 'by_monthly_value' && (
                                        <>
                                          <div>
                                            <Label>Mensalidade Mínima (€)</Label>
                                            <Input
                                              type="number"
                                              step="0.01"
                                              min="0"
                                              value={config.monthly_value_min || 0}
                                              onChange={(e) => updateConfig(index, 'monthly_value_min', e.target.value)}
                                              placeholder="Ex: 0.00"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">
                                              Valor mínimo de mensalidade
                                            </p>
                                          </div>
                                          <div>
                                            <Label>Mensalidade Máxima (€)</Label>
                                            <Input
                                              type="number"
                                              step="0.01"
                                              min="0"
                                              value={config.monthly_value_max || 0}
                                              onChange={(e) => updateConfig(index, 'monthly_value_max', e.target.value)}
                                              placeholder="Ex: 50.00"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">
                                              Valor máximo de mensalidade (0 = sem limite)
                                            </p>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  )}

                                  {config.commission_mode === 'per_contract' && (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                      <p className="text-sm text-yellow-800">
                                        <strong>Por Contrato:</strong> O valor será definido manualmente em cada venda pelos administradores.
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                      </div>
                    </div>
                  ))}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between items-center pt-4 border-t">
        <div className="flex gap-3">
          {step > 1 && (
            <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        </div>

        <div>
          {step < 2 ? (
            <Button type="button" onClick={() => setStep(step + 1)} className="btn-primary">
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
