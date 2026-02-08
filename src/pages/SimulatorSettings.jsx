import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, Loader2, Power, PowerOff } from 'lucide-react';
import { toast } from 'sonner';
import { simulatorService } from '../services/simulatorService';

const SimulatorSettings = () => {
  const [activeTab, setActiveTab] = useState('operators');
  const [operators, setOperators] = useState([]);
  const [electricityPlans, setElectricityPlans] = useState([]);
  const [gasPlans, setGasPlans] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ops, elecPlans, gPlans, setts] = await Promise.all([
        simulatorService.getAllOperators(),
        simulatorService.getAllElectricityPlans(),
        simulatorService.getAllGasPlans(),
        simulatorService.getSettings()
      ]);
      setOperators(ops);
      setElectricityPlans(elecPlans);
      setGasPlans(gPlans);
      setSettings(setts);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const OperatorsSection = () => {
    const [newOperator, setNewOperator] = useState({ name: '', active: true });
    const [isAdding, setIsAdding] = useState(false);

    const handleAdd = async () => {
      if (!newOperator.name.trim()) {
        toast.error('Nome da operadora e obrigatorio');
        return;
      }

      try {
        await simulatorService.createOperator(newOperator);
        toast.success('Operadora criada com sucesso');
        setNewOperator({ name: '', active: true });
        setIsAdding(false);
        await loadData();
      } catch (error) {
        console.error('Failed to create operator:', error);
        toast.error('Erro ao criar operadora');
      }
    };

    const handleToggle = async (id, currentStatus) => {
      try {
        await simulatorService.updateOperator(id, { active: !currentStatus });
        toast.success('Estado atualizado');
        await loadData();
      } catch (error) {
        console.error('Failed to toggle operator:', error);
        toast.error('Erro ao atualizar estado');
      }
    };

    const handleDelete = async (id) => {
      if (!confirm('Tem a certeza que deseja eliminar esta operadora?')) return;

      try {
        await simulatorService.deleteOperator(id);
        toast.success('Operadora eliminada');
        await loadData();
      } catch (error) {
        console.error('Failed to delete operator:', error);
        toast.error('Erro ao eliminar operadora');
      }
    };

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-white">Operadoras</h3>
          <button onClick={() => setIsAdding(true)} className="btn-gold text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        </div>

        {isAdding && (
          <div className="glass-ultra rounded-lg p-4 space-y-3">
            <input
              type="text"
              placeholder="Nome da operadora"
              value={newOperator.name}
              onChange={(e) => setNewOperator({ ...newOperator, name: e.target.value })}
              className="glass-input w-full"
            />
            <div className="flex gap-2">
              <button onClick={handleAdd} className="btn-gold text-sm">
                Guardar
              </button>
              <button onClick={() => { setIsAdding(false); setNewOperator({ name: '', active: true }); }} className="btn-outline text-sm">
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {operators.map(op => (
            <div key={op.id} className="glass-ultra rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleToggle(op.id, op.active)}
                  className={`p-2 rounded-lg transition-colors ${
                    op.active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {op.active ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                </button>
                <div>
                  <p className="text-white font-medium">{op.name}</p>
                  <p className="text-xs text-dark-400">{op.active ? 'Ativo' : 'Inativo'}</p>
                </div>
              </div>
              <button onClick={() => handleDelete(op.id)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const ElectricityPlansSection = () => {
    const [isAdding, setIsAdding] = useState(false);
    const [formData, setFormData] = useState({
      operator_id: '',
      name: '',
      tariff_type: 'simples',
      vazio_price: '',
      fora_vazio_price: '',
      ponta_price: '',
      cheia_price: '',
      power_price_per_kva: '',
      discount_percentage: '0',
      active: true
    });

    const handleSubmit = async () => {
      if (!formData.operator_id || !formData.name) {
        toast.error('Operadora e nome sao obrigatorios');
        return;
      }

      try {
        if (editingItem) {
          await simulatorService.updateElectricityPlan(editingItem.id, formData);
          toast.success('Plano atualizado');
        } else {
          await simulatorService.createElectricityPlan(formData);
          toast.success('Plano criado');
        }
        setIsAdding(false);
        setEditingItem(null);
        setFormData({
          operator_id: '',
          name: '',
          tariff_type: 'simples',
          vazio_price: '',
          fora_vazio_price: '',
          ponta_price: '',
          cheia_price: '',
          power_price_per_kva: '',
          discount_percentage: '0',
          active: true
        });
        await loadData();
      } catch (error) {
        console.error('Failed to save plan:', error);
        toast.error('Erro ao guardar plano');
      }
    };

    const handleEdit = (plan) => {
      setFormData({
        operator_id: plan.operator_id,
        name: plan.name,
        tariff_type: plan.tariff_type,
        vazio_price: plan.vazio_price || '',
        fora_vazio_price: plan.fora_vazio_price || '',
        ponta_price: plan.ponta_price || '',
        cheia_price: plan.cheia_price || '',
        power_price_per_kva: plan.power_price_per_kva || '',
        discount_percentage: plan.discount_percentage || '0',
        active: plan.active
      });
      setEditingItem(plan);
      setIsAdding(true);
    };

    const handleDelete = async (id) => {
      if (!confirm('Tem a certeza que deseja eliminar este plano?')) return;

      try {
        await simulatorService.deleteElectricityPlan(id);
        toast.success('Plano eliminado');
        await loadData();
      } catch (error) {
        console.error('Failed to delete plan:', error);
        toast.error('Erro ao eliminar plano');
      }
    };

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-white">Planos de Eletricidade</h3>
          <button onClick={() => setIsAdding(true)} className="btn-gold text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        </div>

        {isAdding && (
          <div className="glass-ultra rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-dark-200 mb-1">Operadora</label>
                <select value={formData.operator_id} onChange={(e) => setFormData({ ...formData, operator_id: e.target.value })} className="glass-input w-full">
                  <option value="">Selecione...</option>
                  {operators.filter(op => op.active).map(op => (
                    <option key={op.id} value={op.id}>{op.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-dark-200 mb-1">Nome do Plano</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="glass-input w-full" />
              </div>
              <div>
                <label className="block text-sm text-dark-200 mb-1">Tipo de Tarifa</label>
                <select value={formData.tariff_type} onChange={(e) => setFormData({ ...formData, tariff_type: e.target.value })} className="glass-input w-full">
                  <option value="simples">Simples</option>
                  <option value="bi-horario">Bi-horario</option>
                  <option value="tri-horario">Tri-horario</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-dark-200 mb-1">Preco Potencia (€/kVA)</label>
                <input type="number" step="0.0001" value={formData.power_price_per_kva} onChange={(e) => setFormData({ ...formData, power_price_per_kva: e.target.value })} className="glass-input w-full" />
              </div>
              <div>
                <label className="block text-sm text-dark-200 mb-1">Preco Vazio (€/kWh)</label>
                <input type="number" step="0.0001" value={formData.vazio_price} onChange={(e) => setFormData({ ...formData, vazio_price: e.target.value })} className="glass-input w-full" />
              </div>
              <div>
                <label className="block text-sm text-dark-200 mb-1">Preco Fora Vazio (€/kWh)</label>
                <input type="number" step="0.0001" value={formData.fora_vazio_price} onChange={(e) => setFormData({ ...formData, fora_vazio_price: e.target.value })} className="glass-input w-full" />
              </div>
              <div>
                <label className="block text-sm text-dark-200 mb-1">Preco Ponta (€/kWh)</label>
                <input type="number" step="0.0001" value={formData.ponta_price} onChange={(e) => setFormData({ ...formData, ponta_price: e.target.value })} className="glass-input w-full" />
              </div>
              <div>
                <label className="block text-sm text-dark-200 mb-1">Preco Cheia (€/kWh)</label>
                <input type="number" step="0.0001" value={formData.cheia_price} onChange={(e) => setFormData({ ...formData, cheia_price: e.target.value })} className="glass-input w-full" />
              </div>
              <div>
                <label className="block text-sm text-dark-200 mb-1">Desconto (%)</label>
                <input type="number" step="0.1" value={formData.discount_percentage} onChange={(e) => setFormData({ ...formData, discount_percentage: e.target.value })} className="glass-input w-full" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSubmit} className="btn-gold text-sm">Guardar</button>
              <button onClick={() => { setIsAdding(false); setEditingItem(null); }} className="btn-outline text-sm">Cancelar</button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {electricityPlans.map(plan => (
            <div key={plan.id} className="glass-ultra rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-white font-medium">{plan.simulator_operators?.name} - {plan.name}</p>
                  <p className="text-xs text-dark-400">{plan.tariff_type} | Desconto: {plan.discount_percentage}%</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(plan)} className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(plan.id)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const GasPlansSection = () => {
    const [isAdding, setIsAdding] = useState(false);
    const [formData, setFormData] = useState({
      operator_id: '',
      name: '',
      tier1_price: '',
      tier2_price: '',
      tier3_price: '',
      fixed_cost: '0',
      discount_percentage: '0',
      active: true
    });

    const handleSubmit = async () => {
      if (!formData.operator_id || !formData.name) {
        toast.error('Operadora e nome sao obrigatorios');
        return;
      }

      try {
        if (editingItem) {
          await simulatorService.updateGasPlan(editingItem.id, formData);
          toast.success('Plano atualizado');
        } else {
          await simulatorService.createGasPlan(formData);
          toast.success('Plano criado');
        }
        setIsAdding(false);
        setEditingItem(null);
        setFormData({
          operator_id: '',
          name: '',
          tier1_price: '',
          tier2_price: '',
          tier3_price: '',
          fixed_cost: '0',
          discount_percentage: '0',
          active: true
        });
        await loadData();
      } catch (error) {
        console.error('Failed to save plan:', error);
        toast.error('Erro ao guardar plano');
      }
    };

    const handleEdit = (plan) => {
      setFormData({
        operator_id: plan.operator_id,
        name: plan.name,
        tier1_price: plan.tier1_price || '',
        tier2_price: plan.tier2_price || '',
        tier3_price: plan.tier3_price || '',
        fixed_cost: plan.fixed_cost || '0',
        discount_percentage: plan.discount_percentage || '0',
        active: plan.active
      });
      setEditingItem(plan);
      setIsAdding(true);
    };

    const handleDelete = async (id) => {
      if (!confirm('Tem a certeza que deseja eliminar este plano?')) return;

      try {
        await simulatorService.deleteGasPlan(id);
        toast.success('Plano eliminado');
        await loadData();
      } catch (error) {
        console.error('Failed to delete plan:', error);
        toast.error('Erro ao eliminar plano');
      }
    };

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-white">Planos de Gas</h3>
          <button onClick={() => setIsAdding(true)} className="btn-gold text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        </div>

        {isAdding && (
          <div className="glass-ultra rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-dark-200 mb-1">Operadora</label>
                <select value={formData.operator_id} onChange={(e) => setFormData({ ...formData, operator_id: e.target.value })} className="glass-input w-full">
                  <option value="">Selecione...</option>
                  {operators.filter(op => op.active).map(op => (
                    <option key={op.id} value={op.id}>{op.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-dark-200 mb-1">Nome do Plano</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="glass-input w-full" />
              </div>
              <div>
                <label className="block text-sm text-dark-200 mb-1">Tier 1 (≤500m³) €/m³</label>
                <input type="number" step="0.0001" value={formData.tier1_price} onChange={(e) => setFormData({ ...formData, tier1_price: e.target.value })} className="glass-input w-full" />
              </div>
              <div>
                <label className="block text-sm text-dark-200 mb-1">Tier 2 (501-5000m³) €/m³</label>
                <input type="number" step="0.0001" value={formData.tier2_price} onChange={(e) => setFormData({ ...formData, tier2_price: e.target.value })} className="glass-input w-full" />
              </div>
              <div>
                <label className="block text-sm text-dark-200 mb-1">Tier 3 (&gt;5000m³) €/m³</label>
                <input type="number" step="0.0001" value={formData.tier3_price} onChange={(e) => setFormData({ ...formData, tier3_price: e.target.value })} className="glass-input w-full" />
              </div>
              <div>
                <label className="block text-sm text-dark-200 mb-1">Custo Fixo (€)</label>
                <input type="number" step="0.01" value={formData.fixed_cost} onChange={(e) => setFormData({ ...formData, fixed_cost: e.target.value })} className="glass-input w-full" />
              </div>
              <div>
                <label className="block text-sm text-dark-200 mb-1">Desconto (%)</label>
                <input type="number" step="0.1" value={formData.discount_percentage} onChange={(e) => setFormData({ ...formData, discount_percentage: e.target.value })} className="glass-input w-full" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSubmit} className="btn-gold text-sm">Guardar</button>
              <button onClick={() => { setIsAdding(false); setEditingItem(null); }} className="btn-outline text-sm">Cancelar</button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {gasPlans.map(plan => (
            <div key={plan.id} className="glass-ultra rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-white font-medium">{plan.simulator_operators?.name} - {plan.name}</p>
                  <p className="text-xs text-dark-400">Desconto: {plan.discount_percentage}%</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(plan)} className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(plan.id)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const SettingsSection = () => {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Configuracoes Gerais</h3>
        <div className="glass-ultra rounded-lg p-4">
          <p className="text-sm text-dark-300 mb-4">
            Precos de referencia ERSE (usados quando nao ha planos configurados)
          </p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-dark-400">Simples:</p>
              <p className="text-white">{settings.erse_simples || '0.15'} €/kWh</p>
            </div>
            <div>
              <p className="text-dark-400">Bi-horario Vazio:</p>
              <p className="text-white">{settings.erse_bi_vazio || '0.12'} €/kWh</p>
            </div>
            <div>
              <p className="text-dark-400">Bi-horario Fora Vazio:</p>
              <p className="text-white">{settings.erse_bi_fora_vazio || '0.18'} €/kWh</p>
            </div>
            <div>
              <p className="text-dark-400">Gas Tier 1:</p>
              <p className="text-white">{settings.erse_gas_tier1 || '0.08'} €/m³</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
          <p className="text-sm text-dark-300">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Configuracao do Simulador</h1>
        <p className="text-sm text-dark-400">
          Gerir operadoras, planos e configuracoes do simulador
        </p>
      </div>

      <div className="glass-ultra rounded-xl p-1">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('operators')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'operators' ? 'bg-gold-500 text-dark-900' : 'text-dark-300 hover:text-white'
            }`}
          >
            Operadoras
          </button>
          <button
            onClick={() => setActiveTab('electricity')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'electricity' ? 'bg-gold-500 text-dark-900' : 'text-dark-300 hover:text-white'
            }`}
          >
            Planos Eletricidade
          </button>
          <button
            onClick={() => setActiveTab('gas')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'gas' ? 'bg-gold-500 text-dark-900' : 'text-dark-300 hover:text-white'
            }`}
          >
            Planos Gas
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'settings' ? 'bg-gold-500 text-dark-900' : 'text-dark-300 hover:text-white'
            }`}
          >
            Configuracoes
          </button>
        </div>
      </div>

      <div>
        {activeTab === 'operators' && <OperatorsSection />}
        {activeTab === 'electricity' && <ElectricityPlansSection />}
        {activeTab === 'gas' && <GasPlansSection />}
        {activeTab === 'settings' && <SettingsSection />}
      </div>
    </div>
  );
};

export default SimulatorSettings;
