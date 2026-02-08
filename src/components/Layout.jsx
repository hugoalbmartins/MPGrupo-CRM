import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, ShoppingCart, Building2, Settings, LogOut, Menu, X, Bell,
  FileText, FileSpreadsheet, CheckSquare, User, Target, Globe, ChevronLeft, Zap, SlidersHorizontal
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";
import { alertsService } from "../services/alertsService";

const Layout = ({ children, user, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [partnerType, setPartnerType] = useState(null);

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 30000);
      const unsubscribe = alertsService.subscribeToAlerts(() => fetchUnreadCount());
      if (user.role === 'partner') fetchPartnerType();
      return () => {
        clearInterval(interval);
        if (unsubscribe) unsubscribe();
      };
    }
  }, [user]);

  const fetchPartnerType = async () => {
    try {
      const { data } = await supabase
        .from('partners')
        .select('partner_type')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) setPartnerType(data.partner_type);
    } catch (error) {
      console.error('Failed to fetch partner type:', error);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const count = await alertsService.getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  const isD2DPartner = user?.role === 'partner' && partnerType === 'D2D';

  const menuItems = [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "bo", "partner", "partner_commercial", "gestor_nv1"], section: "MENU PRINCIPAL" },
    { path: "/partners", label: "Parceiros", icon: Users, roles: ["admin", "bo", "gestor_nv1"], section: "MENU PRINCIPAL" },
    { path: "/sales", label: "Vendas", icon: ShoppingCart, roles: ["admin", "bo", "partner", "partner_commercial", "gestor_nv1"], section: "MENU PRINCIPAL" },
    { path: "/forms", label: "Formularios", icon: FileText, roles: ["admin", "bo", "partner", "partner_commercial", "gestor_nv1"], section: "MENU PRINCIPAL" },
    { path: "/alerts", label: "Alertas", icon: Bell, roles: ["admin", "bo", "partner", "partner_commercial", "gestor_nv1"], badge: unreadCount, excludeD2D: true, section: "MENU PRINCIPAL" },
    { path: "/simulador", label: "Simulador", icon: Zap, roles: ["admin", "bo", "partner", "partner_commercial", "gestor_nv1"], section: "MENU PRINCIPAL" },
    { path: "/simulador-energia", label: "Simulador Energia", icon: Zap, roles: ["admin", "bo", "partner", "partner_commercial", "gestor_nv1"], section: "MENU PRINCIPAL" },
  ];

  if (user?.role === "admin") {
    menuItems.push(
      { path: "/operators", label: "Operadoras", icon: Building2, roles: ["admin"], section: "SISTEMA" },
      { path: "/operator-validations", label: "Validacoes", icon: CheckSquare, roles: ["admin"], section: "SISTEMA" },
      { path: "/objectives", label: "Objetivos", icon: Target, roles: ["admin"], section: "SISTEMA" },
      { path: "/users", label: "Utilizadores", icon: Settings, roles: ["admin"], section: "SISTEMA" },
      { path: "/commission-reports", label: "Comissoes", icon: FileSpreadsheet, roles: ["admin"], section: "SISTEMA" },
      { path: "/bo-website", label: "BO Website", icon: Globe, roles: ["admin"], section: "SISTEMA" },
      { path: "/simulador-config", label: "Config. Simulador", icon: SlidersHorizontal, roles: ["admin"], section: "SISTEMA" },
      { path: "/simulador-energia-admin", label: "Admin Simulador Energia", icon: Settings, roles: ["admin"], section: "SISTEMA" }
    );
  } else if (user?.role === "bo") {
    menuItems.push(
      { path: "/operators", label: "Operadoras", icon: Building2, roles: ["bo"], section: "SISTEMA" },
      { path: "/operator-validations", label: "Validacoes", icon: CheckSquare, roles: ["bo"], section: "SISTEMA" }
    );
  } else if (user?.role === "partner") {
    if (!isD2DPartner) {
      menuItems.push(
        { path: "/my-reports", label: "Meus Autos", icon: FileSpreadsheet, roles: ["partner"], section: "SISTEMA" }
      );
    }
  }

  const filteredMenuItems = menuItems.filter(item => {
    if (!item.roles.includes(user?.role)) return false;
    if (isD2DPartner && item.excludeD2D) return false;
    return true;
  });

  const mainMenuItems = filteredMenuItems.filter(i => i.section === "MENU PRINCIPAL");
  const systemMenuItems = filteredMenuItems.filter(i => i.section === "SISTEMA");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (onLogout) onLogout();
    navigate('/login');
  };

  const sidebarWidth = sidebarCollapsed ? 'w-[72px]' : 'w-[260px]';
  const mainMargin = sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-[260px]';

  const renderNavItem = (item, collapsed = false) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;
    return (
      <Link
        key={item.path}
        to={item.path}
        title={collapsed ? item.label : undefined}
        className={`group flex items-center ${collapsed ? 'justify-center px-2' : 'px-4'} py-2.5 rounded-lg transition-all duration-200 relative ${
          isActive ? "nav-item-active" : "nav-item"
        }`}
      >
        <Icon className={`w-[18px] h-[18px] ${collapsed ? '' : 'mr-3'} flex-shrink-0 transition-colors`} />
        {!collapsed && (
          <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
        )}
        {item.badge > 0 && (
          <span className={`${collapsed ? 'absolute -top-1 -right-1' : 'ml-auto'} text-white text-[10px] rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center font-bold bg-red-500`}>
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: '#0b1219' }}>
      <aside className={`hidden lg:flex lg:flex-col fixed h-screen ${sidebarWidth} glass-sidebar z-30 transition-all duration-300`}>
        <div className="relative px-4 py-5 border-b border-white/[0.06]">
          <Link to="/dashboard" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden ring-1 ring-gold-400/30 flex-shrink-0">
              <img src="/mp_grupo.jpg" alt="MP Grupo" className="w-full h-full object-cover" />
            </div>
            {!sidebarCollapsed && (
              <div className="overflow-hidden">
                <h1 className="text-sm font-bold tracking-tight text-white group-hover:text-gold-400 transition-colors">MP GRUPO</h1>
                <p className="text-[11px] font-medium text-dark-400">Sales CRM</p>
              </div>
            )}
          </Link>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-dark-700 border border-white/10 text-dark-300 flex items-center justify-center hover:bg-dark-600 hover:text-white transition-colors"
          >
            <ChevronLeft className={`w-3.5 h-3.5 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-premium space-y-6">
          <div>
            {!sidebarCollapsed && (
              <p className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-widest text-dark-500">Menu Principal</p>
            )}
            <div className="space-y-0.5">
              {mainMenuItems.map(item => renderNavItem(item, sidebarCollapsed))}
            </div>
          </div>

          {systemMenuItems.length > 0 && (
            <div>
              {!sidebarCollapsed && (
                <p className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-widest text-dark-500">Sistema</p>
              )}
              <div className="space-y-0.5">
                {systemMenuItems.map(item => renderNavItem(item, sidebarCollapsed))}
              </div>
            </div>
          )}
        </nav>

        <div className="border-t border-white/[0.06] p-3">
          <Link
            to="/profile"
            className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} px-3 py-3 rounded-lg hover:bg-white/5 transition-all`}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-dark-900 text-sm font-bold bg-gold-400 flex-shrink-0">
              {user?.name?.charAt(0) || 'U'}
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate text-white">{user?.name}</p>
                <p className="text-[11px] truncate text-dark-400">{user?.email}</p>
              </div>
            )}
            {!sidebarCollapsed && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleLogout(); }}
                className="p-1.5 rounded-lg text-dark-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </Link>
          {sidebarCollapsed && (
            <button
              onClick={handleLogout}
              className="w-full flex justify-center p-2.5 rounded-lg text-dark-400 hover:text-red-400 hover:bg-red-500/10 transition-colors mt-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 glass-top-bar">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg overflow-hidden ring-1 ring-gold-400/30">
              <img src="/mp_grupo.jpg" alt="MP Grupo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">MP GRUPO</h1>
              <p className="text-[10px] text-dark-400">Sales CRM</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Link to="/alerts" className="relative p-2 rounded-lg text-dark-300 hover:text-white hover:bg-white/5">
                <Bell className="w-5 h-5" />
                <span className="absolute -top-0.5 -right-0.5 text-white text-[10px] rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center font-bold bg-red-500">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              </Link>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg text-dark-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-white/[0.06] overflow-hidden glass-mobile-menu"
            >
              <div className="p-3 space-y-1 max-h-[calc(100vh-70px)] overflow-y-auto scrollbar-premium">
                {filteredMenuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${
                        isActive ? "bg-gold-400/10 text-gold-400" : "text-dark-200 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                      <span className="text-sm font-medium flex-1">{item.label}</span>
                      {item.badge > 0 && (
                        <span className="text-white text-[10px] rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center font-bold bg-red-500">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}

                <div className="pt-3 mt-3 border-t border-white/[0.06]">
                  <Link
                    to="/profile"
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-dark-200 hover:text-white hover:bg-white/5 transition-all"
                  >
                    <User className="w-[18px] h-[18px]" />
                    <span className="text-sm font-medium">Perfil</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <LogOut className="w-[18px] h-[18px]" />
                    <span className="text-sm font-medium">Sair</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <main className={`flex-1 flex flex-col h-screen overflow-hidden ${mainMargin} transition-all duration-300`}>
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-premium pt-16 lg:pt-0">
          <div className="page-container min-h-full">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="content-wrapper"
            >
              {children}
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
