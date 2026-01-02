import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Search, Upload, File, Download, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { partnersService } from "../services/partnersService";
import { usersService } from "../services/usersService";
import { validateNIF, generateStrongPassword } from "../lib/utils-crm";

const Partners = ({ user }) => {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
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
  const [managers, setManagers] = useState([]);
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

  useEffect(() => {
    fetchPartners();
    fetchManagers();
  }, []);

  const fetchPartners = async () => {
    try {
      const data = await partnersService.getAll();
      setPartners(data);
    } catch (error) {
      toast.error("Erro ao carregar parceiros");
    } finally {
      setLoading(false);
    }
  };

  const fetchManagers = async () => {
    try {
      const users = await usersService.getAll();
      const managerUsers = users.filter(u => u.role === 'gestor_nv1' || u.role === 'gestor_nv2');
      setManagers(managerUsers);
    } catch (error) {
      console.error("Erro ao carregar gestores:", error);
    }
  };

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

    console.log('=== PARTNER FORM SUBMIT START ===');
    console.log('User:', user);
    console.log('Form data:', formData);

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
        toast.success("Parceiro atualizado com sucesso!");
      } else {
        console.log('Calling partnersService.create...');
        const result = await partnersService.create(submitData);
        console.log('Partner created successfully:', result);
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
      fetchPartners();
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      const errorMessage = error.message || error.toString() || "Erro desconhecido ao salvar parceiro";
      toast.error(errorMessage, { duration: 5000 });
    }
  };

  const handleEdit = (partner) => {
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
  };

  const handleDelete = async (partnerId, partnerName) => {
    if (!window.confirm(`Tem a certeza que deseja eliminar o parceiro "${partnerName}"? Esta ação não pode ser revertida.`)) {
      return;
    }

    try {
      await partnersService.delete(partnerId);
      toast.success("Parceiro eliminado com sucesso");
      fetchPartners();
    } catch (error) {
      toast.error("Erro ao eliminar parceiro. Pode existir vendas associadas.");
    }
  };

  const handleUploadDocument = async (partnerId, file) => {
    try {
      setUploadingDoc(true);
      toast.success("Documento carregado com sucesso!");
      fetchPartners();
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
      return <ArrowUpDown className="w-4 h-4 inline ml-1 text-gray-400" />;
    }
    return sortDirection === "asc" ?
      <ArrowUp className="w-4 h-4 inline ml-1 text-blue-600" /> :
      <ArrowDown className="w-4 h-4 inline ml-1 text-blue-600" />;
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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>;

  const handleExportExcel = async () => {
    try {
      if (partners.length === 0) {
        toast.error("Nenhum parceiro encontrado para exportar");
        return;
      }

      // Preparar dados para Excel
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

      // Criar workbook e worksheet
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Parceiros');

      // Gerar e fazer download
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
        <h1 className="text-3xl font-bold text-gray-900">Parceiros</h1>
        <div className="flex gap-3">
          <Button
            onClick={handleExportExcel}
            variant="outline"
            className="border-green-500 text-green-600 hover:bg-green-50"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
          {user?.role === 'admin' && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm} className="btn-primary"><Plus className="w-4 h-4 mr-2" />Novo Parceiro</Button>
              </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl">{editingPartner ? "Editar Parceiro" : "Novo Parceiro"}</DialogTitle>
                <DialogDescription>
                  {editingPartner ? "Atualize as informações do parceiro" : "Preencha os dados para criar um novo parceiro"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tipo *</Label>
                    <Select value={formData.partner_type} onValueChange={(v) => setFormData({...formData, partner_type: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="D2D">D2D</SelectItem>
                        <SelectItem value="Rev">Rev</SelectItem>
                        <SelectItem value="Rev+">Rev+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Nome *</Label>
                    <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                  </div>
                  <div>
                    <Label>Email Principal *</Label>
                    <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
                  </div>
                  <div>
                    <Label>Telefone *</Label>
                    <Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} required />
                  </div>
                  <div>
                    <Label>Pessoa Contacto *</Label>
                    <Input value={formData.contact_person} onChange={(e) => setFormData({...formData, contact_person: e.target.value})} required />
                  </div>
                  <div>
                    <Label>Rua *</Label>
                    <Input value={formData.street} onChange={(e) => setFormData({...formData, street: e.target.value})} required />
                  </div>
                  <div>
                    <Label>Número Porta *</Label>
                    <Input value={formData.door_number} onChange={(e) => setFormData({...formData, door_number: e.target.value})} required />
                  </div>
                  <div>
                    <Label>Código Postal *</Label>
                    <Input value={formData.postal_code} onChange={(e) => setFormData({...formData, postal_code: e.target.value})} required />
                  </div>
                  <div>
                    <Label>Localidade *</Label>
                    <Input value={formData.locality} onChange={(e) => setFormData({...formData, locality: e.target.value})} required />
                  </div>
                  <div>
                    <Label>NIF *</Label>
                    <Input
                      value={formData.nif}
                      onChange={(e) => setFormData({...formData, nif: e.target.value})}
                      required
                      maxLength={9}
                      placeholder="9 dígitos"
                    />
                    {formData.nif.length === 9 && (
                      <p className={`text-xs mt-1 ${
                        validateNIF(formData.nif).valid
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}>
                        {validateNIF(formData.nif).valid ? (
                          <>✓ NIF válido{formData.nif.startsWith('5') && ' (CRC correto)'}</>
                        ) : (
                          <>✗ {validateNIF(formData.nif).message}</>
                        )}
                      </p>
                    )}
                  </div>
                  {formData.nif.startsWith('5') && (
                    <div>
                      <Label>Código CRC *</Label>
                      <Input
                        value={formData.crc}
                        onChange={(e) => setFormData({...formData, crc: e.target.value})}
                        required
                        placeholder="Código CRC"
                      />
                      <p className="text-xs text-gray-500 mt-1">Obrigatório para NIF iniciado por 5</p>
                    </div>
                  )}
                  <div>
                    <Label>IBAN para Pagamento de Comissões *</Label>
                    <Input
                      value={formData.iban}
                      onChange={(e) => setFormData({...formData, iban: e.target.value})}
                      required
                      placeholder="PT50..."
                      maxLength={25}
                    />
                    <p className="text-xs text-gray-500 mt-1">IBAN para receber pagamento de comissões</p>
                  </div>
                  <div>
                    <Label>Gestor Responsável (Opcional)</Label>
                    <Select value={formData.manager_id || undefined} onValueChange={(v) => setFormData({...formData, manager_id: v})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Nenhum gestor atribuído" />
                      </SelectTrigger>
                      <SelectContent>
                        {managers.map((manager) => (
                          <SelectItem key={manager.id} value={manager.id}>
                            {manager.name} ({manager.role === 'gestor_nv1' ? 'Gestor Nível 1' : 'Gestor Nível 2'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">Gestor que terá acesso às vendas deste parceiro</p>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label>Emails de Comunicação</Label>
                    <Button type="button" onClick={addEmailField} size="sm" variant="outline">+ Email</Button>
                  </div>
                  {formData.communication_emails.map((email, idx) => (
                    <Input key={idx} type="email" value={email} onChange={(e) => updateEmail(idx, e.target.value)} className="mb-2" placeholder="email@exemplo.com" />
                  ))}
                </div>
                {!editingPartner && formData.email && generatedPassword && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-blue-900 mb-2">👤 Utilizador a criar:</p>
                    <p className="text-sm text-blue-800"><strong>Email:</strong> {formData.email}</p>
                    <p className="text-sm text-blue-800"><strong>Password:</strong> <span className="font-mono">{generatedPassword}</span></p>
                    <p className="text-xs text-blue-600 mt-2">O utilizador será criado automaticamente com estes dados</p>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" onClick={() => setDialogOpen(false)} variant="outline">Cancelar</Button>
                  <Button type="submit" className="btn-primary">{editingPartner ? "Atualizar" : "Criar"} Parceiro</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </div>

      <div className="professional-card p-6">
        <div className="mb-4 flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Pesquisar por código, nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="D2D">D2D</SelectItem>
              <SelectItem value="Rev">Rev</SelectItem>
              <SelectItem value="Rev+">Rev+</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort("code")} className="cursor-pointer hover:bg-gray-50">
                  Código{getSortIcon("code")}
                </th>
                <th onClick={() => handleSort("name")} className="cursor-pointer hover:bg-gray-50">
                  Nome{getSortIcon("name")}
                </th>
                <th onClick={() => handleSort("type")} className="cursor-pointer hover:bg-gray-50">
                  Tipo{getSortIcon("type")}
                </th>
                <th onClick={() => handleSort("email")} className="cursor-pointer hover:bg-gray-50">
                  Email{getSortIcon("email")}
                </th>
                <th onClick={() => handleSort("phone")} className="cursor-pointer hover:bg-gray-50">
                  Telefone{getSortIcon("phone")}
                </th>
                <th onClick={() => handleSort("contact")} className="cursor-pointer hover:bg-gray-50">
                  Contacto{getSortIcon("contact")}
                </th>
                {user?.role === 'admin' && <th className="text-center">Documentos</th>}
                {user?.role === 'admin' && <th className="text-center">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedPartners.length === 0 ? (
                <tr><td colSpan={user?.role === 'admin' ? 8 : 6} className="text-center py-8 text-gray-400">Nenhum parceiro encontrado</td></tr>
              ) : (
                filteredAndSortedPartners.map((partner) => (
                  <tr key={partner.id}>
                    <td className="font-semibold text-blue-600">{partner.partner_code}</td>
                    <td className="font-medium">{partner.name}</td>
                    <td><span className="status-badge" style={{background: '#EFF6FF', color: '#1E40AF'}}>{partner.partner_type}</span></td>
                    <td>{partner.email}</td>
                    <td>{partner.phone}</td>
                    <td>{partner.contact_person}</td>
                    {user?.role === 'admin' && (
                      <td className="text-center">
                        <Button 
                          onClick={() => openDocumentsDialog(partner)} 
                          size="sm" 
                          variant="ghost" 
                          className="text-purple-600"
                        >
                          <File className="w-4 h-4 mr-1" />
                          {partner.documents?.length || 0}
                        </Button>
                      </td>
                    )}
                    {user?.role === 'admin' && (
                      <td className="text-center">
                        <div className="flex gap-2 justify-center">
                          <Button onClick={() => handleEdit(partner)} size="sm" variant="ghost" className="text-blue-600">
                            Editar
                          </Button>
                          <Button onClick={() => handleDelete(partner.id, partner.name)} size="sm" variant="ghost" className="text-red-500 hover:text-red-700">
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

      {/* Documents Dialog */}
      <Dialog open={documentsDialogOpen} onOpenChange={setDocumentsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Documentos - {selectedPartnerForDocs?.name}</DialogTitle>
            <DialogDescription>Gerir documentos associados ao parceiro</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* Upload Section */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
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
                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-600">
                  {uploadingDoc ? 'A carregar...' : 'Clique para selecionar um ficheiro'}
                </p>
              </label>
            </div>

            {/* Documents List */}
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900">Documentos anexados:</h3>
              {(!selectedPartnerForDocs?.documents || selectedPartnerForDocs.documents.length === 0) ? (
                <p className="text-gray-500 text-sm py-4 text-center">Nenhum documento anexado</p>
              ) : (
                <div className="space-y-2">
                  {selectedPartnerForDocs.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <File className="w-5 h-5 text-blue-500" />
                        <div>
                          <p className="font-medium text-sm">{doc.filename}</p>
                          <p className="text-xs text-gray-500">
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
