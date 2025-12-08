import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, ShoppingCart, Building2, Settings, LogOut, Menu, X, Bell, FileText } from "lucide-react";
import { supabase } from "../lib/supabase";

const Layout = ({ children, user, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
      // Poll every 30 seconds
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchUnreadCount = async () => {
    setUnreadCount(0);
  };

  const menuItems = [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "bo", "partner", "partner_commercial"] },
    { path: "/partners", label: "Parceiros", icon: Users, roles: ["admin", "bo", "partner"] },
    { path: "/sales", label: "Vendas", icon: ShoppingCart, roles: ["admin", "bo", "partner", "partner_commercial"] },
    { path: "/forms", label: "Formulários", icon: FileText, roles: ["admin", "bo", "partner", "partner_commercial"] },
  ];

  if (user?.role === "admin") {
    menuItems.push(
      { path: "/operators", label: "Operadoras", icon: Building2, roles: ["admin"] },
      { path: "/users", label: "Utilizadores", icon: Settings, roles: ["admin"] }
    );
  } else if (user?.role === "bo") {
    menuItems.push(
      { path: "/operators", label: "Operadoras", icon: Building2, roles: ["bo"] }
    );
  }

  const filteredMenuItems = menuItems.filter(item => item.roles.includes(user?.role));

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex md:flex-col w-64 bg-white border-r border-gray-200">
        <div className="flex items-center p-6 border-b border-gray-200">
          <img src="/logo.png" alt="MP Grupo" className="h-10 w-10 object-contain" />
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
                data-testid={`nav-${item.label.toLowerCase()}`}
                className={`flex items-center px-4 py-3 rounded-lg transition-all ${
                  isActive
                    ? "bg-blue-50 text-blue-600 font-semibold"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-200 p-4">
          <Link to="/profile" className="block px-4 py-2 mb-2 rounded-lg hover:bg-gray-50 transition-all">
            <p className="text-xs text-gray-500">Conectado como</p>
            <p className="font-semibold text-gray-900 text-sm">{user?.name}</p>
            <p className="text-xs text-gray-500">{user?.position}</p>
          </Link>
          <button
            onClick={onLogout}
            data-testid="logout-button"
            className="flex items-center w-full px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-50 transition-all"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sair
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
            <img src="/logo.png" alt="MP Grupo" className="h-10 w-10 object-contain" />
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
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
          <div></div>
          <div className="flex items-center gap-4">
            {/* Alerts Bell */}
            <button
              onClick={() => navigate('/alerts')}
              className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Bell className="w-5 h-5 text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            
            {/* User Profile */}
            <Link to="/profile" className="flex items-center gap-2 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <span className="text-sm font-medium text-gray-700">{user?.name}</span>
            </Link>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto p-6">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
