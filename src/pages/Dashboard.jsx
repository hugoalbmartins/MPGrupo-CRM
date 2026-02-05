import React, { useState } from "react";
import { toast } from "sonner";
import { ShoppingCart, Phone, Zap, Sun, Award, CheckCircle, Clock, TrendingUp, Euro, AlertTriangle, ArrowUpRight } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import SaleDetailDialog from "../components/SaleDetailDialog";
import { useDashboardStats, useProposalStats, usePartnerStats, useProposals } from "@/hooks/useDashboardData";
import { AnimatedNumber } from "@/hooks/useAnimatedCounter";

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }
  })
};

const chartVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: "easeOut" } }
};

const DARK_TOOLTIP = {
  contentStyle: { background: '#1a2332', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#e2e8f0', fontSize: '13px' },
  itemStyle: { color: '#e2e8f0' },
  labelStyle: { color: '#94a3b8' }
};

const StatCard = ({ label, value, prefix = "", suffix = "", decimals = 0, subtitle, icon: Icon, iconGradient, valueColor = "text-white", index = 0, onClick }) => (
  <motion.div
    custom={index}
    variants={cardVariants}
    initial="hidden"
    animate="visible"
    className={`stat-card ${onClick ? 'cursor-pointer' : ''}`}
    onClick={onClick}
  >
    <div className="flex items-center justify-between">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-dark-400 uppercase tracking-wide mb-3">{label}</p>
        <p className={`text-2xl lg:text-3xl font-bold ${valueColor} mb-1`}>
          <AnimatedNumber value={value} prefix={prefix} suffix={suffix} decimals={decimals} duration={1400} />
        </p>
        {subtitle && <p className="text-xs text-dark-400 mt-1">{subtitle}</p>}
      </div>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconGradient}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  </motion.div>
);

const Dashboard = ({ user }) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [proposalDialogOpen, setProposalDialogOpen] = useState(false);
  const [proposalFilter, setProposalFilter] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState(null);

  const { data: stats, isLoading: statsLoading } = useDashboardStats(selectedYear, selectedMonth);
  const { data: proposalStats } = useProposalStats();
  const { data: partnerData } = usePartnerStats(user);
  const { data: filteredProposals = [] } = useProposals(proposalFilter);

  const partnerStats = partnerData?.stats || [];
  const operators = partnerData?.operators || [];

  const handleProposalCardClick = (filterType) => {
    setProposalFilter(filterType);
    setProposalDialogOpen(true);
  };

  const months = [
    "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const getAvailableYears = () => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => currentYear - i);
  };

  if (statsLoading) {
    return (
      <div className="space-y-6 p-2 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="h-8 bg-dark-800 rounded-lg w-48 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="stat-card h-28 animate-pulse">
              <div className="h-3 bg-dark-700 rounded w-1/2 mb-4" />
              <div className="h-7 bg-dark-700 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const CHART_COLORS = ['#22d3ee', '#4ade80', '#fb923c', '#D4AF37', '#f87171', '#a78bfa'];
  const statusData = Object.entries(stats?.by_status || {}).map(([name, value]) => ({ name, value }));

  const renderAdminDashboard = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard index={0} label="Total Vendas" value={stats?.total_sales || 0} subtitle={`${stats?.total_partners || 0} parceiros`} icon={ShoppingCart} iconGradient="bg-gradient-to-br from-blue-500 to-blue-600" valueColor="text-white" />
        <StatCard index={1} label="Comissoes Brutas" value={stats?.total_commission_gross || 0} prefix="€" decimals={2} subtitle="Antes de retencoes" icon={Euro} iconGradient="bg-gradient-to-br from-gold-400 to-gold-600" valueColor="text-gold-400" />
        <StatCard index={2} label="Comissoes Liquidas" value={stats?.total_commission || 0} prefix="€" decimals={2} subtitle="Apos retencoes" icon={TrendingUp} iconGradient="bg-gradient-to-br from-emerald-500 to-emerald-600" valueColor="text-emerald-400" />
        <StatCard index={3} label="A Pagar" value={stats?.commission_to_pay || 0} prefix="€" decimals={2} subtitle={`${stats?.unpaid_by_operator || 0} vendas`} icon={AlertTriangle} iconGradient="bg-gradient-to-br from-orange-500 to-orange-600" valueColor="text-orange-400" />
        <StatCard index={4} label="Pagas Operador" value={stats?.paid_by_operator || 0} icon={CheckCircle} iconGradient="bg-gradient-to-br from-emerald-500 to-emerald-600" valueColor="text-emerald-400" />
        <StatCard index={5} label="Retencoes Mes Corrente" value={stats?.current_month_retentions || 0} prefix="€" decimals={2} subtitle="A reter das comissoes" icon={Award} iconGradient="bg-gradient-to-br from-blue-500 to-blue-600" valueColor="text-blue-400" />
        <StatCard index={6} label="Retencoes a Devolver" value={stats?.retentions_to_return || 0} prefix="€" decimals={2} subtitle="Proximo auto (6 meses)" icon={ArrowUpRight} iconGradient="bg-gradient-to-br from-teal-500 to-teal-600" valueColor="text-teal-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard index={7} label="Telecomunicacoes" value={stats?.telecomunicacoes?.count || 0} subtitle={`€${stats?.telecomunicacoes?.monthly_total?.toFixed(2) || '0.00'}/mes`} icon={Phone} iconGradient="bg-gradient-to-br from-cyan-500 to-cyan-600" valueColor="text-cyan-400" />
        <StatCard index={8} label="Energia" value={stats?.energia?.count || 0} subtitle={`${stats?.energia?.electricity || 0} elet. / ${stats?.energia?.gas || 0} gas (${stats?.energia?.dual || 0} dual)`} icon={Zap} iconGradient="bg-gradient-to-br from-orange-500 to-orange-600" valueColor="text-orange-400" />
        <StatCard index={9} label="Solar" value={stats?.solar?.count || 0} icon={Sun} iconGradient="bg-gradient-to-br from-green-500 to-green-600" valueColor="text-green-400" />
      </div>
    </>
  );

  const renderPartnerDashboard = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard index={0} label="Minhas Vendas" value={stats?.total_sales || 0} icon={ShoppingCart} iconGradient="bg-gradient-to-br from-blue-500 to-blue-600" valueColor="text-white" />
        <StatCard index={1} label="Comissoes Brutas" value={stats?.total_commission_gross || 0} prefix="€" decimals={2} subtitle="Antes de retencoes" icon={Euro} iconGradient="bg-gradient-to-br from-gold-400 to-gold-600" valueColor="text-gold-400" />
        <StatCard index={2} label="Comissoes Liquidas" value={stats?.total_commission || 0} prefix="€" decimals={2} subtitle="Apos retencoes" icon={TrendingUp} iconGradient="bg-gradient-to-br from-emerald-500 to-emerald-600" valueColor="text-emerald-400" />
        <StatCard index={3} label="Pendentes" value={stats?.commission_pending || 0} prefix="€" decimals={2} icon={Clock} iconGradient="bg-gradient-to-br from-orange-500 to-orange-600" valueColor="text-orange-400" />
        <StatCard index={4} label="Pagas" value={stats?.commission_paid || 0} prefix="€" decimals={2} icon={CheckCircle} iconGradient="bg-gradient-to-br from-emerald-500 to-emerald-600" valueColor="text-emerald-400" />
        <StatCard index={5} label="Retencoes Mes Corrente" value={stats?.current_month_retentions || 0} prefix="€" decimals={2} subtitle="A reter das comissoes" icon={Award} iconGradient="bg-gradient-to-br from-blue-500 to-blue-600" valueColor="text-blue-400" />
        <StatCard index={6} label="Retencoes a Devolver" value={stats?.retentions_to_return || 0} prefix="€" decimals={2} subtitle="Proximo auto (6 meses)" icon={ArrowUpRight} iconGradient="bg-gradient-to-br from-teal-500 to-teal-600" valueColor="text-teal-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard index={7} label="Telecomunicacoes" value={stats?.telecomunicacoes?.count || 0} icon={Phone} iconGradient="bg-gradient-to-br from-cyan-500 to-cyan-600" valueColor="text-cyan-400" />
        <StatCard index={8} label="Energia" value={stats?.energia?.count || 0} icon={Zap} iconGradient="bg-gradient-to-br from-orange-500 to-orange-600" valueColor="text-orange-400" />
        <StatCard index={9} label="Solar" value={stats?.solar?.count || 0} icon={Sun} iconGradient="bg-gradient-to-br from-green-500 to-green-600" valueColor="text-green-400" />
        <StatCard index={10} label="Dual" value={stats?.dual?.count || 0} icon={ShoppingCart} iconGradient="bg-gradient-to-br from-dark-500 to-dark-600" valueColor="text-dark-200" />
      </div>
    </>
  );

  const renderD2DPartnerDashboard = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard index={0} label="Minhas Vendas" value={stats?.total_sales || 0} icon={ShoppingCart} iconGradient="bg-gradient-to-br from-blue-500 to-blue-600" valueColor="text-white" />
        <StatCard index={1} label="Telecomunicacoes" value={stats?.telecomunicacoes?.count || 0} icon={Phone} iconGradient="bg-gradient-to-br from-cyan-500 to-cyan-600" valueColor="text-cyan-400" />
        <StatCard index={2} label="Energia" value={stats?.energia?.count || 0} icon={Zap} iconGradient="bg-gradient-to-br from-orange-500 to-orange-600" valueColor="text-orange-400" />
        <StatCard index={3} label="Solar" value={stats?.solar?.count || 0} icon={Sun} iconGradient="bg-gradient-to-br from-green-500 to-green-600" valueColor="text-green-400" />
      </div>

      {stats?.operator_stats && stats.operator_stats.length > 0 && (
        <motion.div variants={chartVariants} initial="hidden" animate="visible" className="glass-ultra p-6">
          <h3 className="text-lg font-bold text-white mb-4">Vendas por Operadora</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.operator_stats.map((operator, i) => (
              <StatCard key={operator.id} index={i} label={operator.name} value={operator.count} subtitle="vendas" icon={ShoppingCart} iconGradient="bg-gradient-to-br from-blue-500 to-blue-600" valueColor="text-white" />
            ))}
          </div>
        </motion.div>
      )}
    </>
  );

  const renderBODashboard = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard index={0} label="Total Vendas" value={stats?.total_sales || 0} icon={ShoppingCart} iconGradient="bg-gradient-to-br from-blue-500 to-blue-600" valueColor="text-white" />
      <StatCard index={1} label="Telecomunicacoes" value={stats?.telecomunicacoes?.count || 0} icon={Phone} iconGradient="bg-gradient-to-br from-cyan-500 to-cyan-600" valueColor="text-cyan-400" />
      <StatCard index={2} label="Energia" value={stats?.energia?.count || 0} icon={Zap} iconGradient="bg-gradient-to-br from-orange-500 to-orange-600" valueColor="text-orange-400" />
      <StatCard index={3} label="Solar" value={stats?.solar?.count || 0} icon={Sun} iconGradient="bg-gradient-to-br from-green-500 to-green-600" valueColor="text-green-400" />
    </div>
  );

  const renderCommercialDashboard = () => renderBODashboard();

  const renderManagerLevel1Dashboard = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard index={0} label="Total Vendas" value={stats?.total_sales || 0} subtitle="Proprias e de parceiros" icon={ShoppingCart} iconGradient="bg-gradient-to-br from-blue-500 to-blue-600" valueColor="text-white" />
        <StatCard index={1} label="Minhas Comissoes Brutas" value={stats?.own_commission_gross || 0} prefix="€" decimals={2} subtitle="Vendas proprias" icon={Euro} iconGradient="bg-gradient-to-br from-gold-400 to-gold-600" valueColor="text-gold-400" />
        <StatCard index={2} label="Minhas Retencoes" value={stats?.own_retention || 0} prefix="€" decimals={2} subtitle="A reter temporariamente" icon={Award} iconGradient="bg-gradient-to-br from-blue-500 to-blue-600" valueColor="text-blue-400" />
        <StatCard index={3} label="Minhas Comissoes Liquidas" value={(stats?.own_commission_gross || 0) - (stats?.own_retention || 0)} prefix="€" decimals={2} subtitle="Apos retencoes" icon={TrendingUp} iconGradient="bg-gradient-to-br from-emerald-500 to-emerald-600" valueColor="text-emerald-400" />
      </div>

      {stats?.objectives_progress && stats.objectives_progress.length > 0 && (
        <motion.div variants={chartVariants} initial="hidden" animate="visible" className="glass-ultra p-6">
          <h3 className="text-lg font-bold text-white mb-4">Cumprimento de Objetivos Mensais</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stats.objectives_progress.map((progress, idx) => {
              const objectives = [];
              if (progress.operator_scope === 'energia') {
                if (progress.targets.electricity > 0) objectives.push({ name: 'Eletricidade', actual: progress.actual.electricity, target: progress.targets.electricity, remaining: Math.max(0, progress.targets.electricity - progress.actual.electricity), percentage: progress.percentage.electricity, color: '#60a5fa' });
                if (progress.targets.gas > 0) objectives.push({ name: 'Gas', actual: progress.actual.gas, target: progress.targets.gas, remaining: Math.max(0, progress.targets.gas - progress.actual.gas), percentage: progress.percentage.gas, color: '#fb923c' });
              }
              if (progress.operator_scope === 'telecomunicacoes') {
                if (progress.targets.tv > 0) objectives.push({ name: 'TV', actual: progress.actual.tv, target: progress.targets.tv, remaining: Math.max(0, progress.targets.tv - progress.actual.tv), percentage: progress.percentage.tv, color: '#22d3ee' });
                if (progress.targets.fiber > 0) objectives.push({ name: 'Fibra/NET', actual: progress.actual.fiber, target: progress.targets.fiber, remaining: Math.max(0, progress.targets.fiber - progress.actual.fiber), percentage: progress.percentage.fiber, color: '#4ade80' });
              }
              return objectives.map((objective, objIdx) => (
                <div key={`${idx}-${objIdx}`} className="stat-card flex flex-col items-center">
                  <h4 className="font-semibold text-white mb-1">{progress.operator_name}</h4>
                  <p className="text-sm text-dark-400 mb-4">{objective.name}</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={[{ name: 'Atingido', value: objective.actual }, { name: 'Restante', value: objective.remaining }]} cx="50%" cy="50%" innerRadius={50} outerRadius={70} dataKey="value" startAngle={90} endAngle={-270}>
                        <Cell fill={objective.color} />
                        <Cell fill="rgba(255,255,255,0.06)" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <p className="text-2xl font-bold mt-2" style={{ color: objective.color }}>{objective.percentage.toFixed(0)}%</p>
                  <p className="text-sm text-dark-400">{objective.actual} / {objective.target}</p>
                </div>
              ));
            })}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard index={4} label="Telecomunicacoes" value={stats?.telecomunicacoes?.count || 0} subtitle={`€${stats?.telecomunicacoes?.monthly_total?.toFixed(2) || '0.00'}/mes`} icon={Phone} iconGradient="bg-gradient-to-br from-cyan-500 to-cyan-600" valueColor="text-cyan-400" />
        <StatCard index={5} label="Energia" value={stats?.energia?.count || 0} subtitle={`${stats?.energia?.electricity || 0} elet. / ${stats?.energia?.gas || 0} gas (${stats?.energia?.dual || 0} dual)`} icon={Zap} iconGradient="bg-gradient-to-br from-orange-500 to-orange-600" valueColor="text-orange-400" />
        <StatCard index={6} label="Solar" value={stats?.solar?.count || 0} icon={Sun} iconGradient="bg-gradient-to-br from-green-500 to-green-600" valueColor="text-green-400" />
      </div>
    </>
  );

  const renderProposalsDashboard = () => {
    if (!proposalStats) return null;
    const partnersList = Object.values(proposalStats.by_partner || {});
    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard index={0} label="Total Propostas" value={proposalStats.total_proposals || 0} subtitle="Em analise" icon={Clock} iconGradient="bg-gradient-to-br from-blue-500 to-blue-600" valueColor="text-white" onClick={() => handleProposalCardClick('all')} />
          <StatCard index={1} label="Ate 7 Dias" value={proposalStats.by_age?.up_to_7 || 0} subtitle="Recentes" icon={TrendingUp} iconGradient="bg-gradient-to-br from-emerald-500 to-emerald-600" valueColor="text-emerald-400" onClick={() => handleProposalCardClick('up_to_7')} />
          <StatCard index={2} label="7 a 14 Dias" value={proposalStats.by_age?.from_7_to_14 || 0} subtitle="Requer atencao" icon={AlertTriangle} iconGradient="bg-gradient-to-br from-orange-500 to-orange-600" valueColor="text-orange-400" onClick={() => handleProposalCardClick('from_7_to_14')} />
          <StatCard index={3} label="Mais de 14 Dias" value={proposalStats.by_age?.over_14 || 0} subtitle="Urgente" icon={AlertTriangle} iconGradient="bg-gradient-to-br from-red-500 to-red-600" valueColor="text-red-400" onClick={() => handleProposalCardClick('over_14')} />
        </div>

        {proposalStats.total_commission !== undefined && (
          <StatCard index={4} label="Comissoes Pendentes em Propostas" value={proposalStats.total_commission || 0} prefix="€" decimals={2} subtitle="Aguardando conclusao" icon={Euro} iconGradient="bg-gradient-to-br from-gold-400 to-gold-600" valueColor="text-gold-400" />
        )}

        {proposalStats.own_commission !== undefined && proposalStats.own_commission > 0 && (
          <div className="stat-card-gold">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gold-400 uppercase tracking-wide mb-3">Minhas Comissoes em Propostas</p>
                <p className="text-2xl lg:text-3xl font-bold text-gold-300">
                  <AnimatedNumber value={proposalStats.own_commission} prefix="€" decimals={2} duration={1400} />
                </p>
                <p className="text-xs text-dark-400 mt-1">Vendas proprias pendentes</p>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-gold-400 to-gold-600">
                <Award className="w-6 h-6 text-dark-900" />
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard index={5} label="Telecomunicacoes" value={proposalStats.by_scope?.telecomunicacoes || 0} icon={Phone} iconGradient="bg-gradient-to-br from-cyan-500 to-cyan-600" valueColor="text-cyan-400" />
          <StatCard index={6} label="Energia" value={proposalStats.by_scope?.energia || 0} icon={Zap} iconGradient="bg-gradient-to-br from-orange-500 to-orange-600" valueColor="text-orange-400" />
          <StatCard index={7} label="Solar" value={proposalStats.by_scope?.solar || 0} icon={Sun} iconGradient="bg-gradient-to-br from-green-500 to-green-600" valueColor="text-green-400" />
          <StatCard index={8} label="Dual" value={proposalStats.by_scope?.dual || 0} icon={ShoppingCart} iconGradient="bg-gradient-to-br from-dark-500 to-dark-600" valueColor="text-dark-200" />
        </div>

        {partnersList.length > 0 && (
          <motion.div variants={chartVariants} initial="hidden" animate="visible" className="glass-ultra p-6">
            <h3 className="text-lg font-bold text-white mb-4">Parceiros com Propostas em Curso</h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Parceiro</th>
                    <th className="text-center">Propostas</th>
                    {proposalStats.total_commission !== undefined && <th className="text-right">Comissoes Pendentes</th>}
                  </tr>
                </thead>
                <tbody>
                  {partnersList.sort((a, b) => (b.commission || b.count) - (a.commission || a.count)).map((partner, index) => (
                    <tr key={index}>
                      <td className="font-medium text-white">{partner.name}</td>
                      <td className="text-center">{partner.count}</td>
                      {proposalStats.total_commission !== undefined && (
                        <td className="text-right font-bold text-gold-400">€{partner.commission?.toFixed(2) || '0.00'}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </>
    );
  };

  const prepare12MonthsData = () => {
    if (!stats?.last_12_months) return [];
    return stats.last_12_months.map(item => ({
      name: `${months[item.month_num - 1].substring(0, 3)}/${item.year.toString().substring(2)}`,
      Telecom: item.telecomunicacoes,
      Energia: item.energia,
      Solar: item.solar,
      Dual: item.dual
    }));
  };

  const renderCharts = () => (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {statusData.length > 0 && (
          <motion.div variants={chartVariants} initial="hidden" animate="visible" className="glass-ultra p-6">
            <h3 className="text-base font-bold text-white mb-1">Vendas por Estado</h3>
            <p className="text-xs text-dark-400 mb-4">Distribuicao mensal</p>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} dataKey="value" paddingAngle={2}>
                  {statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip {...DARK_TOOLTIP} />
                <Legend formatter={(value) => <span style={{ color: '#94a3b8', fontSize: '12px' }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        <motion.div variants={chartVariants} initial="hidden" animate="visible" className="glass-ultra p-6">
          <h3 className="text-base font-bold text-white mb-1">Vendas por Ambito</h3>
          <p className="text-xs text-dark-400 mb-4">Comparacao mensal</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={[
              { name: 'Telecom', value: stats?.telecomunicacoes?.count || 0 },
              { name: 'Energia', value: stats?.energia?.count || 0 },
              { name: 'Solar', value: stats?.solar?.count || 0 },
              { name: 'Dual', value: stats?.dual?.count || 0 },
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 12 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
              <Tooltip {...DARK_TOOLTIP} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} animationDuration={1200}>
                {[0, 1, 2, 3].map((index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {partnerStats.length > 0 && operators.length > 0 && (
        <motion.div variants={chartVariants} initial="hidden" animate="visible" className="glass-ultra p-6">
          <h3 className="text-base font-bold text-white mb-1">Vendas por Parceiro</h3>
          <p className="text-xs text-dark-400 mb-4">{months[new Date().getMonth()]} {new Date().getFullYear()}</p>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Parceiro</th>
                  {operators.map((op) => <th key={op.id} className="text-center">{op.name}</th>)}
                  <th className="text-right">Total Comissoes</th>
                </tr>
              </thead>
              <tbody>
                {partnerStats.map((partner, index) => (
                  <tr key={index}>
                    <td className="font-medium text-white">{partner.name}</td>
                    {operators.map((op) => <td key={op.id} className="text-center">{partner.operators[op.name] || '-'}</td>)}
                    <td className="text-right font-bold text-blue-400">€{partner.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {stats?.last_12_months && stats.last_12_months.length > 0 && (
        <motion.div variants={chartVariants} initial="hidden" animate="visible" className="glass-ultra p-6">
          <h3 className="text-base font-bold text-white mb-1">Evolucao Ultimos 12 Meses</h3>
          <p className="text-xs text-dark-400 mb-4">Tendencia por ambito</p>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={prepare12MonthsData()}>
              <defs>
                <linearGradient id="gradTelecom" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradEnergia" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fb923c" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#fb923c" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradSolar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip {...DARK_TOOLTIP} />
              <Legend formatter={(value) => <span style={{ color: '#94a3b8', fontSize: '12px' }}>{value}</span>} />
              <Area type="monotone" dataKey="Telecom" stroke="#22d3ee" fill="url(#gradTelecom)" strokeWidth={2} name="Telecomunicacoes" animationDuration={1500} />
              <Area type="monotone" dataKey="Energia" stroke="#fb923c" fill="url(#gradEnergia)" strokeWidth={2} name="Energia" animationDuration={1500} />
              <Area type="monotone" dataKey="Solar" stroke="#4ade80" fill="url(#gradSolar)" strokeWidth={2} name="Solar" animationDuration={1500} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      )}
    </>
  );

  return (
    <div className="space-y-6 p-2 animate-fade-in">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-dark-400 mt-0.5">Bem-vindo, {user?.name}</p>
        </div>

        <div className="flex gap-2 items-center">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="select-modern px-3 py-2 text-sm rounded-lg border"
          >
            {months.map((month, index) => (
              <option key={index} value={index + 1}>{month}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="select-modern px-3 py-2 text-sm rounded-lg border"
          >
            {getAvailableYears().map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {(user?.role === 'admin' || user?.role === 'gestor_nv1' || user?.role === 'partner') ? (
        <Tabs defaultValue="total" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 bg-dark-800 border border-white/[0.06] p-1 rounded-xl">
            <TabsTrigger value="total" className="rounded-lg data-[state=active]:bg-gold-400/10 data-[state=active]:text-gold-400 text-dark-400 text-sm">Vendas Totais</TabsTrigger>
            {user?.is_commissioned && <TabsTrigger value="own" className="rounded-lg data-[state=active]:bg-gold-400/10 data-[state=active]:text-gold-400 text-dark-400 text-sm">Vendas Proprias</TabsTrigger>}
            <TabsTrigger value="proposals" className="rounded-lg data-[state=active]:bg-gold-400/10 data-[state=active]:text-gold-400 text-dark-400 text-sm">Propostas</TabsTrigger>
          </TabsList>

          <TabsContent value="total" className="space-y-4">
            {user?.role === 'admin' && renderAdminDashboard()}
            {user?.role === 'gestor_nv1' && renderManagerLevel1Dashboard()}
            {user?.role === 'partner' && (stats?.partner_type === 'D2D' ? renderD2DPartnerDashboard() : renderPartnerDashboard())}
            {renderCharts()}
          </TabsContent>

          {user?.is_commissioned && (
            <TabsContent value="own" className="space-y-4">
              {user?.role === 'admin' && stats && (
                <div className="stat-card-gold">
                  <h3 className="text-base font-bold text-gold-400 mb-4">Minhas Comissoes</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="stat-card">
                      <p className="text-xs text-dark-400 mb-2">Comissoes Brutas</p>
                      <p className="text-xl font-bold text-gold-400">
                        <AnimatedNumber value={(stats?.admin_commission_pending || 0) + (stats?.admin_commission_paid || 0)} prefix="€" decimals={2} duration={1400} />
                      </p>
                    </div>
                    <div className="stat-card">
                      <p className="text-xs text-dark-400 mb-2">Retencoes</p>
                      <p className="text-xl font-bold text-blue-400">
                        <AnimatedNumber value={stats?.admin_retention || 0} prefix="€" decimals={2} duration={1400} />
                      </p>
                    </div>
                    <div className="stat-card">
                      <p className="text-xs text-dark-400 mb-2">Comissoes Liquidas</p>
                      <p className="text-xl font-bold text-emerald-400">
                        <AnimatedNumber value={((stats?.admin_commission_pending || 0) + (stats?.admin_commission_paid || 0)) - (stats?.admin_retention || 0)} prefix="€" decimals={2} duration={1400} />
                      </p>
                    </div>
                    <div className="stat-card">
                      <p className="text-xs text-dark-400 mb-2">A Receber</p>
                      <p className="text-xl font-bold text-white">
                        <AnimatedNumber value={(stats?.admin_commission_paid || 0) - (stats?.admin_retention || 0) * ((stats?.admin_commission_paid || 0) / ((stats?.admin_commission_pending || 0) + (stats?.admin_commission_paid || 0) || 1))} prefix="€" decimals={2} duration={1400} />
                      </p>
                    </div>
                    <div className="stat-card">
                      <p className="text-xs text-dark-400 mb-2">Minhas Vendas</p>
                      <p className="text-xl font-bold text-white">
                        <AnimatedNumber value={stats?.admin_sales_count || 0} duration={1400} />
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          )}

          <TabsContent value="proposals" className="space-y-4">
            {renderProposalsDashboard()}
          </TabsContent>
        </Tabs>
      ) : (
        <>
          {user?.role === 'bo' && renderBODashboard()}
          {user?.role === 'partner_commercial' && renderCommercialDashboard()}
          {renderCharts()}
        </>
      )}

      <Dialog open={proposalDialogOpen} onOpenChange={setProposalDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-dark-900 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">
              Propostas - {proposalFilter === 'all' ? 'Todas' : proposalFilter === 'up_to_7' ? 'Ate 7 Dias' : proposalFilter === 'from_7_to_14' ? '7 a 14 Dias' : 'Mais de 14 Dias'}
            </DialogTitle>
            <DialogDescription className="text-dark-400">
              {filteredProposals.length} proposta(s) encontrada(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {filteredProposals.length === 0 ? (
              <p className="text-center text-dark-400 py-8">Nenhuma proposta encontrada</p>
            ) : (
              filteredProposals.map((proposal) => {
                const daysElapsed = Math.floor((new Date() - new Date(proposal.created_at)) / (1000 * 60 * 60 * 24));
                return (
                  <div key={proposal.id} className="stat-card hover:border-white/10">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-bold text-white">{proposal.sale_code}</span>
                          <Badge variant={daysElapsed <= 7 ? 'default' : daysElapsed <= 14 ? 'warning' : 'destructive'}>
                            {daysElapsed} dias
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div><span className="text-dark-400">Cliente: </span><span className="text-white">{proposal.client_name}</span></div>
                          <div><span className="text-dark-400">Parceiro: </span><span className="text-white">{proposal.partners?.name || 'N/A'}</span></div>
                          <div><span className="text-dark-400">Operadora: </span><span className="text-white">{proposal.operators?.name || 'N/A'}</span></div>
                          <div><span className="text-dark-400">Data: </span><span className="text-white">{new Date(proposal.date).toLocaleDateString('pt-PT')}</span></div>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => { setSelectedSaleId(proposal.id); setDetailDialogOpen(true); }} className="btn-primary text-sm px-4 py-2">
                        Ver Detalhes
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      <SaleDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        saleId={selectedSaleId}
        user={user}
        onSaleUpdated={() => {}}
      />
    </div>
  );
};

export default Dashboard;
