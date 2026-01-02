import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { authService } from "./lib/auth";
import { supabase } from "./lib/supabase";
import { AlertCircle } from "lucide-react";
import Login from "./pages/Login.jsx";
import ChangePassword from "./pages/ChangePassword.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Partners from "./pages/Partners.jsx";
import Sales from "./pages/Sales.jsx";
import Operators from "./pages/Operators.jsx";
import Users from "./pages/Users.jsx";
import Profile from "./pages/Profile.jsx";
import Alerts from "./pages/Alerts.jsx";
import AlertsArchived from "./pages/AlertsArchived.jsx";
import Forms from "./pages/Forms.jsx";
import CommissionReports from "./pages/CommissionReports.jsx";
import CommissionReportsPartner from "./pages/CommissionReportsPartner.jsx";
import OperatorValidations from "./pages/OperatorValidations.jsx";
import Objectives from "./pages/Objectives.jsx";
import Layout from "./components/Layout.jsx";
import "@/App.css";

export { supabase };

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  if (!supabase) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-auto p-6">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Erro de Configuração
            </h1>
            <p className="text-gray-600 mb-4">
              As variáveis de ambiente do Supabase não estão configuradas corretamente.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 text-left text-sm">
              <p className="font-semibold text-gray-700 mb-2">Variáveis necessárias:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                <li>VITE_SUPABASE_URL</li>
                <li>VITE_SUPABASE_ANON_KEY</li>
              </ul>
            </div>
            <p className="text-gray-500 text-sm mt-4">
              Verifique o console do navegador para mais detalhes.
            </p>
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    checkUser();

    const { data: { subscription } } = authService.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session ? 'has session' : 'no session');

      if (event === 'SIGNED_IN' && session) {
        await loadUser();
      } else if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' && !session) {
        setUser(null);
        setMustChangePassword(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
    let inactivityTimer;

    const resetTimer = () => {
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }

      inactivityTimer = setTimeout(async () => {
        console.log('Auto-logout due to inactivity');
        await authService.signOut();
        setUser(null);
        setMustChangePassword(false);
      }, INACTIVITY_TIMEOUT);
    };

    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    activityEvents.forEach(event => {
      document.addEventListener(event, resetTimer, true);
    });

    resetTimer();

    return () => {
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }
      activityEvents.forEach(event => {
        document.removeEventListener(event, resetTimer, true);
      });
    };
  }, [user]);

  const checkUser = async () => {
    try {
      const userData = await authService.getCurrentUser();
      if (userData) {
        setUser(userData);
        setMustChangePassword(userData.must_change_password);
      } else {
        setUser(null);
        setMustChangePassword(false);
      }
    } catch (error) {
      console.error("Failed to fetch user", error);
      setUser(null);
      setMustChangePassword(false);
    } finally {
      setLoading(false);
    }
  };

  const loadUser = async () => {
    try {
      const userData = await authService.getCurrentUser();
      if (userData) {
        setUser(userData);
        setMustChangePassword(userData.must_change_password);
      }
    } catch (error) {
      console.error("Failed to load user", error);
    }
  };

  const handleLogin = (userData) => {
    setUser(userData);
    setMustChangePassword(userData.must_change_password);
  };

  const handleLogout = async () => {
    try {
      await authService.signOut();
      setUser(null);
      setMustChangePassword(false);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handlePasswordChanged = () => {
    setMustChangePassword(false);
    if (user) {
      setUser({ ...user, must_change_password: false });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="App">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login onLogin={handleLogin} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </div>
    );
  }

  if (mustChangePassword) {
    return (
      <div className="App">
        <ChangePassword onPasswordChanged={handlePasswordChanged} onLogout={handleLogout} />
        <Toaster position="top-right" richColors />
      </div>
    );
  }

  return (
    <div className="App">
      <BrowserRouter>
        <Layout user={user} onLogout={handleLogout}>
          <Routes>
            <Route path="/" element={<Dashboard user={user} />} />
            <Route path="/dashboard" element={<Dashboard user={user} />} />
            <Route path="/partners" element={<Partners user={user} />} />
            <Route path="/sales" element={<Sales user={user} />} />
            <Route path="/alerts" element={<Alerts user={user} />} />
            <Route path="/alerts/archived" element={<AlertsArchived user={user} />} />
            <Route path="/profile" element={<Profile user={user} />} />
            <Route path="/forms" element={<Forms user={user} />} />
            <Route path="/forms/:operatorId" element={<Forms user={user} />} />
            {user?.role === "partner" && (
              <Route path="/my-reports" element={<CommissionReportsPartner user={user} />} />
            )}
            {user?.role === "admin" && (
              <>
                <Route path="/operators" element={<Operators user={user} />} />
                <Route path="/objectives" element={<Objectives user={user} />} />
                <Route path="/users" element={<Users user={user} />} />
                <Route path="/commission-reports" element={<CommissionReports user={user} />} />
                <Route path="/operator-validations" element={<OperatorValidations user={user} />} />
              </>
            )}
            {user?.role === "bo" && (
              <>
                <Route path="/operators" element={<Operators user={user} />} />
                <Route path="/operator-validations" element={<OperatorValidations user={user} />} />
              </>
            )}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Layout>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
