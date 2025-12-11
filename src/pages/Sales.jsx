import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Download, ArrowUpDown, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { salesService } from "../services/salesService";
import { partnersService } from "../services/partnersService";
import { operatorsService } from "../services/operatorsService";

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
  const [sortField, setSortField] = useState("created_at");
  const [sortDirection, setSortDirection] = useState("desc");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [editFormData, setEditFormData] = useState({
    status: "",
    requisition: "",
    paid_by_operator: false,
    paid_date: "",
    manual_commission: ""
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
    activation_type: "",
    monthly_value: "",
    energy_sale_type: "",
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
      const [salesData, partnersData, operatorsData] = await Promise.all([
        salesService.getAll(),
        partnersService.getAll(),
        operatorsService.getAll()
      ]);
      setSales(salesData);
      setPartners(partnersData);
      setOperators(operatorsData);

      if (user?.role === 'partner' && partnersData.length > 0) {
        setFormData(prev => ({ ...prev, partner_id: partnersData[0].id }));
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
      const submitData = { ...formData };
      if (submitData.monthly_value) submitData.monthly_value = parseFloat(submitData.monthly_value);

      const result = await salesService.create(submitData);

      toast.success("Venda criada com sucesso!");
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.message || "Erro ao criar venda");
    }
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      partner_id: user?.role === 'partner' && partners.length > 0 ? partners[0].id : "",
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
      activation_type: "",
      monthly_value: "",
      energy_sale_type: "",
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

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const filteredSales = selectedStatus ? sales.filter(s => s.status === selectedStatus) : sales;
  
  const sortedSales = [...filteredSales].sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];
    
    // Handle nested values
    if (sortField === 'partner_name') {
      aValue = partners.find(p => p.id === a.partner_id)?.name || '';
      bValue = partners.find(p => p.id === b.partner_id)?.name || '';
    }
    if (sortField === 'operator_name') {
      aValue = operators.find(o => o.id === a.operator_id)?.name || '';
      bValue = operators.find(o => o.id === b.operator_id)?.name || '';
    }
    
    // Handle null/undefined
    if (aValue == null) aValue = '';
    if (bValue == null) bValue = '';
    
    // Sort
    if (typeof aValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue) 
        : bValue.localeCompare(aValue);
    }
    return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
  });

  const handleExportExcel = async () => {
    try {
      let dataToExport = [...sales];

      // Filtrar por data se especificado
      if (exportStartDate) {
        dataToExport = dataToExport.filter(sale => new Date(sale.date) >= new Date(exportStartDate));
      }
      if (exportEndDate) {
        dataToExport = dataToExport.filter(sale => new Date(sale.date) <= new Date(exportEndDate));
      }

      if (dataToExport.length === 0) {
        toast.error("Nenhuma venda encontrada para exportar");
        return;
      }

      // Preparar dados para Excel
      const excelData = dataToExport.map(sale => {
        const partner = partners.find(p => p.id === sale.partner_id);
        const operator = operators.find(o => o.id === sale.operator_id);
        const commission = sale.manual_commission || sale.calculated_commission || 0;

        return {
          'Código': sale.sale_code,
          'Data': new Date(sale.date).toLocaleDateString('pt-PT'),
          'Parceiro': partner?.name || '',
          'Âmbito': sale.scope,
          'Tipo Cliente': sale.client_type,
          'Nome Cliente': sale.client_name,
          'NIF': sale.client_nif,
          'Contacto': sale.client_contact,
          'Email': sale.client_email || '',
          'IBAN': sale.client_iban || '',
          'Morada Instalação': sale.installation_address || '',
          'Operadora': operator?.name || '',
          'Tipo Serviço': sale.service_type || '',
          'Tipo Ativação': sale.activation_type || '',
          'Valor Mensal': sale.monthly_value ? `€${sale.monthly_value}` : '',
          'Tipo Venda Energia': sale.energy_sale_type || '',
          'CPE': sale.cpe || '',
          'Potência': sale.power || '',
          'CUI': sale.cui || '',
          'Escalão': sale.tier || '',
          'Tipo Entrada': sale.entry_type || '',
          'Status': sale.status,
          'Nº Requisição': sale.request_number || '',
          'Comissão': `€${commission.toFixed(2)}`,
          'Paga Operador': sale.paid_to_operator ? 'Sim' : 'Não',
          'Data Pagamento': sale.payment_date ? new Date(sale.payment_date).toLocaleDateString('pt-PT') : '',
          'Observações': sale.observations || ''
        };
      });

      // Criar workbook e worksheet
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Vendas');

      // Gerar e fazer download
      const fileName = `vendas_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success(`Exportadas ${dataToExport.length} vendas`);
      setExportDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao exportar Excel");
    }
  };

  const openEditDialog = (sale) => {
    setEditingSale(sale);
    setEditFormData({
      status: sale.status || "",
      request_number: sale.request_number || "",
      paid_to_operator: sale.paid_to_operator || false,
      payment_date: sale.payment_date ? sale.payment_date.split('T')[0] : "",
      manual_commission: sale.manual_commission || ""
    });
    setEditDialogOpen(true);
  };

  const handleUpdateSale = async (e) => {
    e.preventDefault();
    try {
      await salesService.update(editingSale.id, editFormData);
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
      await salesService.addNote(selectedSaleForNotes.id, newNote);
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
                <div className={formData.scope === 'energia' ? '' : 'col-span-2'}>
                  <Label>Operadora *</Label>
                  <Select value={formData.operator_id} onValueChange={(v) => {
                    const operator = operators.find(op => op.id === v);
                    setFormData({
                      ...formData,
                      operator_id: v,
                      energy_sale_type: operator?.energy_type === 'dual' ? '' : (operator?.energy_type || ''),
                      cpe: '',
                      power: '',
                      cui: '',
                      tier: ''
                    });
                  }}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {filteredOperators.map(op => (
                        <SelectItem key={op.id} value={op.id}>
                          {op.name}
                          {op.energy_type && ` (${
                            op.energy_type === 'eletricidade' ? '⚡ Eletricidade' :
                            op.energy_type === 'gas' ? '🔥 Gás' :
                            '⚡🔥 Dual'
                          })`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tipo de Venda de Energia - apenas para operadoras Dual */}
                {formData.scope === 'energia' && operatorEnergyType === 'dual' && (
                  <div>
                    <Label>Tipo de Venda *</Label>
                    <Select value={formData.energy_sale_type} onValueChange={(v) => setFormData({...formData, energy_sale_type: v, cpe: '', power: '', cui: '', tier: ''})}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="eletricidade">⚡ Apenas Eletricidade</SelectItem>
                        <SelectItem value="gas">🔥 Apenas Gás</SelectItem>
                        <SelectItem value="dual">⚡🔥 Dual (Ambos)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
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
                    {selectedOperator?.activation_types && selectedOperator.activation_types.length > 0 && (
                      <div>
                        <Label>Tipo de Ativação *</Label>
                        <Select value={formData.activation_type} onValueChange={(v) => setFormData({...formData, activation_type: v})}>
                          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>
                            {selectedOperator.activation_types.map(type => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
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
                
                {/* Energia - Campos baseados no tipo de venda */}
                {formData.scope === 'energia' && formData.operator_id && (
                  <>
                    {/* Determinar que campos mostrar baseado no tipo de operadora e tipo de venda */}
                    {(() => {
                      const saleType = operatorEnergyType === 'dual' ? formData.energy_sale_type : operatorEnergyType;
                      const showElectricity = saleType === 'eletricidade' || saleType === 'dual';
                      const showGas = saleType === 'gas' || saleType === 'dual';

                      return (
                        <>
                          {/* Eletricidade - CPE + Potência */}
                          {showElectricity && (
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

                          {/* Gás - CUI + Escalão */}
                          {showGas && (
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
                        </>
                      );
                    })()}

                    {/* Tipo de Entrada - para todas as operadoras de energia */}
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
                  </>
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
                <th onClick={() => handleSort('sale_code')} className="cursor-pointer hover:bg-gray-50">
                  <div className="flex items-center gap-1">
                    Código <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th onClick={() => handleSort('date')} className="cursor-pointer hover:bg-gray-50">
                  <div className="flex items-center gap-1">
                    Data <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th onClick={() => handleSort('partner_name')} className="cursor-pointer hover:bg-gray-50">
                  <div className="flex items-center gap-1">
                    Parceiro <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th onClick={() => handleSort('scope')} className="cursor-pointer hover:bg-gray-50">
                  <div className="flex items-center gap-1">
                    Âmbito <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th onClick={() => handleSort('client_name')} className="cursor-pointer hover:bg-gray-50">
                  <div className="flex items-center gap-1">
                    Cliente <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th onClick={() => handleSort('operator_name')} className="cursor-pointer hover:bg-gray-50">
                  <div className="flex items-center gap-1">
                    Operadora <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th onClick={() => handleSort('status')} className="cursor-pointer hover:bg-gray-50">
                  <div className="flex items-center gap-1">
                    Status <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                {user?.role !== 'bo' && user?.role !== 'partner_commercial' && (
                  <th onClick={() => handleSort('commission')} className="cursor-pointer hover:bg-gray-50">
                    <div className="flex items-center gap-1">
                      Comissão <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                )}
                {(user?.role === 'admin' || user?.role === 'bo' || user?.role === 'partner') && <th className="text-center">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr><td colSpan={user?.role === 'partner_commercial' ? 7 : 9} className="text-center py-8 text-gray-400">Nenhuma venda encontrada</td></tr>
              ) : (
                sortedSales.map((sale) => (
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
                        {(() => {
                          const commission = sale.manual_commission || sale.calculated_commission;
                          return commission ? `€${parseFloat(commission).toFixed(2)}` : '-';
                        })()}
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
              <Select
                value={editFormData.status}
                onValueChange={(v) => {
                  const newFormData = {...editFormData, status: v};
                  if (v !== 'Ativo') {
                    newFormData.paid_to_operator = false;
                    newFormData.payment_date = "";
                  }
                  setEditFormData(newFormData);
                }}
              >
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
                  value={editFormData.request_number}
                  onChange={(e) => setEditFormData({...editFormData, request_number: e.target.value})}
                  placeholder="Número de requisição"
                />
              </div>
            )}

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="paid_to_operator"
                  checked={editFormData.paid_to_operator}
                  onChange={(e) => setEditFormData({...editFormData, paid_to_operator: e.target.checked})}
                  disabled={editFormData.status !== 'Ativo'}
                  className="w-4 h-4 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <Label htmlFor="paid_to_operator" className={editFormData.status !== 'Ativo' ? 'text-gray-400' : ''}>
                  Paga pelo Operador
                </Label>
              </div>
              {editFormData.status !== 'Ativo' && (
                <p className="text-xs text-gray-500">Apenas disponível para vendas com estado "Ativo"</p>
              )}
            </div>

            {editFormData.paid_to_operator && (
              <div>
                <Label>Data de Pagamento</Label>
                <Input
                  type="date"
                  value={editFormData.payment_date}
                  onChange={(e) => setEditFormData({...editFormData, payment_date: e.target.value})}
                />
              </div>
            )}

            {(() => {
              const saleOperator = operators.find(op => op.id === editingSale?.operator_id);
              return (saleOperator?.commission_mode === 'manual' || editingSale?.scope === 'solar') && (
                <div>
                  <Label>Comissão Manual (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editFormData.manual_commission}
                    onChange={(e) => setEditFormData({...editFormData, manual_commission: e.target.value})}
                    placeholder="Definir comissão"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {saleOperator?.commission_mode === 'manual'
                      ? 'Operadora com comissão definida ao contrato'
                      : 'Comissão para venda Solar'}
                  </p>
                </div>
              );
            })()}

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
