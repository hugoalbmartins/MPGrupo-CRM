import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, ShoppingCart, Building2, Settings, LogOut, Menu, X, Bell, FileText, FileSpreadsheet, SquareCheck as CheckSquare, User, Target, Globe, ChevronLeft, Zap, BellRing, Download, Plus, Banknote, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";
import { alertsService } from "../services/alertsService";
import { notificationService } from "../services/notificationService";

const Layout = ({ children, user, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [partnerType, setPartnerType] = useState(null);
  const [notifPermission, setNotifPermission] = useState('default');
  const [showNotifBanner, setShowNotifBanner] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
      const unsubscribe = alertsService.subscribeToAlerts(() => fetchUnreadCount());
      if (user.role === 'partner') fetchPartnerType();
      return () => {
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

  useEffect(() => {
    const perm = notificationService.getPermissionStatus();
    setNotifPermission(perm);
    if (perm === 'default') {
      const dismissed = localStorage.getItem('notif_banner_dismissed');
      if (!dismissed) setShowNotifBanner(true);
    }
    setCanInstall(!!window._deferredPWAPrompt);
    const checkInstall = () => setCanInstall(!!window._deferredPWAPrompt);
    window.addEventListener('beforeinstallprompt', checkInstall);
    return () => window.removeEventListener('beforeinstallprompt', checkInstall);
  }, []);

  const handleEnableNotifications = async () => {
    const result = await notificationService.requestPermission();
    setNotifPermission(result);
    setShowNotifBanner(false);
    localStorage.setItem('notif_banner_dismissed', '1');
  };

  const dismissNotifBanner = () => {
    setShowNotifBanner(false);
    localStorage.setItem('notif_banner_dismissed', '1');
  };

  const handleInstallPWA = async () => {
    const installed = await notificationService.installPWA();
    if (installed) setCanInstall(false);
  };

  const isD2DPartner = user?.role === 'partner' && partnerType === 'D2D';

  const menuItems = [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "bo", "partner", "partner_commercial", "gestor_nv1"], section: "MENU PRINCIPAL" },
    { path: "/partners", label: "Parceiros", icon: Users, roles: ["admin", "bo", "gestor_nv1"], section: "MENU PRINCIPAL" },
    { path: "/sales", label: "Vendas", icon: ShoppingCart, roles: ["admin", "bo", "partner", "partner_commercial", "gestor_nv1"], section: "MENU PRINCIPAL" },
    { path: "/forms", label: "Formularios", icon: FileText, roles: ["admin", "bo", "partner", "partner_commercial", "gestor_nv1"], section: "MENU PRINCIPAL" },
    { path: "/alerts", label: "Alertas", icon: Bell, roles: ["admin", "bo", "partner", "partner_commercial", "gestor_nv1"], badge: unreadCount, excludeD2D: true, section: "MENU PRINCIPAL" },
    { path: "/refidelizacoes", label: "Refidelizacao", icon: RotateCcw, roles: ["admin", "bo", "partner", "partner_commercial", "gestor_nv1"], section: "MENU PRINCIPAL" },
    { path: "/simulador-energia", label: "Simulador Energia", icon: Zap, roles: ["admin", "bo", "partner", "partner_commercial", "gestor_nv1"], section: "MENU PRINCIPAL" },
  ];

  if (user?.role === "admin") {
    menuItems.push(
      { path: "/operators", label: "Operadoras", icon: Building2, roles: ["admin"], section: "SISTEMA" },
      { path: "/operator-validations", label: "Validacoes", icon: CheckSquare, roles: ["admin"], section: "SISTEMA" },
      { path: "/objectives", label: "Objetivos", icon: Target, roles: ["admin"], section: "SISTEMA" },
      { path: "/users", label: "Utilizadores", icon: Settings, roles: ["admin"], section: "SISTEMA" },
      { path: "/commission-reports", label: "Comissoes", icon: FileSpreadsheet, roles: ["admin"], section: "SISTEMA" },
      { path: "/advances", label: "Adiantamentos", icon: Banknote, roles: ["admin"], section: "SISTEMA" },
      { path: "/bo-website", label: "BO Website", icon: Globe, roles: ["admin"], section: "SISTEMA" },
      { path: "/simulador-energia-admin", label: "Admin Simulador Energia", icon: Settings, roles: ["admin"], section: "SISTEMA" }
    );
  } else if (user?.role === "bo") {
    menuItems.push(
      { path: "/operators", label: "Operadoras", icon: Building2, roles: ["bo"], section: "SISTEMA" },
      { path: "/operator-validations", label: "Validacoes", icon: CheckSquare, roles: ["bo"], section: "SISTEMA" },
      { path: "/advances", label: "Adiantamentos", icon: Banknote, roles: ["bo"], section: "SISTEMA" }
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
        {isActive && (
          <motion.div
            layoutId="sidebar-active-indicator"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
            style={{ background: '#06b6d4' }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          />
        )}
        <Icon className={`w-[18px] h-[18px] ${collapsed ? '' : 'mr-3'} flex-shrink-0 transition-colors`} />
        {!collapsed && (
          <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
        )}
        {item.badge > 0 && (
          <motion.span
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`${collapsed ? 'absolute -top-1 -right-1' : 'ml-auto'} text-white text-[10px] rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center font-bold`}
            style={{ background: '#06b6d4' }}
          >
            {item.badge > 99 ? '99+' : item.badge}
          </motion.span>
        )}
      </Link>
    );
  };

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: '#080c14' }}>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex lg:flex-col fixed h-screen ${sidebarWidth} glass-sidebar z-30 transition-all duration-300`}
        style={{
          background: '#080c14',
          borderRight: '1px solid rgba(6, 182, 212, 0.08)',
        }}
      >
        {/* Brand */}
        <div className="relative px-4 py-5" style={{ borderBottom: '1px solid rgba(6, 182, 212, 0.08)' }}>
          <Link to="/dashboard" className="flex items-center gap-3 group">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0"
              style={{ boxShadow: '0 0 0 1px rgba(6, 182, 212, 0.3)' }}
            >
              <img
                src="/mp_grupo.jpg"
                alt="MP Grupo"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement.innerHTML = '<span style="color:#06b6d4;font-size:13px;font-weight:700;">MP</span>';
                }}
              />
            </div>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <h1 className="text-sm font-bold tracking-tight text-white transition-colors" style={{ textShadow: '0 0 20px rgba(6, 182, 212, 0.15)' }}>
                  MP <span style={{ color: '#06b6d4' }}>GRUPO</span>
                </h1>
                <p className="text-[11px] font-medium" style={{ color: 'rgba(6, 182, 212, 0.5)' }}>Sales CRM</p>
              </motion.div>
            )}
          </Link>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200"
            style={{
              background: '#0d1420',
              border: '1px solid rgba(6, 182, 212, 0.15)',
              color: 'rgba(6, 182, 212, 0.6)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.5)';
              e.currentTarget.style.color = '#06b6d4';
              e.currentTarget.style.boxShadow = '0 0 12px rgba(6, 182, 212, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.15)';
              e.currentTarget.style.color = 'rgba(6, 182, 212, 0.6)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <ChevronLeft className={`w-3.5 h-3.5 transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* New Sale Quick Action */}
        <div className="px-3 py-2" style={{ borderBottom: '1px solid rgba(6, 182, 212, 0.08)' }}>
          <button
            onClick={() => navigate('/sales', { state: { openNewSale: true } })}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all duration-200"
            style={{
              background: 'linear-gradient(135deg, rgba(6,182,212,0.12), rgba(8,145,178,0.08))',
              border: '1px solid rgba(6,182,212,0.25)',
              color: '#06b6d4',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(8,145,178,0.15))';
              e.currentTarget.style.borderColor = 'rgba(6,182,212,0.5)';
              e.currentTarget.style.boxShadow = '0 0 12px rgba(6,182,212,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(6,182,212,0.12), rgba(8,145,178,0.08))';
              e.currentTarget.style.borderColor = 'rgba(6,182,212,0.25)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            title="Nova Venda"
          >
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(6,182,212,0.2)' }}
            >
              <Plus className="w-3.5 h-3.5" />
            </div>
            {!sidebarCollapsed && (
              <span className="text-sm font-semibold">Nova Venda</span>
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-premium space-y-6">
          <div>
            {!sidebarCollapsed && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: 'rgba(6, 182, 212, 0.4)' }}
              >
                Menu Principal
              </motion.p>
            )}
            <div className="space-y-0.5">
              {mainMenuItems.map(item => renderNavItem(item, sidebarCollapsed))}
            </div>
          </div>

          {systemMenuItems.length > 0 && (
            <div>
              {!sidebarCollapsed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: 'rgba(6, 182, 212, 0.4)' }}
                >
                  Sistema
                </motion.p>
              )}
              <div className="space-y-0.5">
                {systemMenuItems.map(item => renderNavItem(item, sidebarCollapsed))}
              </div>
            </div>
          )}
        </nav>

        {/* User Footer */}
        <div className="p-3" style={{ borderTop: '1px solid rgba(6, 182, 212, 0.08)' }}>
          <Link
            to="/profile"
            className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} px-3 py-3 rounded-lg transition-all duration-200`}
            style={{ background: 'transparent' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(6, 182, 212, 0.05)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #06b6d4, #10b981)',
                color: '#080c14',
              }}
            >
              {user?.name?.charAt(0) || 'U'}
            </div>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex-1 min-w-0"
              >
                <p className="font-medium text-sm truncate text-white">{user?.name}</p>
                <p className="text-[11px] truncate" style={{ color: 'rgba(6, 182, 212, 0.45)' }}>{user?.email}</p>
              </motion.div>
            )}
            {!sidebarCollapsed && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleLogout(); }}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: 'rgba(6, 182, 212, 0.4)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(248, 113, 113, 0.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(6, 182, 212, 0.4)'; e.currentTarget.style.background = 'transparent'; }}
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </Link>
          {sidebarCollapsed && (
            <button
              onClick={handleLogout}
              className="w-full flex justify-center p-2.5 rounded-lg transition-colors mt-1"
              style={{ color: 'rgba(6, 182, 212, 0.4)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(248, 113, 113, 0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(6, 182, 212, 0.4)'; e.currentTarget.style.background = 'transparent'; }}
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-40 glass-top-bar"
        style={{
          background: 'rgba(8, 12, 20, 0.92)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(6, 182, 212, 0.08)',
        }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center"
              style={{ boxShadow: '0 0 0 1px rgba(6, 182, 212, 0.3)' }}
            >
              <img
                src="/mp_grupo.jpg"
                alt="MP Grupo"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement.innerHTML = '<span style="color:#06b6d4;font-size:12px;font-weight:700;">MP</span>';
                }}
              />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">
                MP <span style={{ color: '#06b6d4' }}>GRUPO</span>
              </h1>
              <p className="text-[10px]" style={{ color: 'rgba(6, 182, 212, 0.5)' }}>Sales CRM</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/sales', { state: { openNewSale: true } })}
              className="p-2 rounded-lg transition-all duration-200 flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(8,145,178,0.15))',
                border: '1px solid rgba(6,182,212,0.3)',
                color: '#06b6d4',
              }}
              title="Nova Venda"
            >
              <Plus className="w-4 h-4" />
            </button>
            {unreadCount > 0 && (
              <Link
                to="/alerts"
                className="relative p-2 rounded-lg transition-colors"
                style={{ color: 'rgba(6, 182, 212, 0.6)' }}
              >
                <Bell className="w-5 h-5" />
                <span
                  className="absolute -top-0.5 -right-0.5 text-white text-[10px] rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center font-bold"
                  style={{ background: '#06b6d4', boxShadow: '0 0 8px rgba(6, 182, 212, 0.4)' }}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              </Link>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg transition-colors"
              style={{ color: 'rgba(6, 182, 212, 0.6)' }}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden glass-mobile-menu"
              style={{
                borderTop: '1px solid rgba(6, 182, 212, 0.08)',
                background: 'rgba(8, 12, 20, 0.98)',
              }}
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
                      className="flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200"
                      style={
                        isActive
                          ? {
                              background: 'rgba(6, 182, 212, 0.1)',
                              color: '#06b6d4',
                              borderLeft: '3px solid #06b6d4',
                            }
                          : {
                              color: 'rgba(255, 255, 255, 0.6)',
                              borderLeft: '3px solid transparent',
                            }
                      }
                    >
                      <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                      <span className="text-sm font-medium flex-1">{item.label}</span>
                      {item.badge > 0 && (
                        <span
                          className="text-white text-[10px] rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center font-bold"
                          style={{ background: '#06b6d4' }}
                        >
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}

                <div className="pt-3 mt-3" style={{ borderTop: '1px solid rgba(6, 182, 212, 0.08)' }}>
                  <Link
                    to="/profile"
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200"
                    style={{ color: 'rgba(255, 255, 255, 0.6)', borderLeft: '3px solid transparent' }}
                  >
                    <User className="w-[18px] h-[18px]" />
                    <span className="text-sm font-medium">Perfil</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200"
                    style={{ color: '#f87171', borderLeft: '3px solid transparent' }}
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

      {/* Main Content */}
      <main className={`flex-1 flex flex-col h-screen overflow-hidden ${mainMargin} transition-all duration-300`}>
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-premium pt-16 lg:pt-0">
          <AnimatePresence>
            {(showNotifBanner || canInstall) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="mx-4 mt-4 lg:mx-6 flex flex-wrap gap-3">
                  {showNotifBanner && notifPermission === 'default' && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex-1 min-w-[280px] flex items-center gap-3 p-3 rounded-xl"
                      style={{
                        background: 'rgba(6, 182, 212, 0.08)',
                        border: '1px solid rgba(6, 182, 212, 0.15)',
                      }}
                    >
                      <BellRing className="w-5 h-5 shrink-0" style={{ color: '#06b6d4' }} />
                      <p className="text-sm flex-1" style={{ color: 'rgba(6, 182, 212, 0.8)' }}>Ative as notificacoes para receber alertas de vendas e propostas.</p>
                      <button
                        onClick={handleEnableNotifications}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all duration-200 shrink-0"
                        style={{ background: '#06b6d4' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#0891b2'; e.currentTarget.style.boxShadow = '0 0 16px rgba(6, 182, 212, 0.3)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#06b6d4'; e.currentTarget.style.boxShadow = 'none'; }}
                      >
                        Ativar
                      </button>
                      <button
                        onClick={dismissNotifBanner}
                        className="p-1 shrink-0 transition-colors"
                        style={{ color: 'rgba(6, 182, 212, 0.5)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#06b6d4'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(6, 182, 212, 0.5)'; }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  )}
                  {canInstall && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex-1 min-w-[280px] flex items-center gap-3 p-3 rounded-xl"
                      style={{
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.15)',
                      }}
                    >
                      <Download className="w-5 h-5 shrink-0" style={{ color: '#10b981' }} />
                      <p className="text-sm flex-1" style={{ color: 'rgba(16, 185, 129, 0.8)' }}>Instale a aplicacao para acesso rapido e notificacoes.</p>
                      <button
                        onClick={handleInstallPWA}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all duration-200 shrink-0"
                        style={{ background: '#10b981' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#059669'; e.currentTarget.style.boxShadow = '0 0 16px rgba(16, 185, 129, 0.3)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.boxShadow = 'none'; }}
                      >
                        Instalar
                      </button>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="page-container min-h-full">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
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
