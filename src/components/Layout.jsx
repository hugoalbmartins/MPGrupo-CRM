import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, ShoppingCart, Building2, Settings, LogOut, Menu, X, Bell,
  FileText, FileSpreadsheet, CheckSquare, User, Target, Globe, ChevronLeft
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";
import { alertsService } from "../services/alertsService";
import Breadcrumbs from "./ui/breadcrumbs";

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

      const unsubscribe = alertsService.subscribeToAlerts(() => {
        fetchUnreadCount();
      });

      if (user.role === 'partner') {
        fetchPartnerType();
      }

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

      if (data) {
        setPartnerType(data.partner_type);
      }
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
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "bo", "partner", "partner_commercial", "gestor_nv1"] },
    { path: "/partners", label: "Parceiros", icon: Users, roles: ["admin", "bo", "gestor_nv1"] },
    { path: "/sales", label: "Vendas", icon: ShoppingCart, roles: ["admin", "bo", "partner", "partner_commercial", "gestor_nv1"] },
    { path: "/forms", label: "Formulários", icon: FileText, roles: ["admin", "bo", "partner", "partner_commercial", "gestor_nv1"] },
    { path: "/alerts", label: "Alertas", icon: Bell, roles: ["admin", "bo", "partner", "partner_commercial", "gestor_nv1"], badge: unreadCount, excludeD2D: true },
  ];

  if (user?.role === "admin") {
    menuItems.push(
      { path: "/operators", label: "Operadoras", icon: Building2, roles: ["admin"] },
      { path: "/operator-validations", label: "Validações", icon: CheckSquare, roles: ["admin"] },
      { path: "/objectives", label: "Objetivos", icon: Target, roles: ["admin"] },
      { path: "/users", label: "Utilizadores", icon: Settings, roles: ["admin"] },
      { path: "/commission-reports", label: "Comissões", icon: FileSpreadsheet, roles: ["admin"] },
      { path: "/bo-website", label: "BO Website", icon: Globe, roles: ["admin"] }
    );
  } else if (user?.role === "bo") {
    menuItems.push(
      { path: "/operators", label: "Operadoras", icon: Building2, roles: ["bo"] },
      { path: "/operator-validations", label: "Validações", icon: CheckSquare, roles: ["bo"] }
    );
  } else if (user?.role === "partner") {
    if (!isD2DPartner) {
      menuItems.push(
        { path: "/my-reports", label: "Meus Autos", icon: FileSpreadsheet, roles: ["partner"] }
      );
    }
  }

  const filteredMenuItems = menuItems.filter(item => {
    if (!item.roles.includes(user?.role)) return false;
    if (isD2DPartner && item.excludeD2D) return false;
    return true;
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (onLogout) onLogout();
    navigate('/login');
  };

  const sidebarWidth = sidebarCollapsed ? 'w-[80px]' : 'w-[280px]';
  const mainMargin = sidebarCollapsed ? 'lg:ml-[80px]' : 'lg:ml-[280px]';

  return (
    <div className="h-screen flex overflow-hidden">
      <aside className={`hidden lg:flex lg:flex-col fixed h-screen ${sidebarWidth} glass-sidebar shadow-premium z-30 transition-all duration-300`}>
        <div className="relative p-4 border-b border-gold-400/30">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden ring-2 ring-gold-400/50 shadow-gold-glow flex-shrink-0">
              <img src="/mp_grupo.jpg" alt="MP Grupo" className="w-full h-full object-cover" />
            </div>
            {!sidebarCollapsed && (
              <div className="overflow-hidden">
                <h1 className="text-base font-bold tracking-tight text-cream-50">MP GRUPO</h1>
                <p className="text-xs font-medium text-gold-400">Sales CRM</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gold-400 text-chocolate-900 flex items-center justify-center shadow-lg hover:bg-gold-300 transition-colors"
          >
            <ChevronLeft className={`w-4 h-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-premium">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                title={sidebarCollapsed ? item.label : undefined}
                className={`group flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'px-4'} py-3.5 rounded-xl transition-all duration-300 relative overflow-hidden ${
                  isActive
                    ? "nav-item-active"
                    : "nav-item hover:scale-[1.02]"
                }`}
              >
                <Icon className={`w-5 h-5 ${sidebarCollapsed ? '' : 'mr-3'} transition-transform group-hover:scale-110 flex-shrink-0`} />
                {!sidebarCollapsed && (
                  <span className="text-sm font-medium whitespace-nowrap">
                    {item.label}
                  </span>
                )}
                {item.badge > 0 && (
                  <span className={`${sidebarCollapsed ? 'absolute -top-1 -right-1' : 'ml-auto'} text-white text-xs rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center font-bold bg-gradient-to-r from-red-500 to-red-600 shadow-lg ring-2 ring-chocolate-800`}>
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gold-400/30 p-3 space-y-2">
          <Link
            to="/profile"
            className={`block ${sidebarCollapsed ? 'p-2' : 'px-4 py-3'} rounded-xl hover:bg-white/10 transition-all duration-300`}
          >
            {sidebarCollapsed ? (
              <div className="w-10 h-10 mx-auto rounded-xl flex items-center justify-center text-chocolate-900 text-sm font-bold bg-gradient-to-r from-gold-400 to-gold-500 ring-2 ring-gold-400/50 shadow-gold-glow">
                {user?.name?.charAt(0) || 'U'}
              </div>
            ) : (
              <>
                <p className="text-xs font-medium mb-2 text-cream-200/70">Conectado como</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-chocolate-900 text-sm font-bold bg-gradient-to-r from-gold-400 to-gold-500 ring-2 ring-gold-400/50 shadow-gold-glow flex-shrink-0">
                    {user?.name?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate text-cream-50">{user?.name}</p>
                    <p className="text-xs truncate text-gold-400">{user?.position || user?.role}</p>
                  </div>
                </div>
              </>
            )}
          </Link>

          <button
            onClick={handleLogout}
            className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3 rounded-xl text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-all duration-300`}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="text-sm font-medium">Sair</span>}
          </button>
        </div>
      </aside>

      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 glass-top-bar">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden ring-2 ring-gold-400/50 shadow-gold-glow">
              <img src="/mp_grupo.jpg" alt="MP Grupo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-cream-50">MP GRUPO</h1>
              <p className="text-xs text-gold-400">Sales CRM</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-xl text-cream-50 hover:bg-white/10 transition-colors"
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-gold-400/20 overflow-hidden glass-mobile-menu"
              style={{ color: '#ffffff' }}
            >
              <div className="p-4 space-y-2 max-h-[calc(100vh-100px)] overflow-y-auto scrollbar-premium">
                {filteredMenuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                        isActive
                          ? "bg-gradient-to-r from-gold-400 to-gold-500 shadow-lg"
                          : "hover:bg-white/10"
                      }`}
                      style={{ color: isActive ? '#3D2914' : '#ffffff' }}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm font-semibold flex-1" style={{ color: 'inherit' }}>{item.label}</span>
                      {item.badge > 0 && (
                        <span className="text-xs rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center font-bold bg-gradient-to-r from-red-500 to-red-600 shadow-lg" style={{ color: '#ffffff' }}>
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}

                <div className="pt-4 mt-4 border-t border-gold-400/20 space-y-2">
                  <Link
                    to="/profile"
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-all"
                    style={{ color: '#ffffff' }}
                  >
                    <User className="w-5 h-5" />
                    <span className="text-sm font-semibold" style={{ color: 'inherit' }}>Perfil</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-500/20 transition-all"
                    style={{ color: '#fca5a5' }}
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="text-sm font-semibold" style={{ color: 'inherit' }}>Sair</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <main className={`flex-1 flex flex-col h-screen overflow-hidden ${mainMargin} transition-all duration-300`}>
        <div className="hidden lg:block flex-shrink-0 z-20 glass-card border-b border-gold-200/30">
          <div className="px-6 py-4">
            <Breadcrumbs />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-premium pt-20 lg:pt-0">
          <div className="page-container min-h-full">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
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
