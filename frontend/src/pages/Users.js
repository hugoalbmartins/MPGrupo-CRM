import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Shield, User, Briefcase } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { API } from "../App";

const Users = ({ user }) => {
  const [users, setUsers] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "",
    position: "",
    partner_id: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, partnersRes] = await Promise.all([
        axios.get(`${API}/users`),
        axios.get(`${API}/partners`),
      ]);
      setUsers(usersRes.data);
      setPartners(partnersRes.data);
    } catch (error) {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = { ...formData };
      if (submitData.role !== 'partner') {
        delete submitData.partner_id;
      }
      await axios.post(`${API}/auth/register`, submitData);
      toast.success("Utilizador criado com sucesso!");
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao criar utilizador");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      password: "",
      role: "",
      position: "",
      partner_id: "",
    });
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-5 h-5 text-[#C9A961]" />;
      case 'bo':
        return <Briefcase className="w-5 h-5 text-blue-400" />;
      case 'partner':
        return <User className="w-5 h-5 text-green-400" />;
      default:
        return <User className="w-5 h-5" />;
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'bo':
        return 'Back Office';
      case 'partner':
        return 'Parceiro';
      default:
        return role;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#C9A961]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="users-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-4xl font-bold">Utilizadores</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={resetForm}
              data-testid="add-user-button"
              className="bg-gradient-to-r from-[#C9A961] to-[#B8944E] text-[#0f0f10]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Utilizador
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#1a1a1c] border-[#C9A961]/20 max-w-2xl pointer-events-auto">
            <DialogHeader>
              <DialogTitle className="text-[#C9A961] text-2xl">Novo Utilizador</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name" className="text-gray-300">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    data-testid="user-name-input"
                    className="bg-white/5 border-[#C9A961]/20 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="email" className="text-gray-300">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    data-testid="user-email-input"
                    className="bg-white/5 border-[#C9A961]/20 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="password" className="text-gray-300">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    data-testid="user-password-input"
                    className="bg-white/5 border-[#C9A961]/20 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="position" className="text-gray-300">Posição *</Label>
                  <Input
                    id="position"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    required
                    data-testid="user-position-input"
                    className="bg-white/5 border-[#C9A961]/20 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="role" className="text-gray-300">Função *</Label>
                  <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value, partner_id: "" })}>
                    <SelectTrigger data-testid="user-role-select" className="bg-white/5 border-[#C9A961]/20 text-white">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a1c] border-[#C9A961]/20">
                      <SelectItem value="admin" className="text-white">Administrador</SelectItem>
                      <SelectItem value="bo" className="text-white">Back Office</SelectItem>
                      <SelectItem value="partner" className="text-white">Parceiro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.role === 'partner' && (
                  <div>
                    <Label htmlFor="partner" className="text-gray-300">Parceiro *</Label>
                    <Select value={formData.partner_id} onValueChange={(value) => setFormData({ ...formData, partner_id: value })}>
                      <SelectTrigger data-testid="user-partner-select" className="bg-white/5 border-[#C9A961]/20 text-white">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1a1c] border-[#C9A961]/20">
                        {partners.map(p => (
                          <SelectItem key={p.id} value={p.id} className="text-white">{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <Button
                  type="button"
                  onClick={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}
                  variant="outline"
                  className="border-[#C9A961]/20 text-gray-300"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  data-testid="save-user-button"
                  className="bg-gradient-to-r from-[#C9A961] to-[#B8944E] text-[#0f0f10]"
                >
                  Criar Utilizador
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="glass-card p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((u) => (
            <div
              key={u.id}
              data-testid={`user-card-${u.id}`}
              className="glass-card p-6 hover:scale-105 transition-transform"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white/10">
                    {getRoleIcon(u.role)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{u.name}</h3>
                    <p className="text-sm text-gray-400">{getRoleLabel(u.role)}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <p className="text-gray-300">
                  <span className="text-gray-500">Email:</span> {u.email}
                </p>
                <p className="text-gray-300">
                  <span className="text-gray-500">Posição:</span> {u.position}
                </p>
              </div>
            </div>
          ))}
        </div>
        {users.length === 0 && (
          <p className="text-center text-gray-400 py-8">Nenhum utilizador encontrado</p>
        )}
      </div>
    </div>
  );
};

export default Users;
