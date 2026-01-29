import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, ShoppingCart, Building2, Settings, LogOut, Menu, X, Bell,
  FileText, FileSpreadsheet, CheckSquare, ChevronLeft, ChevronRight, User, Target,
  ChevronDown
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";
import { alertsService } from "../services/alertsService";
import Breadcrumbs from "./ui/breadcrumbs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";

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

  const isD2DPartner = user?.role === 'partner' && ['D2D_1', 'D2D_2', 'D2D_3'].includes(partnerType);

  const menuItems = [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "bo", "partner", "partner_commercial", "gestor_nv1"], excludeD2D: true },
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
      { path: "/commission-reports", label: "Comissões", icon: FileSpreadsheet, roles: ["admin"] }
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

  return (
    <TooltipProvider delayDuration={300}>
      <div className="h-screen flex overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
        {/* Desktop Sidebar */}
        <motion.aside
          initial={false}
          animate={{ width: sidebarCollapsed ? 80 : 280 }}
          className="hidden lg:flex lg:flex-col fixed h-screen glass-sidebar shadow-2xl shadow-navy-900/20 z-30"
        >
          {/* Logo Section */}
          <div className="relative p-6 border-b border-navy-700/50">
            <AnimatePresence mode="wait">
              {!sidebarCollapsed ? (
                <motion.div
                  key="expanded"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden ring-2 ring-gold-400/50 shadow-gold-glow">
                    <img src="/mp_grupo.jpg" alt="MP Grupo" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h1 className="text-base font-bold tracking-tight text-white">MP GRUPO</h1>
                    <p className="text-xs font-medium text-gold-400">Sales CRM</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="collapsed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex justify-center"
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden ring-2 ring-gold-400/50 shadow-gold-glow">
                    <img src="/mp_grupo.jpg" alt="MP Grupo" className="w-full h-full object-cover" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Collapse Toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-gradient-to-r from-gold-400 to-gold-500 text-navy-900 flex items-center justify-center shadow-lg hover:shadow-gold-glow transition-all duration-300 z-40 hover:scale-110"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          {/* Navigation Menu */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-modern">
            {filteredMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>
                    <Link
                      to={item.path}
                      className={`group flex items-center px-4 py-3.5 rounded-xl transition-all duration-300 relative overflow-hidden ${
                        isActive
                          ? "nav-item-active transform scale-105"
                          : "nav-item hover:scale-105"
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${sidebarCollapsed ? '' : 'mr-3'} transition-transform group-hover:scale-110 flex-shrink-0`} />
                      <AnimatePresence>
                        {!sidebarCollapsed && (
                          <motion.span
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: "auto" }}
                            exit={{ opacity: 0, width: 0 }}
                            className="text-sm font-medium whitespace-nowrap"
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                      {item.badge > 0 && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className={`${sidebarCollapsed ? 'absolute -top-1 -right-1' : 'ml-auto'} text-white text-xs rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center font-bold bg-gradient-to-r from-red-500 to-red-600 shadow-lg ring-2 ring-white`}
                        >
                          {item.badge > 99 ? '99+' : item.badge}
                        </motion.span>
                      )}
                    </Link>
                  </TooltipTrigger>
                  {sidebarCollapsed && (
                    <TooltipContent side="right" className="bg-navy-900 text-white border-gold-400/50">
                      <p>{item.label}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </nav>

          {/* User Profile Section */}
          <div className="border-t border-navy-700/50 p-4 space-y-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/profile"
                  className={`block px-4 py-3 rounded-xl hover:bg-white/10 transition-all duration-300 ${sidebarCollapsed ? 'flex justify-center' : ''}`}
                >
                  <AnimatePresence mode="wait">
                    {!sidebarCollapsed ? (
                      <motion.div
                        key="expanded-user"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <p className="text-xs text-slate-400 font-medium mb-2">Conectado como</p>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-navy-900 text-sm font-bold bg-gradient-to-r from-gold-400 to-gold-500 ring-2 ring-gold-400/50 shadow-gold-glow">
                            {user?.name?.charAt(0) || 'U'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-white text-sm truncate">{user?.name}</p>
                            <p className="text-xs text-gold-400 truncate">{user?.position || user?.role}</p>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="collapsed-user"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-navy-900 text-sm font-bold bg-gradient-to-r from-gold-400 to-gold-500 ring-2 ring-gold-400/50 shadow-gold-glow"
                      >
                        {user?.name?.charAt(0) || 'U'}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Link>
              </TooltipTrigger>
              {sidebarCollapsed && (
                <TooltipContent side="right" className="bg-navy-900 text-white border-gold-400/50">
                  <p>{user?.name}</p>
                </TooltipContent>
              )}
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleLogout}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-300 ${sidebarCollapsed ? 'justify-center' : ''}`}
                >
                  <LogOut className="w-5 h-5 flex-shrink-0" />
                  {!sidebarCollapsed && <span className="text-sm font-medium">Sair</span>}
                </button>
              </TooltipTrigger>
              {sidebarCollapsed && (
                <TooltipContent side="right" className="bg-navy-900 text-white border-gold-400/50">
                  <p>Sair</p>
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </motion.aside>

        {/* Mobile Header & Navigation */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-40 glass-card border-b border-navy-100/40 backdrop-blur-xl">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden ring-2 ring-gold-400/50">
                <img src="/mp_grupo.jpg" alt="MP Grupo" className="w-full h-full object-cover" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-navy-900">MP GRUPO</h1>
                <p className="text-xs text-gold-600">Sales CRM</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-xl hover:bg-navy-50 transition-colors"
            >
              {sidebarOpen ? <X className="w-6 h-6 text-navy-900" /> : <Menu className="w-6 h-6 text-navy-900" />}
            </button>
          </div>

          {/* Mobile Accordion Menu */}
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-navy-100/40 overflow-hidden"
              >
                <div className="p-4 space-y-2 max-h-[calc(100vh-100px)] overflow-y-auto scrollbar-modern">
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
                            ? "bg-gradient-to-r from-gold-400 to-gold-500 text-navy-900 shadow-lg"
                            : "hover:bg-navy-50 text-navy-700"
                        }`}
                      >
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm font-medium flex-1">{item.label}</span>
                        {item.badge > 0 && (
                          <span className="text-white text-xs rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center font-bold bg-gradient-to-r from-red-500 to-red-600 shadow-lg">
                            {item.badge > 99 ? '99+' : item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}

                  <div className="pt-4 mt-4 border-t border-navy-100/40 space-y-2">
                    <Link
                      to="/profile"
                      onClick={() => setSidebarOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-navy-50 text-navy-700 transition-all"
                    >
                      <User className="w-5 h-5" />
                      <span className="text-sm font-medium">Perfil</span>
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 text-red-600 transition-all"
                    >
                      <LogOut className="w-5 h-5" />
                      <span className="text-sm font-medium">Sair</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Main Content Area */}
        <motion.main
          initial={false}
          animate={{
            marginLeft: window.innerWidth >= 1024 ? (sidebarCollapsed ? 80 : 280) : 0,
          }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="flex-1 flex flex-col h-screen overflow-hidden"
        >
          {/* Breadcrumbs Bar */}
          <div className="flex-shrink-0 z-20 glass-card border-b border-navy-100/40 backdrop-blur-xl mt-0 lg:mt-0 pt-20 lg:pt-0">
            <div className="px-6 py-4">
              <Breadcrumbs />
            </div>
          </div>

          {/* Page Content */}
          <div className="flex-1 overflow-y-auto overflow-x-auto scrollbar-modern">
            <div className="p-6 lg:p-8 min-w-fit min-h-full">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="max-w-full"
              >
                {children}
              </motion.div>
            </div>
          </div>
        </motion.main>
      </div>
    </TooltipProvider>
  );
};

export default Layout;
