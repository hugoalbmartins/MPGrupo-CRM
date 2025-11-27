import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Eye, EyeOff, Settings, Upload, Trash2, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { API } from "../App";
import CommissionConfig from "../components/CommissionConfig";

const Operators = ({ user }) => {
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedOperator, setSelectedOperator] = useState(null);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    scope: "telecomunicacoes",
    commission_config: {}
  });

  useEffect(() => {
    fetchOperators();
  }, []);

  const fetchOperators = async () => {
    try {
      const response = await axios.get(`${API}/operators?include_hidden=true`);
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
      await axios.post(`${API}/operators`, formData);
      toast.success("Operadora criada com sucesso!");
      setDialogOpen(false);
      resetForm();
      fetchOperators();
    } catch (error) {
      toast.error("Erro ao criar operadora");
    }
  };

  const toggleVisibility = async (operatorId) => {
    try {
      await axios.post(`${API}/operators/${operatorId}/toggle-visibility`);
      toast.success("Visibilidade alterada");
      fetchOperators();
    } catch (error) {
      toast.error("Erro ao alterar visibilidade");
    }
  };

  const resetForm = () => {
    setFormData({ name: "", scope: "telecomunicacoes", commission_config: {} });
  };

  const openCommissionConfig = (operator) => {
    setSelectedOperator(operator);
    setConfigDialogOpen(true);
  };

  const handleSaveCommission = async (commissionConfig) => {
    try {
      await axios.put(`${API}/operators/${selectedOperator.id}`, {
        name: selectedOperator.name,
        scope: selectedOperator.scope,
        commission_config: commissionConfig
      });
      toast.success("Configuração de comissões guardada!");
      setConfigDialogOpen(false);
      setSelectedOperator(null);
      fetchOperators();
    } catch (error) {
      toast.error("Erro ao guardar configuração");
    }
  };

  const openUploadDialog = (operator) => {
    setSelectedOperator(operator);
    setUploadFiles([]);
    setUploadDialogOpen(true);
  };

  const handleUpload = async () => {
    if (uploadFiles.length === 0) {
      toast.error("Selecione pelo menos um ficheiro PDF");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      uploadFiles.forEach(file => {
        formData.append('files', file);
      });

      await axios.post(`${API}/operators/${selectedOperator.id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success(`${uploadFiles.length} documento(s) enviado(s) com sucesso!`);
      setUploadDialogOpen(false);
      setUploadFiles([]);
      fetchOperators();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao enviar documentos");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (operatorId, docId) => {
    if (!window.confirm("Tem a certeza que deseja eliminar este documento?")) return;

    try {
      await axios.delete(`${API}/operators/${operatorId}/documents/${docId}`);
      toast.success("Documento eliminado com sucesso!");
      fetchOperators();
    } catch (error) {
      toast.error("Erro ao eliminar documento");
    }
  };

  const handleDownloadDocument = (operatorId, docId, filename) => {
    window.open(`${API}/operators/${operatorId}/documents/${docId}/download`, '_blank');
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Operadoras</h1>
        {user?.role === 'admin' && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="btn-primary"><Plus className="w-4 h-4 mr-2" />Nova Operadora</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="text-2xl">Nova Operadora</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div>
                  <Label>Nome *</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                </div>
                <div>
                  <Label>Âmbito *</Label>
                  <Select value={formData.scope} onValueChange={(v) => setFormData({...formData, scope: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="telecomunicacoes">Telecomunicações</SelectItem>
                      <SelectItem value="energia">Energia</SelectItem>
                      <SelectItem value="solar">Solar</SelectItem>
                      <SelectItem value="dual">Dual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" onClick={() => setDialogOpen(false)} variant="outline">Cancelar</Button>
                  <Button type="submit" className="btn-primary">Criar</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {['telecomunicacoes', 'energia', 'solar', 'dual'].map(scope => (
          <div key={scope} className="professional-card p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 capitalize">{scope}</h2>
            <div className="space-y-2">
              {operators.filter(op => op.scope === scope).map(op => (
                <div key={op.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                  <div>
                    <span className="font-medium block">{op.name}</span>
                    {op.commission_config && Object.keys(op.commission_config).length > 0 && (
                      <span className="text-xs text-green-600">✓ Comissões configuradas</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {user?.role === 'admin' && (
                      <Button onClick={() => openCommissionConfig(op)} size="sm" variant="ghost" title="Configurar Comissões">
                        <Settings className="w-4 h-4" />
                      </Button>
                    )}
                    {(user?.role === 'admin' || user?.role === 'bo') && (
                      <Button onClick={() => toggleVisibility(op.id)} size="sm" variant="ghost" title={op.hidden ? "Mostrar" : "Ocultar"}>
                        {op.hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Commission Configuration Dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              Configurar Comissões - {selectedOperator?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedOperator && (
            <CommissionConfig
              operator={selectedOperator}
              onSave={handleSaveCommission}
              onCancel={() => {
                setConfigDialogOpen(false);
                setSelectedOperator(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Operators;
