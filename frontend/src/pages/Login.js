import React, { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { API } from "../App";

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API}/auth/login`, { email, password });
      toast.success("Login bem-sucedido!");
      onLogin(response.data.token, response.data.user);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #0f0f10 0%, #1a1a1c 100%)' }}>
      <div className="w-full max-w-md">
        <div className="glass-card p-8">
          <div className="flex flex-col items-center mb-8">
            <img src="/logo.png" alt="MP Grupo" className="h-20 w-20 object-contain mb-4" />
            <h1 className="logo-text text-3xl">MP GRUPO</h1>
            <p className="text-gray-400 mt-2">CRM - Sistema de Gestão de Vendas</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2 text-gray-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                data-testid="email-input"
                className="w-full"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2 text-gray-300">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  data-testid="password-input"
                  className="w-full pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                  data-testid="toggle-password"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              data-testid="login-button"
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "A entrar..." : "Entrar"}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          © 2025 MDM Grupo. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
};

export default Login;
