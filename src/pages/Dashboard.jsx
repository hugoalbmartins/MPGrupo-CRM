import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { ShoppingCart, Phone, Zap, Sun, Award, CheckCircle } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { dashboardService } from "../services/dashboardService";
import { salesService } from "../services/salesService";
import { partnersService } from "../services/partnersService";

const Dashboard = ({ user }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [partnerStats, setPartnerStats] = useState([]);

  useEffect(() => {
    fetchStats();
    fetchPartnerStats();
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

  const fetchPartnerStats = async () => {
    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      const [sales, partners] = await Promise.all([
        salesService.getAll(),
        partnersService.getAll()
      ]);

      const currentMonthSales = sales.filter(sale => {
        const saleDate = new Date(sale.date);
        return saleDate.getMonth() + 1 === currentMonth && saleDate.getFullYear() === currentYear;
      });

      const partnerMap = {};

      currentMonthSales.forEach(sale => {
        if (!partnerMap[sale.partner_id]) {
          const partner = partners.find(p => p.id === sale.partner_id);
          partnerMap[sale.partner_id] = {
            name: partner?.name || 'Desconhecido',
            telecom: { nos: 0, meo: 0, vodafone: 0 },
            energy: { galp: 0, edp: 0, endesa: 0, goldenergy: 0 },
            solar: 0,
            total: 0
          };
        }

        const commission = parseFloat(sale.manual_commission || sale.calculated_commission || 0);
        const ddValue = sale.has_direct_debit ? parseFloat(sale.direct_debit_value || 0) : 0;
        const feValue = sale.has_electronic_invoice ? parseFloat(sale.electronic_invoice_value || 0) : 0;
        const totalComm = commission + ddValue + feValue;

        const scope = (sale.scope || '').toLowerCase();
        const operator = (sale.operator?.name || '').toLowerCase();

        if (scope === 'telecomunicações' || scope === 'telecom') {
          if (operator.includes('nos')) partnerMap[sale.partner_id].telecom.nos++;
          else if (operator.includes('meo')) partnerMap[sale.partner_id].telecom.meo++;
          else if (operator.includes('vodafone')) partnerMap[sale.partner_id].telecom.vodafone++;
        } else if (scope === 'energia') {
          if (operator.includes('galp')) partnerMap[sale.partner_id].energy.galp++;
          else if (operator.includes('edp')) partnerMap[sale.partner_id].energy.edp++;
          else if (operator.includes('endesa')) partnerMap[sale.partner_id].energy.endesa++;
          else if (operator.includes('golden')) partnerMap[sale.partner_id].energy.goldenergy++;
        } else if (scope === 'solar') {
          partnerMap[sale.partner_id].solar++;
        }

        partnerMap[sale.partner_id].total += totalComm;
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

      {/* Partners Stats for Current Month */}
      {partnerStats.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Vendas por Parceiro - {months[new Date().getMonth()]} {new Date().getFullYear()}</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Parceiro</th>
                  <th className="text-center py-3 px-2 font-semibold text-gray-700">NOS</th>
                  <th className="text-center py-3 px-2 font-semibold text-gray-700">MEO</th>
                  <th className="text-center py-3 px-2 font-semibold text-gray-700">Vodafone</th>
                  <th className="text-center py-3 px-2 font-semibold text-gray-700">Galp</th>
                  <th className="text-center py-3 px-2 font-semibold text-gray-700">EDP</th>
                  <th className="text-center py-3 px-2 font-semibold text-gray-700">Endesa</th>
                  <th className="text-center py-3 px-2 font-semibold text-gray-700">Goldenergy</th>
                  <th className="text-center py-3 px-2 font-semibold text-gray-700">Solar</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Total Comissões</th>
                </tr>
              </thead>
              <tbody>
                {partnerStats.map((partner, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{partner.name}</td>
                    <td className="text-center py-3 px-2 text-gray-600">{partner.telecom.nos || '-'}</td>
                    <td className="text-center py-3 px-2 text-gray-600">{partner.telecom.meo || '-'}</td>
                    <td className="text-center py-3 px-2 text-gray-600">{partner.telecom.vodafone || '-'}</td>
                    <td className="text-center py-3 px-2 text-gray-600">{partner.energy.galp || '-'}</td>
                    <td className="text-center py-3 px-2 text-gray-600">{partner.energy.edp || '-'}</td>
                    <td className="text-center py-3 px-2 text-gray-600">{partner.energy.endesa || '-'}</td>
                    <td className="text-center py-3 px-2 text-gray-600">{partner.energy.goldenergy || '-'}</td>
                    <td className="text-center py-3 px-2 text-gray-600">{partner.solar || '-'}</td>
                    <td className="text-right py-3 px-4 font-bold text-blue-600">€{partner.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
    </div>
  );
};

export default Dashboard;
