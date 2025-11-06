import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { TrendingUp, DollarSign, ShoppingCart, Award } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
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
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#C9A961]"></div>
      </div>
    );
  }

  const COLORS = ['#C9A961', '#B8944E', '#A67C3A', '#8B6F47', '#6B5535'];

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      <div>
        <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
        <p className="text-gray-400">Bem-vindo, {user?.name}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="stat-card" data-testid="total-sales-stat">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Total de Vendas</p>
              <p className="text-3xl font-bold gold-text">{stats?.total_sales || 0}</p>
            </div>
            <div className="p-3 rounded-lg bg-[#C9A961]/20">
              <ShoppingCart className="w-6 h-6 text-[#C9A961]" />
            </div>
          </div>
        </div>

        <div className="stat-card" data-testid="total-value-stat">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Valor Total</p>
              <p className="text-3xl font-bold gold-text">€{stats?.total_value?.toFixed(2) || '0.00'}</p>
            </div>
            <div className="p-3 rounded-lg bg-[#C9A961]/20">
              <DollarSign className="w-6 h-6 text-[#C9A961]" />
            </div>
          </div>
        </div>

        {user?.role !== 'bo' && (
          <div className="stat-card" data-testid="total-commission-stat">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm mb-1">Comissões</p>
                <p className="text-3xl font-bold gold-text">€{stats?.total_commission?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="p-3 rounded-lg bg-[#C9A961]/20">
                <Award className="w-6 h-6 text-[#C9A961]" />
              </div>
            </div>
          </div>
        )}

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Crescimento</p>
              <p className="text-3xl font-bold text-green-500">+12%</p>
            </div>
            <div className="p-3 rounded-lg bg-green-500/20">
              <TrendingUp className="w-6 h-6 text-green-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales by Operator - Bar Chart */}
        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold mb-4">Vendas por Operadora</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats?.sales_by_operator || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="name" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a1c', border: '1px solid #C9A961' }}
                labelStyle={{ color: '#C9A961' }}
              />
              <Bar dataKey="count" fill="#C9A961" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Sales by Status - Pie Chart */}
        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold mb-4">Vendas por Status</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stats?.sales_by_status || []}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="count"
              >
                {(stats?.sales_by_status || []).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a1c', border: '1px solid #C9A961' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sales Timeline */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-semibold mb-4">Evolução de Vendas</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={stats?.sales_timeline || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="month" stroke="#888" />
            <YAxis stroke="#888" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1a1a1c', border: '1px solid #C9A961' }}
              labelStyle={{ color: '#C9A961' }}
            />
            <Legend />
            <Line type="monotone" dataKey="count" stroke="#C9A961" strokeWidth={2} name="Vendas" />
            <Line type="monotone" dataKey="value" stroke="#B8944E" strokeWidth={2} name="Valor (€)" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Dashboard;
