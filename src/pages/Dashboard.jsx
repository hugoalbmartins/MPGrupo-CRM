import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { ShoppingCart, Phone, Zap, Sun, Award, CheckCircle, Clock, TrendingUp } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dashboardService } from "../services/dashboardService";
import { salesService } from "../services/salesService";
import { partnersService } from "../services/partnersService";
import { operatorsService } from "../services/operatorsService";

const Dashboard = ({ user }) => {
  const [stats, setStats] = useState(null);
  const [proposalStats, setProposalStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [partnerStats, setPartnerStats] = useState([]);
  const [operators, setOperators] = useState([]);

  useEffect(() => {
    fetchStats();
    fetchPartnerStats();
    fetchProposalStats();
  }, [selectedYear, selectedMonth]);

  const fetchStats = async () => {
    try {
      const data = await dashboardService.getStats(selectedYear, selectedMonth);
      setStats(data);
    } catch (error) {
      toast.error("Erro ao carregar estatísticas");
    } finally {
      setLoading(false);
    }
  };

  const fetchProposalStats = async () => {
    try {
      const data = await dashboardService.getProposalStats();
      setProposalStats(data);
    } catch (error) {
      console.error("Erro ao carregar estatísticas de propostas:", error);
    }
  };

  const fetchPartnerStats = async () => {
    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      const [sales, partners, allOperators] = await Promise.all([
        salesService.getAll(),
        partnersService.getAll(),
        operatorsService.getAll()
      ]);

      setOperators(allOperators.filter(op => !op.hidden));

      const currentMonthSales = sales.filter(sale => {
        const saleDate = new Date(sale.date);
        return saleDate.getMonth() + 1 === currentMonth && saleDate.getFullYear() === currentYear;
      });

      const partnerMap = {};

      currentMonthSales.forEach(sale => {
        const partnerId = sale.partner_id || 'admin_commissioned';

        if (!partnerMap[partnerId]) {
          let partnerName = 'Desconhecido';

          if (partnerId === 'admin_commissioned') {
            partnerName = user?.name ? `${user.name} (Admin)` : 'Admin Comissionado';
          } else {
            const partner = partners.find(p => p.id === partnerId);
            partnerName = partner?.name || 'Desconhecido';
          }

          partnerMap[partnerId] = {
            name: partnerName,
            operators: {},
            total: 0
          };
        }

        const commission = parseFloat(sale.manual_commission || sale.calculated_commission || 0);
        const operatorName = sale.operator_name || 'Desconhecido';

        if (!partnerMap[partnerId].operators[operatorName]) {
          partnerMap[partnerId].operators[operatorName] = 0;
        }

        partnerMap[partnerId].operators[operatorName]++;
        partnerMap[partnerId].total += commission;
      });

      const sortedStats = Object.values(partnerMap)
        .filter(p => p.total > 0)
        .sort((a, b) => b.total - a.total);

      setPartnerStats(sortedStats);
    } catch (error) {
      console.error("Erro ao carregar estatísticas de parceiros:", error);
    }
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

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>;
  }

  const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4'];
  const statusData = Object.entries(stats?.by_status || {}).map(([name, value]) => ({ name, value }));

  // Render different dashboards based on role
  const renderAdminDashboard = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Vendas</p>
              <p className="text-3xl font-bold text-gray-900">{stats?.total_sales || 0}</p>
              <p className="text-xs text-gray-500 mt-1">{stats?.total_partners || 0} parceiros</p>
            </div>
            <div className="w-12 h-12 bg-blue rounded-full flex items-center justify-center">
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
            <div className="w-12 h-12 bg-purple rounded-full flex items-center justify-center">
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
            <div className="w-12 h-12 bg-green rounded-full flex items-center justify-center">
              <Award className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">A Pagar</p>
              <p className="text-2xl font-bold color-orange">€{stats?.commission_to_pay?.toFixed(2) || '0.00'}</p>
              <p className="text-xs text-gray-500 mt-1">{stats?.unpaid_by_operator || 0} vendas</p>
            </div>
            <div className="w-12 h-12 bg-orange rounded-full flex items-center justify-center">
              <Award className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Pagas Operador</p>
              <p className="text-2xl font-bold color-green">{stats?.paid_by_operator || 0}</p>
            </div>
            <div className="w-12 h-12 bg-green rounded-full flex items-center justify-center">
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
            <div className="w-12 h-12 bg-green rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-white" />
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
            <div className="w-12 h-12 bg-green rounded-full flex items-center justify-center">
              <Sun className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const renderPartnerDashboard = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Minhas Vendas</p>
              <p className="text-3xl font-bold text-gray-900">{stats?.total_sales || 0}</p>
            </div>
            <div className="w-12 h-12 bg-blue rounded-full flex items-center justify-center">
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
            <div className="w-12 h-12 bg-purple rounded-full flex items-center justify-center">
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
            <div className="w-12 h-12 bg-green rounded-full flex items-center justify-center">
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
            <div className="w-12 h-12 bg-orange rounded-full flex items-center justify-center">
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
            <div className="w-12 h-12 bg-green rounded-full flex items-center justify-center">
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
            <div className="w-12 h-12 bg-green rounded-full flex items-center justify-center">
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
            <div className="w-12 h-12 bg-green rounded-full flex items-center justify-center">
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
              <p className="text-3xl font-bold text-gray-900">{stats?.total_sales || 0}</p>
            </div>
            <div className="w-12 h-12 bg-blue rounded-full flex items-center justify-center">
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
            <div className="w-12 h-12 bg-green rounded-full flex items-center justify-center">
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
              <p className="text-3xl font-bold text-gray-900">{stats?.total_sales || 0}</p>
            </div>
            <div className="w-12 h-12 bg-blue rounded-full flex items-center justify-center">
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
            <div className="w-12 h-12 bg-green rounded-full flex items-center justify-center">
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
              <p className="text-3xl font-bold text-gray-900">{stats?.total_sales || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Próprias e de parceiros</p>
            </div>
            <div className="w-12 h-12 bg-blue rounded-full flex items-center justify-center">
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
            <div className="w-12 h-12 bg-purple rounded-full flex items-center justify-center">
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
            <div className="w-12 h-12 bg-green rounded-full flex items-center justify-center">
              <Award className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {stats?.objectives_progress && stats.objectives_progress.length > 0 && (
        <div className="professional-card p-6 mt-6">
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
                  <h4 className="font-semibold text-gray-900 mb-2">{progress.operator_name}</h4>
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
            <div className="w-12 h-12 bg-green rounded-full flex items-center justify-center">
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
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Propostas</p>
                <p className="text-3xl font-bold text-gray-900">{proposalStats.total_proposals || 0}</p>
                <p className="text-xs text-gray-500 mt-1">Em análise</p>
              </div>
              <div className="w-12 h-12 bg-blue rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Até 7 Dias</p>
                <p className="text-3xl font-bold color-green">{proposalStats.by_age?.up_to_7 || 0}</p>
                <p className="text-xs text-gray-500 mt-1">Propostas recentes</p>
              </div>
              <div className="w-12 h-12 bg-green rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">7 a 14 Dias</p>
                <p className="text-3xl font-bold color-orange">{proposalStats.by_age?.from_7_to_14 || 0}</p>
                <p className="text-xs text-gray-500 mt-1">Requer atenção</p>
              </div>
              <div className="w-12 h-12 bg-orange rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Mais de 14 Dias</p>
                <p className="text-3xl font-bold text-red-600">{proposalStats.by_age?.over_14 || 0}</p>
                <p className="text-xs text-gray-500 mt-1">Urgente</p>
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
          <div className="stat-card bg-blue-50 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-900 mb-1">Minhas Comissões em Propostas</p>
                <p className="text-3xl font-bold text-blue-600">€{proposalStats.own_commission?.toFixed(2) || '0.00'}</p>
                <p className="text-xs text-blue-700 mt-1">Vendas próprias pendentes</p>
              </div>
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                <Award className="w-6 h-6 text-white" />
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
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Parceiros com Propostas em Curso</h3>
            <div className="overflow-x-auto">
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
                        <td className="py-3 px-4 font-medium text-gray-900">{partner.name}</td>
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Bem-vindo, {user?.name}</p>
        </div>

        {/* Month/Year Selector */}
        <div className="flex gap-3 items-center">
          <div>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            {user?.role === 'partner' && renderPartnerDashboard()}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {statusData.length > 0 && (
                <div className="professional-card p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Vendas por Estado</h2>
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

              <div className="professional-card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Vendas por Âmbito</h2>
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
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Vendas por Parceiro - {months[new Date().getMonth()]} {new Date().getFullYear()}</h3>
                <div className="overflow-x-auto">
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
                          <td className="py-3 px-4 font-medium text-gray-900">{partner.name}</td>
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
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Evolução dos Últimos 12 Meses</h3>
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
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h3 className="text-lg font-semibold text-blue-900 mb-3">Minhas Comissões</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <p className="text-sm text-gray-600 mb-1">Comissões Brutas</p>
                        <p className="text-2xl font-bold color-purple">€{((stats?.admin_commission_pending || 0) + (stats?.admin_commission_paid || 0)).toFixed(2)}</p>
                        <p className="text-xs text-gray-500 mt-1">Total antes retenções</p>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <p className="text-sm text-gray-600 mb-1">Retenções</p>
                        <p className="text-2xl font-bold color-blue">€{(stats?.admin_retention || 0).toFixed(2)}</p>
                        <p className="text-xs text-gray-500 mt-1">Valor retido</p>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <p className="text-sm text-gray-600 mb-1">Comissões Líquidas</p>
                        <p className="text-2xl font-bold color-green">€{(((stats?.admin_commission_pending || 0) + (stats?.admin_commission_paid || 0)) - (stats?.admin_retention || 0)).toFixed(2)}</p>
                        <p className="text-xs text-gray-500 mt-1">Após retenções</p>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <p className="text-sm text-gray-600 mb-1">A Receber</p>
                        <p className="text-2xl font-bold text-gray-900">€{((stats?.admin_commission_paid || 0) - (stats?.admin_retention || 0) * ((stats?.admin_commission_paid || 0) / ((stats?.admin_commission_pending || 0) + (stats?.admin_commission_paid || 0) || 1))).toFixed(2)}</p>
                        <p className="text-xs text-gray-500 mt-1">Vendas pagas pela operadora</p>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <p className="text-sm text-gray-600 mb-1">Minhas Vendas</p>
                        <p className="text-2xl font-bold text-gray-900">{stats?.admin_sales_count || 0}</p>
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
              <div className="professional-card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Vendas por Estado</h2>
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

            <div className="professional-card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Vendas por Âmbito</h2>
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
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Evolução dos Últimos 12 Meses</h3>
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
    </div>
  );
};

export default Dashboard;
