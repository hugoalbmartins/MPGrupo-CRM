import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Info } from "lucide-react";
import { toast } from "sonner";

const CommissionConfig = ({ operator, onSave, onCancel }) => {
  const [config, setConfig] = useState({
    particular: {},
    empresarial: {}
  });

  useEffect(() => {
    if (operator?.commission_config) {
      setConfig(operator.commission_config);
    }
  }, [operator]);

  const isTelecom = operator?.scope === 'telecomunicacoes';
  const isEnergy = operator?.scope === 'energia';
  const isManualCommission = operator?.commission_mode === 'manual';

  const addTier = (clientType, partnerType, serviceType = null) => {
    const newConfig = { ...config };

    if (!newConfig[clientType]) {
      newConfig[clientType] = {};
    }
    if (!newConfig[clientType][partnerType]) {
      newConfig[clientType][partnerType] = {};
    }

    const target = serviceType
      ? (newConfig[clientType][partnerType][serviceType] || {})
      : (newConfig[clientType][partnerType] || {});

    if (!target.tiers) {
      target.tiers = [];
    }

    target.tiers.push({
      min_sales: 0,
      multiplier: isTelecom ? 1 : undefined,
      commission_value: !isTelecom ? 0 : undefined
    });

    if (serviceType) {
      newConfig[clientType][partnerType][serviceType] = target;
    } else {
      newConfig[clientType][partnerType] = target;
    }

    setConfig(newConfig);
  };

  const removeTier = (clientType, partnerType, tierIndex, serviceType = null) => {
    const newConfig = { ...config };
    const target = serviceType
      ? newConfig[clientType]?.[partnerType]?.[serviceType]
      : newConfig[clientType]?.[partnerType];

    if (target?.tiers) {
      target.tiers.splice(tierIndex, 1);
    }

    setConfig(newConfig);
  };

  const updateTier = (clientType, partnerType, tierIndex, field, value, serviceType = null) => {
    const newConfig = { ...config };
    if (!newConfig[clientType]) newConfig[clientType] = {};
    if (!newConfig[clientType][partnerType]) newConfig[clientType][partnerType] = {};

    const target = serviceType
      ? (newConfig[clientType][partnerType][serviceType] || { tiers: [] })
      : (newConfig[clientType][partnerType] || { tiers: [] });

    if (!target.tiers) target.tiers = [];
    if (!target.tiers[tierIndex]) {
      target.tiers[tierIndex] = {};
    }

    target.tiers[tierIndex][field] = parseFloat(value) || 0;

    if (serviceType) {
      newConfig[clientType][partnerType][serviceType] = target;
    } else {
      newConfig[clientType][partnerType] = target;
    }

    setConfig(newConfig);
  };

  const handleSave = () => {
    onSave(config);
  };

  const renderTierForm = (clientType, partnerType, serviceType = null) => {
    const target = serviceType
      ? config[clientType]?.[partnerType]?.[serviceType]
      : config[clientType]?.[partnerType];

    const tiers = target?.tiers || [];

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

        {tiers.length === 0 && (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
            Nenhum patamar configurado. Clique em "Adicionar Patamar" para começar.
          </div>
        )}

        {tiers.map((tier, index) => (
          <Card key={index} className="border-2">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm">Mínimo de Vendas</Label>
                  <Input
                    type="number"
                    min="0"
                    value={tier.min_sales || 0}
                    onChange={(e) => updateTier(clientType, partnerType, index, 'min_sales', e.target.value, serviceType)}
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
                      value={tier.multiplier || 0}
                      onChange={(e) => updateTier(clientType, partnerType, index, 'multiplier', e.target.value, serviceType)}
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
                      value={tier.commission_value || 0}
                      onChange={(e) => updateTier(clientType, partnerType, index, 'commission_value', e.target.value, serviceType)}
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
                    onClick={() => removeTier(clientType, partnerType, index, serviceType)}
                    className="w-full"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Remover
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

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
                {isTelecom ? (
                  <Tabs defaultValue="M3" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-blue-50 border border-blue-200">
                      <TabsTrigger value="M3" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">M3</TabsTrigger>
                      <TabsTrigger value="M4" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">M4</TabsTrigger>
                    </TabsList>
                    <TabsContent value="M3" className="mt-4">
                      {renderTierForm('particular', partnerType, 'M3')}
                    </TabsContent>
                    <TabsContent value="M4" className="mt-4">
                      {renderTierForm('particular', partnerType, 'M4')}
                    </TabsContent>
                  </Tabs>
                ) : isEnergy ? (
                  <Tabs defaultValue="eletricidade" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 bg-blue-50 border border-blue-200">
                      <TabsTrigger value="eletricidade" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">⚡ Eletricidade</TabsTrigger>
                      <TabsTrigger value="gas" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">🔥 Gás</TabsTrigger>
                      <TabsTrigger value="dual" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">⚡🔥 Dual</TabsTrigger>
                    </TabsList>
                    <TabsContent value="eletricidade" className="mt-4">
                      {renderTierForm('particular', partnerType, 'eletricidade')}
                    </TabsContent>
                    <TabsContent value="gas" className="mt-4">
                      {renderTierForm('particular', partnerType, 'gas')}
                    </TabsContent>
                    <TabsContent value="dual" className="mt-4">
                      {renderTierForm('particular', partnerType, 'dual')}
                    </TabsContent>
                  </Tabs>
                ) : (
                  renderTierForm('particular', partnerType)
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
                {isTelecom ? (
                  <Tabs defaultValue="M3" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-blue-50 border border-blue-200">
                      <TabsTrigger value="M3" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">M3</TabsTrigger>
                      <TabsTrigger value="M4" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">M4</TabsTrigger>
                    </TabsList>
                    <TabsContent value="M3" className="mt-4">
                      {renderTierForm('empresarial', partnerType, 'M3')}
                    </TabsContent>
                    <TabsContent value="M4" className="mt-4">
                      {renderTierForm('empresarial', partnerType, 'M4')}
                    </TabsContent>
                  </Tabs>
                ) : isEnergy ? (
                  <Tabs defaultValue="eletricidade" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 bg-blue-50 border border-blue-200">
                      <TabsTrigger value="eletricidade" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">⚡ Eletricidade</TabsTrigger>
                      <TabsTrigger value="gas" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">🔥 Gás</TabsTrigger>
                      <TabsTrigger value="dual" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">⚡🔥 Dual</TabsTrigger>
                    </TabsList>
                    <TabsContent value="eletricidade" className="mt-4">
                      {renderTierForm('empresarial', partnerType, 'eletricidade')}
                    </TabsContent>
                    <TabsContent value="gas" className="mt-4">
                      {renderTierForm('empresarial', partnerType, 'gas')}
                    </TabsContent>
                    <TabsContent value="dual" className="mt-4">
                      {renderTierForm('empresarial', partnerType, 'dual')}
                    </TabsContent>
                  </Tabs>
                ) : (
                  renderTierForm('empresarial', partnerType)
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
