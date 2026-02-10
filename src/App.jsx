import React, { useEffect, useState, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster, toast } from "@/components/ui/sonner";
import { authService } from "./lib/auth";
import { supabase } from "./lib/supabase";
import { notificationService } from "./services/notificationService";
import { AlertCircle, Loader2 } from "lucide-react";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import Layout from "./components/Layout.jsx";
import { AppPrompt } from "./components/AppPrompt.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Login from "./pages/Login.jsx";
import "@/App.css";

const ChangePassword = lazy(() => import("./pages/ChangePassword.jsx"));
const Partners = lazy(() => import("./pages/Partners.jsx"));
const Sales = lazy(() => import("./pages/Sales.jsx"));
const Operators = lazy(() => import("./pages/Operators.jsx"));
const Users = lazy(() => import("./pages/Users.jsx"));
const Profile = lazy(() => import("./pages/Profile.jsx"));
const Alerts = lazy(() => import("./pages/Alerts.jsx"));
const AlertsArchived = lazy(() => import("./pages/AlertsArchived.jsx"));
const Forms = lazy(() => import("./pages/Forms.jsx"));
const CommissionReports = lazy(() => import("./pages/CommissionReports.jsx"));
const CommissionReportsPartner = lazy(() => import("./pages/CommissionReportsPartner.jsx"));
const OperatorValidations = lazy(() => import("./pages/OperatorValidations.jsx"));
const Objectives = lazy(() => import("./pages/Objectives.jsx"));
const BOWebsite = lazy(() => import("./pages/BOWebsite.jsx"));
const EnergySimulatorNew = lazy(() => import("./pages/EnergySimulatorNew.jsx"));
const EnergySimulatorAdmin = lazy(() => import("./pages/EnergySimulatorAdmin.jsx"));

export { supabase };

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 10 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
      refetchOnMount: false,
      refetchOnReconnect: false,
    },
  },
});

const LoadingFallback = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="text-center">
      <div className="relative">
        <div className="w-10 h-10 border-2 border-cyber-500/20 rounded-full mx-auto" />
        <div className="w-10 h-10 border-2 border-transparent border-t-cyber-400 rounded-full animate-spin absolute inset-0 mx-auto" />
      </div>
      <p className="text-xs font-medium text-slate-500 mt-3">Carregando...</p>
    </div>
  </div>
);

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window._deferredPWAPrompt = e;
});

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [logoutReason, setLogoutReason] = useState(null);

  useEffect(() => {
    notificationService.registerServiceWorker();
  }, []);

  useEffect(() => {
    if (!user || mustChangePassword) return;

    (async () => {
      await notificationService.requestPermission();
      await notificationService.subscribeToPush();
    })();

    const alertTypeConfig = {
      new_sale: { title: 'Nova Venda Registada', icon: '📋', toastType: 'info' },
      status_change: { title: 'Estado Alterado', icon: '🔄', toastType: 'info' },
      note_added: { title: 'Nova Nota', icon: '💬', toastType: 'info' },
      sale_edit: { title: 'Venda Editada', icon: '✏️', toastType: 'warning' },
      proposal_reminder: { title: 'Propostas Pendentes', icon: '⏰', toastType: 'warning' },
      operator_validation: { title: 'Validacao de Operadora', icon: '✅', toastType: 'info' },
    };

    const channel = supabase
      .channel('app-alerts-push')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, (payload) => {
        const alert = payload.new;
        if (!alert || !alert.user_ids?.includes(user.id)) return;

        const config = alertTypeConfig[alert.type] || { title: 'Nova Notificacao', toastType: 'info' };

        toast[config.toastType](config.title, {
          description: alert.message,
          duration: 8000,
          action: alert.sale_code ? {
            label: 'Ver',
            onClick: () => window.location.href = alert.type === 'new_sale' || alert.type === 'sale_edit' ? '/sales' : '/alerts',
          } : undefined,
        });

        notificationService.showNotification(config.title, {
          body: alert.message,
          tag: `${alert.type}-${alert.sale_code || alert.id}`,
          data: { url: alert.type === 'new_sale' || alert.type === 'sale_edit' ? '/sales' : '/alerts' }
        });

        queryClient.invalidateQueries({ queryKey: ['alerts'] });
        queryClient.invalidateQueries({ queryKey: ['unreadAlertsCount'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, mustChangePassword]);

  useEffect(() => {
    if (!supabase) return;

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

    const INACTIVITY_TIMEOUT = 30 * 60 * 1000;
    let inactivityTimer;

    const resetTimer = () => {
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }

      inactivityTimer = setTimeout(async () => {
        console.log('Auto-logout due to inactivity');
        setLogoutReason('inactivity');
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

  useEffect(() => {
    if (!user && logoutReason === 'inactivity') {
      toast.warning('Sessao terminada por inatividade', {
        description: 'A sua sessao foi terminada automaticamente devido a 30 minutos de inatividade. Por favor, faca login novamente.',
        duration: 8000,
      });
      setLogoutReason(null);
    }
  }, [user, logoutReason]);

  if (!supabase) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080c14' }}>
        <div className="max-w-md w-full mx-auto p-6">
          <div className="bg-dark-850 border border-cyber-500/10 rounded-xl shadow-2xl p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">
              Erro de Configuracao
            </h1>
            <p className="text-slate-400 mb-4">
              As variaveis de ambiente do Supabase nao estao configuradas corretamente.
            </p>
            <div className="bg-dark-900 border border-dark-700 rounded-lg p-4 text-left text-sm">
              <p className="font-semibold text-slate-300 mb-2">Variaveis necessarias:</p>
              <ul className="list-disc list-inside text-slate-400 space-y-1">
                <li>VITE_SUPABASE_URL</li>
                <li>VITE_SUPABASE_ANON_KEY</li>
              </ul>
            </div>
            <p className="text-slate-500 text-sm mt-4">
              Verifique o console do navegador para mais detalhes.
            </p>
          </div>
        </div>
      </div>
    );
  }

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

        if (!userData.must_change_password) {
          const currentYear = new Date().getFullYear();
          const currentMonth = new Date().getMonth() + 1;

          queryClient.prefetchQuery({
            queryKey: ['dashboardStats', currentYear, currentMonth],
            queryFn: () => import('./services/dashboardService').then(mod =>
              mod.dashboardService.getStats(currentYear, currentMonth)
            ),
          });

          if (userData.role === 'admin') {
            queryClient.prefetchQuery({
              queryKey: ['users'],
              queryFn: () => import('./services/usersService').then(mod => mod.usersService.getAll()),
            });
            queryClient.prefetchQuery({
              queryKey: ['partners'],
              queryFn: () => import('./services/partnersService').then(mod => mod.partnersService.getAll()),
            });
          }
        }
      }
    } catch (error) {
      console.error("Failed to load user", error);
    }
  };

  const handleLogin = async (userData) => {
    setUser(userData);
    setMustChangePassword(userData.must_change_password);

    if (!userData.must_change_password) {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;

      queryClient.prefetchQuery({
        queryKey: ['dashboardStats', currentYear, currentMonth],
        queryFn: () => import('./services/dashboardService').then(mod =>
          mod.dashboardService.getStats(currentYear, currentMonth)
        ),
      });
    }
  };

  const handleLogout = async () => {
    try {
      setLogoutReason('manual');
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080c14' }}>
        <div className="relative">
          <div className="w-12 h-12 border-2 border-cyber-500/20 rounded-full" />
          <div className="w-12 h-12 border-2 border-transparent border-t-cyber-400 rounded-full animate-spin absolute inset-0" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="App">
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Login onLogin={handleLogin} />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </BrowserRouter>
          <Toaster position="top-right" richColors />
        </div>
      </QueryClientProvider>
    );
  }

  if (mustChangePassword) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="App">
          <Suspense fallback={<LoadingFallback />}>
            <ChangePassword onPasswordChanged={handlePasswordChanged} onLogout={handleLogout} />
          </Suspense>
          <Toaster position="top-right" richColors />
        </div>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="App">
        <BrowserRouter>
          <Layout user={user} onLogout={handleLogout}>
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                <Route path="/" element={<Dashboard user={user} />} />
                <Route path="/dashboard" element={<Dashboard user={user} />} />
                <Route path="/partners" element={<Partners user={user} />} />
                <Route path="/sales" element={<ErrorBoundary><Sales user={user} /></ErrorBoundary>} />
                <Route path="/alerts" element={<Alerts user={user} />} />
                <Route path="/alerts/archived" element={<AlertsArchived user={user} />} />
                <Route path="/profile" element={<Profile user={user} onUserUpdate={setUser} />} />
                <Route path="/forms" element={<Forms user={user} />} />
                <Route path="/forms/:operatorId" element={<Forms user={user} />} />
                <Route path="/simulador-energia" element={<EnergySimulatorNew user={user} />} />
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
                    <Route path="/bo-website" element={<BOWebsite user={user} />} />
                    <Route path="/simulador-energia-admin" element={<EnergySimulatorAdmin user={user} />} />
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
            </Suspense>
          </Layout>
        </BrowserRouter>
        <Toaster position="top-right" richColors />
        <AppPrompt />
      </div>
    </QueryClientProvider>
  );
}

export default App;
