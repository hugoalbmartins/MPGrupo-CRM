import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { TriangleAlert as AlertTriangle, Clock, Building2, User, Phone, MapPin, CreditCard, FileText, DollarSign, Zap, Paperclip, Upload, X, Download, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { chargebackService } from "@/services/chargebackService";

const CVP_REGEX = /^(\d{7}[A-Za-z]{4}\d{1}|\d{12})$/;
function validateCVP(value) {
  if (!value) return true;
  return CVP_REGEX.test(value);
}
const FIX_OPERATORS = ["MEO", "Vodafone", "NOS", "Digi", "Outro"];

const POWER_OPTIONS = ["1.15kVA", "2.3kVA", "3.45kVA", "4.6kVA", "5.75kVA", "6.9kVA", "10.35kVA", "13.8kVA", "17.25kVA", "20.7kVA", "27.6kVA", "34.5kVA", "41.4kVA", "Outros"];

const FormSection = ({ icon: Icon, title, children, gradient = "from-cyber-500 to-cyber-600" }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="space-y-4"
  >
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-10 h-10 bg-gradient-to-r ${gradient} rounded-lg flex items-center justify-center shadow-lg`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <h3 className="text-lg font-bold text-white">{title}</h3>
    </div>
    <div className="space-y-4">
      {children}
    </div>
  </motion.div>
);

const FieldGroup = ({ label, children, colSpan, hint, locked }) => (
  <div className={colSpan === 2 ? "col-span-1 sm:col-span-2" : ""}>
    <Label className={locked ? "text-sm text-slate-500" : "text-sm font-semibold mb-2 text-slate-400"}>{label}</Label>
    {children}
    {hint && <p className="text-xs mt-1 text-slate-500">{hint}</p>}
  </div>
);

const SaleEditDialog = ({
  open,
  onOpenChange,
  editingSale,
  editFormData,
  setEditFormData,
  onSubmit,
  partners,
  operators,
  user,
  onAttachmentsChanged,
}) => {
  const fileInputRef = useRef(null);

  const update = (field, value) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
  };

  const isAddressEditable = (fieldName) => {
    if (user?.role === 'admin' || user?.role === 'bo') return true;
    const originalValue = editingSale?.[fieldName];
    return !originalValue || originalValue === '';
  };

  const handleAddFiles = async (e) => {
    const MAX_SIZE = 15 * 1024 * 1024;
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const oversized = files.filter(f => f.size > MAX_SIZE);
    if (oversized.length > 0) {
      toast.error(`Ficheiro(s) excedem o limite de 15MB: ${oversized.map(f => f.name).join(', ')}`);
      e.target.value = '';
      return;
    }

    const saleId = editingSale?.id;
    if (!saleId) return;

    const { data: { user: authUser } } = await supabase.auth.getUser();
    const newAttachments = [];

    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const randomId = crypto.randomUUID();
      const fileName = `${saleId}_${Date.now()}_${randomId}.${fileExt}`;
      const filePath = `${saleId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('sales-documents')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) {
        toast.error(`Erro ao carregar ${file.name}`);
        continue;
      }

      newAttachments.push({
        id: randomId,
        filename: file.name,
        path: filePath,
        uploaded_at: new Date().toISOString(),
        uploaded_by: authUser?.id || null,
      });
    }

    if (newAttachments.length > 0) {
      const existing = editFormData.attachments || [];
      const updated = [...existing, ...newAttachments];
      setEditFormData(prev => ({ ...prev, attachments: updated }));
      if (onAttachmentsChanged) onAttachmentsChanged(updated);
      toast.success(`${newAttachments.length} ficheiro(s) adicionado(s)`);
    }

    e.target.value = '';
  };

  const handleRemoveAttachment = async (att) => {
    if (att.expired) return;
    if (att.path) {
      await supabase.storage.from('sales-documents').remove([att.path]);
    }
    const updated = (editFormData.attachments || []).filter(a => a.id !== att.id);
    setEditFormData(prev => ({ ...prev, attachments: updated }));
    if (onAttachmentsChanged) onAttachmentsChanged(updated);
  };

  const handleDownload = async (att) => {
    try {
      const { data, error } = await supabase.storage.from('sales-documents').download(att.path);
      if (error) throw error;
      const url = window.URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = att.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Erro ao transferir ficheiro');
    }
  };

  const [chargebackDialogOpen, setChargebackDialogOpen] = useState(false);
  const [chargebackForm, setChargebackForm] = useState({ reason: '', reason_date: '', percentage: 100 });
  const [chargebackPaidReport, setChargebackPaidReport] = useState(null);
  const [savingChargeback, setSavingChargeback] = useState(false);

  const saleOperator = operators.find(op => op.id === editFormData.operator_id);
  const canEditCommission = user?.role === 'admin';
  const hasAutomaticCommission = saleOperator?.commission_mode !== 'manual' && editFormData.scope !== 'solar';
  const commissionChanged = editFormData.manual_commission !== (editingSale?.manual_commission || '');
  const isRefid = editFormData.service_type === 'REFID' || editFormData.service_type === 'Refid';

  const openChargebackDialog = async () => {
    setChargebackForm({ reason: '', reason_date: '', percentage: 100 });
    setChargebackPaidReport(null);
    try {
      const paidReport = await chargebackService.checkSaleInPaidReport(editingSale?.id);
      setChargebackPaidReport(paidReport);
    } catch {}
    setChargebackDialogOpen(true);
  };

  const handleSaveChargeback = async () => {
    if (!chargebackForm.reason.trim()) { toast.error('Motivo é obrigatório'); return; }
    if (!chargebackForm.reason_date) { toast.error('Data do motivo é obrigatória'); return; }
    if (!chargebackForm.percentage || chargebackForm.percentage <= 0 || chargebackForm.percentage > 100) {
      toast.error('Percentagem deve ser entre 1 e 100'); return;
    }
    setSavingChargeback(true);
    try {
      const commissionAmount = parseFloat(editingSale?.calculated_commission || editingSale?.manual_commission || 0);
      await chargebackService.create({
        saleId: editingSale.id,
        partnerId: editingSale.partner_id,
        reason: chargebackForm.reason,
        reasonDate: chargebackForm.reason_date,
        percentage: parseFloat(chargebackForm.percentage),
        commissionAmount,
        createdBy: user?.id,
      });
      toast.success('Chargeback registado com sucesso');
      setChargebackDialogOpen(false);
    } catch (err) {
      toast.error('Erro ao registar chargeback: ' + err.message);
    } finally {
      setSavingChargeback(false);
    }
  };

  const mobileNumbers = editFormData.mobile_numbers || [];
  const mobileCount = parseInt(editFormData.mobile_count) || 0;

  const updateMobileNumber = (index, field, value) => {
    const updated = [...mobileNumbers];
    if (!updated[index]) updated[index] = { number: '', ported: false, novo: false, cvp: '' };
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'novo' && value === true) {
      updated[index].number = '';
      updated[index].ported = false;
      updated[index].cvp = '';
    }
    if (field === 'ported' && value === true) {
      updated[index].novo = false;
    }
    update('mobile_numbers', updated);
  };

  const handleMobileCountChange = (v) => {
    const count = parseInt(v) || 0;
    const current = editFormData.mobile_numbers || [];
    const updated = [...current];
    while (updated.length < count) updated.push({ number: '', ported: false, novo: false, cvp: '' });
    setEditFormData(prev => ({ ...prev, mobile_count: count, mobile_numbers: updated.slice(0, count) }));
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden bg-dark-850 border border-cyber-500/10 flex flex-col p-0 min-w-0">
        <div className="sticky top-0 z-10 bg-dark-850 border-b border-dark-700 px-4 sm:px-8 py-4 sm:py-6">
          <DialogHeader>
            <DialogTitle className="text-3xl font-bold text-white">
              Editar Venda - {editingSale?.sale_code}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-400 mt-1">
              Altere os campos necessários da venda
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto flex-1 px-4 sm:px-8 py-6 scrollbar-modern overflow-x-hidden">
            <div className="space-y-8">
              <FormSection icon={User} title="Identificação do Cliente" gradient="from-cyber-500 to-cyber-600">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <FieldGroup label="Nome" locked>
                    <Input value={editFormData.client_name} disabled className="bg-dark-900 border-dark-700 text-white opacity-60 cursor-not-allowed" />
                  </FieldGroup>
                  <FieldGroup label="NIF" locked>
                    <Input value={editFormData.client_nif} disabled className="bg-dark-900 border-dark-700 text-white opacity-60 cursor-not-allowed" />
                  </FieldGroup>
                </div>
              </FormSection>

              <FormSection icon={Clock} title="Informações Gerais" gradient="from-cyber-500 to-cyber-600">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <FieldGroup label="Data da Venda *" hint="Data nao pode ser futura">
                    <Input
                      type="date"
                      value={editFormData.date}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => update('date', e.target.value)}
                      required
                      className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                    />
                  </FieldGroup>

                  <FieldGroup label="Status *">
                    <Select
                      value={editFormData.status}
                      onValueChange={(v) => {
                        const d = { ...editFormData, status: v };
                        if (v !== 'Ativo') { d.paid_to_operator = false; d.payment_date = ""; }
                        setEditFormData(d);
                      }}
                    >
                      <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Para registo">Para registo</SelectItem>
                        <SelectItem value="Pendente">Pendente</SelectItem>
                        <SelectItem value="Concluido">Concluido</SelectItem>
                        <SelectItem value="Ativo">Ativo</SelectItem>
                        <SelectItem value="Cancelado">Cancelado</SelectItem>
                        <SelectItem value="Em proposta">Em proposta</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldGroup>

                  <FieldGroup label="Parceiro *">
                    <Select
                      value={editFormData.partner_id || ""}
                      onValueChange={(v) => update('partner_id', v)}
                    >
                      <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {partners.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}{p.is_admin ? ' (Admin)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldGroup>

                  <FieldGroup label="Tipo de Cliente *">
                    <Select value={editFormData.client_type} onValueChange={(v) => update('client_type', v)}>
                      <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="particular">Particular</SelectItem>
                        <SelectItem value="empresarial">Empresarial</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldGroup>
                </div>
              </FormSection>

              <FormSection icon={Building2} title="Operadora" gradient="from-cyber-500 to-cyber-600">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <FieldGroup label="Operadora *" colSpan={2}>
                    <Select value={editFormData.operator_id} onValueChange={(v) => update('operator_id', v)}>
                      <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {operators.map(op => <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FieldGroup>
                </div>
              </FormSection>

              <FormSection icon={Phone} title="Contactos" gradient="from-cyber-500 to-cyber-600">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <FieldGroup label="Contacto *">
                    <Input
                      value={editFormData.client_contact}
                      onChange={(e) => update('client_contact', e.target.value)}
                      required
                      className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                    />
                  </FieldGroup>

                  <FieldGroup label="Email">
                    <Input
                      type="email"
                      value={editFormData.client_email}
                      onChange={(e) => update('client_email', e.target.value)}
                      className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                    />
                  </FieldGroup>

                  <FieldGroup label="IBAN" colSpan={2}>
                    <Input
                      value={editFormData.client_iban}
                      onChange={(e) => update('client_iban', e.target.value)}
                      className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                    />
                  </FieldGroup>
                </div>
              </FormSection>

              <FormSection icon={MapPin} title="Morada" gradient="from-cyber-500 to-cyber-600">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <FieldGroup label="Morada" colSpan={2} locked={!isAddressEditable('street')}>
                    <Input
                      value={editFormData.street || ''}
                      disabled={!isAddressEditable('street')}
                      onChange={(e) => update('street', e.target.value)}
                      placeholder="Rua, Avenida, numero, andar, etc."
                      className={!isAddressEditable('street') ? "bg-dark-900 border-dark-700 text-slate-500 opacity-60 cursor-not-allowed" : "bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"}
                    />
                  </FieldGroup>

                  <FieldGroup label="Codigo Postal" locked={!isAddressEditable('postal_code')}>
                    <Input
                      value={editFormData.postal_code || ''}
                      disabled={!isAddressEditable('postal_code')}
                      onChange={(e) => update('postal_code', e.target.value)}
                      placeholder="0000-000"
                      className={!isAddressEditable('postal_code') ? "bg-dark-900 border-dark-700 text-slate-500 opacity-60 cursor-not-allowed" : "bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"}
                    />
                  </FieldGroup>

                  <FieldGroup label="Localidade" locked={!isAddressEditable('locality')}>
                    <Input
                      value={editFormData.locality || ''}
                      disabled={!isAddressEditable('locality')}
                      onChange={(e) => update('locality', e.target.value)}
                      placeholder="Ex: Lisboa, Porto, etc."
                      className={!isAddressEditable('locality') ? "bg-dark-900 border-dark-700 text-slate-500 opacity-60 cursor-not-allowed" : "bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"}
                    />
                  </FieldGroup>

                  <FieldGroup label="Morada de Instalacao" colSpan={2} locked={!isAddressEditable('installation_address')}>
                    <Input
                      value={editFormData.installation_address || ''}
                      disabled={!isAddressEditable('installation_address')}
                      onChange={(e) => update('installation_address', e.target.value)}
                      placeholder="Se diferente da morada do cliente"
                      className={!isAddressEditable('installation_address') ? "bg-dark-900 border-dark-700 text-slate-500 opacity-60 cursor-not-allowed" : "bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"}
                    />
                  </FieldGroup>
                </div>
              </FormSection>

            {/* Telecom fields */}
            {editFormData.scope === 'telecomunicacoes' && (
              <FormSection icon={Phone} title="Detalhes Telecomunicações" gradient="from-cyber-500 to-cyber-600">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <FieldGroup label="Tipo de Servico">
                    <Select value={editFormData.service_type} onValueChange={(v) => update('service_type', v)}>
                      <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NI">NI (Nova Instalacao)</SelectItem>
                        <SelectItem value="MC">MC (Mudanca de Casa)</SelectItem>
                        <SelectItem value="REFID">REFID (Refidelizacao)</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldGroup>

                  <FieldGroup label="Tipo de Ativacao">
                    <Select value={editFormData.activation_type || ''} onValueChange={(v) => {
                      const isMobileType = v === 'M4' || v === 'Movel';
                      const newCount = isMobileType ? (editFormData.mobile_count || 0) : 0;
                      const newMobiles = isMobileType ? (editFormData.mobile_numbers || []) : [];
                      setEditFormData(prev => ({ ...prev, activation_type: v, mobile_count: newCount, mobile_numbers: newMobiles }));
                    }}>
                      <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NI">NI</SelectItem>
                        <SelectItem value="MC">MC</SelectItem>
                        <SelectItem value="M2">M2</SelectItem>
                        <SelectItem value="M3">M3</SelectItem>
                        <SelectItem value="M4">M4</SelectItem>
                        <SelectItem value="Movel">Movel</SelectItem>
                        <SelectItem value="REFID">REFID</SelectItem>
                        <SelectItem value="REV1">REV1</SelectItem>
                        <SelectItem value="REV2">REV2</SelectItem>
                        <SelectItem value="REV3">REV3</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldGroup>

                  <FieldGroup label="Requisicao (REQ)">
                    <Input
                      value={editFormData.request_number}
                      onChange={(e) => update('request_number', e.target.value)}
                      placeholder="Numero de requisicao"
                      className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                    />
                  </FieldGroup>

                  {isRefid ? (
                    <>
                      <FieldGroup label="Mensalidade Atual (EUR)">
                        <Input
                          type="number"
                          step="0.01"
                          value={editFormData.current_monthly_fee}
                          onChange={(e) => update('current_monthly_fee', e.target.value)}
                          placeholder="Ex: 45.00"
                          className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                        />
                      </FieldGroup>
                      <FieldGroup label="Mensalidade Contratada (EUR)">
                        <Input
                          type="number"
                          step="0.01"
                          value={editFormData.contracted_monthly_fee}
                          onChange={(e) => update('contracted_monthly_fee', e.target.value)}
                          placeholder="Ex: 35.00"
                          className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                        />
                      </FieldGroup>
                    </>
                  ) : (
                    <FieldGroup label="Mensalidade (EUR)">
                      <Input
                        type="number"
                        step="0.01"
                        value={editFormData.monthly_value}
                        onChange={(e) => update('monthly_value', e.target.value)}
                        className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                      />
                    </FieldGroup>
                  )}

                  <div className="col-span-1 sm:col-span-2 pt-3">
                    <Label className="text-slate-400 text-sm font-semibold block mb-3">Servicos Contratados</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="flex items-center space-x-2">
                        <input type="checkbox" id="edit_has_tv" checked={editFormData.has_tv} onChange={(e) => update('has_tv', e.target.checked)} className="w-4 h-4 rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900" />
                        <Label htmlFor="edit_has_tv" className="cursor-pointer text-white font-normal">TV</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input type="checkbox" id="edit_has_net" checked={editFormData.has_net} onChange={(e) => update('has_net', e.target.checked)} className="w-4 h-4 rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900" />
                        <Label htmlFor="edit_has_net" className="cursor-pointer text-white font-normal">NET/Fibra</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input type="checkbox" id="edit_has_lr" checked={editFormData.has_lr} onChange={(e) => update('has_lr', e.target.checked)} className="w-4 h-4 rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900" />
                        <Label htmlFor="edit_has_lr" className="cursor-pointer text-white font-normal">Linha Fixa/LR</Label>
                      </div>
                    </div>

                    {editFormData.has_lr && (
                      <div className="mt-4 p-4 bg-dark-900/80 border border-dark-600 rounded-xl space-y-3">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="edit_fix_ported"
                            checked={editFormData.fix_ported || false}
                            onChange={(e) => setEditFormData(prev => ({
                              ...prev,
                              fix_ported: e.target.checked,
                              fix_number: e.target.checked ? prev.fix_number : '',
                              fix_operator: e.target.checked ? prev.fix_operator : '',
                              fix_cvp: e.target.checked ? prev.fix_cvp : '',
                            }))}
                            className="w-4 h-4 rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900"
                          />
                          <Label htmlFor="edit_fix_ported" className="cursor-pointer text-white text-sm">Fixo é portado?</Label>
                        </div>

                        {editFormData.fix_ported && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                            <div>
                              <Label className="text-xs font-semibold mb-1 text-slate-400">Número fixo a portar</Label>
                              <Input
                                value={editFormData.fix_number || ''}
                                onChange={(e) => update('fix_number', e.target.value)}
                                placeholder="2XXXXXXXX"
                                maxLength={9}
                                className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-semibold mb-1 text-slate-400">Operadora atual</Label>
                              <Select value={editFormData.fix_operator || ''} onValueChange={(v) => update('fix_operator', v)}>
                                <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                <SelectContent>
                                  {FIX_OPERATORS.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs font-semibold mb-1 text-slate-400">CVP do fixo</Label>
                              <Input
                                value={editFormData.fix_cvp || ''}
                                onChange={(e) => update('fix_cvp', e.target.value)}
                                placeholder="12 dígitos ou 7d+4L+1d"
                                maxLength={12}
                                className={`bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white ${editFormData.fix_cvp && !validateCVP(editFormData.fix_cvp) ? 'border-red-500' : ''}`}
                              />
                              {editFormData.fix_cvp && !validateCVP(editFormData.fix_cvp) && (
                                <p className="text-xs text-red-400 mt-1">Formato inválido</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {(editFormData.activation_type === 'M4' || editFormData.activation_type === 'Movel') && (
                      <div className="mt-4">
                        <div className="flex items-center gap-3 mb-3">
                          <Label className="text-sm font-semibold text-slate-400">Quantidade de Móveis</Label>
                          <Select value={String(editFormData.mobile_count || 0)} onValueChange={handleMobileCountChange}>
                            <SelectTrigger className="w-20 bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[0,1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>

                        {mobileCount > 0 && (
                          <div className="space-y-3">
                            {Array.from({ length: mobileCount }).map((_, idx) => {
                              const mob = mobileNumbers[idx] || { number: '', ported: false, novo: false, cvp: '' };
                              return (
                                <div key={idx} className="p-3 bg-dark-900/80 border border-dark-600 rounded-xl">
                                  <p className="text-xs font-semibold text-cyber-400 mb-2">Móvel {idx + 1}</p>
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                                    <div>
                                      <Label className="text-xs font-semibold mb-1 text-slate-400">Número</Label>
                                      <Input
                                        value={mob.novo ? '' : (mob.number || '')}
                                        onChange={(e) => updateMobileNumber(idx, 'number', e.target.value)}
                                        placeholder={mob.novo ? 'Novo número' : '9XXXXXXXX'}
                                        maxLength={9}
                                        disabled={mob.novo || false}
                                        className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                                      />
                                    </div>
                                    <div className="flex flex-col gap-2 mt-4">
                                      <div className="flex items-center space-x-2">
                                        <input
                                          type="checkbox"
                                          id={`edit_mob_novo_${idx}`}
                                          checked={mob.novo || false}
                                          onChange={(e) => updateMobileNumber(idx, 'novo', e.target.checked)}
                                          className="w-4 h-4 rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900"
                                        />
                                        <Label htmlFor={`edit_mob_novo_${idx}`} className="cursor-pointer text-white text-sm">Novo</Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <input
                                          type="checkbox"
                                          id={`edit_mob_ported_${idx}`}
                                          checked={mob.ported || false}
                                          onChange={(e) => updateMobileNumber(idx, 'ported', e.target.checked)}
                                          disabled={mob.novo || false}
                                          className="w-4 h-4 rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900 disabled:opacity-40 disabled:cursor-not-allowed"
                                        />
                                        <Label htmlFor={`edit_mob_ported_${idx}`} className={`cursor-pointer text-sm ${mob.novo ? 'text-slate-600' : 'text-white'}`}>Portado</Label>
                                      </div>
                                    </div>
                                    {mob.ported && !mob.novo && (
                                      <div>
                                        <Label className="text-xs font-semibold mb-1 text-slate-400">CVP</Label>
                                        <Input
                                          value={mob.cvp || ''}
                                          onChange={(e) => updateMobileNumber(idx, 'cvp', e.target.value)}
                                          placeholder="12 dígitos ou 7d+4L+1d"
                                          maxLength={12}
                                          className={`bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white ${mob.cvp && !validateCVP(mob.cvp) ? 'border-red-500' : ''}`}
                                        />
                                        {mob.cvp && !validateCVP(mob.cvp) && (
                                          <p className="text-xs text-red-400 mt-1">Formato inválido</p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </FormSection>
            )}

            {/* Solar fields */}
            {editFormData.scope === 'solar' && (
              <FormSection icon={Zap} title="Detalhes Solar" gradient="from-cyber-500 to-cyber-600">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <FieldGroup label="CPE">
                    <Input
                      value={editFormData.cpe}
                      onChange={(e) => update('cpe', e.target.value.toUpperCase())}
                      placeholder="PT0002XXXXXXXXXXXX"
                      className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                    />
                  </FieldGroup>
                  <FieldGroup label="Potencia">
                    <Select value={editFormData.power} onValueChange={(v) => update('power', v)}>
                      <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {POWER_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FieldGroup>
                </div>
              </FormSection>
            )}

            {/* Energy fields */}
            {editFormData.scope === 'energia' && (
              <FormSection icon={Zap} title="Detalhes Energia" gradient="from-cyber-500 to-cyber-600">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <FieldGroup label="Tipo de Venda Energia">
                    <Select value={editFormData.energy_sale_type} onValueChange={(v) => update('energy_sale_type', v)}>
                      <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="eletricidade">Eletricidade</SelectItem>
                        <SelectItem value="gas">Gas</SelectItem>
                        <SelectItem value="dual">Dual (Eletricidade + Gas)</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldGroup>

                  <FieldGroup label="Tipo de Entrada">
                    <Select value={editFormData.entry_type} onValueChange={(v) => update('entry_type', v)}>
                      <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Alteração de comercializadora">Alteracao de comercializadora</SelectItem>
                        <SelectItem value="Alteração de comercializadora com alteração de titular">Alteracao de comercializadora com alteracao de titular</SelectItem>
                        <SelectItem value="Entrada Direta">Entrada Direta</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldGroup>

                  {(editFormData.energy_sale_type === 'eletricidade' || editFormData.energy_sale_type === 'dual') && (
                    <>
                      <FieldGroup label="CPE">
                        <Input
                          value={editFormData.cpe}
                          onChange={(e) => update('cpe', e.target.value.toUpperCase())}
                          placeholder="PT0002XXXXXXXXXXXX"
                          className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                        />
                      </FieldGroup>
                      <FieldGroup label="Potencia">
                        <Select value={editFormData.power} onValueChange={(v) => update('power', v)}>
                          <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>
                            {POWER_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FieldGroup>
                    </>
                  )}

                  {(editFormData.energy_sale_type === 'gas' || editFormData.energy_sale_type === 'dual') && (
                    <>
                      <FieldGroup label="CUI">
                        <Input
                          value={editFormData.cui}
                          onChange={(e) => update('cui', e.target.value.toUpperCase())}
                          placeholder="PT16XXXXXXXXXXXXXX"
                          className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                        />
                      </FieldGroup>
                      <FieldGroup label="Escalao">
                        <Select value={editFormData.tier} onValueChange={(v) => update('tier', v)}>
                          <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Escalão 1">Escalao 1</SelectItem>
                            <SelectItem value="Escalão 2">Escalao 2</SelectItem>
                            <SelectItem value="Escalão 3">Escalao 3</SelectItem>
                          </SelectContent>
                        </Select>
                      </FieldGroup>
                    </>
                  )}
                </div>

                {(() => {
                  const currentOperator = operators.find(op => op.id === editFormData.operator_id);
                  return (
                    <>
                      {currentOperator?.requires_voltage_type && (
                        <div className="mt-4">
                          <FieldGroup label="Tipo de Tensão *">
                            <Select
                              value={editFormData.voltage_type || ""}
                              onValueChange={(v) => update('voltage_type', v)}
                            >
                              <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white">
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Monofásico">Monofásico</SelectItem>
                                <SelectItem value="Trifásico">Trifásico</SelectItem>
                              </SelectContent>
                            </Select>
                          </FieldGroup>
                        </div>
                      )}
                      {currentOperator?.requires_additional_services && (currentOperator?.additional_services_list || []).length > 0 && (
                        <div className="mt-4">
                          <FieldGroup label="Serviços Adicionais *">
                            <Select
                              value={editFormData.additional_services || ""}
                              onValueChange={(v) => update('additional_services', v)}
                            >
                              <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white">
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Sem serviços adicionais">Sem serviços adicionais</SelectItem>
                                {(currentOperator.additional_services_list || []).map(service => (
                                  <SelectItem key={service} value={service}>{service}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FieldGroup>
                        </div>
                      )}
                    </>
                  );
                })()}
              </FormSection>
            )}

            <FormSection icon={CreditCard} title="Serviços Adicionais" gradient="from-cyber-500 to-cyber-600">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="col-span-1 sm:col-span-2 flex flex-wrap items-center gap-4 sm:gap-6">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="edit_direct_debit" checked={editFormData.has_direct_debit} onChange={(e) => update('has_direct_debit', e.target.checked)} className="w-4 h-4 rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900" />
                    <Label htmlFor="edit_direct_debit" className="cursor-pointer text-white font-normal">Debito Direto (DD)</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="edit_electronic_invoice" checked={editFormData.has_electronic_invoice} onChange={(e) => update('has_electronic_invoice', e.target.checked)} className="w-4 h-4 rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900" />
                    <Label htmlFor="edit_electronic_invoice" className="cursor-pointer text-white font-normal">Fatura Eletronica (FE)</Label>
                  </div>
                </div>
              </div>
            </FormSection>

            <FormSection icon={FileText} title="Observações" gradient="from-cyber-500 to-cyber-600">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <FieldGroup label="Observacoes" colSpan={2}>
                  <Textarea
                    value={editFormData.observations}
                    onChange={(e) => update('observations', e.target.value)}
                    rows={3}
                    className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                  />
                </FieldGroup>
              </div>
            </FormSection>

            {(user?.role === 'admin' || user?.role === 'bo') && (
            <FormSection icon={CreditCard} title="Pagamento" gradient="from-cyber-500 to-cyber-600">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="col-span-1 sm:col-span-2 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="edit_paid_to_operator"
                      checked={editFormData.paid_to_operator}
                      onChange={(e) => update('paid_to_operator', e.target.checked)}
                      disabled={editFormData.status !== 'Ativo'}
                      className="w-4 h-4 disabled:opacity-50 disabled:cursor-not-allowed rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900"
                    />
                    <Label
                      htmlFor="edit_paid_to_operator"
                      className={editFormData.status !== 'Ativo' ? "text-slate-500 font-normal" : "text-white font-normal"}
                    >
                      Paga pelo Operador
                    </Label>
                  </div>
                  {editFormData.status !== 'Ativo' && (
                    <p className="text-xs text-slate-500">Apenas disponivel para vendas com estado "Ativo"</p>
                  )}
                </div>

                {editFormData.paid_to_operator && (
                  <FieldGroup label="Data de Pagamento" colSpan={2}>
                    <Input
                      type="date"
                      value={editFormData.payment_date}
                      onChange={(e) => update('payment_date', e.target.value)}
                      className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                    />
                  </FieldGroup>
                )}
              </div>
            </FormSection>
            )}

            {(user?.role === 'admin' || user?.role === 'bo') && (
            <FormSection icon={RotateCcw} title="Refidelização" gradient="from-emerald-500 to-emerald-600">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <FieldGroup label="Data de Ativação">
                  <Input
                    type="date"
                    value={editFormData.activated_at ? editFormData.activated_at.split('T')[0] : ''}
                    onChange={(e) => update('activated_at', e.target.value || null)}
                    className="bg-dark-900 border-dark-700 focus:border-emerald-500 focus:ring-emerald-500/20 text-white"
                  />
                </FieldGroup>
                <div />
                <FieldGroup label="Prazo de Refidelização (override)" hint="Deixe vazio para usar o prazo definido na operadora">
                  <Input
                    type="number"
                    min="1"
                    placeholder="Ex: 30"
                    value={editFormData.refidelizacao_prazo || ''}
                    onChange={(e) => update('refidelizacao_prazo', e.target.value ? parseInt(e.target.value) : null)}
                    className="bg-dark-900 border-dark-700 focus:border-emerald-500 focus:ring-emerald-500/20 text-white"
                  />
                </FieldGroup>
                <FieldGroup label="Unidade do Prazo">
                  <Select
                    value={editFormData.refidelizacao_unidade || 'dias'}
                    onValueChange={(v) => update('refidelizacao_unidade', v)}
                  >
                    <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-emerald-500 focus:ring-emerald-500/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dias">Dias</SelectItem>
                      <SelectItem value="meses">Meses</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldGroup>
              </div>
            </FormSection>
            )}

            <FormSection icon={DollarSign} title="Comissão" gradient="from-cyber-500 to-cyber-600">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="col-span-1 sm:col-span-2">
                  <Label className="text-slate-400 text-sm">
                    Comissao Manual (EUR)
                    {!canEditCommission && <span className="text-red-400 ml-1">*Apenas Administradores</span>}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editFormData.manual_commission}
                    onChange={(e) => update('manual_commission', e.target.value)}
                    placeholder={hasAutomaticCommission ? "Deixar vazio para calculo automatico" : "Definir comissao"}
                    disabled={!canEditCommission}
                    className={canEditCommission ? "bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white" : "bg-dark-900 border-dark-700 text-slate-500 opacity-60 cursor-not-allowed"}
                  />
                  {hasAutomaticCommission && commissionChanged && editFormData.manual_commission && (
                    <div className="mt-2 bg-cyber-500/10 border border-cyber-500/20 rounded-xl p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-cyber-400 mt-0.5 flex-shrink-0" />
                        <p className="text-cyber-400 text-sm">
                          <strong>Atencao:</strong> Esta operadora tem comissao automatica. Ao definir um valor manual, esta a sobrescrever o calculo automatico. Deixe o campo vazio para manter o calculo automatico.
                        </p>
                      </div>
                    </div>
                  )}
                  <p className="text-xs mt-1 text-slate-500">
                    {hasAutomaticCommission
                      ? 'Operadora com calculo automatico de comissao'
                      : saleOperator?.commission_mode === 'manual'
                      ? 'Operadora com comissao definida ao contrato'
                      : 'Comissao para venda Solar'}
                    {!canEditCommission && ' - Apenas administradores podem definir comissoes manuais'}
                  </p>
                </div>
              </div>
            </FormSection>

            <FormSection icon={Paperclip} title="Anexos" gradient="from-slate-500 to-slate-600">
              <div className="space-y-3">
                {(editFormData.attachments || []).map((att) => (
                  <div key={att.id} className={`flex items-center justify-between p-3 rounded-lg border ${att.expired ? 'border-dark-700/50 bg-dark-900/40 opacity-60' : 'border-dark-700 bg-dark-900'}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <Paperclip className={`w-4 h-4 flex-shrink-0 ${att.expired ? 'text-slate-600' : 'text-cyber-400'}`} />
                      <div className="min-w-0">
                        <p className={`text-sm truncate ${att.expired ? 'line-through text-slate-500' : 'text-white'}`}>{att.filename}</p>
                        <p className="text-xs text-slate-600">{new Date(att.uploaded_at).toLocaleDateString('pt-PT')}</p>
                        {att.expired && <p className="text-xs text-red-500/70">Expirado — ficheiro removido apos 60 dias</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!att.expired && (
                        <>
                          <Button type="button" size="sm" variant="ghost" onClick={() => handleDownload(att)} className="h-7 w-7 p-0 text-slate-400 hover:text-white">
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => handleRemoveAttachment(att)} className="h-7 w-7 p-0 text-slate-400 hover:text-red-400">
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}

                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.txt,.heic,.heif"
                    onChange={handleAddFiles}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-2 bg-dark-900 border-dark-700 text-slate-300 hover:bg-dark-800 hover:text-white"
                  >
                    <Upload className="w-4 h-4" />
                    Adicionar Ficheiros
                  </Button>
                  <p className="text-xs text-slate-600 mt-1">Aceita imagens, PDF, Word, Excel — max 15MB por ficheiro</p>
                </div>
              </div>
            </FormSection>
            </div>
          </div>

          {/* Actions */}
          <div className="sticky bottom-0 bg-dark-850 border-t border-dark-700 px-4 sm:px-8 py-4">
            <div className="flex justify-between gap-3">
              <div>
                {(user?.role === 'admin' || user?.role === 'bo') && editFormData.status === 'Ativo' && !editingSale?.has_chargeback && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={openChargebackDialog}
                    className="bg-dark-900 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-400 gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Registar Chargeback
                  </Button>
                )}
                {editingSale?.has_chargeback && (
                  <span className="text-xs text-red-400 flex items-center gap-1">
                    <RotateCcw className="w-3 h-3" />
                    Chargeback registado
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="bg-dark-900 border-dark-700 text-slate-300 hover:bg-dark-800">
                  Cancelar
                </Button>
                <Button type="submit" className="bg-gradient-to-r from-cyber-500 to-cyber-600 text-white font-semibold hover:shadow-lg hover:shadow-cyber-500/25">
                  Guardar Alteracoes
                </Button>
              </div>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={chargebackDialogOpen} onOpenChange={setChargebackDialogOpen}>
      <DialogContent className="max-w-md bg-dark-850 border border-red-500/20">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-red-400" />
            Registar Chargeback
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Venda: {editingSale?.sale_code} — {editingSale?.customer_name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {chargebackPaidReport && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-300">
              <AlertTriangle className="w-4 h-4 inline mr-1.5 mb-0.5" />
              Esta venda já consta do auto {chargebackPaidReport.month}/{chargebackPaidReport.year} (v{chargebackPaidReport.version}) que foi pago. O chargeback será incluído no próximo auto de comissões.
            </div>
          )}
          <div>
            <Label className="text-slate-300 text-sm font-semibold mb-1.5 block">Motivo *</Label>
            <Textarea
              value={chargebackForm.reason}
              onChange={(e) => setChargebackForm(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="Descreva o motivo do chargeback..."
              rows={3}
              className="bg-dark-900 border-dark-700 focus:border-red-500/50 focus:ring-red-500/10 text-white"
            />
          </div>
          <div>
            <Label className="text-slate-300 text-sm font-semibold mb-1.5 block">Data do Motivo *</Label>
            <Input
              type="date"
              value={chargebackForm.reason_date}
              onChange={(e) => setChargebackForm(prev => ({ ...prev, reason_date: e.target.value }))}
              className="bg-dark-900 border-dark-700 focus:border-red-500/50 focus:ring-red-500/10 text-white"
            />
          </div>
          <div>
            <Label className="text-slate-300 text-sm font-semibold mb-1.5 block">Percentagem de Chargeback (%)</Label>
            <Input
              type="number"
              min="1"
              max="100"
              step="0.01"
              value={chargebackForm.percentage}
              onChange={(e) => setChargebackForm(prev => ({ ...prev, percentage: parseFloat(e.target.value) || 100 }))}
              className="bg-dark-900 border-dark-700 focus:border-red-500/50 focus:ring-red-500/10 text-white"
            />
            <p className="text-xs text-slate-500 mt-1">
              Valor a descontar: {((parseFloat(editingSale?.calculated_commission || editingSale?.manual_commission || 0)) * (chargebackForm.percentage / 100)).toFixed(2)} €
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => setChargebackDialogOpen(false)} className="bg-dark-900 border-dark-700 text-slate-300 hover:bg-dark-800">
            Cancelar
          </Button>
          <Button
            onClick={handleSaveChargeback}
            disabled={savingChargeback}
            className="bg-red-600 hover:bg-red-500 text-white font-semibold gap-2"
          >
            {savingChargeback ? 'A guardar...' : 'Confirmar Chargeback'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default SaleEditDialog;
