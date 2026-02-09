import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Trash2, Plus, Check, X, Edit2, Layers } from "lucide-react";
import { toast } from "sonner";
import { operatorsService } from "../services/operatorsService";

import CommissionTable from "./CommissionTable";

const CommissionWizard = ({ operator, onSave, onCancel }) => {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePartnerTab, setActivePartnerTab] = useState('D2D');
  const [activeD2DLevel, setActiveD2DLevel] = useState('Nv1');
  const [d2dLevels, setD2dLevels] = useState(['Nv1']);

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
      const withDefaults = data.map(c => ({
        ...c,
        d2d_level: c.partner_type === 'D2D' ? (c.d2d_level || 'Nv1') : null,
      }));
      setConfigs(withDefaults);

      const levels = new Set();
      withDefaults.forEach(c => {
        if (c.partner_type === 'D2D' && c.d2d_level) {
          levels.add(c.d2d_level);
        }
      });
      if (levels.size === 0) levels.add('Nv1');
      const sortedLevels = Array.from(levels).sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.replace(/\D/g, '')) || 0;
        return numA - numB;
      });
      setD2dLevels(sortedLevels);
      setActiveD2DLevel(sortedLevels[0]);
    } catch (error) {
      console.error('Error loading configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const isTelecom = operator?.scope === 'telecomunicacoes';
  const isEnergy = operator?.scope === 'energia';

  const getServiceTypes = () => {
    if (isTelecom) return ['NI', 'MC', 'REFID'];
    if (isEnergy) return operator?.allowed_energy_types || ['eletricidade', 'gas'];
    return ['default'];
  };

  const getClientTypes = () => {
    return operator?.allowed_client_types || ['particular', 'empresarial'];
  };

  const getPartnerTypes = () => ['D2D', 'REV', 'Rev+'];

  const handleSaveAll = async () => {
    try {
      await operatorsService.saveCommissionConfigs(operator.id, configs);
      toast.success('Configuracoes guardadas!');
      onSave?.();
    } catch (error) {
      console.error('Error saving configs:', error);
      toast.error('Erro ao guardar configuracoes');
    }
  };

  const addNewConfig = (partnerType, d2dLevel, newConfig) => {
    if (!newConfig.service_type && (!newConfig.service_types || newConfig.service_types.length === 0)) {
      toast.error('Selecione um tipo de servico');
      return false;
    }

    const configToAdd = {
      ...newConfig,
      partner_type: partnerType,
      d2d_level: partnerType === 'D2D' ? d2dLevel : null,
      service_types: newConfig.service_types?.length > 0 ? newConfig.service_types : [newConfig.service_type]
    };

    setConfigs(prev => [...prev, configToAdd]);
    toast.success('Configuracao adicionada');
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

  const removeConfig = (index) => {
    if (!window.confirm('Remover esta configuracao?')) return;
    const newConfigs = [...configs];
    newConfigs.splice(index, 1);
    setConfigs(newConfigs);
    toast.success('Configuracao removida');
  };

  const addD2DLevel = () => {
    const nextNum = d2dLevels.length + 1;
    const newLevel = `Nv${nextNum}`;
    if (d2dLevels.includes(newLevel)) {
      toast.error(`Nivel ${newLevel} ja existe`);
      return;
    }
    setD2dLevels(prev => [...prev, newLevel]);
    setActiveD2DLevel(newLevel);
    toast.success(`Nivel ${newLevel} adicionado`);
  };

  const removeD2DLevel = (level) => {
    if (d2dLevels.length <= 1) {
      toast.error('Deve existir pelo menos um nivel');
      return;
    }
    if (!window.confirm(`Remover ${level} e todas as suas configuracoes?`)) return;

    setConfigs(prev => prev.filter(c => !(c.partner_type === 'D2D' && c.d2d_level === level)));
    const newLevels = d2dLevels.filter(l => l !== level);
    setD2dLevels(newLevels);
    if (activeD2DLevel === level) {
      setActiveD2DLevel(newLevels[0]);
    }
    toast.success(`Nivel ${level} removido`);
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
      <div className="bg-dark-850 border border-white/[0.06] rounded-lg">
        <div className="border-b border-dark-700 bg-dark-900 p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">
              Configuracao de Comissoes - {operator?.name}
            </h2>
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
          <Tabs value={activePartnerTab} onValueChange={setActivePartnerTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-dark-900 border border-dark-700 p-1">
              {getPartnerTypes().map((pt) => (
                <TabsTrigger
                  key={pt}
                  value={pt}
                  className="data-[state=active]:bg-cyber-500/10 data-[state=active]:text-cyber-400 data-[state=active]:shadow-lg transition-all duration-300 font-semibold"
                >
                  {pt}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="D2D" className="mt-4">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Tabs value={activeD2DLevel} onValueChange={setActiveD2DLevel} className="flex-1">
                    <div className="flex items-center gap-2">
                      <TabsList className="bg-dark-900 border border-dark-700 p-1">
                        {d2dLevels.map((level) => (
                          <TabsTrigger
                            key={level}
                            value={level}
                            className="data-[state=active]:bg-cyber-500/10 data-[state=active]:text-cyber-400 data-[state=active]:shadow-md transition-all duration-300 font-semibold text-sm px-4"
                          >
                            <Layers className="w-3.5 h-3.5 mr-1.5" />
                            {level}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addD2DLevel}
                        className="border-dashed border-2 border-dark-700 hover:border-cyber-500 hover:bg-cyber-500/10 text-slate-300 font-semibold h-9"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Adicionar Nivel
                      </Button>
                    </div>

                    {d2dLevels.map((level) => {
                      const levelConfigs = configs.filter(c => c.partner_type === 'D2D' && c.d2d_level === level);
                      return (
                        <TabsContent key={level} value={level} className="mt-3">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-300">{level}</span>
                              <span className="text-xs text-slate-500">({levelConfigs.length} regra{levelConfigs.length !== 1 ? 's' : ''})</span>
                            </div>
                            {d2dLevels.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeD2DLevel(level)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 text-xs"
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Remover {level}
                              </Button>
                            )}
                          </div>
                          <CommissionTable
                            configs={configs}
                            filteredConfigs={levelConfigs}
                            partnerType="D2D"
                            d2dLevel={level}
                            isTelecom={isTelecom}
                            isEnergy={isEnergy}
                            getServiceTypes={getServiceTypes}
                            getClientTypes={getClientTypes}
                            onAddConfig={addNewConfig}
                            onUpdateConfig={updateConfig}
                            onRemoveConfig={removeConfig}
                          />
                        </TabsContent>
                      );
                    })}
                  </Tabs>
                </div>
              </div>
            </TabsContent>

            {['REV', 'Rev+'].map((partnerType) => {
              const ptConfigs = configs.filter(c => c.partner_type === partnerType);
              return (
                <TabsContent key={partnerType} value={partnerType} className="mt-4">
                  <CommissionTable
                    configs={configs}
                    filteredConfigs={ptConfigs}
                    partnerType={partnerType}
                    d2dLevel={null}
                    isTelecom={isTelecom}
                    isEnergy={isEnergy}
                    getServiceTypes={getServiceTypes}
                    getClientTypes={getClientTypes}
                    onAddConfig={addNewConfig}
                    onUpdateConfig={updateConfig}
                    onRemoveConfig={removeConfig}
                  />
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
      </div>

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
