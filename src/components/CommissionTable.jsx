import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Check, X, LocationEdit as Edit2, Zap } from "lucide-react";
import { toast } from "sonner";

const POWER_OPTIONS = [
  "1.15kVA", "2.3kVA", "3.45kVA", "4.6kVA", "5.75kVA", "6.9kVA",
  "10.35kVA", "13.8kVA", "17.25kVA", "20.7kVA", "27.6kVA", "34.5kVA", "41.4kVA", "Outros"
];

function getEmptyConfig() {
  return {
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
    activation_type: null,
    power_value: null,
  };
}

const getServiceTypeLabel = (config) => {
  const types = config.service_types || [config.service_type];
  if (!types || types.length === 0) return 'N/A';
  return types.map(t => {
    if (t === 'eletricidade') return 'Eletr.';
    if (t === 'gas') return 'Gas';
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
  if (mode === 'by_power') return 'Por Potencia';
  return mode;
};

const PowerCommissionSubTable = ({
  configs,
  partnerType,
  d2dLevel,
  revLevel,
  clientType,
  serviceType,
  onAddConfig,
  onUpdateConfig,
  onRemoveConfig,
}) => {
  const [editingPower, setEditingPower] = useState(null);

  const powerConfigs = configs.filter(c =>
    c.partner_type === partnerType &&
    (partnerType === 'D2D' ? c.d2d_level === d2dLevel : c.rev_level === revLevel) &&
    c.client_type === clientType &&
    (c.service_type === serviceType || (c.service_types || []).includes(serviceType)) &&
    c.tier_mode === 'by_power'
  );

  const configuredPowers = new Set(powerConfigs.map(c => c.power_value));

  const handleAddPower = (powerValue) => {
    onAddConfig(partnerType, d2dLevel, revLevel, {
      client_type: clientType,
      service_type: serviceType,
      service_types: [serviceType],
      commission_mode: 'fixed_value',
      commission_value: 0,
      min_sales: 0,
      has_retention: false,
      retention_percentage: 0,
      retention_months: 0,
      direct_debit_bonus: 0,
      electronic_invoice_bonus: 0,
      tier_mode: 'by_power',
      monthly_value_min: 0,
      monthly_value_max: 0,
      refid_operation_type: null,
      activation_type: null,
      power_value: powerValue,
    });
  };

  return (
    <div className="mt-2 rounded-lg border border-cyber-500/20 overflow-hidden">
      <div className="bg-dark-900 px-3 py-2 flex items-center gap-2 border-b border-dark-700">
        <Zap className="w-3.5 h-3.5 text-cyber-400" />
        <span className="text-xs font-semibold text-cyber-400 uppercase tracking-wide">
          Comissoes por Potencia — {clientType === 'particular' ? 'Particular' : 'Empresarial'} / {serviceType === 'eletricidade' ? 'Eletricidade' : 'Gas'}
        </span>
      </div>
      <table className="w-full text-sm border-collapse">
        <thead className="bg-dark-900/60">
          <tr>
            <th className="text-left p-2.5 font-bold text-slate-400 text-xs uppercase tracking-wide">Potencia</th>
            <th className="text-left p-2.5 font-bold text-slate-400 text-xs uppercase tracking-wide">Comissao (€)</th>
            <th className="text-left p-2.5 font-bold text-slate-400 text-xs uppercase tracking-wide">DD (€)</th>
            <th className="text-left p-2.5 font-bold text-slate-400 text-xs uppercase tracking-wide">FE (€)</th>
            <th className="text-right p-2.5 font-bold text-slate-400 text-xs uppercase tracking-wide w-16">Acao</th>
          </tr>
        </thead>
        <tbody>
          {POWER_OPTIONS.map((powerValue) => {
            const existing = powerConfigs.find(c => c.power_value === powerValue);
            const actualIndex = existing ? configs.indexOf(existing) : -1;
            const isEditing = editingPower === powerValue;

            if (!existing) {
              return (
                <tr key={powerValue} className="border-b border-dark-700/30 hover:bg-cyber-500/5 transition-colors">
                  <td className="p-2.5">
                    <span className="text-sm font-medium text-slate-400">{powerValue}</span>
                  </td>
                  <td className="p-2.5" colSpan="3">
                    <span className="text-xs text-slate-600 italic">Nao configurado</span>
                  </td>
                  <td className="p-2.5 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleAddPower(powerValue)}
                      className="h-6 w-6 p-0 text-cyber-400 hover:text-cyber-300 hover:bg-cyber-500/10"
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </td>
                </tr>
              );
            }

            return (
              <tr key={powerValue} className={`border-b border-dark-700/30 transition-colors ${isEditing ? 'bg-cyber-500/5' : 'hover:bg-cyber-500/5'}`}>
                <td className="p-2.5">
                  <span className="text-sm font-semibold text-white">{powerValue}</span>
                </td>
                <td className="p-2.5">
                  {isEditing ? (
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="h-7 text-xs w-24 bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20"
                      value={existing.commission_value || 0}
                      onChange={(e) => onUpdateConfig(actualIndex, 'commission_value', e.target.value)}
                    />
                  ) : (
                    <span className="text-cyber-400 font-semibold">{(existing.commission_value || 0).toFixed(2)}€</span>
                  )}
                </td>
                <td className="p-2.5">
                  {isEditing ? (
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="h-7 text-xs w-20 bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20"
                      value={existing.direct_debit_bonus || 0}
                      onChange={(e) => onUpdateConfig(actualIndex, 'direct_debit_bonus', e.target.value)}
                    />
                  ) : (
                    <span className="text-slate-300 text-xs">
                      {existing.direct_debit_bonus > 0 ? `${(existing.direct_debit_bonus).toFixed(2)}€` : <span className="text-slate-600">—</span>}
                    </span>
                  )}
                </td>
                <td className="p-2.5">
                  {isEditing ? (
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="h-7 text-xs w-20 bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20"
                      value={existing.electronic_invoice_bonus || 0}
                      onChange={(e) => onUpdateConfig(actualIndex, 'electronic_invoice_bonus', e.target.value)}
                    />
                  ) : (
                    <span className="text-slate-300 text-xs">
                      {existing.electronic_invoice_bonus > 0 ? `${(existing.electronic_invoice_bonus).toFixed(2)}€` : <span className="text-slate-600">—</span>}
                    </span>
                  )}
                </td>
                <td className="p-2.5 text-right">
                  <div className="flex gap-1 justify-end">
                    {isEditing ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingPower(null)}
                        className="h-6 w-6 p-0 text-green-400 hover:text-green-300 hover:bg-green-500/10"
                      >
                        <Check className="w-3 h-3" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingPower(powerValue)}
                        className="h-6 w-6 p-0 text-slate-400 hover:text-white hover:bg-dark-700"
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onRemoveConfig(actualIndex)}
                      className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const CommissionTable = ({
  configs,
  filteredConfigs,
  partnerType,
  d2dLevel,
  revLevel,
  isTelecom,
  isEnergy,
  getServiceTypes,
  getClientTypes,
  onAddConfig,
  onUpdateConfig,
  onRemoveConfig,
}) => {
  const [editingIndex, setEditingIndex] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newConfig, setNewConfig] = useState(getEmptyConfig());

  const nonPowerConfigs = filteredConfigs.filter(c => c.tier_mode !== 'by_power');

  const powerGroups = [];
  if (isEnergy) {
    const getServiceTypes_ = getServiceTypes();
    getClientTypes().forEach(ct => {
      getServiceTypes_.forEach(st => {
        const hasPowerConfigs = configs.some(c =>
          c.partner_type === partnerType &&
          (partnerType === 'D2D' ? c.d2d_level === d2dLevel : c.rev_level === revLevel) &&
          c.client_type === ct &&
          (c.service_type === st || (c.service_types || []).includes(st)) &&
          c.tier_mode === 'by_power'
        );
        if (hasPowerConfigs) {
          powerGroups.push({ clientType: ct, serviceType: st });
        }
      });
    });
  }

  const handleAdd = () => {
    if (newConfig.tier_mode === 'by_power') {
      const serviceType = newConfig.service_type;
      if (!serviceType) {
        return false;
      }
      getClientTypes().forEach(ct => {
        POWER_OPTIONS.forEach(powerValue => {
          onAddConfig(partnerType, d2dLevel, revLevel, {
            ...newConfig,
            client_type: ct,
            service_types: [serviceType],
            tier_mode: 'by_power',
            power_value: powerValue,
            commission_value: 0,
          });
        });
      });
      setNewConfig(getEmptyConfig());
      setShowAddForm(false);
      toast.success('Tabela de potencias adicionada');
      return true;
    }
    const success = onAddConfig(partnerType, d2dLevel, revLevel, newConfig);
    if (success) {
      setNewConfig(getEmptyConfig());
      setShowAddForm(false);
    }
    return success;
  };

  return (
    <div className="space-y-4">
      <div className="table-container bg-dark-850 border border-white/[0.06] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-dark-900 border-b-2 border-dark-700">
              <tr>
                <th className="text-left p-3 font-bold text-cyber-400 text-xs uppercase tracking-wide">Cliente</th>
                <th className="text-left p-3 font-bold text-cyber-400 text-xs uppercase tracking-wide">Servico</th>
                <th className="text-left p-3 font-bold text-cyber-400 text-xs uppercase tracking-wide">Modo</th>
                <th className="text-left p-3 font-bold text-cyber-400 text-xs uppercase tracking-wide">Valor/Mult.</th>
                <th className="text-left p-3 font-bold text-cyber-400 text-xs uppercase tracking-wide">Patamar</th>
                <th className="text-left p-3 font-bold text-cyber-400 text-xs uppercase tracking-wide">Min Vendas / Range</th>
                <th className="text-left p-3 font-bold text-cyber-400 text-xs uppercase tracking-wide">Retencao</th>
                <th className="text-left p-3 font-bold text-cyber-400 text-xs uppercase tracking-wide">DD/FE</th>
                <th className="text-right p-3 font-bold text-cyber-400 text-xs uppercase tracking-wide w-24">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {nonPowerConfigs.length === 0 && powerGroups.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center p-8 text-slate-400">
                    Nenhuma configuracao. Clique em "+ Nova Regra" para adicionar.
                  </td>
                </tr>
              ) : (
                nonPowerConfigs.map((config) => {
                  const actualIndex = configs.indexOf(config);
                  const isEditing = editingIndex === actualIndex;

                  return (
                    <tr key={actualIndex} className="hover:bg-cyber-500/5 transition-all duration-150 border-b border-dark-700/40">
                      <td className="p-2">
                        {isEditing ? (
                          <Select value={config.client_type} onValueChange={(v) => onUpdateConfig(actualIndex, 'client_type', v)}>
                            <SelectTrigger className="h-8 text-xs bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {getClientTypes().map(ct => (
                                <SelectItem key={ct} value={ct}>{ct}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="capitalize text-slate-300">{config.client_type}</span>
                        )}
                      </td>

                      <td className="p-2">
                        <div>
                          <span className="font-medium text-slate-300">{getServiceTypeLabel(config)}</span>
                          {config.activation_type && (
                            <span className="ml-1 text-xs text-cyber-400">({config.activation_type})</span>
                          )}
                          {config.refid_operation_type && (
                            <span className="ml-1 text-xs text-cyber-400">
                              ({config.refid_operation_type === 'both' ? 'Up+Down' : config.refid_operation_type === 'upsell' ? 'Up' : 'Down'})
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-2">
                        {isEditing ? (
                          <Select value={config.commission_mode} onValueChange={(v) => onUpdateConfig(actualIndex, 'commission_mode', v)}>
                            <SelectTrigger className="h-8 text-xs bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fixed_value">Fixo</SelectItem>
                              {isTelecom && <SelectItem value="monthly_multiplier">Mult. Mensal</SelectItem>}
                              <SelectItem value="per_contract">Por Contrato</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-slate-300">{getCommissionModeLabel(config.commission_mode)}</span>
                        )}
                      </td>

                      <td className="p-2">
                        {config.commission_mode !== 'per_contract' ? (
                          isEditing ? (
                            <Input
                              type="number"
                              step="0.01"
                              className="h-8 text-xs bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20"
                              value={config.commission_value || 0}
                              onChange={(e) => onUpdateConfig(actualIndex, 'commission_value', e.target.value)}
                            />
                          ) : (
                            <span className="text-cyber-400 font-medium">{config.commission_value?.toFixed(2) || '0.00'}</span>
                          )
                        ) : (
                          <span className="text-xs text-slate-500">Manual</span>
                        )}
                      </td>

                      <td className="p-2">
                        {config.commission_mode !== 'per_contract' && (
                          isEditing ? (
                            <Select value={config.tier_mode} onValueChange={(v) => onUpdateConfig(actualIndex, 'tier_mode', v)}>
                              <SelectTrigger className="h-8 text-xs bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="by_quantity">Por Qtd</SelectItem>
                                {isTelecom && <SelectItem value="by_monthly_value">Por Valor</SelectItem>}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-slate-300">{getTierModeLabel(config.tier_mode)}</span>
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
                                  className="h-8 text-xs bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20"
                                  value={config.min_sales || 0}
                                  onChange={(e) => onUpdateConfig(actualIndex, 'min_sales', e.target.value)}
                                />
                              ) : (
                                <span className="text-slate-300">{config.min_sales || 0} vendas</span>
                              )
                            )}
                            {config.tier_mode === 'by_monthly_value' && (
                              isEditing ? (
                                <div className="flex gap-1 items-center">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    className="h-8 text-xs w-20 bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20"
                                    value={config.monthly_value_min || 0}
                                    onChange={(e) => onUpdateConfig(actualIndex, 'monthly_value_min', e.target.value)}
                                  />
                                  <span className="text-xs text-slate-400">a</span>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    className="h-8 text-xs w-20 bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20"
                                    value={config.monthly_value_max || 0}
                                    onChange={(e) => onUpdateConfig(actualIndex, 'monthly_value_max', e.target.value)}
                                  />
                                </div>
                              ) : (
                                <span className="text-xs text-slate-300">
                                  {config.monthly_value_min?.toFixed(2) || '0.00'} - {config.monthly_value_max > 0 ? `${config.monthly_value_max.toFixed(2)}` : '\u221E'}
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
                                onChange={(e) => onUpdateConfig(actualIndex, 'has_retention', e.target.checked)}
                                className="w-3 h-3 accent-cyber-500"
                              />
                              <span className="text-xs text-slate-300">Ativo</span>
                            </div>
                            {config.has_retention && (
                              <div className="flex gap-1 text-xs">
                                <Input
                                  type="number"
                                  step="0.1"
                                  className="h-7 text-xs w-12 bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20"
                                  value={config.retention_percentage || 0}
                                  onChange={(e) => onUpdateConfig(actualIndex, 'retention_percentage', e.target.value)}
                                />
                                <span className="text-slate-400">%</span>
                                <Input
                                  type="number"
                                  className="h-7 text-xs w-12 bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20"
                                  value={config.retention_months || 0}
                                  onChange={(e) => onUpdateConfig(actualIndex, 'retention_months', e.target.value)}
                                />
                                <span className="text-slate-400">m</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          config.has_retention ? (
                            <span className="text-xs text-neon-400">
                              {config.retention_percentage}% / {config.retention_months}m
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">Nao</span>
                          )
                        )}
                      </td>

                      <td className="p-2">
                        {isEditing ? (
                          <div className="flex gap-1 text-xs">
                            <Input
                              type="number"
                              step="0.01"
                              className="h-7 text-xs w-16 bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20"
                              value={config.direct_debit_bonus || 0}
                              onChange={(e) => onUpdateConfig(actualIndex, 'direct_debit_bonus', e.target.value)}
                              placeholder="DD"
                            />
                            <Input
                              type="number"
                              step="0.01"
                              className="h-7 text-xs w-16 bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20"
                              value={config.electronic_invoice_bonus || 0}
                              onChange={(e) => onUpdateConfig(actualIndex, 'electronic_invoice_bonus', e.target.value)}
                              placeholder="FE"
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">
                            {config.direct_debit_bonus > 0 || config.electronic_invoice_bonus > 0 ? (
                              <>
                                {config.direct_debit_bonus > 0 && `DD: ${config.direct_debit_bonus.toFixed(2)}\u20AC`}
                                {config.direct_debit_bonus > 0 && config.electronic_invoice_bonus > 0 && ' | '}
                                {config.electronic_invoice_bonus > 0 && `FE: ${config.electronic_invoice_bonus.toFixed(2)}\u20AC`}
                              </>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </span>
                        )}
                      </td>

                      <td className="p-2 text-right">
                        <div className="flex gap-1 justify-end">
                          {isEditing ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingIndex(null)}
                              className="h-7 w-7 p-0 text-green-400 hover:text-green-300 hover:bg-green-500/10 transition-all duration-200"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingIndex(actualIndex)}
                              className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-dark-700 transition-all duration-200"
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => onRemoveConfig(actualIndex)}
                            className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200"
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
      </div>

      {powerGroups.map(({ clientType, serviceType }) => (
        <PowerCommissionSubTable
          key={`${clientType}-${serviceType}`}
          configs={configs}
          partnerType={partnerType}
          d2dLevel={d2dLevel}
          revLevel={revLevel}
          clientType={clientType}
          serviceType={serviceType}
          onAddConfig={onAddConfig}
          onUpdateConfig={onUpdateConfig}
          onRemoveConfig={onRemoveConfig}
        />
      ))}

      {showAddForm ? (
        <div className="bg-dark-850 border-2 border-cyber-500/20 rounded-lg p-6 shadow-lg shadow-cyber-500/10">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-cyber-400" />
            Nova Regra de Comissao
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div>
              <Label className="text-xs font-semibold text-white">Servico</Label>
              <Select value={newConfig.service_type} onValueChange={(v) => setNewConfig({...newConfig, service_type: v, service_types: [v]})}>
                <SelectTrigger className="h-9 text-xs bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {getServiceTypes().map(st => (
                    <SelectItem key={st} value={st}>
                      {st === 'eletricidade' ? 'Eletricidade' : st === 'gas' ? 'Gas' : st}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {newConfig.tier_mode !== 'by_power' && (
              <div>
                <Label className="text-xs font-semibold text-white">Cliente</Label>
                <Select value={newConfig.client_type} onValueChange={(v) => setNewConfig({...newConfig, client_type: v})}>
                  <SelectTrigger className="h-9 text-xs bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getClientTypes().map(ct => (
                      <SelectItem key={ct} value={ct}>{ct}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(newConfig.service_type === 'NI' || newConfig.service_type === 'MC' || newConfig.service_type === 'REFID' || newConfig.service_type === 'Refid') && (
              <div>
                <Label className="text-xs font-semibold text-white">Ativacao</Label>
                <Select value={newConfig.activation_type || 'all'} onValueChange={(v) => setNewConfig({...newConfig, activation_type: v})}>
                  <SelectTrigger className="h-9 text-xs bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(newConfig.service_type === 'NI' || newConfig.service_type === 'MC') && (
                      <>
                        <SelectItem value="all">Todos (M2/M3/M4)</SelectItem>
                        <SelectItem value="M2">M2</SelectItem>
                        <SelectItem value="M3">M3</SelectItem>
                        <SelectItem value="M4">M4</SelectItem>
                        <SelectItem value="Movel">Movel</SelectItem>
                      </>
                    )}
                    {(newConfig.service_type === 'REFID' || newConfig.service_type === 'Refid') && (
                      <>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="Movel">Movel</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {newConfig.service_type === 'REFID' && (
              <div>
                <Label className="text-xs font-semibold text-white">Op. REFID</Label>
                <Select value={newConfig.refid_operation_type || 'both'} onValueChange={(v) => setNewConfig({...newConfig, refid_operation_type: v})}>
                  <SelectTrigger className="h-9 text-xs bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20">
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
              <Label className="text-xs font-semibold text-white">Modo Comissao</Label>
              <Select
                value={newConfig.tier_mode === 'by_power' ? 'by_power' : newConfig.commission_mode}
                onValueChange={(v) => {
                  if (v === 'by_power') {
                    setNewConfig({...newConfig, tier_mode: 'by_power', commission_mode: 'fixed_value'});
                  } else {
                    setNewConfig({...newConfig, tier_mode: 'by_quantity', commission_mode: v});
                  }
                }}
              >
                <SelectTrigger className="h-9 text-xs bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed_value">Fixo</SelectItem>
                  {isTelecom && <SelectItem value="monthly_multiplier">Mult. Mensal</SelectItem>}
                  <SelectItem value="per_contract">Por Contrato</SelectItem>
                  {isEnergy && <SelectItem value="by_power">Por Potencia</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>

          {newConfig.tier_mode === 'by_power' && newConfig.service_type && (
            <div className="mb-4 p-3 bg-cyber-500/5 border border-cyber-500/20 rounded-lg">
              <p className="text-xs text-cyber-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                Sera criada uma tabela de comissoes para todas as potencias ({POWER_OPTIONS.length} potencias) x todos os tipos de cliente ({getClientTypes().length}). Pode configurar os valores individualmente apos adicionar.
              </p>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setShowAddForm(false);
                setNewConfig(getEmptyConfig());
              }}
              className="h-8 bg-dark-900 border-dark-700 text-slate-300 hover:border-dark-600 hover:bg-dark-800 transition-all duration-200"
            >
              <X className="w-3 h-3 mr-1" />
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAdd}
              className="h-8 bg-gradient-to-r from-cyber-500 to-cyber-600 text-white hover:from-cyber-600 hover:to-cyber-700 shadow-lg shadow-cyber-500/20 font-semibold transition-all duration-300"
            >
              <Check className="w-3 h-3 mr-1" />
              Adicionar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowAddForm(true)}
          className="w-full border-dashed border-2 border-dark-700 hover:border-cyber-500 hover:bg-cyber-500/10 text-slate-300 hover:text-white font-semibold transition-all duration-300 h-12"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nova Regra para {partnerType}{d2dLevel ? ` ${d2dLevel}` : ''}
        </Button>
      )}
    </div>
  );
};

export default CommissionTable;
