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

  const addTier = (clientType, serviceType = null) => {
    const newConfig = { ...config };
    const target = serviceType 
      ? (newConfig[clientType][serviceType] || {})
      : newConfig[clientType];

    if (!target.tiers) {
      target.tiers = [];
    }

    target.tiers.push({
      min_sales: 0,
      multiplier: isTelecom ? 1 : undefined,
      commission_value: !isTelecom ? 0 : undefined
    });

    if (serviceType) {
      newConfig[clientType][serviceType] = target;
    } else {
      newConfig[clientType] = target;
    }

    setConfig(newConfig);
  };

  const removeTier = (clientType, tierIndex, serviceType = null) => {
    const newConfig = { ...config };
    const target = serviceType 
      ? newConfig[clientType]?.[serviceType]
      : newConfig[clientType];

    if (target?.tiers) {
      target.tiers.splice(tierIndex, 1);
    }

    setConfig(newConfig);
  };

  const updateTier = (clientType, tierIndex, field, value, serviceType = null) => {
    const newConfig = { ...config };
    const target = serviceType 
      ? (newConfig[clientType][serviceType] || { tiers: [] })
      : (newConfig[clientType] || { tiers: [] });

    if (!target.tiers[tierIndex]) {
      target.tiers[tierIndex] = {};
    }

    target.tiers[tierIndex][field] = parseFloat(value) || 0;

    if (serviceType) {
      if (!newConfig[clientType]) newConfig[clientType] = {};
      newConfig[clientType][serviceType] = target;
    } else {
      newConfig[clientType] = target;
    }

    setConfig(newConfig);
  };

  const handleSave = () => {
    // Validate config
    for (const clientType of ['particular', 'empresarial']) {
      if (isTelecom) {
        for (const serviceType of ['M3', 'M4']) {
          const tiers = config[clientType]?.[serviceType]?.tiers || [];
          if (tiers.length === 0) {
            toast.error(`Configure pelo menos 1 patamar para ${clientType} - ${serviceType}`);
            return;
          }
        }
      } else {
        const tiers = config[clientType]?.tiers || [];
        if (tiers.length === 0) {
          toast.error(`Configure pelo menos 1 patamar para ${clientType}`);
          return;
        }
      }
    }

    onSave(config);
  };

  const renderTierForm = (clientType, serviceType = null) => {
    const target = serviceType 
      ? config[clientType]?.[serviceType]
      : config[clientType];
    
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
            onClick={() => addTier(clientType, serviceType)}
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
          <Card key={index} className="border border-gray-200 bg-white">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm">Mínimo de Vendas</Label>
                  <Input
                    type="number"
                    min="0"
                    value={tier.min_sales || 0}
                    onChange={(e) => updateTier(clientType, index, 'min_sales', e.target.value, serviceType)}
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
                      onChange={(e) => updateTier(clientType, index, 'multiplier', e.target.value, serviceType)}
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
                      onChange={(e) => updateTier(clientType, index, 'commission_value', e.target.value, serviceType)}
                      placeholder="Ex: 50.00"
                    />
                    <p className="text-xs text-gray-500 mt-1">Valor fixo em euros</p>
                  </div>
                )}

                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeTier(clientType, index, serviceType)}
                    className="w-full text-red-600 border-red-200 hover:bg-red-50"
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

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Como funciona?</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Patamares:</strong> Permite definir comissões diferentes baseadas no número de vendas</li>
          {isTelecom ? (
            <li>• <strong>Telecomunicações:</strong> O multiplicador é aplicado ao valor da mensalidade</li>
          ) : (
            <li>• <strong>{operator?.scope}:</strong> Use valores fixos de comissão em euros</li>
          )}
          <li>• <strong>Tipos de cliente:</strong> Particular ou Empresarial</li>
        </ul>
      </div>

      <Tabs defaultValue="particular" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-blue-50 border border-blue-200">
          <TabsTrigger value="particular" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Particular</TabsTrigger>
          <TabsTrigger value="empresarial" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Empresarial</TabsTrigger>
        </TabsList>

        <TabsContent value="particular" className="space-y-4 mt-4">
          {isTelecom ? (
            <Tabs defaultValue="M3" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-blue-50 border border-blue-200">
                <TabsTrigger value="M3" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">M3</TabsTrigger>
                <TabsTrigger value="M4" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">M4</TabsTrigger>
              </TabsList>
              <TabsContent value="M3" className="mt-4">
                {renderTierForm('particular', 'M3')}
              </TabsContent>
              <TabsContent value="M4" className="mt-4">
                {renderTierForm('particular', 'M4')}
              </TabsContent>
            </Tabs>
          ) : (
            renderTierForm('particular')
          )}
        </TabsContent>

        <TabsContent value="empresarial" className="space-y-4 mt-4">
          {isTelecom ? (
            <Tabs defaultValue="M3" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-blue-50 border border-blue-200">
                <TabsTrigger value="M3" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">M3</TabsTrigger>
                <TabsTrigger value="M4" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">M4</TabsTrigger>
              </TabsList>
              <TabsContent value="M3" className="mt-4">
                {renderTierForm('empresarial', 'M3')}
              </TabsContent>
              <TabsContent value="M4" className="mt-4">
                {renderTierForm('empresarial', 'M4')}
              </TabsContent>
            </Tabs>
          ) : (
            renderTierForm('empresarial')
          )}
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
