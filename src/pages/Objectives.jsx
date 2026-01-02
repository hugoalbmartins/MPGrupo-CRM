import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Save, Target, Edit2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { objectivesService } from "../services/objectivesService";
import { usersService } from "../services/usersService";
import { operatorsService } from "../services/operatorsService";

const Objectives = ({ user }) => {
  const [managers, setManagers] = useState([]);
  const [operators, setOperators] = useState([]);
  const [allObjectives, setAllObjectives] = useState([]);
  const [selectedManager, setSelectedManager] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [objectives, setObjectives] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});

  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedManager) {
      fetchObjectives();
    }
  }, [selectedManager, selectedMonth, selectedYear]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [usersData, operatorsData, objectivesData] = await Promise.all([
        usersService.getAll(),
        operatorsService.getAll(),
        objectivesService.getAll()
      ]);

      const managerUsers = usersData.filter(u => u.role === "gestor_nv1");
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

  const fetchObjectives = async () => {
    try {
      setLoading(true);
      const data = await objectivesService.getByManager(
        selectedManager,
        selectedYear,
        selectedMonth
      );

      const objectivesMap = {};
      data.forEach(obj => {
        objectivesMap[obj.operator_id] = {
          electricity_target: obj.electricity_target || 0,
          gas_target: obj.gas_target || 0,
          tv_target: obj.tv_target || 0,
          fiber_target: obj.fiber_target || 0,
        };
      });

      setObjectives(objectivesMap);
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
    if (!selectedManager) {
      toast.error("Selecione um gestor");
      return;
    }

    try {
      setSaving(true);

      for (const operatorId of Object.keys(objectives)) {
        await objectivesService.upsertObjective(
          selectedManager,
          operatorId,
          selectedYear,
          selectedMonth,
          objectives[operatorId]
        );
      }

      toast.success("Objetivos guardados com sucesso");
      await fetchInitialData();
    } catch (error) {
      toast.error("Erro ao guardar objetivos");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleEditObjective = (obj) => {
    setEditingId(obj.id);
    setEditValues({
      electricity_target: obj.electricity_target,
      gas_target: obj.gas_target,
      tv_target: obj.tv_target,
      fiber_target: obj.fiber_target,
    });
  };

  const handleSaveEdit = async (objId) => {
    try {
      await objectivesService.update(objId, editValues);
      toast.success("Objetivo atualizado");
      await fetchInitialData();
      setEditingId(null);
      setEditValues({});
    } catch (error) {
      toast.error("Erro ao atualizar objetivo");
      console.error(error);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const getAvailableYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 1; i <= currentYear + 1; i++) {
      years.push(i);
    }
    return years;
  };

  if (loading && operators.length === 0) {
    return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Objetivos Mensais</h1>
          <p className="text-gray-600 mt-1">Defina objetivos para gestores</p>
        </div>
      </div>

      {allObjectives.length > 0 && (
        <div className="professional-card p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            Objetivos Existentes
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Gestor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Operadora</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Período</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Eletricidade</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Gás</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">TV</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Fibra/NET</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {allObjectives.map((obj) => (
                  <tr key={obj.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{obj.manager?.name || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm">{obj.operator?.name || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm">{months[obj.month - 1]} {obj.year}</td>
                    {editingId === obj.id ? (
                      <>
                        <td className="px-4 py-3 text-center">
                          <Input
                            type="number"
                            min="0"
                            value={editValues.electricity_target}
                            onChange={(e) => setEditValues({...editValues, electricity_target: parseInt(e.target.value) || 0})}
                            className="w-16 text-center"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Input
                            type="number"
                            min="0"
                            value={editValues.gas_target}
                            onChange={(e) => setEditValues({...editValues, gas_target: parseInt(e.target.value) || 0})}
                            className="w-16 text-center"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Input
                            type="number"
                            min="0"
                            value={editValues.tv_target}
                            onChange={(e) => setEditValues({...editValues, tv_target: parseInt(e.target.value) || 0})}
                            className="w-16 text-center"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Input
                            type="number"
                            min="0"
                            value={editValues.fiber_target}
                            onChange={(e) => setEditValues({...editValues, fiber_target: parseInt(e.target.value) || 0})}
                            className="w-16 text-center"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button size="sm" variant="ghost" onClick={() => handleSaveEdit(obj.id)}>
                              <Check className="w-4 h-4 text-green-600" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                              <X className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-center text-sm">{obj.electricity_target || 0}</td>
                        <td className="px-4 py-3 text-center text-sm">{obj.gas_target || 0}</td>
                        <td className="px-4 py-3 text-center text-sm">{obj.tv_target || 0}</td>
                        <td className="px-4 py-3 text-center text-sm">{obj.fiber_target || 0}</td>
                        <td className="px-4 py-3 text-center">
                          <Button size="sm" variant="ghost" onClick={() => handleEditObjective(obj)}>
                            <Edit2 className="w-4 h-4 text-blue-600" />
                          </Button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="professional-card p-6">
        <h2 className="text-xl font-semibold mb-4">Definir Novos Objetivos</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <Label>Gestor</Label>
            <Select value={selectedManager} onValueChange={setSelectedManager}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o gestor" />
              </SelectTrigger>
              <SelectContent>
                {managers.map(manager => (
                  <SelectItem key={manager.id} value={manager.id}>
                    {manager.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Mês</Label>
            <Select value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(parseInt(val))}>
              <SelectTrigger>
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
            <Label>Ano</Label>
            <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
              <SelectTrigger>
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

        {selectedManager && (
          <>
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-600" />
                Objetivos por Operadora
              </h3>

              <div className="space-y-4">
                {operators.map(operator => (
                  <div key={operator.id} className="border rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">{operator.name}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {operator.scope === "energia" && (
                        <>
                          <div>
                            <Label className="text-xs">Eletricidade</Label>
                            <Input
                              type="number"
                              min="0"
                              value={objectives[operator.id]?.electricity_target || 0}
                              onChange={(e) => handleObjectiveChange(operator.id, "electricity_target", e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Gás</Label>
                            <Input
                              type="number"
                              min="0"
                              value={objectives[operator.id]?.gas_target || 0}
                              onChange={(e) => handleObjectiveChange(operator.id, "gas_target", e.target.value)}
                              className="mt-1"
                            />
                          </div>
                        </>
                      )}
                      {operator.scope === "telecomunicacoes" && (
                        <>
                          <div>
                            <Label className="text-xs">TV</Label>
                            <Input
                              type="number"
                              min="0"
                              value={objectives[operator.id]?.tv_target || 0}
                              onChange={(e) => handleObjectiveChange(operator.id, "tv_target", e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Fibra/NET/LR</Label>
                            <Input
                              type="number"
                              min="0"
                              value={objectives[operator.id]?.fiber_target || 0}
                              onChange={(e) => handleObjectiveChange(operator.id, "fiber_target", e.target.value)}
                              className="mt-1"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end mt-6 pt-6 border-t">
              <Button onClick={handleSaveObjectives} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? "A guardar..." : "Guardar Objetivos"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Objectives;
