import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Shield, Plus, Pencil, Trash2, RefreshCw, Calendar, ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { retentionService } from "../services/retentionService";
import { partnersService } from "../services/partnersService";
import { useConfirm } from "@/components/ui/confirm-dialog";

const MONTHS = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Marco' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

const YEARS = Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 3 + i);

const emptyForm = () => {
  const now = new Date();
  const refDate = new Date(now.getFullYear(), now.getMonth() + 6, 1);
  return {
    partner_id: "",
    amount: "",
    reference_month: now.getMonth() + 1,
    reference_year: now.getFullYear(),
    refund_month: refDate.getMonth() + 1,
    refund_year: refDate.getFullYear(),
    description: "",
  };
};

const RetentionManager = ({ user }) => {
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedPartnerId, setExpandedPartnerId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [formData, setFormData] = useState(emptyForm());

  const { data: partners = [] } = useQuery({
    queryKey: ['partners'],
    queryFn: () => partnersService.getAll(),
    staleTime: 10 * 60 * 1000,
  });

  const { data: overview = [], isLoading: overviewLoading } = useQuery({
    queryKey: ['retentionOverview'],
    queryFn: () => retentionService.getRetentionOverview(),
    staleTime: 30 * 1000,
  });

  const { data: partnerEntries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ['retentionEntries', expandedPartnerId],
    queryFn: () => retentionService.getEntriesByPartner(expandedPartnerId),
    enabled: !!expandedPartnerId,
    staleTime: 30 * 1000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['retentionEntries'] });
    queryClient.invalidateQueries({ queryKey: ['retentionOverview'] });
  };

  const createMutation = useMutation({
    mutationFn: (data) => retentionService.create(data),
    onSuccess: (_data, variables) => {
      toast.success('Retencao adicionada com sucesso');
      invalidate();
      setExpandedPartnerId(variables.partner_id);
      closeForm();
    },
    onError: (err) => toast.error(err.message || 'Erro ao adicionar retencao'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) => retentionService.update(id, updates),
    onSuccess: () => {
      toast.success('Retencao atualizada com sucesso');
      invalidate();
      closeForm();
    },
    onError: (err) => toast.error(err.message || 'Erro ao atualizar retencao'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => retentionService.delete(id),
    onSuccess: () => {
      toast.success('Retencao eliminada');
      invalidate();
    },
    onError: (err) => toast.error(err.message || 'Erro ao eliminar retencao'),
  });

  const syncMutation = useMutation({
    mutationFn: ({ partnerId, month, year }) => retentionService.syncSalesRetentions(partnerId, month, year),
    onSuccess: (result, variables) => {
      if (result.alreadyExists) toast.info('Ja existem retencoes sincronizadas para este periodo');
      else if (result.noRetention) toast.info('Nenhuma retencao encontrada nas vendas para este periodo');
      else toast.success(`${result.synced} vendas sincronizadas. Total: €${result.total.toFixed(2)}`);
      invalidate();
      setExpandedPartnerId(variables.partnerId);
    },
    onError: (err) => toast.error(err.message || 'Erro ao sincronizar retencoes'),
  });

  const openAddForm = (partnerId = "") => {
    setEditingEntry(null);
    const base = emptyForm();
    setFormData({ ...base, partner_id: partnerId });
    setShowForm(true);
  };

  const openEditForm = (entry) => {
    setEditingEntry(entry);
    setFormData({
      partner_id: entry.partner_id,
      amount: entry.amount.toString(),
      reference_month: entry.reference_month,
      reference_year: entry.reference_year,
      refund_month: entry.refund_month,
      refund_year: entry.refund_year,
      description: entry.description || "",
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingEntry(null);
    setFormData(emptyForm());
  };

  const handleSubmit = () => {
    if (!formData.partner_id) {
      toast.error("Selecione um parceiro");
      return;
    }
    const amount = parseFloat(formData.amount);
    if (!amount || amount <= 0) {
      toast.error("Indique um valor de retencao valido");
      return;
    }
    if (!formData.refund_month || !formData.refund_year) {
      toast.error("Indique o mes/ano de devolucao");
      return;
    }

    const payload = {
      partner_id: formData.partner_id,
      amount,
      reference_month: parseInt(formData.reference_month),
      reference_year: parseInt(formData.reference_year),
      refund_month: parseInt(formData.refund_month),
      refund_year: parseInt(formData.refund_year),
      description: formData.description || null,
      source: 'manual',
    };

    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, updates: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = async (entry) => {
    if (entry.refunded) {
      toast.error("Nao e possivel eliminar retencoes ja devolvidas");
      return;
    }
    const ok = await confirm({
      title: 'Eliminar retencao',
      description: `Eliminar retencao de €${parseFloat(entry.amount).toFixed(2)}?`,
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;
    deleteMutation.mutate(entry.id);
  };

  const filteredOverview = overview.filter(p =>
    !searchTerm || p.partner_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedFormPartner = partners.find(p => p.id === formData.partner_id);

  return (
    <div className="space-y-5">
      {confirmDialog}

      <Card className="bg-dark-850 border border-white/[0.06]">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-white">
              <Shield className="w-5 h-5 text-amber-400" />
              Gestao de Retencoes por Parceiro
            </CardTitle>
            <CardDescription className="text-slate-400 mt-1">
              Consulte, adicione e ajuste as retencoes de cada parceiro e defina o mes em que se emite a devolucao
            </CardDescription>
          </div>
          <Button
            onClick={() => openAddForm()}
            className="bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shrink-0"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Adicionar Retencao Manual
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showForm && (
            <div className="p-4 bg-dark-900 border border-amber-500/30 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white">
                  {editingEntry ? 'Editar Retencao' : 'Nova Retencao Manual'}
                </h4>
                <Button size="icon" variant="ghost" onClick={closeForm} className="h-7 w-7 text-slate-400">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div>
                <Label className="text-xs text-slate-400 mb-1 block">Parceiro *</Label>
                <Select
                  value={formData.partner_id}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, partner_id: v }))}
                  disabled={!!editingEntry}
                >
                  <SelectTrigger className="bg-dark-850 border-dark-700 h-9">
                    <SelectValue placeholder="Selecione um parceiro..." />
                  </SelectTrigger>
                  <SelectContent>
                    {partners.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} {p.partner_type ? `(${p.partner_type})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs text-slate-400 mb-1 block">Valor (€) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    className="bg-dark-850 border-dark-700 text-white h-9"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-400 mb-1 block">Mes Ref. (vendas)</Label>
                  <Select
                    value={formData.reference_month?.toString()}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, reference_month: parseInt(v) }))}
                  >
                    <SelectTrigger className="bg-dark-850 border-dark-700 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map(m => (
                        <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-slate-400 mb-1 block">Ano Ref.</Label>
                  <Select
                    value={formData.reference_year?.toString()}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, reference_year: parseInt(v) }))}
                  >
                    <SelectTrigger className="bg-dark-850 border-dark-700 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {YEARS.map(y => (
                        <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div />
                <div>
                  <Label className="text-xs text-amber-400 mb-1 block">Mes Devolucao *</Label>
                  <Select
                    value={formData.refund_month?.toString() || ""}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, refund_month: parseInt(v) }))}
                  >
                    <SelectTrigger className="bg-dark-850 border-amber-500/30 h-9">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map(m => (
                        <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-amber-400 mb-1 block">Ano Devolucao *</Label>
                  <Select
                    value={formData.refund_year?.toString() || ""}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, refund_year: parseInt(v) }))}
                  >
                    <SelectTrigger className="bg-dark-850 border-amber-500/30 h-9">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {YEARS.map(y => (
                        <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs text-slate-400 mb-1 block">Descricao (opcional)</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Nota sobre esta retencao..."
                  className="bg-dark-850 border-dark-700 text-white min-h-[60px] text-sm"
                />
              </div>

              {selectedFormPartner && (
                <p className="text-xs text-slate-500">
                  A adicionar retencao ao parceiro <span className="text-slate-300 font-medium">{selectedFormPartner.name}</span>.
                  Sera devolvida no auto de <span className="text-amber-400 font-medium">
                    {MONTHS.find(m => m.value === parseInt(formData.refund_month))?.label}/{formData.refund_year}
                  </span>.
                </p>
              )}

              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={closeForm} className="border-dark-600 text-slate-300">
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700"
                >
                  {editingEntry ? 'Guardar Alteracoes' : 'Adicionar Retencao'}
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Pesquisar parceiro..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-dark-900 border-dark-700 text-white"
              />
            </div>
            <div className="text-xs text-slate-500">
              {overview.length} parceiro(s) com retencoes
            </div>
          </div>

          {overviewLoading ? (
            <div className="py-8 text-center text-slate-500">Carregando...</div>
          ) : filteredOverview.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              <Shield className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p>Nenhuma retencao registada</p>
              <p className="text-xs text-slate-500 mt-1">Use o botao "Adicionar Retencao Manual" para comecar</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredOverview.map(item => {
                const isExpanded = expandedPartnerId === item.partner_id;
                return (
                  <div key={item.partner_id} className="rounded-lg border border-dark-700 overflow-hidden">
                    <button
                      onClick={() => setExpandedPartnerId(isExpanded ? null : item.partner_id)}
                      className="w-full flex items-center justify-between p-3.5 bg-dark-900 hover:bg-dark-800 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-white">{item.partner_name}</span>
                        <Badge variant="outline" className="text-xs border-dark-600 text-slate-400">
                          {item.partner_type}
                        </Badge>
                        <span className="text-xs text-slate-500">{item.entries_count} entrada(s)</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-xs text-slate-500 mr-2">Pendente:</span>
                          <span className="font-semibold text-amber-400">€{item.total_pending.toFixed(2)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-slate-500 mr-2">Devolvido:</span>
                          <span className="font-semibold text-green-400">€{item.total_refunded.toFixed(2)}</span>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-dark-700 bg-dark-850 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-300">Entradas de retencao</span>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => syncMutation.mutate({
                                partnerId: item.partner_id,
                                month: new Date().getMonth() + 1,
                                year: new Date().getFullYear(),
                              })}
                              disabled={syncMutation.isPending}
                              className="border-dark-600 text-slate-300 hover:border-amber-500/30 hover:text-amber-400"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                              Sincronizar Vendas
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => openAddForm(item.partner_id)}
                              className="bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20"
                            >
                              <Plus className="w-3.5 h-3.5 mr-1.5" />
                              Adicionar
                            </Button>
                          </div>
                        </div>

                        {entriesLoading ? (
                          <div className="py-4 text-center text-slate-500 text-sm">Carregando entradas...</div>
                        ) : partnerEntries.length === 0 ? (
                          <div className="py-4 text-center text-slate-500 text-sm">Nenhuma entrada registada</div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-dark-700">
                                  <th className="text-left p-2 text-slate-400 font-medium">Ref.</th>
                                  <th className="text-left p-2 text-slate-400 font-medium">Valor</th>
                                  <th className="text-left p-2 text-slate-400 font-medium">Devolucao</th>
                                  <th className="text-left p-2 text-slate-400 font-medium">Origem</th>
                                  <th className="text-left p-2 text-slate-400 font-medium">Descricao</th>
                                  <th className="text-left p-2 text-slate-400 font-medium">Estado</th>
                                  <th className="text-right p-2 text-slate-400 font-medium">Acoes</th>
                                </tr>
                              </thead>
                              <tbody>
                                {partnerEntries.map(entry => (
                                  <tr key={entry.id} className="border-b border-dark-700/50 hover:bg-dark-800/50 transition-colors">
                                    <td className="p-2 text-slate-300">
                                      {MONTHS.find(m => m.value === entry.reference_month)?.label?.substring(0, 3)}/{entry.reference_year}
                                    </td>
                                    <td className="p-2 font-medium text-amber-400">€{parseFloat(entry.amount).toFixed(2)}</td>
                                    <td className="p-2 text-slate-300">
                                      <span className="inline-flex items-center gap-1">
                                        <Calendar className="w-3 h-3 text-slate-500" />
                                        {MONTHS.find(m => m.value === entry.refund_month)?.label?.substring(0, 3)}/{entry.refund_year}
                                      </span>
                                    </td>
                                    <td className="p-2">
                                      <Badge
                                        variant="outline"
                                        className={entry.source === 'manual'
                                          ? 'border-blue-500/30 text-blue-400 text-xs'
                                          : 'border-slate-600 text-slate-400 text-xs'}
                                      >
                                        {entry.source === 'manual' ? 'Manual' : 'Vendas'}
                                      </Badge>
                                    </td>
                                    <td className="p-2 text-slate-400 text-xs max-w-[200px] truncate">{entry.description || '-'}</td>
                                    <td className="p-2">
                                      {entry.refunded ? (
                                        <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-xs">Devolvido</Badge>
                                      ) : (
                                        <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs">Pendente</Badge>
                                      )}
                                    </td>
                                    <td className="p-2 text-right">
                                      {!entry.refunded && (
                                        <div className="flex gap-1 justify-end">
                                          <Button size="icon" variant="ghost" onClick={() => openEditForm(entry)} className="h-7 w-7 text-slate-400 hover:text-white">
                                            <Pencil className="w-3.5 h-3.5" />
                                          </Button>
                                          <Button size="icon" variant="ghost" onClick={() => handleDelete(entry)} className="h-7 w-7 text-slate-400 hover:text-red-400">
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </Button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RetentionManager;
