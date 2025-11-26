import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { ShoppingCart, Phone, Zap, Sun, Award, CheckCircle } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { API } from "../App";

const Dashboard = ({ user }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/stats`);
      setStats(response.data);
    } catch (error) {
      toast.error("Erro ao carregar estatísticas");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>;
  }

  const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4'];
  const statusData = Object.entries(stats?.by_status || {}).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Bem-vindo, {user?.name}</p>
      </div>

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
              <p className="text-xs text-gray-500 mt-1">€{stats?.telecomunicacoes?.monthly_total?.toFixed(2) || '0.00'}</p>
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

      {user?.role !== 'partner_commercial' && stats?.total_commission !== undefined && user?.role !== 'bo' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Comissões Totais</p>
                <p className="text-3xl font-bold color-purple">€{stats.total_commission?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="w-12 h-12 bg-purple rounded-full flex items-center justify-center">
                <Award className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
          {user?.role === 'admin' && (
            <div className="stat-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Pagas Operador</p>
                  <p className="text-3xl font-bold color-green">{stats?.paid_by_operator || 0}</p>
                </div>
                <div className="w-12 h-12 bg-green rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          )}
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
