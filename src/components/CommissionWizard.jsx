import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Trash2, Plus, Check, X, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { operatorsService } from "../services/operatorsService";

const CommissionWizard = ({ operator, onSave, onCancel }) => {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePartnerTab, setActivePartnerTab] = useState('D2D');
  const [editingIndex, setEditingIndex] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newConfig, setNewConfig] = useState(getEmptyConfig());

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
    } finally {
      setLoading(false);
    }
  };

  function getEmptyConfig() {
    return {
      partner_type: 'D2D',
      client_type: 'particular',
      service_type: '',
      service_types: [],
      commission_mode: 'fixed_value',
      commission_value: 0,
      min_sales: 0,
      has_retention: false,
      retention_percentage: 0,
      retention_months: 0,
      direct_debit_bonus: 0,
      electronic_invoice_bonus: 0,
      tier_mode: 'by_quantity',
      monthly_value_min: 0,
      monthly_value_max: 0,
      refid_operation_type: null,
      activation_type: null
    };
  }

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
      toast.success('Configurações guardadas!');
      setEditingIndex(null);
      onSave?.();
    } catch (error) {
      console.error('Error saving configs:', error);
      toast.error('Erro ao guardar configurações');
    }
  };

  const addNewConfig = () => {
    if (!newConfig.service_type && (!newConfig.service_types || newConfig.service_types.length === 0)) {
      toast.error('Selecione um tipo de serviço');
      return;
    }

    const configToAdd = {
      ...newConfig,
      partner_type: activePartnerTab,
      service_types: newConfig.service_types.length > 0 ? newConfig.service_types : [newConfig.service_type]
    };

    setConfigs([...configs, configToAdd]);
    setNewConfig(getEmptyConfig());
    setShowAddForm(false);
    toast.success('Configuração adicionada');
  };

  const updateConfig = (index, field, value) => {
    const newConfigs = [...configs];
    if (field === 'commission_mode' || field === 'tier_mode' || field === 'refid_operation_type' || field === 'activation_type' || field === 'has_retention' || field === 'client_type') {
      newConfigs[index][field] = value;
    } else {
      newConfigs[index][field] = parseFloat(value) || 0;
    }
    setConfigs(newConfigs);
  };

  const removeConfig = (index) => {
    if (!window.confirm('Remover esta configuração?')) return;
    const newConfigs = [...configs];
    newConfigs.splice(index, 1);
    setConfigs(newConfigs);
    toast.success('Configuração removida');
  };

  const getServiceTypeLabel = (config) => {
    const types = config.service_types || [config.service_type];
    if (!types || types.length === 0) return 'N/A';
    return types.map(t => {
      if (t === 'eletricidade') return 'Eletr.';
      if (t === 'gas') return 'Gás';
      return t;
    }).join('+');
  };

  const getCommissionModeLabel = (mode) => {
    if (mode === 'fixed_value') return 'Fixo';
    if (mode === 'monthly_multiplier') return 'Mult. Mensal';
    if (mode === 'per_contract') return 'Por Contrato';
    return mode;
  };

  const getTierModeLabel = (mode) => {
    if (mode === 'by_quantity') return 'Por Qtd';
    if (mode === 'by_monthly_value') return 'Por Valor';
    return mode;
  };

  const filteredConfigs = configs.filter(c => c.partner_type === activePartnerTab);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Configuração de Comissões - {operator?.name}</span>
            <Button
              type="button"
              onClick={handleSaveAll}
              size="sm"
              className="bg-slate-700 hover:bg-slate-800"
            >
              <Save className="w-4 h-4 mr-2" />
              Guardar Tudo
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={activePartnerTab} onValueChange={setActivePartnerTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-slate-100">
              {getPartnerTypes().map((partnerType) => (
                <TabsTrigger
                  key={partnerType}
                  value={partnerType}
                  className="data-[state=active]:bg-slate-700 data-[state=active]:text-white"
                >
                  {partnerType}
                </TabsTrigger>
              ))}
            </TabsList>

            {getPartnerTypes().map((partnerType) => (
              <TabsContent key={partnerType} value={partnerType} className="mt-4">
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b-2 border-slate-300 bg-slate-50">
                          <th className="text-left p-2 font-semibold">Cliente</th>
                          <th className="text-left p-2 font-semibold">Serviço</th>
                          <th className="text-left p-2 font-semibold">Modo</th>
                          <th className="text-left p-2 font-semibold">Valor/Mult.</th>
                          <th className="text-left p-2 font-semibold">Patamar</th>
                          <th className="text-left p-2 font-semibold">Min Vendas / Range Mensal</th>
                          <th className="text-left p-2 font-semibold">Retenção</th>
                          <th className="text-left p-2 font-semibold">DD/FE</th>
                          <th className="text-right p-2 font-semibold w-24">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredConfigs.length === 0 ? (
                          <tr>
                            <td colSpan="9" className="text-center p-8 text-gray-500">
                              Nenhuma configuração para {partnerType}. Clique em "+ Nova Regra" para adicionar.
                            </td>
                          </tr>
                        ) : (
                          filteredConfigs.map((config, idx) => {
                            const actualIndex = configs.indexOf(config);
                            const isEditing = editingIndex === actualIndex;

                            return (
                              <tr key={actualIndex} className="border-b border-slate-200 hover:bg-slate-50">
                                <td className="p-2">
                                  {isEditing ? (
                                    <Select
                                      value={config.client_type}
                                      onValueChange={(v) => updateConfig(actualIndex, 'client_type', v)}
                                    >
                                      <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {getClientTypes().map(ct => (
                                          <SelectItem key={ct} value={ct}>{ct}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <span className="capitalize">{config.client_type}</span>
                                  )}
                                </td>

                                <td className="p-2">
                                  <div>
                                    <span className="font-medium">{getServiceTypeLabel(config)}</span>
                                    {config.activation_type && (
                                      <span className="ml-1 text-xs text-blue-600">({config.activation_type})</span>
                                    )}
                                    {config.refid_operation_type && (
                                      <span className="ml-1 text-xs text-amber-600">
                                        ({config.refid_operation_type === 'both' ? 'Up+Down' : config.refid_operation_type === 'upsell' ? 'Up' : 'Down'})
                                      </span>
                                    )}
                                  </div>
                                </td>

                                <td className="p-2">
                                  {isEditing ? (
                                    <Select
                                      value={config.commission_mode}
                                      onValueChange={(v) => updateConfig(actualIndex, 'commission_mode', v)}
                                    >
                                      <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="fixed_value">Fixo</SelectItem>
                                        {isTelecom && <SelectItem value="monthly_multiplier">Mult. Mensal</SelectItem>}
                                        <SelectItem value="per_contract">Por Contrato</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <span>{getCommissionModeLabel(config.commission_mode)}</span>
                                  )}
                                </td>

                                <td className="p-2">
                                  {config.commission_mode !== 'per_contract' && (
                                    isEditing ? (
                                      <Input
                                        type="number"
                                        step="0.01"
                                        className="h-8 text-xs"
                                        value={config.commission_value || 0}
                                        onChange={(e) => updateConfig(actualIndex, 'commission_value', e.target.value)}
                                      />
                                    ) : (
                                      <span>{config.commission_value?.toFixed(2) || '0.00'}</span>
                                    )
                                  )}
                                  {config.commission_mode === 'per_contract' && (
                                    <span className="text-xs text-gray-500">Manual</span>
                                  )}
                                </td>

                                <td className="p-2">
                                  {config.commission_mode !== 'per_contract' && (
                                    isEditing ? (
                                      <Select
                                        value={config.tier_mode}
                                        onValueChange={(v) => updateConfig(actualIndex, 'tier_mode', v)}
                                      >
                                        <SelectTrigger className="h-8 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="by_quantity">Por Qtd</SelectItem>
                                          {isTelecom && <SelectItem value="by_monthly_value">Por Valor</SelectItem>}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <span>{getTierModeLabel(config.tier_mode)}</span>
                                    )
                                  )}
                                </td>

                                <td className="p-2">
                                  {config.commission_mode !== 'per_contract' && (
                                    <>
                                      {config.tier_mode === 'by_quantity' && (
                                        isEditing ? (
                                          <Input
                                            type="number"
                                            className="h-8 text-xs"
                                            value={config.min_sales || 0}
                                            onChange={(e) => updateConfig(actualIndex, 'min_sales', e.target.value)}
                                          />
                                        ) : (
                                          <span>{config.min_sales || 0} vendas</span>
                                        )
                                      )}
                                      {config.tier_mode === 'by_monthly_value' && (
                                        isEditing ? (
                                          <div className="flex gap-1 items-center">
                                            <Input
                                              type="number"
                                              step="0.01"
                                              className="h-8 text-xs w-20"
                                              value={config.monthly_value_min || 0}
                                              onChange={(e) => updateConfig(actualIndex, 'monthly_value_min', e.target.value)}
                                            />
                                            <span className="text-xs">a</span>
                                            <Input
                                              type="number"
                                              step="0.01"
                                              className="h-8 text-xs w-20"
                                              value={config.monthly_value_max || 0}
                                              onChange={(e) => updateConfig(actualIndex, 'monthly_value_max', e.target.value)}
                                            />
                                          </div>
                                        ) : (
                                          <span className="text-xs">
                                            {config.monthly_value_min?.toFixed(2) || '0.00'}€ - {config.monthly_value_max > 0 ? `${config.monthly_value_max.toFixed(2)}€` : '∞'}
                                          </span>
                                        )
                                      )}
                                    </>
                                  )}
                                </td>

                                <td className="p-2">
                                  {isEditing ? (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="checkbox"
                                          checked={config.has_retention}
                                          onChange={(e) => updateConfig(actualIndex, 'has_retention', e.target.checked)}
                                          className="w-3 h-3"
                                        />
                                        <span className="text-xs">Ativo</span>
                                      </div>
                                      {config.has_retention && (
                                        <div className="flex gap-1 text-xs">
                                          <Input
                                            type="number"
                                            step="0.1"
                                            className="h-7 text-xs w-12"
                                            value={config.retention_percentage || 0}
                                            onChange={(e) => updateConfig(actualIndex, 'retention_percentage', e.target.value)}
                                          />
                                          <span>%</span>
                                          <Input
                                            type="number"
                                            className="h-7 text-xs w-12"
                                            value={config.retention_months || 0}
                                            onChange={(e) => updateConfig(actualIndex, 'retention_months', e.target.value)}
                                          />
                                          <span>m</span>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    config.has_retention ? (
                                      <span className="text-xs text-green-700">
                                        {config.retention_percentage}% / {config.retention_months}m
                                      </span>
                                    ) : (
                                      <span className="text-xs text-gray-400">Não</span>
                                    )
                                  )}
                                </td>

                                <td className="p-2">
                                  {isEditing ? (
                                    <div className="flex gap-1 text-xs">
                                      <Input
                                        type="number"
                                        step="0.01"
                                        className="h-7 text-xs w-16"
                                        value={config.direct_debit_bonus || 0}
                                        onChange={(e) => updateConfig(actualIndex, 'direct_debit_bonus', e.target.value)}
                                        placeholder="DD"
                                      />
                                      <Input
                                        type="number"
                                        step="0.01"
                                        className="h-7 text-xs w-16"
                                        value={config.electronic_invoice_bonus || 0}
                                        onChange={(e) => updateConfig(actualIndex, 'electronic_invoice_bonus', e.target.value)}
                                        placeholder="FE"
                                      />
                                    </div>
                                  ) : (
                                    <span className="text-xs">
                                      {config.direct_debit_bonus > 0 || config.electronic_invoice_bonus > 0 ? (
                                        <>
                                          {config.direct_debit_bonus > 0 && `DD: ${config.direct_debit_bonus.toFixed(2)}€`}
                                          {config.direct_debit_bonus > 0 && config.electronic_invoice_bonus > 0 && ' | '}
                                          {config.electronic_invoice_bonus > 0 && `FE: ${config.electronic_invoice_bonus.toFixed(2)}€`}
                                        </>
                                      ) : (
                                        <span className="text-gray-400">-</span>
                                      )}
                                    </span>
                                  )}
                                </td>

                                <td className="p-2 text-right">
                                  <div className="flex gap-1 justify-end">
                                    {isEditing ? (
                                      <>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => setEditingIndex(null)}
                                          className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                        >
                                          <Check className="w-4 h-4" />
                                        </Button>
                                      </>
                                    ) : (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setEditingIndex(actualIndex)}
                                        className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </Button>
                                    )}
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => removeConfig(actualIndex)}
                                      className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {showAddForm ? (
                    <Card className="border-2 border-blue-200 bg-blue-50">
                      <CardContent className="pt-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                          <div>
                            <Label className="text-xs">Cliente</Label>
                            <Select value={newConfig.client_type} onValueChange={(v) => setNewConfig({...newConfig, client_type: v})}>
                              <SelectTrigger className="h-8 text-xs bg-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {getClientTypes().map(ct => (
                                  <SelectItem key={ct} value={ct}>{ct}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-xs">Serviço</Label>
                            <Select value={newConfig.service_type} onValueChange={(v) => setNewConfig({...newConfig, service_type: v, service_types: [v]})}>
                              <SelectTrigger className="h-8 text-xs bg-white">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                {getServiceTypes().map(st => (
                                  <SelectItem key={st} value={st}>
                                    {st === 'eletricidade' ? 'Eletricidade' : st === 'gas' ? 'Gás' : st}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {(newConfig.service_type === 'NI' || newConfig.service_type === 'MC') && (
                            <div>
                              <Label className="text-xs">Ativação</Label>
                              <Select value={newConfig.activation_type || 'M2'} onValueChange={(v) => setNewConfig({...newConfig, activation_type: v})}>
                                <SelectTrigger className="h-8 text-xs bg-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="M2">M2</SelectItem>
                                  <SelectItem value="M3">M3</SelectItem>
                                  <SelectItem value="M4">M4</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {newConfig.service_type === 'REFID' && (
                            <div>
                              <Label className="text-xs">Op. REFID</Label>
                              <Select value={newConfig.refid_operation_type || 'both'} onValueChange={(v) => setNewConfig({...newConfig, refid_operation_type: v})}>
                                <SelectTrigger className="h-8 text-xs bg-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="both">Ambos</SelectItem>
                                  <SelectItem value="upsell">Upsell</SelectItem>
                                  <SelectItem value="downsell">Downsell</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          <div>
                            <Label className="text-xs">Modo Comissão</Label>
                            <Select value={newConfig.commission_mode} onValueChange={(v) => setNewConfig({...newConfig, commission_mode: v})}>
                              <SelectTrigger className="h-8 text-xs bg-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="fixed_value">Fixo</SelectItem>
                                {isTelecom && <SelectItem value="monthly_multiplier">Mult. Mensal</SelectItem>}
                                <SelectItem value="per_contract">Por Contrato</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="flex gap-2 justify-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setShowAddForm(false);
                              setNewConfig(getEmptyConfig());
                            }}
                            className="h-8"
                          >
                            <X className="w-3 h-3 mr-1" />
                            Cancelar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={addNewConfig}
                            className="h-8 bg-blue-600 hover:bg-blue-700"
                          >
                            <Check className="w-3 h-3 mr-1" />
                            Adicionar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddForm(true)}
                      className="w-full border-dashed border-2 border-slate-300 hover:border-slate-400 hover:bg-slate-50"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Nova Regra para {partnerType}
                    </Button>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>

        <Button type="button" onClick={handleSaveAll} className="bg-slate-700 hover:bg-slate-800">
          <Save className="w-4 h-4 mr-2" />
          Guardar Tudo
        </Button>
      </div>
    </div>
  );
};

export default CommissionWizard;
