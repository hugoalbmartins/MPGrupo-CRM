import React, { useState } from "react";
import { toast } from "sonner";
import { Plus, Shield, Briefcase, User as UserIcon, Edit, Trash2, KeyRound, Search, ArrowUpDown, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SkeletonTable } from "@/components/ui/skeleton-loader";
import { useQuery } from "@tanstack/react-query";
import { usersService } from "../services/usersService";
import { partnersService } from "../services/partnersService";
import { generateStrongPassword } from "../lib/utils-crm";

const Users = ({ user }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sortColumn, setSortColumn] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [suggestedPassword, setSuggestedPassword] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [userToReset, setUserToReset] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "bo",
    position: "",
    partner_id: "",
    is_commissioned: false
  });

  const { data: users = [], isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersService.getAll(),
    staleTime: 10 * 60 * 1000,
  });

  const { data: partners = [], isLoading: partnersLoading } = useQuery({
    queryKey: ['partners'],
    queryFn: () => partnersService.getAll(),
    staleTime: 10 * 60 * 1000,
  });

  const loading = usersLoading || partnersLoading;

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
      refetchUsers();
    } catch (error) {
      toast.error(error.message || `Erro ao ${editMode ? 'atualizar' : 'criar'} utilizador`);
    }
  };

  const resetForm = () => {
    setFormData({ name: "", email: "", password: "", role: "bo", position: "", partner_id: "", is_commissioned: false });
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
      partner_id: userToEdit.partner_id || "",
      is_commissioned: userToEdit.is_commissioned || false
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
      refetchUsers();
    } catch (error) {
      toast.error(error.message || "Erro ao eliminar utilizador");
    }
  };

  const openResetPasswordDialog = (userToReset) => {
    setUserToReset(userToReset);
    const generatedPassword = generateStrongPassword();
    setNewPassword(generatedPassword);
    setResetPasswordDialogOpen(true);
  };

  const handleResetPassword = async () => {
    if (!userToReset || !newPassword) return;

    try {
      await usersService.resetPassword(userToReset.id, newPassword);
      toast.success(`Password resetada! Nova password: ${newPassword}`, { duration: 10000 });
      setResetPasswordDialogOpen(false);
      setUserToReset(null);
      setNewPassword("");
    } catch (error) {
      toast.error(error.message || "Erro ao resetar password");
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin': return <Shield className="w-5 h-5 text-blue-600" />;
      case 'bo': return <Briefcase className="w-5 h-5 text-green-600" />;
      case 'gestor_nv1': return <Briefcase className="w-5 h-5 text-cyan-600" />;
      case 'gestor_nv2': return <Briefcase className="w-5 h-5 text-teal-600" />;
      case 'partner': return <UserIcon className="w-5 h-5 text-purple-600" />;
      case 'partner_commercial': return <UserIcon className="w-5 h-5 text-orange-600" />;
      default: return <UserIcon className="w-5 h-5" />;
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'bo': return 'Back Office';
      case 'gestor_nv1': return 'Gestor Nível 1';
      case 'gestor_nv2': return 'Gestor Nível 2';
      case 'partner': return 'Parceiro';
      case 'partner_commercial': return 'Parceiro Comercial';
      default: return role;
    }
  };

  const getPartnerTypeLabel = (partnerType) => {
    switch (partnerType) {
      case 'D2D': return 'D2D';
      case 'Rev': return 'REV';
      case 'Rev+': return 'REV+';
      case 'Rev1': return 'REV1';
      case 'Rev2': return 'REV2';
      case 'Rev3': return 'REV3';
      default: return partnerType;
    }
  };

  const getDisplayPosition = (userObj) => {
    if ((userObj.role === 'partner' || userObj.role === 'partner_commercial') && userObj.partner?.partner_type) {
      return `Parceiro ${getPartnerTypeLabel(userObj.partner.partner_type)}`;
    }
    return userObj.position;
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (column) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-4 h-4 inline ml-1 text-gray-400" />;
    }
    return sortDirection === "asc" ?
      <ArrowUp className="w-4 h-4 inline ml-1 text-blue-600" /> :
      <ArrowDown className="w-4 h-4 inline ml-1 text-blue-600" />;
  };

  const filteredAndSortedUsers = users
    .filter(u => {
      const displayPosition = getDisplayPosition(u);
      const matchesSearch =
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        displayPosition.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      return matchesSearch && matchesRole;
    })
    .sort((a, b) => {
      let aValue, bValue;

      switch (sortColumn) {
        case "name":
          aValue = a.name;
          bValue = b.name;
          break;
        case "email":
          aValue = a.email;
          bValue = b.email;
          break;
        case "position":
          aValue = getDisplayPosition(a);
          bValue = getDisplayPosition(b);
          break;
        case "role":
          aValue = a.role;
          bValue = b.role;
          break;
        default:
          return 0;
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        const comparison = aValue.localeCompare(bValue);
        return sortDirection === "asc" ? comparison : -comparison;
      }

      return sortDirection === "asc" ?
        (aValue > bValue ? 1 : -1) :
        (aValue < bValue ? 1 : -1);
    });

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <div className="h-8 bg-slate-200 rounded-lg w-48 animate-pulse"></div>
        </div>
        <SkeletonTable rows={8} columns={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold" style={{ color: '#000000' }}>Utilizadores</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); generatePassword(); }} className="btn-gold shadow-gold-glow spring-transition"><Plus className="w-4 h-4 mr-2" />Novo Utilizador</Button>
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
                      <SelectItem value="gestor_nv1">Gestor Nível 1</SelectItem>
                      <SelectItem value="gestor_nv2">Gestor Nível 2</SelectItem>
                      <SelectItem value="partner">Parceiro</SelectItem>
                      <SelectItem value="partner_commercial">Parceiro Comercial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.role === 'admin' && (
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="is_commissioned"
                      checked={formData.is_commissioned}
                      onChange={(e) => setFormData({...formData, is_commissioned: e.target.checked})}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <Label htmlFor="is_commissioned" className="cursor-pointer">
                      Administrador Comissionado
                      <span className="block text-xs text-gray-500 font-normal">
                        Pode registar vendas e recebe comissões (valores REV)
                      </span>
                    </Label>
                  </div>
                )}
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

      <div className="glass-ultra p-6 spring-transition">
        <div className="mb-6 flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[250px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#7a7a7a' }} />
            <Input
              type="text"
              placeholder="Pesquisar por nome, email ou posição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-modern pl-10"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="select-modern w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as funções</SelectItem>
              <SelectItem value="admin">Administrador</SelectItem>
              <SelectItem value="bo">Back Office</SelectItem>
              <SelectItem value="gestor_nv1">Gestor Nível 1</SelectItem>
              <SelectItem value="gestor_nv2">Gestor Nível 2</SelectItem>
              <SelectItem value="partner">Parceiro</SelectItem>
              <SelectItem value="partner_commercial">Parceiro Comercial</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort("name")} className="cursor-pointer hover:bg-gray-50">
                  Nome{getSortIcon("name")}
                </th>
                <th onClick={() => handleSort("email")} className="cursor-pointer hover:bg-gray-50">
                  Email{getSortIcon("email")}
                </th>
                <th onClick={() => handleSort("position")} className="cursor-pointer hover:bg-gray-50">
                  Posição{getSortIcon("position")}
                </th>
                <th onClick={() => handleSort("role")} className="cursor-pointer hover:bg-gray-50">
                  Função{getSortIcon("role")}
                </th>
                {user?.role === 'admin' && <th className="text-center">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedUsers.length === 0 ? (
                <tr>
                  <td colSpan={user?.role === 'admin' ? 5 : 4} className="text-center py-8 text-gray-400">
                    Nenhum utilizador encontrado
                  </td>
                </tr>
              ) : (
                filteredAndSortedUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                          {getRoleIcon(u.role)}
                        </div>
                        <span className="font-medium">{u.name}</span>
                      </div>
                    </td>
                    <td className="text-gray-600">{u.email}</td>
                    <td className="text-gray-600">{getDisplayPosition(u)}</td>
                    <td>
                      <span className="status-badge" style={{
                        background: u.role === 'admin' ? '#EFF6FF' : u.role === 'bo' ? '#F0FDF4' : u.role === 'partner' ? '#FDF4FF' : '#F3F4F6',
                        color: u.role === 'admin' ? '#1E40AF' : u.role === 'bo' ? '#166534' : u.role === 'partner' ? '#86198F' : '#374151'
                      }}>
                        {getRoleLabel(u.role)}
                      </span>
                    </td>
                    {user?.role === 'admin' && (
                      <td className="text-center">
                        <div className="flex gap-2 justify-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditDialog(u)}
                            title="Editar utilizador"
                            className="text-blue-600 hover:bg-blue-50"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openResetPasswordDialog(u)}
                            title="Resetar password"
                            className="text-orange-600 hover:bg-orange-50"
                          >
                            <KeyRound className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openDeleteDialog(u)}
                            title="Eliminar utilizador"
                            className="text-red-600 hover:bg-red-50"
                            disabled={u.id === user?.id}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AlertDialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resetar Password</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <div>
                Vai resetar a password do utilizador <strong>{userToReset?.name}</strong> ({userToReset?.email}).
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                <Label className="text-sm font-semibold text-orange-900">Nova Password</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="flex-1 font-mono"
                  />
                  <Button
                    type="button"
                    onClick={() => setNewPassword(generateStrongPassword())}
                    variant="outline"
                    size="sm"
                  >
                    Gerar
                  </Button>
                </div>
                <p className="text-xs text-orange-700 mt-2">
                  <strong>Importante:</strong> Copie esta password e forneça-a ao utilizador. O utilizador terá que mudar a password no próximo login.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setUserToReset(null); setNewPassword(""); }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleResetPassword} className="bg-orange-600 hover:bg-orange-700">
              Resetar Password
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
