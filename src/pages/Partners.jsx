import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Search, Upload, File, Download, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Loader2, Building2, ShoppingCart } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SkeletonTable } from "@/components/ui/skeleton-loader";
import { useQuery } from "@tanstack/react-query";
import { partnersService } from "../services/partnersService";
import { usersService } from "../services/usersService";
import { validateNIF, generateStrongPassword } from "../lib/utils-crm";

const Partners = ({ user }) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortColumn, setSortColumn] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [documentsDialogOpen, setDocumentsDialogOpen] = useState(false);
  const [selectedPartnerForDocs, setSelectedPartnerForDocs] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [d2dLevels, setD2dLevels] = useState([]);
  const [loadingLevels, setLoadingLevels] = useState(false);
  const [formData, setFormData] = useState({
    partner_type: "D2D",
    name: "",
    email: "",
    communication_emails: [""],
    phone: "",
    contact_person: "",
    street: "",
    door_number: "",
    postal_code: "",
    locality: "",
    nif: "",
    crc: "",
    iban: "",
    manager_id: "",
  });

  const { data: partners = [], isLoading: partnersLoading, refetch: refetchPartners } = useQuery({
    queryKey: ['partners'],
    queryFn: () => partnersService.getAll(),
    staleTime: 10 * 60 * 1000,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersService.getAll(),
    staleTime: 10 * 60 * 1000,
  });

  const { data: operatorsWithD2D = [] } = useQuery({
    queryKey: ['operators-d2d-configs'],
    queryFn: () => partnersService.getOperatorsWithD2DConfigs(),
    staleTime: 10 * 60 * 1000,
  });

  const managers = allUsers.filter(u => u.role === 'gestor_nv1' || u.role === 'gestor_nv2');
  const loading = partnersLoading;

  const generatePassword = () => {
    const password = generateStrongPassword();
    setGeneratedPassword(password);
  };

  useEffect(() => {
    if (formData.email && !editingPartner) {
      generatePassword();
    }
  }, [formData.email]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const nifValidation = validateNIF(formData.nif);
    if (!nifValidation.valid) {
      toast.error(nifValidation.message);
      return;
    }

    if (formData.nif.startsWith('5') && !formData.crc) {
      toast.error("Código CRC é obrigatório para NIF iniciado por 5");
      return;
    }

    try {
      const submitData = { ...formData };
      submitData.communication_emails = formData.communication_emails.filter(e => e.trim());

      if (editingPartner) {
        await partnersService.update(editingPartner.id, submitData);
        if (editingPartner.partner_type === 'D2D') {
          await partnersService.saveD2DLevels(editingPartner.id, d2dLevels);
        }
        toast.success("Parceiro atualizado com sucesso!");
      } else {
        const result = await partnersService.create(submitData);
        if (result.initial_password) {
          toast.success(
            `Parceiro criado! Password: ${result.initial_password}`,
            { duration: 10000 }
          );
        } else {
          toast.success("Parceiro criado com sucesso!");
        }
      }

      setDialogOpen(false);
      resetForm();
      refetchPartners();
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      const errorMessage = error.message || error.toString() || "Erro desconhecido ao salvar parceiro";
      toast.error(errorMessage, { duration: 5000 });
    }
  };

  const handleEdit = async (partner) => {
    setEditingPartner(partner);
    setFormData({
      partner_type: partner.partner_type,
      name: partner.name,
      email: partner.email,
      communication_emails: partner.communication_emails.length > 0 ? partner.communication_emails : [""],
      manager_id: partner.manager_id || "",
      phone: partner.phone,
      contact_person: partner.contact_person,
      street: partner.street,
      door_number: partner.door_number,
      postal_code: partner.postal_code,
      locality: partner.locality,
      nif: partner.nif,
      crc: partner.crc || "",
      iban: partner.iban || "",
    });
    setDialogOpen(true);

    if (partner.partner_type === 'D2D') {
      setLoadingLevels(true);
      try {
        const levels = await partnersService.getD2DLevels(partner.id);
        setD2dLevels(levels.map(l => ({
          operator_id: l.operator_id,
          d2d_level: l.d2d_level,
        })));
      } catch (err) {
        console.error('Failed to load D2D levels:', err);
        setD2dLevels([]);
      } finally {
        setLoadingLevels(false);
      }
    } else {
      setD2dLevels([]);
    }
  };

  const handleDelete = async (partnerId, partnerName) => {
    if (!window.confirm(`Tem a certeza que deseja eliminar o parceiro "${partnerName}"? Esta ação não pode ser revertida.`)) {
      return;
    }

    try {
      await partnersService.delete(partnerId);
      toast.success("Parceiro eliminado com sucesso");
      refetchPartners();
    } catch (error) {
      toast.error("Erro ao eliminar parceiro. Pode existir vendas associadas.");
    }
  };

  const handleUploadDocument = async (partnerId, file) => {
    try {
      setUploadingDoc(true);
      toast.success("Documento carregado com sucesso!");
      refetchPartners();
    } catch (error) {
      toast.error("Erro ao carregar documento");
    } finally {
      setUploadingDoc(false);
    }
  };

  const openDocumentsDialog = (partner) => {
    setSelectedPartnerForDocs(partner);
    setDocumentsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingPartner(null);
    setGeneratedPassword("");
    setD2dLevels([]);
    setFormData({
      partner_type: "D2D",
      name: "",
      email: "",
      communication_emails: [""],
      phone: "",
      contact_person: "",
      street: "",
      door_number: "",
      postal_code: "",
      locality: "",
      nif: "",
      crc: "",
      manager_id: "",
      iban: "",
    });
  };

  const addEmailField = () => {
    setFormData({ ...formData, communication_emails: [...formData.communication_emails, ""] });
  };

  const updateEmail = (index, value) => {
    const newEmails = [...formData.communication_emails];
    newEmails[index] = value;
    setFormData({ ...formData, communication_emails: newEmails });
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

  const filteredAndSortedPartners = partners
    .filter(p => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.partner_code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === "all" || p.partner_type === typeFilter;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      let aValue, bValue;

      switch (sortColumn) {
        case "code":
          aValue = a.partner_code;
          bValue = b.partner_code;
          break;
        case "name":
          aValue = a.name;
          bValue = b.name;
          break;
        case "type":
          aValue = a.partner_type;
          bValue = b.partner_type;
          break;
        case "email":
          aValue = a.email;
          bValue = b.email;
          break;
        case "phone":
          aValue = a.phone;
          bValue = b.phone;
          break;
        case "contact":
          aValue = a.contact_person;
          bValue = b.contact_person;
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
        <SkeletonTable rows={8} columns={7} />
      </div>
    );
  }

  const handleExportExcel = async () => {
    try {
      if (partners.length === 0) {
        toast.error("Nenhum parceiro encontrado para exportar");
        return;
      }

      const excelData = partners.map(partner => ({
        'Código': partner.partner_code,
        'Tipo': partner.partner_type,
        'Nome': partner.name,
        'Email Principal': partner.email,
        'Emails Comunicação': (partner.communication_emails || []).join(', '),
        'Telefone': partner.phone,
        'Pessoa Contacto': partner.contact_person,
        'Rua': partner.street,
        'Nº Porta': partner.door_number,
        'Código Postal': partner.postal_code,
        'Localidade': partner.locality,
        'NIF': partner.nif,
        'CRC': partner.crc || '',
        'IBAN': partner.iban || '',
        'Data Criação': new Date(partner.created_at).toLocaleDateString('pt-PT')
      }));

      const XLSX = await import('xlsx');
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Parceiros');

      const fileName = `parceiros_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success(`Exportados ${partners.length} parceiros`);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao exportar Excel");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Parceiros</h1>
        <div className="flex gap-3">
          <Button
            onClick={handleExportExcel}
            variant="outline"
            className="border-green-500 text-green-400 hover:bg-green-500/10"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
          {user?.role === 'admin' && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm} className="btn-primary"><Plus className="w-4 h-4 mr-2" />Novo Parceiro</Button>
              </DialogTrigger>
            <DialogContent className="glass-ultra max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl text-white">{editingPartner ? "Editar Parceiro" : "Novo Parceiro"}</DialogTitle>
                <DialogDescription className="text-dark-400">
                  {editingPartner ? "Atualize as informações do parceiro" : "Preencha os dados para criar um novo parceiro"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-dark-200">Tipo *</Label>
                    <Select value={formData.partner_type} onValueChange={(v) => setFormData({...formData, partner_type: v})}>
                      <SelectTrigger className="glass-input"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="D2D">D2D</SelectItem>
                        <SelectItem value="REV">REV</SelectItem>
                        <SelectItem value="Rev+">Rev+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-dark-200">Nome *</Label>
                    <Input className="glass-input" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                  </div>
                  <div>
                    <Label className="text-dark-200">Email Principal *</Label>
                    <Input className="glass-input" type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
                  </div>
                  <div>
                    <Label className="text-dark-200">Telefone *</Label>
                    <Input className="glass-input" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} required />
                  </div>
                  <div>
                    <Label className="text-dark-200">Pessoa Contacto *</Label>
                    <Input className="glass-input" value={formData.contact_person} onChange={(e) => setFormData({...formData, contact_person: e.target.value})} required />
                  </div>
                  <div>
                    <Label className="text-dark-200">Rua *</Label>
                    <Input className="glass-input" value={formData.street} onChange={(e) => setFormData({...formData, street: e.target.value})} required />
                  </div>
                  <div>
                    <Label className="text-dark-200">Numero Porta *</Label>
                    <Input className="glass-input" value={formData.door_number} onChange={(e) => setFormData({...formData, door_number: e.target.value})} required />
                  </div>
                  <div>
                    <Label className="text-dark-200">Codigo Postal *</Label>
                    <Input className="glass-input" value={formData.postal_code} onChange={(e) => setFormData({...formData, postal_code: e.target.value})} required />
                  </div>
                  <div>
                    <Label className="text-dark-200">Localidade *</Label>
                    <Input className="glass-input" value={formData.locality} onChange={(e) => setFormData({...formData, locality: e.target.value})} required />
                  </div>
                  <div>
                    <Label className="text-dark-200">NIF *</Label>
                    <Input
                      className="glass-input"
                      value={formData.nif}
                      onChange={(e) => setFormData({...formData, nif: e.target.value})}
                      required
                      maxLength={9}
                      placeholder="9 digitos"
                    />
                    {formData.nif.length === 9 && (
                      <p className={`text-xs mt-1 ${
                        validateNIF(formData.nif).valid
                          ? 'text-green-400'
                          : 'text-red-400'
                      }`}>
                        {validateNIF(formData.nif).valid ? (
                          <>&#10003; NIF valido{formData.nif.startsWith('5') && ' (CRC correto)'}</>
                        ) : (
                          <>&#10007; {validateNIF(formData.nif).message}</>
                        )}
                      </p>
                    )}
                  </div>
                  {formData.nif.startsWith('5') && (
                    <div>
                      <Label className="text-dark-200">Codigo CRC *</Label>
                      <Input
                        className="glass-input"
                        value={formData.crc}
                        onChange={(e) => setFormData({...formData, crc: e.target.value})}
                        required
                        placeholder="Codigo CRC"
                      />
                      <p className="text-xs text-dark-400 mt-1">Obrigatorio para NIF iniciado por 5</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-dark-200">IBAN para Pagamento de Comissoes *</Label>
                    <Input
                      className="glass-input"
                      value={formData.iban}
                      onChange={(e) => setFormData({...formData, iban: e.target.value})}
                      required
                      placeholder="PT50..."
                      maxLength={25}
                    />
                    <p className="text-xs text-dark-400 mt-1">IBAN para receber pagamento de comissoes</p>
                  </div>
                  <div>
                    <Label className="text-dark-200">Gestor Responsavel (Opcional)</Label>
                    <Select value={formData.manager_id || undefined} onValueChange={(v) => setFormData({...formData, manager_id: v})}>
                      <SelectTrigger className="glass-input">
                        <SelectValue placeholder="Nenhum gestor atribuido" />
                      </SelectTrigger>
                      <SelectContent>
                        {managers.map((manager) => (
                          <SelectItem key={manager.id} value={manager.id}>
                            {manager.name} ({manager.role === 'gestor_nv1' ? 'Gestor Nivel 1' : 'Gestor Nivel 2'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-dark-400 mt-1">Gestor que tera acesso as vendas deste parceiro</p>
                  </div>
                </div>
                {editingPartner && editingPartner.partner_type === 'D2D' && operatorsWithD2D.length > 0 && (
                  <div className="border border-dark-600 rounded-xl p-4 bg-dark-800/50">
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 className="w-4 h-4 text-gold-400" />
                      <Label className="text-sm font-semibold text-dark-200">Niveis de Comissao D2D por Operadora</Label>
                    </div>
                    {loadingLevels ? (
                      <div className="flex items-center gap-2 py-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm text-dark-400">A carregar niveis...</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {operatorsWithD2D.map(op => {
                          const currentLevel = d2dLevels.find(l => l.operator_id === op.id);
                          return (
                            <div key={op.id} className="flex items-center gap-3">
                              <span className="text-sm font-medium text-dark-200 w-40 truncate">{op.name}</span>
                              <Select
                                value={currentLevel?.d2d_level || "none"}
                                onValueChange={(v) => {
                                  const newLevels = d2dLevels.filter(l => l.operator_id !== op.id);
                                  if (v !== "none") {
                                    newLevels.push({ operator_id: op.id, d2d_level: v });
                                  }
                                  setD2dLevels(newLevels);
                                }}
                              >
                                <SelectTrigger className="glass-input flex-1 h-9">
                                  <SelectValue placeholder="Sem nivel" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Sem nivel atribuido</SelectItem>
                                  {op.levels.map(level => (
                                    <SelectItem key={level} value={level}>{level}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        })}
                        <p className="text-xs text-dark-400 mt-2">
                          Operadoras sem nivel atribuido nao permitem registar vendas para este parceiro
                        </p>
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label className="text-dark-200">Emails de Comunicacao</Label>
                    <Button type="button" onClick={addEmailField} size="sm" className="btn-secondary">+ Email</Button>
                  </div>
                  {formData.communication_emails.map((email, idx) => (
                    <Input key={idx} type="email" value={email} onChange={(e) => updateEmail(idx, e.target.value)} className="glass-input mb-2" placeholder="email@exemplo.com" />
                  ))}
                </div>
                {!editingPartner && formData.email && generatedPassword && (
                  <div className="bg-dark-800 border border-dark-600 rounded-lg p-4">
                    <p className="text-sm font-semibold text-white mb-2">Utilizador a criar:</p>
                    <p className="text-sm text-dark-200"><strong>Email:</strong> {formData.email}</p>
                    <p className="text-sm text-dark-200"><strong>Password:</strong> <span className="font-mono">{generatedPassword}</span></p>
                    <p className="text-xs text-dark-400 mt-2">O utilizador sera criado automaticamente com estes dados</p>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" onClick={() => setDialogOpen(false)} className="btn-secondary">Cancelar</Button>
                  <Button type="submit" className="btn-primary">{editingPartner ? "Atualizar" : "Criar"} Parceiro</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </div>

      <div className="glass-ultra p-6">
        <div className="mb-4 flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
            <Input
              type="text"
              placeholder="Pesquisar por codigo, nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="glass-input pl-10"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="glass-input w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="D2D">D2D</SelectItem>
              <SelectItem value="REV">REV</SelectItem>
              <SelectItem value="Rev+">Rev+</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort("code")} className="cursor-pointer">
                  Codigo{getSortIcon("code")}
                </th>
                <th onClick={() => handleSort("name")} className="cursor-pointer">
                  Nome{getSortIcon("name")}
                </th>
                <th onClick={() => handleSort("type")} className="cursor-pointer">
                  Tipo{getSortIcon("type")}
                </th>
                <th onClick={() => handleSort("email")} className="cursor-pointer">
                  Email{getSortIcon("email")}
                </th>
                <th onClick={() => handleSort("phone")} className="cursor-pointer">
                  Telefone{getSortIcon("phone")}
                </th>
                <th onClick={() => handleSort("contact")} className="cursor-pointer">
                  Contacto{getSortIcon("contact")}
                </th>
                {user?.role === 'admin' && <th className="text-center">Documentos</th>}
                {user?.role === 'admin' && <th className="text-center">Acoes</th>}
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedPartners.length === 0 ? (
                <tr><td colSpan={user?.role === 'admin' ? 8 : 6} className="text-center py-8 text-dark-400">Nenhum parceiro encontrado</td></tr>
              ) : (
                filteredAndSortedPartners.map((partner) => (
                  <tr key={partner.id}>
                    <td className="font-semibold text-blue-400">{partner.partner_code}</td>
                    <td className="font-medium text-dark-200">{partner.name}</td>
                    <td>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        partner.partner_type === 'D2D'
                          ? 'bg-gold-400/10 text-gold-400'
                          : partner.partner_type === 'REV'
                            ? 'bg-blue-400/10 text-blue-400'
                            : 'bg-purple-400/10 text-purple-400'
                      }`}>{partner.partner_type}</span>
                    </td>
                    <td className="text-dark-200">{partner.email}</td>
                    <td className="text-dark-200">{partner.phone}</td>
                    <td className="text-dark-200">{partner.contact_person}</td>
                    {user?.role === 'admin' && (
                      <td className="text-center">
                        <Button
                          onClick={() => openDocumentsDialog(partner)}
                          size="sm"
                          variant="ghost"
                          className="text-dark-200"
                        >
                          <File className="w-4 h-4 mr-1" />
                          {partner.documents?.length || 0}
                        </Button>
                      </td>
                    )}
                    {user?.role === 'admin' && (
                      <td className="text-center">
                        <div className="flex gap-2 justify-center">
                          <Button
                            onClick={() => navigate('/sales', { state: { openNewSale: true, partnerId: partner.id, partnerName: partner.name } })}
                            size="sm"
                            variant="ghost"
                            className="text-green-400 hover:bg-green-500/10"
                            title="Registar nova venda"
                          >
                            <ShoppingCart className="w-4 h-4" />
                          </Button>
                          <Button onClick={() => handleEdit(partner)} size="sm" variant="ghost" className="text-blue-400">
                            Editar
                          </Button>
                          <Button onClick={() => handleDelete(partner.id, partner.name)} size="sm" variant="ghost" className="text-red-400 hover:text-red-300">
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

      <Dialog open={documentsDialogOpen} onOpenChange={setDocumentsDialogOpen}>
        <DialogContent className="glass-ultra max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Documentos - {selectedPartnerForDocs?.name}</DialogTitle>
            <DialogDescription className="text-dark-400">Gerir documentos associados ao parceiro</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="border-2 border-dashed border-dark-600 rounded-lg p-6 text-center">
              <input
                type="file"
                id="doc-upload"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files[0]) {
                    handleUploadDocument(selectedPartnerForDocs.id, e.target.files[0]);
                    e.target.value = '';
                  }
                }}
              />
              <label htmlFor="doc-upload" className="cursor-pointer">
                <Upload className="w-12 h-12 mx-auto text-dark-400 mb-2" />
                <p className="text-sm text-dark-400">
                  {uploadingDoc ? 'A carregar...' : 'Clique para selecionar um ficheiro'}
                </p>
              </label>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-white">Documentos anexados:</h3>
              {(!selectedPartnerForDocs?.documents || selectedPartnerForDocs.documents.length === 0) ? (
                <p className="text-dark-400 text-sm py-4 text-center">Nenhum documento anexado</p>
              ) : (
                <div className="space-y-2">
                  {selectedPartnerForDocs.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg border border-dark-600">
                      <div className="flex items-center gap-3">
                        <File className="w-5 h-5 text-blue-400" />
                        <div>
                          <p className="font-medium text-sm text-dark-200">{doc.filename}</p>
                          <p className="text-xs text-dark-400">
                            {new Date(doc.uploaded_at).toLocaleDateString('pt-PT')}
                          </p>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost">
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Partners;
