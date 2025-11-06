import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { API } from "../App";

const Operators = ({ user }) => {
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOperator, setEditingOperator] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "",
  });

  useEffect(() => {
    fetchOperators();
  }, []);

  const fetchOperators = async () => {
    try {
      const response = await axios.get(`${API}/operators`);
      setOperators(response.data);
    } catch (error) {
      toast.error("Erro ao carregar operadoras");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingOperator) {
        await axios.put(`${API}/operators/${editingOperator.id}`, formData);
        toast.success("Operadora atualizada com sucesso!");
      } else {
        await axios.post(`${API}/operators`, formData);
        toast.success("Operadora criada com sucesso!");
      }
      setDialogOpen(false);
      resetForm();
      fetchOperators();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao salvar operadora");
    }
  };

  const handleDelete = async (operatorId) => {
    if (window.confirm("Tem certeza que deseja eliminar esta operadora?")) {
      try {
        await axios.delete(`${API}/operators/${operatorId}`);
        toast.success("Operadora eliminada com sucesso!");
        fetchOperators();
      } catch (error) {
        toast.error("Erro ao eliminar operadora");
      }
    }
  };

  const resetForm = () => {
    setFormData({ name: "", type: "" });
    setEditingOperator(null);
  };

  const handleEdit = (operator) => {
    setEditingOperator(operator);
    setFormData({
      name: operator.name,
      type: operator.type,
    });
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#C9A961]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="operators-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-4xl font-bold">Operadoras</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={resetForm}
              data-testid="add-operator-button"
              className="bg-gradient-to-r from-[#C9A961] to-[#B8944E] text-[#0f0f10]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Operadora
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#1a1a1c] border-[#C9A961]/20">
            <DialogHeader>
              <DialogTitle className="text-[#C9A961] text-2xl">
                {editingOperator ? "Editar Operadora" : "Nova Operadora"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <Label htmlFor="name" className="text-gray-300">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  data-testid="operator-name-input"
                  className="bg-white/5 border-[#C9A961]/20 text-white"
                />
              </div>
              <div>
                <Label htmlFor="type" className="text-gray-300">Tipo *</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                  <SelectTrigger data-testid="operator-type-select" className="bg-white/5 border-[#C9A961]/20 text-white">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1c] border-[#C9A961]/20">
                    <SelectItem value="telecom" className="text-white">Telecomunicações</SelectItem>
                    <SelectItem value="energy" className="text-white">Energia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <Button
                  type="button"
                  onClick={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}
                  variant="outline"
                  className="border-[#C9A961]/20 text-gray-300"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  data-testid="save-operator-button"
                  className="bg-gradient-to-r from-[#C9A961] to-[#B8944E] text-[#0f0f10]"
                >
                  {editingOperator ? "Atualizar" : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Telecom Operators */}
        <div className="glass-card p-6">
          <h2 className="text-2xl font-semibold mb-4 gold-text">Telecomunicações</h2>
          <div className="space-y-3">
            {operators
              .filter((op) => op.type === "telecom")
              .map((operator) => (
                <div
                  key={operator.id}
                  data-testid={`operator-${operator.id}`}
                  className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
                >
                  <span className="font-medium">{operator.name}</span>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleEdit(operator)}
                      size="sm"
                      variant="ghost"
                      data-testid={`edit-operator-${operator.id}`}
                      className="text-[#C9A961] hover:bg-[#C9A961]/10"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => handleDelete(operator.id)}
                      size="sm"
                      variant="ghost"
                      data-testid={`delete-operator-${operator.id}`}
                      className="text-red-400 hover:bg-red-400/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            {operators.filter((op) => op.type === "telecom").length === 0 && (
              <p className="text-center text-gray-400 py-4">Nenhuma operadora de telecomunicações</p>
            )}
          </div>
        </div>

        {/* Energy Operators */}
        <div className="glass-card p-6">
          <h2 className="text-2xl font-semibold mb-4 gold-text">Energia</h2>
          <div className="space-y-3">
            {operators
              .filter((op) => op.type === "energy")
              .map((operator) => (
                <div
                  key={operator.id}
                  data-testid={`operator-${operator.id}`}
                  className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
                >
                  <span className="font-medium">{operator.name}</span>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleEdit(operator)}
                      size="sm"
                      variant="ghost"
                      data-testid={`edit-operator-${operator.id}`}
                      className="text-[#C9A961] hover:bg-[#C9A961]/10"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => handleDelete(operator.id)}
                      size="sm"
                      variant="ghost"
                      data-testid={`delete-operator-${operator.id}`}
                      className="text-red-400 hover:bg-red-400/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            {operators.filter((op) => op.type === "energy").length === 0 && (
              <p className="text-center text-gray-400 py-4">Nenhuma operadora de energia</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Operators;
