import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { X, Upload, Zap, TrendingUp, Building2, User, Phone, MapPin, CreditCard, FileText, DollarSign, Clock, Plus, CircleAlert as AlertCircle, Trash2, Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import EnergyPointsManager from './EnergyPointsManager';

const POWER_OPTIONS = ["1.15kVA", "2.3kVA", "3.45kVA", "4.6kVA", "5.75kVA", "6.9kVA", "10.35kVA", "13.8kVA", "17.25kVA", "20.7kVA", "27.6kVA", "34.5kVA", "41.4kVA", "Outros"];
const FIX_OPERATORS = ["MEO", "Vodafone", "NOS", "Digi", "Outro"];

const CVP_REGEX = /^(\d{7}[A-Za-z]{4}\d{1}|\d{12})$/;

function validateCVP(value) {
  if (!value) return true;
  return CVP_REGEX.test(value);
}

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

const SaleFormDialog = ({
  isOpen,
  onClose,
  formData,
  setFormData,
  onSubmit,
  partners,
  operators,
  filteredOperators,
  operatorCommissions,
  availableServiceTypes,
  availableActivationTypes,
  operatorEnergyType,
  currentOperator,
  uploadFiles,
  setUploadFiles,
  fetchOperatorCommissions,
  user
}) => {
  const [pendingFile, setPendingFile] = useState(null);
  const [attachmentInfoOpen, setAttachmentInfoOpen] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const MANDATORY_ATTACHMENTS_BY_OPERATOR = {
    'endesa': {
      title: 'Endesa',
      items: [
        'Declaração preenchida manualmente, assinada e datada',
        'Campanha e condições assinadas e datadas',
        'Em caso de alteração de titularidade: documento comprovativo de posse do local (contrato de arrendamento / comodato / compra e venda / escritura / fatura dos serviços básicos como telecomunicações)',
        'Se autorizar cópia de documentos pessoais, anexar também os mesmos',
      ],
    },
    'iberdrola': {
      title: 'Iberdrola',
      items: [
        'Checklist Iberdrola preenchida (se adere a GAS, número de CC/passaporte é obrigatório)',
        'Em caso de alteração de titularidade: documento comprovativo de posse do local (contrato de arrendamento / comodato / compra e venda / escritura / fatura dos serviços básicos como telecomunicações)',
      ],
    },
    'repsol': {
      title: 'Repsol',
      items: [
        'Fatura atual do cliente ou print da mensagem e-redes com CPE',
        'Em caso de alteração de titularidade: documento comprovativo de posse do local (contrato de arrendamento / comodato / compra e venda / escritura / fatura dos serviços básicos como telecomunicações)',
      ],
    },
  };

  const selectedOperatorObj = operators.find(op => op.id === formData.operator_id);
  const operatorNameLower = (selectedOperatorObj?.name || '').toLowerCase();
  const mandatoryAttachmentInfo = Object.entries(MANDATORY_ATTACHMENTS_BY_OPERATOR).find(([key]) =>
    operatorNameLower.includes(key)
  )?.[1] || null;

  const handleFileSelected = (e) => {
    const MAX_SIZE = 10 * 1024 * 1024;
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    const oversized = files.filter(f => f.size > MAX_SIZE);
    if (oversized.length > 0) {
      toast.error(`Ficheiro(s) excedem o limite de 10MB: ${oversized.map(f => f.name).join(', ')}`);
      e.target.value = '';
      return;
    }
    setPendingFile(files[0]);
  };

  const handleAddFile = () => {
    if (!pendingFile) return;
    const alreadyAdded = uploadFiles.some(f => f.name === pendingFile.name && f.size === pendingFile.size);
    if (alreadyAdded) {
      toast.error(`Ficheiro "${pendingFile.name}" ja foi adicionado`);
      return;
    }
    setUploadFiles([...uploadFiles, pendingFile]);
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveFile = (index) => {
    setUploadFiles(uploadFiles.filter((_, i) => i !== index));
  };

  const handleSubmitWithCheck = (e) => {
    if (pendingFile) {
      toast.warning(`Tem um ficheiro selecionado ("${pendingFile.name}") que nao foi adicionado. Clique em "Adicionar" ou remova a selecao antes de gravar.`);
      return;
    }
    onSubmit(e);
  };

  const mobileCount = parseInt(formData.mobile_count) || 0;
  const mobileNumbers = formData.mobile_numbers || [];

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
    setFormData({ ...formData, mobile_numbers: updated });
  };

  const ensureMobileSlots = (count) => {
    const current = formData.mobile_numbers || [];
    const updated = [...current];
    while (updated.length < count) updated.push({ number: '', ported: false, novo: false, cvp: '' });
    return updated.slice(0, count);
  };

  const handleMobileCountChange = (v) => {
    const count = parseInt(v) || 0;
    const slots = ensureMobileSlots(count);
    setFormData({ ...formData, mobile_count: count, mobile_numbers: slots });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
          className="relative w-full max-w-5xl max-h-[95vh] overflow-hidden bg-dark-850 border border-cyber-500/10 rounded-2xl shadow-2xl flex flex-col min-w-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 z-10 bg-dark-850 border-b border-dark-700 px-4 sm:px-8 py-4 sm:py-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-white mb-1">Nova Venda</h2>
                <p className="text-sm text-slate-400">Preencha os dados da nova venda no sistema</p>
              </div>
              <button
                onClick={() => { setPendingFile(null); onClose(); }}
                className="w-10 h-10 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-red-400" />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 px-4 sm:px-8 py-6 scrollbar-modern overflow-x-hidden"  >
            <form onSubmit={onSubmit} className="space-y-8">
              <FormSection icon={Clock} title="Informações Gerais" gradient="from-cyber-500 to-cyber-600">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <Label className="text-sm font-semibold mb-2 text-slate-400">Data da Venda *</Label>
                    <Input
                      type="date"
                      value={formData.date}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      required
                      className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-2 text-slate-400">Parceiro *</Label>
                    <Select
                      value={formData.partner_id}
                      onValueChange={(v) => {
                        setFormData({...formData, partner_id: v});
                        if (formData.operator_id) {
                          fetchOperatorCommissions(formData.operator_id, v, formData.client_type);
                        }
                      }}
                      disabled={user?.role === 'partner'}
                    >
                      <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white">
                        <SelectValue placeholder="Selecione o parceiro..." />
                      </SelectTrigger>
                      <SelectContent>
                        {partners.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}{p.is_admin ? ' (Admin)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-2 text-slate-400">Âmbito *</Label>
                    <Select
                      value={formData.scope}
                      onValueChange={(v) => setFormData({...formData, scope: v, operator_id: "", service_type: "", cpe: "", cui: ""})}
                    >
                      <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="telecomunicacoes">Telecomunicações</SelectItem>
                        <SelectItem value="energia">Energia</SelectItem>
                        <SelectItem value="solar">Solar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-2 text-slate-400">Tipo de Cliente *</Label>
                    <Select
                      value={formData.client_type}
                      onValueChange={(v) => {
                        setFormData({...formData, client_type: v});
                        if (formData.operator_id) {
                          fetchOperatorCommissions(formData.operator_id, formData.partner_id, v);
                        }
                      }}
                    >
                      <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="particular">Particular</SelectItem>
                        <SelectItem value="empresarial">Empresarial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </FormSection>

              <div className="border-t border-dark-700 my-6" />

              <FormSection icon={Building2} title="Operadora" gradient="from-cyber-500 to-cyber-600">
                <div className={formData.scope === 'energia' ? 'grid grid-cols-2 gap-6' : ''}>
                  <div className={formData.scope === 'energia' ? '' : 'col-span-full'}>
                    <Label className="text-sm font-semibold mb-2 text-slate-400">Operadora *</Label>
                    <Select
                      value={formData.operator_id}
                      onValueChange={(v) => {
                        const operator = operators.find(op => op.id === v);
                        let newEnergyType = '';

                        if (formData.scope === 'energia') {
                          if (operator?.energy_type === 'dual') {
                            newEnergyType = '';
                          } else if (operator?.energy_type === 'eletricidade' || operator?.energy_type === 'gas') {
                            newEnergyType = operator.energy_type;
                          }
                        }

                        setFormData({
                          ...formData,
                          operator_id: v,
                          energy_sale_type: newEnergyType,
                          service_type: '',
                          activation_type: '',
                          cpe: '',
                          power: '',
                          cui: '',
                          tier: ''
                        });

                        fetchOperatorCommissions(v);
                      }}
                    >
                      <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white">
                        <SelectValue placeholder="Selecione a operadora..." />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredOperators.map(op => (
                          <SelectItem key={op.id} value={op.id}>
                            {op.name}
                            {op.energy_type && ` (${
                              op.energy_type === 'eletricidade' ? 'Eletricidade' :
                              op.energy_type === 'gas' ? 'Gás' :
                              'Dual'
                            })`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {formData.scope === 'energia' && formData.operator_id && operatorEnergyType === 'dual' && (
                  <>
                    {operatorCommissions.length === 0 ? (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                        <p className="text-red-400 font-semibold">Operadora sem comissões configuradas</p>
                        <p className="text-sm text-red-400/80 mt-1">
                          Não é possível registar vendas para esta operadora. Contacte o administrador.
                        </p>
                      </div>
                    ) : (
                      <div className="bg-dark-900 border border-dark-700 rounded-xl p-5">
                        <Label className="text-base font-bold mb-3 block text-white">
                          O que o cliente pretende contratar? *
                        </Label>
                        <Select
                          value={formData.energy_sale_type}
                          onValueChange={(v) => setFormData({...formData, energy_sale_type: v, cpe: '', power: '', cui: '', tier: ''})}
                        >
                          <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white">
                            <SelectValue placeholder="Selecione o tipo de adesão..." />
                          </SelectTrigger>
                          <SelectContent>
                            {(() => {
                              const hasEletricidade = operatorCommissions.some(c =>
                                c.service_type === 'eletricidade' || (c.service_types && c.service_types.includes('eletricidade'))
                              );
                              const hasGas = operatorCommissions.some(c =>
                                c.service_type === 'gas' || (c.service_types && c.service_types.includes('gas'))
                              );
                              return (
                                <>
                                  {hasEletricidade && (
                                    <SelectItem value="eletricidade">Apenas Eletricidade</SelectItem>
                                  )}
                                  {hasGas && (
                                    <SelectItem value="gas">Apenas Gás</SelectItem>
                                  )}
                                  {hasEletricidade && hasGas && (
                                    <SelectItem value="dual">Eletricidade + Gás (Dual)</SelectItem>
                                  )}
                                </>
                              );
                            })()}
                          </SelectContent>
                        </Select>
                        <p className="text-xs mt-2 text-slate-500">
                          Selecione se o cliente está a aderir apenas a eletricidade, apenas a gás, ou a ambos os serviços.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </FormSection>

              <div className="border-t border-dark-700 my-6" />

              <FormSection icon={User} title="Dados do Cliente" gradient="from-cyber-500 to-cyber-600">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <Label className="text-sm font-semibold mb-2 text-slate-400">Nome Completo *</Label>
                    <Input
                      value={formData.client_name}
                      onChange={(e) => setFormData({...formData, client_name: e.target.value})}
                      required
                      className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                      placeholder="Nome completo do cliente"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-2 text-slate-400">NIF *</Label>
                    <Input
                      value={formData.client_nif}
                      onChange={(e) => setFormData({...formData, client_nif: e.target.value})}
                      required
                      className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                      placeholder="000000000"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-2 text-slate-400">Contacto *</Label>
                    <Input
                      value={formData.client_contact}
                      onChange={(e) => setFormData({...formData, client_contact: e.target.value})}
                      required
                      className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                      placeholder="900000000"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-2 text-slate-400">Email</Label>
                    <Input
                      type="email"
                      value={formData.client_email}
                      onChange={(e) => setFormData({...formData, client_email: e.target.value})}
                      className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                      placeholder="cliente@exemplo.com"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-2 text-slate-400">IBAN</Label>
                    <Input
                      value={formData.client_iban}
                      onChange={(e) => setFormData({...formData, client_iban: e.target.value})}
                      className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                      placeholder="PT50..."
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <Label className="text-sm font-semibold mb-2 text-slate-400">Autoriza cópia dos documentos pessoais? *</Label>
                    <Select
                      value={formData.autoriza_documentos}
                      onValueChange={(v) => setFormData({...formData, autoriza_documentos: v})}
                    >
                      <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sim.">Sim.</SelectItem>
                        <SelectItem value="Nao.">Não.</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </FormSection>

              <div className="border-t border-dark-700 my-6" />

              <FormSection icon={MapPin} title="Morada" gradient="from-cyber-500 to-cyber-600">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="col-span-1 sm:col-span-2">
                    <Label className="text-sm font-semibold mb-2 text-slate-400">Morada Completa *</Label>
                    <Input
                      value={formData.street}
                      onChange={(e) => setFormData({...formData, street: e.target.value})}
                      placeholder="Rua, Avenida, número, andar, etc."
                      required
                      className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-2 text-slate-400">Código Postal *</Label>
                    <Input
                      value={formData.postal_code}
                      onChange={(e) => setFormData({...formData, postal_code: e.target.value})}
                      placeholder="0000-000"
                      pattern="\d{4}-\d{3}"
                      required
                      className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-2 text-slate-400">Localidade *</Label>
                    <Input
                      value={formData.locality}
                      onChange={(e) => setFormData({...formData, locality: e.target.value})}
                      placeholder="Ex: Lisboa, Porto, etc."
                      required
                      className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <Label className="text-sm font-semibold mb-2 text-slate-400">Morada de Instalação/Fornecimento</Label>
                    <Input
                      value={formData.installation_address}
                      onChange={(e) => setFormData({...formData, installation_address: e.target.value})}
                      className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                      placeholder="Se diferente da morada do cliente"
                    />
                    <p className="text-xs mt-1 text-slate-500">Apenas preencher se for diferente da morada principal</p>
                  </div>
                </div>
              </FormSection>

              <div className="border-t border-dark-700 my-6" />

              {formData.scope === 'telecomunicacoes' && formData.operator_id && (
                <>
                  {operatorCommissions.length === 0 ? (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                      <p className="text-red-400 font-semibold">Operadora sem comissões configuradas</p>
                      <p className="text-sm text-red-400/80 mt-1">
                        Não é possível registar vendas para esta operadora. Contacte o administrador.
                      </p>
                    </div>
                  ) : (
                    <FormSection icon={TrendingUp} title="Detalhes da Venda - Telecomunicações" gradient="from-cyber-500 to-cyber-600">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <div>
                          <Label className="text-sm font-semibold mb-2 text-slate-400">Tipo de Serviço *</Label>
                          <Select
                            value={formData.service_type}
                            onValueChange={(v) => {
                              const newFormData = {...formData, service_type: v};
                              if (v === 'REFID' || v === 'Refid') {
                                newFormData.monthly_value = '';
                              } else {
                                newFormData.current_monthly_fee = '';
                                newFormData.contracted_monthly_fee = '';
                              }
                              setFormData(newFormData);
                            }}
                            disabled={availableServiceTypes.length === 0}
                          >
                            <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white">
                              <SelectValue placeholder={availableServiceTypes.length === 0 ? "Sem tipos disponíveis" : "Selecione..."} />
                            </SelectTrigger>
                            <SelectContent>
                              {availableServiceTypes.map(type => (
                                <SelectItem key={type} value={type}>
                                  {type === 'NI' ? 'NI (Nova Instalação)' :
                                   type === 'MC' ? 'MC (Mudança de Casa)' :
                                   type === 'REFID' ? 'REFID (Refidelização)' :
                                   type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {availableServiceTypes.length === 0 && (
                            <p className="text-xs text-red-400 mt-1">Nenhum tipo de serviço com comissão configurada</p>
                          )}
                        </div>

                        <div>
                          <Label className="text-sm font-semibold mb-2 text-slate-400">
                            Tipo de Ativação *
                          </Label>
                          <Select
                            value={formData.activation_type}
                            onValueChange={(v) => {
                              const newMobileNumbers = v !== 'M4'
                                ? []
                                : ensureMobileSlots(formData.mobile_count || 0);
                              setFormData({
                                ...formData,
                                activation_type: v,
                                mobile_numbers: newMobileNumbers
                              });
                            }}
                            disabled={availableActivationTypes.length === 0}
                          >
                            <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white">
                              <SelectValue placeholder={availableActivationTypes.length === 0 ? "Sem ativações disponíveis" : "Selecione..."} />
                            </SelectTrigger>
                            <SelectContent>
                              {availableActivationTypes.map(type => (
                                <SelectItem key={type} value={type}>{type}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {availableActivationTypes.length === 0 && (
                            <p className="text-xs text-red-400 mt-1">Sem ativações com comissão configurada</p>
                          )}
                        </div>
                      </div>

                      {(formData.service_type === 'REFID' || formData.service_type === 'Refid') ? (
                        <div className="bg-cyber-500/10 border border-cyber-500/20 rounded-xl p-5">
                          <h4 className="font-bold mb-4 text-white">
                            Dados REFID - Downsell/Upsell
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm font-semibold mb-2 text-slate-400">Mensalidade Atual (€) *</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={formData.current_monthly_fee}
                                onChange={(e) => setFormData({...formData, current_monthly_fee: e.target.value})}
                                required
                                placeholder="Ex: 45.00"
                                className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                              />
                              <p className="text-xs mt-1 text-slate-500">Valor que o cliente paga atualmente</p>
                            </div>
                            <div>
                              <Label className="text-sm font-semibold mb-2 text-slate-400">Mensalidade Contratada (€) *</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={formData.contracted_monthly_fee}
                                onChange={(e) => setFormData({...formData, contracted_monthly_fee: e.target.value})}
                                required
                                placeholder="Ex: 35.00"
                                className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                              />
                              <p className="text-xs mt-1 text-slate-500">Novo valor contratado</p>
                            </div>
                          </div>
                          {formData.current_monthly_fee && formData.contracted_monthly_fee && (
                            <div className="mt-4 p-4 bg-dark-900 border border-dark-700 rounded-lg">
                              <p className="text-sm font-semibold">
                                {parseFloat(formData.current_monthly_fee) > parseFloat(formData.contracted_monthly_fee) ? (
                                  <span className="text-orange-400">Downsell: Cliente reduz mensalidade de €{formData.current_monthly_fee} para €{formData.contracted_monthly_fee}</span>
                                ) : parseFloat(formData.current_monthly_fee) < parseFloat(formData.contracted_monthly_fee) ? (
                                  <span className="text-green-400">Upsell: Cliente aumenta mensalidade de €{formData.current_monthly_fee} para €{formData.contracted_monthly_fee}</span>
                                ) : (
                                  <span className="text-slate-300">Mensalidades iguais</span>
                                )}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <Label className="text-sm font-semibold mb-2 text-slate-400">Mensalidade (€) *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={formData.monthly_value}
                            onChange={(e) => setFormData({...formData, monthly_value: e.target.value})}
                            required
                            className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                            placeholder="Ex: 29.99"
                          />
                        </div>
                      )}

                      <div className="border-t border-dark-700 pt-4 mt-4">
                        <Label className="text-base font-bold mb-4 block text-white">Serviços Contratados</Label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              id="has_tv"
                              checked={formData.has_tv}
                              onChange={(e) => setFormData({...formData, has_tv: e.target.checked})}
                              className="w-5 h-5 rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900"
                            />
                            <Label htmlFor="has_tv" className="cursor-pointer font-medium text-white">TV</Label>
                          </div>
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              id="has_net"
                              checked={formData.has_net}
                              onChange={(e) => setFormData({...formData, has_net: e.target.checked})}
                              className="w-5 h-5 rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900"
                            />
                            <Label htmlFor="has_net" className="cursor-pointer font-medium text-white">NET/Fibra</Label>
                          </div>
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              id="has_lr"
                              checked={formData.has_lr}
                              onChange={(e) => setFormData({...formData, has_lr: e.target.checked})}
                              className="w-5 h-5 rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900"
                            />
                            <Label htmlFor="has_lr" className="cursor-pointer font-medium text-white">Linha Fixa/LR</Label>
                          </div>
                        </div>

                        {formData.has_lr && (
                          <div className="mt-4 p-4 bg-dark-900/80 border border-dark-600 rounded-xl space-y-4">
                            <div className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                id="fix_ported"
                                checked={formData.fix_ported || false}
                                onChange={(e) => setFormData({
                                  ...formData,
                                  fix_ported: e.target.checked,
                                  fix_number: e.target.checked ? formData.fix_number : '',
                                  fix_operator: e.target.checked ? formData.fix_operator : '',
                                  fix_cvp: e.target.checked ? formData.fix_cvp : '',
                                })}
                                className="w-5 h-5 rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900"
                              />
                              <Label htmlFor="fix_ported" className="cursor-pointer font-medium text-white">
                                Fixo é portado?
                              </Label>
                            </div>

                            {formData.fix_ported && (
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                                <div>
                                  <Label className="text-sm font-semibold mb-2 text-slate-400">Número fixo a portar *</Label>
                                  <Input
                                    value={formData.fix_number || ''}
                                    onChange={(e) => setFormData({...formData, fix_number: e.target.value})}
                                    placeholder="2XXXXXXXX"
                                    maxLength={9}
                                    className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                                  />
                                </div>
                                <div>
                                  <Label className="text-sm font-semibold mb-2 text-slate-400">Operadora atual *</Label>
                                  <Select
                                    value={formData.fix_operator || ''}
                                    onValueChange={(v) => setFormData({...formData, fix_operator: v})}
                                  >
                                    <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white">
                                      <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {FIX_OPERATORS.map(op => (
                                        <SelectItem key={op} value={op}>{op}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-sm font-semibold mb-2 text-slate-400">CVP do fixo *</Label>
                                  <Input
                                    value={formData.fix_cvp || ''}
                                    onChange={(e) => setFormData({...formData, fix_cvp: e.target.value})}
                                    placeholder="12 dígitos ou 7d+4L+1d"
                                    maxLength={12}
                                    className={`bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white ${formData.fix_cvp && !validateCVP(formData.fix_cvp) ? 'border-red-500' : ''}`}
                                  />
                                  {formData.fix_cvp && !validateCVP(formData.fix_cvp) && (
                                    <p className="text-xs text-red-400 mt-1">Formato inválido: 12 dígitos ou 7 dígitos + 4 letras + 1 dígito</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {formData.activation_type === 'M4' && (
                          <div className="mt-4">
                            <div className="flex items-center gap-4 mb-3">
                              <Label className="text-sm font-semibold text-slate-400">Quantidade de Móveis</Label>
                              <Select
                                value={String(formData.mobile_count || 0)}
                                onValueChange={handleMobileCountChange}
                              >
                                <SelectTrigger className="w-24 bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {[0,1,2,3,4,5].map(n => (
                                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {mobileCount > 0 && (
                              <div className="space-y-3">
                                {Array.from({ length: mobileCount }).map((_, idx) => {
                                  const mob = mobileNumbers[idx] || { number: '', ported: false, novo: false, cvp: '' };
                                  return (
                                    <div key={idx} className="p-4 bg-dark-900/80 border border-dark-600 rounded-xl">
                                      <div className="flex items-center gap-3 mb-3">
                                        <span className="text-sm font-semibold text-cyber-400">Móvel {idx + 1}</span>
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                                        <div>
                                          <Label className="text-xs font-semibold mb-1 text-slate-400">Número (9 dígitos) *</Label>
                                          <Input
                                            value={mob.novo ? '' : (mob.number || '')}
                                            onChange={(e) => updateMobileNumber(idx, 'number', e.target.value)}
                                            placeholder={mob.novo ? 'Novo número' : '9XXXXXXXX'}
                                            maxLength={9}
                                            disabled={mob.novo || false}
                                            className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                                          />
                                        </div>
                                        <div className="flex flex-col gap-2 mt-5">
                                          <div className="flex items-center space-x-2">
                                            <input
                                              type="checkbox"
                                              id={`mob_novo_${idx}`}
                                              checked={mob.novo || false}
                                              onChange={(e) => updateMobileNumber(idx, 'novo', e.target.checked)}
                                              className="w-4 h-4 rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900"
                                            />
                                            <Label htmlFor={`mob_novo_${idx}`} className="cursor-pointer text-white text-sm">Novo</Label>
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            <input
                                              type="checkbox"
                                              id={`mob_ported_${idx}`}
                                              checked={mob.ported || false}
                                              onChange={(e) => updateMobileNumber(idx, 'ported', e.target.checked)}
                                              disabled={mob.novo || false}
                                              className="w-4 h-4 rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900 disabled:opacity-40 disabled:cursor-not-allowed"
                                            />
                                            <Label htmlFor={`mob_ported_${idx}`} className={`cursor-pointer text-sm ${mob.novo ? 'text-slate-600' : 'text-white'}`}>Portado</Label>
                                          </div>
                                        </div>
                                        {mob.ported && !mob.novo && (
                                          <div>
                                            <Label className="text-xs font-semibold mb-1 text-slate-400">CVP *</Label>
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
                    </FormSection>
                  )}
                </>
              )}

              {formData.scope === 'solar' && (
                <FormSection icon={Zap} title="Detalhes Solar" gradient="from-cyber-500 to-cyber-600">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <Label className="text-sm font-semibold mb-2 text-slate-400">CPE * (PT0002...)</Label>
                      <Input
                        value={formData.cpe}
                        onChange={(e) => setFormData({...formData, cpe: e.target.value.toUpperCase()})}
                        placeholder="PT0002XXXXXXXXXXXX"
                        required
                        className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-semibold mb-2 text-slate-400">Potência *</Label>
                      <Select
                        value={formData.power}
                        onValueChange={(v) => setFormData({...formData, power: v})}
                      >
                        <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {POWER_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </FormSection>
              )}

              {formData.scope === 'energia' && formData.operator_id && (
                <FormSection icon={Zap} title="Detalhes Energia" gradient="from-cyber-500 to-cyber-600">
                  {(() => {
                    const saleType = operatorEnergyType === 'dual' ? formData.energy_sale_type : operatorEnergyType;

                    if (!saleType) return null;

                    return (
                      <>
                        <EnergyPointsManager
                          saleType={saleType}
                          points={formData.energy_points}
                          onChange={(points) => {
                            setFormData({...formData, energy_points: points});
                          }}
                          isNew={true}
                          user={user}
                        />

                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className={currentOperator?.requires_voltage_type ? "col-span-1" : "col-span-1 sm:col-span-2"}>
                            <Label className="text-sm font-semibold mb-2 text-slate-400">Tipo de Entrada *</Label>
                            <Select
                              value={formData.entry_type}
                              onValueChange={(v) => setFormData({...formData, entry_type: v})}
                            >
                              <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white">
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Alteração de comercializadora">Alteração de comercializadora</SelectItem>
                                <SelectItem value="Alteração de comercializadora com alteração de titular">Alteração de comercializadora com alteração de titular</SelectItem>
                                <SelectItem value="Entrada Direta">Entrada Direta</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {currentOperator?.requires_voltage_type && (
                            <div>
                              <Label className="text-sm font-semibold mb-2 text-slate-400">Tipo de Tensão *</Label>
                              <Select
                                value={formData.voltage_type}
                                onValueChange={(v) => setFormData({...formData, voltage_type: v})}
                              >
                                <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white">
                                  <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Monofásico">Monofásico</SelectItem>
                                  <SelectItem value="Trifásico">Trifásico</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>

                        {currentOperator?.requires_additional_services && (
                          <div className="mt-4">
                            <Label className="text-sm font-semibold mb-2 text-slate-400">Serviços Adicionais *</Label>
                            <Textarea
                              value={formData.additional_services}
                              onChange={(e) => setFormData({...formData, additional_services: e.target.value})}
                              placeholder="Descreva os serviços adicionais contratados..."
                              rows={3}
                              className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white resize-none"
                            />
                          </div>
                        )}
                      </>
                    );
                  })()}
                </FormSection>
              )}

              {currentOperator && (currentOperator.pays_direct_debit || currentOperator.pays_electronic_invoice) && (
                <div className="border-t border-dark-700 pt-6">
                  <FormSection icon={CreditCard} title="Adesões do Cliente" gradient="from-cyber-500 to-cyber-600">
                    <div className="bg-dark-900 border border-dark-700 rounded-xl p-5 space-y-3">
                      {currentOperator.pays_direct_debit && (
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            id="has_direct_debit"
                            checked={formData.has_direct_debit}
                            onChange={(e) => setFormData({...formData, has_direct_debit: e.target.checked})}
                            className="w-5 h-5 rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900"
                          />
                          <Label htmlFor="has_direct_debit" className="cursor-pointer font-medium text-white">
                            Cliente aderiu a Débito Direto (DD)
                          </Label>
                        </div>
                      )}
                      {currentOperator.pays_electronic_invoice && (
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            id="has_electronic_invoice"
                            checked={formData.has_electronic_invoice}
                            onChange={(e) => setFormData({...formData, has_electronic_invoice: e.target.checked})}
                            className="w-5 h-5 rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900"
                          />
                          <Label htmlFor="has_electronic_invoice" className="cursor-pointer font-medium text-white">
                            Cliente aderiu a Fatura Eletrónica (FE)
                          </Label>
                        </div>
                      )}
                      <p className="text-xs mt-3 text-slate-500">
                        Valores adicionais serão somados à comissão conforme configuração da operadora
                      </p>
                    </div>
                  </FormSection>
                </div>
              )}

              <div className="border-t border-dark-700 my-6" />

              <FormSection icon={FileText} title="Informações Adicionais" gradient="from-cyber-500 to-cyber-600">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 p-5 bg-dark-900 border border-dark-700 rounded-xl">
                    <input
                      type="checkbox"
                      id="is_proposal"
                      checked={formData.is_proposal}
                      onChange={(e) => setFormData({...formData, is_proposal: e.target.checked})}
                      className="w-5 h-5 rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900"
                    />
                    <Label htmlFor="is_proposal" className="cursor-pointer font-medium text-white">
                      Esta venda é uma proposta?
                    </Label>
                  </div>
                  <p className="text-xs text-slate-500">
                    Propostas ficam no estado "Em proposta" e aparecem apenas no separador Propostas
                  </p>

                  <div>
                    <Label className="text-sm font-semibold mb-2 text-slate-400">Observações</Label>
                    <Textarea
                      value={formData.observations}
                      onChange={(e) => setFormData({...formData, observations: e.target.value})}
                      rows={4}
                      className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                      placeholder="Notas adicionais sobre esta venda..."
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Label className="text-sm font-semibold text-slate-400">
                        Documentos {(() => {
                          const selectedPartner = partners.find(p => p.id === formData.partner_id);
                          const isD2D = selectedPartner && selectedPartner.partner_type === 'D2D';
                          return isD2D ? '*' : '(opcional)';
                        })()}
                      </Label>
                      {formData.scope === 'energia' && mandatoryAttachmentInfo && (
                        <button
                          type="button"
                          onClick={() => setAttachmentInfoOpen(true)}
                          className="text-cyber-400 hover:text-cyber-300 transition-colors"
                          title="Ver anexos obrigatórios por operadora"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-start">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.txt,.heic,.heif"
                          onChange={handleFileSelected}
                          className="flex-1 min-w-0 block text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-cyber-500/10 file:text-cyber-400 hover:file:bg-cyber-500/20 transition-colors cursor-pointer"
                        />
                        <Button
                          type="button"
                          onClick={handleAddFile}
                          disabled={!pendingFile}
                          size="sm"
                          className="shrink-0 bg-cyber-500 hover:bg-cyber-600 text-white disabled:opacity-40 w-full sm:w-auto"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Adicionar
                        </Button>
                      </div>

                      {pendingFile && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                          <span className="text-xs text-amber-300 flex-1 truncate">
                            "{pendingFile.name}" selecionado mas nao adicionado — clique em Adicionar
                          </span>
                        </div>
                      )}

                      {uploadFiles.length > 0 && (
                        <div className="space-y-1">
                          {uploadFiles.map((file, idx) => (
                            <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-900 border border-dark-700">
                              <FileText className="w-4 h-4 text-cyber-400 shrink-0" />
                              <span className="text-sm text-slate-300 flex-1 truncate">{file.name}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveFile(idx)}
                                className="text-slate-500 hover:text-red-400 transition-colors shrink-0"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <p className="text-xs text-slate-500">Tamanho maximo por ficheiro: 10MB</p>
                      {(() => {
                        const selectedPartner = partners.find(p => p.id === formData.partner_id);
                        const isD2D = selectedPartner && selectedPartner.partner_type === 'D2D';
                        return isD2D && (
                          <p className="text-xs text-orange-400 font-medium">
                            Obrigatorio para parceiros D2D - Aceita fotos da camara
                          </p>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </FormSection>
            </form>
          </div>

          <div className="sticky bottom-0 z-10 bg-dark-850 border-t border-dark-700 px-4 sm:px-8 py-4 sm:py-6">
            <div className="flex justify-end gap-3 sm:gap-4">
              <Button
                type="button"
                onClick={() => { setPendingFile(null); onClose(); }}
                variant="outline"
                className="px-6 py-3 rounded-xl font-semibold bg-dark-900 border-dark-700 text-slate-300 hover:bg-dark-800"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                onClick={handleSubmitWithCheck}
                disabled={formData.operator_id && operatorCommissions.length === 0}
                className="bg-gradient-to-r from-cyber-500 to-cyber-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:shadow-cyber-500/25"
              >
                <Plus className="w-5 h-5 mr-2" />
                Criar Venda
              </Button>
            </div>
          </div>
        </motion.div>
      </div>

      {attachmentInfoOpen && mandatoryAttachmentInfo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setAttachmentInfoOpen(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-dark-850 border border-cyber-500/20 rounded-2xl shadow-2xl max-w-lg w-full p-6 z-10"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-base">Anexos Obrigatórios por Operadora</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Sempre que possível em PDF e num único ficheiro com tamanho máximo de 5Mb</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAttachmentInfoOpen(false)}
                className="text-slate-400 hover:text-white transition-colors ml-3 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-dark-900 border border-dark-700 rounded-xl p-4">
                <h4 className="text-cyber-400 font-semibold text-sm mb-2">{mandatoryAttachmentInfo.title}</h4>
                <ul className="space-y-2">
                  {mandatoryAttachmentInfo.items.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-cyber-500 mt-1 shrink-0">•</span>
                      <span className="text-slate-300 text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <Button
                type="button"
                onClick={() => setAttachmentInfoOpen(false)}
                className="bg-gradient-to-r from-cyber-500 to-cyber-600 text-white font-semibold"
              >
                Entendido
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default SaleFormDialog;
