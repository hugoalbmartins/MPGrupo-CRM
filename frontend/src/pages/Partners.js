import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { API } from "../App";

const Partners = ({ user }) => {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [generatedPassword, setGeneratedPassword] = useState("");
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
  });

  useEffect(() => {
    fetchPartners();
  }, []);

  const fetchPartners = async () => {
    try {
      const response = await axios.get(`${API}/partners`);
      setPartners(response.data);
    } catch (error) {
      toast.error("Erro ao carregar parceiros");
    } finally {
      setLoading(false);
    }
  };

  const generatePassword = async () => {
    try {
      const response = await axios.get(`${API}/auth/generate-password`);
      setGeneratedPassword(response.data.password);
    } catch (error) {
      console.error("Erro ao gerar password");
    }
  };

  useEffect(() => {
    if (formData.email && !editingPartner) {
      generatePassword();
    }
  }, [formData.email]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = { ...formData };
      submitData.communication_emails = formData.communication_emails.filter(e => e.trim());
      
      if (editingPartner) {
        await axios.put(`${API}/partners/${editingPartner.id}`, submitData);
        toast.success("Parceiro atualizado com sucesso!");
      } else {
        const response = await axios.post(`${API}/partners`, submitData);
        if (response.data.initial_password) {
          toast.success(
            `Parceiro criado! Password: ${response.data.initial_password}`,
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
      toast.error(error.response?.data?.detail || "Erro ao salvar parceiro");
    }
  };

  const handleEdit = (partner) => {
    setEditingPartner(partner);
    setFormData({
      partner_type: partner.partner_type,
      name: partner.name,
      email: partner.email,
      communication_emails: partner.communication_emails.length > 0 ? partner.communication_emails : [""],
      phone: partner.phone,
      contact_person: partner.contact_person,
      street: partner.street,
      door_number: partner.door_number,
      postal_code: partner.postal_code,
      locality: partner.locality,
      nif: partner.nif,
      crc: partner.crc || "",
    });
    setDialogOpen(true);
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

  const filteredPartners = partners.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.partner_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Parceiros</h1>
        {user?.role === 'admin' && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="btn-primary"><Plus className="w-4 h-4 mr-2" />Novo Parceiro</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="text-2xl">{editingPartner ? "Editar Parceiro" : "Novo Parceiro"}</DialogTitle></DialogHeader>
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
                    <Input value={formData.nif} onChange={(e) => setFormData({...formData, nif: e.target.value})} required />
                  </div>
                  {formData.nif.startsWith('5') && (
                    <div>
                      <Label>Código CRC</Label>
                      <Input value={formData.crc} onChange={(e) => setFormData({...formData, crc: e.target.value})} />
                    </div>
                  )}
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

      <div className="professional-card p-6">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input type="text" placeholder="Pesquisar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Email</th>
                <th>Telefone</th>
                <th>Contacto</th>
                {user?.role === 'admin' && <th className="text-center">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {filteredPartners.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Nenhum parceiro encontrado</td></tr>
              ) : (
                filteredPartners.map((partner) => (
                  <tr key={partner.id}>
                    <td className="font-semibold text-blue-600">{partner.partner_code}</td>
                    <td className="font-medium">{partner.name}</td>
                    <td><span className="status-badge" style={{background: '#EFF6FF', color: '#1E40AF'}}>{partner.partner_type}</span></td>
                    <td>{partner.email}</td>
                    <td>{partner.phone}</td>
                    <td>{partner.contact_person}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Partners;
