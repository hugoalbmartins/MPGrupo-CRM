import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Shield, Briefcase, User as UserIcon, Edit } from "lucide-react";
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
  const [editMode, setEditMode] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [suggestedPassword, setSuggestedPassword] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "bo",
    position: "",
    partner_id: ""
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, partnersRes] = await Promise.all([
        axios.get(`${API}/users`),
        axios.get(`${API}/partners`)
      ]);
      setUsers(usersRes.data);
      setPartners(partnersRes.data);
    } catch (error) {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const generatePassword = async () => {
    try {
      const response = await axios.get(`${API}/auth/generate-password`);
      setSuggestedPassword(response.data.password);
      setFormData({ ...formData, password: response.data.password });
    } catch (error) {
      toast.error("Erro ao gerar password");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editMode) {
        await axios.put(`${API}/users/${editingUserId}`, formData);
        toast.success("Utilizador atualizado com sucesso!");
      } else {
        await axios.post(`${API}/auth/register`, formData);
        toast.success(`Utilizador criado! Password: ${formData.password}`, { duration: 10000 });
      }
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || `Erro ao ${editMode ? 'atualizar' : 'criar'} utilizador`);
    }
  };

  const resetForm = () => {
    setFormData({ name: "", email: "", password: "", role: "bo", position: "", partner_id: "" });
    setSuggestedPassword("");
    setEditMode(false);
    setEditingUserId(null);
  };

  const openEditDialog = (userToEdit) => {
    setEditMode(true);
    setEditingUserId(userToEdit.id);
    setFormData({
      name: userToEdit.name,
      email: userToEdit.email,
      password: "",
      role: userToEdit.role,
      position: userToEdit.position,
      partner_id: userToEdit.partner_id || ""
    });
    setDialogOpen(true);
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin': return <Shield className="w-5 h-5 text-blue-600" />;
      case 'bo': return <Briefcase className="w-5 h-5 text-green-600" />;
      case 'partner': return <UserIcon className="w-5 h-5 text-purple-600" />;
      case 'partner_commercial': return <UserIcon className="w-5 h-5 text-orange-600" />;
      default: return <UserIcon className="w-5 h-5" />;
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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Utilizadores</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); generatePassword(); }} className="btn-primary"><Plus className="w-4 h-4 mr-2" />Novo Utilizador</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle className="text-2xl">{editMode ? 'Editar Utilizador' : 'Novo Utilizador'}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nome *</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                </div>
                <div>
                  <Label>Email *</Label>
                  <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
                </div>
                <div>
                  <Label>Posição *</Label>
                  <Input value={formData.position} onChange={(e) => setFormData({...formData, position: e.target.value})} required />
                </div>
                <div>
                  <Label>Função *</Label>
                  <Select value={formData.role} onValueChange={(v) => setFormData({...formData, role: v, partner_id: ""})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="bo">Back Office</SelectItem>
                      <SelectItem value="partner">Parceiro</SelectItem>
                      <SelectItem value="partner_commercial">Parceiro Comercial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(formData.role === 'partner' || formData.role === 'partner_commercial') && (
                  <div>
                    <Label>Parceiro *</Label>
                    <Select value={formData.partner_id} onValueChange={(v) => setFormData({...formData, partner_id: v})}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {partners.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="col-span-2">
                  <Label>Password {editMode ? '(deixar vazio para não alterar)' : '*'}</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={formData.password} 
                      onChange={(e) => setFormData({...formData, password: e.target.value})} 
                      required={!editMode}
                      className="flex-1" 
                    />
                    <Button type="button" onClick={generatePassword} variant="outline">Gerar</Button>
                  </div>
                  {suggestedPassword && (
                    <p className="text-sm text-gray-600 mt-1">Password gerada: <span className="font-mono font-semibold">{suggestedPassword}</span></p>
                  )}
                  {editMode && (
                    <p className="text-xs text-gray-500 mt-1">Se alterar a password, o utilizador terá que mudar na próxima vez que fizer login</p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" onClick={() => setDialogOpen(false)} variant="outline">Cancelar</Button>
                <Button type="submit" className="btn-primary">Criar Utilizador</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((u) => (
          <div key={u.id} className="professional-card p-6">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                {getRoleIcon(u.role)}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{u.name}</h3>
                <p className="text-sm text-gray-600">{getRoleLabel(u.role)}</p>
                <p className="text-xs text-gray-500 mt-1">{u.email}</p>
                <p className="text-xs text-gray-500">{u.position}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Users;
