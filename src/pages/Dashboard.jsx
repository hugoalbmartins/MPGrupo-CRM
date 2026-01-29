import React, { useState } from "react";
import { toast } from "sonner";
import { ShoppingCart, Phone, Zap, Sun, Award, CheckCircle, Clock, TrendingUp } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SaleDetailDialog from "../components/SaleDetailDialog";
import { useDashboardStats, useProposalStats, usePartnerStats, useProposals } from "@/hooks/useDashboardData";

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
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const getAvailableYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear; i >= currentYear - 5; i--) {
      years.push(i);
    }
    return years;
  };

  if (statsLoading) {
    return (
      <div className="space-y-6 p-6 animate-fade-in">
        <div className="h-10 bg-gray-200 rounded-lg w-1/4 animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="glass-ultra p-6 h-32 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map(i => (
            <div key={i} className="glass-ultra p-6 h-96 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="h-80 bg-gray-100 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4'];
  const statusData = Object.entries(stats?.by_status || {}).map(([name, value]) => ({ name, value }));

  // Render different dashboards based on role
  const renderAdminDashboard = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="stat-card spring-transition">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-semibold mb-2" style={{ color: '#595959' }}>Total Vendas</p>
              <p className="text-3xl font-bold mb-1" style={{ color: '#000000' }}>{stats?.total_sales || 0}</p>
              <p className="text-xs font-medium" style={{ color: '#7a7a7a' }}>{stats?.total_partners || 0} parceiros</p>
            </div>
            <div className="w-14 h-14 bg-gradient-to-r from-navy-900 to-navy-800 rounded-xl flex items-center justify-center shadow-lg spring-transition hover:scale-110">
              <ShoppingCart className="w-7 h-7 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card spring-transition">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-semibold mb-2" style={{ color: '#595959' }}>Comissões Brutas</p>
              <p className="text-3xl font-bold mb-1 text-purple-600">€{stats?.total_commission_gross?.toFixed(2) || '0.00'}</p>
              <p className="text-xs font-medium" style={{ color: '#7a7a7a' }}>Antes de retenções</p>
            </div>
            <div className="w-14 h-14 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg spring-transition hover:scale-110">
              <Award className="w-7 h-7 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card spring-transition">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-semibold mb-2" style={{ color: '#595959' }}>Comissões Líquidas</p>
              <p className="text-3xl font-bold mb-1 text-green-600">€{stats?.total_commission?.toFixed(2) || '0.00'}</p>
              <p className="text-xs font-medium" style={{ color: '#7a7a7a' }}>Após retenções</p>
            </div>
            <div className="w-14 h-14 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg spring-transition hover:scale-110">
              <Award className="w-7 h-7 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card spring-transition">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-semibold mb-2" style={{ color: '#595959' }}>A Pagar</p>
              <p className="text-3xl font-bold mb-1 text-orange-600">€{stats?.commission_to_pay?.toFixed(2) || '0.00'}</p>
              <p className="text-xs font-medium" style={{ color: '#7a7a7a' }}>{stats?.unpaid_by_operator || 0} vendas</p>
            </div>
            <div className="w-14 h-14 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg spring-transition hover:scale-110">
              <Award className="w-7 h-7 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card spring-transition">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-semibold mb-2" style={{ color: '#595959' }}>Pagas Operador</p>
              <p className="text-3xl font-bold mb-1 text-green-600">{stats?.paid_by_operator || 0}</p>
            </div>
            <div className="w-14 h-14 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg spring-transition hover:scale-110">
              <CheckCircle className="w-7 h-7 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card spring-transition">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-semibold mb-2" style={{ color: '#595959' }}>Retenções Mês Corrente</p>
              <p className="text-3xl font-bold mb-1 text-blue-600">€{stats?.current_month_retentions?.toFixed(2) || '0.00'}</p>
              <p className="text-xs font-medium" style={{ color: '#7a7a7a' }}>A reter das comissões</p>
            </div>
            <div className="w-14 h-14 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg spring-transition hover:scale-110">
              <Award className="w-7 h-7 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card spring-transition">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-semibold mb-2" style={{ color: '#595959' }}>Retenções a Devolver</p>
              <p className="text-3xl font-bold mb-1 text-green-600">€{stats?.retentions_to_return?.toFixed(2) || '0.00'}</p>
              <p className="text-xs font-medium" style={{ color: '#7a7a7a' }}>Próximo auto (6 meses)</p>
            </div>
            <div className="w-14 h-14 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg spring-transition hover:scale-110">
              <CheckCircle className="w-7 h-7 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Telecomunicações</p>
              <p className="text-2xl font-bold color-cyan">{stats?.telecomunicacoes?.count || 0}</p>
              <p className="text-xs text-gray-500 mt-1">€{stats?.telecomunicacoes?.monthly_total?.toFixed(2) || '0.00'}/mês</p>
            </div>
            <div className="w-12 h-12 bg-cyan rounded-full flex items-center justify-center">
              <Phone className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Energia</p>
              <p className="text-2xl font-bold color-orange">{stats?.energia?.count || 0}</p>
              <div className="text-xs text-gray-500 mt-1">
                {stats?.energia?.electricity || 0} eletricidade, {stats?.energia?.gas || 0} gás
                <div className="text-xs text-gray-400 mt-0.5">(das quais {stats?.energia?.dual || 0} dual)</div>
              </div>
            </div>
            <div className="w-12 h-12 bg-orange rounded-full flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Solar</p>
              <p className="text-2xl font-bold color-green">{stats?.solar?.count || 0}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg">
              <Sun className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const renderD2DPartnerDashboard = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Minhas Vendas</p>
              <p className="text-3xl font-bold text-navy-900">{stats?.total_sales || 0}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-navy-900 to-navy-800 rounded-full flex items-center justify-center shadow-lg">
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Telecomunicações</p>
              <p className="text-2xl font-bold color-cyan">{stats?.telecomunicacoes?.count || 0}</p>
            </div>
            <div className="w-12 h-12 bg-cyan rounded-full flex items-center justify-center">
              <Phone className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Energia</p>
              <p className="text-2xl font-bold color-orange">{stats?.energia?.count || 0}</p>
            </div>
            <div className="w-12 h-12 bg-orange rounded-full flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Solar</p>
              <p className="text-2xl font-bold color-green">{stats?.solar?.count || 0}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg">
              <Sun className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {stats?.operator_stats && stats.operator_stats.length > 0 && (
        <div className="glass-ultra p-6">
          <h3 className="text-xl font-bold mb-6" style={{ color: '#000000' }}>Vendas por Operadora</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.operator_stats.map((operator) => (
              <div key={operator.id} className="stat-card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{operator.name}</p>
                    <p className="text-2xl font-bold text-navy-900">{operator.count}</p>
                    <p className="text-xs text-gray-500 mt-1">vendas</p>
                  </div>
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
                    <ShoppingCart className="w-5 h-5 text-white" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );

  const renderPartnerDashboard = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Minhas Vendas</p>
              <p className="text-3xl font-bold text-navy-900">{stats?.total_sales || 0}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-navy-900 to-navy-800 rounded-full flex items-center justify-center shadow-lg">
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Comissões Brutas</p>
              <p className="text-2xl font-bold color-purple">€{stats?.total_commission_gross?.toFixed(2) || '0.00'}</p>
              <p className="text-xs text-gray-500 mt-1">Antes de retenções</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
              <Award className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Comissões Líquidas</p>
              <p className="text-2xl font-bold color-green">€{stats?.total_commission?.toFixed(2) || '0.00'}</p>
              <p className="text-xs text-gray-500 mt-1">Após retenções</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg">
              <Award className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Pendentes</p>
              <p className="text-2xl font-bold color-orange">€{stats?.commission_pending?.toFixed(2) || '0.00'}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full flex items-center justify-center shadow-lg">
              <Award className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Pagas</p>
              <p className="text-2xl font-bold color-green">€{stats?.commission_paid?.toFixed(2) || '0.00'}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Retenções Mês Corrente</p>
              <p className="text-2xl font-bold color-blue">€{stats?.current_month_retentions?.toFixed(2) || '0.00'}</p>
              <p className="text-xs text-gray-500 mt-1">A reter das comissões</p>
            </div>
            <div className="w-12 h-12 bg-blue rounded-full flex items-center justify-center">
              <Award className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Retenções a Devolver</p>
              <p className="text-2xl font-bold color-green">€{stats?.retentions_to_return?.toFixed(2) || '0.00'}</p>
              <p className="text-xs text-gray-500 mt-1">Próximo auto (6 meses)</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Telecomunicações</p>
              <p className="text-2xl font-bold color-cyan">{stats?.telecomunicacoes?.count || 0}</p>
            </div>
            <div className="w-12 h-12 bg-cyan rounded-full flex items-center justify-center">
              <Phone className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Energia</p>
              <p className="text-2xl font-bold color-orange">{stats?.energia?.count || 0}</p>
            </div>
            <div className="w-12 h-12 bg-orange rounded-full flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Solar</p>
              <p className="text-2xl font-bold color-green">{stats?.solar?.count || 0}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg">
              <Sun className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Dual</p>
              <p className="text-2xl font-bold text-gray-700">{stats?.dual?.count || 0}</p>
            </div>
            <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const renderBODashboard = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Vendas</p>
              <p className="text-3xl font-bold text-navy-900">{stats?.total_sales || 0}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-navy-900 to-navy-800 rounded-full flex items-center justify-center shadow-lg">
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Telecomunicações</p>
              <p className="text-2xl font-bold color-cyan">{stats?.telecomunicacoes?.count || 0}</p>
            </div>
            <div className="w-12 h-12 bg-cyan rounded-full flex items-center justify-center">
              <Phone className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Energia</p>
              <p className="text-2xl font-bold color-orange">{stats?.energia?.count || 0}</p>
            </div>
            <div className="w-12 h-12 bg-orange rounded-full flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Solar</p>
              <p className="text-2xl font-bold color-green">{stats?.solar?.count || 0}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg">
              <Sun className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const renderCommercialDashboard = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Minhas Vendas</p>
              <p className="text-3xl font-bold text-navy-900">{stats?.total_sales || 0}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-navy-900 to-navy-800 rounded-full flex items-center justify-center shadow-lg">
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Telecomunicações</p>
              <p className="text-2xl font-bold color-cyan">{stats?.telecomunicacoes?.count || 0}</p>
            </div>
            <div className="w-12 h-12 bg-cyan rounded-full flex items-center justify-center">
              <Phone className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Energia</p>
              <p className="text-2xl font-bold color-orange">{stats?.energia?.count || 0}</p>
            </div>
            <div className="w-12 h-12 bg-orange rounded-full flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Solar</p>
              <p className="text-2xl font-bold color-green">{stats?.solar?.count || 0}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg">
              <Sun className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const renderManagerLevel1Dashboard = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Vendas</p>
              <p className="text-3xl font-bold text-navy-900">{stats?.total_sales || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Próprias e de parceiros</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-navy-900 to-navy-800 rounded-full flex items-center justify-center shadow-lg">
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Minhas Comissões Brutas</p>
              <p className="text-2xl font-bold color-purple">€{(stats?.own_commission_gross || 0).toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">Vendas próprias</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
              <Award className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Minhas Retenções</p>
              <p className="text-2xl font-bold color-blue">€{(stats?.own_retention || 0).toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">A reter temporariamente</p>
            </div>
            <div className="w-12 h-12 bg-blue rounded-full flex items-center justify-center">
              <Award className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Minhas Comissões Líquidas</p>
              <p className="text-2xl font-bold color-green">€{((stats?.own_commission_gross || 0) - (stats?.own_retention || 0)).toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">Após retenções</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg">
              <Award className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {stats?.objectives_progress && stats.objectives_progress.length > 0 && (
        <div className="glass-ultra p-6 mt-6">
          <h3 className="text-xl font-semibold mb-4">Cumprimento de Objetivos Mensais</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stats.objectives_progress.map((progress, idx) => {
              const objectives = [];

              if (progress.operator_scope === 'energia') {
                if (progress.targets.electricity > 0) {
                  objectives.push({
                    name: 'Eletricidade',
                    actual: progress.actual.electricity,
                    target: progress.targets.electricity,
                    remaining: Math.max(0, progress.targets.electricity - progress.actual.electricity),
                    percentage: progress.percentage.electricity,
                    color: '#2563eb'
                  });
                }
                if (progress.targets.gas > 0) {
                  objectives.push({
                    name: 'Gás',
                    actual: progress.actual.gas,
                    target: progress.targets.gas,
                    remaining: Math.max(0, progress.targets.gas - progress.actual.gas),
                    percentage: progress.percentage.gas,
                    color: '#ea580c'
                  });
                }
              }

              if (progress.operator_scope === 'telecomunicacoes') {
                if (progress.targets.tv > 0) {
                  objectives.push({
                    name: 'TV',
                    actual: progress.actual.tv,
                    target: progress.targets.tv,
                    remaining: Math.max(0, progress.targets.tv - progress.actual.tv),
                    percentage: progress.percentage.tv,
                    color: '#9333ea'
                  });
                }
                if (progress.targets.fiber > 0) {
                  objectives.push({
                    name: 'Fibra/NET',
                    actual: progress.actual.fiber,
                    target: progress.targets.fiber,
                    remaining: Math.max(0, progress.targets.fiber - progress.actual.fiber),
                    percentage: progress.percentage.fiber,
                    color: '#16a34a'
                  });
                }
              }

              return objectives.map((objective, objIdx) => (
                <div key={`${idx}-${objIdx}`} className="border rounded-lg p-4 flex flex-col items-center">
                  <h4 className="font-semibold text-navy-900 mb-2">{progress.operator_name}</h4>
                  <p className="text-sm text-gray-600 mb-4">{objective.name}</p>

                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Atingido', value: objective.actual },
                          { name: 'Restante', value: objective.remaining }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        dataKey="value"
                        startAngle={90}
                        endAngle={-270}
                      >
                        <Cell fill={objective.color} />
                        <Cell fill="#e5e7eb" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="text-center mt-4">
                    <p className="text-2xl font-bold" style={{ color: objective.color }}>
                      {objective.percentage.toFixed(0)}%
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {objective.actual} / {objective.target}
                    </p>
                  </div>
                </div>
              ));
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Telecomunicações</p>
              <p className="text-2xl font-bold color-cyan">{stats?.telecomunicacoes?.count || 0}</p>
              <p className="text-xs text-gray-500 mt-1">€{stats?.telecomunicacoes?.monthly_total?.toFixed(2) || '0.00'}/mês</p>
            </div>
            <div className="w-12 h-12 bg-cyan rounded-full flex items-center justify-center">
              <Phone className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Energia</p>
              <p className="text-2xl font-bold color-orange">{stats?.energia?.count || 0}</p>
              <div className="text-xs text-gray-500 mt-1">
                {stats?.energia?.electricity || 0} eletricidade, {stats?.energia?.gas || 0} gás
                <div className="text-xs text-gray-400 mt-0.5">(das quais {stats?.energia?.dual || 0} dual)</div>
              </div>
            </div>
            <div className="w-12 h-12 bg-orange rounded-full flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Solar</p>
              <p className="text-2xl font-bold color-green">{stats?.solar?.count || 0}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg">
              <Sun className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const renderProposalsDashboard = () => {
    if (!proposalStats) return null;

    const partnersList = Object.values(proposalStats.by_partner || {});

    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="stat-card cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleProposalCardClick('all')}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Propostas</p>
                <p className="text-3xl font-bold text-navy-900">{proposalStats.total_proposals || 0}</p>
                <p className="text-xs text-gray-500 mt-1">Em análise · Clique para ver</p>
              </div>
              <div className="w-12 h-12 bg-blue rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="stat-card cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleProposalCardClick('up_to_7')}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Até 7 Dias</p>
                <p className="text-3xl font-bold color-green">{proposalStats.by_age?.up_to_7 || 0}</p>
                <p className="text-xs text-gray-500 mt-1">Propostas recentes · Clique para ver</p>
              </div>
              <div className="w-12 h-12 bg-green rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="stat-card cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleProposalCardClick('from_7_to_14')}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">7 a 14 Dias</p>
                <p className="text-3xl font-bold color-orange">{proposalStats.by_age?.from_7_to_14 || 0}</p>
                <p className="text-xs text-gray-500 mt-1">Requer atenção · Clique para ver</p>
              </div>
              <div className="w-12 h-12 bg-orange rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="stat-card cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleProposalCardClick('over_14')}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Mais de 14 Dias</p>
                <p className="text-3xl font-bold text-red-600">{proposalStats.by_age?.over_14 || 0}</p>
                <p className="text-xs text-gray-500 mt-1">Urgente · Clique para ver</p>
              </div>
              <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </div>

        {proposalStats.total_commission !== undefined && (
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Comissões Pendentes em Propostas</p>
                <p className="text-3xl font-bold color-purple">€{proposalStats.total_commission?.toFixed(2) || '0.00'}</p>
                <p className="text-xs text-gray-500 mt-1">Aguardando conclusão</p>
              </div>
              <div className="w-12 h-12 bg-purple rounded-full flex items-center justify-center">
                <Award className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        )}

        {proposalStats.own_commission !== undefined && proposalStats.own_commission > 0 && (
          <div className="stat-card-gold">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-navy-900 mb-1">Minhas Comissões em Propostas</p>
                <p className="text-3xl font-bold text-gradient-navy">€{proposalStats.own_commission?.toFixed(2) || '0.00'}</p>
                <p className="text-xs text-navy-700 mt-1">Vendas próprias pendentes</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-r from-gold-400 to-gold-500 rounded-full flex items-center justify-center shadow-gold-glow">
                <Award className="w-6 h-6 text-navy-900" />
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Telecomunicações</p>
                <p className="text-2xl font-bold color-cyan">{proposalStats.by_scope?.telecomunicacoes || 0}</p>
              </div>
              <div className="w-12 h-12 bg-cyan rounded-full flex items-center justify-center">
                <Phone className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Energia</p>
                <p className="text-2xl font-bold color-orange">{proposalStats.by_scope?.energia || 0}</p>
              </div>
              <div className="w-12 h-12 bg-orange rounded-full flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Solar</p>
                <p className="text-2xl font-bold color-green">{proposalStats.by_scope?.solar || 0}</p>
              </div>
              <div className="w-12 h-12 bg-green rounded-full flex items-center justify-center">
                <Sun className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Dual</p>
                <p className="text-2xl font-bold text-gray-700">{proposalStats.by_scope?.dual || 0}</p>
              </div>
              <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </div>

        {partnersList.length > 0 && (
          <div className="glass-ultra p-6">
            <h3 className="text-lg font-semibold text-navy-900 mb-4">Parceiros com Propostas em Curso</h3>
            <div className="table-container">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Parceiro</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Propostas</th>
                    {proposalStats.total_commission !== undefined && (
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Comissões Pendentes</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {partnersList
                    .sort((a, b) => (b.commission || b.count) - (a.commission || a.count))
                    .map((partner, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-navy-900">{partner.name}</td>
                        <td className="text-center py-3 px-4 text-gray-600">{partner.count}</td>
                        {proposalStats.total_commission !== undefined && (
                          <td className="text-right py-3 px-4 font-bold color-purple">
                            €{partner.commission?.toFixed(2) || '0.00'}
                          </td>
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>
    );
  };

  // Prepare 12 months chart data
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

  return (
    <div className="space-y-6 p-6 animate-fade-in">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="animate-slide-up">
          <h1 className="text-3xl font-bold" style={{ color: '#000000' }}>Dashboard</h1>
          <p className="font-medium mt-1" style={{ color: '#7a7a7a' }}>Bem-vindo, {user?.name}</p>
        </div>

        {/* Month/Year Selector */}
        <div className="flex gap-3 items-center">
          <div>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="select-modern px-3 py-2"
            >
              {months.map((month, index) => (
                <option key={index} value={index + 1}>{month}</option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="select-modern px-3 py-2"
            >
              {getAvailableYears().map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {(user?.role === 'admin' || user?.role === 'gestor_nv1' || user?.role === 'partner') ? (
        <Tabs defaultValue="total" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="total">Vendas Totais</TabsTrigger>
            {user?.is_commissioned && <TabsTrigger value="own">Vendas Próprias</TabsTrigger>}
            <TabsTrigger value="proposals">Propostas em Curso</TabsTrigger>
          </TabsList>

          <TabsContent value="total" className="space-y-6">
            {user?.role === 'admin' && renderAdminDashboard()}
            {user?.role === 'gestor_nv1' && renderManagerLevel1Dashboard()}
            {user?.role === 'partner' && (['D2D_1', 'D2D_2', 'D2D_3'].includes(stats?.partner_type) ? renderD2DPartnerDashboard() : renderPartnerDashboard())}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {statusData.length > 0 && (
                <div className="glass-ultra p-6">
                  <h2 className="text-lg font-semibold text-navy-900 mb-4">Vendas por Estado</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={statusData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={100} dataKey="value">
                        {statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="glass-ultra p-6">
                <h2 className="text-lg font-semibold text-navy-900 mb-4">Vendas por Âmbito</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    { name: 'Telecom', value: stats?.telecomunicacoes?.count || 0 },
                    { name: 'Energia', value: stats?.energia?.count || 0 },
                    { name: 'Solar', value: stats?.solar?.count || 0 },
                    { name: 'Dual', value: stats?.dual?.count || 0 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="name" stroke="#6B7280" />
                    <YAxis stroke="#6B7280" />
                    <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #E5E7EB' }} />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                      {[0, 1, 2, 3].map((index) => <Cell key={`cell-${index}`} fill={COLORS[index]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {partnerStats.length > 0 && operators.length > 0 && (
              <div className="glass-ultra p-6">
                <h3 className="text-lg font-semibold text-navy-900 mb-4">Vendas por Parceiro - {months[new Date().getMonth()]} {new Date().getFullYear()}</h3>
                <div className="table-container">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Parceiro</th>
                        {operators.map((op) => (
                          <th key={op.id} className="text-center py-3 px-2 font-semibold text-gray-700">{op.name}</th>
                        ))}
                        <th className="text-right py-3 px-4 font-semibold text-gray-700">Total Comissões</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partnerStats.map((partner, index) => (
                        <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium text-navy-900">{partner.name}</td>
                          {operators.map((op) => (
                            <td key={op.id} className="text-center py-3 px-2 text-gray-600">
                              {partner.operators[op.name] || '-'}
                            </td>
                          ))}
                          <td className="text-right py-3 px-4 font-bold text-blue-600">€{partner.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {stats?.last_12_months && stats.last_12_months.length > 0 && (
              <div className="glass-ultra p-6">
                <h3 className="text-lg font-semibold text-navy-900 mb-4">Evolução dos Últimos 12 Meses</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={prepare12MonthsData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Telecom" fill="#06b6d4" name="Telecomunicações" />
                    <Bar dataKey="Energia" fill="#f97316" name="Energia" />
                    <Bar dataKey="Solar" fill="#22c55e" name="Solar" />
                    <Bar dataKey="Dual" fill="#6b7280" name="Dual" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </TabsContent>

          {user?.is_commissioned && (
            <TabsContent value="own" className="space-y-6">
              {user?.role === 'admin' && stats && (
                <>
                  <div className="stat-card-gold">
                    <h3 className="text-lg font-semibold text-navy-900 mb-3">Minhas Comissões</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                      <div className="glass-ultra p-4">
                        <p className="text-sm text-gray-600 mb-1">Comissões Brutas</p>
                        <p className="text-2xl font-bold text-purple-600">€{((stats?.admin_commission_pending || 0) + (stats?.admin_commission_paid || 0)).toFixed(2)}</p>
                        <p className="text-xs text-gray-500 mt-1">Total antes retenções</p>
                      </div>
                      <div className="glass-ultra p-4">
                        <p className="text-sm text-gray-600 mb-1">Retenções</p>
                        <p className="text-2xl font-bold text-navy-600">€{(stats?.admin_retention || 0).toFixed(2)}</p>
                        <p className="text-xs text-gray-500 mt-1">Valor retido</p>
                      </div>
                      <div className="glass-ultra p-4">
                        <p className="text-sm text-gray-600 mb-1">Comissões Líquidas</p>
                        <p className="text-2xl font-bold text-green-600">€{(((stats?.admin_commission_pending || 0) + (stats?.admin_commission_paid || 0)) - (stats?.admin_retention || 0)).toFixed(2)}</p>
                        <p className="text-xs text-gray-500 mt-1">Após retenções</p>
                      </div>
                      <div className="glass-ultra p-4">
                        <p className="text-sm text-gray-600 mb-1">A Receber</p>
                        <p className="text-2xl font-bold text-navy-900">€{((stats?.admin_commission_paid || 0) - (stats?.admin_retention || 0) * ((stats?.admin_commission_paid || 0) / ((stats?.admin_commission_pending || 0) + (stats?.admin_commission_paid || 0) || 1))).toFixed(2)}</p>
                        <p className="text-xs text-gray-500 mt-1">Vendas pagas pela operadora</p>
                      </div>
                      <div className="glass-ultra p-4">
                        <p className="text-sm text-gray-600 mb-1">Minhas Vendas</p>
                        <p className="text-2xl font-bold text-navy-900">{stats?.admin_sales_count || 0}</p>
                        <p className="text-xs text-gray-500 mt-1">Registadas como admin</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>
          )}

          <TabsContent value="proposals" className="space-y-6">
            {renderProposalsDashboard()}
          </TabsContent>
        </Tabs>
      ) : (
        <>
          {user?.role === 'bo' && renderBODashboard()}
          {user?.role === 'partner_commercial' && renderCommercialDashboard()}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {statusData.length > 0 && (
              <div className="glass-ultra p-6">
                <h2 className="text-lg font-semibold text-navy-900 mb-4">Vendas por Estado</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={100} dataKey="value">
                      {statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="glass-ultra p-6">
              <h2 className="text-lg font-semibold text-navy-900 mb-4">Vendas por Âmbito</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={[
                  { name: 'Telecom', value: stats?.telecomunicacoes?.count || 0 },
                  { name: 'Energia', value: stats?.energia?.count || 0 },
                  { name: 'Solar', value: stats?.solar?.count || 0 },
                  { name: 'Dual', value: stats?.dual?.count || 0 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="name" stroke="#6B7280" />
                  <YAxis stroke="#6B7280" />
                  <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #E5E7EB' }} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {[0, 1, 2, 3].map((index) => <Cell key={`cell-${index}`} fill={COLORS[index]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {stats?.last_12_months && stats.last_12_months.length > 0 && (
            <div className="glass-ultra p-6">
              <h3 className="text-lg font-semibold text-navy-900 mb-4">Evolução dos Últimos 12 Meses</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={prepare12MonthsData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Telecom" fill="#06b6d4" name="Telecomunicações" />
                  <Bar dataKey="Energia" fill="#f97316" name="Energia" />
                  <Bar dataKey="Solar" fill="#22c55e" name="Solar" />
                  <Bar dataKey="Dual" fill="#6b7280" name="Dual" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* Proposals List Dialog */}
      <Dialog open={proposalDialogOpen} onOpenChange={setProposalDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Propostas - {proposalFilter === 'all' ? 'Todas' : proposalFilter === 'up_to_7' ? 'Até 7 Dias' : proposalFilter === 'from_7_to_14' ? '7 a 14 Dias' : 'Mais de 14 Dias'}
            </DialogTitle>
            <DialogDescription>
              {filteredProposals.length} proposta(s) encontrada(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {filteredProposals.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Nenhuma proposta encontrada</p>
            ) : (
              filteredProposals.map((proposal) => {
                const daysElapsed = Math.floor((new Date() - new Date(proposal.created_at)) / (1000 * 60 * 60 * 24));
                return (
                  <div key={proposal.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-bold text-navy-900">{proposal.sale_code}</span>
                          <Badge variant={daysElapsed <= 7 ? 'default' : daysElapsed <= 14 ? 'warning' : 'destructive'}>
                            {daysElapsed} dias
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-500">Cliente: </span>
                            <span className="font-semibold">{proposal.client_name}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Parceiro: </span>
                            <span className="font-semibold">{proposal.partners?.name || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Operadora: </span>
                            <span className="font-semibold">{proposal.operators?.name || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Data: </span>
                            <span className="font-semibold">{new Date(proposal.date).toLocaleDateString('pt-PT')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedSaleId(proposal.id);
                            setDetailDialogOpen(true);
                          }}
                          className="btn-primary"
                        >
                          Ver Detalhes
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Sale Detail Dialog */}
      <SaleDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        saleId={selectedSaleId}
        user={user}
        onSaleUpdated={() => {
          fetchStats();
          fetchProposalStats();
          if (proposalFilter) {
            handleProposalCardClick(proposalFilter);
          }
        }}
      />
    </div>
  );
};

export default Dashboard;
