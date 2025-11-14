import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Pencil, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API } from "../App";

const Partners = ({ user }) => {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    nif: "",
    iban: "",
    bank_details: "",
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPartner) {
        await axios.put(`${API}/partners/${editingPartner.id}`, formData);
        toast.success("Parceiro atualizado com sucesso!");
      } else {
        await axios.post(`${API}/partners`, formData);
        toast.success("Parceiro criado com sucesso!");
      }
      setDialogOpen(false);
      resetForm();
      fetchPartners();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao salvar parceiro");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      address: "",
      nif: "",
      iban: "",
      bank_details: "",
    });
    setEditingPartner(null);
  };

  const handleEdit = (partner) => {
    setEditingPartner(partner);
    setFormData({
      name: partner.name,
      email: partner.email,
      phone: partner.phone,
      address: partner.address,
      nif: partner.nif,
      iban: partner.iban,
      bank_details: partner.bank_details,
    });
    setDialogOpen(true);
  };

  const filteredPartners = partners.filter((partner) =>
    partner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    partner.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    partner.nif.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canEdit = user?.role === 'admin' || user?.role === 'bo';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#C9A961]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="partners-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-4xl font-bold">Parceiros</h1>
        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={resetForm}
                data-testid="add-partner-button"
                className="bg-gradient-to-r from-[#C9A961] to-[#B8944E] text-[#0f0f10] hover:opacity-90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Parceiro
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#1a1a1c] border-[#C9A961]/20 max-w-2xl max-h-[90vh] overflow-y-auto pointer-events-auto">
              <DialogHeader>
                <DialogTitle className="text-[#C9A961] text-2xl">
                  {editingPartner ? "Editar Parceiro" : "Novo Parceiro"}
                </DialogTitle>
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
                      data-testid="partner-name-input"
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
                      data-testid="partner-email-input"
                      className="bg-white/5 border-[#C9A961]/20 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone" className="text-gray-300">Telefone *</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                      data-testid="partner-phone-input"
                      className="bg-white/5 border-[#C9A961]/20 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="nif" className="text-gray-300">NIF *</Label>
                    <Input
                      id="nif"
                      value={formData.nif}
                      onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
                      required
                      data-testid="partner-nif-input"
                      className="bg-white/5 border-[#C9A961]/20 text-white"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="address" className="text-gray-300">Morada *</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      required
                      data-testid="partner-address-input"
                      className="bg-white/5 border-[#C9A961]/20 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="iban" className="text-gray-300">IBAN *</Label>
                    <Input
                      id="iban"
                      value={formData.iban}
                      onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                      required
                      data-testid="partner-iban-input"
                      className="bg-white/5 border-[#C9A961]/20 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bank_details" className="text-gray-300">Dados Bancários *</Label>
                    <Input
                      id="bank_details"
                      value={formData.bank_details}
                      onChange={(e) => setFormData({ ...formData, bank_details: e.target.value })}
                      required
                      data-testid="partner-bank-input"
                      className="bg-white/5 border-[#C9A961]/20 text-white"
                    />
                  </div>
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
                    data-testid="save-partner-button"
                    className="bg-gradient-to-r from-[#C9A961] to-[#B8944E] text-[#0f0f10]"
                  >
                    {editingPartner ? "Atualizar" : "Criar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="glass-card p-6">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Pesquisar por nome, email ou NIF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="search-partners-input"
              className="pl-10 bg-white/5 border-[#C9A961]/20 text-white"
            />
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Telefone</th>
                <th>NIF</th>
                <th>IBAN</th>
                {canEdit && <th className="text-center">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {filteredPartners.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 6 : 5} className="text-center py-8 text-gray-400">
                    Nenhum parceiro encontrado
                  </td>
                </tr>
              ) : (
                filteredPartners.map((partner) => (
                  <tr key={partner.id} data-testid={`partner-row-${partner.id}`}>
                    <td className="font-semibold">{partner.name}</td>
                    <td>{partner.email}</td>
                    <td>{partner.phone}</td>
                    <td>{partner.nif}</td>
                    <td>{partner.iban}</td>
                    {canEdit && (
                      <td className="text-center">
                        <Button
                          onClick={() => handleEdit(partner)}
                          size="sm"
                          variant="ghost"
                          data-testid={`edit-partner-${partner.id}`}
                          className="text-[#C9A961] hover:bg-[#C9A961]/10"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </td>
                    )}
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
