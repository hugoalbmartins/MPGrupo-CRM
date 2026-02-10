import React from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Clock, Building2, User, Phone, MapPin, CreditCard, FileText, DollarSign, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

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
    <div className="space-y-4 pl-13">
      {children}
    </div>
  </motion.div>
);

const FieldGroup = ({ label, children, colSpan, hint, locked }) => (
  <div className={colSpan === 2 ? "col-span-2" : ""}>
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
}) => {
  const update = (field, value) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
  };

  const saleOperator = operators.find(op => op.id === editFormData.operator_id);
  const canEditCommission = user?.role === 'admin';
  const hasAutomaticCommission = saleOperator?.commission_mode !== 'manual' && editFormData.scope !== 'solar';
  const commissionChanged = editFormData.manual_commission !== (editingSale?.manual_commission || '');
  const isRefid = editFormData.service_type === 'REFID' || editFormData.service_type === 'Refid';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden bg-dark-850 border border-cyber-500/10 flex flex-col p-0">
        <div className="sticky top-0 z-10 bg-dark-850 border-b border-dark-700 px-8 py-6">
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
          <div className="overflow-y-auto flex-1 px-8 py-6 scrollbar-modern">
            <div className="space-y-8">
              <FormSection icon={User} title="Identificação do Cliente" gradient="from-cyber-500 to-cyber-600">
                <div className="grid grid-cols-2 gap-6">
                  <FieldGroup label="Nome" locked>
                    <Input value={editFormData.client_name} disabled className="bg-dark-900 border-dark-700 text-white opacity-60 cursor-not-allowed" />
                  </FieldGroup>
                  <FieldGroup label="NIF" locked>
                    <Input value={editFormData.client_nif} disabled className="bg-dark-900 border-dark-700 text-white opacity-60 cursor-not-allowed" />
                  </FieldGroup>
                </div>
              </FormSection>

              <FormSection icon={Clock} title="Informações Gerais" gradient="from-cyber-500 to-cyber-600">
                <div className="grid grid-cols-2 gap-6">
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
                      onValueChange={(v) => update('partner_id', v === "admin_commissioned" ? null : v)}
                    >
                      <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {user?.is_commissioned && (
                          <SelectItem value="admin_commissioned">Venda Propria (Admin Comissionado)</SelectItem>
                        )}
                        {partners.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
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
                <div className="grid grid-cols-2 gap-6">
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
                <div className="grid grid-cols-2 gap-6">
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
                <div className="grid grid-cols-2 gap-6">
                  <FieldGroup label="Morada" colSpan={2} locked>
                    <Input value={editFormData.street} disabled className="bg-dark-900 border-dark-700 text-slate-500 opacity-60 cursor-not-allowed" />
                  </FieldGroup>

                  <FieldGroup label="Codigo Postal" locked>
                    <Input value={editFormData.postal_code} disabled className="bg-dark-900 border-dark-700 text-slate-500 opacity-60 cursor-not-allowed" />
                  </FieldGroup>

                  <FieldGroup label="Localidade" locked>
                    <Input value={editFormData.locality} disabled className="bg-dark-900 border-dark-700 text-slate-500 opacity-60 cursor-not-allowed" />
                  </FieldGroup>

                  <FieldGroup label="Morada de Instalacao" colSpan={2} locked>
                    <Input value={editFormData.installation_address} disabled className="bg-dark-900 border-dark-700 text-slate-500 opacity-60 cursor-not-allowed" />
                  </FieldGroup>
                </div>
              </FormSection>

            {/* Telecom fields */}
            {editFormData.scope === 'telecomunicacoes' && (
              <FormSection icon={Phone} title="Detalhes Telecomunicações" gradient="from-cyber-500 to-cyber-600">
                <div className="grid grid-cols-2 gap-6">
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
                    <Select value={editFormData.activation_type} onValueChange={(v) => update('activation_type', v)}>
                      <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M2">M2</SelectItem>
                        <SelectItem value="M3">M3</SelectItem>
                        <SelectItem value="M4">M4</SelectItem>
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

                  <div className="col-span-2 pt-3">
                    <Label className="text-slate-400 text-sm font-semibold block mb-3">Servicos Contratados</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                      <div>
                        <Label htmlFor="edit_mobile_count" className="text-slate-400 text-sm">Moveis</Label>
                        <Input
                          id="edit_mobile_count"
                          type="number"
                          min="0"
                          value={editFormData.mobile_count}
                          onChange={(e) => update('mobile_count', parseInt(e.target.value) || 0)}
                          className="mt-1 bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </FormSection>
            )}

            {/* Solar fields */}
            {editFormData.scope === 'solar' && (
              <FormSection icon={Zap} title="Detalhes Solar" gradient="from-cyber-500 to-cyber-600">
                <div className="grid grid-cols-2 gap-6">
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
                <div className="grid grid-cols-2 gap-6">
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
              </FormSection>
            )}

            <FormSection icon={CreditCard} title="Serviços Adicionais" gradient="from-cyber-500 to-cyber-600">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2 flex items-center gap-6">
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
              <div className="grid grid-cols-2 gap-6">
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

            <FormSection icon={CreditCard} title="Pagamento" gradient="from-cyber-500 to-cyber-600">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2 flex flex-col gap-2">
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

            <FormSection icon={DollarSign} title="Comissão" gradient="from-cyber-500 to-cyber-600">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
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
            </div>
          </div>

          {/* Actions */}
          <div className="sticky bottom-0 bg-dark-850 border-t border-dark-700 px-8 py-4">
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="bg-dark-900 border-dark-700 text-slate-300 hover:bg-dark-800">
                Cancelar
              </Button>
              <Button type="submit" className="bg-gradient-to-r from-cyber-500 to-cyber-600 text-white font-semibold hover:shadow-lg hover:shadow-cyber-500/25">
                Guardar Alteracoes
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SaleEditDialog;
