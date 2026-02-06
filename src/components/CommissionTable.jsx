import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Check, X, Edit2 } from "lucide-react";

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
    activation_type: null
  };
}

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

const CommissionTable = ({
  configs,
  filteredConfigs,
  partnerType,
  d2dLevel,
  isTelecom,
  getServiceTypes,
  getClientTypes,
  onAddConfig,
  onUpdateConfig,
  onRemoveConfig,
}) => {
  const [editingIndex, setEditingIndex] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newConfig, setNewConfig] = useState(getEmptyConfig());

  const handleAdd = () => {
    const success = onAddConfig(partnerType, d2dLevel, newConfig);
    if (success) {
      setNewConfig(getEmptyConfig());
      setShowAddForm(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="glass-ultra overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-dark-800/50 border-b-2 border-dark-600">
              <tr>
                <th className="text-left p-3 font-bold text-white text-xs uppercase tracking-wide">Cliente</th>
                <th className="text-left p-3 font-bold text-white text-xs uppercase tracking-wide">Serviço</th>
                <th className="text-left p-3 font-bold text-white text-xs uppercase tracking-wide">Modo</th>
                <th className="text-left p-3 font-bold text-white text-xs uppercase tracking-wide">Valor/Mult.</th>
                <th className="text-left p-3 font-bold text-white text-xs uppercase tracking-wide">Patamar</th>
                <th className="text-left p-3 font-bold text-white text-xs uppercase tracking-wide">Min Vendas / Range</th>
                <th className="text-left p-3 font-bold text-white text-xs uppercase tracking-wide">Retenção</th>
                <th className="text-left p-3 font-bold text-white text-xs uppercase tracking-wide">DD/FE</th>
                <th className="text-right p-3 font-bold text-white text-xs uppercase tracking-wide w-24">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredConfigs.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center p-8 text-dark-400">
                    Nenhuma configuração. Clique em "+ Nova Regra" para adicionar.
                  </td>
                </tr>
              ) : (
                filteredConfigs.map((config) => {
                  const actualIndex = configs.indexOf(config);
                  const isEditing = editingIndex === actualIndex;

                  return (
                    <tr key={actualIndex} className="hover:bg-gold-400/10 transition-all duration-150 border-b border-dark-600/40">
                      <td className="p-2">
                        {isEditing ? (
                          <Select value={config.client_type} onValueChange={(v) => onUpdateConfig(actualIndex, 'client_type', v)}>
                            <SelectTrigger className="h-8 text-xs border-2 border-dark-600 focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20">
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
                            <span className="ml-1 text-xs text-blue-400">({config.activation_type})</span>
                          )}
                          {config.refid_operation_type && (
                            <span className="ml-1 text-xs text-amber-400">
                              ({config.refid_operation_type === 'both' ? 'Up+Down' : config.refid_operation_type === 'upsell' ? 'Up' : 'Down'})
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-2">
                        {isEditing ? (
                          <Select value={config.commission_mode} onValueChange={(v) => onUpdateConfig(actualIndex, 'commission_mode', v)}>
                            <SelectTrigger className="h-8 text-xs border-2 border-dark-600 focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20">
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
                        {config.commission_mode !== 'per_contract' ? (
                          isEditing ? (
                            <Input
                              type="number"
                              step="0.01"
                              className="h-8 text-xs border-2 border-dark-600 focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20"
                              value={config.commission_value || 0}
                              onChange={(e) => onUpdateConfig(actualIndex, 'commission_value', e.target.value)}
                            />
                          ) : (
                            <span>{config.commission_value?.toFixed(2) || '0.00'}</span>
                          )
                        ) : (
                          <span className="text-xs text-dark-400">Manual</span>
                        )}
                      </td>

                      <td className="p-2">
                        {config.commission_mode !== 'per_contract' && (
                          isEditing ? (
                            <Select value={config.tier_mode} onValueChange={(v) => onUpdateConfig(actualIndex, 'tier_mode', v)}>
                              <SelectTrigger className="h-8 text-xs border-2 border-dark-600 focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20">
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
                                  className="h-8 text-xs border-2 border-dark-600 focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20"
                                  value={config.min_sales || 0}
                                  onChange={(e) => onUpdateConfig(actualIndex, 'min_sales', e.target.value)}
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
                                    className="h-8 text-xs w-20 border-2 border-dark-600 focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20"
                                    value={config.monthly_value_min || 0}
                                    onChange={(e) => onUpdateConfig(actualIndex, 'monthly_value_min', e.target.value)}
                                  />
                                  <span className="text-xs">a</span>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    className="h-8 text-xs w-20 border-2 border-dark-600 focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20"
                                    value={config.monthly_value_max || 0}
                                    onChange={(e) => onUpdateConfig(actualIndex, 'monthly_value_max', e.target.value)}
                                  />
                                </div>
                              ) : (
                                <span className="text-xs">
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
                                className="w-3 h-3"
                              />
                              <span className="text-xs">Ativo</span>
                            </div>
                            {config.has_retention && (
                              <div className="flex gap-1 text-xs">
                                <Input
                                  type="number"
                                  step="0.1"
                                  className="h-7 text-xs w-12 border-2 border-dark-600 focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20"
                                  value={config.retention_percentage || 0}
                                  onChange={(e) => onUpdateConfig(actualIndex, 'retention_percentage', e.target.value)}
                                />
                                <span>%</span>
                                <Input
                                  type="number"
                                  className="h-7 text-xs w-12 border-2 border-dark-600 focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20"
                                  value={config.retention_months || 0}
                                  onChange={(e) => onUpdateConfig(actualIndex, 'retention_months', e.target.value)}
                                />
                                <span>m</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          config.has_retention ? (
                            <span className="text-xs text-green-400">
                              {config.retention_percentage}% / {config.retention_months}m
                            </span>
                          ) : (
                            <span className="text-xs text-dark-400">Não</span>
                          )
                        )}
                      </td>

                      <td className="p-2">
                        {isEditing ? (
                          <div className="flex gap-1 text-xs">
                            <Input
                              type="number"
                              step="0.01"
                              className="h-7 text-xs w-16 border-2 border-dark-600 focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20"
                              value={config.direct_debit_bonus || 0}
                              onChange={(e) => onUpdateConfig(actualIndex, 'direct_debit_bonus', e.target.value)}
                              placeholder="DD"
                            />
                            <Input
                              type="number"
                              step="0.01"
                              className="h-7 text-xs w-16 border-2 border-dark-600 focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20"
                              value={config.electronic_invoice_bonus || 0}
                              onChange={(e) => onUpdateConfig(actualIndex, 'electronic_invoice_bonus', e.target.value)}
                              placeholder="FE"
                            />
                          </div>
                        ) : (
                          <span className="text-xs">
                            {config.direct_debit_bonus > 0 || config.electronic_invoice_bonus > 0 ? (
                              <>
                                {config.direct_debit_bonus > 0 && `DD: ${config.direct_debit_bonus.toFixed(2)}\u20AC`}
                                {config.direct_debit_bonus > 0 && config.electronic_invoice_bonus > 0 && ' | '}
                                {config.electronic_invoice_bonus > 0 && `FE: ${config.electronic_invoice_bonus.toFixed(2)}\u20AC`}
                              </>
                            ) : (
                              <span className="text-dark-400">-</span>
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
                              className="h-7 w-7 p-0 text-dark-200 hover:text-white hover:bg-dark-700 transition-all duration-200"
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

      {showAddForm ? (
        <div className="glass-ultra border-2 border-gold-400/20 bg-dark-800 p-6 shadow-lg shadow-gold-400/20">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-gold-400" />
            Nova Regra de Comissão
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div>
              <Label className="text-xs font-semibold text-white">Cliente</Label>
              <Select value={newConfig.client_type} onValueChange={(v) => setNewConfig({...newConfig, client_type: v})}>
                <SelectTrigger className="h-9 text-xs bg-dark-800 border-2 border-dark-600 focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20">
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
              <Label className="text-xs font-semibold text-white">Serviço</Label>
              <Select value={newConfig.service_type} onValueChange={(v) => setNewConfig({...newConfig, service_type: v, service_types: [v]})}>
                <SelectTrigger className="h-9 text-xs bg-dark-800 border-2 border-dark-600 focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20">
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
                <Label className="text-xs font-semibold text-white">Ativação</Label>
                <Select value={newConfig.activation_type || 'M2'} onValueChange={(v) => setNewConfig({...newConfig, activation_type: v})}>
                  <SelectTrigger className="h-9 text-xs bg-dark-800 border-2 border-dark-600 focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20">
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
                <Label className="text-xs font-semibold text-white">Op. REFID</Label>
                <Select value={newConfig.refid_operation_type || 'both'} onValueChange={(v) => setNewConfig({...newConfig, refid_operation_type: v})}>
                  <SelectTrigger className="h-9 text-xs bg-dark-800 border-2 border-dark-600 focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20">
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
              <Label className="text-xs font-semibold text-white">Modo Comissão</Label>
              <Select value={newConfig.commission_mode} onValueChange={(v) => setNewConfig({...newConfig, commission_mode: v})}>
                <SelectTrigger className="h-9 text-xs bg-dark-800 border-2 border-dark-600 focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20">
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
              className="h-8 border-2 border-dark-600 hover:border-dark-500 hover:bg-dark-700 transition-all duration-200"
            >
              <X className="w-3 h-3 mr-1" />
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAdd}
              className="h-8 bg-gold-400 hover:bg-gold-500 text-dark-900 shadow-lg shadow-gold-400/20 font-semibold transition-all duration-300"
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
          className="w-full border-dashed border-2 border-dark-600 hover:border-gold-400 hover:bg-gold-400/10 text-dark-200 hover:text-white font-semibold transition-all duration-300 h-12"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nova Regra para {partnerType}{d2dLevel ? ` ${d2dLevel}` : ''}
        </Button>
      )}
    </div>
  );
};

export default CommissionTable;
