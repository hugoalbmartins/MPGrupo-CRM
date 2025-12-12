import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, ShoppingCart, Building2, Settings, LogOut, Menu, X, Bell, FileText, FileSpreadsheet } from "lucide-react";
import { supabase } from "../lib/supabase";
import { alertsService } from "../services/alertsService";

const Layout = ({ children, user, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 30000);

      const unsubscribe = alertsService.subscribeToAlerts(() => {
        fetchUnreadCount();
      });

      return () => {
        clearInterval(interval);
        if (unsubscribe) unsubscribe();
      };
    }
  }, [user]);

  const fetchUnreadCount = async () => {
    try {
      const count = await alertsService.getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  const menuItems = [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "bo", "partner", "partner_commercial"] },
    { path: "/partners", label: "Parceiros", icon: Users, roles: ["admin", "bo", "partner"] },
    { path: "/sales", label: "Vendas", icon: ShoppingCart, roles: ["admin", "bo", "partner", "partner_commercial"] },
    { path: "/forms", label: "Formulários", icon: FileText, roles: ["admin", "bo", "partner", "partner_commercial"] },
    { path: "/alerts", label: "Alertas", icon: Bell, roles: ["admin", "bo", "partner", "partner_commercial"], badge: unreadCount },
  ];

  if (user?.role === "admin") {
    menuItems.push(
      { path: "/operators", label: "Operadoras", icon: Building2, roles: ["admin"] },
      { path: "/users", label: "Utilizadores", icon: Settings, roles: ["admin"] },
      { path: "/commission-reports", label: "Autos de Comissões", icon: FileSpreadsheet, roles: ["admin"] }
    );
  } else if (user?.role === "bo") {
    menuItems.push(
      { path: "/operators", label: "Operadoras", icon: Building2, roles: ["bo"] }
    );
  }

  const filteredMenuItems = menuItems.filter(item => item.roles.includes(user?.role));

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)' }}>
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex md:flex-col w-72 bg-white shadow-xl" style={{ borderRight: '1px solid #E2E8F0' }}>
        {/* Logo */}
        <div className="relative p-6 pb-8" style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden">
              <img src="/mp_grupo.jpg" alt="MP Grupo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight" style={{ color: '#FFFFFF' }}>MP GRUPO</h1>
              <p className="text-xs font-medium" style={{ color: '#FFFFFF' }}>Sales CRM</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                data-testid={`nav-${item.label.toLowerCase()}`}
                className={`group flex items-center px-4 py-3.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "text-white font-semibold shadow-lg"
                    : "text-gray-700 hover:bg-gray-50 font-medium"
                }`}
                style={isActive ? {
                  background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                } : {}}
              >
                <Icon className={`w-5 h-5 mr-3 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                <span className="text-sm">{item.label}</span>
                {item.badge > 0 && (
                  <span className="ml-auto text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold" style={{
                    background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
                  }}>
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
                {isActive && !item.badge && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white"></div>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-100 p-4 bg-gradient-to-b from-white to-gray-50">
          <Link to="/profile" className="block px-4 py-3 mb-2 rounded-xl hover:bg-white transition-all border border-transparent hover:border-gray-200">
            <p className="text-xs text-gray-500 font-medium mb-1">Conectado como</p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{
                background: 'linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)'
              }}>
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 truncate">{user?.position}</p>
              </div>
            </div>
          </Link>
          <button
            onClick={onLogout}
            data-testid="logout-button"
            className="flex items-center w-full px-4 py-3 rounded-xl text-gray-600 hover:bg-red-50 hover:text-red-600 transition-all group font-medium"
          >
            <LogOut className="w-5 h-5 mr-3 group-hover:transform group-hover:translate-x-1 transition-transform" />
            <span className="text-sm">Sair</span>
          </button>
        </div>
      </aside>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg"
        data-testid="mobile-menu-button"
      >
        {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Sidebar Mobile */}
      {sidebarOpen && (
        <aside className="md:hidden fixed inset-0 z-40 flex flex-col bg-white">
          <div className="flex items-center p-6 border-b border-gray-200 mt-16">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden">
              <img src="/mp_grupo.jpg" alt="MP Grupo" className="w-full h-full object-cover" />
            </div>
            <div className="ml-3">
              <h1 className="text-lg font-bold text-gray-900">MP GRUPO</h1>
              <p className="text-xs text-gray-500">CRM</p>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {filteredMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? "bg-blue-50 text-blue-600 font-semibold"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.label}
                  {item.badge > 0 && (
                    <span className="ml-auto text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold" style={{
                      background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
                    }}>
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-gray-200 p-4">
            <div className="px-4 py-2 mb-2">
              <p className="text-xs text-gray-500">Conectado como</p>
              <p className="font-semibold text-gray-900 text-sm">{user?.name}</p>
              <p className="text-xs text-gray-500">{user?.position}</p>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center w-full px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-50 transition-all"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Sair
            </button>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header with Alerts */}
        <div className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="hidden lg:block">
              <h2 className="text-sm font-semibold text-gray-900">
                {filteredMenuItems.find(item => item.path === location.pathname)?.label || 'Dashboard'}
              </h2>
              <p className="text-xs text-gray-500">
                {new Date().toLocaleDateString('pt-PT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Alerts Bell */}
            <button
              onClick={() => navigate('/alerts')}
              className="relative p-2.5 hover:bg-gray-100 rounded-xl transition-all group"
              title="Alertas"
            >
              <Bell className="w-5 h-5 text-gray-600 group-hover:text-blue-600 transition-colors" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shadow-lg animate-pulse" style={{
                  background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* User Profile */}
            <Link to="/profile" className="flex items-center gap-2 hover:bg-gray-100 px-3 py-2 rounded-xl transition-all">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-md" style={{
                background: 'linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)'
              }}>
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500">{user?.role === 'admin' ? 'Administrador' : user?.role === 'bo' ? 'Back Office' : 'Parceiro'}</p>
              </div>
            </Link>
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-6">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
