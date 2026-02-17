import React, { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, CheckCircle, Clock, Wallet, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { partnersService } from "../services/partnersService";
import { advancesService } from "../services/advancesService";

const Advances = ({ user }) => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    partner_id: "",
    amount: "",
    advance_date: new Date().toISOString().split('T')[0],
    notes: "",
  });
  const [filterSettled, setFilterSettled] = useState("all");

  const { data: partners = [] } = useQuery({
    queryKey: ['partners'],
    queryFn: () => partnersService.getAll(),
    staleTime: 10 * 60 * 1000,
  });

  const { data: advances = [], isLoading } = useQuery({
    queryKey: ['advances'],
    queryFn: () => advancesService.getAll(),
    staleTime: 2 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (data) => advancesService.create(data),
    onSuccess: () => {
      toast.success('Adiantamento registado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['advances'] });
      setShowForm(false);
      setForm({ partner_id: "", amount: "", advance_date: new Date().toISOString().split('T')[0], notes: "" });
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao registar adiantamento');
    },
  });

  const settleMutation = useMutation({
    mutationFn: ({ id, userId }) => advancesService.markAsSettled(id, userId),
    onSuccess: () => {
      toast.success('Adiantamento marcado como liquidado');
      queryClient.invalidateQueries({ queryKey: ['advances'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao liquidar adiantamento');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => advancesService.delete(id),
    onSuccess: () => {
      toast.success('Adiantamento eliminado');
      queryClient.invalidateQueries({ queryKey: ['advances'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao eliminar adiantamento');
    },
  });

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">Acesso negado. Apenas administradores podem aceder a esta pagina.</p>
      </div>
    );
  }

  const filteredAdvances = advances.filter(a => {
    if (filterSettled === 'pending') return !a.is_settled;
    if (filterSettled === 'settled') return a.is_settled;
    return true;
  });

  const totalPending = advances
    .filter(a => !a.is_settled)
    .reduce((sum, a) => sum + (parseFloat(a.amount) - parseFloat(a.settled_amount || 0)), 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.partner_id || !form.amount || !form.advance_date) {
      toast.error('Preencha todos os campos obrigatorios');
      return;
    }
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Valor invalido');
      return;
    }
    createMutation.mutate({ ...form, amount });
  };

  const handleSettle = (advance) => {
    if (!window.confirm(`Confirmar liquidacao total do adiantamento de €${parseFloat(advance.amount).toFixed(2)} ao parceiro ${advance.partner?.name}?`)) return;
    settleMutation.mutate({ id: advance.id, userId: user.id });
  };

  const handleDelete = (advance) => {
    if (advance.is_settled) {
      toast.error('Nao e possivel eliminar um adiantamento ja liquidado');
      return;
    }
    if (!window.confirm('Eliminar este adiantamento?')) return;
    deleteMutation.mutate(advance.id);
  };

  return (
    <div className="space-y-6 p-6 animate-fade-in">
      <div className="flex justify-between items-center animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold text-white">Adiantamentos</h1>
          <p className="font-medium mt-1 text-slate-400">Gestao de adiantamentos a parceiros</p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-gradient-to-r from-cyber-500 to-cyber-600 text-white hover:from-cyber-600 hover:to-cyber-700"
        >
          {showForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          {showForm ? 'Cancelar' : 'Novo Adiantamento'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-dark-850 border border-white/[0.06]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Wallet className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Total Pendente</p>
              <p className="text-lg font-bold text-white">€{totalPending.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-dark-850 border border-white/[0.06]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <Clock className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Adiantamentos Pendentes</p>
              <p className="text-lg font-bold text-white">{advances.filter(a => !a.is_settled).length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-dark-850 border border-white/[0.06]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Liquidados</p>
              <p className="text-lg font-bold text-white">{advances.filter(a => a.is_settled).length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {showForm && (
        <Card className="bg-dark-850 border border-cyber-500/30 animate-fade-in">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-cyber-400" />
              Novo Adiantamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Parceiro *</Label>
                <Select value={form.partner_id} onValueChange={(v) => setForm({ ...form, partner_id: v })}>
                  <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500">
                    <SelectValue placeholder="Selecione um parceiro..." />
                  </SelectTrigger>
                  <SelectContent>
                    {partners.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300">Valor (€) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="bg-dark-900 border-dark-700 focus:border-cyber-500 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">Data do Adiantamento *</Label>
                <Input
                  type="date"
                  value={form.advance_date}
                  onChange={(e) => setForm({ ...form, advance_date: e.target.value })}
                  className="bg-dark-900 border-dark-700 focus:border-cyber-500 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">Notas (opcional)</Label>
                <Input
                  placeholder="Observacoes..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="bg-dark-900 border-dark-700 focus:border-cyber-500 text-white"
                />
              </div>
              <div className="md:col-span-2 flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}
                  className="border-dark-700 text-slate-300">
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending}
                  className="bg-gradient-to-r from-cyber-500 to-cyber-600 text-white hover:from-cyber-600 hover:to-cyber-700">
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Registar Adiantamento
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="bg-dark-850 border border-white/[0.06]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Wallet className="w-5 h-5 text-cyber-400" />
              Lista de Adiantamentos
            </CardTitle>
            <Select value={filterSettled} onValueChange={setFilterSettled}>
              <SelectTrigger className="w-40 bg-dark-900 border-dark-700 focus:border-cyber-500">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="settled">Liquidados</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <CardDescription className="text-slate-400">
            Historico de adiantamentos registados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-cyber-400" />
            </div>
          ) : filteredAdvances.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Wallet className="w-12 h-12 text-slate-500 mx-auto mb-3" />
              <p>Nenhum adiantamento encontrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAdvances.map(advance => {
                const pending = parseFloat(advance.amount) - parseFloat(advance.settled_amount || 0);
                return (
                  <div
                    key={advance.id}
                    className={`flex items-center justify-between p-4 rounded-lg transition-all duration-200 ${
                      advance.is_settled
                        ? 'bg-green-500/10 border border-green-500/20'
                        : 'bg-dark-900 border border-dark-700 hover:border-cyber-500/30'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-white">
                          {advance.partner?.name || 'Parceiro Desconhecido'}
                        </span>
                        {advance.is_settled ? (
                          <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Liquidado
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                            <Clock className="w-3 h-3 mr-1" />
                            Pendente
                          </Badge>
                        )}
                        <span className="text-lg font-bold text-white">
                          €{parseFloat(advance.amount).toFixed(2)}
                        </span>
                        {!advance.is_settled && parseFloat(advance.settled_amount || 0) > 0 && (
                          <span className="text-sm text-amber-400">
                            (por liquidar: €{pending.toFixed(2)})
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-400 mt-1">
                        Data: {new Date(advance.advance_date).toLocaleDateString('pt-PT')}
                        {advance.notes && (
                          <span className="ml-3 text-slate-500">— {advance.notes}</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Registado em {new Date(advance.created_at).toLocaleDateString('pt-PT')} por {advance.creator?.name || 'Sistema'}
                        {advance.is_settled && advance.settled_at && (
                          <span className="ml-2 text-green-400">
                            — Liquidado em {new Date(advance.settled_at).toLocaleDateString('pt-PT')}
                            {advance.settler?.name && ` por ${advance.settler.name}`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      {!advance.is_settled && (
                        <Button
                          size="sm"
                          onClick={() => handleSettle(advance)}
                          disabled={settleMutation.isPending}
                          title="Marcar como Liquidado"
                          className="bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      )}
                      {!advance.is_settled && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(advance)}
                          disabled={deleteMutation.isPending}
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
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

export default Advances;
