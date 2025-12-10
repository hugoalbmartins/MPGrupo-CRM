import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { ShoppingCart, Phone, Zap, Sun, Award, CheckCircle } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { dashboardService } from "../services/dashboardService";

const Dashboard = ({ user }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    fetchStats();
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
              <p className="text-sm text-gray-600 mb-1">Comissões Totais</p>
              <p className="text-2xl font-bold color-purple">€{stats?.total_commission?.toFixed(2) || '0.00'}</p>
            </div>
            <div className="w-12 h-12 bg-purple rounded-full flex items-center justify-center">
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
              <p className="text-sm text-gray-600 mb-1">Comissões Totais</p>
              <p className="text-2xl font-bold color-purple">€{stats?.total_commission?.toFixed(2) || '0.00'}</p>
            </div>
            <div className="w-12 h-12 bg-purple rounded-full flex items-center justify-center">
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

      {user?.role === 'admin' && renderAdminDashboard()}
      {user?.role === 'bo' && renderBODashboard()}
      {user?.role === 'partner' && renderPartnerDashboard()}
      {user?.role === 'partner_commercial' && renderCommercialDashboard()}

      {/* 12 Months Bar Chart */}
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
    </div>
  );
};

export default Dashboard;
