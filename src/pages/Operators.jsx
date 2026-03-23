import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Plus, Eye, EyeOff, Upload, Trash2, Download, Settings, Pencil, Mail, X, Building2, Zap, DollarSign, CreditCard, Users, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOperators, useCreateOperator, useUpdateOperator, useDeleteOperator } from "@/hooks/useOperatorsData";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { operatorsService } from "../services/operatorsService";
import CommissionWizard from "../components/CommissionWizard";
import { supabase } from "../lib/supabase";

const EMAIL_FIELDS_BY_SCOPE = {
  telecomunicacoes: [
    { key: 'client_contact', label: 'Contacto do Cliente' },
    { key: 'client_email', label: 'Email do Cliente' },
    { key: 'client_iban', label: 'IBAN do Cliente' },
    { key: 'address', label: 'Morada (Rua, Código Postal, Localidade)' },
    { key: 'installation_address', label: 'Morada de Instalação/Fornecimento' },
    { key: 'autoriza_documentos', label: 'Autoriza Documentos Pessoais' },
    { key: 'service_type', label: 'Tipo de Serviço (NI/MC/REFID)' },
    { key: 'activation_type', label: 'Tipo de Ativação (M2/M3/M4)' },
    { key: 'monthly_value', label: 'Mensalidade (€)' },
    { key: 'refid_fees', label: 'Mensalidade Atual / Contratada (REFID)' },
    { key: 'services', label: 'Serviços Contratados (TV, NET, LR)' },
    { key: 'mobile_lines', label: 'Linhas Móveis' },
    { key: 'direct_debit', label: 'Adesão Débito Direto (DD)' },
    { key: 'electronic_invoice', label: 'Adesão Fatura Eletrónica (FE)' },
    { key: 'observations', label: 'Observações' },
  ],
  energia: [
    { key: 'client_contact', label: 'Contacto do Cliente' },
    { key: 'client_email', label: 'Email do Cliente' },
    { key: 'client_iban', label: 'IBAN do Cliente' },
    { key: 'address', label: 'Morada (Rua, Código Postal, Localidade)' },
    { key: 'installation_address', label: 'Morada de Instalação/Fornecimento' },
    { key: 'autoriza_documentos', label: 'Autoriza Documentos Pessoais' },
    { key: 'entry_type', label: 'Tipo de Entrada' },
    { key: 'energy_sale_type', label: 'Tipo de Energia (Eletricidade/Gás/Dual)' },
    { key: 'cpe_power', label: 'CPE / Potência (Eletricidade)' },
    { key: 'cui_tier', label: 'CUI / Escalão (Gás)' },
    { key: 'direct_debit', label: 'Adesão Débito Direto (DD)' },
    { key: 'electronic_invoice', label: 'Adesão Fatura Eletrónica (FE)' },
    { key: 'observations', label: 'Observações' },
  ],
  solar: [
    { key: 'client_contact', label: 'Contacto do Cliente' },
    { key: 'client_email', label: 'Email do Cliente' },
    { key: 'client_iban', label: 'IBAN do Cliente' },
    { key: 'address', label: 'Morada (Rua, Código Postal, Localidade)' },
    { key: 'installation_address', label: 'Morada de Instalação/Fornecimento' },
    { key: 'autoriza_documentos', label: 'Autoriza Documentos Pessoais' },
    { key: 'cpe_power', label: 'CPE / Potência' },
    { key: 'observations', label: 'Observações' },
  ],
};

const FormSection = ({ icon: Icon, title, children, gradient = "from-cyber-500 to-cyber-600" }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="space-y-4"
  >
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-10 h-10 bg-gradient-to-r ${gradient} rounded-lg flex items-center justify-center shadow-lg shadow-cyber-500/20`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <h3 className="text-lg font-bold text-white">{title}</h3>
    </div>
    <div className="space-y-4 pl-13">
      {children}
    </div>
  </motion.div>
);

const Operators = ({ user }) => {
  const location = useLocation();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [operators, setOperators] = useState([]);
  const [hiddenOperators, setHiddenOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [hiddenDialogOpen, setHiddenDialogOpen] = useState(false);
  const [commissionDialogOpen, setCommissionDialogOpen] = useState(false);
  const [editOperatorDialogOpen, setEditOperatorDialogOpen] = useState(false);
  const [selectedOperator, setSelectedOperator] = useState(null);
  const [editOperatorData, setEditOperatorData] = useState({
    activation_types: [],
    allowed_energy_types: [],
    allowed_client_types: [],
    pays_direct_debit: false,
    pays_electronic_invoice: false,
    requires_voltage_type: false,
    requires_additional_services: false,
    requires_email: false,
    additional_services_list: [],
    notification_emails: [],
    notification_user_ids: [],
    email_fields: null,
    email_envio: '',
    email_envio_password: '',
  });
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [newNotifEmail, setNewNotifEmail] = useState("");
  const [newServiceName, setNewServiceName] = useState("");
  const [adminBoUsers, setAdminBoUsers] = useState([]);
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
    setLoading(true);
    fetchOperators();
  }, [location.pathname]);

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
    const ok = await confirm({
      title: 'Eliminar operadora',
      description: `Tem a certeza que deseja eliminar "${operatorName}"? Esta acao nao pode ser revertida.`,
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;

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

  const openEditOperatorDialog = async (operator) => {
    try {
      const [freshData, usersResult] = await Promise.all([
        operatorsService.getById(operator.id),
        supabase.from('users').select('id, name, email, role').in('role', ['admin', 'bo']).order('role').order('name')
      ]);
      setSelectedOperator(freshData);
      setAdminBoUsers(usersResult.data || []);
      const availableFields = EMAIL_FIELDS_BY_SCOPE[freshData.scope] || [];
      const allFieldKeys = availableFields.map(f => f.key);
      const savedFields = freshData.email_fields;
      const initialEmailFields = savedFields !== null && savedFields !== undefined
        ? savedFields
        : allFieldKeys;
      setEditOperatorData({
        activation_types: freshData.activation_types || [],
        allowed_energy_types: freshData.allowed_energy_types || [],
        allowed_sale_types: freshData.allowed_sale_types || ['normal', 'multiponto', 'multilocal'],
        allowed_client_types: freshData.allowed_client_types || ['particular', 'empresarial'],
        pays_direct_debit: freshData.pays_direct_debit || false,
        pays_electronic_invoice: freshData.pays_electronic_invoice || false,
        requires_voltage_type: freshData.requires_voltage_type || false,
        requires_additional_services: freshData.requires_additional_services || false,
        requires_email: freshData.requires_email || false,
        additional_services_list: freshData.additional_services_list || [],
        notification_emails: freshData.notification_emails || [],
        notification_user_ids: freshData.notification_user_ids || [],
        email_fields: initialEmailFields,
        email_envio: freshData.email_envio || '',
        email_envio_password: freshData.email_envio_password || '',
        refidelizacao_prazo: freshData.refidelizacao_prazo || '',
        refidelizacao_unidade: freshData.refidelizacao_unidade || 'dias',
      });
      setShowEmailPassword(false);
      setNewNotifEmail("");
      setNewServiceName("");
      setEditOperatorDialogOpen(true);
    } catch (error) {
      toast.error("Erro ao carregar dados da operadora");
    }
  };

  const handleEditOperatorSave = async () => {
    if (!selectedOperator) return;
    try {
      const updatePayload = { ...editOperatorData };
      if (selectedOperator.scope === 'energia') {
        const types = updatePayload.allowed_energy_types || [];
        if (types.includes('eletricidade') && types.includes('gas')) {
          updatePayload.energy_type = 'dual';
        } else if (types.includes('eletricidade')) {
          updatePayload.energy_type = 'eletricidade';
        } else if (types.includes('gas')) {
          updatePayload.energy_type = 'gas';
        } else {
          updatePayload.energy_type = null;
        }
      }
      await operatorsService.updateSettings(selectedOperator.id, updatePayload);
      toast.success("Configurações da operadora atualizadas!");
      setEditOperatorDialogOpen(false);
      setSelectedOperator(null);
      fetchOperators();
    } catch (error) {
      toast.error("Erro ao atualizar operadora");
    }
  };

  const toggleEditActivationType = (type) => {
    setEditOperatorData(prev => ({
      ...prev,
      activation_types: prev.activation_types.includes(type)
        ? prev.activation_types.filter(t => t !== type)
        : [...prev.activation_types, type]
    }));
  };

  const toggleEditEnergyType = (type) => {
    setEditOperatorData(prev => ({
      ...prev,
      allowed_energy_types: prev.allowed_energy_types.includes(type)
        ? prev.allowed_energy_types.filter(t => t !== type)
        : [...prev.allowed_energy_types, type]
    }));
  };

  const toggleEditClientType = (type) => {
    setEditOperatorData(prev => ({
      ...prev,
      allowed_client_types: prev.allowed_client_types.includes(type)
        ? prev.allowed_client_types.filter(t => t !== type)
        : [...prev.allowed_client_types, type]
    }));
  };

  const toggleEditSaleType = (type) => {
    setEditOperatorData(prev => ({
      ...prev,
      allowed_sale_types: prev.allowed_sale_types.includes(type)
        ? prev.allowed_sale_types.filter(t => t !== type)
        : [...prev.allowed_sale_types, type]
    }));
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
    const ok = await confirm({
      title: 'Eliminar documento',
      description: 'Tem a certeza que deseja eliminar este documento?',
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;

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

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-cyber-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      {confirmDialog}
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-white">Operadoras</h1>
          {hiddenOperators.length > 0 && (
            <Button
              onClick={() => setHiddenDialogOpen(true)}
              variant="outline"
              size="sm"
              className="text-slate-300 border-dark-700 hover:border-cyber-500/30 hover:text-cyber-400 bg-transparent"
            >
              Ver Desativadas ({hiddenOperators.length})
            </Button>
          )}
        </div>
        {user?.role === 'admin' && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="bg-gradient-to-r from-cyber-500 to-cyber-600 hover:from-cyber-400 hover:to-cyber-500 text-white font-semibold shadow-lg shadow-cyber-500/20">
                <Plus className="w-4 h-4 mr-2" />Nova Operadora
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden bg-dark-850 border border-cyber-500/10 flex flex-col p-0">
              <div className="sticky top-0 z-10 bg-dark-850 border-b border-white/[0.06] px-8 py-6">
                <DialogHeader>
                  <DialogTitle className="text-3xl font-bold text-cyber-400">Nova Operadora</DialogTitle>
                  <p className="text-sm text-slate-400 mt-1">Preencha os dados da nova operadora no sistema</p>
                </DialogHeader>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                <div className="overflow-y-auto flex-1 px-8 py-6 scrollbar-modern">
                  <div className="space-y-8">
                    <FormSection icon={Building2} title="Informações Gerais" gradient="from-cyber-500 to-cyber-600">
                      <div className="grid grid-cols-1 gap-6">
                        <div>
                          <Label className="text-sm font-semibold mb-2 text-white">Nome *</Label>
                          <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required className="bg-dark-900 text-white border-dark-700 focus:border-cyber-500 focus:ring-2 focus:ring-cyber-500/20 rounded-xl placeholder:text-slate-500" />
                        </div>
                        <div>
                          <Label className="text-sm font-semibold mb-2 text-white">Âmbito *</Label>
                          <Select value={formData.scope} onValueChange={(v) => setFormData({...formData, scope: v, energy_type: '', allowed_energy_types: v === 'energia' ? ['eletricidade', 'gas'] : []})}>
                            <SelectTrigger className="bg-dark-900 text-white border-dark-700 focus:border-cyber-500 focus:ring-2 focus:ring-cyber-500/20 rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-dark-850 border-dark-700">
                              <SelectItem value="telecomunicacoes">Telecomunicações</SelectItem>
                              <SelectItem value="energia">Energia</SelectItem>
                              <SelectItem value="solar">Solar</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </FormSection>

                    {formData.scope === 'telecomunicacoes' && (
                      <FormSection icon={Settings} title="Tipos de Ativação" gradient="from-cyber-500 to-cyber-600">
                        <div className="grid grid-cols-1 gap-6">
                          <div>
                            <Label className="text-sm font-semibold mb-2 text-white">Tipos de Ativação Permitidos *</Label>
                            <div className="mt-2 space-y-2">
                              {['M2', 'M3', 'M4'].map(type => (
                                <div key={type} className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    id={`activation-${type}`}
                                    checked={formData.activation_types.includes(type)}
                                    onChange={() => toggleActivationType(type)}
                                    className="w-4 h-4 rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900"
                                  />
                                  <Label htmlFor={`activation-${type}`} className="cursor-pointer font-normal text-slate-300">{type}</Label>
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Selecione os tipos de ativação permitidos (M2, M3, M4)</p>
                          </div>
                        </div>
                      </FormSection>
                    )}

                    <FormSection icon={Building2} title="Tipos de Cliente" gradient="from-cyber-500 to-cyber-600">
                      <div className="grid grid-cols-1 gap-6">
                        <div>
                          <Label className="text-sm font-semibold mb-2 text-white">Tipos de Cliente Permitidos *</Label>
                          <div className="mt-2 space-y-2">
                            {['particular', 'empresarial'].map(type => (
                              <div key={type} className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id={`client-${type}`}
                                  checked={formData.allowed_client_types.includes(type)}
                                  onChange={() => toggleClientType(type)}
                                  className="w-4 h-4 rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900"
                                />
                                <Label htmlFor={`client-${type}`} className="cursor-pointer font-normal capitalize text-slate-300">{type}</Label>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-slate-500 mt-1">Selecione pelo menos um tipo</p>
                        </div>
                      </div>
                    </FormSection>

                    {formData.scope === 'energia' && (
                      <FormSection icon={Zap} title="Tipos de Energia" gradient="from-cyber-500 to-cyber-600">
                        <div className="grid grid-cols-1 gap-6">
                          <div>
                            <Label className="text-sm font-semibold mb-2 text-white">Tipos de Energia Permitidos *</Label>
                            <div className="mt-2 space-y-2">
                              {['eletricidade', 'gas'].map(type => (
                                <div key={type} className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    id={`energy-${type}`}
                                    checked={formData.allowed_energy_types.includes(type)}
                                    onChange={() => toggleEnergyType(type)}
                                    className="w-4 h-4 rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900"
                                  />
                                  <Label htmlFor={`energy-${type}`} className="cursor-pointer font-normal capitalize text-slate-300">{type}</Label>
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Selecione pelo menos um tipo. As comissões serão configuradas separadamente para cada tipo.</p>
                          </div>
                        </div>
                      </FormSection>
                    )}

                    {formData.scope === 'solar' && (
                      <FormSection icon={DollarSign} title="Modo de Comissão" gradient="from-cyber-500 to-cyber-600">
                        <div className="grid grid-cols-1 gap-6">
                          <div>
                            <Label className="text-sm font-semibold mb-2 text-white">Modo de Comissão *</Label>
                            <Select value={formData.commission_mode} onValueChange={(v) => setFormData({...formData, commission_mode: v})}>
                              <SelectTrigger className="bg-dark-900 text-white border-dark-700 focus:border-cyber-500 focus:ring-2 focus:ring-cyber-500/20 rounded-xl"><SelectValue /></SelectTrigger>
                              <SelectContent className="bg-dark-850 border-dark-700">
                                <SelectItem value="tier">Por Patamares</SelectItem>
                                <SelectItem value="manual">Definida ao Contrato</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-slate-500 mt-1">
                              {formData.commission_mode === 'tier'
                                ? 'Comissões calculadas automaticamente por patamares'
                                : 'Comissão definida manualmente na edição de cada venda'}
                            </p>
                          </div>
                        </div>
                      </FormSection>
                    )}

                    <FormSection icon={CreditCard} title="Serviços Adicionais" gradient="from-cyber-500 to-cyber-600">
                      <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="pays_direct_debit"
                              checked={formData.pays_direct_debit}
                              onChange={(e) => setFormData({...formData, pays_direct_debit: e.target.checked})}
                              className="w-4 h-4 rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900"
                            />
                            <Label htmlFor="pays_direct_debit" className="cursor-pointer font-normal text-slate-300">
                              Paga adesão a Débito Direto
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="pays_electronic_invoice"
                              checked={formData.pays_electronic_invoice}
                              onChange={(e) => setFormData({...formData, pays_electronic_invoice: e.target.checked})}
                              className="w-4 h-4 rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900"
                            />
                            <Label htmlFor="pays_electronic_invoice" className="cursor-pointer font-normal text-slate-300">
                              Paga adesão a Fatura Eletrónica
                            </Label>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500">
                          Os valores para estes serviços são definidos na configuração de patamares
                        </p>
                      </div>
                    </FormSection>
                  </div>
                </div>

                <div className="sticky bottom-0 bg-dark-850 border-t border-white/[0.06] px-8 py-4">
                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="border-dark-700 text-slate-300 hover:bg-dark-800 hover:border-cyber-500/30 bg-transparent">
                      Cancelar
                    </Button>
                    <Button type="submit" className="bg-gradient-to-r from-cyber-500 to-cyber-600 hover:from-cyber-400 hover:to-cyber-500 text-white font-semibold shadow-lg shadow-cyber-500/20">
                      Criar Operadora
                    </Button>
                  </div>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Operator Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {['telecomunicacoes', 'energia', 'solar'].map(scope => (
          <motion.div
            key={scope}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-dark-850 border border-white/[0.06] rounded-xl p-6 hover:border-cyber-500/30 transition-all duration-300"
          >
            <h2 className="text-xl font-semibold mb-4 capitalize text-white">{scope}</h2>
            <div className="space-y-2">
              {operators.filter(op => op.scope === scope).map(op => (
                <motion.div
                  key={op.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-between p-3 bg-dark-900 border border-dark-700 rounded-xl hover:border-cyber-500/30 transition-all duration-200"
                >
                  <div>
                    <span className="text-white font-semibold block">{op.name}</span>
                    {op.scope === 'energia' && op.energy_type && (
                      <span className="text-xs block text-slate-400">
                        {op.energy_type === 'eletricidade' ? '⚡ Eletricidade' :
                         op.energy_type === 'gas' ? '🔥 Gás' :
                         '⚡🔥 Dual'}
                      </span>
                    )}
                    {op.commission_config && Object.keys(op.commission_config).length > 0 && (
                      <span className="text-xs text-green-400 block">✓ Comissões configuradas</span>
                    )}
                    {op.documents && op.documents.length > 0 && (
                      <span className="text-xs text-cyber-400 block">📄 {op.documents.length} formulário(s)</span>
                    )}
                    {op.notification_emails && op.notification_emails.length > 0 && (
                      <span className="text-xs text-cyber-300 block">✉ {op.notification_emails.length} email(s) notificação</span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {user?.role === 'admin' && (
                      <>
                        <Button onClick={() => openEditOperatorDialog(op)} size="sm" variant="ghost" title="Editar Configurações" className="text-slate-400 hover:text-cyber-400 hover:bg-cyber-500/10">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button onClick={() => openCommissionConfig(op)} size="sm" variant="ghost" title="Configurar Comissões" className="text-slate-400 hover:text-cyber-400 hover:bg-cyber-500/10">
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button onClick={() => handleDelete(op.id, op.name)} size="sm" variant="ghost" title="Eliminar" className="text-red-400 hover:bg-red-500/10">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    {(user?.role === 'admin' || user?.role === 'bo') && (
                      <>
                        <Button onClick={() => openUploadDialog(op)} size="sm" variant="ghost" title="Gerir Formulários" className="text-slate-400 hover:text-cyber-400 hover:bg-cyber-500/10">
                          <Upload className="w-4 h-4" />
                        </Button>
                        <Button onClick={() => toggleVisibility(op.id)} size="sm" variant="ghost" title={op.hidden ? "Mostrar" : "Ocultar"} className="text-slate-400 hover:text-cyber-400 hover:bg-cyber-500/10">
                          {op.hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
              {operators.filter(op => op.scope === scope).length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">Nenhuma operadora</p>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-2xl bg-dark-850 border border-cyber-500/10">
          <DialogHeader>
            <DialogTitle className="text-2xl text-white">
              Gerir Formulários - {selectedOperator?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            <div>
              <Label className="text-slate-300">Adicionar Novos Formulários (PDF)</Label>
              <Input
                type="file"
                accept=".pdf"
                multiple
                onChange={(e) => setUploadFiles(Array.from(e.target.files))}
                className="mt-2 bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-slate-300 file:text-cyber-400 file:bg-dark-800 file:border-0 file:mr-3 file:px-3 file:py-1 file:rounded-lg"
              />
              {uploadFiles.length > 0 && (
                <p className="text-sm text-slate-400 mt-2">
                  {uploadFiles.length} ficheiro(s) selecionado(s)
                </p>
              )}
              <Button
                onClick={handleUpload}
                disabled={uploading || uploadFiles.length === 0}
                className="mt-3 bg-gradient-to-r from-cyber-500 to-cyber-600 hover:from-cyber-400 hover:to-cyber-500 text-white font-semibold shadow-lg shadow-cyber-500/20 disabled:opacity-50"
              >
                {uploading ? "A enviar..." : "Enviar Ficheiros"}
              </Button>
            </div>

            <div>
              <Label className="text-slate-300">Formulários Existentes</Label>
              {selectedOperator?.documents && selectedOperator.documents.length > 0 ? (
                <div className="space-y-2 mt-2">
                  {selectedOperator.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-dark-900 border border-dark-700 rounded-xl hover:border-cyber-500/30 transition-all duration-200">
                      <div className="flex items-center gap-2">
                        <span className="text-cyber-400">📄</span>
                        <span className="text-white font-semibold">{doc.filename}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDownloadDocument(selectedOperator.id, doc.id, doc.filename)}
                          title="Descarregar"
                          className="text-slate-400 hover:text-cyber-400 hover:bg-cyber-500/10"
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
                <p className="text-sm mt-2 text-slate-500">Nenhum formulário disponível</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden Operators Dialog */}
      <Dialog open={hiddenDialogOpen} onOpenChange={setHiddenDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-dark-850 border border-cyber-500/10">
          <DialogHeader>
            <DialogTitle className="text-2xl text-white">Operadoras Desativadas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {hiddenOperators.length === 0 ? (
              <p className="text-center py-8 text-slate-500">Nenhuma operadora desativada</p>
            ) : (
              <div className="space-y-3">
                {hiddenOperators.map(op => (
                  <div key={op.id} className="flex items-center justify-between p-4 bg-dark-900 border border-dark-700 rounded-xl hover:border-cyber-500/30 transition-all duration-200">
                    <div>
                      <span className="text-white font-semibold block">{op.name}</span>
                      <span className="text-sm capitalize text-slate-400">{op.scope}</span>
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
                          className="text-green-400 border-green-500/30 hover:bg-green-500/10 bg-transparent"
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
                          className="text-red-400 border-red-500/30 hover:bg-red-500/10 bg-transparent"
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

      {/* Commission Config Dialog */}
      <Dialog open={commissionDialogOpen} onOpenChange={setCommissionDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-dark-850 border border-cyber-500/10">
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

      {/* Edit Operator Dialog */}
      <Dialog open={editOperatorDialogOpen} onOpenChange={setEditOperatorDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden bg-dark-850 border border-cyber-500/10 flex flex-col p-0">
          <div className="sticky top-0 z-10 bg-dark-850 border-b border-white/[0.06] px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-2xl text-white">
                Editar Operadora - {selectedOperator?.name}
              </DialogTitle>
            </DialogHeader>
          </div>
          {selectedOperator && (
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {selectedOperator.scope === 'telecomunicacoes' && (
                <div>
                  <Label className="text-slate-300 text-sm font-semibold">Tipos de Ativação Permitidos</Label>
                  <div className="mt-2 space-y-2">
                    {['M2', 'M3', 'M4'].map(type => (
                      <div key={type} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`edit-activation-${type}`}
                          checked={editOperatorData.activation_types.includes(type)}
                          onChange={() => toggleEditActivationType(type)}
                          className="w-4 h-4 rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900"
                        />
                        <Label htmlFor={`edit-activation-${type}`} className="cursor-pointer font-normal text-slate-300">{type}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedOperator.scope === 'energia' && (
                <div>
                  <Label className="text-slate-300 text-sm font-semibold">Tipos de Energia Permitidos</Label>
                  <div className="mt-2 space-y-2">
                    {['eletricidade', 'gas'].map(type => (
                      <div key={type} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`edit-energy-${type}`}
                          checked={editOperatorData.allowed_energy_types.includes(type)}
                          onChange={() => toggleEditEnergyType(type)}
                          className="w-4 h-4 rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900"
                        />
                        <Label htmlFor={`edit-energy-${type}`} className="cursor-pointer font-normal capitalize text-slate-300">{type}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedOperator.scope === 'energia' && (
                <div>
                  <Label className="text-slate-300 text-sm font-semibold">Tipos de Venda Permitidos</Label>
                  <p className="text-xs text-slate-500 mt-0.5 mb-2">Selecione quais os tipos de venda disponíveis para esta operadora</p>
                  <div className="mt-2 space-y-2">
                    {[
                      { value: 'normal', label: 'Venda Normal' },
                      { value: 'multiponto', label: 'Multiponto' },
                      { value: 'multilocal', label: 'Multilocal' },
                    ].map(({ value, label }) => (
                      <div key={value} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`edit-sale-type-${value}`}
                          checked={editOperatorData.allowed_sale_types.includes(value)}
                          onChange={() => toggleEditSaleType(value)}
                          className="w-4 h-4 rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900"
                        />
                        <Label htmlFor={`edit-sale-type-${value}`} className="cursor-pointer font-normal text-slate-300">{label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label className="text-slate-300 text-sm font-semibold">Tipos de Cliente Permitidos</Label>
                <div className="mt-2 space-y-2">
                  {['particular', 'empresarial'].map(type => (
                    <div key={type} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`edit-client-${type}`}
                        checked={editOperatorData.allowed_client_types.includes(type)}
                        onChange={() => toggleEditClientType(type)}
                        className="w-4 h-4 rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900"
                      />
                      <Label htmlFor={`edit-client-${type}`} className="cursor-pointer font-normal capitalize text-slate-300">{type}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-dark-700 pt-4">
                <Label className="text-slate-300 text-sm font-semibold block mb-3">Serviços Adicionais</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="edit_pays_direct_debit"
                      checked={editOperatorData.pays_direct_debit}
                      onChange={(e) => setEditOperatorData(prev => ({ ...prev, pays_direct_debit: e.target.checked }))}
                      className="w-4 h-4 rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900"
                    />
                    <Label htmlFor="edit_pays_direct_debit" className="cursor-pointer font-normal text-slate-300">
                      Paga adesão a Débito Direto
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="edit_pays_electronic_invoice"
                      checked={editOperatorData.pays_electronic_invoice}
                      onChange={(e) => setEditOperatorData(prev => ({ ...prev, pays_electronic_invoice: e.target.checked }))}
                      className="w-4 h-4 rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900"
                    />
                    <Label htmlFor="edit_pays_electronic_invoice" className="cursor-pointer font-normal text-slate-300">
                      Paga adesão a Fatura Eletrónica
                    </Label>
                  </div>
                </div>
              </div>

              <div className="border-t border-dark-700 pt-4">
                <Label className="text-slate-300 text-sm font-semibold block mb-1">Tempo de Intervenção com Cliente</Label>
                <p className="text-xs text-slate-500 mb-3">Número de dias ou meses após a ativação a partir dos quais o cliente pode ser contactado para refidelização. Deixe vazio para não gerar alertas de refidelização.</p>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <Label htmlFor="edit_refidelizacao_prazo" className="text-slate-400 text-xs mb-1 block">Prazo</Label>
                    <Input
                      id="edit_refidelizacao_prazo"
                      type="number"
                      min="1"
                      placeholder="Ex: 30"
                      value={editOperatorData.refidelizacao_prazo}
                      onChange={(e) => setEditOperatorData(prev => ({ ...prev, refidelizacao_prazo: e.target.value ? parseInt(e.target.value) : '' }))}
                      className="bg-dark-900 border-dark-700 text-white"
                    />
                  </div>
                  <div className="w-36">
                    <Label className="text-slate-400 text-xs mb-1 block">Unidade</Label>
                    <Select
                      value={editOperatorData.refidelizacao_unidade}
                      onValueChange={(v) => setEditOperatorData(prev => ({ ...prev, refidelizacao_unidade: v }))}
                    >
                      <SelectTrigger className="bg-dark-900 border-dark-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-dark-800 border-dark-700">
                        <SelectItem value="dias" className="text-white hover:bg-dark-700">Dias</SelectItem>
                        <SelectItem value="meses" className="text-white hover:bg-dark-700">Meses</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="border-t border-dark-700 pt-4">
                <Label className="text-slate-300 text-sm font-semibold block mb-1">Campos do Formulário de Venda</Label>
                <p className="text-xs text-slate-500 mb-3">Selecione os campos adicionais a pedir no formulário de nova venda.</p>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="edit_requires_voltage_type"
                      checked={editOperatorData.requires_voltage_type}
                      onChange={(e) => setEditOperatorData(prev => ({ ...prev, requires_voltage_type: e.target.checked }))}
                      className="w-4 h-4 rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900"
                    />
                    <Label htmlFor="edit_requires_voltage_type" className="cursor-pointer font-normal text-slate-300">
                      Requer Tipo de Tensão (Monofásico / Trifásico)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="edit_requires_email"
                      checked={editOperatorData.requires_email}
                      onChange={(e) => setEditOperatorData(prev => ({ ...prev, requires_email: e.target.checked }))}
                      className="w-4 h-4 rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900"
                    />
                    <Label htmlFor="edit_requires_email" className="cursor-pointer font-normal text-slate-300">
                      Requer Email do Cliente
                    </Label>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="edit_requires_additional_services"
                        checked={editOperatorData.requires_additional_services}
                        onChange={(e) => setEditOperatorData(prev => ({ ...prev, requires_additional_services: e.target.checked }))}
                        className="w-4 h-4 rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900"
                      />
                      <Label htmlFor="edit_requires_additional_services" className="cursor-pointer font-normal text-slate-300">
                        Ativar Serviços Adicionais
                      </Label>
                    </div>
                    {editOperatorData.requires_additional_services && (
                      <div className="ml-6 space-y-2">
                        <p className="text-xs text-slate-500">Adicione os serviços adicionais disponíveis para esta operadora. Aparecerão como picklist na criação de venda.</p>
                        {(editOperatorData.additional_services_list || []).map((service, idx) => {
                          const svc = typeof service === 'string' ? { name: service, applies_to: 'todos' } : service;
                          const isEnergia = selectedOperator?.scope === 'energia';
                          return (
                            <div key={idx} className="flex items-center gap-2 bg-dark-900 border border-dark-700 rounded-lg px-3 py-2">
                              <span className="text-sm text-white flex-1 truncate">{svc.name}</span>
                              {isEnergia && (
                                <select
                                  value={svc.applies_to || 'todos'}
                                  onChange={(e) => setEditOperatorData(prev => ({
                                    ...prev,
                                    additional_services_list: prev.additional_services_list.map((s, i) => {
                                      if (i !== idx) return s;
                                      const base = typeof s === 'string' ? { name: s } : { ...s };
                                      return { ...base, applies_to: e.target.value };
                                    })
                                  }))}
                                  className="text-xs bg-dark-800 border border-dark-600 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-cyber-500 shrink-0"
                                >
                                  <option value="todos">Todos</option>
                                  <option value="eletricidade">Eletricidade</option>
                                  <option value="gas">Gás</option>
                                  <option value="dual">Dual</option>
                                </select>
                              )}
                              <button
                                type="button"
                                onClick={() => setEditOperatorData(prev => ({
                                  ...prev,
                                  additional_services_list: prev.additional_services_list.filter((_, i) => i !== idx)
                                }))}
                                className="text-red-400 hover:text-red-300 shrink-0"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}
                        <div className="flex gap-2">
                          <Input
                            type="text"
                            placeholder="Nome do serviço adicional"
                            value={newServiceName}
                            onChange={(e) => setNewServiceName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const name = newServiceName.trim();
                                const existing = (editOperatorData.additional_services_list || []).map(s => typeof s === 'string' ? s : s.name);
                                if (name && !existing.includes(name)) {
                                  setEditOperatorData(prev => ({
                                    ...prev,
                                    additional_services_list: [...(prev.additional_services_list || []), { name, applies_to: 'todos' }]
                                  }));
                                  setNewServiceName("");
                                }
                              }
                            }}
                            className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white placeholder:text-slate-500 flex-1"
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              const name = newServiceName.trim();
                              const existing = (editOperatorData.additional_services_list || []).map(s => typeof s === 'string' ? s : s.name);
                              if (name && !existing.includes(name)) {
                                setEditOperatorData(prev => ({
                                  ...prev,
                                  additional_services_list: [...(prev.additional_services_list || []), { name, applies_to: 'todos' }]
                                }));
                                setNewServiceName("");
                              }
                            }}
                            className="bg-gradient-to-r from-cyber-500 to-cyber-600 hover:from-cyber-400 hover:to-cyber-500 text-white shadow-lg shadow-cyber-500/20"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {(EMAIL_FIELDS_BY_SCOPE[selectedOperator.scope] || []).length > 0 && (
                <div className="border-t border-dark-700 pt-4">
                  <Label className="text-slate-300 text-sm font-semibold block mb-1">
                    <FileText className="w-4 h-4 inline mr-1 text-cyber-400" />
                    Campos no Email de Nova Venda
                  </Label>
                  <p className="text-xs text-slate-500 mb-3">
                    Nome e NIF do cliente sao sempre incluidos. Selecione os campos adicionais a mostrar no email.
                  </p>
                  <div className="space-y-2">
                    {(EMAIL_FIELDS_BY_SCOPE[selectedOperator.scope] || []).map(field => {
                      const checked = Array.isArray(editOperatorData.email_fields) && editOperatorData.email_fields.includes(field.key);
                      return (
                        <div key={field.key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`email-field-${field.key}`}
                            checked={checked}
                            onChange={() => setEditOperatorData(prev => {
                              const current = Array.isArray(prev.email_fields) ? prev.email_fields : [];
                              return {
                                ...prev,
                                email_fields: checked
                                  ? current.filter(k => k !== field.key)
                                  : [...current, field.key]
                              };
                            })}
                            className="w-4 h-4 rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900"
                          />
                          <Label htmlFor={`email-field-${field.key}`} className="cursor-pointer font-normal text-slate-300">{field.label}</Label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="border-t border-dark-700 pt-4">
                <Label className="text-slate-300 text-sm font-semibold block mb-3">
                  <Users className="w-4 h-4 inline mr-1 text-cyber-400" />
                  Admins / Backoffice com Alertas de Email
                </Label>
                <p className="text-xs text-slate-500 mb-3">
                  Selecione quais admins e backoffice recebem emails de alerta para esta operadora. Se nenhum for selecionado, todos receberao (comportamento padrao).
                </p>
                <div className="space-y-2 mb-1">
                  {adminBoUsers.map((u) => {
                    const checked = (editOperatorData.notification_user_ids || []).includes(u.id);
                    return (
                      <div
                        key={u.id}
                        onClick={() => setEditOperatorData(prev => ({
                          ...prev,
                          notification_user_ids: checked
                            ? prev.notification_user_ids.filter(id => id !== u.id)
                            : [...(prev.notification_user_ids || []), u.id]
                        }))}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer border transition-colors ${checked ? 'bg-cyber-500/10 border-cyber-500/40' : 'bg-dark-900 border-dark-700 hover:border-dark-600'}`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-cyber-500 border-cyber-500' : 'border-dark-600 bg-dark-800'}`}>
                          {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{u.name}</p>
                          <p className="text-xs text-slate-500 truncate">{u.email}</p>
                        </div>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${u.role === 'admin' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                          {u.role === 'admin' ? 'Admin' : 'BO'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-dark-700 pt-4">
                <Label className="text-slate-300 text-sm font-semibold block mb-3">
                  <Mail className="w-4 h-4 inline mr-1 text-blue-400" />
                  Email de Envio das Vendas
                </Label>
                <p className="text-xs text-slate-500 mb-3">
                  Email utilizado para envio das notificações de vendas desta operadora. Apenas o prefixo (@mpgrupo.pt é fixo). Se não configurado, será usado info@mpgrupo.pt.
                </p>
                <div className="grid grid-cols-1 gap-3 mb-3">
                  <div>
                    <Label className="text-xs text-slate-400 mb-1 block">Prefixo do Email de Envio</Label>
                    <div className="flex items-center gap-0">
                      <Input
                        type="text"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
                        placeholder="info"
                        value={editOperatorData.email_envio || ''}
                        onChange={(e) => {
                          const val = e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '');
                          setEditOperatorData(prev => ({ ...prev, email_envio: val }));
                        }}
                        className="bg-dark-900 border-dark-700 focus:border-blue-500 focus:ring-blue-500/20 text-white placeholder:text-slate-500 rounded-r-none border-r-0 flex-1"
                      />
                      <span className="bg-dark-800 border border-dark-700 text-slate-400 text-sm px-3 py-2 rounded-r-lg whitespace-nowrap border-l-0">
                        @mpgrupo.pt
                      </span>
                    </div>
                    {editOperatorData.email_envio && (
                      <p className="text-xs text-blue-400 mt-1">Email de envio: {editOperatorData.email_envio}@mpgrupo.pt</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400 mb-1 block">Password do Email de Envio</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type={showEmailPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Password do email"
                        value={editOperatorData.email_envio_password || ''}
                        onChange={(e) => setEditOperatorData(prev => ({ ...prev, email_envio_password: e.target.value }))}
                        className="bg-dark-900 border-dark-700 focus:border-blue-500 focus:ring-blue-500/20 text-white placeholder:text-slate-500 flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEmailPassword(v => !v)}
                        className="text-slate-400 hover:text-white p-2"
                      >
                        {showEmailPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                {editOperatorData.email_envio && !editOperatorData.email_envio_password && (
                  <p className="text-xs text-amber-400 mb-3">Defina a password para ativar o email de envio personalizado.</p>
                )}
              </div>

              <div className="border-t border-dark-700 pt-4">
                <Label className="text-slate-300 text-sm font-semibold block mb-3">
                  <Mail className="w-4 h-4 inline mr-1 text-cyber-400" />
                  Emails de Notificacao de Vendas
                </Label>
                <p className="text-xs text-slate-500 mb-3">
                  Estes emails receberao notificacao de novas vendas desta operadora em BCC.
                </p>
                <div className="space-y-2 mb-3">
                  {(editOperatorData.notification_emails || []).map((email, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-dark-900 border border-dark-700 rounded-lg px-3 py-2">
                      <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="text-sm text-white flex-1 truncate">{email}</span>
                      <button
                        type="button"
                        onClick={() => setEditOperatorData(prev => ({
                          ...prev,
                          notification_emails: prev.notification_emails.filter((_, i) => i !== idx)
                        }))}
                        className="text-red-400 hover:text-red-300 shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="email@exemplo.pt"
                    value={newNotifEmail}
                    onChange={(e) => setNewNotifEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const email = newNotifEmail.trim();
                        if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                          if (!editOperatorData.notification_emails.includes(email)) {
                            setEditOperatorData(prev => ({
                              ...prev,
                              notification_emails: [...prev.notification_emails, email]
                            }));
                          }
                          setNewNotifEmail("");
                        }
                      }
                    }}
                    className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white placeholder:text-slate-500 flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      const email = newNotifEmail.trim();
                      if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                        if (!editOperatorData.notification_emails.includes(email)) {
                          setEditOperatorData(prev => ({
                            ...prev,
                            notification_emails: [...prev.notification_emails, email]
                          }));
                        }
                        setNewNotifEmail("");
                      } else {
                        toast.error("Email invalido");
                      }
                    }}
                    className="bg-gradient-to-r from-cyber-500 to-cyber-600 hover:from-cyber-400 hover:to-cyber-500 text-white shadow-lg shadow-cyber-500/20"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

            </div>
          )}
          <div className="sticky bottom-0 bg-dark-850 border-t border-dark-700 px-6 py-4 flex justify-end gap-2">
            <Button type="button" onClick={() => setEditOperatorDialogOpen(false)} variant="outline" className="border-dark-700 text-slate-300 hover:bg-dark-800 hover:border-cyber-500/30 bg-transparent">
              Cancelar
            </Button>
            <Button onClick={handleEditOperatorSave} className="bg-gradient-to-r from-cyber-500 to-cyber-600 hover:from-cyber-400 hover:to-cyber-500 text-white font-semibold shadow-lg shadow-cyber-500/20">
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Operators;
