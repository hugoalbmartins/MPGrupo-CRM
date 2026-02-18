import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { X, Upload, Zap, TrendingUp, Building2, User, Phone, MapPin, CreditCard, FileText, DollarSign, Clock, Plus, AlertCircle, Trash2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import EnergyPointsManager from './EnergyPointsManager';

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
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileSelected = (e) => {
    const MAX_SIZE = 5 * 1024 * 1024;
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    const oversized = files.filter(f => f.size > MAX_SIZE);
    if (oversized.length > 0) {
      toast.error(`Ficheiro(s) excedem o limite de 5MB: ${oversized.map(f => f.name).join(', ')}`);
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

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
          className="relative w-full max-w-5xl max-h-[95vh] overflow-hidden bg-dark-850 border border-cyber-500/10 rounded-2xl shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 z-10 bg-dark-850 border-b border-dark-700 px-8 py-6">
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

          <div className="overflow-y-auto flex-1 px-8 py-6 scrollbar-modern">
            <form onSubmit={onSubmit} className="space-y-8">
              <FormSection icon={Clock} title="Informações Gerais" gradient="from-cyber-500 to-cyber-600">
                <div className="grid grid-cols-2 gap-6">
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
                <div className="grid grid-cols-2 gap-6">
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
                </div>
              </FormSection>

              <div className="border-t border-dark-700 my-6" />

              <FormSection icon={MapPin} title="Morada" gradient="from-cyber-500 to-cyber-600">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
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
                  <div className="col-span-2">
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
                      <div className="grid grid-cols-2 gap-6">
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
                        {availableActivationTypes.length > 0 && (
                          <div>
                            <Label className="text-sm font-semibold mb-2 text-slate-400">Tipo de Ativação *</Label>
                            <Select
                              value={formData.activation_type}
                              onValueChange={(v) => setFormData({...formData, activation_type: v})}
                            >
                              <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white">
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                {availableActivationTypes.map(type => (
                                  <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>

                      {(formData.service_type === 'REFID' || formData.service_type === 'Refid') ? (
                        <div className="bg-cyber-500/10 border border-cyber-500/20 rounded-xl p-5">
                          <h4 className="font-bold mb-4 text-white">
                            Dados REFID - Downsell/Upsell
                          </h4>
                          <div className="grid grid-cols-2 gap-4">
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
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                          <div>
                            <Label htmlFor="mobile_count" className="text-sm font-semibold mb-2 text-slate-400">Móveis</Label>
                            <Input
                              id="mobile_count"
                              type="number"
                              min="0"
                              value={formData.mobile_count}
                              onChange={(e) => setFormData({...formData, mobile_count: parseInt(e.target.value) || 0})}
                              className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                            />
                          </div>
                        </div>
                      </div>
                    </FormSection>
                  )}
                </>
              )}

              {formData.scope === 'solar' && (
                <FormSection icon={Zap} title="Detalhes Solar" gradient="from-cyber-500 to-cyber-600">
                  <div className="grid grid-cols-2 gap-6">
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
                        />

                        <div className="mt-4">
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
                    <Label className="text-sm font-semibold mb-2 text-slate-400">
                      Documentos {(() => {
                        const selectedPartner = partners.find(p => p.id === formData.partner_id);
                        const isD2D = selectedPartner && selectedPartner.partner_type === 'D2D';
                        return isD2D ? '*' : '(opcional)';
                      })()}
                    </Label>
                    <div className="space-y-3">
                      <div className="flex gap-2 items-start">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                          capture="environment"
                          onChange={handleFileSelected}
                          className="flex-1 block text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-cyber-500/10 file:text-cyber-400 hover:file:bg-cyber-500/20 transition-colors cursor-pointer"
                        />
                        <Button
                          type="button"
                          onClick={handleAddFile}
                          disabled={!pendingFile}
                          size="sm"
                          className="shrink-0 bg-cyber-500 hover:bg-cyber-600 text-white disabled:opacity-40"
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

                      <p className="text-xs text-slate-500">Tamanho maximo por ficheiro: 5MB</p>
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

          <div className="sticky bottom-0 z-10 bg-dark-850 border-t border-dark-700 px-8 py-6">
            <div className="flex justify-end gap-4">
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
    </AnimatePresence>
  );
};

export default SaleFormDialog;
