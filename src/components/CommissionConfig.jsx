import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Info } from "lucide-react";
import { toast } from "sonner";
import { operatorsService } from "../services/operatorsService";

const CommissionConfig = ({ operator, onSave, onCancel }) => {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);

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
    } catch (error) {
      console.error('Error loading configs:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const isTelecom = operator?.scope === 'telecomunicacoes';
  const isEnergy = operator?.scope === 'energia';
  const isManualCommission = operator?.commission_mode === 'manual';

  const getCommissionMode = () => {
    if (isTelecom) return 'monthly_multiplier';
    return 'fixed_value';
  };

  const getServiceTypes = () => {
    if (isTelecom) return ['M3', 'M4'];
    if (isEnergy) return ['eletricidade', 'gas', 'dual'];
    return ['default'];
  };

  const addTier = (clientType, partnerType, serviceType) => {
    const newConfig = {
      partner_type: partnerType,
      client_type: clientType,
      service_type: serviceType,
      commission_mode: getCommissionMode(),
      commission_value: 0,
      min_sales: 0,
      has_retention: false,
      retention_percentage: 0,
      retention_months: 0,
      direct_debit_value: 0,
      electronic_invoice_value: 0,
      _isNew: true
    };

    setConfigs([...configs, newConfig]);
  };

  const removeTier = (index) => {
    const newConfigs = [...configs];
    newConfigs.splice(index, 1);
    setConfigs(newConfigs);
  };

  const updateConfig = (index, field, value) => {
    const newConfigs = [...configs];
    newConfigs[index][field] = parseFloat(value) || 0;
    setConfigs(newConfigs);
  };

  const handleSave = async () => {
    try {
      await operatorsService.saveCommissionConfigs(operator.id, configs);
      toast.success('Configurações guardadas com sucesso!');
      onSave?.();
    } catch (error) {
      console.error('Error saving configs:', error);
      toast.error('Erro ao guardar configurações');
    }
  };

  const getConfigsForType = (clientType, partnerType, serviceType) => {
    return configs.filter(
      c => c.client_type === clientType &&
           c.partner_type === partnerType &&
           c.service_type === serviceType
    ).sort((a, b) => a.min_sales - b.min_sales);
  };

  const renderTierForm = (clientType, partnerType, serviceType) => {
    const tierConfigs = getConfigsForType(clientType, partnerType, serviceType);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-gray-900">
              {serviceType ? `${serviceType}` : 'Patamares de Comissão'}
            </h4>
            <div className="group relative">
              <Info className="w-4 h-4 text-blue-500 cursor-help" />
              <div className="hidden group-hover:block absolute z-10 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg -top-2 left-6">
                {isTelecom
                  ? "Multiplicador será aplicado ao valor da mensalidade"
                  : "Valor fixo de comissão para este tipo de venda"
                }
              </div>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => addTier(clientType, partnerType, serviceType)}
          >
            <Plus className="w-4 h-4 mr-1" />
            Adicionar Patamar
          </Button>
        </div>

        {tierConfigs.length === 0 && (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
            Nenhum patamar configurado. Clique em "Adicionar Patamar" para começar.
          </div>
        )}

        {tierConfigs.map((config, localIndex) => {
          const globalIndex = configs.findIndex(c =>
            c === config
          );

          return (
            <Card key={globalIndex} className="border-2">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm">Mínimo de Vendas</Label>
                    <Input
                      type="number"
                      min="0"
                      value={config.min_sales || 0}
                      onChange={(e) => updateConfig(globalIndex, 'min_sales', e.target.value)}
                      placeholder="Ex: 0, 50, 100"
                    />
                    <p className="text-xs text-gray-500 mt-1">A partir de quantas vendas</p>
                  </div>

                  {isTelecom ? (
                    <div>
                      <Label className="text-sm">Multiplicador</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        value={config.commission_value || 0}
                        onChange={(e) => updateConfig(globalIndex, 'commission_value', e.target.value)}
                        placeholder="Ex: 1.5, 2.0"
                      />
                      <p className="text-xs text-gray-500 mt-1">Multiplica a mensalidade</p>
                    </div>
                  ) : (
                    <div>
                      <Label className="text-sm">Valor da Comissão (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={config.commission_value || 0}
                        onChange={(e) => updateConfig(globalIndex, 'commission_value', e.target.value)}
                        placeholder="Ex: 50.00"
                      />
                      <p className="text-xs text-gray-500 mt-1">Valor fixo em euros</p>
                    </div>
                  )}

                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeTier(globalIndex)}
                      className="w-full"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Remover
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {operator?.pays_direct_debit || operator?.pays_electronic_invoice ? (
          <Card className="border-2 border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <h4 className="font-semibold text-gray-900 mb-4">Serviços Adicionais</h4>
              <p className="text-sm text-gray-600 mb-4">
                Estes valores serão aplicados ao primeiro patamar (mínimo de vendas = 0)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {operator?.pays_direct_debit && (
                  <div>
                    <Label className="text-sm">Valor Débito Direto (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={tierConfigs.find(c => c.min_sales === 0)?.direct_debit_value || 0}
                      onChange={(e) => {
                        const baseConfig = tierConfigs.find(c => c.min_sales === 0);
                        if (baseConfig) {
                          const globalIndex = configs.findIndex(c => c === baseConfig);
                          updateConfig(globalIndex, 'direct_debit_value', e.target.value);
                        }
                      }}
                      placeholder="Ex: 5.00"
                    />
                    <p className="text-xs text-gray-500 mt-1">Comissão por adesão a DD</p>
                  </div>
                )}
                {operator?.pays_electronic_invoice && (
                  <div>
                    <Label className="text-sm">Valor Fatura Eletrónica (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={tierConfigs.find(c => c.min_sales === 0)?.electronic_invoice_value || 0}
                      onChange={(e) => {
                        const baseConfig = tierConfigs.find(c => c.min_sales === 0);
                        if (baseConfig) {
                          const globalIndex = configs.findIndex(c => c === baseConfig);
                          updateConfig(globalIndex, 'electronic_invoice_value', e.target.value);
                        }
                      }}
                      placeholder="Ex: 3.00"
                    />
                    <p className="text-xs text-gray-500 mt-1">Comissão por adesão a FE</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="spinner"></div>
      </div>
    );
  }

  if (isManualCommission) {
    return (
      <div className="space-y-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <h3 className="font-semibold text-yellow-900 mb-2 text-lg">Comissão Definida ao Contrato</h3>
          <p className="text-yellow-800 mb-4">
            Esta operadora está configurada para comissão manual. As comissões serão definidas individualmente na edição de cada venda pelos administradores.
          </p>
          <p className="text-sm text-yellow-700">
            Para usar patamares automáticos, altere o modo de comissão nas configurações da operadora.
          </p>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel}>
            Fechar
          </Button>
        </div>
      </div>
    );
  }

  const serviceTypes = getServiceTypes();

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Como funciona?</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Patamares:</strong> Permite definir comissões diferentes baseadas no número de vendas</li>
          {isTelecom ? (
            <li>• <strong>Telecomunicações:</strong> O multiplicador é aplicado ao valor da mensalidade</li>
          ) : isEnergy ? (
            <>
              <li>• <strong>Energia:</strong> Configure valores fixos para Eletricidade, Gás e Dual separadamente</li>
              <li>• <strong>Contabilização:</strong> Vendas Dual contam para patamares de Eletricidade (1 CPE) e Gás (1 CUI)</li>
            </>
          ) : (
            <li>• <strong>{operator?.scope}:</strong> Use valores fixos de comissão em euros</li>
          )}
          <li>• <strong>Tipos de cliente:</strong> Particular ou Empresarial</li>
          <li>• <strong>Tipos de parceiro:</strong> D2D, Rev ou Rev+</li>
        </ul>
      </div>

      <Tabs defaultValue="particular" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-blue-50 border border-blue-200">
          <TabsTrigger value="particular" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Particular</TabsTrigger>
          <TabsTrigger value="empresarial" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Empresarial</TabsTrigger>
        </TabsList>

        <TabsContent value="particular" className="space-y-4 mt-4">
          <Tabs defaultValue="D2D" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-blue-50 border border-blue-200">
              <TabsTrigger value="D2D" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">D2D</TabsTrigger>
              <TabsTrigger value="Rev" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Rev</TabsTrigger>
              <TabsTrigger value="Rev+" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Rev+</TabsTrigger>
            </TabsList>
            {['D2D', 'Rev', 'Rev+'].map(partnerType => (
              <TabsContent key={partnerType} value={partnerType} className="mt-4">
                {serviceTypes.length > 1 ? (
                  <Tabs defaultValue={serviceTypes[0]} className="w-full">
                    <TabsList className={`grid w-full grid-cols-${serviceTypes.length} bg-blue-50 border border-blue-200`}>
                      {serviceTypes.map(st => (
                        <TabsTrigger key={st} value={st} className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                          {st === 'eletricidade' ? '⚡ Eletricidade' :
                           st === 'gas' ? '🔥 Gás' :
                           st === 'dual' ? '⚡🔥 Dual' : st}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {serviceTypes.map(st => (
                      <TabsContent key={st} value={st} className="mt-4">
                        {renderTierForm('particular', partnerType, st)}
                      </TabsContent>
                    ))}
                  </Tabs>
                ) : (
                  renderTierForm('particular', partnerType, serviceTypes[0])
                )}
              </TabsContent>
            ))}
          </Tabs>
        </TabsContent>

        <TabsContent value="empresarial" className="space-y-4 mt-4">
          <Tabs defaultValue="D2D" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-blue-50 border border-blue-200">
              <TabsTrigger value="D2D" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">D2D</TabsTrigger>
              <TabsTrigger value="Rev" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Rev</TabsTrigger>
              <TabsTrigger value="Rev+" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Rev+</TabsTrigger>
            </TabsList>
            {['D2D', 'Rev', 'Rev+'].map(partnerType => (
              <TabsContent key={partnerType} value={partnerType} className="mt-4">
                {serviceTypes.length > 1 ? (
                  <Tabs defaultValue={serviceTypes[0]} className="w-full">
                    <TabsList className={`grid w-full grid-cols-${serviceTypes.length} bg-blue-50 border border-blue-200`}>
                      {serviceTypes.map(st => (
                        <TabsTrigger key={st} value={st} className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                          {st === 'eletricidade' ? '⚡ Eletricidade' :
                           st === 'gas' ? '🔥 Gás' :
                           st === 'dual' ? '⚡🔥 Dual' : st}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {serviceTypes.map(st => (
                      <TabsContent key={st} value={st} className="mt-4">
                        {renderTierForm('empresarial', partnerType, st)}
                      </TabsContent>
                    ))}
                  </Tabs>
                ) : (
                  renderTierForm('empresarial', partnerType, serviceTypes[0])
                )}
              </TabsContent>
            ))}
          </Tabs>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" onClick={handleSave} className="btn-primary">
          Guardar Configuração
        </Button>
      </div>
    </div>
  );
};

export default CommissionConfig;
