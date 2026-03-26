import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Search, Upload, File, Download, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Loader as Loader2, Building2, ShoppingCart } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SkeletonTable } from "@/components/ui/skeleton-loader";
import { useQuery } from "@tanstack/react-query";
import { partnersService } from "../services/partnersService";
import { usersService } from "../services/usersService";
import { validateNIF, generateStrongPassword } from "../lib/utils-crm";
import { recalculatePartnerCommissions } from "../services/commissionRecalculator";
import { useConfirm } from "@/components/ui/confirm-dialog";

const Partners = ({ user }) => {
  const navigate = useNavigate();
  const { confirm, dialog: confirmDialog } = useConfirm();
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
  const [revLevels, setRevLevels] = useState([]);
  const [loadingLevels, setLoadingLevels] = useState(false);
  const [formData, setFormData] = useState({
    partner_type: "D2D",
    rev_level: 1,
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
    email_bcc_enabled: false,
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

  const { data: operatorsWithREV = [] } = useQuery({
    queryKey: ['operators-rev-configs'],
    queryFn: () => partnersService.getOperatorsWithREVConfigs(),
    staleTime: 10 * 60 * 1000,
  });

  const managers = allUsers.filter(u => u.role === 'gestor_nv1' || u.role === 'gestor_nv2');
  const loading = partnersLoading;

  const generatePassword = () => {
    const password = generateStrongPassword();
    setGeneratedPassword(password);
  };

  useEffect(() => {
    if (!editingPartner) {
      if (formData.email || formData.partner_type === 'D2D') {
        generatePassword();
      }
    }
  }, [formData.email, formData.partner_type, editingPartner]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const nifValidation = validateNIF(formData.nif);
    if (!nifValidation.valid) {
      toast.error(nifValidation.message);
      return;
    }

    if (formData.nif.startsWith('5') && !formData.crc) {
      toast.error("Codigo CRC e obrigatorio para NIF iniciado por 5");
      return;
    }

    try {
      const submitData = { ...formData };
      submitData.communication_emails = formData.communication_emails.filter(e => e.trim());

      if (editingPartner) {
        await partnersService.update(editingPartner.id, submitData);
        let affectedOperatorIds = [];
        if (editingPartner.partner_type === 'D2D') {
          await partnersService.saveD2DLevels(editingPartner.id, d2dLevels);
          affectedOperatorIds = d2dLevels.map(l => l.operator_id).filter(Boolean);
        } else if (editingPartner.partner_type === 'REV' || editingPartner.partner_type === 'Rev+') {
          await partnersService.saveREVLevels(editingPartner.id, revLevels);
          affectedOperatorIds = revLevels.map(l => l.operator_id).filter(Boolean);
        }
        toast.success("Parceiro atualizado com sucesso!");
        if (affectedOperatorIds.length > 0) {
          toast.info("A atualizar comissoes do parceiro em segundo plano...");
          recalculatePartnerCommissions(editingPartner.id, affectedOperatorIds);
        }
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
    const displayEmail = partner.email && partner.email.endsWith('@noemail.mpgrupo.local') ? '' : (partner.email || '');
    setFormData({
      partner_type: partner.partner_type,
      rev_level: partner.rev_level || 1,
      name: partner.name,
      email: displayEmail,
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
      email_bcc_enabled: partner.email_bcc_enabled || false,
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
        setRevLevels([]);
      } catch (err) {
        console.error('Failed to load D2D levels:', err);
        setD2dLevels([]);
        setRevLevels([]);
      } finally {
        setLoadingLevels(false);
      }
    } else if (partner.partner_type === 'REV' || partner.partner_type === 'Rev+') {
      setLoadingLevels(true);
      try {
        const levels = await partnersService.getREVLevels(partner.id);
        setRevLevels(levels.map(l => ({
          operator_id: l.operator_id,
          rev_level: l.rev_level,
        })));
        setD2dLevels([]);
      } catch (err) {
        console.error('Failed to load REV levels:', err);
        setRevLevels([]);
        setD2dLevels([]);
      } finally {
        setLoadingLevels(false);
      }
    } else {
      setD2dLevels([]);
      setRevLevels([]);
    }
  };

  const handleDelete = async (partnerId, partnerName) => {
    const ok = await confirm({
      title: `Eliminar parceiro`,
      description: `Tem a certeza que deseja eliminar "${partnerName}"? Esta acao nao pode ser revertida.`,
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;

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
    setRevLevels([]);
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
      email_bcc_enabled: false,
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
      return <ArrowUpDown className="w-4 h-4 inline ml-1 text-slate-500" />;
    }
    return sortDirection === "asc" ?
      <ArrowUp className="w-4 h-4 inline ml-1 text-cyan-400" /> :
      <ArrowDown className="w-4 h-4 inline ml-1 text-cyan-400" />;
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
      <div className="space-y-6 p-6" style={{ backgroundColor: '#080c14' }}>
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
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
        'Codigo': partner.partner_code,
        'Tipo': partner.partner_type,
        'Nome': partner.name,
        'Email Principal': partner.email?.endsWith('@noemail.mpgrupo.local') ? '' : (partner.email || ''),
        'Emails Comunicacao': (partner.communication_emails || []).join(', '),
        'Telefone': partner.phone,
        'Pessoa Contacto': partner.contact_person,
        'Rua': partner.street,
        'N Porta': partner.door_number,
        'Codigo Postal': partner.postal_code,
        'Localidade': partner.locality,
        'NIF': partner.nif,
        'CRC': partner.crc || '',
        'IBAN': partner.iban || '',
        'Data Criacao': new Date(partner.created_at).toLocaleDateString('pt-PT')
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
    <div className="space-y-6" style={{ backgroundColor: '#080c14', minHeight: '100%' }}>
      {confirmDialog}
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Parceiros</h1>
          <p className="text-slate-400 text-sm mt-1">Gestao de parceiros e documentos</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={handleExportExcel}
            variant="outline"
            className="border-green-500/20 text-green-400 hover:bg-green-500/10 bg-dark-900"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
          {(user?.role === 'admin' || user?.role === 'bo') && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm} className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/20">
                  <Plus className="w-4 h-4 mr-2" />Novo Parceiro
                </Button>
              </DialogTrigger>
            <DialogContent className="bg-dark-850 border border-cyan-500/10 max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl font-display text-white">{editingPartner ? "Editar Parceiro" : "Novo Parceiro"}</DialogTitle>
                <DialogDescription className="text-slate-400">
                  {editingPartner ? "Atualize as informacoes do parceiro" : "Preencha os dados para criar um novo parceiro"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-400">Tipo *</Label>
                    <Select value={formData.partner_type} onValueChange={(v) => setFormData({...formData, partner_type: v})}>
                      <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyan-500 focus:ring-cyan-500/20"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="D2D">D2D</SelectItem>
                        <SelectItem value="REV">REV</SelectItem>
                        <SelectItem value="Rev+">Rev+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(formData.partner_type === 'REV' || formData.partner_type === 'Rev+') && (
                    <div>
                      <Label className="text-slate-400">Nível REV *</Label>
                      <Select value={String(formData.rev_level || 1)} onValueChange={(v) => setFormData({...formData, rev_level: parseInt(v)})}>
                        <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyan-500 focus:ring-cyan-500/20"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Nível 1</SelectItem>
                          <SelectItem value="2">Nível 2</SelectItem>
                          <SelectItem value="3">Nível 3</SelectItem>
                          <SelectItem value="4">Nível 4</SelectItem>
                          <SelectItem value="5">Nível 5</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <Label className="text-slate-400">Nome *</Label>
                    <Input className="bg-dark-900 border-dark-700 focus:border-cyan-500 focus:ring-cyan-500/20 text-white" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                  </div>
                  <div>
                    <Label className="text-slate-400">
                      Email Principal {formData.partner_type !== 'D2D' ? '*' : '(opcional)'}
                    </Label>
                    <Input
                      className="bg-dark-900 border-dark-700 focus:border-cyan-500 focus:ring-cyan-500/20 text-white"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      required={formData.partner_type !== 'D2D'}
                      placeholder={formData.partner_type === 'D2D' ? 'Opcional — login por codigo de parceiro' : ''}
                    />
                    {formData.partner_type === 'D2D' && !formData.email && (
                      <p className="text-xs mt-1 text-slate-500">Sem email: login apenas via codigo de parceiro</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-slate-400">Telefone *</Label>
                    <Input className="bg-dark-900 border-dark-700 focus:border-cyan-500 focus:ring-cyan-500/20 text-white" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} required />
                  </div>
                  <div>
                    <Label className="text-slate-400">Pessoa Contacto *</Label>
                    <Input className="bg-dark-900 border-dark-700 focus:border-cyan-500 focus:ring-cyan-500/20 text-white" value={formData.contact_person} onChange={(e) => setFormData({...formData, contact_person: e.target.value})} required />
                  </div>
                  <div>
                    <Label className="text-slate-400">Rua {formData.partner_type !== 'D2D' ? '*' : '(opcional)'}</Label>
                    <Input className="bg-dark-900 border-dark-700 focus:border-cyan-500 focus:ring-cyan-500/20 text-white" value={formData.street} onChange={(e) => setFormData({...formData, street: e.target.value})} required={formData.partner_type !== 'D2D'} />
                  </div>
                  <div>
                    <Label className="text-slate-400">Numero Porta {formData.partner_type !== 'D2D' ? '*' : '(opcional)'}</Label>
                    <Input className="bg-dark-900 border-dark-700 focus:border-cyan-500 focus:ring-cyan-500/20 text-white" value={formData.door_number} onChange={(e) => setFormData({...formData, door_number: e.target.value})} required={formData.partner_type !== 'D2D'} />
                  </div>
                  <div>
                    <Label className="text-slate-400">Codigo Postal {formData.partner_type !== 'D2D' ? '*' : '(opcional)'}</Label>
                    <Input className="bg-dark-900 border-dark-700 focus:border-cyan-500 focus:ring-cyan-500/20 text-white" value={formData.postal_code} onChange={(e) => setFormData({...formData, postal_code: e.target.value})} required={formData.partner_type !== 'D2D'} />
                  </div>
                  <div>
                    <Label className="text-slate-400">Localidade {formData.partner_type !== 'D2D' ? '*' : '(opcional)'}</Label>
                    <Input className="bg-dark-900 border-dark-700 focus:border-cyan-500 focus:ring-cyan-500/20 text-white" value={formData.locality} onChange={(e) => setFormData({...formData, locality: e.target.value})} required={formData.partner_type !== 'D2D'} />
                  </div>
                  <div>
                    <Label className="text-slate-400">NIF *</Label>
                    <Input
                      className="bg-dark-900 border-dark-700 focus:border-cyan-500 focus:ring-cyan-500/20 text-white"
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
                      <Label className="text-slate-400">Codigo CRC *</Label>
                      <Input
                        className="bg-dark-900 border-dark-700 focus:border-cyan-500 focus:ring-cyan-500/20 text-white"
                        value={formData.crc}
                        onChange={(e) => setFormData({...formData, crc: e.target.value})}
                        required
                        placeholder="Codigo CRC"
                      />
                      <p className="text-xs text-slate-500 mt-1">Obrigatorio para NIF iniciado por 5</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-slate-400">IBAN para Pagamento de Comissoes (opcional)</Label>
                    <Input
                      className="bg-dark-900 border-dark-700 focus:border-cyan-500 focus:ring-cyan-500/20 text-white"
                      value={formData.iban}
                      onChange={(e) => setFormData({...formData, iban: e.target.value})}
                      placeholder="PT50..."
                      maxLength={25}
                    />
                    <p className="text-xs text-slate-500 mt-1">IBAN para receber pagamento de comissoes</p>
                  </div>
                  <div>
                    <Label className="text-slate-400">Gestor Responsavel (Opcional)</Label>
                    <Select value={formData.manager_id || undefined} onValueChange={(v) => setFormData({...formData, manager_id: v})}>
                      <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyan-500 focus:ring-cyan-500/20">
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
                    <p className="text-xs text-slate-500 mt-1">Gestor que tera acesso as vendas deste parceiro</p>
                  </div>
                </div>
                {editingPartner && editingPartner.partner_type === 'D2D' && operatorsWithD2D.length > 0 && (
                  <div className="border border-dark-700 rounded-xl p-4 bg-dark-900">
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 className="w-4 h-4 text-cyan-400" />
                      <Label className="text-sm font-semibold text-slate-300">Niveis de Comissao D2D por Operadora</Label>
                    </div>
                    {loadingLevels ? (
                      <div className="flex items-center gap-2 py-2">
                        <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                        <span className="text-sm text-slate-400">A carregar niveis...</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {operatorsWithD2D.map(op => {
                          const currentLevel = d2dLevels.find(l => l.operator_id === op.id);
                          return (
                            <div key={op.id} className="flex items-center gap-3">
                              <span className="text-sm font-medium text-slate-300 w-40 truncate">{op.name}</span>
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
                                <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyan-500 focus:ring-cyan-500/20 flex-1 h-9">
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
                        <p className="text-xs text-slate-500 mt-2">
                          Operadoras sem nivel atribuido nao permitem registar vendas para este parceiro
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {editingPartner && (editingPartner.partner_type === 'REV' || editingPartner.partner_type === 'Rev+') && operatorsWithREV.length > 0 && (
                  <div className="border border-dark-700 rounded-xl p-4 bg-dark-900">
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 className="w-4 h-4 text-cyan-400" />
                      <Label className="text-sm font-semibold text-slate-300">Niveis de Comissao {editingPartner.partner_type} por Operadora</Label>
                    </div>
                    {loadingLevels ? (
                      <div className="flex items-center gap-2 py-2">
                        <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                        <span className="text-sm text-slate-400">A carregar niveis...</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {operatorsWithREV.map(op => {
                          const currentLevel = revLevels.find(l => l.operator_id === op.id);
                          return (
                            <div key={op.id} className="flex items-center gap-3">
                              <span className="text-sm font-medium text-slate-300 w-40 truncate">{op.name}</span>
                              <Select
                                value={currentLevel ? String(currentLevel.rev_level) : "none"}
                                onValueChange={(v) => {
                                  const newLevels = revLevels.filter(l => l.operator_id !== op.id);
                                  if (v !== "none") {
                                    newLevels.push({ operator_id: op.id, rev_level: parseInt(v) });
                                  }
                                  setRevLevels(newLevels);
                                }}
                              >
                                <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyan-500 focus:ring-cyan-500/20 flex-1 h-9">
                                  <SelectValue placeholder="Sem nivel" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Sem nivel atribuido</SelectItem>
                                  {op.levels.map(level => (
                                    <SelectItem key={level} value={String(level)}>Nivel {level}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        })}
                        <p className="text-xs text-slate-500 mt-2">
                          Operadoras sem nivel atribuido nao permitem registar vendas para este parceiro
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {(formData.partner_type === 'D2D' || (editingPartner && editingPartner.partner_type === 'D2D')) && (
                  <div className="border border-dark-700 rounded-xl p-4 bg-dark-900">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-semibold text-slate-300">Autorizar envio de email (BCC)</Label>
                        <p className="text-xs text-slate-500 mt-0.5">Parceiros D2D nao recebem emails por defeito. Ative para incluir este parceiro nos emails BCC.</p>
                      </div>
                      <Switch
                        checked={formData.email_bcc_enabled}
                        onCheckedChange={(checked) => setFormData({...formData, email_bcc_enabled: checked})}
                        className="data-[state=checked]:bg-cyan-500"
                      />
                    </div>
                  </div>
                )}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label className="text-slate-400">Emails de Comunicacao</Label>
                    <Button type="button" onClick={addEmailField} size="sm" className="bg-dark-900 border border-dark-700 text-slate-300 hover:border-cyan-500/30 hover:text-cyan-400">+ Email</Button>
                  </div>
                  {formData.communication_emails.map((email, idx) => (
                    <Input key={idx} type="email" value={email} onChange={(e) => updateEmail(idx, e.target.value)} className="bg-dark-900 border-dark-700 focus:border-cyan-500 focus:ring-cyan-500/20 text-white mb-2" placeholder="email@exemplo.com" />
                  ))}
                </div>
                {!editingPartner && formData.email && generatedPassword && (
                  <div className="bg-dark-900 border border-cyan-500/20 rounded-lg p-4">
                    <p className="text-sm font-semibold text-white mb-2">Utilizador a criar:</p>
                    <p className="text-sm text-slate-300"><strong>Email:</strong> {formData.email}</p>
                    <p className="text-sm text-slate-300"><strong>Password:</strong> <span className="font-mono text-cyan-400">{generatedPassword}</span></p>
                    <p className="text-xs text-slate-500 mt-2">O utilizador sera criado automaticamente com estes dados</p>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" onClick={() => setDialogOpen(false)} className="bg-dark-900 border border-dark-700 text-slate-300 hover:border-cyan-500/30">Cancelar</Button>
                  <Button type="submit" className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white">{editingPartner ? "Atualizar" : "Criar"} Parceiro</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-dark-850 border border-white/[0.06] rounded-xl p-6">
        <div className="mb-4 flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <Input
              type="text"
              placeholder="Pesquisar por codigo, nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-dark-900 border-dark-700 focus:border-cyan-500 focus:ring-cyan-500/20 text-white pl-10 placeholder:text-slate-500"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyan-500 focus:ring-cyan-500/20 w-48">
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

        {/* Table */}
        <div className="table-container">
          <table>
            <thead>
              <tr className="border-b border-dark-700">
                <th onClick={() => handleSort("code")} className="cursor-pointer text-cyan-400 font-semibold text-xs uppercase tracking-wider">
                  Codigo{getSortIcon("code")}
                </th>
                <th onClick={() => handleSort("name")} className="cursor-pointer text-cyan-400 font-semibold text-xs uppercase tracking-wider">
                  Nome{getSortIcon("name")}
                </th>
                <th onClick={() => handleSort("type")} className="cursor-pointer text-cyan-400 font-semibold text-xs uppercase tracking-wider">
                  Tipo{getSortIcon("type")}
                </th>
                <th onClick={() => handleSort("email")} className="cursor-pointer text-cyan-400 font-semibold text-xs uppercase tracking-wider">
                  Email{getSortIcon("email")}
                </th>
                <th onClick={() => handleSort("phone")} className="cursor-pointer text-cyan-400 font-semibold text-xs uppercase tracking-wider">
                  Telefone{getSortIcon("phone")}
                </th>
                <th onClick={() => handleSort("contact")} className="cursor-pointer text-cyan-400 font-semibold text-xs uppercase tracking-wider">
                  Contacto{getSortIcon("contact")}
                </th>
                {user?.role === 'admin' && <th className="text-center text-cyan-400 font-semibold text-xs uppercase tracking-wider">Documentos</th>}
                {(user?.role === 'admin' || user?.role === 'bo') && <th className="text-center text-cyan-400 font-semibold text-xs uppercase tracking-wider">Acoes</th>}
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedPartners.length === 0 ? (
                <tr><td colSpan={user?.role === 'admin' ? 8 : (user?.role === 'bo' ? 7 : 6)} className="text-center py-8 text-slate-500">Nenhum parceiro encontrado</td></tr>
              ) : (
                filteredAndSortedPartners.map((partner) => (
                  <tr key={partner.id} className="border-b border-white/[0.06] hover:bg-white/[0.02] transition-colors">
                    <td className="font-semibold text-cyan-400">{partner.partner_code}</td>
                    <td className="font-medium text-white">{partner.name}</td>
                    <td>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                        partner.partner_type === 'D2D'
                          ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                          : partner.partner_type === 'REV'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                      }`}>{partner.partner_type}</span>
                    </td>
                    <td className="text-slate-300">{partner.email?.endsWith('@noemail.mpgrupo.local') ? '' : (partner.email || '')}</td>
                    <td className="text-slate-300">{partner.phone}</td>
                    <td className="text-slate-300">{partner.contact_person}</td>
                    {user?.role === 'admin' && (
                      <td className="text-center">
                        <Button
                          onClick={() => openDocumentsDialog(partner)}
                          size="sm"
                          variant="ghost"
                          className="text-slate-300 hover:text-cyan-400 hover:bg-cyan-500/10"
                        >
                          <File className="w-4 h-4 mr-1" />
                          {partner.documents?.length || 0}
                        </Button>
                      </td>
                    )}
                    {(user?.role === 'admin' || user?.role === 'bo') && (
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
                          <Button onClick={() => handleEdit(partner)} size="sm" variant="ghost" className="text-cyan-400 hover:bg-cyan-500/10">
                            Editar
                          </Button>
                          {user?.role === 'admin' && (
                            <Button onClick={() => handleDelete(partner.id, partner.name)} size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
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

      {/* Documents Dialog */}
      <Dialog open={documentsDialogOpen} onOpenChange={setDocumentsDialogOpen}>
        <DialogContent className="bg-dark-850 border border-cyan-500/10 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white font-display">Documentos - {selectedPartnerForDocs?.name}</DialogTitle>
            <DialogDescription className="text-slate-400">Gerir documentos associados ao parceiro</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="border-2 border-dashed border-dark-700 rounded-lg p-6 text-center hover:border-cyan-500/30 transition-colors">
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
                <Upload className="w-12 h-12 mx-auto text-slate-500 mb-2" />
                <p className="text-sm text-slate-500">
                  {uploadingDoc ? 'A carregar...' : 'Clique para selecionar um ficheiro'}
                </p>
              </label>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-white">Documentos anexados:</h3>
              {(!selectedPartnerForDocs?.documents || selectedPartnerForDocs.documents.length === 0) ? (
                <p className="text-slate-500 text-sm py-4 text-center">Nenhum documento anexado</p>
              ) : (
                <div className="space-y-2">
                  {selectedPartnerForDocs.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-dark-900 rounded-lg border border-dark-700 hover:border-cyan-500/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <File className="w-5 h-5 text-cyan-400" />
                        <div>
                          <p className="font-medium text-sm text-slate-300">{doc.filename}</p>
                          <p className="text-xs text-slate-500">
                            {new Date(doc.uploaded_at).toLocaleDateString('pt-PT')}
                          </p>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10">
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
