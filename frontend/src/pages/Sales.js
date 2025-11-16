import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Pencil, Download, Filter, Upload, FileText, Trash2, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { API } from "../App";

const Sales = ({ user }) => {
  const [sales, setSales] = useState([]);
  const [partners, setPartners] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [documentsDialogOpen, setDocumentsDialogOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [filterOperator, setFilterOperator] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    value: "",
    operator_id: "default",
    partner_id: "default",
    final_client: "",
    sale_type: "eletricidade",
    cpe: "",
  });
  const [editFormData, setEditFormData] = useState({
    date: "",
    value: "",
    operator_id: "",
    final_client: "",
    sale_type: "",
    cpe: "",
    commission: "",
    status: "Pendente",
    requisition: "",
  });
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [salesRes, partnersRes, operatorsRes] = await Promise.all([
        axios.get(`${API}/sales`),
        axios.get(`${API}/partners`),
        axios.get(`${API}/operators`),
      ]);
      setSales(salesRes.data);
      setPartners(partnersRes.data);
      setOperators(operatorsRes.data);
      
      // Set default partner for partner users
      if (user?.role === 'partner' && partnersRes.data.length > 0) {
        setFormData(prev => ({ ...prev, partner_id: partnersRes.data[0].id }));
      }
    } catch (error) {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/sales`, {
        ...formData,
        value: parseFloat(formData.value),
      });
      toast.success("Venda criada com sucesso!");
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao criar venda");
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const updateData = {};
      if (editFormData.date) updateData.date = editFormData.date;
      if (editFormData.value) updateData.value = parseFloat(editFormData.value);
      if (editFormData.operator_id) updateData.operator_id = editFormData.operator_id;
      if (editFormData.final_client) updateData.final_client = editFormData.final_client;
      if (editFormData.sale_type) updateData.sale_type = editFormData.sale_type;
      if (editFormData.cpe) updateData.cpe = editFormData.cpe;
      if (editFormData.commission) updateData.commission = parseFloat(editFormData.commission);
      if (editFormData.status) updateData.status = editFormData.status;
      if (editFormData.requisition) updateData.requisition = editFormData.requisition;

      await axios.put(`${API}/sales/${editingSale.id}`, updateData);
      toast.success("Venda atualizada com sucesso!");
      setEditDialogOpen(false);
      setEditingSale(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao atualizar venda");
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !selectedSale) return;

    setAddingNote(true);
    try {
      await axios.post(`${API}/sales/${selectedSale.id}/notes`, {
        content: newNote,
      });

      toast.success("Nota adicionada com sucesso!");
      setNewNote("");
      
      // Refresh selected sale
      const response = await axios.get(`${API}/sales/${selectedSale.id}`);
      setSelectedSale(response.data);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao adicionar nota");
    } finally {
      setAddingNote(false);
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (filterOperator && filterOperator !== 'all') params.append('operator_id', filterOperator);
      
      const response = await axios.get(`${API}/sales/export/excel?${params.toString()}`, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'vendas.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success("Exportação concluída!");
    } catch (error) {
      toast.error("Erro ao exportar vendas");
    }
  };

  const handleViewDocuments = (sale) => {
    setSelectedSale(sale);
    setDocumentsDialogOpen(true);
  };

  const handleUploadDocument = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !selectedSale) return;

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      await axios.post(`${API}/sales/${selectedSale.id}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success("Documento anexado com sucesso!");
      fetchData();
      
      // Refresh selected sale
      const response = await axios.get(`${API}/sales/${selectedSale.id}`);
      setSelectedSale(response.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao anexar documento");
    } finally {
      setUploadingFile(false);
      event.target.value = '';
    }
  };

  const handleDownloadDocument = async (documentId, filename) => {
    try {
      const response = await axios.get(
        `${API}/sales/${selectedSale.id}/documents/${documentId}`,
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success("Download concluído!");
    } catch (error) {
      toast.error("Erro ao fazer download");
    }
  };

  const handleDeleteDocument = async (documentId) => {
    if (!window.confirm("Tem certeza que deseja eliminar este documento?")) return;

    try {
      await axios.delete(`${API}/sales/${selectedSale.id}/documents/${documentId}`);
      toast.success("Documento eliminado com sucesso!");
      
      // Refresh selected sale
      const response = await axios.get(`${API}/sales/${selectedSale.id}`);
      setSelectedSale(response.data);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao eliminar documento");
    }
  };

  const resetForm = () => {
    const defaultPartnerId = user?.role === 'partner' && partners.length > 0 ? partners[0].id : operators.length > 0 ? operators[0].id : "default";
    setFormData({
      date: new Date().toISOString().split('T')[0],
      value: "",
      operator_id: operators.length > 0 ? operators[0].id : "default",
      partner_id: user?.role === 'partner' && partners.length > 0 ? partners[0].id : (partners.length > 0 ? partners[0].id : "default"),
      final_client: "",
      sale_type: "eletricidade",
      cpe: "",
    });
  };

  const handleEdit = (sale) => {
    setEditingSale(sale);
    setEditFormData({
      date: sale.date || "",
      value: sale.value ? sale.value.toString() : "",
      operator_id: sale.operator_id || "",
      final_client: sale.final_client || "",
      sale_type: sale.sale_type || "",
      cpe: sale.cpe || "",
      commission: sale.commission ? sale.commission.toString() : "",
      status: sale.status || "Pendente",
      requisition: sale.requisition || "",
    });
    setEditDialogOpen(true);
  };

  const getPartnerName = (partnerId) => {
    const partner = partners.find(p => p.id === partnerId);
    return partner ? partner.name : 'N/A';
  };

  const getOperatorName = (operatorId) => {
    const operator = operators.find(o => o.id === operatorId);
    return operator ? operator.name : 'N/A';
  };

  const filteredSales = sales.filter(sale => {
    if (filterOperator && filterOperator !== 'all' && sale.operator_id !== filterOperator) return false;
    if (filterStatus && filterStatus !== 'all' && sale.status !== filterStatus) return false;
    return true;
  });

  const canEdit = user?.role === 'admin' || user?.role === 'bo';
  const canExport = user?.role === 'admin' || user?.role === 'bo';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#C9A961]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="sales-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-4xl font-bold">Vendas</h1>
        <div className="flex gap-2">
          {canExport && (
            <Button
              onClick={handleExport}
              data-testid="export-sales-button"
              variant="outline"
              className="border-[#C9A961]/20 text-[#C9A961]"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar Excel
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={resetForm}
                data-testid="add-sale-button"
                className="bg-gradient-to-r from-[#C9A961] to-[#B8944E] text-[#0f0f10]"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nova Venda
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#1a1a1c] border-[#C9A961]/20 max-w-2xl max-h-[90vh] overflow-y-auto pointer-events-auto">
              <DialogHeader>
                <DialogTitle className="text-[#C9A961] text-2xl">Nova Venda</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="date" className="text-gray-300">Data *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                      data-testid="sale-date-input"
                      className="bg-white/5 border-[#C9A961]/20 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="value" className="text-gray-300">Valor (€) *</Label>
                    <Input
                      id="value"
                      type="number"
                      step="0.01"
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                      required
                      data-testid="sale-value-input"
                      className="bg-white/5 border-[#C9A961]/20 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="operator" className="text-gray-300">Operadora *</Label>
                    <Select value={formData.operator_id} onValueChange={(value) => setFormData({ ...formData, operator_id: value })}>
                      <SelectTrigger data-testid="sale-operator-select" className="bg-white/5 border-[#C9A961]/20 text-white">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1a1c] border-[#C9A961]/20">
                        {operators.map(op => (
                          <SelectItem key={op.id} value={op.id} className="text-white">{op.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="partner" className="text-gray-300">Parceiro *</Label>
                    <Select 
                      value={formData.partner_id} 
                      onValueChange={(value) => setFormData({ ...formData, partner_id: value })}
                      disabled={user?.role === 'partner'}
                    >
                      <SelectTrigger data-testid="sale-partner-select" className="bg-white/5 border-[#C9A961]/20 text-white">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1a1c] border-[#C9A961]/20">
                        {partners.map(p => (
                          <SelectItem key={p.id} value={p.id} className="text-white">{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="sale_type" className="text-gray-300">Tipo de Venda *</Label>
                    <Select value={formData.sale_type} onValueChange={(value) => setFormData({ ...formData, sale_type: value, cpe: "" })}>
                      <SelectTrigger data-testid="sale-type-select" className="bg-white/5 border-[#C9A961]/20 text-white">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1a1c] border-[#C9A961]/20">
                        <SelectItem value="eletricidade" className="text-white">Eletricidade</SelectItem>
                        <SelectItem value="telecomunicacoes" className="text-white">Telecomunicações</SelectItem>
                        <SelectItem value="solar" className="text-white">Solar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(formData.sale_type === 'eletricidade' || formData.sale_type === 'solar') && (
                    <div>
                      <Label htmlFor="cpe" className="text-gray-300">CPE *</Label>
                      <Input
                        id="cpe"
                        value={formData.cpe}
                        onChange={(e) => setFormData({ ...formData, cpe: e.target.value })}
                        required
                        data-testid="sale-cpe-input"
                        className="bg-white/5 border-[#C9A961]/20 text-white"
                      />
                    </div>
                  )}
                  <div className="md:col-span-2">
                    <Label htmlFor="final_client" className="text-gray-300">Cliente Final *</Label>
                    <Input
                      id="final_client"
                      value={formData.final_client}
                      onChange={(e) => setFormData({ ...formData, final_client: e.target.value })}
                      required
                      data-testid="sale-client-input"
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
                    data-testid="save-sale-button"
                    className="bg-gradient-to-r from-[#C9A961] to-[#B8944E] text-[#0f0f10]"
                  >
                    Criar Venda
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Filter className="w-4 h-4 text-[#C9A961]" />
          <span className="text-sm font-semibold">Filtros</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-gray-300 text-sm">Operadora</Label>
            <Select value={filterOperator} onValueChange={setFilterOperator}>
              <SelectTrigger className="bg-white/5 border-[#C9A961]/20 text-white">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1c] border-[#C9A961]/20">
                <SelectItem value="all" className="text-white">Todas</SelectItem>
                {operators.map(op => (
                  <SelectItem key={op.id} value={op.id} className="text-white">{op.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-gray-300 text-sm">Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="bg-white/5 border-[#C9A961]/20 text-white">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1c] border-[#C9A961]/20">
                <SelectItem value="all" className="text-white">Todos</SelectItem>
                <SelectItem value="Pendente" className="text-white">Pendente</SelectItem>
                <SelectItem value="Aprovada" className="text-white">Aprovada</SelectItem>
                <SelectItem value="Rejeitada" className="text-white">Rejeitada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Sales Table */}
      <div className="glass-card p-6">
        <div className="table-container overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Parceiro</th>
                <th>Operadora</th>
                <th>Tipo</th>
                <th>Cliente</th>
                <th>Valor</th>
                {user?.role !== 'bo' && <th>Comissão</th>}
                <th>Status</th>
                <th className="text-center">Docs</th>
                {canEdit && <th className="text-center">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? (user?.role !== 'bo' ? 10 : 9) : (user?.role !== 'bo' ? 9 : 8)} className="text-center py-8 text-gray-400">
                    Nenhuma venda encontrada
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr key={sale.id} data-testid={`sale-row-${sale.id}`}>
                    <td>{new Date(sale.date).toLocaleDateString('pt-PT')}</td>
                    <td>{getPartnerName(sale.partner_id)}</td>
                    <td>{getOperatorName(sale.operator_id)}</td>
                    <td className="capitalize">{sale.sale_type}</td>
                    <td>{sale.final_client}</td>
                    <td className="font-semibold">€{sale.value.toFixed(2)}</td>
                    {user?.role !== 'bo' && (
                      <td className="gold-text font-semibold">
                        {sale.commission ? `€${sale.commission.toFixed(2)}` : '-'}
                      </td>
                    )}
                    <td>
                      <span className={`status-badge status-${sale.status.toLowerCase()}`}>
                        {sale.status}
                      </span>
                    </td>
                    <td className="text-center">
                      <Button
                        onClick={() => handleViewDocuments(sale)}
                        size="sm"
                        variant="ghost"
                        data-testid={`view-docs-${sale.id}`}
                        className="text-blue-400 hover:bg-blue-400/10"
                      >
                        <FileText className="w-4 h-4" />
                        {sale.documents?.length > 0 && (
                          <span className="ml-1 text-xs">({sale.documents.length})</span>
                        )}
                      </Button>
                    </td>
                    {canEdit && (
                      <td className="text-center">
                        <Button
                          onClick={() => handleEdit(sale)}
                          size="sm"
                          variant="ghost"
                          data-testid={`edit-sale-${sale.id}`}
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

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-[#1a1a1c] border-[#C9A961]/20 max-w-3xl max-h-[90vh] overflow-y-auto pointer-events-auto">
          <DialogHeader>
            <DialogTitle className="text-[#C9A961] text-2xl">Editar Venda</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-date" className="text-gray-300">Data</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={editFormData.date}
                  onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                  data-testid="edit-date-input"
                  className="bg-white/5 border-[#C9A961]/20 text-white"
                />
              </div>
              <div>
                <Label htmlFor="edit-value" className="text-gray-300">Valor (€)</Label>
                <Input
                  id="edit-value"
                  type="number"
                  step="0.01"
                  value={editFormData.value}
                  onChange={(e) => setEditFormData({ ...editFormData, value: e.target.value })}
                  data-testid="edit-value-input"
                  className="bg-white/5 border-[#C9A961]/20 text-white"
                />
              </div>
              <div>
                <Label htmlFor="edit-operator" className="text-gray-300">Operadora</Label>
                <Select value={editFormData.operator_id} onValueChange={(value) => setEditFormData({ ...editFormData, operator_id: value })}>
                  <SelectTrigger data-testid="edit-operator-select" className="bg-white/5 border-[#C9A961]/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1c] border-[#C9A961]/20">
                    {operators.map(op => (
                      <SelectItem key={op.id} value={op.id} className="text-white">{op.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-sale-type" className="text-gray-300">Tipo de Venda</Label>
                <Select value={editFormData.sale_type} onValueChange={(value) => setEditFormData({ ...editFormData, sale_type: value })}>
                  <SelectTrigger data-testid="edit-sale-type-select" className="bg-white/5 border-[#C9A961]/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1c] border-[#C9A961]/20">
                    <SelectItem value="eletricidade" className="text-white">Eletricidade</SelectItem>
                    <SelectItem value="telecomunicacoes" className="text-white">Telecomunicações</SelectItem>
                    <SelectItem value="solar" className="text-white">Solar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="edit-final-client" className="text-gray-300">Cliente Final</Label>
                <Input
                  id="edit-final-client"
                  value={editFormData.final_client}
                  onChange={(e) => setEditFormData({ ...editFormData, final_client: e.target.value })}
                  data-testid="edit-client-input"
                  className="bg-white/5 border-[#C9A961]/20 text-white"
                />
              </div>
              {(editFormData.sale_type === 'eletricidade' || editFormData.sale_type === 'solar') && (
                <div>
                  <Label htmlFor="edit-cpe" className="text-gray-300">CPE</Label>
                  <Input
                    id="edit-cpe"
                    value={editFormData.cpe}
                    onChange={(e) => setEditFormData({ ...editFormData, cpe: e.target.value })}
                    data-testid="edit-cpe-input"
                    className="bg-white/5 border-[#C9A961]/20 text-white"
                  />
                </div>
              )}
              {editFormData.sale_type === 'telecomunicacoes' && (
                <div>
                  <Label htmlFor="edit-requisition" className="text-gray-300">Requisição</Label>
                  <Input
                    id="edit-requisition"
                    value={editFormData.requisition}
                    onChange={(e) => setEditFormData({ ...editFormData, requisition: e.target.value })}
                    data-testid="edit-requisition-input"
                    className="bg-white/5 border-[#C9A961]/20 text-white"
                  />
                </div>
              )}
              <div>
                <Label htmlFor="edit-status" className="text-gray-300">Status</Label>
                <Select value={editFormData.status} onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}>
                  <SelectTrigger data-testid="edit-status-select" className="bg-white/5 border-[#C9A961]/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1c] border-[#C9A961]/20">
                    <SelectItem value="Pendente" className="text-white">Pendente</SelectItem>
                    <SelectItem value="Aprovada" className="text-white">Aprovada</SelectItem>
                    <SelectItem value="Rejeitada" className="text-white">Rejeitada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {user?.role === 'admin' && (
                <div>
                  <Label htmlFor="edit-commission" className="text-gray-300">Comissão (€)</Label>
                  <Input
                    id="edit-commission"
                    type="number"
                    step="0.01"
                    value={editFormData.commission}
                    onChange={(e) => setEditFormData({ ...editFormData, commission: e.target.value })}
                    data-testid="edit-commission-input"
                    className="bg-white/5 border-[#C9A961]/20 text-white"
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button
                type="button"
                onClick={() => setEditDialogOpen(false)}
                variant="outline"
                className="border-[#C9A961]/20 text-gray-300"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                data-testid="update-sale-button"
                className="bg-gradient-to-r from-[#C9A961] to-[#B8944E] text-[#0f0f10]"
              >
                Atualizar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Documents Dialog */}
      <Dialog open={documentsDialogOpen} onOpenChange={setDocumentsDialogOpen}>
        <DialogContent className="bg-[#1a1a1c] border-[#C9A961]/20 max-w-2xl pointer-events-auto">
          <DialogHeader>
            <DialogTitle className="text-[#C9A961] text-2xl">Documentos da Venda</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* Upload section */}
            <div className="border-2 border-dashed border-[#C9A961]/30 rounded-lg p-6 text-center">
              <Upload className="w-12 h-12 mx-auto mb-4 text-[#C9A961]" />
              <p className="text-gray-400 mb-4">Anexar documento à venda</p>
              <input
                type="file"
                onChange={handleUploadDocument}
                disabled={uploadingFile}
                data-testid="upload-document-input"
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button
                  type="button"
                  disabled={uploadingFile}
                  data-testid="upload-document-button"
                  className="bg-gradient-to-r from-[#C9A961] to-[#B8944E] text-[#0f0f10] cursor-pointer"
                  onClick={() => document.getElementById('file-upload').click()}
                >
                  {uploadingFile ? "A carregar..." : "Selecionar Ficheiro"}
                </Button>
              </label>
            </div>

            {/* Documents list */}
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-300 mb-2">Documentos anexados:</h3>
              {selectedSale?.documents && selectedSale.documents.length > 0 ? (
                <div className="space-y-2">
                  {selectedSale.documents.map((doc) => (
                    <div
                      key={doc.id}
                      data-testid={`document-${doc.id}`}
                      className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-[#C9A961]" />
                        <div>
                          <p className="font-medium">{doc.filename}</p>
                          <p className="text-xs text-gray-400">
                            Por {doc.uploaded_by} • {new Date(doc.uploaded_at).toLocaleString('pt-PT')}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleDownloadDocument(doc.id, doc.filename)}
                          size="sm"
                          variant="ghost"
                          data-testid={`download-doc-${doc.id}`}
                          className="text-green-400 hover:bg-green-400/10"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        {user?.role !== 'partner' && (
                          <Button
                            onClick={() => handleDeleteDocument(doc.id)}
                            size="sm"
                            variant="ghost"
                            data-testid={`delete-doc-${doc.id}`}
                            className="text-red-400 hover:bg-red-400/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-400 py-4">Nenhum documento anexado</p>
              )}
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <Button
              onClick={() => setDocumentsDialogOpen(false)}
              className="bg-gradient-to-r from-[#C9A961] to-[#B8944E] text-[#0f0f10]"
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Sales;
