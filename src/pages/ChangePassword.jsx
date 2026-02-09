import React, { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, AlertCircle } from "lucide-react";
import { authService } from "../lib/auth";

const ChangePassword = ({ onPasswordChanged, onLogout }) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
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
      await authService.updatePassword(newPassword);

      const { data: { user } } = await authService.supabase.auth.getUser();
      await authService.supabase
        .from('users')
        .update({ must_change_password: false })
        .eq('id', user.id);

      toast.success("Password alterada com sucesso!");
      onPasswordChanged();
    } catch (error) {
      console.error("Password change error:", error);
      toast.error(error.message || "Erro ao alterar password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="bg-dark-850 border border-white/[0.06] rounded-xl p-8 transition-all">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-cyber-500 to-cyber-600 rounded-full flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(6,182,212,0.3)] animate-scale-in">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Alterar Password</h1>
            <p className="mt-2 text-center text-sm font-medium text-slate-400">Por segurança, é necessário alterar a sua password</p>
          </div>

          <div className="bg-dark-900 border border-dark-700 rounded-lg p-4 mb-6 animate-slide-up">
            <div className="flex">
              <AlertCircle className="w-5 h-5 text-cyber-400 mr-2 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-cyber-400">
                <p className="font-bold mb-1">Requisitos:</p>
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
              <label htmlFor="current" className="block text-sm font-bold mb-2 text-slate-300">Password Atual</label>
              <div className="relative">
                <input id="current" type={showCurrent ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2.5 pr-12 text-white focus:border-cyber-500 focus:ring-1 focus:ring-cyber-500/20 outline-none transition-all" />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-all">
                  {showCurrent ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="new" className="block text-sm font-bold mb-2 text-slate-300">Nova Password</label>
              <div className="relative">
                <input id="new" type={showNew ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2.5 pr-12 text-white focus:border-cyber-500 focus:ring-1 focus:ring-cyber-500/20 outline-none transition-all" />
                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-all">
                  {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm" className="block text-sm font-bold mb-2 text-slate-300">Confirmar Nova Password</label>
              <div className="relative">
                <input id="confirm" type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2.5 pr-12 text-white focus:border-cyber-500 focus:ring-1 focus:ring-cyber-500/20 outline-none transition-all" />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-all">
                  {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button type="button" onClick={onLogout} className="flex-1 bg-dark-900 border border-dark-700 text-slate-300 px-4 py-2 rounded-lg font-semibold hover:border-cyber-500/30 hover:text-white transition-all">Cancelar</button>
              <button type="submit" disabled={loading} className="flex-1 bg-gradient-to-r from-cyber-500 to-cyber-600 text-white px-4 py-2 rounded-lg font-semibold shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:from-cyber-400 hover:to-cyber-500 transition-all disabled:opacity-50">
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
