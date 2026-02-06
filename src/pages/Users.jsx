import React, { useState } from "react";
import { toast } from "sonner";
import { Plus, Shield, Briefcase, User as UserIcon, Edit, Trash2, KeyRound, Search, ArrowUpDown, ArrowUp, ArrowDown, Loader2, AlertCircle } from "lucide-react";
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

  const { data: users = [], isLoading: usersLoading, error: usersError, refetch: refetchUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersService.getAll(),
    staleTime: 10 * 60 * 1000,
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const { data: partners = [], isLoading: partnersLoading, error: partnersError } = useQuery({
    queryKey: ['partners'],
    queryFn: () => partnersService.getAll(),
    staleTime: 10 * 60 * 1000,
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const loading = usersLoading || partnersLoading;
  const hasError = usersError || partnersError;

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
      case 'admin': return <Shield className="w-5 h-5 text-blue-400" />;
      case 'bo': return <Briefcase className="w-5 h-5 text-green-400" />;
      case 'gestor_nv1': return <Briefcase className="w-5 h-5 text-cyan-400" />;
      case 'gestor_nv2': return <Briefcase className="w-5 h-5 text-teal-400" />;
      case 'partner': return <UserIcon className="w-5 h-5 text-purple-400" />;
      case 'partner_commercial': return <UserIcon className="w-5 h-5 text-orange-400" />;
      default: return <UserIcon className="w-5 h-5 text-dark-400" />;
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'bo': return 'Back Office';
      case 'gestor_nv1': return 'Gestor Nivel 1';
      case 'gestor_nv2': return 'Gestor Nivel 2';
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
      return <ArrowUpDown className="w-4 h-4 inline ml-1 text-dark-400" />;
    }
    return sortDirection === "asc" ?
      <ArrowUp className="w-4 h-4 inline ml-1 text-blue-400" /> :
      <ArrowDown className="w-4 h-4 inline ml-1 text-blue-400" />;
  };

  const getRoleBadgeClasses = (role) => {
    switch (role) {
      case 'admin': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'bo': return 'bg-green-500/10 text-green-400 border border-green-500/20';
      case 'partner': return 'bg-gold-400/10 text-gold-400 border border-gold-400/20';
      case 'partner_commercial': return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
      default: return 'bg-dark-700/80 text-dark-200 border border-dark-600';
    }
  };

  const filteredAndSortedUsers = users
    .filter(u => {
      const displayPosition = getDisplayPosition(u);
      const matchesSearch =
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.user_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        displayPosition.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      return matchesSearch && matchesRole;
    })
    .sort((a, b) => {
      let aValue, bValue;

      switch (sortColumn) {
        case "user_code":
          aValue = a.user_code || '';
          bValue = b.user_code || '';
          break;
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
          <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
          <div className="h-8 bg-dark-700 rounded-lg w-48 animate-pulse"></div>
        </div>
        <SkeletonTable rows={8} columns={6} />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="space-y-6 p-6 animate-fade-in">
        <h1 className="text-2xl font-bold text-white">Utilizadores</h1>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-red-400 mb-2">Erro ao carregar utilizadores</h3>
          <p className="text-sm text-red-400 mb-4">
            {usersError?.message || partnersError?.message || 'Nao foi possivel conectar ao servidor. Verifique sua conexao.'}
          </p>
          <Button onClick={() => { refetchUsers(); }} className="btn-gold">
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Utilizadores</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); generatePassword(); }} className="btn-gold shadow-gold-glow spring-transition"><Plus className="w-4 h-4 mr-2" />Novo Utilizador</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl glass-ultra">
            <DialogHeader>
              <DialogTitle className="text-2xl text-white">
                {editMode ? (
                  <span>Editar Utilizador: <span className="text-blue-400">{formData.name}</span></span>
                ) : (
                  'Novo Utilizador'
                )}
              </DialogTitle>
              {editMode && (
                <p className="text-sm text-dark-400 mt-1">Como administrador, pode editar todos os dados incluindo a password</p>
              )}
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-dark-200">Nome *</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required className="glass-input" />
                </div>
                <div>
                  <Label className="text-dark-200">Email *</Label>
                  <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required className="glass-input" />
                </div>
                <div>
                  <Label className="text-dark-200">Posicao *</Label>
                  <Input value={formData.position} onChange={(e) => setFormData({...formData, position: e.target.value})} required className="glass-input" />
                </div>
                <div>
                  <Label className="text-dark-200">Funcao *</Label>
                  <Select value={formData.role} onValueChange={(v) => setFormData({...formData, role: v, partner_id: ""})}>
                    <SelectTrigger className="glass-input"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="bo">Back Office</SelectItem>
                      <SelectItem value="gestor_nv1">Gestor Nivel 1</SelectItem>
                      <SelectItem value="gestor_nv2">Gestor Nivel 2</SelectItem>
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
                      className="w-4 h-4 text-blue-400 border-dark-600 rounded focus:ring-blue-500 bg-dark-700"
                    />
                    <Label htmlFor="is_commissioned" className="cursor-pointer text-dark-200">
                      Administrador Comissionado
                      <span className="block text-xs text-dark-400 font-normal">
                        Pode registar vendas e recebe comissoes (valores REV)
                      </span>
                    </Label>
                  </div>
                )}
                {(formData.role === 'partner' || formData.role === 'partner_commercial') && (
                  <div>
                    <Label className="text-dark-200">Parceiro *</Label>
                    <Select value={formData.partner_id} onValueChange={(v) => setFormData({...formData, partner_id: v})}>
                      <SelectTrigger className="glass-input"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {partners.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="col-span-2">
                  <Label className="text-dark-200">Password {editMode ? '(deixar vazio para nao alterar)' : '*'}</Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      required={!editMode}
                      className="flex-1 glass-input"
                      placeholder={editMode ? "Deixe vazio para manter a atual" : ""}
                    />
                    <Button type="button" onClick={generatePassword} variant="outline">Gerar</Button>
                  </div>
                  {suggestedPassword && (
                    <p className="text-sm text-green-400 bg-dark-800 px-3 py-2 rounded-md mt-2 border border-dark-600">
                      Password gerada: <span className="font-mono font-semibold">{suggestedPassword}</span>
                    </p>
                  )}
                  {editMode && (
                    <div className="text-xs text-blue-400 bg-dark-800 px-3 py-2 rounded-md mt-2 border border-dark-600">
                      <strong>Administrador:</strong> Pode alterar a password de qualquer utilizador. O utilizador tera que mudar a password na proxima vez que fizer login.
                    </div>
                  )}
                  {!editMode && (
                    <p className="text-xs text-dark-400 mt-1">A password sera fornecida ao utilizador. Deve conter pelo menos 8 caracteres, 1 maiuscula, 1 numero e 1 caracter especial.</p>
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
            <Input
              type="text"
              placeholder="Pesquisar por nome, email ou posicao..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="glass-input pl-10"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="glass-input w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as funcoes</SelectItem>
              <SelectItem value="admin">Administrador</SelectItem>
              <SelectItem value="bo">Back Office</SelectItem>
              <SelectItem value="gestor_nv1">Gestor Nivel 1</SelectItem>
              <SelectItem value="gestor_nv2">Gestor Nivel 2</SelectItem>
              <SelectItem value="partner">Parceiro</SelectItem>
              <SelectItem value="partner_commercial">Parceiro Comercial</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort("user_code")} className="cursor-pointer">
                  Codigo{getSortIcon("user_code")}
                </th>
                <th onClick={() => handleSort("name")} className="cursor-pointer">
                  Nome{getSortIcon("name")}
                </th>
                <th onClick={() => handleSort("email")} className="cursor-pointer">
                  Email{getSortIcon("email")}
                </th>
                <th onClick={() => handleSort("position")} className="cursor-pointer">
                  Posicao{getSortIcon("position")}
                </th>
                <th onClick={() => handleSort("role")} className="cursor-pointer">
                  Funcao{getSortIcon("role")}
                </th>
                {user?.role === 'admin' && <th className="text-center">Acoes</th>}
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedUsers.length === 0 ? (
                <tr>
                  <td colSpan={user?.role === 'admin' ? 6 : 5} className="text-center py-8 text-dark-400">
                    Nenhum utilizador encontrado
                  </td>
                </tr>
              ) : (
                filteredAndSortedUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      {u.user_code ? (
                        <span className="font-mono text-sm font-semibold text-blue-400 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20">
                          {u.user_code}
                        </span>
                      ) : (
                        <span className="text-dark-400 text-sm">-</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-dark-600 rounded-full flex items-center justify-center flex-shrink-0">
                          {getRoleIcon(u.role)}
                        </div>
                        <span className="font-medium text-white">{u.name}</span>
                      </div>
                    </td>
                    <td className="text-dark-300">{u.email}</td>
                    <td className="text-dark-300">{getDisplayPosition(u)}</td>
                    <td>
                      <span className={`status-badge ${getRoleBadgeClasses(u.role)}`}>
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
                            className="text-blue-400 hover:bg-blue-500/10"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openResetPasswordDialog(u)}
                            title="Resetar password"
                            className="text-orange-400 hover:bg-orange-500/10"
                          >
                            <KeyRound className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openDeleteDialog(u)}
                            title="Eliminar utilizador"
                            className="text-red-400 hover:bg-red-500/10"
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
        <AlertDialogContent className="glass-ultra">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Resetar Password</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <div className="text-dark-300">
                Vai resetar a password do utilizador <strong className="text-white">{userToReset?.name}</strong> ({userToReset?.email}).
              </div>
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-md p-3">
                <Label className="text-sm font-semibold text-orange-400">Nova Password</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="flex-1 font-mono glass-input"
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
                <p className="text-xs text-orange-400 mt-2">
                  <strong>Importante:</strong> Copie esta password e forneca-a ao utilizador. O utilizador tera que mudar a password no proximo login.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setUserToReset(null); setNewPassword(""); }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleResetPassword} className="bg-gold-400 text-dark-900 hover:bg-gold-500">
              Resetar Password
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="glass-ultra">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Confirmar Eliminacao</AlertDialogTitle>
            <AlertDialogDescription className="text-dark-300">
              Tem a certeza que deseja eliminar o utilizador <strong className="text-white">{userToDelete?.name}</strong> ({userToDelete?.email})?
              <br /><br />
              Esta acao nao pode ser revertida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Users;
