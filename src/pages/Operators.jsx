import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Eye, EyeOff, Upload, Trash2, Download, Settings } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOperators, useCreateOperator, useUpdateOperator, useDeleteOperator } from "@/hooks/useOperatorsData";
import { operatorsService } from "../services/operatorsService";
import CommissionWizard from "../components/CommissionWizard";
import { supabase } from "../lib/supabase";

const Operators = ({ user }) => {
  const [operators, setOperators] = useState([]);
  const [hiddenOperators, setHiddenOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [hiddenDialogOpen, setHiddenDialogOpen] = useState(false);
  const [commissionDialogOpen, setCommissionDialogOpen] = useState(false);
  const [selectedOperator, setSelectedOperator] = useState(null);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    scope: "telecomunicacoes",
    energy_type: "",
    activation_types: [],
    allowed_client_types: ['particular', 'empresarial'],
    allowed_energy_types: ['eletricidade', 'gas'],
    commission_mode: "tier",
    pays_direct_debit: false,
    pays_electronic_invoice: false
  });

  useEffect(() => {
    fetchOperators();
  }, []);

  const fetchOperators = async () => {
    try {
      const visibleData = await operatorsService.getAll(false);
      const hiddenData = await operatorsService.getHidden();
      setOperators(visibleData);
      setHiddenOperators(hiddenData);
    } catch (error) {
      toast.error("Erro ao carregar operadoras");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = { ...formData };
      if (submitData.scope === 'energia') {
        const types = submitData.allowed_energy_types || [];
        if (types.includes('eletricidade') && types.includes('gas')) {
          submitData.energy_type = 'dual';
        } else if (types.includes('eletricidade')) {
          submitData.energy_type = 'eletricidade';
        } else if (types.includes('gas')) {
          submitData.energy_type = 'gas';
        }
      }
      await operatorsService.create(submitData);
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
      await operatorsService.toggleVisibility(operatorId);
      toast.success("Visibilidade alterada");
      fetchOperators();
    } catch (error) {
      toast.error("Erro ao alterar visibilidade");
    }
  };

  const handleDelete = async (operatorId, operatorName) => {
    if (!window.confirm(`Tem a certeza que deseja eliminar a operadora "${operatorName}"? Esta ação não pode ser revertida.`)) {
      return;
    }

    try {
      await operatorsService.delete(operatorId);
      toast.success("Operadora eliminada com sucesso");
      fetchOperators();
    } catch (error) {
      toast.error("Erro ao eliminar operadora. Pode existir vendas associadas.");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      scope: "telecomunicacoes",
      energy_type: "",
      activation_types: [],
      allowed_client_types: ['particular', 'empresarial'],
      allowed_energy_types: ['eletricidade', 'gas'],
      commission_mode: "tier",
      pays_direct_debit: false,
      pays_electronic_invoice: false
    });
  };

  const toggleActivationType = (type) => {
    setFormData(prev => {
      const newTypes = prev.activation_types.includes(type)
        ? prev.activation_types.filter(t => t !== type)
        : [...prev.activation_types, type];
      return { ...prev, activation_types: newTypes };
    });
  };

  const toggleClientType = (type) => {
    setFormData(prev => {
      const newTypes = prev.allowed_client_types.includes(type)
        ? prev.allowed_client_types.filter(t => t !== type)
        : [...prev.allowed_client_types, type];
      return { ...prev, allowed_client_types: newTypes };
    });
  };

  const toggleEnergyType = (type) => {
    setFormData(prev => {
      const newTypes = prev.allowed_energy_types.includes(type)
        ? prev.allowed_energy_types.filter(t => t !== type)
        : [...prev.allowed_energy_types, type];
      return { ...prev, allowed_energy_types: newTypes };
    });
  };

  const openCommissionConfig = async (operator) => {
    try {
      const freshOperatorData = await operatorsService.getById(operator.id);
      setSelectedOperator(freshOperatorData);
      setCommissionDialogOpen(true);
    } catch (error) {
      toast.error("Erro ao carregar dados da operadora");
    }
  };

  const handleCommissionSave = async () => {
    setCommissionDialogOpen(false);
    setSelectedOperator(null);
    fetchOperators();
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
      const uploadedDocs = [];

      for (const file of uploadFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${selectedOperator.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('operator-documents')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw uploadError;
        }

        uploadedDocs.push({
          id: crypto.randomUUID(),
          filename: file.name,
          path: fileName,
          uploaded_at: new Date().toISOString()
        });
      }

      const existingDocs = selectedOperator.documents || [];
      const updatedDocs = [...existingDocs, ...uploadedDocs];

      const { error: updateError } = await supabase
        .from('operators')
        .update({ documents: updatedDocs })
        .eq('id', selectedOperator.id);

      if (updateError) throw updateError;

      toast.success(`${uploadFiles.length} documento(s) enviado(s) com sucesso!`);
      setUploadDialogOpen(false);
      setUploadFiles([]);
      fetchOperators();
    } catch (error) {
      console.error('Error uploading documents:', error);
      toast.error("Erro ao enviar documentos: " + (error.message || 'Erro desconhecido'));
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (operatorId, docId) => {
    if (!window.confirm("Tem a certeza que deseja eliminar este documento?")) return;

    try {
      const operator = operators.find(op => op.id === operatorId);
      if (!operator) return;

      const doc = operator.documents?.find(d => d.id === docId);
      if (!doc) return;

      const { error: storageError } = await supabase.storage
        .from('operator-documents')
        .remove([doc.path]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
      }

      const updatedDocs = operator.documents.filter(d => d.id !== docId);

      const { error: updateError } = await supabase
        .from('operators')
        .update({ documents: updatedDocs })
        .eq('id', operatorId);

      if (updateError) throw updateError;

      toast.success("Documento eliminado com sucesso!");
      fetchOperators();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error("Erro ao eliminar documento");
    }
  };

  const handleDownloadDocument = async (operatorId, docId, filename) => {
    try {
      const operator = operators.find(op => op.id === operatorId);
      if (!operator) return;

      const doc = operator.documents?.find(d => d.id === docId);
      if (!doc) return;

      const { data, error } = await supabase.storage
        .from('operator-documents')
        .download(doc.path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Download concluído!");
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error("Erro ao descarregar documento");
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-white">Operadoras</h1>
          {hiddenOperators.length > 0 && (
            <Button
              onClick={() => setHiddenDialogOpen(true)}
              variant="outline"
              size="sm"
              className="text-dark-300 hover:border-gold-400"
            >
              Ver Desativadas ({hiddenOperators.length})
            </Button>
          )}
        </div>
        {user?.role === 'admin' && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="btn-gold"><Plus className="w-4 h-4 mr-2" />Nova Operadora</Button>
            </DialogTrigger>
            <DialogContent className="glass-ultra">
              <DialogHeader><DialogTitle className="text-2xl text-white">Nova Operadora</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div>
                  <Label className="text-dark-200">Nome *</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required className="glass-input" />
                </div>
                <div>
                  <Label className="text-dark-200">Âmbito *</Label>
                  <Select value={formData.scope} onValueChange={(v) => setFormData({...formData, scope: v, energy_type: '', allowed_energy_types: v === 'energia' ? ['eletricidade', 'gas'] : []})}>
                    <SelectTrigger className="glass-input"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="telecomunicacoes">Telecomunicações</SelectItem>
                      <SelectItem value="energia">Energia</SelectItem>
                      <SelectItem value="solar">Solar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.scope === 'telecomunicacoes' && (
                  <>
                    <div>
                      <Label className="text-dark-200">Tipos de Ativação Permitidos *</Label>
                      <div className="mt-2 space-y-2">
                        {['M2', 'M3', 'M4'].map(type => (
                          <div key={type} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`activation-${type}`}
                              checked={formData.activation_types.includes(type)}
                              onChange={() => toggleActivationType(type)}
                              className="w-4 h-4"
                            />
                            <Label htmlFor={`activation-${type}`} className="cursor-pointer font-normal text-dark-300">{type}</Label>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-dark-400 mt-1">Selecione os tipos de ativação permitidos (M2, M3, M4)</p>
                    </div>
                  </>
                )}
                <div>
                  <Label className="text-dark-200">Tipos de Cliente Permitidos *</Label>
                  <div className="mt-2 space-y-2">
                    {['particular', 'empresarial'].map(type => (
                      <div key={type} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`client-${type}`}
                          checked={formData.allowed_client_types.includes(type)}
                          onChange={() => toggleClientType(type)}
                          className="w-4 h-4"
                        />
                        <Label htmlFor={`client-${type}`} className="cursor-pointer font-normal capitalize text-dark-300">{type}</Label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-dark-400 mt-1">Selecione pelo menos um tipo</p>
                </div>
                {formData.scope === 'energia' && (
                  <>
                    <div>
                      <Label className="text-dark-200">Tipos de Energia Permitidos *</Label>
                      <div className="mt-2 space-y-2">
                        {['eletricidade', 'gas'].map(type => (
                          <div key={type} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`energy-${type}`}
                              checked={formData.allowed_energy_types.includes(type)}
                              onChange={() => toggleEnergyType(type)}
                              className="w-4 h-4"
                            />
                            <Label htmlFor={`energy-${type}`} className="cursor-pointer font-normal capitalize text-dark-300">{type}</Label>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-dark-400 mt-1">Selecione pelo menos um tipo. As comissões serão configuradas separadamente para cada tipo.</p>
                    </div>
                  </>
                )}
                {formData.scope === 'solar' && (
                  <div>
                    <Label className="text-dark-200">Modo de Comissão *</Label>
                    <Select value={formData.commission_mode} onValueChange={(v) => setFormData({...formData, commission_mode: v})}>
                      <SelectTrigger className="glass-input"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tier">Por Patamares</SelectItem>
                        <SelectItem value="manual">Definida ao Contrato</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-dark-400 mt-1">
                      {formData.commission_mode === 'tier'
                        ? 'Comissões calculadas automaticamente por patamares'
                        : 'Comissão definida manualmente na edição de cada venda'}
                    </p>
                  </div>
                )}

                <div className="border-t border-dark-600 pt-4 mt-4">
                  <Label className="text-base font-semibold mb-3 block text-dark-200">Serviços Adicionais</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="pays_direct_debit"
                        checked={formData.pays_direct_debit}
                        onChange={(e) => setFormData({...formData, pays_direct_debit: e.target.checked})}
                        className="w-4 h-4"
                      />
                      <Label htmlFor="pays_direct_debit" className="cursor-pointer font-normal text-dark-300">
                        Paga adesão a Débito Direto
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="pays_electronic_invoice"
                        checked={formData.pays_electronic_invoice}
                        onChange={(e) => setFormData({...formData, pays_electronic_invoice: e.target.checked})}
                        className="w-4 h-4"
                      />
                      <Label htmlFor="pays_electronic_invoice" className="cursor-pointer font-normal text-dark-300">
                        Paga adesão a Fatura Eletrónica
                      </Label>
                    </div>
                  </div>
                  <p className="text-xs text-dark-400 mt-2">
                    Os valores para estes serviços são definidos na configuração de patamares
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" onClick={() => setDialogOpen(false)} variant="outline">Cancelar</Button>
                  <Button type="submit" className="btn-gold">Criar</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {['telecomunicacoes', 'energia', 'solar'].map(scope => (
          <div key={scope} className="glass-ultra p-6 spring-transition">
            <h2 className="text-xl font-semibold mb-4 capitalize text-white">{scope}</h2>
            <div className="space-y-2">
              {operators.filter(op => op.scope === scope).map(op => (
                <div key={op.id} className="flex items-center justify-between p-3 rounded-lg spring-transition bg-dark-800/60 border border-dark-600 rounded-xl">
                  <div>
                    <span className="text-white font-semibold block">{op.name}</span>
                    {op.scope === 'energia' && op.energy_type && (
                      <span className="text-xs block text-dark-400">
                        {op.energy_type === 'eletricidade' ? '⚡ Eletricidade' :
                         op.energy_type === 'gas' ? '🔥 Gás' :
                         '⚡🔥 Dual'}
                      </span>
                    )}
                    {op.commission_config && Object.keys(op.commission_config).length > 0 && (
                      <span className="text-xs text-green-400 block">✓ Comissões configuradas</span>
                    )}
                    {op.documents && op.documents.length > 0 && (
                      <span className="text-xs text-blue-400 block">📄 {op.documents.length} formulário(s)</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {user?.role === 'admin' && (
                      <>
                        <Button onClick={() => openCommissionConfig(op)} size="sm" variant="ghost" title="Configurar Comissões">
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button onClick={() => handleDelete(op.id, op.name)} size="sm" variant="ghost" title="Eliminar" className="text-red-400 hover:bg-red-500/10">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    {(user?.role === 'admin' || user?.role === 'bo') && (
                      <>
                        <Button onClick={() => openUploadDialog(op)} size="sm" variant="ghost" title="Gerir Formulários">
                          <Upload className="w-4 h-4" />
                        </Button>
                        <Button onClick={() => toggleVisibility(op.id)} size="sm" variant="ghost" title={op.hidden ? "Mostrar" : "Ocultar"}>
                          {op.hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-2xl glass-ultra">
          <DialogHeader>
            <DialogTitle className="text-2xl text-white">
              Gerir Formulários - {selectedOperator?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            <div>
              <Label className="text-dark-200">Adicionar Novos Formulários (PDF)</Label>
              <Input
                type="file"
                accept=".pdf"
                multiple
                onChange={(e) => setUploadFiles(Array.from(e.target.files))}
                className="mt-2 glass-input"
              />
              {uploadFiles.length > 0 && (
                <p className="text-sm text-dark-400 mt-2">
                  {uploadFiles.length} ficheiro(s) selecionado(s)
                </p>
              )}
              <Button
                onClick={handleUpload}
                disabled={uploading || uploadFiles.length === 0}
                className="mt-3 btn-gold"
              >
                {uploading ? "A enviar..." : "Enviar Ficheiros"}
              </Button>
            </div>

            <div>
              <Label className="text-dark-200">Formulários Existentes</Label>
              {selectedOperator?.documents && selectedOperator.documents.length > 0 ? (
                <div className="space-y-2 mt-2">
                  {selectedOperator.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg spring-transition bg-dark-800/60 border border-dark-600 rounded-xl">
                      <div className="flex items-center gap-2">
                        <span className="text-blue-400">📄</span>
                        <span className="text-white font-semibold">{doc.filename}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDownloadDocument(selectedOperator.id, doc.id, doc.filename)}
                          title="Descarregar"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteDocument(selectedOperator.id, doc.id)}
                          title="Eliminar"
                          className="text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm mt-2 text-dark-400">Nenhum formulário disponível</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={hiddenDialogOpen} onOpenChange={setHiddenDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto glass-ultra">
          <DialogHeader>
            <DialogTitle className="text-2xl text-white">Operadoras Desativadas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {hiddenOperators.length === 0 ? (
              <p className="text-center py-8 text-dark-400">Nenhuma operadora desativada</p>
            ) : (
              <div className="space-y-3">
                {hiddenOperators.map(op => (
                  <div key={op.id} className="flex items-center justify-between p-4 rounded-lg spring-transition bg-dark-800/50 border border-dark-600 rounded-xl">
                    <div>
                      <span className="text-white font-semibold block">{op.name}</span>
                      <span className="text-sm capitalize text-dark-400">{op.scope}</span>
                    </div>
                    {user?.role === 'admin' && (
                      <div className="flex gap-2">
                        <Button
                          onClick={async () => {
                            await toggleVisibility(op.id);
                            setHiddenDialogOpen(false);
                          }}
                          size="sm"
                          variant="outline"
                          className="text-green-400 hover:bg-green-500/10"
                          title="Reativar"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Reativar
                        </Button>
                        <Button
                          onClick={() => {
                            handleDelete(op.id, op.name);
                            setHiddenDialogOpen(false);
                          }}
                          size="sm"
                          variant="outline"
                          className="text-red-400 hover:bg-red-500/10"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={commissionDialogOpen} onOpenChange={setCommissionDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto glass-ultra">
          <DialogHeader>
            <DialogTitle className="text-2xl text-white">
              Configurar Comissões - {selectedOperator?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedOperator && (
            <CommissionWizard
              operator={selectedOperator}
              onSave={handleCommissionSave}
              onCancel={() => {
                setCommissionDialogOpen(false);
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
