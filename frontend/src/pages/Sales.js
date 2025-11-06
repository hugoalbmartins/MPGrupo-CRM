import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Pencil, Download, Filter } from "lucide-react";
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
  const [filterOperator, setFilterOperator] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    value: "",
    operator_id: "",
    partner_id: "",
    final_client: "",
    sale_type: "",
    cpe: "",
  });
  const [editFormData, setEditFormData] = useState({
    commission: "",
    status: "",
    requisition: "",
  });

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

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (filterOperator) params.append('operator_id', filterOperator);
      
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

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      value: "",
      operator_id: "",
      partner_id: user?.role === 'partner' && partners.length > 0 ? partners[0].id : "",
      final_client: "",
      sale_type: "",
      cpe: "",
    });
  };

  const handleEdit = (sale) => {
    setEditingSale(sale);
    setEditFormData({
      commission: sale.commission || "",
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
            <DialogContent className="bg-[#1a1a1c] border-[#C9A961]/20 max-w-2xl max-h-[90vh] overflow-y-auto">
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
                {canEdit && <th className="text-center">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? (user?.role !== 'bo' ? 9 : 8) : (user?.role !== 'bo' ? 8 : 7)} className="text-center py-8 text-gray-400">
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
        <DialogContent className="bg-[#1a1a1c] border-[#C9A961]/20">
          <DialogHeader>
            <DialogTitle className="text-[#C9A961] text-2xl">Editar Venda</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 mt-4">
            <div>
              <Label htmlFor="status" className="text-gray-300">Status</Label>
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
                <Label htmlFor="commission" className="text-gray-300">Comissão (€)</Label>
                <Input
                  id="commission"
                  type="number"
                  step="0.01"
                  value={editFormData.commission}
                  onChange={(e) => setEditFormData({ ...editFormData, commission: e.target.value })}
                  data-testid="edit-commission-input"
                  className="bg-white/5 border-[#C9A961]/20 text-white"
                />
              </div>
            )}
            {editingSale?.sale_type === 'telecomunicacoes' && (
              <div>
                <Label htmlFor="requisition" className="text-gray-300">Requisição</Label>
                <Input
                  id="requisition"
                  value={editFormData.requisition}
                  onChange={(e) => setEditFormData({ ...editFormData, requisition: e.target.value })}
                  data-testid="edit-requisition-input"
                  className="bg-white/5 border-[#C9A961]/20 text-white"
                />
              </div>
            )}
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
    </div>
  );
};

export default Sales;
