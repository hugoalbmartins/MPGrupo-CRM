import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { authService } from "./lib/auth";
import { supabase } from "./lib/supabase";
import Login from "./pages/Login.jsx";
import ChangePassword from "./pages/ChangePassword.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Partners from "./pages/Partners.jsx";
import Sales from "./pages/Sales.jsx";
import Operators from "./pages/Operators.jsx";
import Users from "./pages/Users.jsx";
import Profile from "./pages/Profile.jsx";
import Alerts from "./pages/Alerts.jsx";
import Forms from "./pages/Forms.jsx";
import CommissionReports from "./pages/CommissionReports.jsx";
import Layout from "./components/Layout.jsx";
import "@/App.css";

export { supabase };

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  useEffect(() => {
    checkUser();

    const { data: { subscription } } = authService.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        await loadUser();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setMustChangePassword(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUser = async () => {
    try {
      const userData = await authService.getCurrentUser();
      if (userData) {
        setUser(userData);
        setMustChangePassword(userData.must_change_password);
      }
    } catch (error) {
      console.error("Failed to fetch user", error);
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
            <Route path="/profile" element={<Profile user={user} />} />
            <Route path="/forms" element={<Forms user={user} />} />
            <Route path="/forms/:operatorId" element={<Forms user={user} />} />
            {user?.role === "admin" && (
              <>
                <Route path="/operators" element={<Operators user={user} />} />
                <Route path="/users" element={<Users user={user} />} />
                <Route path="/commission-reports" element={<CommissionReports user={user} />} />
              </>
            )}
            {user?.role === "bo" && (
              <Route path="/operators" element={<Operators user={user} />} />
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
