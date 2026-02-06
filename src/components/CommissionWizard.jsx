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
      toast.success('Configurações guardadas!');
      onSave?.();
    } catch (error) {
      console.error('Error saving configs:', error);
      toast.error('Erro ao guardar configurações');
    }
  };

  const addNewConfig = (partnerType, d2dLevel, newConfig) => {
    if (!newConfig.service_type && (!newConfig.service_types || newConfig.service_types.length === 0)) {
      toast.error('Selecione um tipo de serviço');
      return false;
    }

    const configToAdd = {
      ...newConfig,
      partner_type: partnerType,
      d2d_level: partnerType === 'D2D' ? d2dLevel : null,
      service_types: newConfig.service_types?.length > 0 ? newConfig.service_types : [newConfig.service_type]
    };

    setConfigs(prev => [...prev, configToAdd]);
    toast.success('Configuração adicionada');
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
    if (!window.confirm('Remover esta configuração?')) return;
    const newConfigs = [...configs];
    newConfigs.splice(index, 1);
    setConfigs(newConfigs);
    toast.success('Configuração removida');
  };

  const addD2DLevel = () => {
    const nextNum = d2dLevels.length + 1;
    const newLevel = `Nv${nextNum}`;
    if (d2dLevels.includes(newLevel)) {
      toast.error(`Nível ${newLevel} já existe`);
      return;
    }
    setD2dLevels(prev => [...prev, newLevel]);
    setActiveD2DLevel(newLevel);
    toast.success(`Nível ${newLevel} adicionado`);
  };

  const removeD2DLevel = (level) => {
    if (d2dLevels.length <= 1) {
      toast.error('Deve existir pelo menos um nível');
      return;
    }
    if (!window.confirm(`Remover ${level} e todas as suas configurações?`)) return;

    setConfigs(prev => prev.filter(c => !(c.partner_type === 'D2D' && c.d2d_level === level)));
    const newLevels = d2dLevels.filter(l => l !== level);
    setD2dLevels(newLevels);
    if (activeD2DLevel === level) {
      setActiveD2DLevel(newLevels[0]);
    }
    toast.success(`Nível ${level} removido`);
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
      <div className="glass-ultra">
        <div className="border-b border-dark-600 bg-dark-800 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">
              Configuração de Comissões - {operator?.name}
            </h2>
            <Button
              type="button"
              onClick={handleSaveAll}
              size="sm"
              className="bg-gold-400 text-dark-900 hover:bg-gold-500 shadow-lg shadow-gold-400/30 hover:shadow-xl transition-all duration-300"
            >
              <Save className="w-4 h-4 mr-2" />
              Guardar Tudo
            </Button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <Tabs value={activePartnerTab} onValueChange={setActivePartnerTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-dark-800 border border-dark-600 p-1">
              {getPartnerTypes().map((pt) => (
                <TabsTrigger
                  key={pt}
                  value={pt}
                  className="data-[state=active]:bg-gold-400 data-[state=active]:text-dark-900 data-[state=active]:shadow-lg transition-all duration-300 font-semibold"
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
                      <TabsList className="bg-dark-800 border border-dark-600 p-1">
                        {d2dLevels.map((level) => (
                          <TabsTrigger
                            key={level}
                            value={level}
                            className="data-[state=active]:bg-gold-400 data-[state=active]:text-dark-900 data-[state=active]:shadow-md transition-all duration-300 font-semibold text-sm px-4"
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
                        className="border-dashed border-2 border-dark-600 hover:border-gold-400 hover:bg-gold-400/10 text-dark-200 font-semibold h-9"
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
                              <span className="text-sm font-semibold text-dark-200">{level}</span>
                              <span className="text-xs text-gray-500">({levelConfigs.length} regra{levelConfigs.length !== 1 ? 's' : ''})</span>
                            </div>
                            {d2dLevels.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeD2DLevel(level)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 text-xs"
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

      <div className="flex justify-between items-center pt-6 border-t-2 border-dark-600">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="border-2 border-dark-600 hover:border-dark-500 hover:bg-dark-700 text-white font-semibold px-6"
        >
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={handleSaveAll}
          className="bg-gold-400 text-dark-900 hover:bg-gold-500 shadow-lg shadow-gold-400/30 font-semibold px-6 transition-all duration-300"
        >
          <Save className="w-4 h-4 mr-2" />
          Guardar Tudo
        </Button>
      </div>
    </div>
  );
};

export default CommissionWizard;
