import React, { useState } from "react";
import { toast } from "sonner";
import { User as UserIcon, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { authService } from "../lib/auth";

const Profile = ({ user }) => {
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/.test(newPassword)) {
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
      setShowPasswordForm(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao alterar password");
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'bo': return 'Back Office';
      case 'partner': return 'Parceiro';
      case 'partner_commercial': return 'Parceiro Comercial';
      default: return role;
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Meu Perfil</h1>

      <div className="glass-ultra p-8">
        <div className="flex items-start gap-6">
          <div className="w-24 h-24 bg-dark-600 rounded-full flex items-center justify-center">
            <UserIcon className="w-12 h-12 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white">{user?.name}</h2>
            <p className="text-lg text-dark-400 mt-1">{user?.position}</p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-dark-400">Email</p>
                <p className="text-white font-medium">{user?.email}</p>
              </div>
              <div>
                <p className="text-sm text-dark-400">Função</p>
                <p className="text-white font-medium">{getRoleLabel(user?.role)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-ultra p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-dark-700 rounded-lg flex items-center justify-center">
              <Lock className="w-5 h-5 text-gold-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Alterar Password</h3>
              <p className="text-sm text-dark-400">Mantenha a sua conta segura</p>
            </div>
          </div>
          <button
            onClick={() => setShowPasswordForm(!showPasswordForm)}
            className="btn-gold"
          >
            {showPasswordForm ? "Cancelar" : "Alterar Password"}
          </button>
        </div>

        {showPasswordForm && (
          <div className="mt-6 border-t border-dark-600 pt-6">
            <div className="bg-dark-800 border border-dark-600 rounded-lg p-4 mb-6">
              <div className="flex">
                <AlertCircle className="w-5 h-5 text-gold-400 mr-2 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-gold-400">
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

            <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
              <div>
                <label className="block text-sm font-medium mb-2 text-dark-200">Password Atual</label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="glass-input w-full pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white"
                  >
                    {showCurrent ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-dark-200">Nova Password</label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="glass-input w-full pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white"
                  >
                    {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-dark-200">Confirmar Nova Password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="glass-input w-full pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white"
                  >
                    {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-gold disabled:opacity-50"
              >
                {loading ? "A alterar..." : "Confirmar Alteração"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
