import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import { Toaster } from "@/components/ui/sonner";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import Dashboard from "./pages/Dashboard";
import Partners from "./pages/Partners";
import Sales from "./pages/Sales";
import Operators from "./pages/Operators";
import Users from "./pages/Users";
import Profile from "./pages/Profile";
import Alerts from "./pages/Alerts";
import Forms from "./pages/Forms";
import Layout from "./components/Layout";
import "@/App.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export { API };

function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      fetchUser();
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
      setMustChangePassword(response.data.must_change_password);
    } catch (error) {
      console.error("Failed to fetch user", error);
      handleLogout();
    }
  };

  const handleLogin = (newToken, userData, mustChange) => {
    setToken(newToken);
    setUser(userData);
    setMustChangePassword(mustChange);
    localStorage.setItem("token", newToken);
    axios.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setMustChangePassword(false);
    localStorage.removeItem("token");
    delete axios.defaults.headers.common["Authorization"];
  };

  const handlePasswordChanged = () => {
    setMustChangePassword(false);
  };

  if (!token) {
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
            {user?.role === "admin" && (
              <>
                <Route path="/operators" element={<Operators user={user} />} />
                <Route path="/users" element={<Users user={user} />} />
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
