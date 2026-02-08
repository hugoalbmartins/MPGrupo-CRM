import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { User as UserIcon, Lock, Eye, EyeOff, AlertCircle, Pencil, Phone, Mail, Save } from "lucide-react";
import { supabase } from "../lib/supabase";

const Profile = ({ user, onUserUpdate }) => {
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingContact, setSavingContact] = useState(false);

  const [contactData, setContactData] = useState({
    name: '',
    contact_email: '',
    contact_phone: '',
  });

  useEffect(() => {
    if (user) {
      setContactData({
        name: user.name || '',
        contact_email: user.contact_email || '',
        contact_phone: user.contact_phone || '',
      });
    }
  }, [user]);

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/.test(newPassword)) {
      toast.error("Password deve ter 8+ caracteres com 1 maiuscula, 1 digito e 1 caracter especial");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("As passwords nao coincidem");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast.success("Password alterada com sucesso!");
      setShowPasswordForm(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error(error.message || "Erro ao alterar password");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveContact = async () => {
    if (!contactData.name.trim()) {
      toast.error("O nome e obrigatorio");
      return;
    }

    setSavingContact(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: contactData.name.trim(),
          contact_email: contactData.contact_email.trim() || null,
          contact_phone: contactData.contact_phone.trim() || null,
        })
        .eq('id', user.id);

      if (error) throw error;

      toast.success("Dados atualizados com sucesso!");
      setShowContactForm(false);

      if (onUserUpdate) {
        onUserUpdate({
          ...user,
          name: contactData.name.trim(),
          contact_email: contactData.contact_email.trim(),
          contact_phone: contactData.contact_phone.trim(),
        });
      }
    } catch (error) {
      toast.error("Erro ao atualizar dados");
    } finally {
      setSavingContact(false);
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'bo': return 'Back Office';
      case 'partner': return 'Parceiro';
      case 'partner_commercial': return 'Parceiro Comercial';
      case 'gestor_nv1': return 'Gestor Nv1';
      case 'gestor_nv2': return 'Gestor Nv2';
      default: return role;
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Meu Perfil</h1>

      <div className="glass-ultra p-8">
        <div className="flex items-start gap-6">
          <div className="w-24 h-24 bg-dark-600 rounded-full flex items-center justify-center shrink-0">
            <UserIcon className="w-12 h-12 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white">{user?.name}</h2>
            <p className="text-lg text-dark-400 mt-1">{user?.position}</p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-dark-400">Email de Conta</p>
                <p className="text-white font-medium">{user?.email}</p>
              </div>
              <div>
                <p className="text-sm text-dark-400">Funcao</p>
                <p className="text-white font-medium">{getRoleLabel(user?.role)}</p>
              </div>
              {user?.contact_email && (
                <div>
                  <p className="text-sm text-dark-400">Email de Contacto</p>
                  <p className="text-white font-medium">{user.contact_email}</p>
                </div>
              )}
              {user?.contact_phone && (
                <div>
                  <p className="text-sm text-dark-400">Telefone</p>
                  <p className="text-white font-medium">{user.contact_phone}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="glass-ultra p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-dark-700 rounded-lg flex items-center justify-center">
              <Pencil className="w-5 h-5 text-gold-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Dados de Contacto</h3>
              <p className="text-sm text-dark-400">Edite o nome a apresentar, email e telefone</p>
            </div>
          </div>
          <button
            onClick={() => setShowContactForm(!showContactForm)}
            className="btn-gold"
          >
            {showContactForm ? "Cancelar" : "Editar"}
          </button>
        </div>

        {showContactForm && (
          <div className="mt-6 border-t border-dark-600 pt-6">
            <div className="space-y-4 max-w-lg">
              <div>
                <label className="block text-sm font-medium mb-2 text-dark-200">Nome a Apresentar</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                  <input
                    type="text"
                    value={contactData.name}
                    onChange={(e) => setContactData(prev => ({ ...prev, name: e.target.value }))}
                    className="glass-input w-full pl-10"
                    placeholder="O seu nome"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-dark-200">Email de Contacto</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                  <input
                    type="email"
                    value={contactData.contact_email}
                    onChange={(e) => setContactData(prev => ({ ...prev, contact_email: e.target.value }))}
                    className="glass-input w-full pl-10"
                    placeholder="email@exemplo.pt"
                  />
                </div>
                <p className="text-xs text-dark-400 mt-1">Este email aparecera nos PDFs de simulacao</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-dark-200">Telefone / Telemovel</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                  <input
                    type="tel"
                    value={contactData.contact_phone}
                    onChange={(e) => setContactData(prev => ({ ...prev, contact_phone: e.target.value }))}
                    className="glass-input w-full pl-10"
                    placeholder="+351 912 345 678"
                  />
                </div>
                <p className="text-xs text-dark-400 mt-1">Este numero aparecera nos PDFs de simulacao</p>
              </div>

              <button
                onClick={handleSaveContact}
                disabled={savingContact}
                className="btn-gold disabled:opacity-50 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {savingContact ? "A guardar..." : "Guardar Alteracoes"}
              </button>
            </div>
          </div>
        )}
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
                    <li>Minimo 8 caracteres</li>
                    <li>1 letra maiuscula</li>
                    <li>1 numero</li>
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
                {loading ? "A alterar..." : "Confirmar Alteracao"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
