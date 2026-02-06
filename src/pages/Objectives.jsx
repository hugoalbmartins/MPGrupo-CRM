import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Save, Target, Plus, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { objectivesService } from "../services/objectivesService";
import { usersService } from "../services/usersService";
import { operatorsService } from "../services/operatorsService";

const Objectives = ({ user }) => {
  const [managers, setManagers] = useState([]);
  const [operators, setOperators] = useState([]);
  const [allObjectives, setAllObjectives] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedManagerView, setSelectedManagerView] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [objectives, setObjectives] = useState({});
  const [saving, setSaving] = useState(false);

  const [createFormData, setCreateFormData] = useState({
    manager_id: "",
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });

  const months = [
    "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [usersData, operatorsData, objectivesData] = await Promise.all([
        usersService.getAll(),
        operatorsService.getAll(),
        objectivesService.getAll()
      ]);

      const managerUsers = usersData.filter(u => u.role === "gestor_nv1" || u.role === "gestor_nv2");
      setManagers(managerUsers);
      setOperators(operatorsData.filter(op => !op.hidden));
      setAllObjectives(objectivesData);
    } catch (error) {
      toast.error("Erro ao carregar dados");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const groupObjectivesByManager = () => {
    const grouped = {};

    allObjectives.forEach(obj => {
      const key = `${obj.manager_id}-${obj.year}-${obj.month}`;
      if (!grouped[key]) {
        grouped[key] = {
          manager_id: obj.manager_id,
          manager_name: obj.manager?.name || 'N/A',
          manager_role: obj.manager?.role || '',
          year: obj.year,
          month: obj.month,
          objectives: []
        };
      }
      grouped[key].objectives.push(obj);
    });

    return Object.values(grouped).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      if (a.month !== b.month) return b.month - a.month;
      return a.manager_name.localeCompare(b.manager_name);
    });
  };

  const handleViewObjectives = async (managerGroup) => {
    try {
      setLoading(true);
      const data = await objectivesService.getByManager(
        managerGroup.manager_id,
        managerGroup.year,
        managerGroup.month
      );

      const objectivesMap = {};
      data.forEach(obj => {
        objectivesMap[obj.operator_id] = {
          id: obj.id,
          electricity_target: obj.electricity_target || 0,
          gas_target: obj.gas_target || 0,
          tv_target: obj.tv_target || 0,
          fiber_target: obj.fiber_target || 0,
        };
      });

      setObjectives(objectivesMap);
      setSelectedManagerView(managerGroup);
      setSelectedMonth(managerGroup.month);
      setSelectedYear(managerGroup.year);
      setViewDialogOpen(true);
    } catch (error) {
      toast.error("Erro ao carregar objetivos");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleObjectiveChange = (operatorId, field, value) => {
    setObjectives(prev => ({
      ...prev,
      [operatorId]: {
        ...(prev[operatorId] || {
          electricity_target: 0,
          gas_target: 0,
          tv_target: 0,
          fiber_target: 0,
        }),
        [field]: parseInt(value) || 0,
      },
    }));
  };

  const handleSaveObjectives = async () => {
    if (!selectedManagerView) {
      toast.error("Erro ao identificar gestor");
      return;
    }

    try {
      setSaving(true);

      for (const operatorId of Object.keys(objectives)) {
        const objData = objectives[operatorId];
        if (objData.id) {
          await objectivesService.update(objData.id, {
            electricity_target: objData.electricity_target,
            gas_target: objData.gas_target,
            tv_target: objData.tv_target,
            fiber_target: objData.fiber_target,
          });
        }
      }

      toast.success("Objetivos atualizados com sucesso");
      await fetchInitialData();
      setViewDialogOpen(false);
    } catch (error) {
      toast.error("Erro ao atualizar objetivos");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateObjectives = async () => {
    if (!createFormData.manager_id) {
      toast.error("Selecione um gestor");
      return;
    }

    if (Object.keys(objectives).length === 0) {
      toast.error("Defina pelo menos um objetivo");
      return;
    }

    try {
      setSaving(true);

      for (const operatorId of Object.keys(objectives)) {
        await objectivesService.upsertObjective(
          createFormData.manager_id,
          operatorId,
          createFormData.year,
          createFormData.month,
          objectives[operatorId]
        );
      }

      toast.success("Objetivos criados com sucesso");
      await fetchInitialData();
      setCreateDialogOpen(false);
      setObjectives({});
      setCreateFormData({
        manager_id: "",
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
      });
    } catch (error) {
      toast.error("Erro ao criar objetivos");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const getAvailableYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 1; i <= currentYear + 1; i++) {
      years.push(i);
    }
    return years;
  };

  const groupedObjectives = groupObjectivesByManager();

  if (loading && operators.length === 0) {
    return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Objetivos</h1>
          <p className="text-dark-300 mt-1">Gerir objetivos por gestor</p>
        </div>
        <Button onClick={() => {
          setObjectives({});
          setCreateDialogOpen(true);
        }} className="btn-gold">
          <Plus className="w-4 h-4 mr-2" />
          Novos Objetivos
        </Button>
      </div>

      <div className="glass-ultra p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white">
          <Target className="w-5 h-5 text-gold-400" />
          Objetivos por Gestor
        </h2>

        {groupedObjectives.length === 0 ? (
          <div className="text-center py-12">
            <Target className="w-16 h-16 text-dark-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              Nenhum objetivo definido
            </h3>
            <p className="text-dark-300 mb-4">
              Comece por criar objetivos para os gestores
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} className="btn-gold">
              <Plus className="w-4 h-4 mr-2" />
              Criar Objetivos
            </Button>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Gestor</th>
                  <th>Funcao</th>
                  <th>Periodo</th>
                  <th className="text-center">Nr Operadoras</th>
                  <th className="text-center">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {groupedObjectives.map((group, idx) => (
                  <tr key={idx}>
                    <td className="font-medium text-white">{group.manager_name}</td>
                    <td>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        group.manager_role === 'gestor_nv1'
                          ? 'bg-blue-500/10 text-blue-400'
                          : 'bg-cyan-500/10 text-cyan-400'
                      }`}>
                        {group.manager_role === 'gestor_nv1' ? 'Gestor Nivel 1' : 'Gestor Nivel 2'}
                      </span>
                    </td>
                    <td className="text-dark-200">{months[group.month - 1]} {group.year}</td>
                    <td className="text-center">
                      <span className="font-semibold text-gold-400">
                        {group.objectives.length}
                      </span>
                    </td>
                    <td className="text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleViewObjectives(group)}
                        className="text-gold-400 hover:bg-dark-700"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Ver/Editar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="glass-ultra max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl text-white">Criar Novos Objetivos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-dark-200">Gestor *</Label>
                <Select
                  value={createFormData.manager_id}
                  onValueChange={(v) => setCreateFormData({ ...createFormData, manager_id: v })}
                >
                  <SelectTrigger className="glass-input">
                    <SelectValue placeholder="Selecione o gestor" />
                  </SelectTrigger>
                  <SelectContent>
                    {managers.map(manager => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.name} ({manager.role === 'gestor_nv1' ? 'Nivel 1' : 'Nivel 2'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-dark-200">Mes *</Label>
                <Select
                  value={createFormData.month.toString()}
                  onValueChange={(val) => setCreateFormData({ ...createFormData, month: parseInt(val) })}
                >
                  <SelectTrigger className="glass-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month, index) => (
                      <SelectItem key={index} value={(index + 1).toString()}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-dark-200">Ano *</Label>
                <Select
                  value={createFormData.year.toString()}
                  onValueChange={(val) => setCreateFormData({ ...createFormData, year: parseInt(val) })}
                >
                  <SelectTrigger className="glass-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableYears().map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t border-dark-600 pt-4">
              <h3 className="text-lg font-semibold mb-4 text-white">Objetivos por Operadora</h3>
              <div className="space-y-4">
                {operators.map(operator => (
                  <div key={operator.id} className="border border-dark-600 rounded-xl p-4 bg-dark-800/50">
                    <h4 className="font-semibold text-white mb-3">{operator.name}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {operator.scope === "energia" && (
                        <>
                          <div>
                            <Label className="text-xs text-dark-300">Eletricidade</Label>
                            <Input
                              type="number"
                              min="0"
                              value={objectives[operator.id]?.electricity_target || 0}
                              onChange={(e) => handleObjectiveChange(operator.id, "electricity_target", e.target.value)}
                              className="mt-1 glass-input"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-dark-300">Gas</Label>
                            <Input
                              type="number"
                              min="0"
                              value={objectives[operator.id]?.gas_target || 0}
                              onChange={(e) => handleObjectiveChange(operator.id, "gas_target", e.target.value)}
                              className="mt-1 glass-input"
                            />
                          </div>
                        </>
                      )}
                      {operator.scope === "telecomunicacoes" && (
                        <>
                          <div>
                            <Label className="text-xs text-dark-300">TV</Label>
                            <Input
                              type="number"
                              min="0"
                              value={objectives[operator.id]?.tv_target || 0}
                              onChange={(e) => handleObjectiveChange(operator.id, "tv_target", e.target.value)}
                              className="mt-1 glass-input"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-dark-300">Fibra/NET/LR</Label>
                            <Input
                              type="number"
                              min="0"
                              value={objectives[operator.id]?.fiber_target || 0}
                              onChange={(e) => handleObjectiveChange(operator.id, "fiber_target", e.target.value)}
                              className="mt-1 glass-input"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-dark-600">
              <Button type="button" onClick={() => setCreateDialogOpen(false)} className="btn-secondary">
                Cancelar
              </Button>
              <Button onClick={handleCreateObjectives} disabled={saving} className="btn-gold">
                <Save className="w-4 h-4 mr-2" />
                {saving ? "A guardar..." : "Guardar Objetivos"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="glass-ultra max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl text-white">
              Objetivos - {selectedManagerView?.manager_name}
            </DialogTitle>
            <p className="text-sm text-dark-300">
              {months[selectedMonth - 1]} {selectedYear}
            </p>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-4">
              {operators.map(operator => {
                const objData = objectives[operator.id];
                if (!objData) return null;

                const hasValues = objData.electricity_target > 0 || objData.gas_target > 0 ||
                                  objData.tv_target > 0 || objData.fiber_target > 0;

                if (!hasValues) return null;

                return (
                  <div key={operator.id} className="border border-dark-600 rounded-xl p-4 bg-dark-800/50">
                    <h4 className="font-semibold text-white mb-3">{operator.name}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {operator.scope === "energia" && (
                        <>
                          <div>
                            <Label className="text-xs text-dark-300">Eletricidade</Label>
                            <Input
                              type="number"
                              min="0"
                              value={objData.electricity_target || 0}
                              onChange={(e) => handleObjectiveChange(operator.id, "electricity_target", e.target.value)}
                              className="mt-1 glass-input"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-dark-300">Gas</Label>
                            <Input
                              type="number"
                              min="0"
                              value={objData.gas_target || 0}
                              onChange={(e) => handleObjectiveChange(operator.id, "gas_target", e.target.value)}
                              className="mt-1 glass-input"
                            />
                          </div>
                        </>
                      )}
                      {operator.scope === "telecomunicacoes" && (
                        <>
                          <div>
                            <Label className="text-xs text-dark-300">TV</Label>
                            <Input
                              type="number"
                              min="0"
                              value={objData.tv_target || 0}
                              onChange={(e) => handleObjectiveChange(operator.id, "tv_target", e.target.value)}
                              className="mt-1 glass-input"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-dark-300">Fibra/NET/LR</Label>
                            <Input
                              type="number"
                              min="0"
                              value={objData.fiber_target || 0}
                              onChange={(e) => handleObjectiveChange(operator.id, "fiber_target", e.target.value)}
                              className="mt-1 glass-input"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-dark-600">
              <Button type="button" onClick={() => setViewDialogOpen(false)} className="btn-secondary">
                Fechar
              </Button>
              <Button onClick={handleSaveObjectives} disabled={saving} className="btn-gold">
                <Save className="w-4 h-4 mr-2" />
                {saving ? "A guardar..." : "Guardar Alteracoes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Objectives;
