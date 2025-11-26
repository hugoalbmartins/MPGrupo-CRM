import React, { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, AlertCircle } from "lucide-react";
import { API } from "../App";

const ChangePassword = ({ onPasswordChanged, onLogout }) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const validatePassword = (pwd) => {
    return /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/.test(pwd);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validatePassword(newPassword)) {
      toast.error("Password deve ter 8+ caracteres com 1 maiúscula, 1 dígito e 1 caracter especial");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("As passwords não coincidem");
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${API}/auth/change-password`, {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      toast.success("Password alterada com sucesso!");
      onPasswordChanged();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao alterar password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md">
        <div className="professional-card p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Alterar Password</h1>
            <p className="text-gray-600 mt-2 text-center text-sm">
              Por segurança, é necessário alterar a sua password
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-semibold mb-1">Requisitos da password:</p>
                <ul className="list-disc ml-4 space-y-1">
                  <li>Mínimo 8 caracteres</li>
                  <li>1 letra maiúscula</li>
                  <li>1 número</li>
                  <li>1 caracter especial (!@#$%^&*)</li>
                </ul>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="current" className="block text-sm font-medium mb-2 text-gray-700">
                Password Atual
              </label>
              <div className="relative">
                <input
                  id="current"
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="w-full pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showCurrent ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="new" className="block text-sm font-medium mb-2 text-gray-700">
                Nova Password
              </label>
              <div className="relative">
                <input
                  id="new"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm" className="block text-sm font-medium mb-2 text-gray-700">
                Confirmar Nova Password
              </label>
              <div className="relative">
                <input
                  id="confirm"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onLogout}
                className="flex-1 btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 btn-primary disabled:opacity-50"
              >
                {loading ? "A alterar..." : "Alterar Password"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;
