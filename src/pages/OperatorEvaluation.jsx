import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import { Building2, Zap, Flame, BarChart3, CheckCircle2, XCircle, AlertTriangle, Calendar, RefreshCw, TrendingUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const StatCard = ({ label, value, icon: Icon, color, sub }) => (
  <div
    className="rounded-xl p-5 border flex flex-col gap-2"
    style={{ backgroundColor: 'rgba(8,12,20,0.6)', borderColor: 'rgba(255,255,255,0.07)' }}
  >
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-400 uppercase tracking-wide font-semibold">{label}</span>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
    </div>
    <p className="text-3xl font-bold text-white">{value ?? '—'}</p>
    {sub && <p className="text-xs text-slate-500">{sub}</p>}
  </div>
);

const OperatorRow = ({ op, stats }) => {
  const s = stats[op.id] || {};
  const total = (s.eletricidade || 0) + (s.gas || 0) + (s.dual || 0) + (s.other || 0);
  return (
    <div
      className="rounded-xl border p-5 transition-all hover:border-cyan-500/20"
      style={{ backgroundColor: 'rgba(8,12,20,0.5)', borderColor: 'rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)' }}>
          <Building2 className="w-4 h-4 text-cyan-400" />
        </div>
        <div>
          <h3 className="font-bold text-white">{op.name}</h3>
          <p className="text-xs text-slate-500">{total} venda(s) no período</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.15)' }}>
          <Zap className="w-4 h-4 text-orange-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-white">{s.eletricidade || 0}</p>
          <p className="text-[10px] text-slate-500">Eletricidade</p>
        </div>
        <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.15)' }}>
          <Flame className="w-4 h-4 text-blue-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-white">{s.gas || 0}</p>
          <p className="text-[10px] text-slate-500">Gás</p>
        </div>
        <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.15)' }}>
          <BarChart3 className="w-4 h-4 text-purple-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-white">{s.dual || 0}</p>
          <p className="text-[10px] text-slate-500">Dual</p>
        </div>
        <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)' }}>
          <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-white">{s.ativos || 0}</p>
          <p className="text-[10px] text-slate-500">Ativos</p>
        </div>
        <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)' }}>
          <XCircle className="w-4 h-4 text-red-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-white">{s.cancelados || 0}</p>
          <p className="text-[10px] text-slate-500">Cancelados</p>
        </div>
        <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.15)' }}>
          <AlertTriangle className="w-4 h-4 text-amber-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-white">{s.chargeback || 0}</p>
          <p className="text-[10px] text-slate-500">Chargeback</p>
        </div>
      </div>
    </div>
  );
};

const OperatorEvaluation = ({ user }) => {
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const today = now.toLocaleDateString('sv-SE');

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [useDateRange, setUseDateRange] = useState(true);
  const [selectedOperatorId, setSelectedOperatorId] = useState('all');
  const [operators, setOperators] = useState([]);
  const [stats, setStats] = useState({});
  const [totals, setTotals] = useState({});
  const [loading, setLoading] = useState(false);

  const fetchOperators = useCallback(async () => {
    const { data } = await supabase.from('operators').select('id, name').order('name');
    setOperators(data || []);
  }, []);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('sales')
        .select('operator_id, scope, energy_sale_type, status, has_chargeback, date')
        .eq('scope', 'energia');

      if (useDateRange && startDate) query = query.gte('date', startDate);
      if (useDateRange && endDate) query = query.lte('date', endDate);
      if (selectedOperatorId !== 'all') query = query.eq('operator_id', selectedOperatorId);

      const { data, error } = await query;
      if (error) throw error;

      const byOp = {};
      const tot = { eletricidade: 0, gas: 0, dual: 0, other: 0, ativos: 0, cancelados: 0, chargeback: 0 };

      for (const row of (data || [])) {
        if (!byOp[row.operator_id]) {
          byOp[row.operator_id] = { eletricidade: 0, gas: 0, dual: 0, other: 0, ativos: 0, cancelados: 0, chargeback: 0 };
        }
        const o = byOp[row.operator_id];
        const est = row.energy_sale_type;
        if (est === 'eletricidade') { o.eletricidade++; tot.eletricidade++; }
        else if (est === 'gas') { o.gas++; tot.gas++; }
        else if (est === 'dual') { o.dual++; tot.dual++; }
        else { o.other++; tot.other++; }

        if (row.status === 'Ativo') { o.ativos++; tot.ativos++; }
        if (row.status === 'Cancelado' || row.status === 'Recusado') { o.cancelados++; tot.cancelados++; }
        if (row.has_chargeback) { o.chargeback++; tot.chargeback++; }
      }

      setStats(byOp);
      setTotals(tot);
    } catch (err) {
      toast.error('Erro ao carregar dados: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedOperatorId, useDateRange]);

  useEffect(() => { fetchOperators(); }, [fetchOperators]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const visibleOperators = operators.filter(op =>
    selectedOperatorId === 'all' ? stats[op.id] : op.id === selectedOperatorId
  );

  const totalSales = (totals.eletricidade || 0) + (totals.gas || 0) + (totals.dual || 0) + (totals.other || 0);

  const periodLabel = useDateRange
    ? (startDate && endDate
        ? `${new Date(startDate).toLocaleDateString('pt-PT')} – ${new Date(endDate).toLocaleDateString('pt-PT')}`
        : startDate ? `a partir de ${new Date(startDate).toLocaleDateString('pt-PT')}` : 'Todo o período')
    : 'Total (sem filtro de datas)';

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-cyan-400" />
            Avaliação de Operadoras
          </h1>
          <p className="text-sm text-slate-400 mt-1">{periodLabel}</p>
        </div>
        <Button
          onClick={fetchStats}
          disabled={loading}
          size="sm"
          className="gap-2 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Filters */}
      <div
        className="rounded-xl border p-4 space-y-4"
        style={{ backgroundColor: 'rgba(8,12,20,0.6)', borderColor: 'rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useDateRange}
              onChange={(e) => setUseDateRange(e.target.checked)}
              className="w-4 h-4 rounded accent-cyan-500"
            />
            <span className="text-sm text-slate-300">Filtrar por período</span>
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label className="text-slate-400 text-xs mb-1 block">Data Início</Label>
            <Input
              type="date"
              value={startDate}
              disabled={!useDateRange}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-dark-900 border-dark-700 text-white disabled:opacity-40"
            />
          </div>
          <div>
            <Label className="text-slate-400 text-xs mb-1 block">Data Fim</Label>
            <Input
              type="date"
              value={endDate}
              disabled={!useDateRange}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-dark-900 border-dark-700 text-white disabled:opacity-40"
            />
          </div>
          <div>
            <Label className="text-slate-400 text-xs mb-1 block">Operadora</Label>
            <Select value={selectedOperatorId} onValueChange={setSelectedOperatorId}>
              <SelectTrigger className="bg-dark-900 border-dark-700 text-white">
                <SelectValue placeholder="Todas as operadoras" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as operadoras</SelectItem>
                {operators.map(op => (
                  <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Eletricidade" value={totals.eletricidade || 0} icon={Zap} color="#f97316" />
        <StatCard label="Gás" value={totals.gas || 0} icon={Flame} color="#3b82f6" />
        <StatCard label="Dual" value={totals.dual || 0} icon={BarChart3} color="#a855f7" sub={`${totalSales} total`} />
        <StatCard label="Ativos" value={totals.ativos || 0} icon={CheckCircle2} color="#10b981" />
        <StatCard label="Cancelados" value={totals.cancelados || 0} icon={XCircle} color="#ef4444" />
        <StatCard label="Chargeback" value={totals.chargeback || 0} icon={AlertTriangle} color="#f59e0b" />
      </div>

      {/* Per-operator breakdown */}
      {loading ? (
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500 mx-auto" />
          <p className="mt-4 text-slate-500 text-sm">A carregar dados...</p>
        </div>
      ) : visibleOperators.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhuma venda de energia encontrada para o período selecionado.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Detalhe por Operadora ({visibleOperators.length})
          </h2>
          {visibleOperators.map(op => (
            <OperatorRow key={op.id} op={op} stats={stats} />
          ))}
        </div>
      )}
    </div>
  );
};

export default OperatorEvaluation;
