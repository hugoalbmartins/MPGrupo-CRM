import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, ShoppingCart, Building2, Settings, LogOut, Menu, X } from "lucide-react";

const Layout = ({ children, user, onLogout }) => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/partners", label: "Parceiros", icon: Users },
    { path: "/sales", label: "Vendas", icon: ShoppingCart },
  ];

  if (user?.role === "admin") {
    menuItems.push(
      { path: "/operators", label: "Operadoras", icon: Building2 },
      { path: "/users", label: "Utilizadores", icon: Settings }
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex md:flex-col w-64 glass-card m-4 p-6">
        <div className="flex items-center mb-8">
          <img src="/logo.png" alt="MDM Grupo" className="h-12 w-12 object-contain" />
          <h1 className="logo-text text-xl ml-3">MDM GRUPO</h1>
        </div>

        <nav className="flex-1 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                data-testid={`nav-${item.label.toLowerCase()}`}
                className={`flex items-center px-4 py-3 rounded-lg transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-[#C9A961] to-[#B8944E] text-[#0f0f10]"
                    : "text-gray-300 hover:bg-white/5"
                }`}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 pt-4 mt-4">
          <div className="px-4 py-2 mb-2">
            <p className="text-sm text-gray-400">Conectado como</p>
            <p className="font-semibold gold-text">{user?.name}</p>
            <p className="text-xs text-gray-500">{user?.position}</p>
          </div>
          <button
            onClick={onLogout}
            data-testid="logout-button"
            className="flex items-center w-full px-4 py-3 rounded-lg text-gray-300 hover:bg-white/5 transition-all"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 glass-card"
        data-testid="mobile-menu-button"
      >
        {sidebarOpen ? <X className="w-6 h-6 gold-text" /> : <Menu className="w-6 h-6 gold-text" />}
      </button>

      {/* Sidebar Mobile */}
      {sidebarOpen && (
        <aside className="md:hidden fixed inset-0 z-40 flex flex-col glass-card m-4 p-6">
          <div className="flex items-center mb-8 mt-12">
            <img src="/logo.png" alt="MDM Grupo" className="h-12 w-12 object-contain" />
            <h1 className="logo-text text-xl ml-3">MDM GRUPO</h1>
          </div>

          <nav className="flex-1 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-[#C9A961] to-[#B8944E] text-[#0f0f10]"
                      : "text-gray-300 hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-white/10 pt-4 mt-4">
            <div className="px-4 py-2 mb-2">
              <p className="text-sm text-gray-400">Conectado como</p>
              <p className="font-semibold gold-text">{user?.name}</p>
              <p className="text-xs text-gray-500">{user?.position}</p>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center w-full px-4 py-3 rounded-lg text-gray-300 hover:bg-white/5 transition-all"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Sair
            </button>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
