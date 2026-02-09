import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Upload, Save, X, Loader2, Zap, Flame, Settings2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import { energySimulatorService, POTENCIAS_PORTUGAL, ESCALOES_GAS, TARIFAS_EMPTY_TEMPLATE, CICLOS_HORARIOS } from '../services/energySimulatorService';

const EnergySimulatorAdmin = () => {
  const [activeTab, setActiveTab] = useState('operators');
  const [operators, setOperators] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingOperator, setEditingOperator] = useState(null);
  const [editingDiscount, setEditingDiscount] = useState(null);
  const [editingTariffs, setEditingTariffs] = useState(null);
  const [showOperatorDialog, setShowOperatorDialog] = useState(false);
  const [showDiscountDialog, setShowDiscountDialog] = useState(false);
  const [showTariffsDialog, setShowTariffsDialog] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadOperators();
    loadDiscounts();
  }, []);

  const loadOperators = async () => {
    try {
      setLoading(true);
      const data = await energySimulatorService.getAllOperators();
      setOperators(data);
    } catch (error) {
      console.error('Error loading operators:', error);
      toast.error('Erro ao carregar operadoras');
    } finally {
      setLoading(false);
    }
  };

  const loadDiscounts = async () => {
    try {
      const data = await energySimulatorService.getAllDiscounts();
      setDiscounts(data);
    } catch (error) {
      console.error('Error loading discounts:', error);
      toast.error('Erro ao carregar descontos');
    }
  };

  const handleCreateOperator = () => {
    setEditingOperator({
      nome: '',
      logotipo_url: null,
      tipos_energia: [],
      ciclos_disponiveis: [],
      tarifas: TARIFAS_EMPTY_TEMPLATE,
      ativa: true
    });
    setShowOperatorDialog(true);
  };

  const handleEditOperator = (operator) => {
    setEditingOperator({ ...operator });
    setShowOperatorDialog(true);
  };

  const handleSaveOperator = async () => {
    try {
      if (!editingOperator.nome) {
        toast.error('Nome da operadora é obrigatório');
        return;
      }

      setLoading(true);

      if (editingOperator.id) {
        await energySimulatorService.updateOperator(editingOperator.id, editingOperator);
        toast.success('Operadora atualizada com sucesso');
      } else {
        await energySimulatorService.createOperator(editingOperator);
        toast.success('Operadora criada com sucesso');
      }

      setShowOperatorDialog(false);
      setEditingOperator(null);
      await loadOperators();
    } catch (error) {
      console.error('Error saving operator:', error);
      toast.error('Erro ao guardar operadora');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOperator = async (id) => {
    if (!confirm('Tem a certeza que deseja eliminar esta operadora?')) return;

    try {
      setLoading(true);
      await energySimulatorService.deleteOperator(id);
      toast.success('Operadora eliminada com sucesso');
      await loadOperators();
    } catch (error) {
      console.error('Error deleting operator:', error);
      toast.error('Erro ao eliminar operadora');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const url = await energySimulatorService.uploadLogo(file, editingOperator.id || 'temp');
      setEditingOperator({ ...editingOperator, logotipo_url: url });
      toast.success('Logotipo carregado com sucesso');
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Erro ao carregar logotipo');
    } finally {
      setUploading(false);
    }
  };

  const handleCreateDiscount = () => {
    if (operators.length === 0) {
      toast.error('Crie pelo menos uma operadora primeiro');
      return;
    }

    setEditingDiscount({
      operadora_id: '',
      tipo_energia: 'eletricidade',
      desconto_base_potencia: 0,
      desconto_base_energia: 0,
      desconto_dd_potencia: 0,
      desconto_dd_energia: 0,
      desconto_fe_potencia: 0,
      desconto_fe_energia: 0,
      desconto_dd_fe_potencia: 0,
      desconto_dd_fe_energia: 0,
      desconto_mensal_temporario: 0,
      duracao_meses_desconto: 0,
      descricao_desconto_temporario: '',
      desconto_temp_requer_dd: false,
      desconto_temp_requer_fe: false
    });
    setShowDiscountDialog(true);
  };

  const handleEditDiscount = (discount) => {
    setEditingDiscount({ ...discount });
    setShowDiscountDialog(true);
  };

  const handleSaveDiscount = async () => {
    try {
      if (!editingDiscount.operadora_id) {
        toast.error('Selecione uma operadora');
        return;
      }

      setLoading(true);
      await energySimulatorService.upsertDiscount(editingDiscount);
      toast.success('Descontos guardados com sucesso');
      setShowDiscountDialog(false);
      setEditingDiscount(null);
      await loadDiscounts();
    } catch (error) {
      console.error('Error saving discount:', error);
      toast.error('Erro ao guardar descontos');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDiscount = async (id) => {
    if (!confirm('Tem a certeza que deseja eliminar estes descontos?')) return;

    try {
      setLoading(true);
      await energySimulatorService.deleteDiscount(id);
      toast.success('Descontos eliminados com sucesso');
      await loadDiscounts();
    } catch (error) {
      console.error('Error deleting discount:', error);
      toast.error('Erro ao eliminar descontos');
    } finally {
      setLoading(false);
    }
  };

  const updateOperatorTariff = (energyType, path, value) => {
    const newTarifas = { ...editingOperator.tarifas };
    const keys = path.split('.');
    let current = newTarifas[energyType];

    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = parseFloat(value) || 0;

    setEditingOperator({ ...editingOperator, tarifas: newTarifas });
  };

  const handleConfigureTariffs = (operator) => {
    setEditingTariffs({ ...operator });
    setShowTariffsDialog(true);
  };

  const handleSaveTariffs = async () => {
    try {
      setLoading(true);
      await energySimulatorService.updateOperator(editingTariffs.id, editingTariffs);
      toast.success('Tarifas atualizadas com sucesso');
      setShowTariffsDialog(false);
      setEditingTariffs(null);
      await loadOperators();
    } catch (error) {
      console.error('Error saving tariffs:', error);
      toast.error('Erro ao guardar tarifas');
    } finally {
      setLoading(false);
    }
  };

  const updateTariff = (energyType, path, value) => {
    const newTarifas = JSON.parse(JSON.stringify(editingTariffs.tarifas || {}));
    if (!newTarifas[energyType]) newTarifas[energyType] = {};
    const keys = path.split('.');
    let current = newTarifas[energyType];

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value === '' ? null : parseFloat(value);

    setEditingTariffs({ ...editingTariffs, tarifas: newTarifas });
  };

  const getTariffValue = (obj, path) => {
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
      if (current == null) return '';
      current = current[key];
    }
    return current == null || current === 0 ? '' : current;
  };

  return (
    <div className="min-h-screen pb-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Gestão do Simulador de Energia
          </h1>
          <p className="text-dark-300 text-lg">
            Configure operadoras, tarifas e descontos
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-dark-800 border-white/10">
            <TabsTrigger value="operators" className="data-[state=active]:bg-gold-400 data-[state=active]:text-dark-900">
              <Settings2 className="w-4 h-4 mr-2" />
              Operadoras
            </TabsTrigger>
            <TabsTrigger value="tariffs" className="data-[state=active]:bg-gold-400 data-[state=active]:text-dark-900">
              <Flame className="w-4 h-4 mr-2" />
              Tarifas e Preços
            </TabsTrigger>
            <TabsTrigger value="discounts" className="data-[state=active]:bg-gold-400 data-[state=active]:text-dark-900">
              <Zap className="w-4 h-4 mr-2" />
              Descontos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="operators" className="space-y-6">
            <Card className="border-white/10 bg-dark-800/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white">Operadoras</CardTitle>
                  <Button
                    onClick={handleCreateOperator}
                    className="bg-gold-400 hover:bg-gold-500 text-dark-900"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Operadora
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading && operators.length === 0 ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 text-gold-400 animate-spin" />
                  </div>
                ) : operators.length === 0 ? (
                  <div className="text-center py-12 text-dark-400">
                    Nenhuma operadora criada ainda
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {operators.map((op) => (
                      <Card key={op.id} className="bg-dark-700/50 border-white/10">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            {op.logotipo_url && (
                              <img
                                src={op.logotipo_url}
                                alt={op.nome}
                                className="w-12 h-12 object-contain rounded bg-white/5 p-1"
                              />
                            )}
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditOperator(op)}
                                className="border-white/20 text-white hover:bg-white/10 p-2"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteOperator(op.id)}
                                className="border-red-500/20 text-red-400 hover:bg-red-500/10 p-2"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <h3 className="font-semibold text-white mb-2">{op.nome}</h3>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {op.tipos_energia?.includes('eletricidade') && (
                              <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                                <Zap className="w-3 h-3 mr-1" />
                                Eletricidade
                              </Badge>
                            )}
                            {op.tipos_energia?.includes('gas') && (
                              <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                                <Flame className="w-3 h-3 mr-1" />
                                Gás
                              </Badge>
                            )}
                          </div>
                          <Badge variant={op.ativa ? 'default' : 'secondary'}>
                            {op.ativa ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tariffs" className="space-y-6">
            <Card className="border-white/10 bg-dark-800/50">
              <CardHeader>
                <CardTitle className="text-white">Tarifas e Preços por Operadora</CardTitle>
                <p className="text-sm text-dark-300 mt-2">Configure os preços específicos de cada tarifa e potência</p>
              </CardHeader>
              <CardContent>
                {loading && operators.length === 0 ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 text-gold-400 animate-spin" />
                  </div>
                ) : operators.length === 0 ? (
                  <div className="text-center py-12 text-dark-400">
                    Crie uma operadora primeiro
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {operators.map((op) => (
                      <Card key={op.id} className="bg-dark-700/50 border-white/10">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              {op.logotipo_url && (
                                <img
                                  src={op.logotipo_url}
                                  alt={op.nome}
                                  className="w-10 h-10 object-contain rounded bg-white/5 p-1"
                                />
                              )}
                              <h3 className="font-semibold text-white">{op.nome}</h3>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1 mb-3">
                            {op.tipos_energia?.includes('eletricidade') && (
                              <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">
                                <Zap className="w-3 h-3 mr-1" />
                                Eletricidade
                              </Badge>
                            )}
                            {op.tipos_energia?.includes('gas') && (
                              <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                                <Flame className="w-3 h-3 mr-1" />
                                Gás
                              </Badge>
                            )}
                          </div>
                          <Button
                            onClick={() => handleConfigureTariffs(op)}
                            className="w-full bg-gold-400 hover:bg-gold-500 text-dark-900"
                            size="sm"
                          >
                            <Settings2 className="w-4 h-4 mr-2" />
                            Configurar Tarifas
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="discounts" className="space-y-6">
            <Card className="border-white/10 bg-dark-800/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white">Configurações de Descontos</CardTitle>
                  <Button
                    onClick={handleCreateDiscount}
                    className="bg-gold-400 hover:bg-gold-500 text-dark-900"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Desconto
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading && discounts.length === 0 ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 text-gold-400 animate-spin" />
                  </div>
                ) : discounts.length === 0 ? (
                  <div className="text-center py-12 text-dark-400">
                    Nenhum desconto configurado ainda
                  </div>
                ) : (
                  <div className="space-y-4">
                    {discounts.map((discount) => (
                      <Card key={discount.id} className="bg-dark-700/50 border-white/10">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold text-white mb-1">
                                {discount.operadoras?.nome || 'Operadora não encontrada'}
                              </h3>
                              <Badge variant="outline" className="mb-2">
                                {discount.tipo_energia === 'eletricidade' ? 'Eletricidade' : discount.tipo_energia === 'gas' ? 'Gás' : 'Dual'}
                              </Badge>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-sm">
                                <div className="bg-dark-600/50 p-2 rounded">
                                  <p className="text-dark-400 text-xs">Base</p>
                                  <p className="text-white">{discount.desconto_base_potencia}% / {discount.desconto_base_energia}%</p>
                                </div>
                                <div className="bg-dark-600/50 p-2 rounded">
                                  <p className="text-dark-400 text-xs">DD</p>
                                  <p className="text-white">{discount.desconto_dd_potencia}% / {discount.desconto_dd_energia}%</p>
                                </div>
                                <div className="bg-dark-600/50 p-2 rounded">
                                  <p className="text-dark-400 text-xs">FE</p>
                                  <p className="text-white">{discount.desconto_fe_potencia}% / {discount.desconto_fe_energia}%</p>
                                </div>
                                <div className="bg-dark-600/50 p-2 rounded">
                                  <p className="text-dark-400 text-xs">DD+FE</p>
                                  <p className="text-white">{discount.desconto_dd_fe_potencia}% / {discount.desconto_dd_fe_energia}%</p>
                                </div>
                              </div>
                              {discount.desconto_mensal_temporario > 0 && (
                                <Badge variant="outline" className="mt-2 bg-purple-500/20 text-purple-400 border-purple-500/30">
                                  Campanha: €{discount.desconto_mensal_temporario} × {discount.duracao_meses_desconto} meses
                                </Badge>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditDiscount(discount)}
                                className="border-white/20 text-white hover:bg-white/10 p-2"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteDiscount(discount.id)}
                                className="border-red-500/20 text-red-400 hover:bg-red-500/10 p-2"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={showOperatorDialog} onOpenChange={setShowOperatorDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden glass-ultra border-white/10 flex flex-col">
            <div className="glass-ultra border-b border-white/10 px-2 py-4">
              <DialogHeader>
                <DialogTitle className="text-3xl font-bold text-gradient-gold">
                  {editingOperator?.id ? 'Editar Operadora' : 'Nova Operadora'}
                </DialogTitle>
                <p className="text-sm text-dark-200 mt-1">
                  Configure os dados da operadora de energia
                </p>
              </DialogHeader>
            </div>

            {editingOperator && (
              <div className="overflow-y-auto flex-1 px-2 py-6 scrollbar-modern">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold mb-2 text-white">Nome *</Label>
                      <Input
                        value={editingOperator.nome}
                        onChange={(e) => setEditingOperator({ ...editingOperator, nome: e.target.value })}
                        className="bg-white text-dark-900 border-dark-600 focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20 rounded-xl"
                        placeholder="Nome da operadora"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold mb-2 text-white">Logotipo</Label>
                      <div className="flex gap-2">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          disabled={uploading}
                          className="bg-white text-dark-900 border-dark-600 focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20 rounded-xl"
                        />
                        {uploading && <Loader2 className="w-5 h-5 text-gold-400 animate-spin" />}
                      </div>
                      {editingOperator.logotipo_url && (
                        <img src={editingOperator.logotipo_url} alt="Preview" className="w-16 h-16 object-contain rounded bg-white/5 p-2" />
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold mb-2 text-white">Tipos de Energia</Label>
                  <div className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="elet"
                        checked={editingOperator.tipos_energia?.includes('eletricidade')}
                        onCheckedChange={(checked) => {
                          const tipos = [...(editingOperator.tipos_energia || [])];
                          if (checked) {
                            tipos.push('eletricidade');
                          } else {
                            const idx = tipos.indexOf('eletricidade');
                            if (idx > -1) tipos.splice(idx, 1);
                          }
                          setEditingOperator({ ...editingOperator, tipos_energia: tipos });
                        }}
                      />
                        <label htmlFor="elet" className="text-white cursor-pointer">Eletricidade</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="gas"
                          checked={editingOperator.tipos_energia?.includes('gas')}
                          onCheckedChange={(checked) => {
                            const tipos = [...(editingOperator.tipos_energia || [])];
                            if (checked) {
                              tipos.push('gas');
                            } else {
                              const idx = tipos.indexOf('gas');
                              if (idx > -1) tipos.splice(idx, 1);
                            }
                            setEditingOperator({ ...editingOperator, tipos_energia: tipos });
                          }}
                        />
                        <label htmlFor="gas" className="text-white cursor-pointer">Gás</label>
                      </div>
                    </div>
                  </div>

                  {editingOperator.tipos_energia?.includes('eletricidade') && (
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold mb-2 text-white">Ciclos Disponíveis (Eletricidade)</Label>
                    <div className="flex gap-4">
                      {CICLOS_HORARIOS.map((ciclo) => (
                        <div key={ciclo.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={ciclo.value}
                            checked={editingOperator.ciclos_disponiveis?.includes(ciclo.value)}
                            onCheckedChange={(checked) => {
                              const ciclos = [...(editingOperator.ciclos_disponiveis || [])];
                              if (checked) {
                                ciclos.push(ciclo.value);
                              } else {
                                const idx = ciclos.indexOf(ciclo.value);
                                if (idx > -1) ciclos.splice(idx, 1);
                              }
                              setEditingOperator({ ...editingOperator, ciclos_disponiveis: ciclos });
                            }}
                          />
                            <label htmlFor={ciclo.value} className="text-white cursor-pointer">{ciclo.label}</label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={editingOperator.ativa}
                      onCheckedChange={(checked) => setEditingOperator({ ...editingOperator, ativa: checked })}
                    />
                    <Label className="text-white">Operadora Ativa</Label>
                  </div>

                  <div className="text-sm text-dark-300 bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                    <strong className="text-blue-400">Nota:</strong> Configure as tarifas e preços específicos após criar a operadora, na secção de tarifas.
                  </div>
                </div>
              </div>
            )}

            <div className="sticky bottom-0 glass-ultra border-t border-white/10 px-8 py-4">
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowOperatorDialog(false);
                    setEditingOperator(null);
                  }}
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveOperator}
                  disabled={loading}
                  className="bg-gold-400 hover:bg-gold-500 text-dark-900 font-semibold"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Guardar
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showDiscountDialog} onOpenChange={setShowDiscountDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden glass-ultra border-white/10 flex flex-col">
            <div className="glass-ultra border-b border-white/10 px-2 py-4">
              <DialogHeader>
                <DialogTitle className="text-3xl font-bold text-gradient-gold">
                  {editingDiscount?.id ? 'Editar Descontos' : 'Novos Descontos'}
                </DialogTitle>
                <p className="text-sm text-dark-200 mt-1">
                  Configure os descontos para a operadora selecionada
                </p>
              </DialogHeader>
            </div>

            {editingDiscount && (
              <div className="overflow-y-auto flex-1 px-2 py-6 scrollbar-modern">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold mb-2 text-dark-100">Operadora *</Label>
                      <Select
                        value={editingDiscount.operadora_id}
                        onValueChange={(value) => setEditingDiscount({ ...editingDiscount, operadora_id: value })}
                        disabled={!!editingDiscount.id}
                      >
                        <SelectTrigger className="glass-input">
                          <SelectValue placeholder="Selecione a operadora" />
                        </SelectTrigger>
                        <SelectContent>
                          {operators.map((op) => (
                            <SelectItem key={op.id} value={op.id}>{op.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold mb-2 text-dark-100">Tipo de Energia *</Label>
                      <Select
                        value={editingDiscount.tipo_energia}
                        onValueChange={(value) => setEditingDiscount({ ...editingDiscount, tipo_energia: value })}
                        disabled={!!editingDiscount.id}
                      >
                        <SelectTrigger className="glass-input">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="eletricidade">Eletricidade</SelectItem>
                          <SelectItem value="gas">Gás</SelectItem>
                          <SelectItem value="dual">Dual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-lg font-semibold text-white">Descontos (%)</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card className="bg-dark-700/50 border-white/10 p-4">
                        <h4 className="text-white font-semibold mb-3 text-center">Base</h4>
                        <div className="space-y-2">
                          <div>
                            <Label className="text-dark-300 text-xs">Potência/Diário</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={editingDiscount.desconto_base_potencia}
                              onChange={(e) => setEditingDiscount({ ...editingDiscount, desconto_base_potencia: e.target.value })}
                              className="glass-input"
                            />
                          </div>
                          <div>
                            <Label className="text-dark-300 text-xs">Energia</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={editingDiscount.desconto_base_energia}
                              onChange={(e) => setEditingDiscount({ ...editingDiscount, desconto_base_energia: e.target.value })}
                              className="glass-input"
                            />
                          </div>
                        </div>
                      </Card>

                      <Card className="bg-dark-700/50 border-white/10 p-4">
                        <h4 className="text-white font-semibold mb-3 text-center">DD</h4>
                        <div className="space-y-2">
                          <div>
                            <Label className="text-dark-300 text-xs">Potência/Diário</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={editingDiscount.desconto_dd_potencia}
                              onChange={(e) => setEditingDiscount({ ...editingDiscount, desconto_dd_potencia: e.target.value })}
                              className="glass-input"
                            />
                          </div>
                          <div>
                            <Label className="text-dark-300 text-xs">Energia</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={editingDiscount.desconto_dd_energia}
                              onChange={(e) => setEditingDiscount({ ...editingDiscount, desconto_dd_energia: e.target.value })}
                              className="glass-input"
                            />
                          </div>
                        </div>
                      </Card>

                      <Card className="bg-dark-700/50 border-white/10 p-4">
                        <h4 className="text-white font-semibold mb-3 text-center">FE</h4>
                        <div className="space-y-2">
                          <div>
                            <Label className="text-dark-300 text-xs">Potência/Diário</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={editingDiscount.desconto_fe_potencia}
                              onChange={(e) => setEditingDiscount({ ...editingDiscount, desconto_fe_potencia: e.target.value })}
                              className="glass-input"
                            />
                          </div>
                          <div>
                            <Label className="text-dark-300 text-xs">Energia</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={editingDiscount.desconto_fe_energia}
                              onChange={(e) => setEditingDiscount({ ...editingDiscount, desconto_fe_energia: e.target.value })}
                              className="glass-input"
                            />
                          </div>
                        </div>
                      </Card>

                      <Card className="bg-dark-700/50 border-white/10 p-4">
                        <h4 className="text-white font-semibold mb-3 text-center">DD+FE</h4>
                        <div className="space-y-2">
                          <div>
                            <Label className="text-dark-300 text-xs">Potência/Diário</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={editingDiscount.desconto_dd_fe_potencia}
                              onChange={(e) => setEditingDiscount({ ...editingDiscount, desconto_dd_fe_potencia: e.target.value })}
                              className="glass-input"
                            />
                          </div>
                          <div>
                            <Label className="text-dark-300 text-xs">Energia</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={editingDiscount.desconto_dd_fe_energia}
                              onChange={(e) => setEditingDiscount({ ...editingDiscount, desconto_dd_fe_energia: e.target.value })}
                              className="glass-input"
                            />
                          </div>
                        </div>
                      </Card>
                    </div>
                  </div>

                  <div className="border-t border-white/10 pt-4">
                    <Label className="text-lg font-semibold text-white mb-4 block">Campanha Temporária (Opcional)</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold mb-2 text-dark-100">Desconto Mensal (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editingDiscount.desconto_mensal_temporario}
                          onChange={(e) => setEditingDiscount({ ...editingDiscount, desconto_mensal_temporario: e.target.value })}
                          className="glass-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold mb-2 text-dark-100">Duração (meses)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={editingDiscount.duracao_meses_desconto}
                          onChange={(e) => setEditingDiscount({ ...editingDiscount, duracao_meses_desconto: e.target.value })}
                          className="glass-input"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-sm font-semibold mb-2 text-dark-100">Descrição da Campanha</Label>
                        <Input
                          value={editingDiscount.descricao_desconto_temporario || ''}
                          onChange={(e) => setEditingDiscount({ ...editingDiscount, descricao_desconto_temporario: e.target.value })}
                          className="glass-input"
                          placeholder="Ex: Campanha de verão 2024"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="req-dd"
                          checked={editingDiscount.desconto_temp_requer_dd}
                          onCheckedChange={(checked) => setEditingDiscount({ ...editingDiscount, desconto_temp_requer_dd: checked })}
                        />
                        <label htmlFor="req-dd" className="text-white cursor-pointer">Requer Débito Direto</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="req-fe"
                          checked={editingDiscount.desconto_temp_requer_fe}
                          onCheckedChange={(checked) => setEditingDiscount({ ...editingDiscount, desconto_temp_requer_fe: checked })}
                        />
                        <label htmlFor="req-fe" className="text-white cursor-pointer">Requer Fatura Eletrónica</label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="sticky bottom-0 glass-ultra border-t border-white/10 px-8 py-4">
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDiscountDialog(false);
                    setEditingDiscount(null);
                  }}
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveDiscount}
                  disabled={loading}
                  className="bg-gold-400 hover:bg-gold-500 text-dark-900 font-semibold"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Guardar
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showTariffsDialog} onOpenChange={setShowTariffsDialog}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden glass-ultra border-white/10 flex flex-col p-0">
            <div className="sticky top-0 z-10 glass-ultra border-b border-white/10 px-8 py-6">
              <DialogHeader>
                <DialogTitle className="text-3xl font-bold text-gradient-gold">
                  Configurar Tarifas - {editingTariffs?.nome}
                </DialogTitle>
                <p className="text-sm text-dark-200 mt-1">
                  Configure os preços específicos de cada tarifa e potência
                </p>
              </DialogHeader>
            </div>

            {editingTariffs && (
              <div className="overflow-y-auto flex-1 px-8 py-6 scrollbar-modern">
                <div className="space-y-8">
                  {editingTariffs.tipos_energia?.includes('eletricidade') && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-lg flex items-center justify-center shadow-lg">
                          <Zap className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Tarifas de Eletricidade</h3>
                      </div>

                      {editingTariffs.ciclos_disponiveis?.includes('simples') && (
                        <div className="space-y-4">
                          <div className="flex items-center gap-3 pt-2">
                            <div className="h-px flex-1 bg-gradient-to-r from-yellow-500/40 to-transparent" />
                            <span className="text-sm font-bold text-yellow-400 uppercase tracking-wider">Ciclo Simples</span>
                            <div className="h-px flex-1 bg-gradient-to-l from-yellow-500/40 to-transparent" />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-white">Preço Energia (EUR/kWh)</Label>
                            <div className="max-w-xs">
                              <Input
                                type="number"
                                step="0.000001"
                                value={getTariffValue(editingTariffs.tarifas, 'eletricidade.simples.energia')}
                                onChange={(e) => updateTariff('eletricidade', 'simples.energia', e.target.value)}
                                className="bg-dark-800 border-dark-600 text-white placeholder:text-dark-400 focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20 rounded-xl"
                                placeholder="0.0000"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-white">Preço Potência por nível (EUR/dia)</Label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                              {POTENCIAS_PORTUGAL.map((p) => (
                                <div key={p} className="space-y-1">
                                  <span className="text-[11px] text-dark-200 block">{p} kVA</span>
                                  <Input
                                    type="number"
                                    step="0.0001"
                                    value={getTariffValue(editingTariffs.tarifas, `eletricidade.simples.potencia.${p}`)}
                                    onChange={(e) => updateTariff('eletricidade', `simples.potencia.${p}`, e.target.value)}
                                    className="bg-dark-800 border-dark-600 text-white placeholder:text-dark-400 focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20 rounded-xl h-9 text-sm"
                                    placeholder="0.0000"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {editingTariffs.ciclos_disponiveis?.includes('bi-horario') && (
                        <div className="space-y-4">
                          <div className="flex items-center gap-3 pt-2">
                            <div className="h-px flex-1 bg-gradient-to-r from-blue-500/40 to-transparent" />
                            <span className="text-sm font-bold text-blue-400 uppercase tracking-wider">Ciclo Bi-Horário</span>
                            <div className="h-px flex-1 bg-gradient-to-l from-blue-500/40 to-transparent" />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold text-white">Vazio (EUR/kWh)</Label>
                              <Input
                                type="number"
                                step="0.000001"
                                value={getTariffValue(editingTariffs.tarifas, 'eletricidade.bi-horario.vazio')}
                                onChange={(e) => updateTariff('eletricidade', 'bi-horario.vazio', e.target.value)}
                                className="bg-dark-800 border-dark-600 text-white placeholder:text-dark-400 focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20 rounded-xl"
                                placeholder="0.0000"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold text-white">Fora de Vazio (EUR/kWh)</Label>
                              <Input
                                type="number"
                                step="0.000001"
                                value={getTariffValue(editingTariffs.tarifas, 'eletricidade.bi-horario.fora_vazio')}
                                onChange={(e) => updateTariff('eletricidade', 'bi-horario.fora_vazio', e.target.value)}
                                className="bg-dark-800 border-dark-600 text-white placeholder:text-dark-400 focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20 rounded-xl"
                                placeholder="0.0000"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-white">Preço Potência por nível (EUR/dia)</Label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                              {POTENCIAS_PORTUGAL.map((p) => (
                                <div key={p} className="space-y-1">
                                  <span className="text-[11px] text-dark-200 block">{p} kVA</span>
                                  <Input
                                    type="number"
                                    step="0.0001"
                                    value={getTariffValue(editingTariffs.tarifas, `eletricidade.bi-horario.potencia.${p}`)}
                                    onChange={(e) => updateTariff('eletricidade', `bi-horario.potencia.${p}`, e.target.value)}
                                    className="bg-dark-800 border-dark-600 text-white placeholder:text-dark-400 focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20 rounded-xl h-9 text-sm"
                                    placeholder="0.0000"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {editingTariffs.ciclos_disponiveis?.includes('tri-horario') && (
                        <div className="space-y-4">
                          <div className="flex items-center gap-3 pt-2">
                            <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/40 to-transparent" />
                            <span className="text-sm font-bold text-emerald-400 uppercase tracking-wider">Ciclo Tri-Horário</span>
                            <div className="h-px flex-1 bg-gradient-to-l from-emerald-500/40 to-transparent" />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold text-white">Vazio (EUR/kWh)</Label>
                              <Input
                                type="number"
                                step="0.000001"
                                value={getTariffValue(editingTariffs.tarifas, 'eletricidade.tri-horario.vazio')}
                                onChange={(e) => updateTariff('eletricidade', 'tri-horario.vazio', e.target.value)}
                                className="bg-dark-800 border-dark-600 text-white placeholder:text-dark-400 focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20 rounded-xl"
                                placeholder="0.0000"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold text-white">Cheias (EUR/kWh)</Label>
                              <Input
                                type="number"
                                step="0.000001"
                                value={getTariffValue(editingTariffs.tarifas, 'eletricidade.tri-horario.cheia')}
                                onChange={(e) => updateTariff('eletricidade', 'tri-horario.cheia', e.target.value)}
                                className="bg-dark-800 border-dark-600 text-white placeholder:text-dark-400 focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20 rounded-xl"
                                placeholder="0.0000"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold text-white">Ponta (EUR/kWh)</Label>
                              <Input
                                type="number"
                                step="0.000001"
                                value={getTariffValue(editingTariffs.tarifas, 'eletricidade.tri-horario.ponta')}
                                onChange={(e) => updateTariff('eletricidade', 'tri-horario.ponta', e.target.value)}
                                className="bg-dark-800 border-dark-600 text-white placeholder:text-dark-400 focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20 rounded-xl"
                                placeholder="0.0000"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-white">Preço Potência por nível (EUR/dia)</Label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                              {POTENCIAS_PORTUGAL.map((p) => (
                                <div key={p} className="space-y-1">
                                  <span className="text-[11px] text-dark-200 block">{p} kVA</span>
                                  <Input
                                    type="number"
                                    step="0.0001"
                                    value={getTariffValue(editingTariffs.tarifas, `eletricidade.tri-horario.potencia.${p}`)}
                                    onChange={(e) => updateTariff('eletricidade', `tri-horario.potencia.${p}`, e.target.value)}
                                    className="bg-dark-800 border-dark-600 text-white placeholder:text-dark-400 focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20 rounded-xl h-9 text-sm"
                                    placeholder="0.0000"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {editingTariffs.tipos_energia?.includes('gas') && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                          <Flame className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Tarifas de Gás</h3>
                      </div>

                      {ESCALOES_GAS.map((escalao) => (
                        <div key={escalao.value} className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="h-px flex-1 bg-gradient-to-r from-blue-500/30 to-transparent" />
                            <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">{escalao.label}</span>
                            <div className="h-px flex-1 bg-gradient-to-l from-blue-500/30 to-transparent" />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold text-white">Termo Fixo Diário (EUR/dia)</Label>
                              <Input
                                type="number"
                                step="0.0001"
                                value={getTariffValue(editingTariffs.tarifas, `gas.escalao_${escalao.value}.diario`)}
                                onChange={(e) => updateTariff('gas', `escalao_${escalao.value}.diario`, e.target.value)}
                                className="bg-dark-800 border-dark-600 text-white placeholder:text-dark-400 focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20 rounded-xl"
                                placeholder="0.0000"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold text-white">Preço Energia (EUR/kWh)</Label>
                              <Input
                                type="number"
                                step="0.000001"
                                value={getTariffValue(editingTariffs.tarifas, `gas.escalao_${escalao.value}.energia`)}
                                onChange={(e) => updateTariff('gas', `escalao_${escalao.value}.energia`, e.target.value)}
                                className="bg-dark-800 border-dark-600 text-white placeholder:text-dark-400 focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20 rounded-xl"
                                placeholder="0.0000"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="sticky bottom-0 glass-ultra border-t border-white/10 px-8 py-4">
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowTariffsDialog(false)}
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveTariffs}
                  disabled={loading}
                  className="bg-gold-400 hover:bg-gold-500 text-dark-900 font-semibold"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Guardar
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default EnergySimulatorAdmin;
