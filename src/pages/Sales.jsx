import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Download, ArrowUpDown, Trash2, Paperclip, AlertTriangle, Filter, X as XIcon, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { salesService } from "../services/salesService";
import { partnersService } from "../services/partnersService";
import { operatorsService } from "../services/operatorsService";
import { energyPointsService } from "../services/energyPointsService";
import { supabase } from "../lib/supabase";
import SaleDetailDialog from "../components/SaleDetailDialog";
import EnergyPointsManager from "../components/EnergyPointsManager";

const POWER_OPTIONS = ["1.15kVA", "2.3kVA", "3.45kVA", "4.6kVA", "5.75kVA", "6.9kVA", "10.35kVA", "13.8kVA", "17.25kVA", "20.7kVA", "27.6kVA", "34.5kVA", "41.4kVA", "Outros"];

const Sales = ({ user }) => {
  const [sales, setSales] = useState([]);
  const [partners, setPartners] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState("sales");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedPartner, setSelectedPartner] = useState("all");
  const [selectedOperator, setSelectedOperator] = useState("all");
  const [selectedScope, setSelectedScope] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [sortField, setSortField] = useState("created_at");
  const [sortDirection, setSortDirection] = useState("desc");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [editFormData, setEditFormData] = useState({
    status: "",
    request_number: "",
    paid_to_operator: false,
    payment_date: "",
    manual_commission: ""
  });
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [selectedSaleForNotes, setSelectedSaleForNotes] = useState(null);
  const [newNote, setNewNote] = useState("");
  const [uploadFiles, setUploadFiles] = useState([]);
  const [noteAttachments, setNoteAttachments] = useState([]);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState(null);
  const [validationWarnings, setValidationWarnings] = useState([]);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [operatorCommissions, setOperatorCommissions] = useState([]);
  const [availableServiceTypes, setAvailableServiceTypes] = useState([]);
  const [availableActivationTypes, setAvailableActivationTypes] = useState([]);

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
    street: "",
    postal_code: "",
    locality: "",
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
    has_direct_debit: false,
    has_electronic_invoice: false,
    has_tv: false,
    has_net: false,
    has_lr: false,
    mobile_count: 0,
    observations: "",
    is_proposal: false,
    energy_points: []
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

    if (!formData.partner_id) {
      toast.error("Selecione um parceiro!");
      return;
    }

    if (operatorCommissions.length === 0) {
      toast.error("Não é possível criar venda: operadora sem comissões configuradas!");
      return;
    }

    if (formData.scope === 'telecomunicacoes') {
      if (availableServiceTypes.length === 0) {
        toast.error("Operadora não tem tipos de serviço com comissões configuradas!");
        return;
      }
      if (!availableServiceTypes.includes(formData.service_type)) {
        toast.error("Tipo de serviço selecionado não tem comissão configurada!");
        return;
      }
      if (availableActivationTypes.length > 0 && !formData.activation_type) {
        toast.error("Selecione o tipo de ativação!");
        return;
      }
    }

    if (!formData.street || !formData.postal_code || !formData.locality) {
      toast.error("Morada, código postal e localidade são obrigatórios!");
      return;
    }

    const postalCodeRegex = /^\d{4}-\d{3}$/;
    if (!postalCodeRegex.test(formData.postal_code)) {
      toast.error("Código postal inválido! Use o formato: 0000-000");
      return;
    }

    if (formData.scope === 'energia') {
      const selectedOperator = operators.find(op => op.id === formData.operator_id);
      const energyType = selectedOperator?.energy_type;
      const saleType = energyType === 'dual' ? formData.energy_sale_type : energyType;

      if (energyType === 'dual' && !formData.energy_sale_type) {
        toast.error("Selecione o tipo de adesão (Eletricidade, Gás ou Ambos)!");
        return;
      }

      const hasEletricidadeCommission = operatorCommissions.some(c =>
        c.service_type === 'eletricidade' || (c.service_types && c.service_types.includes('eletricidade'))
      );
      const hasGasCommission = operatorCommissions.some(c =>
        c.service_type === 'gas' || (c.service_types && c.service_types.includes('gas'))
      );

      if (saleType === 'eletricidade' && !hasEletricidadeCommission) {
        toast.error("Não há comissões configuradas para vendas de eletricidade nesta operadora!");
        return;
      }

      if (saleType === 'gas' && !hasGasCommission) {
        toast.error("Não há comissões configuradas para vendas de gás nesta operadora!");
        return;
      }

      if (saleType === 'dual' && (!hasEletricidadeCommission || !hasGasCommission)) {
        toast.error("Não há comissões configuradas para vendas dual (eletricidade + gás) nesta operadora!");
        return;
      }

      if (!formData.energy_points || formData.energy_points.length === 0) {
        toast.error("Adicione pelo menos um ponto de energia (CPE/CUI)!");
        return;
      }

      for (let i = 0; i < formData.energy_points.length; i++) {
        const point = formData.energy_points[i];

        if (saleType === 'eletricidade' || saleType === 'dual') {
          if (!point.point_code || !point.power_kva) {
            toast.error(`Ponto ${i + 1}: CPE e Potência são obrigatórios!`);
            return;
          }
        }

        if (saleType === 'gas' || saleType === 'dual') {
          const cuiField = saleType === 'dual' ? 'cui_code' : 'point_code';
          if (!point[cuiField] || !point.tier) {
            toast.error(`Ponto ${i + 1}: CUI e Escalão são obrigatórios!`);
            return;
          }
        }
      }

      if (!formData.entry_type) {
        toast.error("Tipo de Entrada é obrigatório!");
        return;
      }
    }

    try {
      const submitData = { ...formData };
      if (submitData.monthly_value) submitData.monthly_value = parseFloat(submitData.monthly_value);

      if (formData.scope === 'energia' && formData.energy_points && formData.energy_points.length > 0) {
        const firstPoint = formData.energy_points[0];
        submitData.cpe = firstPoint.point_code || '';
        submitData.power = firstPoint.power_kva || '';
        submitData.cui = firstPoint.cui_code || firstPoint.point_code || '';
        submitData.tier = firstPoint.tier || '';
      }

      const energyPoints = submitData.energy_points;
      delete submitData.energy_points;

      if (!pendingSubmit) {
        const result = await salesService.checkWarningsAndCreateSale(submitData, uploadFiles);

        if (result.warnings) {
          setValidationWarnings(result.warnings);
          setPendingSubmit(true);
          return;
        }

        if (result.sale && energyPoints && energyPoints.length > 0) {
          await energyPointsService.replacePointsForSale(result.sale.id, energyPoints);
        }

        toast.success("Venda criada com sucesso!");
        setDialogOpen(false);
        resetForm();
        fetchData();
      } else {
        const createdSale = await salesService.create(submitData, uploadFiles);

        if (createdSale && energyPoints && energyPoints.length > 0) {
          await energyPointsService.replacePointsForSale(createdSale.id, energyPoints);
        }

        toast.success("Venda criada com sucesso!");
        setDialogOpen(false);
        resetForm();
        setValidationWarnings([]);
        setPendingSubmit(false);
        fetchData();
      }
    } catch (error) {
      const errorMessage = error.message || "Erro ao criar venda";

      if (errorMessage.includes('REQ_DUPLICATE')) {
        toast.error("Número de requisição já existe no sistema");
      } else {
        toast.error(errorMessage);
      }
    }
  };

  const handleCancelWarnings = () => {
    setValidationWarnings([]);
    setPendingSubmit(false);
  };

  const handleContinueWithWarnings = async (e) => {
    e.preventDefault();
    await handleSubmit(e);
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
      street: "",
      postal_code: "",
      locality: "",
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
      has_direct_debit: false,
      has_electronic_invoice: false,
      has_tv: false,
      has_net: false,
      has_lr: false,
      mobile_count: 0,
      energy_points: [],
      observations: "",
      is_proposal: false
    });
    setUploadFiles([]);
    setOperatorCommissions([]);
    setAvailableServiceTypes([]);
    setAvailableActivationTypes([]);
  };

  const fetchOperatorCommissions = async (operatorId) => {
    try {
      const { data, error } = await supabase
        .from('commission_configurations')
        .select('*')
        .eq('operator_id', operatorId);

      if (error) throw error;

      setOperatorCommissions(data || []);

      if (data && data.length > 0) {
        const serviceTypesSet = new Set();
        const activationTypesSet = new Set();

        data.forEach(config => {
          if (config.service_type) {
            serviceTypesSet.add(config.service_type);
          }
          if (config.activation_type) {
            activationTypesSet.add(config.activation_type);
          }
        });

        setAvailableServiceTypes(Array.from(serviceTypesSet));
        setAvailableActivationTypes(Array.from(activationTypesSet));
      } else {
        setAvailableServiceTypes([]);
        setAvailableActivationTypes([]);
      }
    } catch (error) {
      console.error('Error fetching commissions:', error);
      setOperatorCommissions([]);
      setAvailableServiceTypes([]);
      setAvailableActivationTypes([]);
    }
  };

  const filteredOperators = operators.filter(op => op.scope === formData.scope);

  const currentOperator = operators.find(op => op.id === formData.operator_id);
  const operatorEnergyType = currentOperator?.energy_type || '';

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const filteredSales = sales.filter(sale => {
    if (viewMode === "proposals") {
      if (sale.status !== "Em proposta") return false;
    } else {
      if (sale.status === "Em proposta") return false;
    }
    if (selectedStatus && sale.status !== selectedStatus) return false;
    if (selectedPartner && selectedPartner !== "all" && sale.partner_id !== selectedPartner) return false;
    if (selectedOperator && selectedOperator !== "all" && sale.operator_id !== selectedOperator) return false;
    if (selectedScope && selectedScope !== "all" && sale.scope !== selectedScope) return false;
    if (filterStartDate && new Date(sale.date) < new Date(filterStartDate)) return false;
    if (filterEndDate && new Date(sale.date) > new Date(filterEndDate)) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        sale.sale_code?.toLowerCase().includes(query) ||
        sale.client_name?.toLowerCase().includes(query) ||
        sale.client_nif?.toLowerCase().includes(query) ||
        sale.client_contact?.toLowerCase().includes(query)
      );
    }
    return true;
  });
  
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
      const excelData = [];

      for (const sale of dataToExport) {
        const partner = partners.find(p => p.id === sale.partner_id);
        const operator = operators.find(o => o.id === sale.operator_id);
        const commission = sale.manual_commission || sale.calculated_commission || 0;

        const baseData = {
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
          'Tipo Venda Energia': sale.energy_sale_type || ''
        };

        if (sale.scope === 'energia' && sale.is_multipoint) {
          try {
            const points = await energyPointsService.getPointsBySaleId(sale.id);

            if (points && points.length > 0) {
              for (let i = 0; i < points.length; i++) {
                const point = points[i];
                excelData.push({
                  ...baseData,
                  'Ponto': `${i + 1}/${points.length}`,
                  'Tipo Ponto': point.point_type.toUpperCase(),
                  'CPE': point.point_type === 'cpe' ? point.point_code : '',
                  'Potência': point.power_kva || '',
                  'CUI': point.point_type === 'cui' ? point.point_code : '',
                  'Escalão': point.tier || '',
                  'Estado Ativação': point.activation_status,
                  'Data Ativação': point.activation_date ? new Date(point.activation_date).toLocaleDateString('pt-PT') : '',
                  'Pago Operador': point.operator_paid ? 'Sim' : 'Não',
                  'Tipo Entrada': sale.entry_type || '',
                  'Status': sale.status,
                  'Nº Requisição': sale.request_number || '',
                  'Comissão': `€${commission.toFixed(2)}`,
                  'Paga Operador Venda': sale.paid_to_operator ? 'Sim' : 'Não',
                  'Data Pagamento': sale.payment_date ? new Date(sale.payment_date).toLocaleDateString('pt-PT') : '',
                  'Observações': sale.observations || ''
                });
              }
            } else {
              excelData.push({
                ...baseData,
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
              });
            }
          } catch (error) {
            console.error('Erro ao buscar pontos de energia:', error);
            excelData.push({
              ...baseData,
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
            });
          }
        } else {
          excelData.push({
            ...baseData,
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
          });
        }
      }

      // Criar workbook e worksheet
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Vendas');

      // Gerar e fazer download
      const fileName = `vendas_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success(`Exportadas ${dataToExport.length} vendas (${excelData.length} linhas)`);
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
      const attachments = [];

      if (noteAttachments.length > 0) {
        for (const file of noteAttachments) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${selectedSaleForNotes.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('sales-documents')
            .upload(fileName, file);

          if (uploadError) {
            console.error('Upload error:', uploadError);
            throw uploadError;
          }

          attachments.push({
            id: crypto.randomUUID(),
            filename: file.name,
            path: fileName,
            uploaded_at: new Date().toISOString()
          });
        }
      }

      await salesService.addNote(selectedSaleForNotes.id, newNote, attachments);
      toast.success("Nota adicionada!");
      setNewNote("");
      setNoteAttachments([]);
      setNotesDialogOpen(false);
      setTimeout(() => fetchData(), 100);
    } catch (error) {
      toast.error("Erro ao adicionar nota");
    }
  };

  const handleDeleteSale = async (sale) => {
    if (!window.confirm(`Tem a certeza que deseja apagar a venda ${sale.sale_code}?\n\nEsta ação é irreversível e irá remover todos os dados associados à venda.`)) {
      return;
    }

    try {
      await salesService.delete(sale.id);
      toast.success("Venda apagada com sucesso!");
      fetchData();
    } catch (error) {
      toast.error("Erro ao apagar venda");
      console.error('Erro ao apagar venda:', error);
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
                      {user?.role === 'admin' && user?.is_commissioned && (
                        <SelectItem value="__admin__">📊 Venda Própria (Admin Comissionado)</SelectItem>
                      )}
                      {partners.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {formData.partner_id === '__admin__' && (
                    <p className="text-xs text-blue-600 mt-1">
                      ℹ️ Esta venda será registada no seu nome e receberá comissões com valores REV
                    </p>
                  )}
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

                <div className={formData.scope === 'energia' ? '' : 'col-span-2'}>
                  <Label>Operadora *</Label>
                  <Select value={formData.operator_id} onValueChange={(v) => {
                    const operator = operators.find(op => op.id === v);
                    let newEnergyType = '';

                    if (formData.scope === 'energia') {
                      if (operator?.energy_type === 'dual') {
                        newEnergyType = '';
                      } else if (operator?.energy_type === 'eletricidade' || operator?.energy_type === 'gas') {
                        newEnergyType = operator.energy_type;
                      }
                    }

                    setFormData({
                      ...formData,
                      operator_id: v,
                      energy_sale_type: newEnergyType,
                      service_type: '',
                      activation_type: '',
                      cpe: '',
                      power: '',
                      cui: '',
                      tier: ''
                    });

                    fetchOperatorCommissions(v);
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

                {formData.scope === 'energia' && formData.operator_id && operatorEnergyType === 'dual' && (
                  <>
                    {operatorCommissions.length === 0 ? (
                      <div className="col-span-2 bg-red-50 border border-red-300 rounded-lg p-4">
                        <p className="text-red-800 font-semibold">⚠️ Operadora sem comissões configuradas</p>
                        <p className="text-sm text-red-600 mt-1">
                          Não é possível registar vendas para esta operadora porque não tem comissões configuradas.
                          Contacte o administrador para configurar as comissões.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <Label className="text-base font-semibold mb-2">O que o cliente pretende contratar? *</Label>
                          <Select value={formData.energy_sale_type} onValueChange={(v) => setFormData({...formData, energy_sale_type: v, cpe: '', power: '', cui: '', tier: ''})}>
                            <SelectTrigger><SelectValue placeholder="Selecione o tipo de adesão..." /></SelectTrigger>
                            <SelectContent>
                              {(() => {
                                const hasEletricidade = operatorCommissions.some(c =>
                                  c.service_type === 'eletricidade' || (c.service_types && c.service_types.includes('eletricidade'))
                                );
                                const hasGas = operatorCommissions.some(c =>
                                  c.service_type === 'gas' || (c.service_types && c.service_types.includes('gas'))
                                );
                                return (
                                  <>
                                    {hasEletricidade && (
                                      <SelectItem value="eletricidade">⚡ Apenas Eletricidade</SelectItem>
                                    )}
                                    {hasGas && (
                                      <SelectItem value="gas">🔥 Apenas Gás</SelectItem>
                                    )}
                                    {hasEletricidade && hasGas && (
                                      <SelectItem value="dual">⚡🔥 Eletricidade + Gás (Dual)</SelectItem>
                                    )}
                                  </>
                                );
                              })()}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-gray-600 mt-2">
                            Selecione se o cliente está a aderir apenas a eletricidade, apenas a gás, ou a ambos os serviços.
                          </p>
                          {(() => {
                            const hasEletricidade = operatorCommissions.some(c =>
                              c.service_type === 'eletricidade' || (c.service_types && c.service_types.includes('eletricidade'))
                            );
                            const hasGas = operatorCommissions.some(c =>
                              c.service_type === 'gas' || (c.service_types && c.service_types.includes('gas'))
                            );
                            if (!hasEletricidade || !hasGas) {
                              return (
                                <p className="text-xs text-amber-700 mt-2 font-semibold">
                                  ⚠️ {!hasEletricidade && 'Eletricidade'}{!hasEletricidade && !hasGas && ' e '}{!hasGas && 'Gás'} sem comissões configuradas
                                </p>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </>
                    )}
                  </>
                )}

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
                  <Label>Morada do Cliente *</Label>
                  <Input
                    value={formData.street}
                    onChange={(e) => setFormData({...formData, street: e.target.value})}
                    placeholder="Rua, Avenida, número, andar, etc."
                    required
                  />
                </div>
                <div>
                  <Label>Código Postal *</Label>
                  <Input
                    value={formData.postal_code}
                    onChange={(e) => setFormData({...formData, postal_code: e.target.value})}
                    placeholder="0000-000"
                    pattern="\d{4}-\d{3}"
                    required
                  />
                </div>
                <div>
                  <Label>Localidade *</Label>
                  <Input
                    value={formData.locality}
                    onChange={(e) => setFormData({...formData, locality: e.target.value})}
                    placeholder="Ex: Lisboa, Porto, etc."
                    required
                  />
                </div>

                <div className="col-span-2">
                  <Label>Morada de Instalação/Fornecimento</Label>
                  <Input value={formData.installation_address} onChange={(e) => setFormData({...formData, installation_address: e.target.value})} />
                  <p className="text-xs text-gray-500 mt-1">Se diferente da morada do cliente</p>
                </div>

                {formData.scope === 'telecomunicacoes' && formData.operator_id && (
                  <>
                    {operatorCommissions.length === 0 ? (
                      <div className="col-span-2 bg-red-50 border border-red-300 rounded-lg p-4">
                        <p className="text-red-800 font-semibold">⚠️ Operadora sem comissões configuradas</p>
                        <p className="text-sm text-red-600 mt-1">
                          Não é possível registar vendas para esta operadora porque não tem comissões configuradas.
                          Contacte o administrador para configurar as comissões.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div>
                          <Label>Tipo Serviço *</Label>
                          <Select value={formData.service_type} onValueChange={(v) => {
                            const newFormData = {...formData, service_type: v};
                            if (v === 'REFID' || v === 'Refid') {
                              newFormData.monthly_value = '';
                            } else {
                              newFormData.current_monthly_fee = '';
                              newFormData.contracted_monthly_fee = '';
                            }
                            setFormData(newFormData);
                          }} disabled={availableServiceTypes.length === 0}>
                            <SelectTrigger><SelectValue placeholder={availableServiceTypes.length === 0 ? "Sem tipos disponíveis" : "Selecione..."} /></SelectTrigger>
                            <SelectContent>
                              {availableServiceTypes.map(type => (
                                <SelectItem key={type} value={type}>
                                  {type === 'NI' ? 'NI (Nova Instalação)' :
                                   type === 'MC' ? 'MC (Mudança de Casa)' :
                                   type === 'REFID' ? 'REFID (Refidelização)' :
                                   type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {availableServiceTypes.length === 0 && (
                            <p className="text-xs text-red-600 mt-1">Nenhum tipo de serviço com comissão configurada</p>
                          )}
                        </div>
                        {availableActivationTypes.length > 0 && (
                          <div>
                            <Label>Tipo de Ativação *</Label>
                            <Select value={formData.activation_type} onValueChange={(v) => setFormData({...formData, activation_type: v})}>
                              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                              <SelectContent>
                                {availableActivationTypes.map(type => (
                                  <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </>
                    )}

                    {(formData.service_type === 'REFID' || formData.service_type === 'Refid') ? (
                      <div className="col-span-2 bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <h4 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
                          Dados REFID - Downsell/Upsell
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Mensalidade Atual (€) *</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={formData.current_monthly_fee}
                              onChange={(e) => setFormData({...formData, current_monthly_fee: e.target.value})}
                              required
                              placeholder="Ex: 45.00"
                            />
                            <p className="text-xs text-amber-700 mt-1">Valor que o cliente paga atualmente</p>
                          </div>
                          <div>
                            <Label>Mensalidade Contratada (€) *</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={formData.contracted_monthly_fee}
                              onChange={(e) => setFormData({...formData, contracted_monthly_fee: e.target.value})}
                              required
                              placeholder="Ex: 35.00"
                            />
                            <p className="text-xs text-amber-700 mt-1">Novo valor contratado</p>
                          </div>
                        </div>
                        {formData.current_monthly_fee && formData.contracted_monthly_fee && (
                          <div className="mt-3 p-3 bg-white rounded border">
                            <p className="text-sm font-semibold">
                              {parseFloat(formData.current_monthly_fee) > parseFloat(formData.contracted_monthly_fee) ? (
                                <span className="text-orange-600">Downsell: Cliente reduz mensalidade de €{formData.current_monthly_fee} para €{formData.contracted_monthly_fee}</span>
                              ) : parseFloat(formData.current_monthly_fee) < parseFloat(formData.contracted_monthly_fee) ? (
                                <span className="text-green-600">Upsell: Cliente aumenta mensalidade de €{formData.current_monthly_fee} para €{formData.contracted_monthly_fee}</span>
                              ) : (
                                <span className="text-gray-600">Mensalidades iguais</span>
                              )}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                              A comissão será calculada com base na mensalidade contratada (€{formData.contracted_monthly_fee})
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <Label>Mensalidade (€) *</Label>
                        <Input type="number" step="0.01" value={formData.monthly_value} onChange={(e) => setFormData({...formData, monthly_value: e.target.value})} required />
                      </div>
                    )}

                    <div className="col-span-2 border-t pt-4 mt-2">
                      <Label className="text-base font-semibold mb-3 block">Serviços Contratados</Label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="has_tv"
                            checked={formData.has_tv}
                            onChange={(e) => setFormData({...formData, has_tv: e.target.checked})}
                            className="w-4 h-4 text-blue-600"
                          />
                          <Label htmlFor="has_tv" className="cursor-pointer">TV</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="has_net"
                            checked={formData.has_net}
                            onChange={(e) => setFormData({...formData, has_net: e.target.checked})}
                            className="w-4 h-4 text-blue-600"
                          />
                          <Label htmlFor="has_net" className="cursor-pointer">NET/Fibra</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="has_lr"
                            checked={formData.has_lr}
                            onChange={(e) => setFormData({...formData, has_lr: e.target.checked})}
                            className="w-4 h-4 text-blue-600"
                          />
                          <Label htmlFor="has_lr" className="cursor-pointer">Linha Fixa/LR</Label>
                        </div>
                        <div>
                          <Label htmlFor="mobile_count" className="text-sm">Móveis</Label>
                          <Input
                            id="mobile_count"
                            type="number"
                            min="0"
                            value={formData.mobile_count}
                            onChange={(e) => setFormData({...formData, mobile_count: parseInt(e.target.value) || 0})}
                            className="mt-1"
                          />
                        </div>
                      </div>
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

                      if (!saleType) return null;

                      return (
                        <div className="col-span-2">
                          <EnergyPointsManager
                            saleType={saleType}
                            points={formData.energy_points}
                            onChange={(points) => {
                              setFormData({...formData, energy_points: points});
                            }}
                            isNew={true}
                          />
                        </div>
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

                {currentOperator && (currentOperator.pays_direct_debit || currentOperator.pays_electronic_invoice) && (
                  <div className="col-span-2 border-t pt-4">
                    <Label className="text-base font-semibold mb-3 block">Adesões do Cliente</Label>
                    <div className="space-y-2 bg-blue-50 p-4 rounded-lg">
                      {currentOperator.pays_direct_debit && (
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="has_direct_debit"
                            checked={formData.has_direct_debit}
                            onChange={(e) => setFormData({...formData, has_direct_debit: e.target.checked})}
                            className="w-4 h-4 text-blue-600"
                          />
                          <Label htmlFor="has_direct_debit" className="cursor-pointer font-normal">
                            Cliente aderiu a Débito Direto (DD)
                          </Label>
                        </div>
                      )}
                      {currentOperator.pays_electronic_invoice && (
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="has_electronic_invoice"
                            checked={formData.has_electronic_invoice}
                            onChange={(e) => setFormData({...formData, has_electronic_invoice: e.target.checked})}
                            className="w-4 h-4 text-blue-600"
                          />
                          <Label htmlFor="has_electronic_invoice" className="cursor-pointer font-normal">
                            Cliente aderiu a Fatura Eletrónica (FE)
                          </Label>
                        </div>
                      )}
                      <p className="text-xs text-gray-600 mt-2">
                        ℹ️ Valores adicionais serão somados à comissão conforme configuração da operadora
                      </p>
                    </div>
                  </div>
                )}

                <div className="col-span-2">
                  <div className="flex items-center space-x-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <input
                      type="checkbox"
                      id="is_proposal"
                      checked={formData.is_proposal}
                      onChange={(e) => setFormData({...formData, is_proposal: e.target.checked})}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <Label htmlFor="is_proposal" className="cursor-pointer font-medium text-blue-900">
                      Esta venda é uma proposta?
                    </Label>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    ℹ️ Propostas ficam no estado "Em proposta" e aparecem apenas no separador Propostas
                  </p>
                </div>

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
                <Button
                  type="submit"
                  className="btn-primary"
                  disabled={formData.operator_id && operatorCommissions.length === 0}
                >
                  Criar Venda
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      </div>

      {/* Seletor Vendas/Propostas */}
      <div className="flex gap-2 mb-4 p-1 bg-gray-100 rounded-lg w-fit">
        <Button
          onClick={() => {
            setViewMode("sales");
            setSelectedStatus("");
          }}
          variant={viewMode === "sales" ? "default" : "ghost"}
          size="sm"
          className={viewMode === "sales" ? "bg-[#1F4E78] text-white hover:bg-[#16395A]" : ""}
        >
          Vendas
        </Button>
        <Button
          onClick={() => {
            setViewMode("proposals");
            setSelectedStatus("");
          }}
          variant={viewMode === "proposals" ? "default" : "ghost"}
          size="sm"
          className={viewMode === "proposals" ? "bg-[#1F4E78] text-white hover:bg-[#16395A]" : ""}
        >
          Propostas
        </Button>
      </div>

      {/* Filtros de Status (sempre visíveis) */}
      {viewMode === "sales" && (
        <div className="flex flex-wrap gap-2 mb-4">
          <Button onClick={() => setSelectedStatus("")} variant={selectedStatus === "" ? "default" : "outline"} size="sm">Todas</Button>
          <Button onClick={() => setSelectedStatus("Para registo")} variant={selectedStatus === "Para registo" ? "default" : "outline"} size="sm">Para registo</Button>
          <Button onClick={() => setSelectedStatus("Pendente")} variant={selectedStatus === "Pendente" ? "default" : "outline"} size="sm">Pendente</Button>
          <Button onClick={() => setSelectedStatus("Concluido")} variant={selectedStatus === "Concluido" ? "default" : "outline"} size="sm">Concluído</Button>
          <Button onClick={() => setSelectedStatus("Ativo")} variant={selectedStatus === "Ativo" ? "default" : "outline"} size="sm">Ativo</Button>
          <Button onClick={() => setSelectedStatus("Cancelado")} variant={selectedStatus === "Cancelado" ? "default" : "outline"} size="sm">Cancelado</Button>

          <Button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            variant={showAdvancedFilters ? "default" : "outline"}
            size="sm"
            className="ml-auto gap-2"
          >
            <Filter className="w-4 h-4" />
            Filtros Avançados
          </Button>
        </div>
      )}

      {viewMode === "proposals" && (
        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            variant={showAdvancedFilters ? "default" : "outline"}
            size="sm"
            className="gap-2"
          >
            <Filter className="w-4 h-4" />
            Filtros Avançados
          </Button>
        </div>
      )}

      {/* Filtros Avançados */}
      {showAdvancedFilters && (
        <div className="professional-card p-4 mb-4 space-y-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-900">Filtros Avançados</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedPartner("all");
                setSelectedOperator("all");
                setSelectedScope("all");
                setSearchQuery("");
                setFilterStartDate("");
                setFilterEndDate("");
              }}
            >
              <XIcon className="w-4 h-4 mr-1" />
              Limpar Filtros
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Pesquisa por texto */}
            <div>
              <Label>Pesquisar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Código, Cliente, NIF, Contacto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Filtro por Parceiro */}
            {user?.role === 'admin' || user?.role === 'bo' ? (
              <div>
                <Label>Parceiro</Label>
                <Select value={selectedPartner} onValueChange={setSelectedPartner}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os parceiros" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {partners.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {/* Filtro por Operadora */}
            <div>
              <Label>Operadora</Label>
              <Select value={selectedOperator} onValueChange={setSelectedOperator}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as operadoras" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {operators.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por Âmbito */}
            <div>
              <Label>Âmbito</Label>
              <Select value={selectedScope} onValueChange={setSelectedScope}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os âmbitos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="telecomunicacoes">Telecomunicações</SelectItem>
                  <SelectItem value="energia">Energia</SelectItem>
                  <SelectItem value="solar">Solar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por Data Início */}
            <div>
              <Label>Data de Início</Label>
              <Input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
              />
            </div>

            {/* Filtro por Data Fim */}
            <div>
              <Label>Data de Fim</Label>
              <Input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Contador de resultados */}
          <div className="text-sm text-gray-600 pt-2 border-t">
            {filteredSales.length} venda(s) encontrada(s) {filteredSales.length !== sales.length && `de ${sales.length} total`}
          </div>
        </div>
      )}

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
                <th className="text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr><td colSpan={user?.role === 'partner_commercial' ? 7 : 9} className="text-center py-8 text-gray-400">Nenhuma venda encontrada</td></tr>
              ) : (
                sortedSales.map((sale) => (
                  <tr key={sale.id}>
                    <td>
                      <span className="font-semibold text-gray-900">
                        {sale.sale_code}
                      </span>
                    </td>
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
                    <td className="text-center">
                      <div className="flex gap-2 justify-center">
                        <Button
                          onClick={() => {
                            setSelectedSaleId(sale.id);
                            setDetailDialogOpen(true);
                          }}
                          size="sm"
                          variant="ghost"
                          className="text-blue-600"
                        >
                          {(user?.role === 'admin' || user?.role === 'bo') ? 'Editar' : 'Visualizar'}
                        </Button>
                        {(user?.role === 'admin' || user?.role === 'bo' || user?.role === 'partner') && (
                          <Button onClick={() => openNotesDialog(sale)} size="sm" variant="ghost" className="text-purple-600">
                            Notas ({sale.notes?.length || 0})
                          </Button>
                        )}
                        {user?.role === 'admin' && (
                          <Button onClick={() => handleDeleteSale(sale)} size="sm" variant="ghost" className="text-red-600 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
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
              const shouldShowCommission = (saleOperator?.commission_mode === 'manual' || editingSale?.scope === 'solar');
              const canEditCommission = user?.role === 'admin';

              return shouldShowCommission && (
                <div>
                  <Label>Comissão Manual (€) {!canEditCommission && <span className="text-red-500">*Apenas Administradores</span>}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editFormData.manual_commission}
                    onChange={(e) => setEditFormData({...editFormData, manual_commission: e.target.value})}
                    placeholder="Definir comissão"
                    disabled={!canEditCommission}
                    className={!canEditCommission ? "bg-gray-100 cursor-not-allowed" : ""}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {saleOperator?.commission_mode === 'manual'
                      ? 'Operadora com comissão definida ao contrato'
                      : 'Comissão para venda Solar'}
                    {!canEditCommission && ' - Apenas administradores podem definir comissões manuais'}
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

      {/* Sale Detail Dialog */}
      <SaleDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        saleId={selectedSaleId}
        user={user}
        onSaleUpdated={fetchData}
      />

      {/* Validation Warnings Dialog */}
      {validationWarnings.length > 0 && (
        <Dialog open={true} onOpenChange={() => handleCancelWarnings()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Aviso de Validação
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <Alert className="bg-amber-50 border-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <AlertDescription>
                  <p className="font-semibold mb-2">Foram detetados os seguintes avisos:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {validationWarnings.map((warning, index) => (
                      <li key={index} className="text-sm">{warning}</li>
                    ))}
                  </ul>
                  <p className="mt-3 text-sm">
                    Pode corrigir os dados ou continuar mesmo assim. A venda será criada de qualquer forma.
                  </p>
                </AlertDescription>
              </Alert>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={handleCancelWarnings}>
                  Voltar e Corrigir
                </Button>
                <Button onClick={handleContinueWithWarnings} className="bg-amber-500 hover:bg-amber-600">
                  Continuar Mesmo Assim
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

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

              <div className="flex items-center gap-2">
                <Label htmlFor="note-attachments" className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-300 transition-colors">
                    <Paperclip className="w-4 h-4" />
                    <span className="text-sm">Anexar Documentos</span>
                  </div>
                </Label>
                <input
                  id="note-attachments"
                  type="file"
                  multiple
                  onChange={(e) => setNoteAttachments(Array.from(e.target.files))}
                  className="hidden"
                />
                {noteAttachments.length > 0 && (
                  <span className="text-sm text-gray-600">
                    {noteAttachments.length} ficheiro(s) selecionado(s)
                  </span>
                )}
              </div>

              <Button onClick={handleAddNote} size="sm" className="btn-primary">
                Adicionar Nota
              </Button>
            </div>

            {/* Notes List */}
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900">Histórico de Notas (últimas 3):</h3>
              {(!selectedSaleForNotes?.notes || selectedSaleForNotes.notes.length === 0) ? (
                <p className="text-gray-500 text-sm py-4 text-center">Nenhuma nota ainda</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto border border-gray-200 rounded-lg p-2">
                  {selectedSaleForNotes.notes.slice(0, 3).map((note) => (
                    <div key={note.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-sm">{note.author}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(note.created_at).toLocaleString('pt-PT')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{note.content}</p>
                      {note.attachments && note.attachments.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {note.attachments.map((attachment) => (
                            <div key={attachment.id} className="flex items-center gap-2 text-xs text-blue-600">
                              <Paperclip className="w-3 h-3" />
                              <button
                                onClick={async () => {
                                  try {
                                    const { data, error } = await supabase.storage
                                      .from('sales-documents')
                                      .download(attachment.path);
                                    if (error) throw error;
                                    const url = URL.createObjectURL(data);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = attachment.filename;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    URL.revokeObjectURL(url);
                                    toast.success("Download concluído!");
                                  } catch (error) {
                                    console.error('Error downloading:', error);
                                    toast.error("Erro ao descarregar ficheiro");
                                  }
                                }}
                                className="hover:underline"
                              >
                                {attachment.filename}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {selectedSaleForNotes.notes.length > 3 && (
                    <p className="text-xs text-gray-500 text-center py-2">
                      + {selectedSaleForNotes.notes.length - 3} nota(s) mais antiga(s)
                    </p>
                  )}
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
