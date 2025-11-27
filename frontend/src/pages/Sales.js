import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { API } from "../App";

const POWER_OPTIONS = ["1.15kVA", "2.3kVA", "3.45kVA", "4.6kVA", "5.75kVA", "6.9kVA", "10.35kVA", "13.8kVA", "17.25kVA", "20.7kVA", "27.6kVA", "34.5kVA", "41.4kVA", "Outros"];

const Sales = ({ user }) => {
  const [sales, setSales] = useState([]);
  const [partners, setPartners] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [editFormData, setEditFormData] = useState({
    status: "",
    requisition: "",
    paid_by_operator: false,
    paid_date: ""
  });
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [selectedSaleForNotes, setSelectedSaleForNotes] = useState(null);
  const [newNote, setNewNote] = useState("");
  const [uploadFiles, setUploadFiles] = useState([]);
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    partner_id: "",
    scope: "telecomunicacoes",
    client_type: "particular",
    client_name: "",
    client_nif: "",
    client_contact: "",
    client_email: "",
    client_iban: "",
    installation_address: "",
    operator_id: "",
    service_type: "",
    monthly_value: "",
    cpe: "",
    power: "",
    entry_type: "",
    cui: "",
    tier: "",
    observations: ""
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [salesRes, partnersRes, operatorsRes] = await Promise.all([
        axios.get(`${API}/sales`),
        axios.get(`${API}/partners`),
        axios.get(`${API}/operators`)
      ]);
      setSales(salesRes.data);
      setPartners(partnersRes.data);
      setOperators(operatorsRes.data);
      
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
    
    // Validações
    if (formData.cpe) {
      const cpeUpper = formData.cpe.toUpperCase();
      if (!/^PT0002\d{12}[A-Z]{2}$/.test(cpeUpper)) {
        toast.error("CPE inválido: PT0002 + 12 dígitos + 2 letras");
        return;
      }
      formData.cpe = cpeUpper;
    }
    
    if (formData.cui) {
      const cuiUpper = formData.cui.toUpperCase();
      if (!/^PT16\d{15}[A-Z]{2}$/.test(cuiUpper)) {
        toast.error("CUI inválido: PT16 + 15 dígitos + 2 letras");
        return;
      }
      formData.cui = cuiUpper;
    }

    try {
      const submitData = { ...formData };
      if (submitData.monthly_value) submitData.monthly_value = parseFloat(submitData.monthly_value);
      
      const response = await axios.post(`${API}/sales`, submitData);
      const saleId = response.data.id;
      
      // Upload documents if any
      if (uploadFiles.length > 0) {
        for (const file of uploadFiles) {
          const formData = new FormData();
          formData.append('file', file);
          await axios.post(`${API}/sales/${saleId}/documents`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        }
      }
      
      toast.success("Venda criada com sucesso!");
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao criar venda");
    }
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      partner_id: user?.role === 'partner' && partners.length > 0 ? partners[0].id : "",
      scope: "telecomunicacoes",
      client_name: "",
      client_nif: "",
      client_contact: "",
      client_email: "",
      client_iban: "",
      installation_address: "",
      operator_id: "",
      service_type: "",
      monthly_value: "",
      cpe: "",
      power: "",
      entry_type: "",
      cui: "",
      tier: "",
      observations: ""
    });
    setUploadFiles([]);
  };

  const filteredOperators = operators.filter(op => op.scope === formData.scope);
  
  const selectedOperator = operators.find(op => op.id === formData.operator_id);
  const operatorEnergyType = selectedOperator?.energy_type || '';

  const filteredSales = selectedStatus ? sales.filter(s => s.status === selectedStatus) : sales;

  const handleExportExcel = async () => {
    try {
      const params = new URLSearchParams();
      if (exportStartDate) params.append('start_date', exportStartDate);
      if (exportEndDate) params.append('end_date', exportEndDate);
      
      const response = await axios.get(`${API}/sales/export/excel?${params.toString()}`, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `vendas_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success("Excel exportado com sucesso!");
      setExportDialogOpen(false);
    } catch (error) {
      toast.error("Erro ao exportar Excel");
    }
  };

  const openEditDialog = (sale) => {
    setEditingSale(sale);
    setEditFormData({
      status: sale.status || "",
      requisition: sale.requisition || "",
      paid_by_operator: sale.paid_by_operator || false,
      paid_date: sale.paid_date ? sale.paid_date.split('T')[0] : ""
    });
    setEditDialogOpen(true);
  };

  const handleUpdateSale = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API}/sales/${editingSale.id}`, editFormData);
      toast.success("Venda atualizada com sucesso!");
      setEditDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error("Erro ao atualizar venda");
    }
  };

  const openNotesDialog = (sale) => {
    setSelectedSaleForNotes(sale);
    setNewNote("");
    setNotesDialogOpen(true);
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    
    try {
      await axios.post(`${API}/sales/${selectedSaleForNotes.id}/notes`, {
        content: newNote
      });
      toast.success("Nota adicionada!");
      setNewNote("");
      fetchData();
    } catch (error) {
      toast.error("Erro ao adicionar nota");
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Vendas</h1>
        <div className="flex gap-3">
          <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-green-500 text-green-600 hover:bg-green-50">
                <Download className="w-4 h-4 mr-2" />
                Exportar Excel
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Exportar Vendas para Excel</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Data Início (opcional)</Label>
                  <Input 
                    type="date" 
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Data Fim (opcional)</Label>
                  <Input 
                    type="date" 
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleExportExcel} className="btn-primary">
                    <Download className="w-4 h-4 mr-2" />
                    Exportar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="btn-primary"><Plus className="w-4 h-4 mr-2" />Nova Venda</Button>
            </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-2xl">Nova Venda</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data *</Label>
                  <Input type="date" value={formData.date} max={new Date().toISOString().split('T')[0]} onChange={(e) => setFormData({...formData, date: e.target.value})} required />
                </div>
                <div>
                  <Label>Parceiro *</Label>
                  <Select value={formData.partner_id} onValueChange={(v) => setFormData({...formData, partner_id: v})} disabled={user?.role === 'partner'}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {partners.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Âmbito *</Label>
                  <Select value={formData.scope} onValueChange={(v) => setFormData({...formData, scope: v, operator_id: "", service_type: "", cpe: "", cui: ""})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="telecomunicacoes">Telecomunicações</SelectItem>
                      <SelectItem value="energia">Energia</SelectItem>
                      <SelectItem value="solar">Solar</SelectItem>
                      <SelectItem value="dual">Dual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo de Cliente *</Label>
                  <Select value={formData.client_type} onValueChange={(v) => setFormData({...formData, client_type: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="particular">Particular</SelectItem>
                      <SelectItem value="empresarial">Empresarial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nome Cliente *</Label>
                  <Input value={formData.client_name} onChange={(e) => setFormData({...formData, client_name: e.target.value})} required />
                </div>
                <div>
                  <Label>NIF Cliente *</Label>
                  <Input value={formData.client_nif} onChange={(e) => setFormData({...formData, client_nif: e.target.value})} required />
                </div>
                <div>
                  <Label>Contacto Cliente *</Label>
                  <Input value={formData.client_contact} onChange={(e) => setFormData({...formData, client_contact: e.target.value})} required />
                </div>
                <div>
                  <Label>Email Cliente</Label>
                  <Input type="email" value={formData.client_email} onChange={(e) => setFormData({...formData, client_email: e.target.value})} />
                </div>
                <div>
                  <Label>IBAN Cliente</Label>
                  <Input value={formData.client_iban} onChange={(e) => setFormData({...formData, client_iban: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <Label>Morada de Instalação/Fornecimento</Label>
                  <Input value={formData.installation_address} onChange={(e) => setFormData({...formData, installation_address: e.target.value})} />
                </div>
                <div>
                  <Label>Operadora *</Label>
                  <Select value={formData.operator_id} onValueChange={(v) => setFormData({...formData, operator_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {filteredOperators.map(op => <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                
                {formData.scope === 'telecomunicacoes' && (
                  <>
                    <div>
                      <Label>Tipo Serviço *</Label>
                      <Select value={formData.service_type} onValueChange={(v) => setFormData({...formData, service_type: v})}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="M3">M3</SelectItem>
                          <SelectItem value="M4">M4</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Mensalidade (€) *</Label>
                      <Input type="number" step="0.01" value={formData.monthly_value} onChange={(e) => setFormData({...formData, monthly_value: e.target.value})} required />
                    </div>
                  </>
                )}
                
                {/* Solar - CPE + Potência */}
                {formData.scope === 'solar' && (
                  <>
                    <div>
                      <Label>CPE * (PT0002...)</Label>
                      <Input value={formData.cpe} onChange={(e) => setFormData({...formData, cpe: e.target.value.toUpperCase()})} placeholder="PT0002XXXXXXXXXXXX" required />
                    </div>
                    <div>
                      <Label>Potência *</Label>
                      <Select value={formData.power} onValueChange={(v) => setFormData({...formData, power: v})}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {POWER_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                
                {/* Energia - Campos baseados no energy_type da operadora */}
                {formData.scope === 'energia' && (
                  <>
                    {/* Eletricidade ou Dual - CPE + Potência */}
                    {(operatorEnergyType === 'eletricidade' || operatorEnergyType === 'dual') && (
                      <>
                        <div>
                          <Label>CPE * (PT0002...)</Label>
                          <Input value={formData.cpe} onChange={(e) => setFormData({...formData, cpe: e.target.value.toUpperCase()})} placeholder="PT0002XXXXXXXXXXXX" required />
                        </div>
                        <div>
                          <Label>Potência *</Label>
                          <Select value={formData.power} onValueChange={(v) => setFormData({...formData, power: v})}>
                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                            <SelectContent>
                              {POWER_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                    
                    {/* Gás ou Dual - CUI + Escalão */}
                    {(operatorEnergyType === 'gas' || operatorEnergyType === 'dual') && (
                      <>
                        <div>
                          <Label>CUI * (PT16...)</Label>
                          <Input value={formData.cui} onChange={(e) => setFormData({...formData, cui: e.target.value.toUpperCase()})} placeholder="PT16XXXXXXXXXXXXXXXXX" required />
                        </div>
                        <div>
                          <Label>Escalão *</Label>
                          <Select value={formData.tier} onValueChange={(v) => setFormData({...formData, tier: v})}>
                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                            <SelectContent>
                              {["1", "2", "3", "4"].map(t => <SelectItem key={t} value={t}>Escalão {t}</SelectItem>)}
                            </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                
                {/* Tipo de Entrada - para todas as operadoras de energia */}
                {formData.scope === 'energia' && (
                  <div className="col-span-2">
                    <Label>Tipo de Entrada *</Label>
                    <Select value={formData.entry_type} onValueChange={(v) => setFormData({...formData, entry_type: v})}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Alteração de comercializadora">Alteração de comercializadora</SelectItem>
                        <SelectItem value="Alteração de comercializadora com alteração de titular">Alteração de comercializadora com alteração de titular</SelectItem>
                        <SelectItem value="Entrada Direta">Entrada Direta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <div className="col-span-2">
                  <Label>Observações</Label>
                  <Textarea value={formData.observations} onChange={(e) => setFormData({...formData, observations: e.target.value})} rows={3} />
                </div>

                <div className="col-span-2">
                  <Label>Documentos (opcional)</Label>
                  <input
                    type="file"
                    multiple
                    onChange={(e) => setUploadFiles(Array.from(e.target.files))}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {uploadFiles.length > 0 && (
                    <p className="text-sm text-gray-600 mt-2">
                      {uploadFiles.length} ficheiro(s) selecionado(s)
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" onClick={() => setDialogOpen(false)} variant="outline">Cancelar</Button>
                <Button type="submit" className="btn-primary">Criar Venda</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <Button onClick={() => setSelectedStatus("")} variant={selectedStatus === "" ? "default" : "outline"} size="sm">Todas</Button>
        <Button onClick={() => setSelectedStatus("Para registo")} variant={selectedStatus === "Para registo" ? "default" : "outline"} size="sm">Para registo</Button>
        <Button onClick={() => setSelectedStatus("Pendente")} variant={selectedStatus === "Pendente" ? "default" : "outline"} size="sm">Pendente</Button>
        <Button onClick={() => setSelectedStatus("Concluido")} variant={selectedStatus === "Concluido" ? "default" : "outline"} size="sm">Concluído</Button>
        <Button onClick={() => setSelectedStatus("Ativo")} variant={selectedStatus === "Ativo" ? "default" : "outline"} size="sm">Ativo</Button>
        <Button onClick={() => setSelectedStatus("Cancelado")} variant={selectedStatus === "Cancelado" ? "default" : "outline"} size="sm">Cancelado</Button>
      </div>

      <div className="professional-card p-6">
        <div className="table-container overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Data</th>
                <th>Parceiro</th>
                <th>Âmbito</th>
                <th>Cliente</th>
                <th>Operadora</th>
                <th>Status</th>
                {user?.role !== 'bo' && user?.role !== 'partner_commercial' && <th>Comissão</th>}
                {(user?.role === 'admin' || user?.role === 'bo' || user?.role === 'partner') && <th className="text-center">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr><td colSpan={user?.role === 'partner_commercial' ? 7 : 9} className="text-center py-8 text-gray-400">Nenhuma venda encontrada</td></tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr key={sale.id}>
                    <td className="font-semibold text-blue-600">{sale.sale_code}</td>
                    <td>{new Date(sale.date).toLocaleDateString('pt-PT')}</td>
                    <td>{partners.find(p => p.id === sale.partner_id)?.name}</td>
                    <td className="capitalize">{sale.scope}</td>
                    <td>{sale.client_name}</td>
                    <td>{operators.find(o => o.id === sale.operator_id)?.name}</td>
                    <td><span className={`status-badge status-${sale.status.toLowerCase().replace(' ', '-')}`}>{sale.status}</span></td>
                    {user?.role !== 'bo' && user?.role !== 'partner_commercial' && (
                      <td className="font-semibold text-green-600">
                        {sale.commission ? `€${sale.commission.toFixed(2)}` : '-'}
                      </td>
                    )}
                    {(user?.role === 'admin' || user?.role === 'bo' || user?.role === 'partner') && (
                      <td className="text-center">
                        <div className="flex gap-2 justify-center">
                          {(user?.role === 'admin' || user?.role === 'bo') && (
                            <Button onClick={() => openEditDialog(sale)} size="sm" variant="ghost" className="text-blue-600">
                              Editar
                            </Button>
                          )}
                          <Button onClick={() => openNotesDialog(sale)} size="sm" variant="ghost" className="text-purple-600">
                            Notas ({sale.notes?.length || 0})
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

      {/* Edit Sale Dialog (Admin/BO) */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Venda - {editingSale?.sale_code}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateSale} className="space-y-4 mt-4">
            <div>
              <Label>Status *</Label>
              <Select value={editFormData.status} onValueChange={(v) => setEditFormData({...editFormData, status: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Para registo">Para registo</SelectItem>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="Concluido">Concluído</SelectItem>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {editingSale?.scope === 'telecomunicacoes' && (
              <div>
                <Label>Requisição (REQ)</Label>
                <Input 
                  value={editFormData.requisition}
                  onChange={(e) => setEditFormData({...editFormData, requisition: e.target.value})}
                  placeholder="Número de requisição"
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <input 
                type="checkbox"
                id="paid_by_operator"
                checked={editFormData.paid_by_operator}
                onChange={(e) => setEditFormData({...editFormData, paid_by_operator: e.target.checked})}
                className="w-4 h-4"
              />
              <Label htmlFor="paid_by_operator">Paga pelo Operador</Label>
            </div>

            {editFormData.paid_by_operator && (
              <div>
                <Label>Data de Pagamento</Label>
                <Input 
                  type="date"
                  value={editFormData.paid_date}
                  onChange={(e) => setEditFormData({...editFormData, paid_date: e.target.value})}
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="btn-primary">
                Guardar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Notes Dialog */}
      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Notas - {selectedSaleForNotes?.sale_code}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* Add Note */}
            <div className="space-y-2">
              <Label>Adicionar Nota</Label>
              <Textarea 
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Escreva uma nota..."
                rows={3}
              />
              <Button onClick={handleAddNote} size="sm" className="btn-primary">
                Adicionar Nota
              </Button>
            </div>

            {/* Notes List */}
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900">Histórico de Notas:</h3>
              {(!selectedSaleForNotes?.notes || selectedSaleForNotes.notes.length === 0) ? (
                <p className="text-gray-500 text-sm py-4 text-center">Nenhuma nota ainda</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {selectedSaleForNotes.notes.map((note) => (
                    <div key={note.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-sm">{note.author}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(note.created_at).toLocaleString('pt-PT')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{note.content}</p>
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

export default Sales;
