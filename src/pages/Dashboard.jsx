import React, { useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { ShoppingCart, Phone, Zap, Sun, Award, CircleCheck as CheckCircle, Clock, TrendingUp, Euro, TriangleAlert as AlertTriangle, ArrowUpRight, Download, Car } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import SaleDetailDialog from "../components/SaleDetailDialog";
import { useDashboardStats, useProposalStats, usePartnerStats, useProposals, getAvailableWeeks, getAvailableMonths, getAvailableDays } from "@/hooks/useDashboardData";
import { AnimatedNumber } from "@/hooks/useAnimatedCounter";

/* ---------------------------------------------------------------------------
   Animation variants
--------------------------------------------------------------------------- */
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const chartVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.7, ease: "easeOut" },
  },
};

/* ---------------------------------------------------------------------------
   Chart colour palette
--------------------------------------------------------------------------- */
const CHART_COLORS = [
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#f59e0b", // amber
  "#f43f5e", // rose
  "#8b5cf6", // violet
  "#22d3ee", // lighter cyan fallback
];

/* ---------------------------------------------------------------------------
   Dark futuristic tooltip shared config
--------------------------------------------------------------------------- */
const DARK_TOOLTIP = {
  contentStyle: {
    background: "rgba(10, 18, 30, 0.95)",
    border: "1px solid rgba(6, 182, 212, 0.2)",
    borderRadius: "12px",
    color: "#ffffff",
    fontSize: "13px",
    backdropFilter: "blur(12px)",
    boxShadow: "0 8px 32px rgba(6, 182, 212, 0.08)",
  },
  itemStyle: { color: "#e2e8f0" },
  labelStyle: { color: "#94a3b8", fontWeight: 600 },
  cursor: { stroke: "rgba(6, 182, 212, 0.3)", strokeWidth: 1 },
};

/* ---------------------------------------------------------------------------
   Custom Recharts tooltip component
--------------------------------------------------------------------------- */
const CyberTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-dark-850 border border-cyber-500/20 rounded-xl px-4 py-3 shadow-lg shadow-cyber-500/5 backdrop-blur-xl">
      <p className="text-slate-400 text-xs font-semibold mb-1.5">{label}</p>
      {payload.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-2 text-sm">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-white font-medium">{entry.name}:</span>
          <span className="text-slate-300">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

/* ---------------------------------------------------------------------------
   StatCard component  --  futuristic cyber design
--------------------------------------------------------------------------- */
const StatCard = ({
  label,
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  subtitle,
  icon: Icon,
  iconGradient,
  valueColor = "text-white",
  index = 0,
  onClick,
}) => (
  <motion.div
    custom={index}
    variants={cardVariants}
    initial="hidden"
    animate="visible"
    className={`stat-card group relative overflow-hidden ${onClick ? "cursor-pointer" : ""}`}
    onClick={onClick}
    whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
  >
    {/* Cyber glow on hover -- layered beneath content */}
    <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br from-cyber-500/5 via-transparent to-cyber-400/5 shadow-cyber-glow" />

    <div className="relative flex items-center justify-between">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          {label}
        </p>
        <p className={`text-2xl lg:text-3xl font-bold ${valueColor} mb-1 tracking-tight`}>
          <AnimatedNumber
            value={value}
            prefix={prefix}
            suffix={suffix}
            decimals={decimals}
            duration={1400}
          />
        </p>
        {subtitle && (
          <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
        )}
      </div>
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg ${iconGradient} transition-transform duration-300 group-hover:scale-110`}
      >
        <Icon className="w-6 h-6 text-white drop-shadow-sm" />
      </div>
    </div>
  </motion.div>
);

/* ===========================================================================
   Dashboard
=========================================================================== */
const Dashboard = ({ user }) => {
  /* ---- state ---- */
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [proposalDialogOpen, setProposalDialogOpen] = useState(false);
  const [proposalFilter, setProposalFilter] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState(null);
  const [partnerTableFilterMode, setPartnerTableFilterMode] = useState('month');
  const [partnerTableFilterKey, setPartnerTableFilterKey] = useState(null);

  /* ---- data hooks ---- */
  const { data: stats, isLoading: statsLoading } = useDashboardStats(selectedYear, selectedMonth);
  const { data: proposalStats } = useProposalStats();
  const { data: partnerData } = usePartnerStats(user, partnerTableFilterMode, partnerTableFilterKey);
  const { data: filteredProposals = [] } = useProposals(proposalFilter);

  const partnerStats = partnerData?.stats || [];
  const operators = partnerData?.operators || [];

  /* ---- handlers ---- */
  const handleProposalCardClick = (filterType) => {
    setProposalFilter(filterType);
    setProposalDialogOpen(true);
  };

  /* ---- constants ---- */
  const months = [
    "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];

  const availableWeeks = getAvailableWeeks();
  const availableMonths = getAvailableMonths();
  const availableDays = getAvailableDays();

  const getFilterLabel = () => {
    if (partnerTableFilterMode === 'week') {
      return availableWeeks.find(w => w.key === partnerTableFilterKey)?.label || availableWeeks[0]?.label || 'semana';
    }
    if (partnerTableFilterMode === 'day') {
      return availableDays.find(d => d.key === partnerTableFilterKey)?.label || availableDays[0]?.label || 'hoje';
    }
    if (partnerTableFilterMode === 'specificMonth') {
      return availableMonths.find(m => m.key === partnerTableFilterKey)?.label || '';
    }
    const now = new Date();
    return now.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
  };

  const exportPartnerStatsToExcel = () => {
    const label = getFilterLabel();
    const headers = ['Parceiro', ...operators.map(op => op.name), 'Total Comissoes (EUR)'];
    const rows = partnerStats.map(partner => [
      partner.name,
      ...operators.map(op => partner.operators[op.name] || 0),
      parseFloat(partner.total.toFixed(2))
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const colWidths = headers.map((h, i) => ({
      wch: Math.max(h.length, ...rows.map(r => String(r[i]).length)) + 2
    }));
    ws['!cols'] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vendas por Parceiro');
    XLSX.writeFile(wb, `vendas_parceiro_${label.replace(/\//g, '-').replace(/ /g, '_')}.xlsx`);
  };

  const getAvailableYears = () => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => currentYear - i);
  };

  /* ---- loading skeleton ---- */
  if (statsLoading) {
    return (
      <div className="space-y-6 p-2 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="h-8 bg-dark-800/60 rounded-lg w-48 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="stat-card h-28 animate-pulse">
              <div className="h-3 bg-dark-700/50 rounded w-1/2 mb-4" />
              <div className="h-7 bg-dark-700/50 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ---- derived data ---- */
  const statusData = Object.entries(stats?.by_status || {}).map(([name, value]) => ({ name, value }));

  /* ====================================================================
     Role-specific dashboard renderers
  ==================================================================== */

  // ---- Admin ----
  const renderAdminDashboard = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          index={0}
          label="Total Vendas"
          value={stats?.total_sales || 0}
          subtitle={`${stats?.total_partners || 0} parceiros`}
          icon={ShoppingCart}
          iconGradient="bg-gradient-to-br from-cyber-500 to-cyber-600"
          valueColor="text-white"
        />
        <StatCard
          index={1}
          label="Comissoes Brutas"
          value={stats?.total_commission_gross || 0}
          prefix="€"
          decimals={2}
          subtitle="Antes de retencoes"
          icon={Euro}
          iconGradient="bg-gradient-to-br from-cyber-400 to-cyber-600"
          valueColor="text-cyber-400"
        />
        <StatCard
          index={2}
          label="Comissoes Liquidas"
          value={stats?.total_commission || 0}
          prefix="€"
          decimals={2}
          subtitle="Apos retencoes"
          icon={TrendingUp}
          iconGradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
          valueColor="text-emerald-400"
        />
        <StatCard
          index={3}
          label="A Pagar"
          value={stats?.commission_to_pay || 0}
          prefix="€"
          decimals={2}
          subtitle={`${stats?.unpaid_by_operator || 0} vendas`}
          icon={AlertTriangle}
          iconGradient="bg-gradient-to-br from-rose-500 to-rose-600"
          valueColor="text-rose-400"
        />
        <StatCard
          index={4}
          label="Pagas Operador"
          value={stats?.paid_by_operator || 0}
          icon={CheckCircle}
          iconGradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
          valueColor="text-emerald-400"
        />
        <StatCard
          index={5}
          label="Retencoes Mes Corrente"
          value={stats?.current_month_retentions || 0}
          prefix="€"
          decimals={2}
          subtitle="A reter das comissoes"
          icon={Award}
          iconGradient="bg-gradient-to-br from-cyber-500 to-cyber-600"
          valueColor="text-cyber-400"
        />
        <StatCard
          index={6}
          label="Retencoes a Devolver"
          value={stats?.retentions_to_return || 0}
          prefix="€"
          decimals={2}
          subtitle="Proximo auto (6 meses)"
          icon={ArrowUpRight}
          iconGradient="bg-gradient-to-br from-teal-500 to-teal-600"
          valueColor="text-teal-400"
        />
      </div>

      {[
        stats?.telecomunicacoes?.count > 0 && { index: 7, label: "Telecomunicacoes", value: stats.telecomunicacoes.count, subtitle: `€${stats.telecomunicacoes.monthly_total?.toFixed(2) || "0.00"}/mes`, icon: Phone, gradient: "from-cyan-500 to-cyan-600", color: "text-cyan-400" },
        stats?.energia?.count > 0 && { index: 8, label: "Energia", value: stats.energia.count, subtitle: `${stats.energia.electricity || 0} elet. / ${stats.energia.gas || 0} gas · DD: ${stats?.dd_count || 0} FE: ${stats?.fe_count || 0}`, icon: Zap, gradient: "from-amber-500 to-amber-600", color: "text-amber-400" },
        stats?.solar?.count > 0 && { index: 9, label: "Solar", value: stats.solar.count, icon: Sun, gradient: "from-emerald-500 to-emerald-600", color: "text-emerald-400" },
        stats?.mobilidade_eletrica?.count > 0 && { index: 10, label: "Mobilidade Eletrica", value: stats.mobilidade_eletrica.count, icon: Car, gradient: "from-teal-500 to-teal-600", color: "text-teal-400" },
      ].filter(Boolean).length > 0 && (
        <div className={`grid grid-cols-1 md:grid-cols-${Math.min([stats?.telecomunicacoes?.count > 0, stats?.energia?.count > 0, stats?.solar?.count > 0, stats?.mobilidade_eletrica?.count > 0].filter(Boolean).length, 4)} gap-4`}>
          {[
            stats?.telecomunicacoes?.count > 0 && { index: 7, label: "Telecomunicacoes", value: stats.telecomunicacoes.count, subtitle: `€${stats.telecomunicacoes.monthly_total?.toFixed(2) || "0.00"}/mes`, icon: Phone, gradient: "from-cyan-500 to-cyan-600", color: "text-cyan-400" },
            stats?.energia?.count > 0 && { index: 8, label: "Energia", value: stats.energia.count, subtitle: `${stats.energia.electricity || 0} elet. / ${stats.energia.gas || 0} gas · DD: ${stats?.dd_count || 0} FE: ${stats?.fe_count || 0}`, icon: Zap, gradient: "from-amber-500 to-amber-600", color: "text-amber-400" },
            stats?.solar?.count > 0 && { index: 9, label: "Solar", value: stats.solar.count, icon: Sun, gradient: "from-emerald-500 to-emerald-600", color: "text-emerald-400" },
            stats?.mobilidade_eletrica?.count > 0 && { index: 10, label: "Mobilidade Eletrica", value: stats.mobilidade_eletrica.count, icon: Car, gradient: "from-teal-500 to-teal-600", color: "text-teal-400" },
          ].filter(Boolean).map(card => (
            <StatCard key={card.index} index={card.index} label={card.label} value={card.value} subtitle={card.subtitle} icon={card.icon} iconGradient={`bg-gradient-to-br ${card.gradient}`} valueColor={card.color} />
          ))}
        </div>
      )}
    </>
  );

  // ---- Partner ----
  const renderPartnerDashboard = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          index={0}
          label="Minhas Vendas"
          value={stats?.total_sales || 0}
          icon={ShoppingCart}
          iconGradient="bg-gradient-to-br from-cyber-500 to-cyber-600"
          valueColor="text-white"
        />
        <StatCard
          index={1}
          label="Comissoes Brutas"
          value={stats?.total_commission_gross || 0}
          prefix="€"
          decimals={2}
          subtitle="Antes de retencoes"
          icon={Euro}
          iconGradient="bg-gradient-to-br from-cyber-400 to-cyber-600"
          valueColor="text-cyber-400"
        />
        <StatCard
          index={2}
          label="Comissoes Liquidas"
          value={stats?.total_commission || 0}
          prefix="€"
          decimals={2}
          subtitle="Apos retencoes"
          icon={TrendingUp}
          iconGradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
          valueColor="text-emerald-400"
        />
        <StatCard
          index={3}
          label="Pendentes"
          value={stats?.commission_pending || 0}
          prefix="€"
          decimals={2}
          icon={Clock}
          iconGradient="bg-gradient-to-br from-amber-500 to-amber-600"
          valueColor="text-amber-400"
        />
        <StatCard
          index={4}
          label="Pagas"
          value={stats?.commission_paid || 0}
          prefix="€"
          decimals={2}
          icon={CheckCircle}
          iconGradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
          valueColor="text-emerald-400"
        />
        <StatCard
          index={5}
          label="Retencoes Mes Corrente"
          value={stats?.current_month_retentions || 0}
          prefix="€"
          decimals={2}
          subtitle="A reter das comissoes"
          icon={Award}
          iconGradient="bg-gradient-to-br from-cyber-500 to-cyber-600"
          valueColor="text-cyber-400"
        />
        <StatCard
          index={6}
          label="Retencoes a Devolver"
          value={stats?.retentions_to_return || 0}
          prefix="€"
          decimals={2}
          subtitle="Proximo auto (6 meses)"
          icon={ArrowUpRight}
          iconGradient="bg-gradient-to-br from-teal-500 to-teal-600"
          valueColor="text-teal-400"
        />
      </div>

      {[
        stats?.telecomunicacoes?.count > 0 && { index: 7, label: "Telecomunicacoes", value: stats.telecomunicacoes.count, subtitle: `€${stats.telecomunicacoes.monthly_total?.toFixed(2) || "0.00"}/mes`, icon: Phone, gradient: "from-cyan-500 to-cyan-600", color: "text-cyan-400" },
        stats?.energia?.count > 0 && { index: 8, label: "Energia", value: stats.energia.count, subtitle: `${stats.energia.electricity || 0} elet. / ${stats.energia.gas || 0} gas · DD: ${stats?.dd_count || 0} FE: ${stats?.fe_count || 0}`, icon: Zap, gradient: "from-amber-500 to-amber-600", color: "text-amber-400" },
        stats?.solar?.count > 0 && { index: 9, label: "Solar", value: stats.solar.count, icon: Sun, gradient: "from-emerald-500 to-emerald-600", color: "text-emerald-400" },
        stats?.mobilidade_eletrica?.count > 0 && { index: 10, label: "Mobilidade Eletrica", value: stats.mobilidade_eletrica.count, icon: Car, gradient: "from-teal-500 to-teal-600", color: "text-teal-400" },
      ].filter(Boolean).length > 0 && (
        <div className={`grid grid-cols-1 md:grid-cols-${Math.min([stats?.telecomunicacoes?.count > 0, stats?.energia?.count > 0, stats?.solar?.count > 0, stats?.mobilidade_eletrica?.count > 0].filter(Boolean).length, 4)} gap-4`}>
          {[
            stats?.telecomunicacoes?.count > 0 && { index: 7, label: "Telecomunicacoes", value: stats.telecomunicacoes.count, subtitle: `€${stats.telecomunicacoes.monthly_total?.toFixed(2) || "0.00"}/mes`, icon: Phone, gradient: "from-cyan-500 to-cyan-600", color: "text-cyan-400" },
            stats?.energia?.count > 0 && { index: 8, label: "Energia", value: stats.energia.count, subtitle: `${stats.energia.electricity || 0} elet. / ${stats.energia.gas || 0} gas · DD: ${stats?.dd_count || 0} FE: ${stats?.fe_count || 0}`, icon: Zap, gradient: "from-amber-500 to-amber-600", color: "text-amber-400" },
            stats?.solar?.count > 0 && { index: 9, label: "Solar", value: stats.solar.count, icon: Sun, gradient: "from-emerald-500 to-emerald-600", color: "text-emerald-400" },
            stats?.mobilidade_eletrica?.count > 0 && { index: 10, label: "Mobilidade Eletrica", value: stats.mobilidade_eletrica.count, icon: Car, gradient: "from-teal-500 to-teal-600", color: "text-teal-400" },
          ].filter(Boolean).map(card => (
            <StatCard key={card.index} index={card.index} label={card.label} value={card.value} subtitle={card.subtitle} icon={card.icon} iconGradient={`bg-gradient-to-br ${card.gradient}`} valueColor={card.color} />
          ))}
        </div>
      )}
    </>
  );

  // ---- D2D Partner ----
  const renderD2DPartnerDashboard = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard index={0} label="Minhas Vendas" value={stats?.total_sales || 0} icon={ShoppingCart} iconGradient="bg-gradient-to-br from-cyber-500 to-cyber-600" valueColor="text-white" />
      </div>

      {[
        stats?.telecomunicacoes?.count > 0 && { index: 1, label: "Telecomunicacoes", value: stats.telecomunicacoes.count, icon: Phone, gradient: "from-cyan-500 to-cyan-600", color: "text-cyan-400" },
        stats?.energia?.count > 0 && { index: 2, label: "Energia", value: stats.energia.count, subtitle: `${stats.energia.electricity || 0} elet. / ${stats.energia.gas || 0} gas · DD: ${stats?.dd_count || 0} FE: ${stats?.fe_count || 0}`, icon: Zap, gradient: "from-amber-500 to-amber-600", color: "text-amber-400" },
        stats?.solar?.count > 0 && { index: 3, label: "Solar", value: stats.solar.count, icon: Sun, gradient: "from-emerald-500 to-emerald-600", color: "text-emerald-400" },
        stats?.mobilidade_eletrica?.count > 0 && { index: 4, label: "Mobilidade Eletrica", value: stats.mobilidade_eletrica.count, icon: Car, gradient: "from-teal-500 to-teal-600", color: "text-teal-400" },
      ].filter(Boolean).length > 0 && (
        <div className={`grid grid-cols-1 md:grid-cols-${Math.min([stats?.telecomunicacoes?.count > 0, stats?.energia?.count > 0, stats?.solar?.count > 0, stats?.mobilidade_eletrica?.count > 0].filter(Boolean).length, 4)} gap-4`}>
          {[
            stats?.telecomunicacoes?.count > 0 && { index: 1, label: "Telecomunicacoes", value: stats.telecomunicacoes.count, icon: Phone, gradient: "from-cyan-500 to-cyan-600", color: "text-cyan-400" },
            stats?.energia?.count > 0 && { index: 2, label: "Energia", value: stats.energia.count, subtitle: `${stats.energia.electricity || 0} elet. / ${stats.energia.gas || 0} gas · DD: ${stats?.dd_count || 0} FE: ${stats?.fe_count || 0}`, icon: Zap, gradient: "from-amber-500 to-amber-600", color: "text-amber-400" },
            stats?.solar?.count > 0 && { index: 3, label: "Solar", value: stats.solar.count, icon: Sun, gradient: "from-emerald-500 to-emerald-600", color: "text-emerald-400" },
            stats?.mobilidade_eletrica?.count > 0 && { index: 4, label: "Mobilidade Eletrica", value: stats.mobilidade_eletrica.count, icon: Car, gradient: "from-teal-500 to-teal-600", color: "text-teal-400" },
          ].filter(Boolean).map(card => (
            <StatCard key={card.index} index={card.index} label={card.label} value={card.value} subtitle={card.subtitle} icon={card.icon} iconGradient={`bg-gradient-to-br ${card.gradient}`} valueColor={card.color} />
          ))}
        </div>
      )}

      {stats?.operator_stats && stats.operator_stats.length > 0 && (
        <motion.div variants={chartVariants} initial="hidden" animate="visible" className="glass-ultra p-6 border border-cyber-500/10 rounded-2xl">
          <h3 className="text-lg font-bold text-white mb-4">Vendas por Operadora</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.operator_stats.map((operator, i) => (
              <StatCard
                key={operator.id}
                index={i}
                label={operator.name}
                value={operator.count}
                subtitle="vendas"
                icon={ShoppingCart}
                iconGradient="bg-gradient-to-br from-cyber-500 to-cyber-600"
                valueColor="text-white"
              />
            ))}
          </div>
        </motion.div>
      )}
    </>
  );

  // ---- Back-office ----
  const renderBODashboard = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard index={0} label="Total Vendas" value={stats?.total_sales || 0} icon={ShoppingCart} iconGradient="bg-gradient-to-br from-cyber-500 to-cyber-600" valueColor="text-white" />
      </div>

      {[
        stats?.telecomunicacoes?.count > 0 && { index: 1, label: "Telecomunicacoes", value: stats.telecomunicacoes.count, icon: Phone, gradient: "from-cyan-500 to-cyan-600", color: "text-cyan-400" },
        stats?.energia?.count > 0 && { index: 2, label: "Energia", value: stats.energia.count, subtitle: `DD: ${stats?.dd_count || 0} · FE: ${stats?.fe_count || 0}`, icon: Zap, gradient: "from-amber-500 to-amber-600", color: "text-amber-400" },
        stats?.solar?.count > 0 && { index: 3, label: "Solar", value: stats.solar.count, icon: Sun, gradient: "from-emerald-500 to-emerald-600", color: "text-emerald-400" },
        stats?.mobilidade_eletrica?.count > 0 && { index: 4, label: "Mobilidade Eletrica", value: stats.mobilidade_eletrica.count, icon: Car, gradient: "from-teal-500 to-teal-600", color: "text-teal-400" },
      ].filter(Boolean).length > 0 && (
        <div className={`grid grid-cols-1 md:grid-cols-${Math.min([stats?.telecomunicacoes?.count > 0, stats?.energia?.count > 0, stats?.solar?.count > 0, stats?.mobilidade_eletrica?.count > 0].filter(Boolean).length, 4)} gap-4`}>
          {[
            stats?.telecomunicacoes?.count > 0 && { index: 1, label: "Telecomunicacoes", value: stats.telecomunicacoes.count, icon: Phone, gradient: "from-cyan-500 to-cyan-600", color: "text-cyan-400" },
            stats?.energia?.count > 0 && { index: 2, label: "Energia", value: stats.energia.count, subtitle: `DD: ${stats?.dd_count || 0} · FE: ${stats?.fe_count || 0}`, icon: Zap, gradient: "from-amber-500 to-amber-600", color: "text-amber-400" },
            stats?.solar?.count > 0 && { index: 3, label: "Solar", value: stats.solar.count, icon: Sun, gradient: "from-emerald-500 to-emerald-600", color: "text-emerald-400" },
            stats?.mobilidade_eletrica?.count > 0 && { index: 4, label: "Mobilidade Eletrica", value: stats.mobilidade_eletrica.count, icon: Car, gradient: "from-teal-500 to-teal-600", color: "text-teal-400" },
          ].filter(Boolean).map(card => (
            <StatCard key={card.index} index={card.index} label={card.label} value={card.value} subtitle={card.subtitle} icon={card.icon} iconGradient={`bg-gradient-to-br ${card.gradient}`} valueColor={card.color} />
          ))}
        </div>
      )}
    </>
  );

  // ---- Commercial ----
  const renderCommercialDashboard = () => renderBODashboard();

  // ---- Gestor Nivel 1 ----
  const renderManagerLevel1Dashboard = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          index={0}
          label="Total Vendas"
          value={stats?.total_sales || 0}
          subtitle="Proprias e de parceiros"
          icon={ShoppingCart}
          iconGradient="bg-gradient-to-br from-cyber-500 to-cyber-600"
          valueColor="text-white"
        />
        <StatCard
          index={1}
          label="Minhas Comissoes Brutas"
          value={stats?.own_commission_gross || 0}
          prefix="€"
          decimals={2}
          subtitle="Vendas proprias"
          icon={Euro}
          iconGradient="bg-gradient-to-br from-cyber-400 to-cyber-600"
          valueColor="text-cyber-400"
        />
        <StatCard
          index={2}
          label="Minhas Retencoes"
          value={stats?.own_retention || 0}
          prefix="€"
          decimals={2}
          subtitle="A reter temporariamente"
          icon={Award}
          iconGradient="bg-gradient-to-br from-cyber-500 to-cyber-600"
          valueColor="text-cyber-400"
        />
        <StatCard
          index={3}
          label="Minhas Comissoes Liquidas"
          value={(stats?.own_commission_gross || 0) - (stats?.own_retention || 0)}
          prefix="€"
          decimals={2}
          subtitle="Apos retencoes"
          icon={TrendingUp}
          iconGradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
          valueColor="text-emerald-400"
        />
      </div>

      {/* Objectives radial progress */}
      {stats?.objectives_progress && stats.objectives_progress.length > 0 && (
        <motion.div variants={chartVariants} initial="hidden" animate="visible" className="glass-ultra p-6 border border-cyber-500/10 rounded-2xl">
          <h3 className="text-lg font-bold text-white mb-1">Cumprimento de Objetivos Mensais</h3>
          <p className="text-xs text-slate-500 mb-6">Progresso por operadora</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stats.objectives_progress.map((progress, idx) => {
              const objectives = [];
              if (progress.operator_scope === "energia") {
                if (progress.targets.electricity > 0)
                  objectives.push({
                    name: "Eletricidade",
                    actual: progress.actual.electricity,
                    target: progress.targets.electricity,
                    remaining: Math.max(0, progress.targets.electricity - progress.actual.electricity),
                    percentage: progress.percentage.electricity,
                    color: "#06b6d4",
                  });
                if (progress.targets.gas > 0)
                  objectives.push({
                    name: "Gas",
                    actual: progress.actual.gas,
                    target: progress.targets.gas,
                    remaining: Math.max(0, progress.targets.gas - progress.actual.gas),
                    percentage: progress.percentage.gas,
                    color: "#f59e0b",
                  });
              }
              if (progress.operator_scope === "telecomunicacoes") {
                if (progress.targets.tv > 0)
                  objectives.push({
                    name: "TV",
                    actual: progress.actual.tv,
                    target: progress.targets.tv,
                    remaining: Math.max(0, progress.targets.tv - progress.actual.tv),
                    percentage: progress.percentage.tv,
                    color: "#06b6d4",
                  });
                if (progress.targets.fiber > 0)
                  objectives.push({
                    name: "Fibra/NET",
                    actual: progress.actual.fiber,
                    target: progress.targets.fiber,
                    remaining: Math.max(0, progress.targets.fiber - progress.actual.fiber),
                    percentage: progress.percentage.fiber,
                    color: "#10b981",
                  });
              }
              return objectives.map((objective, objIdx) => (
                <div key={`${idx}-${objIdx}`} className="stat-card flex flex-col items-center group">
                  <h4 className="font-semibold text-white mb-1">{progress.operator_name}</h4>
                  <p className="text-sm text-slate-500 mb-4">{objective.name}</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <defs>
                        <linearGradient id={`objGrad-${idx}-${objIdx}`} x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor={objective.color} stopOpacity={1} />
                          <stop offset="100%" stopColor={objective.color} stopOpacity={0.6} />
                        </linearGradient>
                      </defs>
                      <Pie
                        data={[
                          { name: "Atingido", value: objective.actual },
                          { name: "Restante", value: objective.remaining },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        dataKey="value"
                        startAngle={90}
                        endAngle={-270}
                        cornerRadius={6}
                        animationDuration={1200}
                      >
                        <Cell fill={`url(#objGrad-${idx}-${objIdx})`} />
                        <Cell fill="rgba(255,255,255,0.04)" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <p className="text-2xl font-bold mt-2" style={{ color: objective.color }}>
                    {objective.percentage.toFixed(0)}%
                  </p>
                  <p className="text-sm text-slate-500">
                    {objective.actual} / {objective.target}
                  </p>
                </div>
              ));
            })}
          </div>
        </motion.div>
      )}

      {[
        stats?.telecomunicacoes?.count > 0 && { index: 4, label: "Telecomunicacoes", value: stats.telecomunicacoes.count, subtitle: `€${stats.telecomunicacoes.monthly_total?.toFixed(2) || "0.00"}/mes`, icon: Phone, gradient: "from-cyan-500 to-cyan-600", color: "text-cyan-400" },
        stats?.energia?.count > 0 && { index: 5, label: "Energia", value: stats.energia.count, subtitle: `${stats.energia.electricity || 0} elet. / ${stats.energia.gas || 0} gas · DD: ${stats?.dd_count || 0} FE: ${stats?.fe_count || 0}`, icon: Zap, gradient: "from-amber-500 to-amber-600", color: "text-amber-400" },
        stats?.solar?.count > 0 && { index: 6, label: "Solar", value: stats.solar.count, icon: Sun, gradient: "from-emerald-500 to-emerald-600", color: "text-emerald-400" },
        stats?.mobilidade_eletrica?.count > 0 && { index: 7, label: "Mobilidade Eletrica", value: stats.mobilidade_eletrica.count, icon: Car, gradient: "from-teal-500 to-teal-600", color: "text-teal-400" },
      ].filter(Boolean).length > 0 && (
        <div className={`grid grid-cols-1 md:grid-cols-${Math.min([stats?.telecomunicacoes?.count > 0, stats?.energia?.count > 0, stats?.solar?.count > 0, stats?.mobilidade_eletrica?.count > 0].filter(Boolean).length, 4)} gap-4`}>
          {[
            stats?.telecomunicacoes?.count > 0 && { index: 4, label: "Telecomunicacoes", value: stats.telecomunicacoes.count, subtitle: `€${stats.telecomunicacoes.monthly_total?.toFixed(2) || "0.00"}/mes`, icon: Phone, gradient: "from-cyan-500 to-cyan-600", color: "text-cyan-400" },
            stats?.energia?.count > 0 && { index: 5, label: "Energia", value: stats.energia.count, subtitle: `${stats.energia.electricity || 0} elet. / ${stats.energia.gas || 0} gas · DD: ${stats?.dd_count || 0} FE: ${stats?.fe_count || 0}`, icon: Zap, gradient: "from-amber-500 to-amber-600", color: "text-amber-400" },
            stats?.solar?.count > 0 && { index: 6, label: "Solar", value: stats.solar.count, icon: Sun, gradient: "from-emerald-500 to-emerald-600", color: "text-emerald-400" },
            stats?.mobilidade_eletrica?.count > 0 && { index: 7, label: "Mobilidade Eletrica", value: stats.mobilidade_eletrica.count, icon: Car, gradient: "from-teal-500 to-teal-600", color: "text-teal-400" },
          ].filter(Boolean).map(card => (
            <StatCard key={card.index} index={card.index} label={card.label} value={card.value} subtitle={card.subtitle} icon={card.icon} iconGradient={`bg-gradient-to-br ${card.gradient}`} valueColor={card.color} />
          ))}
        </div>
      )}
    </>
  );

  /* ====================================================================
     Proposals dashboard
  ==================================================================== */
  const renderProposalsDashboard = () => {
    if (!proposalStats) return null;
    const partnersList = Object.values(proposalStats.by_partner || {});
    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            index={0}
            label="Total Propostas"
            value={proposalStats.total_proposals || 0}
            subtitle="Em analise"
            icon={Clock}
            iconGradient="bg-gradient-to-br from-cyber-500 to-cyber-600"
            valueColor="text-white"
            onClick={() => handleProposalCardClick("all")}
          />
          <StatCard
            index={1}
            label="Ate 7 Dias"
            value={proposalStats.by_age?.up_to_7 || 0}
            subtitle="Recentes"
            icon={TrendingUp}
            iconGradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
            valueColor="text-emerald-400"
            onClick={() => handleProposalCardClick("up_to_7")}
          />
          <StatCard
            index={2}
            label="7 a 14 Dias"
            value={proposalStats.by_age?.from_7_to_14 || 0}
            subtitle="Requer atencao"
            icon={AlertTriangle}
            iconGradient="bg-gradient-to-br from-amber-500 to-amber-600"
            valueColor="text-amber-400"
            onClick={() => handleProposalCardClick("from_7_to_14")}
          />
          <StatCard
            index={3}
            label="Mais de 14 Dias"
            value={proposalStats.by_age?.over_14 || 0}
            subtitle="Urgente"
            icon={AlertTriangle}
            iconGradient="bg-gradient-to-br from-rose-500 to-rose-600"
            valueColor="text-rose-400"
            onClick={() => handleProposalCardClick("over_14")}
          />
        </div>

        {proposalStats.total_commission !== undefined && (
          <StatCard
            index={4}
            label="Comissoes Pendentes em Propostas"
            value={proposalStats.total_commission || 0}
            prefix="€"
            decimals={2}
            subtitle="Aguardando conclusao"
            icon={Euro}
            iconGradient="bg-gradient-to-br from-cyber-400 to-cyber-600"
            valueColor="text-cyber-400"
          />
        )}

        {proposalStats.own_commission !== undefined && proposalStats.own_commission > 0 && (
          <motion.div
            custom={5}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="stat-card relative overflow-hidden border-cyber-500/20"
          >
            {/* Cyber accent glow strip */}
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyber-400 to-transparent" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-cyber-400 uppercase tracking-wider mb-3">
                  Minhas Comissoes em Propostas
                </p>
                <p className="text-2xl lg:text-3xl font-bold text-cyber-300">
                  <AnimatedNumber value={proposalStats.own_commission} prefix="€" decimals={2} duration={1400} />
                </p>
                <p className="text-xs text-slate-500 mt-1">Vendas proprias pendentes</p>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-cyber-400 to-cyber-600 shadow-lg shadow-cyber-500/20">
                <Award className="w-6 h-6 text-dark-900" />
              </div>
            </div>
          </motion.div>
        )}

        {[
          proposalStats.by_scope?.telecomunicacoes > 0 && { index: 5, label: "Telecomunicacoes", value: proposalStats.by_scope.telecomunicacoes, icon: Phone, gradient: "from-cyan-500 to-cyan-600", color: "text-cyan-400" },
          proposalStats.by_scope?.energia > 0 && { index: 6, label: "Energia", value: proposalStats.by_scope.energia, icon: Zap, gradient: "from-amber-500 to-amber-600", color: "text-amber-400" },
          proposalStats.by_scope?.solar > 0 && { index: 7, label: "Solar", value: proposalStats.by_scope.solar, icon: Sun, gradient: "from-emerald-500 to-emerald-600", color: "text-emerald-400" },
          proposalStats.by_scope?.mobilidade_eletrica > 0 && { index: 8, label: "Mobilidade Eletrica", value: proposalStats.by_scope.mobilidade_eletrica, icon: Car, gradient: "from-teal-500 to-teal-600", color: "text-teal-400" },
        ].filter(Boolean).length > 0 && (
          <div className={`grid grid-cols-1 md:grid-cols-${Math.min([proposalStats.by_scope?.telecomunicacoes > 0, proposalStats.by_scope?.energia > 0, proposalStats.by_scope?.solar > 0, proposalStats.by_scope?.mobilidade_eletrica > 0].filter(Boolean).length, 4)} gap-4`}>
            {[
              proposalStats.by_scope?.telecomunicacoes > 0 && { index: 5, label: "Telecomunicacoes", value: proposalStats.by_scope.telecomunicacoes, icon: Phone, gradient: "from-cyan-500 to-cyan-600", color: "text-cyan-400" },
              proposalStats.by_scope?.energia > 0 && { index: 6, label: "Energia", value: proposalStats.by_scope.energia, icon: Zap, gradient: "from-amber-500 to-amber-600", color: "text-amber-400" },
              proposalStats.by_scope?.solar > 0 && { index: 7, label: "Solar", value: proposalStats.by_scope.solar, icon: Sun, gradient: "from-emerald-500 to-emerald-600", color: "text-emerald-400" },
              proposalStats.by_scope?.mobilidade_eletrica > 0 && { index: 8, label: "Mobilidade Eletrica", value: proposalStats.by_scope.mobilidade_eletrica, icon: Car, gradient: "from-teal-500 to-teal-600", color: "text-teal-400" },
            ].filter(Boolean).map(card => (
              <StatCard key={card.index} index={card.index} label={card.label} value={card.value} icon={card.icon} iconGradient={`bg-gradient-to-br ${card.gradient}`} valueColor={card.color} />
            ))}
          </div>
        )}

        {/* Partners with open proposals */}
        {partnersList.length > 0 && (
          <motion.div variants={chartVariants} initial="hidden" animate="visible" className="glass-ultra p-6 border border-cyber-500/10 rounded-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Parceiros com Propostas em Curso</h3>
            <p className="text-xs text-slate-500 mb-4">Ordenado por comissoes pendentes</p>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th className="text-cyber-400">Parceiro</th>
                    <th className="text-center text-cyber-400">Propostas</th>
                    {proposalStats.total_commission !== undefined && (
                      <th className="text-right text-cyber-400">Comissoes Pendentes</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {partnersList
                    .sort((a, b) => (b.commission || b.count) - (a.commission || a.count))
                    .map((partner, index) => (
                      <tr key={index} className="hover:bg-cyber-500/5 transition-colors duration-200">
                        <td className="font-medium text-white">{partner.name}</td>
                        <td className="text-center">{partner.count}</td>
                        {proposalStats.total_commission !== undefined && (
                          <td className="text-right font-bold text-cyber-400">
                            €{partner.commission?.toFixed(2) || "0.00"}
                          </td>
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

  /* ====================================================================
     12-month trend data helper
  ==================================================================== */
  const prepare12MonthsData = () => {
    if (!stats?.last_12_months) return [];
    return stats.last_12_months.map((item) => ({
      name: `${months[item.month_num - 1].substring(0, 3)}/${item.year.toString().substring(2)}`,
      Telecom: item.telecomunicacoes,
      Energia: item.energia,
      Solar: item.solar,
      Mobilidade: item.mobilidade_eletrica || 0,
    }));
  };

  const get12MonthsActiveScopes = () => {
    const data = prepare12MonthsData();
    const scopes = [
      { key: 'Telecom', label: 'Telecomunicacoes', color: '#06b6d4', gradId: 'gradTelecom' },
      { key: 'Energia', label: 'Energia', color: '#f59e0b', gradId: 'gradEnergia' },
      { key: 'Solar', label: 'Solar', color: '#10b981', gradId: 'gradSolar' },
      { key: 'Mobilidade', label: 'Mobilidade Eletrica', color: '#a78bfa', gradId: 'gradMobilidade' },
    ];
    return scopes.filter(s => data.some(d => (d[s.key] || 0) > 0));
  };

  /* ====================================================================
     Charts section  --  spectacular cyber-styled Recharts
  ==================================================================== */
  const renderCharts = () => (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ---- Pie Chart: Vendas por Estado ---- */}
        {statusData.length > 0 && (
          <motion.div variants={chartVariants} initial="hidden" animate="visible" className="glass-ultra p-6 border border-cyber-500/10 rounded-2xl">
            <h3 className="text-base font-bold text-white mb-1">Vendas por Estado</h3>
            <p className="text-xs text-slate-500 mb-4">Distribuicao mensal</p>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <defs>
                  {/* gradient fills: cyan -> emerald continuum for pie segments */}
                  <linearGradient id="pieGrad0" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                  <linearGradient id="pieGrad1" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#34d399" />
                  </linearGradient>
                  <linearGradient id="pieGrad2" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#fbbf24" />
                  </linearGradient>
                  <linearGradient id="pieGrad3" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" />
                    <stop offset="100%" stopColor="#fb7185" />
                  </linearGradient>
                  <linearGradient id="pieGrad4" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#a78bfa" />
                  </linearGradient>
                  <linearGradient id="pieGrad5" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#67e8f9" />
                  </linearGradient>
                  {/* Glow filter */}
                  <filter id="pieGlow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  dataKey="value"
                  paddingAngle={3}
                  cornerRadius={6}
                  animationBegin={0}
                  animationDuration={1200}
                  filter="url(#pieGlow)"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`url(#pieGrad${index % 6})`} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip content={<CyberTooltip />} />
                <Legend
                  formatter={(value) => (
                    <span style={{ color: "#94a3b8", fontSize: "12px" }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* ---- Bar Chart: Vendas por Ambito (only scopes with data) ---- */}
        {(() => {
          const scopeColors = ['#06b6d4', '#f59e0b', '#10b981', '#a78bfa'];
          const allScopes = [
            { name: 'Telecom', value: stats?.telecomunicacoes?.count || 0 },
            { name: 'Energia', value: stats?.energia?.count || 0 },
            { name: 'Solar', value: stats?.solar?.count || 0 },
            { name: 'Mobilidade', value: stats?.mobilidade_eletrica?.count || 0 },
          ].filter(s => s.value > 0);
          if (allScopes.length === 0) return null;
          return (
            <motion.div variants={chartVariants} initial="hidden" animate="visible" className="glass-ultra p-6 border border-cyber-500/10 rounded-2xl">
              <h3 className="text-base font-bold text-white mb-1">Vendas por Ambito</h3>
              <p className="text-xs text-slate-500 mb-4">Comparacao mensal</p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={allScopes}>
                  <defs>
                    {scopeColors.map((color, i) => (
                      <linearGradient key={i} id={`barGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={1} />
                        <stop offset="100%" stopColor={color} stopOpacity={0.6} />
                      </linearGradient>
                    ))}
                    <filter id="barGlow">
                      <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.4)" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 12, fill: "#94a3b8" }} tickLine={false} axisLine={{ stroke: "rgba(51, 65, 85, 0.4)" }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 12, fill: "#94a3b8" }} tickLine={false} axisLine={{ stroke: "rgba(51, 65, 85, 0.4)" }} />
                  <Tooltip content={<CyberTooltip />} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} animationDuration={1200} filter="url(#barGlow)">
                    {allScopes.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={`url(#barGrad${index % scopeColors.length})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          );
        })()}
      </div>

      {/* ---- Partner stats table ---- */}
      {partnerStats.length > 0 && (
        <motion.div variants={chartVariants} initial="hidden" animate="visible" className="glass-ultra p-6 border border-cyber-500/10 rounded-2xl">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="text-base font-bold text-white mb-1">Vendas por Parceiro</h3>
              <p className="text-xs text-slate-500">{getFilterLabel()}</p>
            </div>
            {user?.role === 'admin' && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex rounded-lg overflow-hidden border border-cyber-500/20">
                  {[
                    { mode: 'month', label: 'Mes' },
                    { mode: 'specificMonth', label: 'Meses' },
                    { mode: 'week', label: 'Semana' },
                    { mode: 'day', label: 'Dia' },
                  ].map(({ mode, label }) => (
                    <button
                      key={mode}
                      onClick={() => {
                        setPartnerTableFilterMode(mode);
                        if (mode === 'week' && !partnerTableFilterKey) setPartnerTableFilterKey(availableWeeks[0]?.key || null);
                        else if (mode === 'day' && !partnerTableFilterKey) setPartnerTableFilterKey(availableDays[0]?.key || null);
                        else if (mode === 'specificMonth') setPartnerTableFilterKey(availableMonths[1]?.key || availableMonths[0]?.key || null);
                        else if (mode === 'month') setPartnerTableFilterKey(null);
                      }}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${partnerTableFilterMode === mode ? 'bg-cyber-500/20 text-cyber-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {partnerTableFilterMode === 'week' && (
                  <select
                    value={partnerTableFilterKey || availableWeeks[0]?.key || ''}
                    onChange={(e) => setPartnerTableFilterKey(e.target.value)}
                    className="bg-dark-800/80 border border-cyber-500/20 text-slate-300 px-2 py-1.5 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-cyber-500/40 transition-all duration-200 appearance-none cursor-pointer"
                  >
                    {availableWeeks.map(w => (
                      <option key={w.key} value={w.key}>{w.label}</option>
                    ))}
                  </select>
                )}
                {partnerTableFilterMode === 'day' && (
                  <select
                    value={partnerTableFilterKey || availableDays[0]?.key || ''}
                    onChange={(e) => setPartnerTableFilterKey(e.target.value)}
                    className="bg-dark-800/80 border border-cyber-500/20 text-slate-300 px-2 py-1.5 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-cyber-500/40 transition-all duration-200 appearance-none cursor-pointer"
                  >
                    {availableDays.map(d => (
                      <option key={d.key} value={d.key}>{d.label}</option>
                    ))}
                  </select>
                )}
                {partnerTableFilterMode === 'specificMonth' && (
                  <select
                    value={partnerTableFilterKey || availableMonths[1]?.key || ''}
                    onChange={(e) => setPartnerTableFilterKey(e.target.value)}
                    className="bg-dark-800/80 border border-cyber-500/20 text-slate-300 px-2 py-1.5 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-cyber-500/40 transition-all duration-200 appearance-none cursor-pointer"
                  >
                    {availableMonths.filter((_, i) => i > 0).map(m => (
                      <option key={m.key} value={m.key}>{m.label}</option>
                    ))}
                  </select>
                )}
                <button
                  onClick={exportPartnerStatsToExcel}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors duration-200"
                >
                  <Download className="w-3.5 h-3.5" />
                  Excel
                </button>
              </div>
            )}
          </div>
          {operators.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th className="text-cyber-400">Parceiro</th>
                    {operators.map((op) => (
                      <th key={op.id} className="text-center text-cyber-400">
                        {op.name}
                      </th>
                    ))}
                    <th className="text-right text-cyber-400">Total Comissoes</th>
                  </tr>
                </thead>
                <tbody>
                  {partnerStats.map((partner, index) => (
                    <tr key={index} className="hover:bg-cyber-500/5 transition-colors duration-200">
                      <td className="font-medium text-white">{partner.name}</td>
                      {operators.map((op) => (
                        <td key={op.id} className="text-center">
                          {partner.operators[op.name] || "-"}
                        </td>
                      ))}
                      <td className="text-right font-bold text-cyber-400">
                        €{partner.total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th className="text-cyber-400">Parceiro</th>
                    <th className="text-right text-cyber-400">Total Comissoes</th>
                  </tr>
                </thead>
                <tbody>
                  {partnerStats.map((partner, index) => (
                    <tr key={index} className="hover:bg-cyber-500/5 transition-colors duration-200">
                      <td className="font-medium text-white">{partner.name}</td>
                      <td className="text-right font-bold text-cyber-400">
                        €{partner.total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}

      {/* ---- Area Chart: 12-month evolution (only active scopes) ---- */}
      {stats?.last_12_months && stats.last_12_months.length > 0 && get12MonthsActiveScopes().length > 0 && (
        <motion.div variants={chartVariants} initial="hidden" animate="visible" className="glass-ultra p-6 border border-cyber-500/10 rounded-2xl">
          <h3 className="text-base font-bold text-white mb-1">Evolucao Ultimos 12 Meses</h3>
          <p className="text-xs text-slate-500 mb-4">Tendencia por ambito</p>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={prepare12MonthsData()}>
              <defs>
                <linearGradient id="gradTelecom" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradEnergia" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradSolar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradMobilidade" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                </linearGradient>
                <filter id="areaGlow">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.4)" vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={{ stroke: "rgba(51, 65, 85, 0.4)" }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={{ stroke: "rgba(51, 65, 85, 0.4)" }} />
              <Tooltip content={<CyberTooltip />} />
              <Legend formatter={(value) => <span style={{ color: "#94a3b8", fontSize: "12px" }}>{value}</span>} />
              {get12MonthsActiveScopes().map((scope, i) => (
                <Area
                  key={scope.key}
                  type="monotone"
                  dataKey={scope.key}
                  stroke={scope.color}
                  fill={`url(#${scope.gradId})`}
                  strokeWidth={2.5}
                  name={scope.label}
                  animationDuration={1500}
                  dot={false}
                  activeDot={{ r: 5, stroke: scope.color, strokeWidth: 2, fill: "#0a121e" }}
                  filter={i === 0 ? "url(#areaGlow)" : undefined}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      )}
    </>
  );

  /* ====================================================================
     MAIN RENDER
  ==================================================================== */
  return (
    <div className="space-y-6 p-2 animate-fade-in">
      {/* ---- Header + filters ---- */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient-cyber tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Bem-vindo, {user?.name}
          </p>
        </div>

        <div className="flex gap-2 items-center">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="bg-dark-800/80 border border-cyber-500/20 text-slate-300 px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-cyber-500/40 focus:border-cyber-500/40 transition-all duration-200 hover:border-cyber-500/30 appearance-none cursor-pointer backdrop-blur-sm"
          >
            {months.map((month, index) => {
              const currentDate = new Date();
              const currentYear = currentDate.getFullYear();
              const currentMonth = currentDate.getMonth() + 1;
              const isDisabled = selectedYear > currentYear || (selectedYear === currentYear && index + 1 > currentMonth);
              return (
                <option
                  key={index}
                  value={index + 1}
                  className="bg-dark-900 text-slate-300"
                  disabled={isDisabled}
                >
                  {month}
                </option>
              );
            })}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="bg-dark-800/80 border border-cyber-500/20 text-slate-300 px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-cyber-500/40 focus:border-cyber-500/40 transition-all duration-200 hover:border-cyber-500/30 appearance-none cursor-pointer backdrop-blur-sm"
          >
            {getAvailableYears().map((year) => (
              <option key={year} value={year} className="bg-dark-900 text-slate-300">
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ---- Tabbed dashboards (admin, gestor_nv1, partner) ---- */}
      {user?.role === "admin" || user?.role === "gestor_nv1" || user?.role === "partner" ? (
        <Tabs defaultValue="total" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 bg-dark-800/60 border border-cyber-500/10 p-1 rounded-xl backdrop-blur-sm">
            <TabsTrigger
              value="total"
              className="rounded-lg data-[state=active]:bg-cyber-500/10 data-[state=active]:text-cyber-400 data-[state=active]:shadow-sm data-[state=active]:shadow-cyber-500/10 text-slate-500 text-sm font-medium transition-all duration-200"
            >
              Vendas Totais
            </TabsTrigger>
            {user?.is_commissioned && (
              <TabsTrigger
                value="own"
                className="rounded-lg data-[state=active]:bg-cyber-500/10 data-[state=active]:text-cyber-400 data-[state=active]:shadow-sm data-[state=active]:shadow-cyber-500/10 text-slate-500 text-sm font-medium transition-all duration-200"
              >
                Vendas Proprias
              </TabsTrigger>
            )}
            <TabsTrigger
              value="proposals"
              className="rounded-lg data-[state=active]:bg-cyber-500/10 data-[state=active]:text-cyber-400 data-[state=active]:shadow-sm data-[state=active]:shadow-cyber-500/10 text-slate-500 text-sm font-medium transition-all duration-200"
            >
              Propostas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="total" className="space-y-4">
            {user?.role === "admin" && renderAdminDashboard()}
            {user?.role === "gestor_nv1" && renderManagerLevel1Dashboard()}
            {user?.role === "partner" && (stats?.partner_type === "D2D" ? renderD2DPartnerDashboard() : renderPartnerDashboard())}
            {renderCharts()}
          </TabsContent>

          {user?.is_commissioned && (
            <TabsContent value="own" className="space-y-4">
              {user?.role === "admin" && stats && (
                <motion.div
                  custom={0}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  className="stat-card relative overflow-hidden border-cyber-500/20"
                >
                  {/* Cyber accent line at top */}
                  <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyber-400 to-transparent" />
                  <h3 className="text-base font-bold text-cyber-400 mb-4">Minhas Comissoes</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="stat-card">
                      <p className="text-xs text-slate-500 mb-2">Comissoes Brutas</p>
                      <p className="text-xl font-bold text-cyber-400">
                        <AnimatedNumber
                          value={(stats?.admin_commission_pending || 0) + (stats?.admin_commission_paid || 0)}
                          prefix="€"
                          decimals={2}
                          duration={1400}
                        />
                      </p>
                    </div>
                    <div className="stat-card">
                      <p className="text-xs text-slate-500 mb-2">Retencoes</p>
                      <p className="text-xl font-bold text-cyber-400">
                        <AnimatedNumber value={stats?.admin_retention || 0} prefix="€" decimals={2} duration={1400} />
                      </p>
                    </div>
                    <div className="stat-card">
                      <p className="text-xs text-slate-500 mb-2">Comissoes Liquidas</p>
                      <p className="text-xl font-bold text-emerald-400">
                        <AnimatedNumber
                          value={
                            (stats?.admin_commission_pending || 0) +
                            (stats?.admin_commission_paid || 0) -
                            (stats?.admin_retention || 0)
                          }
                          prefix="€"
                          decimals={2}
                          duration={1400}
                        />
                      </p>
                    </div>
                    <div className="stat-card">
                      <p className="text-xs text-slate-500 mb-2">A Receber</p>
                      <p className="text-xl font-bold text-white">
                        <AnimatedNumber
                          value={
                            (stats?.admin_commission_paid || 0) -
                            (stats?.admin_retention || 0) *
                              ((stats?.admin_commission_paid || 0) /
                                ((stats?.admin_commission_pending || 0) + (stats?.admin_commission_paid || 0) || 1))
                          }
                          prefix="€"
                          decimals={2}
                          duration={1400}
                        />
                      </p>
                    </div>
                    <div className="stat-card">
                      <p className="text-xs text-slate-500 mb-2">Minhas Vendas</p>
                      <p className="text-xl font-bold text-white">
                        <AnimatedNumber value={stats?.admin_sales_count || 0} duration={1400} />
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </TabsContent>
          )}

          <TabsContent value="proposals" className="space-y-4">
            {renderProposalsDashboard()}
          </TabsContent>
        </Tabs>
      ) : (
        <>
          {user?.role === "bo" && renderBODashboard()}
          {user?.role === "partner_commercial" && renderCommercialDashboard()}
          {renderCharts()}
        </>
      )}

      {/* ---- Proposal detail dialog ---- */}
      <Dialog open={proposalDialogOpen} onOpenChange={setProposalDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-dark-900/95 backdrop-blur-xl border border-cyber-500/20 shadow-2xl shadow-cyber-500/5 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white text-lg">
              Propostas -{" "}
              {proposalFilter === "all"
                ? "Todas"
                : proposalFilter === "up_to_7"
                  ? "Ate 7 Dias"
                  : proposalFilter === "from_7_to_14"
                    ? "7 a 14 Dias"
                    : "Mais de 14 Dias"}
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              {filteredProposals.length} proposta(s) encontrada(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {filteredProposals.length === 0 ? (
              <p className="text-center text-slate-500 py-8">Nenhuma proposta encontrada</p>
            ) : (
              filteredProposals.map((proposal) => {
                const daysElapsed = Math.floor(
                  (new Date() - new Date(proposal.created_at)) / (1000 * 60 * 60 * 24)
                );
                return (
                  <motion.div
                    key={proposal.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="stat-card hover:border-cyber-500/20 transition-all duration-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-bold text-white">{proposal.sale_code}</span>
                          <Badge
                            variant={
                              daysElapsed <= 7
                                ? "default"
                                : daysElapsed <= 14
                                  ? "warning"
                                  : "destructive"
                            }
                          >
                            {daysElapsed} dias
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-slate-500">Cliente: </span>
                            <span className="text-white">{proposal.client_name}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Parceiro: </span>
                            <span className="text-white">{proposal.partners?.name || "N/A"}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Operadora: </span>
                            <span className="text-white">{proposal.operators?.name || "N/A"}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Data: </span>
                            <span className="text-white">
                              {new Date(proposal.date).toLocaleDateString("pt-PT")}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedSaleId(proposal.id);
                          setDetailDialogOpen(true);
                        }}
                        className="btn-primary text-sm px-4 py-2 bg-gradient-to-r from-cyber-500 to-cyber-600 hover:from-cyber-400 hover:to-cyber-500 text-white border-0 shadow-lg shadow-cyber-500/20 transition-all duration-200"
                      >
                        Ver Detalhes
                      </Button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ---- Sale detail dialog ---- */}
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
