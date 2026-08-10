import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Shield, Plus, Pencil, Trash2, RefreshCw, ArrowDownUp, Calendar, ChevronDown, ChevronUp, Search } from "lucide-react";
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

const RetentionManager = ({ user }) => {
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedPartners, setExpandedPartners] = useState({});

  const [formData, setFormData] = useState({
    amount: "",
    reference_month: new Date().getMonth() + 1,
    reference_year: new Date().getFullYear(),
    refund_month: "",
    refund_year: "",
    description: "",
  });

  useEffect(() => {
    if (formData.reference_month && formData.reference_year && !formData.refund_month) {
      const refDate = new Date(formData.reference_year, formData.reference_month - 1 + 6, 1);
      setFormData(prev => ({
        ...prev,
        refund_month: refDate.getMonth() + 1,
        refund_year: refDate.getFullYear(),
      }));
    }
  }, [formData.reference_month, formData.reference_year]);

  const { data: partners = [] } = useQuery({
    queryKey: ['partners'],
    queryFn: () => partnersService.getAll(),
    staleTime: 10 * 60 * 1000,
  });

  const { data: overview = [], isLoading: overviewLoading, refetch: refetchOverview } = useQuery({
    queryKey: ['retentionOverview'],
    queryFn: () => retentionService.getRetentionOverview(),
    staleTime: 2 * 60 * 1000,
  });

  const { data: partnerEntries = [], isLoading: entriesLoading, refetch: refetchEntries } = useQuery({
    queryKey: ['retentionEntries', selectedPartnerId],
    queryFn: () => retentionService.getEntriesByPartner(selectedPartnerId),
    enabled: !!selectedPartnerId,
    staleTime: 1 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (data) => retentionService.create(data),
    onSuccess: () => {
      toast.success('Retencao adicionada com sucesso');
      queryClient.invalidateQueries({ queryKey: ['retentionEntries'] });
      queryClient.invalidateQueries({ queryKey: ['retentionOverview'] });
      resetForm();
    },
    onError: (err) => toast.error(err.message || 'Erro ao adicionar retencao'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) => retentionService.update(id, updates),
    onSuccess: () => {
      toast.success('Retencao atualizada com sucesso');
      queryClient.invalidateQueries({ queryKey: ['retentionEntries'] });
      queryClient.invalidateQueries({ queryKey: ['retentionOverview'] });
      setEditingEntry(null);
      resetForm();
    },
    onError: (err) => toast.error(err.message || 'Erro ao atualizar retencao'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => retentionService.delete(id),
    onSuccess: () => {
      toast.success('Retencao eliminada com sucesso');
      queryClient.invalidateQueries({ queryKey: ['retentionEntries'] });
      queryClient.invalidateQueries({ queryKey: ['retentionOverview'] });
    },
    onError: (err) => toast.error(err.message || 'Erro ao eliminar retencao'),
  });

  const syncMutation = useMutation({
    mutationFn: ({ partnerId, month, year }) =>
      retentionService.syncSalesRetentions(partnerId, month, year),
    onSuccess: (result) => {
      if (result.alreadyExists) {
        toast.info('Ja existem retencoes sincronizadas para este periodo');
      } else if (result.noRetention) {
        toast.info('Nenhuma retencao encontrada nas vendas para este periodo');
      } else {
        toast.success(`${result.synced} vendas sincronizadas. Total: €${result.total.toFixed(2)}`);
      }
      queryClient.invalidateQueries({ queryKey: ['retentionEntries'] });
      queryClient.invalidateQueries({ queryKey: ['retentionOverview'] });
    },
    onError: (err) => toast.error(err.message || 'Erro ao sincronizar retencoes'),
  });

  const resetForm = () => {
    setShowAddForm(false);
    setEditingEntry(null);
    const refDate = new Date(new Date().getFullYear(), new Date().getMonth() + 6, 1);
    setFormData({
      amount: "",
      reference_month: new Date().getMonth() + 1,
      reference_year: new Date().getFullYear(),
      refund_month: refDate.getMonth() + 1,
      refund_year: refDate.getFullYear(),
      description: "",
    });
  };

  const handleSubmit = () => {
    const amount = parseFloat(formData.amount);
    if (!amount || amount <= 0) {
      toast.error("Indique um valor de retencao valido");
      return;
    }
    if (!selectedPartnerId) {
      toast.error("Selecione um parceiro");
      return;
    }
    if (!formData.refund_month || !formData.refund_year) {
      toast.error("Indique o mes/ano de devolucao");
      return;
    }

    if (editingEntry) {
      updateMutation.mutate({
        id: editingEntry.id,
        updates: {
          amount,
          refund_month: parseInt(formData.refund_month),
          refund_year: parseInt(formData.refund_year),
          reference_month: parseInt(formData.reference_month),
          reference_year: parseInt(formData.reference_year),
          description: formData.description,
        },
      });
    } else {
      createMutation.mutate({
        partner_id: selectedPartnerId,
        amount,
        refund_month: parseInt(formData.refund_month),
        refund_year: parseInt(formData.refund_year),
        reference_month: parseInt(formData.reference_month),
        reference_year: parseInt(formData.reference_year),
        description: formData.description,
        source: 'manual',
      });
    }
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setShowAddForm(true);
    setFormData({
      amount: entry.amount.toString(),
      reference_month: entry.reference_month,
      reference_year: entry.reference_year,
      refund_month: entry.refund_month,
      refund_year: entry.refund_year,
      description: entry.description || "",
    });
  };

  const handleDelete = async (entry) => {
    if (entry.refunded) {
      toast.error("Nao e possivel eliminar retencoes ja devolvidas");
      return;
    }
    const ok = await confirm({
      title: 'Eliminar retencao',
      description: `Tem a certeza que deseja eliminar esta retencao de €${parseFloat(entry.amount).toFixed(2)}?`,
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;
    deleteMutation.mutate(entry.id);
  };

  const handleSync = async () => {
    if (!selectedPartnerId) {
      toast.error("Selecione um parceiro primeiro");
      return;
    }
    syncMutation.mutate({
      partnerId: selectedPartnerId,
      month: formData.reference_month,
      year: formData.reference_year,
    });
  };

  const togglePartnerExpand = (partnerId) => {
    setExpandedPartners(prev => ({ ...prev, [partnerId]: !prev[partnerId] }));
    if (!expandedPartners[partnerId]) {
      setSelectedPartnerId(partnerId);
    }
  };

  const filteredOverview = overview.filter(p =>
    !searchTerm || p.partner_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const partnersWithRetention = partners.filter(p =>
    overview.some(o => o.partner_id === p.id)
  );
  const partnersWithoutRetention = partners.filter(p =>
    !overview.some(o => o.partner_id === p.id)
  );

  return (
    <div className="space-y-5">
      {confirmDialog}

      <Card className="bg-dark-850 border border-white/[0.06]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Shield className="w-5 h-5 text-amber-400" />
            Gestao de Retencoes por Parceiro
          </CardTitle>
          <CardDescription className="text-slate-400">
            Consulte e gira as retencoes de cada parceiro, adicione valores manuais e defina o mes de devolucao
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
          ) : filteredOverview.length === 0 && !searchTerm ? (
            <div className="py-8 text-center text-slate-400">
              <Shield className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p>Nenhuma retencao registada</p>
              <p className="text-xs text-slate-500 mt-1">Selecione um parceiro abaixo para adicionar retencoes</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredOverview.map(item => (
                <div key={item.partner_id} className="rounded-lg border border-dark-700 overflow-hidden">
                  <button
                    onClick={() => togglePartnerExpand(item.partner_id)}
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
                      {expandedPartners[item.partner_id] ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {expandedPartners[item.partner_id] && selectedPartnerId === item.partner_id && (
                    <div className="border-t border-dark-700 bg-dark-850 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-300">Entradas de retencao</span>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleSync}
                            disabled={syncMutation.isPending}
                            className="border-dark-600 text-slate-300 hover:border-amber-500/30 hover:text-amber-400"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                            Sincronizar Vendas
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => { resetForm(); setShowAddForm(true); }}
                            className="bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1.5" />
                            Adicionar Retencao
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
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => handleEdit(entry)}
                                          className="h-7 w-7 text-slate-400 hover:text-white"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => handleDelete(entry)}
                                          className="h-7 w-7 text-slate-400 hover:text-red-400"
                                        >
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

                      {showAddForm && (
                        <div className="mt-3 p-4 bg-dark-900 border border-amber-500/20 rounded-lg space-y-3">
                          <h4 className="text-sm font-semibold text-white">
                            {editingEntry ? 'Editar Retencao' : 'Adicionar Retencao Manual'}
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                              <Label className="text-xs text-slate-400 mb-1 block">Valor (€)</Label>
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
                              <Label className="text-xs text-amber-400 mb-1 block">Mes Devolucao (auto)</Label>
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
                              <Label className="text-xs text-amber-400 mb-1 block">Ano Devolucao</Label>
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
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={resetForm}
                              className="border-dark-600 text-slate-300"
                            >
                              Cancelar
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleSubmit}
                              disabled={createMutation.isPending || updateMutation.isPending}
                              className="bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700"
                            >
                              {editingEntry ? 'Guardar Alteracoes' : 'Adicionar'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {partners.length > 0 && (
            <div className="border-t border-dark-700 pt-4">
              <Label className="text-sm text-slate-300 mb-2 block">
                Adicionar retencao para outro parceiro
              </Label>
              <div className="flex gap-2 items-end">
                <div className="flex-1 max-w-sm">
                  <Select
                    value={selectedPartnerId}
                    onValueChange={(v) => {
                      setSelectedPartnerId(v);
                      setExpandedPartners(prev => ({ ...prev, [v]: true }));
                    }}
                  >
                    <SelectTrigger className="bg-dark-900 border-dark-700">
                      <SelectValue placeholder="Selecione um parceiro..." />
                    </SelectTrigger>
                    <SelectContent>
                      {partners.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.partner_type || '-'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedPartnerId && !expandedPartners[selectedPartnerId] && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setExpandedPartners(prev => ({ ...prev, [selectedPartnerId]: true }));
                    }}
                    className="border-dark-600 text-slate-300"
                  >
                    Ver Retencoes
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RetentionManager;
