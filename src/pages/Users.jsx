import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Shield, Briefcase, User as UserIcon, Edit, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usersService } from "../services/usersService";
import { partnersService } from "../services/partnersService";
import { generateStrongPassword } from "../lib/utils-crm";

const Users = ({ user }) => {
  const [users, setUsers] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [suggestedPassword, setSuggestedPassword] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
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
      const [usersData, partnersData] = await Promise.all([
        usersService.getAll(),
        partnersService.getAll()
      ]);
      setUsers(usersData);
      setPartners(partnersData);
    } catch (error) {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const generatePassword = () => {
    const password = generateStrongPassword();
    setSuggestedPassword(password);
    setFormData({ ...formData, password });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editMode) {
        await usersService.update(editingUserId, formData);
        toast.success("Utilizador atualizado com sucesso!");
      } else {
        const result = await usersService.create(formData);
        if (result.initial_password) {
          toast.success(`Utilizador criado! Password: ${result.initial_password}`, { duration: 10000 });
        } else {
          toast.success("Utilizador criado com sucesso!");
        }
      }
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.message || `Erro ao ${editMode ? 'atualizar' : 'criar'} utilizador`);
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

  const openDeleteDialog = (userToDelete) => {
    setUserToDelete(userToDelete);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!userToDelete) return;

    try {
      await usersService.delete(userToDelete.id);
      toast.success("Utilizador eliminado com sucesso!");
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      fetchData();
    } catch (error) {
      toast.error(error.message || "Erro ao eliminar utilizador");
    }
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
            <DialogHeader>
              <DialogTitle className="text-2xl">
                {editMode ? (
                  <span>Editar Utilizador: <span className="text-blue-600">{formData.name}</span></span>
                ) : (
                  'Novo Utilizador'
                )}
              </DialogTitle>
              {editMode && (
                <p className="text-sm text-gray-600 mt-1">Como administrador, pode editar todos os dados incluindo a password</p>
              )}
            </DialogHeader>
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
                      type="text"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      required={!editMode}
                      className="flex-1"
                      placeholder={editMode ? "Deixe vazio para manter a atual" : ""}
                    />
                    <Button type="button" onClick={generatePassword} variant="outline">Gerar</Button>
                  </div>
                  {suggestedPassword && (
                    <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-md mt-2 border border-green-200">
                      Password gerada: <span className="font-mono font-semibold">{suggestedPassword}</span>
                    </p>
                  )}
                  {editMode && (
                    <div className="text-xs text-blue-700 bg-blue-50 px-3 py-2 rounded-md mt-2 border border-blue-200">
                      <strong>Administrador:</strong> Pode alterar a password de qualquer utilizador. O utilizador terá que mudar a password na próxima vez que fizer login.
                    </div>
                  )}
                  {!editMode && (
                    <p className="text-xs text-gray-500 mt-1">A password será fornecida ao utilizador. Deve conter pelo menos 8 caracteres, 1 maiúscula, 1 número e 1 carácter especial.</p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" onClick={() => setDialogOpen(false)} variant="outline">Cancelar</Button>
                <Button type="submit" className="btn-primary">{editMode ? 'Atualizar' : 'Criar Utilizador'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((u) => (
          <div key={u.id} className="professional-card p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                {getRoleIcon(u.role)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">{u.name}</h3>
                <p className="text-sm text-gray-600">{getRoleLabel(u.role)}</p>
                <p className="text-xs text-gray-500 mt-1 truncate">{u.email}</p>
                <p className="text-xs text-gray-500 truncate">{u.position}</p>
              </div>
              {user?.role === 'admin' && (
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditDialog(u)}
                    title="Editar utilizador"
                    className="h-8 w-8 p-0 border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openDeleteDialog(u)}
                    title="Eliminar utilizador"
                    className="h-8 w-8 p-0 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                    disabled={u.id === user?.id}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Eliminação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza que deseja eliminar o utilizador <strong>{userToDelete?.name}</strong> ({userToDelete?.email})?
              <br /><br />
              Esta ação não pode ser revertida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Users;
