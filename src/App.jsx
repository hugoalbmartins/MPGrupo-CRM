import React, { useEffect, useState, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster, toast } from "@/components/ui/sonner";
import { authService } from "./lib/auth";
import { supabase } from "./lib/supabase";
import { AlertCircle, Loader2 } from "lucide-react";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import Layout from "./components/Layout.jsx";
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
const EnergySimulator = lazy(() => import("./pages/EnergySimulator.jsx"));
const SimulatorSettings = lazy(() => import("./pages/SimulatorSettings.jsx"));
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
      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
      <p className="text-xs font-medium text-slate-600">Carregando...</p>
    </div>
  </div>
);

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [logoutReason, setLogoutReason] = useState(null);

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
      toast.warning('Sessão terminada por inatividade', {
        description: 'A sua sessão foi terminada automaticamente devido a 30 minutos de inatividade. Por favor, faça login novamente.',
        duration: 8000,
      });
      setLogoutReason(null);
    }
  }, [user, logoutReason]);

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
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
                <Route path="/profile" element={<Profile user={user} />} />
                <Route path="/forms" element={<Forms user={user} />} />
                <Route path="/forms/:operatorId" element={<Forms user={user} />} />
                <Route path="/simulador" element={<EnergySimulator user={user} />} />
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
                    <Route path="/simulador-config" element={<SimulatorSettings user={user} />} />
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
      </div>
    </QueryClientProvider>
  );
}

export default App;
