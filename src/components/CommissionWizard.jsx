import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Trash2, Plus, Check, X, LocationEdit as Edit2, Layers, Wifi, Satellite } from "lucide-react";
import { toast } from "sonner";
import { operatorsService } from "../services/operatorsService";
import { partnerTypesService } from "../services/partnerTypesService";
import { useConfirm } from "@/components/ui/confirm-dialog";

import CommissionTable from "./CommissionTable";

const CommissionWizard = ({ operator, onSave, onCancel }) => {
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [partnerTypes, setPartnerTypes] = useState([]);
  const [activePartnerTab, setActivePartnerTab] = useState('D2D');
  const [levelsByType, setLevelsByType] = useState({});
  const [activeLevelByType, setActiveLevelByType] = useState({});
  const [activeTechnology, setActiveTechnology] = useState('Fibra');

  useEffect(() => {
    setLoading(true);
    setConfigs([]);
    loadConfigs();
  }, [operator?.id]);

  const loadConfigs = async () => {
    if (!operator?.id) {
      setLoading(false);
      return;
    }

    try {
      const [data, ptData] = await Promise.all([
        operatorsService.getCommissionConfigs(operator.id),
        partnerTypesService.getAll(true).catch(() => [])
      ]);

      const pts = ptData.length > 0 ? ptData : [
        { slug: 'D2D', display_name: 'D2D', level_type: 'named', has_levels: true, max_levels: 10, default_level_names: ['Nv1'] },
        { slug: 'REV', display_name: 'REV', level_type: 'numeric', has_levels: true, max_levels: 5, default_level_names: [] },
        { slug: 'Rev+', display_name: 'Rev+', level_type: 'numeric', has_levels: true, max_levels: 5, default_level_names: [] },
      ];
      setPartnerTypes(pts);

      const withDefaults = data.map(c => ({
        ...c,
        d2d_level: c.d2d_level || null,
        rev_level: c.rev_level || null,
      }));
      setConfigs(withDefaults);

      const newLevelsByType = {};
      const newActiveLevels = {};

      pts.forEach(pt => {
        if (!pt.has_levels) {
          newLevelsByType[pt.slug] = [null];
          newActiveLevels[pt.slug] = null;
          return;
        }

        const isNamed = pt.level_type === 'named';
        const levelsFromConfigs = new Set();

        withDefaults.forEach(c => {
          if (c.partner_type !== pt.slug) return;
          if (isNamed && c.d2d_level) levelsFromConfigs.add(c.d2d_level);
          if (!isNamed && c.rev_level) levelsFromConfigs.add(c.rev_level);
        });

        if (levelsFromConfigs.size === 0) {
          if (isNamed) {
            const defaults = pt.default_level_names?.length > 0 ? pt.default_level_names : ['Nv1'];
            defaults.forEach(l => levelsFromConfigs.add(l));
          } else {
            levelsFromConfigs.add(1);
          }
        }

        const sorted = isNamed
          ? Array.from(levelsFromConfigs).sort((a, b) => {
              const numA = parseInt(String(a).replace(/\D/g, '')) || 0;
              const numB = parseInt(String(b).replace(/\D/g, '')) || 0;
              return numA - numB;
            })
          : Array.from(levelsFromConfigs).sort((a, b) => a - b);

        newLevelsByType[pt.slug] = sorted;
        newActiveLevels[pt.slug] = sorted[0];
      });

      setLevelsByType(newLevelsByType);
      setActiveLevelByType(newActiveLevels);
      if (pts.length > 0) setActivePartnerTab(pts[0].slug);
    } catch (error) {
      console.error('Error loading configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const isTelecom = operator?.scope === 'telecomunicacoes';
  const isEnergy = operator?.scope === 'energia';
  const hasSATIndividual = isTelecom && (operator?.allowed_technologies || []).includes('SAT') && operator?.sat_commission_mode === 'individual';

  const getTechnologyForConfig = () => {
    if (!hasSATIndividual) return null;
    return activeTechnology === 'SAT' ? 'SAT' : null;
  };

  const filterConfigsByTechnology = (cfgs) => {
    if (!hasSATIndividual) return cfgs;
    if (activeTechnology === 'SAT') {
      return cfgs.filter(c => c.technology === 'SAT');
    }
    return cfgs.filter(c => !c.technology || c.technology === 'Fibra');
  };
  const additionalServicesList = (operator?.additional_services_list || []).map(s =>
    typeof s === 'string' ? s : s?.name
  ).filter(Boolean);
  const hasAdditionalServices = operator?.requires_additional_services && additionalServicesList.length > 0;

  const getServiceTypes = () => {
    if (isTelecom) return ['NI', 'MC', 'REFID'];
    if (isEnergy) return operator?.allowed_energy_types || ['eletricidade', 'gas'];
    return ['default'];
  };

  const getClientTypes = () => {
    return operator?.allowed_client_types || ['particular', 'empresarial'];
  };

  const getPartnerTypes = () => partnerTypes.map(pt => pt.slug);

  const handleSaveAll = async () => {
    try {
      await operatorsService.saveCommissionConfigs(operator.id, configs);
      toast.success('Configuracoes guardadas!');
      onSave?.();
    } catch (error) {
      console.error('Error saving configs:', error);
      toast.error(`Erro ao guardar: ${error?.message || 'Erro desconhecido'}`);
    }
  };

  const addNewConfig = (partnerType, d2dLevel, revLevel, newConfig) => {
    const isByPower = newConfig.tier_mode === 'by_power';
    if (!isByPower && !newConfig.service_type && (!newConfig.service_types || newConfig.service_types.length === 0)) {
      toast.error('Selecione um tipo de servico');
      return false;
    }

    const configToAdd = {
      ...newConfig,
      partner_type: partnerType,
      d2d_level: partnerType === 'D2D' ? d2dLevel : null,
      rev_level: (partnerType === 'REV' || partnerType === 'Rev+') ? revLevel : null,
      service_types: newConfig.service_types?.length > 0 ? newConfig.service_types : (newConfig.service_type ? [newConfig.service_type] : []),
      technology: newConfig.technology !== undefined ? newConfig.technology : getTechnologyForConfig(),
    };

    setConfigs(prev => {
      const alreadyExists = isByPower && prev.some(c =>
        c.partner_type === configToAdd.partner_type &&
        c.d2d_level === configToAdd.d2d_level &&
        c.rev_level === configToAdd.rev_level &&
        c.client_type === configToAdd.client_type &&
        (c.service_type === configToAdd.service_type || (c.service_types || []).some(t => (configToAdd.service_types || []).includes(t))) &&
        c.tier_mode === 'by_power' &&
        c.power_value === configToAdd.power_value
      );
      if (alreadyExists) return prev;
      return [...prev, configToAdd];
    });
    if (!isByPower) toast.success('Configuracao adicionada');
    return true;
  };

  const updateConfig = (index, field, value) => {
    const newConfigs = [...configs];
    if (['commission_mode', 'tier_mode', 'refid_operation_type', 'activation_type', 'has_retention', 'client_type'].includes(field)) {
      newConfigs[index][field] = value;
    } else {
      newConfigs[index][field] = parseFloat(value) || 0;
    }
    setConfigs(newConfigs);
  };

  const removeConfig = async (index) => {
    const ok = await confirm({ title: 'Remover configuracao?', confirmLabel: 'Remover' });
    if (!ok) return;
    const newConfigs = [...configs];
    newConfigs.splice(index, 1);
    setConfigs(newConfigs);
    toast.success('Configuracao removida');
  };

  const getAdditionalServiceConfig = (partnerType, d2dLevel, revLevel, clientType, serviceName) => {
    const tech = getTechnologyForConfig();
    return configs.find(c =>
      c.partner_type === partnerType &&
      c.service_type === 'additional_service' &&
      c.additional_service_name === serviceName &&
      c.client_type === clientType &&
      (partnerType === 'D2D' ? c.d2d_level === d2dLevel : c.rev_level === revLevel) &&
      (tech === 'SAT' ? c.technology === 'SAT' : (!c.technology || c.technology === 'Fibra'))
    );
  };

  const updateAdditionalServiceConfig = (partnerType, d2dLevel, revLevel, clientType, serviceName, value) => {
    const tech = getTechnologyForConfig();
    const existing = configs.findIndex(c =>
      c.partner_type === partnerType &&
      c.service_type === 'additional_service' &&
      c.additional_service_name === serviceName &&
      c.client_type === clientType &&
      (partnerType === 'D2D' ? c.d2d_level === d2dLevel : c.rev_level === revLevel) &&
      (tech === 'SAT' ? c.technology === 'SAT' : (!c.technology || c.technology === 'Fibra'))
    );
    if (existing >= 0) {
      const newConfigs = [...configs];
      newConfigs[existing] = { ...newConfigs[existing], commission_value: parseFloat(value) || 0 };
      setConfigs(newConfigs);
    } else {
      setConfigs(prev => [...prev, {
        partner_type: partnerType,
        d2d_level: partnerType === 'D2D' ? d2dLevel : null,
        rev_level: (partnerType === 'REV' || partnerType === 'Rev+') ? revLevel : null,
        client_type: clientType,
        service_type: 'additional_service',
        service_types: ['additional_service'],
        additional_service_name: serviceName,
        commission_mode: 'fixed_value',
        commission_value: parseFloat(value) || 0,
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
        technology: tech,
      }]);
    }
  };

  const getPartnerTypeObj = (slug) => partnerTypes.find(pt => pt.slug === slug);

  const addLevel = (ptSlug) => {
    const ptObj = getPartnerTypeObj(ptSlug);
    if (!ptObj || !ptObj.has_levels) return;
    const currentLevels = levelsByType[ptSlug] || [];
    const isNamed = ptObj.level_type === 'named';
    const maxLevels = ptObj.max_levels || 10;

    if (currentLevels.length >= maxLevels) {
      toast.error(`Maximo de ${maxLevels} niveis`);
      return;
    }

    let newLevel;
    if (isNamed) {
      const nextNum = currentLevels.length + 1;
      newLevel = `Nv${nextNum}`;
      if (currentLevels.includes(newLevel)) {
        toast.error(`Nivel ${newLevel} ja existe`);
        return;
      }
    } else {
      newLevel = currentLevels.length > 0 ? Math.max(...currentLevels.map(Number)) + 1 : 1;
      if (currentLevels.includes(newLevel)) {
        toast.error(`Nivel ${newLevel} ja existe`);
        return;
      }
    }

    setLevelsByType(prev => ({
      ...prev,
      [ptSlug]: isNamed ? [...(prev[ptSlug] || []), newLevel] : [...(prev[ptSlug] || []), newLevel].sort((a, b) => a - b)
    }));
    setActiveLevelByType(prev => ({ ...prev, [ptSlug]: newLevel }));
    toast.success(`Nivel ${isNamed ? newLevel : `${newLevel}`} adicionado`);
  };

  const removeLevel = async (ptSlug, level) => {
    const currentLevels = levelsByType[ptSlug] || [];
    if (currentLevels.length <= 1) {
      toast.error('Deve existir pelo menos um nivel');
      return;
    }
    const ptObj = getPartnerTypeObj(ptSlug);
    const isNamed = ptObj?.level_type === 'named';
    const levelLabel = isNamed ? level : `Nivel ${level}`;
    const ok = await confirm({ title: `Remover ${levelLabel}?`, description: 'Todas as configuracoes deste nivel serao removidas.', confirmLabel: 'Remover' });
    if (!ok) return;

    setConfigs(prev => prev.filter(c => {
      if (c.partner_type !== ptSlug) return true;
      if (isNamed) return c.d2d_level !== level;
      return c.rev_level !== level;
    }));
    const newLevels = currentLevels.filter(l => l !== level);
    setLevelsByType(prev => ({ ...prev, [ptSlug]: newLevels }));
    if (activeLevelByType[ptSlug] === level) {
      setActiveLevelByType(prev => ({ ...prev, [ptSlug]: newLevels[0] }));
    }
    toast.success(`${levelLabel} removido`);
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
      {confirmDialog}
      <div className="bg-dark-850 border border-white/[0.06] rounded-lg">
        <div className="border-b border-dark-700 bg-dark-900 p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">
                Configuracao de Comissoes - {operator?.name}
              </h2>
              {hasSATIndividual && (
                <p className="text-xs text-slate-400 mt-1">
                  Este operador suporta Fibra e SAT com comissoes individuais. Alterne entre as tecnologias abaixo.
                </p>
              )}
            </div>
            <Button
              type="button"
              onClick={handleSaveAll}
              size="sm"
              className="bg-gradient-to-r from-cyber-500 to-cyber-600 text-white hover:from-cyber-600 hover:to-cyber-700 shadow-lg shadow-cyber-500/30 hover:shadow-xl transition-all duration-300"
            >
              <Save className="w-4 h-4 mr-2" />
              Guardar Tudo
            </Button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {hasSATIndividual && (
            <Tabs value={activeTechnology} onValueChange={setActiveTechnology} className="w-full mb-4">
              <TabsList className="grid w-full grid-cols-2 bg-dark-900 border border-dark-700 p-1">
                <TabsTrigger
                  value="Fibra"
                  className="data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-400 data-[state=active]:shadow-lg transition-all duration-300 font-semibold"
                >
                  <Wifi className="w-4 h-4 mr-2" />
                  Fibra
                </TabsTrigger>
                <TabsTrigger
                  value="SAT"
                  className="data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400 data-[state=active]:shadow-lg transition-all duration-300 font-semibold"
                >
                  <Satellite className="w-4 h-4 mr-2" />
                  SAT (Individual)
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          <Tabs value={activePartnerTab} onValueChange={setActivePartnerTab} className="w-full">
            <TabsList className={`grid w-full bg-dark-900 border border-dark-700 p-1`} style={{ gridTemplateColumns: `repeat(${Math.min(getPartnerTypes().length, 6)}, 1fr)` }}>
              {getPartnerTypes().map((pt) => (
                <TabsTrigger
                  key={pt}
                  value={pt}
                  className="data-[state=active]:bg-cyber-500/10 data-[state=active]:text-cyber-400 data-[state=active]:shadow-lg transition-all duration-300 font-semibold"
                >
                  {getPartnerTypeObj(pt)?.display_name || pt}
                </TabsTrigger>
              ))}
            </TabsList>

            {getPartnerTypes().map((ptSlug) => {
              const ptObj = getPartnerTypeObj(ptSlug);
              const isNamed = ptObj?.level_type === 'named';
              const levels = levelsByType[ptSlug] || [];
              const activeLevel = activeLevelByType[ptSlug];

              if (!ptObj?.has_levels) {
                const levelConfigs = filterConfigsByTechnology(configs.filter(c => c.partner_type === ptSlug));
                return (
                  <TabsContent key={ptSlug} value={ptSlug} className="mt-4">
                    <CommissionTable
                      configs={configs}
                      filteredConfigs={levelConfigs}
                      partnerType={ptSlug}
                      d2dLevel={null}
                      revLevel={null}
                      isTelecom={isTelecom}
                      isEnergy={isEnergy}
                      getServiceTypes={getServiceTypes}
                      getClientTypes={getClientTypes}
                      onAddConfig={addNewConfig}
                      onUpdateConfig={updateConfig}
                      onRemoveConfig={removeConfig}
                      technology={getTechnologyForConfig()}
                    />
                  </TabsContent>
                );
              }

              return (
                <TabsContent key={ptSlug} value={ptSlug} className="mt-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Tabs
                        value={String(activeLevel)}
                        onValueChange={(v) => setActiveLevelByType(prev => ({ ...prev, [ptSlug]: isNamed ? v : parseInt(v) }))}
                        className="flex-1"
                      >
                        <div className="flex items-center gap-2">
                          <TabsList className="bg-dark-900 border border-dark-700 p-1">
                            {levels.map((level) => (
                              <TabsTrigger
                                key={level}
                                value={String(level)}
                                className="data-[state=active]:bg-cyber-500/10 data-[state=active]:text-cyber-400 data-[state=active]:shadow-md transition-all duration-300 font-semibold text-sm px-4"
                              >
                                <Layers className="w-3.5 h-3.5 mr-1.5" />
                                {isNamed ? level : `Nivel ${level}`}
                              </TabsTrigger>
                            ))}
                          </TabsList>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addLevel(ptSlug)}
                            className="border-dashed border-2 border-dark-700 hover:border-cyber-500 hover:bg-cyber-500/10 text-slate-300 font-semibold h-9"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            Adicionar Nivel
                          </Button>
                        </div>

                        {levels.map((level) => {
                          const levelConfigs = filterConfigsByTechnology(configs.filter(c => {
                            if (c.partner_type !== ptSlug) return false;
                            if (isNamed) return c.d2d_level === level;
                            return c.rev_level === level;
                          }));
                          const levelLabel = isNamed ? level : `Nivel ${level}`;
                          return (
                            <TabsContent key={level} value={String(level)} className="mt-3">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-slate-300">{levelLabel}</span>
                                  <span className="text-xs text-slate-500">({levelConfigs.length} regra{levelConfigs.length !== 1 ? 's' : ''})</span>
                                </div>
                                {levels.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeLevel(ptSlug, level)}
                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 text-xs"
                                  >
                                    <Trash2 className="w-3 h-3 mr-1" />
                                    Remover {levelLabel}
                                  </Button>
                                )}
                              </div>
                              <CommissionTable
                                configs={configs}
                                filteredConfigs={levelConfigs}
                                partnerType={ptSlug}
                                d2dLevel={isNamed ? level : null}
                                revLevel={isNamed ? null : level}
                                isTelecom={isTelecom}
                                isEnergy={isEnergy}
                                getServiceTypes={getServiceTypes}
                                getClientTypes={getClientTypes}
                                onAddConfig={addNewConfig}
                                onUpdateConfig={updateConfig}
                                onRemoveConfig={removeConfig}
                                technology={getTechnologyForConfig()}
                              />
                            </TabsContent>
                          );
                        })}
                      </Tabs>
                    </div>
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
      </div>

      {hasAdditionalServices && (
        <div className="bg-dark-850 border border-white/[0.06] rounded-lg">
          <div className="border-b border-dark-700 bg-dark-900 p-6 rounded-t-lg">
            <h3 className="text-lg font-bold text-white">Comissões - Serviços Adicionais</h3>
            <p className="text-xs text-slate-500 mt-1">Valor adicionado à comissão base quando o serviço adicional é selecionado na venda.</p>
          </div>
          <div className="p-6 space-y-6">
            {getPartnerTypes().map((partnerType) => {
              const ptObj = getPartnerTypeObj(partnerType);
              const isNamed = ptObj?.level_type === 'named';
              const levels = levelsByType[partnerType] || [];
              return (
                <div key={partnerType} className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-300 border-b border-dark-700 pb-2">{ptObj?.display_name || partnerType}</h4>
                  {levels.map((level) => {
                    const d2dLvl = isNamed ? level : null;
                    const revLvl = isNamed ? null : level;
                    return (
                      <div key={level ?? 'default'} className="space-y-2">
                        <p className="text-xs text-slate-500">{isNamed ? level : `Nivel ${level}`}</p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-dark-700">
                                <th className="text-left text-xs text-slate-500 font-medium py-2 pr-4">Serviço Adicional</th>
                                {getClientTypes().map(ct => (
                                  <th key={ct} className="text-left text-xs text-slate-500 font-medium py-2 pr-4 capitalize">{ct} (€)</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {additionalServicesList.map((serviceName) => (
                                <tr key={serviceName} className="border-b border-dark-700/50">
                                  <td className="py-2 pr-4 text-white text-sm">{serviceName}</td>
                                  {getClientTypes().map(clientType => {
                                    const cfg = getAdditionalServiceConfig(partnerType, d2dLvl, revLvl, clientType, serviceName);
                                    return (
                                      <td key={clientType} className="py-2 pr-4">
                                        <Input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={cfg ? cfg.commission_value : 0}
                                          onChange={(e) => updateAdditionalServiceConfig(partnerType, d2dLvl, revLvl, clientType, serviceName, e.target.value)}
                                          className="bg-dark-900 border-dark-700 focus:border-cyber-500 text-white w-28 h-8 text-sm"
                                        />
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center pt-6 border-t-2 border-dark-700">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="bg-dark-900 border-dark-700 text-slate-300 hover:border-dark-600 hover:bg-dark-800 font-semibold px-6"
        >
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={handleSaveAll}
          className="bg-gradient-to-r from-cyber-500 to-cyber-600 text-white hover:from-cyber-600 hover:to-cyber-700 shadow-lg shadow-cyber-500/30 font-semibold px-6 transition-all duration-300"
        >
          <Save className="w-4 h-4 mr-2" />
          Guardar Tudo
        </Button>
      </div>
    </div>
  );
};

export default CommissionWizard;
