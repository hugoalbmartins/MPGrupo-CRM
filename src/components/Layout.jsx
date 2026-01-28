import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, ShoppingCart, Building2, Settings, LogOut, Menu, X, Bell,
  FileText, FileSpreadsheet, CheckSquare, ChevronLeft, ChevronRight, User, Target
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";
import { alertsService } from "../services/alertsService";
import Breadcrumbs from "./ui/breadcrumbs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

const Layout = ({ children, user, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "bo", "partner", "partner_commercial", "gestor_nv1"] },
    { path: "/partners", label: "Parceiros", icon: Users, roles: ["admin", "bo", "gestor_nv1"] },
    { path: "/sales", label: "Vendas", icon: ShoppingCart, roles: ["admin", "bo", "partner", "partner_commercial", "gestor_nv1"] },
    { path: "/forms", label: "Formulários", icon: FileText, roles: ["admin", "bo", "partner", "partner_commercial", "gestor_nv1"] },
    { path: "/alerts", label: "Alertas", icon: Bell, roles: ["admin", "bo", "partner", "partner_commercial", "gestor_nv1"], badge: unreadCount },
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
    menuItems.push(
      { path: "/my-reports", label: "Meus Autos", icon: FileSpreadsheet, roles: ["partner"] }
    );
  }

  const filteredMenuItems = menuItems.filter(item => item.roles.includes(user?.role));

  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-screen flex bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30">
        {/* Sidebar Desktop */}
        <motion.aside
          initial={false}
          animate={{ width: sidebarCollapsed ? 80 : 280 }}
          className="hidden md:flex md:flex-col fixed h-screen glass-sidebar shadow-2xl z-30"
        >
          {/* Logo */}
          <div className="relative p-6 border-b border-slate-700/50">
            <AnimatePresence mode="wait">
              {!sidebarCollapsed ? (
                <motion.div
                  key="expanded"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden ring-2 ring-blue-400/50">
                    <img src="/mp_grupo.jpg" alt="MP Grupo" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h1 className="text-base font-bold tracking-tight text-white">MP GRUPO</h1>
                    <p className="text-xs font-medium text-blue-200">Sales CRM</p>
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
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden ring-2 ring-blue-400/50">
                    <img src="/mp_grupo.jpg" alt="MP Grupo" className="w-full h-full object-cover" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Collapse Button */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg hover:bg-blue-700 transition-colors z-40"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-thin">
            {filteredMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>
                    <Link
                      to={item.path}
                      className={`group flex items-center px-4 py-3.5 rounded-xl transition-all duration-200 relative overflow-hidden ${
                        isActive
                          ? "nav-item-active"
                          : "nav-item"
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
                          className={`${sidebarCollapsed ? 'absolute -top-1 -right-1' : 'ml-auto'} text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold bg-gradient-to-r from-red-500 to-red-600 shadow-lg`}
                        >
                          {item.badge > 9 ? '9+' : item.badge}
                        </motion.span>
                      )}
                    </Link>
                  </TooltipTrigger>
                  {sidebarCollapsed && (
                    <TooltipContent side="right" className="bg-[#0F2942] text-white border-blue-800">
                      <p>{item.label}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </nav>

          <div className="border-t border-slate-700/50 p-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/profile"
                  className={`block px-4 py-3 mb-2 rounded-xl hover:bg-slate-800/50 transition-all ${sidebarCollapsed ? 'flex justify-center' : ''}`}
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
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold bg-gradient-to-r from-blue-600 to-blue-500 ring-2 ring-blue-400/30">
                            {user?.name?.charAt(0) || 'U'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-white text-sm truncate">{user?.name}</p>
                            <p className="text-xs text-slate-400 truncate">{user?.position}</p>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="collapsed-user"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold bg-gradient-to-r from-blue-600 to-blue-500 ring-2 ring-blue-400/30"
                      >
                        {user?.name?.charAt(0) || 'U'}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Link>
              </TooltipTrigger>
              {sidebarCollapsed && (
                <TooltipContent side="right" className="bg-[#0F2942] text-white border-blue-800">
                  <p className="font-semibold">{user?.name}</p>
                  <p className="text-xs text-blue-200">{user?.position}</p>
                </TooltipContent>
              )}
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onLogout}
                  className={`flex items-center w-full px-4 py-3 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all group font-medium ${sidebarCollapsed ? 'justify-center' : ''}`}
                >
                  <LogOut className={`w-5 h-5 ${sidebarCollapsed ? '' : 'mr-3'} group-hover:transform group-hover:translate-x-1 transition-transform flex-shrink-0`} />
                  <AnimatePresence>
                    {!sidebarCollapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        className="text-sm whitespace-nowrap"
                      >
                        Sair
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              </TooltipTrigger>
              {sidebarCollapsed && (
                <TooltipContent side="right" className="bg-[#0F2942] text-white border-blue-800">
                  <p>Sair</p>
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </motion.aside>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden fixed top-4 left-4 z-50 p-3 glass-card hover:shadow-lg transition-all"
        >
          {sidebarOpen ? <X className="w-5 h-5 text-slate-700" /> : <Menu className="w-5 h-5 text-slate-700" />}
        </button>

        {/* Sidebar Mobile */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
                className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
              />
              <motion.aside
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: "spring", damping: 30 }}
                className="md:hidden fixed inset-y-0 left-0 w-72 z-50 flex flex-col glass-sidebar shadow-2xl"
              >
                <div className="flex items-center p-6 border-b border-blue-900/30 mt-16">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden ring-2 ring-blue-400/50">
                    <img src="/mp_grupo.jpg" alt="MP Grupo" className="w-full h-full object-cover" />
                  </div>
                  <div className="ml-3">
                    <h1 className="text-base font-bold text-white">MP GRUPO</h1>
                    <p className="text-xs text-blue-200">Sales CRM</p>
                  </div>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-thin">
                  {filteredMenuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center px-4 py-3.5 rounded-xl transition-all ${
                          isActive
                            ? "nav-item-active"
                            : "nav-item"
                        }`}
                      >
                        <Icon className="w-5 h-5 mr-3" />
                        <span className="text-sm font-medium">{item.label}</span>
                        {item.badge > 0 && (
                          <span className="ml-auto text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold bg-gradient-to-r from-red-500 to-red-600">
                            {item.badge > 9 ? '9+' : item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </nav>

                <div className="border-t border-blue-900/30 p-4">
                  <div className="px-4 py-3 mb-2 rounded-xl bg-white/5">
                    <p className="text-xs text-blue-200 mb-2">Conectado como</p>
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold bg-gradient-to-r from-blue-600 to-blue-500">
                        {user?.name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <p className="font-semibold text-white text-sm">{user?.name}</p>
                        <p className="text-xs text-blue-200">{user?.position}</p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={onLogout}
                    className="flex items-center w-full px-4 py-3 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
                  >
                    <LogOut className="w-5 h-5 mr-3" />
                    <span className="text-sm font-medium">Sair</span>
                  </button>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <motion.main
          initial={false}
          animate={{ marginLeft: sidebarCollapsed ? 80 : 280 }}
          className="flex-1 overflow-auto hidden md:block"
        >
          {/* Header with Alerts */}
          <div className="glass-card sticky top-0 z-20 px-6 py-4 flex justify-between items-center border-b border-blue-100/60">
            <div className="flex items-center gap-4 flex-1">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {filteredMenuItems.find(item => item.path === location.pathname)?.label || 'Dashboard'}
                </h2>
                <p className="text-xs text-gray-600">
                  {new Date().toLocaleDateString('pt-PT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Alerts Bell */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate('/alerts')}
                    className="relative p-3 hover:bg-blue-50 rounded-xl transition-all group"
                  >
                    <Bell className="w-5 h-5 text-gray-600 group-hover:text-blue-600 transition-colors" />
                    {unreadCount > 0 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold bg-gradient-to-r from-red-500 to-red-600 shadow-lg animate-pulse"
                      >
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </motion.span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Alertas {unreadCount > 0 && `(${unreadCount})`}</p>
                </TooltipContent>
              </Tooltip>

              {/* User Profile */}
              <Link
                to="/profile"
                className="flex items-center gap-3 hover:bg-blue-50 px-3 py-2 rounded-xl transition-all"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm bg-gradient-to-r from-blue-600 to-blue-500 shadow-md">
                  {user?.name?.charAt(0) || 'U'}
                </div>
                <div className="hidden lg:block">
                  <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
                  <p className="text-xs text-gray-600">
                    {user?.role === 'admin' ? 'Administrador' : user?.role === 'bo' ? 'Back Office' : 'Parceiro'}
                  </p>
                </div>
              </Link>
            </div>
          </div>

          <div className="max-w-7xl mx-auto p-6">
            <Breadcrumbs />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {children}
            </motion.div>
          </div>
        </motion.main>

        {/* Mobile Main Content */}
        <main className="flex-1 overflow-auto md:hidden w-full">
          <div className="glass-card sticky top-0 z-20 px-6 py-4 border-b border-blue-100/60 mt-16">
            <h2 className="text-lg font-bold text-gray-900">
              {filteredMenuItems.find(item => item.path === location.pathname)?.label || 'Dashboard'}
            </h2>
            <p className="text-xs text-gray-600">
              {new Date().toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>

          <div className="p-4">
            <Breadcrumbs />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {children}
            </motion.div>
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
};

export default Layout;
