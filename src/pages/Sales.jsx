import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Plus, Download, ArrowUpDown, Trash2, Paperclip, AlertTriangle, Filter, X as XIcon, Search, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ResponsiveTable, TruncatedCell, TableSkeleton } from "@/components/ui/responsive-table";
import { salesService } from "../services/salesService";
import { partnersService } from "../services/partnersService";
import { operatorsService } from "../services/operatorsService";
import { energyPointsService } from "../services/energyPointsService";
import { recalculateAllCommissions, recalculateSaleCommission } from "../services/commissionRecalculator";
import { supabase } from "../lib/supabase";
import SaleDetailDialog from "../components/SaleDetailDialog";
import SalesImport from "../components/SalesImport";
import SaleFormDialog from "../components/SaleFormDialog";

const POWER_OPTIONS = ["1.15kVA", "2.3kVA", "3.45kVA", "4.6kVA", "5.75kVA", "6.9kVA", "10.35kVA", "13.8kVA", "17.25kVA", "20.7kVA", "27.6kVA", "34.5kVA", "41.4kVA", "Outros"];

const Sales = ({ user }) => {
  const location = useLocation();
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
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [sortField, setSortField] = useState("created_at");
  const [sortDirection, setSortDirection] = useState("desc");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [editFormData, setEditFormData] = useState({});
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
  const [recalcDialogOpen, setRecalcDialogOpen] = useState(false);
  const [recalcStartDate, setRecalcStartDate] = useState("");

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
    current_monthly_fee: "",
    contracted_monthly_fee: "",
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

  useEffect(() => {
    if (!loading && location.state?.openNewSale && partners.length > 0) {
      const { partnerId } = location.state;
      if (partnerId) {
        setFormData(prev => ({ ...prev, partner_id: partnerId }));
      }
      setDialogOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [loading, location.state, partners]);

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
      if (submitData.current_monthly_fee) submitData.current_monthly_fee = parseFloat(submitData.current_monthly_fee);
      if (submitData.contracted_monthly_fee) submitData.contracted_monthly_fee = parseFloat(submitData.contracted_monthly_fee);

      if (submitData.service_type !== 'REFID' && submitData.service_type !== 'Refid') {
        delete submitData.current_monthly_fee;
        delete submitData.contracted_monthly_fee;
      }

      if (formData.scope === 'energia' && formData.energy_points && formData.energy_points.length > 0) {
        const selectedOperator = operators.find(op => op.id === formData.operator_id);
        const energyType = selectedOperator?.energy_type;
        const saleType = energyType === 'dual' ? formData.energy_sale_type : energyType;

        const firstPoint = formData.energy_points[0];

        if (saleType === 'eletricidade' || saleType === 'dual') {
          submitData.cpe = firstPoint.point_code || '';
          submitData.power = firstPoint.power_kva || '';
        }

        if (saleType === 'gas') {
          submitData.cui = firstPoint.point_code || '';
          submitData.tier = firstPoint.tier || '';
        } else if (saleType === 'dual') {
          submitData.cui = firstPoint.cui_code || '';
          submitData.tier = firstPoint.tier || '';
        }
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
      current_monthly_fee: "",
      contracted_monthly_fee: "",
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

  const fetchOperatorCommissions = async (operatorId, partnerId = null, clientType = null) => {
    try {
      let partnerType = 'D2D';
      const partnerIdToUse = partnerId || formData.partner_id;
      const clientTypeToUse = clientType || formData.client_type;

      if (partnerIdToUse === '__admin__') {
        partnerType = 'Rev1';
      } else if (partnerIdToUse) {
        const selectedPartner = partners.find(p => p.id === partnerIdToUse);
        if (selectedPartner) {
          partnerType = selectedPartner.partner_type;
        }
      }

      let query = supabase
        .from('commission_configurations')
        .select('*')
        .eq('operator_id', operatorId)
        .eq('partner_type', partnerType);

      if (clientTypeToUse) {
        query = query.eq('client_type', clientTypeToUse);
      }

      const { data, error } = await query;

      if (error) throw error;

      setOperatorCommissions(data || []);

      if (data && data.length > 0) {
        const serviceTypesSet = new Set();
        const activationTypesSet = new Set();

        data.forEach(config => {
          if (config.service_type) {
            serviceTypesSet.add(config.service_type);
          }
          if (config.service_types && Array.isArray(config.service_types)) {
            config.service_types.forEach(st => serviceTypesSet.add(st));
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

    if (sortField === 'partner_name') {
      aValue = partners.find(p => p.id === a.partner_id)?.name || '';
      bValue = partners.find(p => p.id === b.partner_id)?.name || '';
    }
    if (sortField === 'operator_name') {
      aValue = operators.find(o => o.id === a.operator_id)?.name || '';
      bValue = operators.find(o => o.id === b.operator_id)?.name || '';
    }

    if (aValue == null) aValue = '';
    if (bValue == null) bValue = '';

    if (typeof aValue === 'string') {
      return sortDirection === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }
    return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
  });

  const totalPages = Math.ceil(sortedSales.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedSales = sortedSales.slice(startIndex, endIndex);

  const goToFirstPage = () => setCurrentPage(1);
  const goToLastPage = () => setCurrentPage(totalPages);
  const goToPreviousPage = () => setCurrentPage(prev => Math.max(1, prev - 1));
  const goToNextPage = () => setCurrentPage(prev => Math.min(totalPages, prev + 1));

  const handleExportExcel = async () => {
    try {
      let dataToExport = [...sales];

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

      const excelData = [];

      for (const sale of dataToExport) {
        const partner = partners.find(p => p.id === sale.partner_id);
        const operator = operators.find(o => o.id === sale.operator_id);
        const commission = sale.manual_commission || sale.calculated_commission || 0;

        const baseData = {
          'Data': new Date(sale.date).toLocaleDateString('pt-PT'),
          'ID Parceiro': partner?.code || partner?.name || sale.partner_id || '',
          'Âmbito': sale.scope,
          'Tipo Cliente': sale.client_type,
          'Nome Cliente': sale.client_name,
          'NIF': sale.client_nif,
          'Contacto': sale.client_contact,
          'Email': sale.client_email || '',
          'IBAN': sale.client_iban || '',
          'Débito Direto': sale.has_direct_debit ? 'Sim' : 'Não',
          'Fatura Eletrónica': sale.has_electronic_invoice ? 'Sim' : 'Não',
          'Morada': sale.street || '',
          'Código Postal': sale.postal_code || '',
          'Localidade': sale.locality || '',
          'Morada Instalação': sale.installation_address || '',
          'ID Operadora': operator?.name || sale.operator_id || '',
          'Tipo Serviço': sale.service_type || '',
          'Tipo Ativação': sale.activation_type || '',
          'Valor Mensal': sale.monthly_value || '',
          'Tipo Venda Energia': sale.energy_sale_type || '',
          'Paga Operador': sale.paid_to_operator ? 'Sim' : 'Não',
          'Data Pagamento': sale.payment_date ? new Date(sale.payment_date).toLocaleDateString('pt-PT') : ''
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
                  'Pago Operador Ponto': point.operator_paid ? 'Sim' : 'Não',
                  'Tipo Entrada': sale.entry_type || '',
                  'Status': sale.status,
                  'Nº Requisição': sale.request_number || '',
                  'Comissão': `€${commission.toFixed(2)}`,
                  'Observações': sale.observations || ''
                });
              }
            } else {
              const showCUI = sale.energy_sale_type !== 'eletricidade';
              excelData.push({
                ...baseData,
                'CPE': sale.cpe || '',
                'Potência': sale.power || '',
                'CUI': showCUI ? (sale.cui || '') : '',
                'Escalão': showCUI ? (sale.tier || '') : '',
                'Tipo Entrada': sale.entry_type || '',
                'Status': sale.status,
                'Nº Requisição': sale.request_number || '',
                'Comissão': `€${commission.toFixed(2)}`,
                'Observações': sale.observations || ''
              });
            }
          } catch (error) {
            console.error('Erro ao buscar pontos de energia:', error);
            const showCUI = sale.energy_sale_type !== 'eletricidade';
            excelData.push({
              ...baseData,
              'CPE': sale.cpe || '',
              'Potência': sale.power || '',
              'CUI': showCUI ? (sale.cui || '') : '',
              'Escalão': showCUI ? (sale.tier || '') : '',
              'Tipo Entrada': sale.entry_type || '',
              'Status': sale.status,
              'Nº Requisição': sale.request_number || '',
              'Comissão': `€${commission.toFixed(2)}`,
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
            'Observações': sale.observations || ''
          });
        }
      }

      const XLSX = await import('xlsx');
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Vendas');

      const fileName = `vendas_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success(`Exportadas ${dataToExport.length} vendas (${excelData.length} linhas)`);
      setExportDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao exportar Excel");
    }
  };

  const handleRecalculateCommissions = async () => {
    try {
      setLoading(true);
      toast.info('Recalculando comissões...');

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recalculate-commissions`;
      const { data: { session } } = await supabase.auth.getSession();

      const requestBody = recalcStartDate ? { startDate: recalcStartDate } : {};

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to recalculate commissions: ${errorText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Unknown error');
      }

      toast.success(`Comissões recalculadas! ${result.success_count} atualizadas, ${result.skipped} ignoradas, ${result.failed} falharam`);

      setRecalcDialogOpen(false);
      setRecalcStartDate("");
      await fetchData();
    } catch (error) {
      console.error('Erro ao recalcular comissões:', error);
      toast.error('Erro ao recalcular comissões');
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (sale) => {
    setEditingSale(sale);
    setEditFormData({
      date: sale.date ? sale.date.split('T')[0] : "",
      status: sale.status || "",
      request_number: sale.request_number || "",
      paid_to_operator: Boolean(sale.paid_to_operator),
      payment_date: sale.payment_date ? sale.payment_date.split('T')[0] : "",
      manual_commission: sale.manual_commission !== null && sale.manual_commission !== undefined ? sale.manual_commission : "",
      partner_id: sale.partner_id || (sale.partner_id === null && user?.is_commissioned ? "admin_commissioned" : ""),
      operator_id: sale.operator_id || "",
      scope: sale.scope || "",
      client_type: sale.client_type || sale.customer_type || "particular",
      monthly_value: sale.monthly_value !== null && sale.monthly_value !== undefined ? sale.monthly_value : "",
      current_monthly_fee: sale.current_monthly_fee !== null && sale.current_monthly_fee !== undefined ? sale.current_monthly_fee : "",
      contracted_monthly_fee: sale.contracted_monthly_fee !== null && sale.contracted_monthly_fee !== undefined ? sale.contracted_monthly_fee : "",
      client_name: sale.client_name || sale.customer_name || "",
      client_nif: sale.client_nif || sale.nif || "",
      client_contact: sale.client_contact || sale.contact || "",
      client_email: sale.client_email || "",
      client_iban: sale.client_iban || "",
      street: sale.street || "",
      postal_code: sale.postal_code || "",
      locality: sale.locality || "",
      installation_address: sale.installation_address || "",
      service_type: sale.service_type || "",
      activation_type: sale.activation_type || "",
      energy_sale_type: sale.energy_sale_type || "",
      cpe: sale.cpe || "",
      power: sale.power || "",
      cui: sale.cui || "",
      tier: sale.tier || "",
      entry_type: sale.entry_type || "",
      has_direct_debit: Boolean(sale.has_direct_debit),
      has_electronic_invoice: Boolean(sale.has_electronic_invoice),
      has_tv: Boolean(sale.has_tv),
      has_net: Boolean(sale.has_net),
      has_lr: Boolean(sale.has_lr),
      mobile_count: sale.mobile_count || 0,
      observations: sale.observations || ""
    });
    setEditDialogOpen(true);
  };

  const handleUpdateSale = async (e) => {
    e.preventDefault();
    try {
      if (editFormData.date) {
        const selectedDate = new Date(editFormData.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (selectedDate > today) {
          toast.error("Data de venda não pode ser futura");
          return;
        }
      }

      await salesService.update(editingSale.id, editFormData);

      if (!editFormData.manual_commission) {
        try {
          await recalculateSaleCommission(editingSale.id);
          console.log('Commission recalculated successfully for sale:', editingSale.id);
        } catch (commissionError) {
          console.error('Error recalculating commission:', commissionError);
        }
      }

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

  const getStatusBadge = (status) => {
    const statusColors = {
      'Para registo': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'Pendente': 'bg-orange-100 text-orange-800 border-orange-300',
      'Concluido': 'bg-green-100 text-green-800 border-green-300',
      'Ativo': 'bg-blue-100 text-blue-800 border-blue-300',
      'Cancelado': 'bg-red-100 text-red-800 border-red-300',
      'Em proposta': 'bg-purple-100 text-purple-800 border-purple-300',
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="h-10 w-48 bg-navy-200 rounded animate-pulse" />
          <div className="flex gap-3">
            <div className="h-10 w-32 bg-navy-200 rounded animate-pulse" />
            <div className="h-10 w-32 bg-navy-200 rounded animate-pulse" />
          </div>
        </div>
        <TableSkeleton rows={10} columns={8} />
      </div>
    );
  }

  // Render - NOTE: This is a very long file so I'm including dialogs at the end
  const headers = [
    'Código',
    'Data',
    'Parceiro',
    'Âmbito',
    'Cliente',
    'Operadora',
    'Status',
    ...(user?.role !== 'bo' && user?.role !== 'partner_commercial' ? ['Comissão'] : []),
    'Ações'
  ];

  const renderRow = (sale) => (
    <>
      <td className="px-6 py-4">
        <span className="font-semibold" style={{ color: '#000000' }}>
          {sale.sale_code}
        </span>
      </td>
      <td className="px-6 py-4">
        <span style={{ color: '#000000' }}>
          {new Date(sale.date).toLocaleDateString('pt-PT')}
        </span>
      </td>
      <td className="px-6 py-4">
        <TruncatedCell text={partners.find(p => p.id === sale.partner_id)?.name} />
      </td>
      <td className="px-6 py-4">
        <span className="capitalize" style={{ color: '#000000' }}>{sale.scope}</span>
      </td>
      <td className="px-6 py-4">
        <TruncatedCell text={sale.client_name} />
      </td>
      <td className="px-6 py-4">
        <TruncatedCell text={operators.find(o => o.id === sale.operator_id)?.name} />
      </td>
      <td className="px-6 py-4">
        <Badge className={getStatusBadge(sale.status)}>
          {sale.status}
        </Badge>
      </td>
      {user?.role !== 'bo' && user?.role !== 'partner_commercial' && (
        <td className="px-6 py-4">
          <span className="font-bold text-green-600">
            {(() => {
              const commission = sale.manual_commission || sale.calculated_commission;
              return commission ? `€${parseFloat(commission).toFixed(2)}` : '-';
            })()}
          </span>
        </td>
      )}
      <td className="px-6 py-4">
        <div className="flex gap-2">
          {(user?.role === 'admin' || user?.role === 'bo') ? (
            <Button
              onClick={() => openEditDialog(sale)}
              size="sm"
              variant="ghost"
              className="text-blue-600 hover:bg-blue-50"
            >
              Editar
            </Button>
          ) : (
            <Button
              onClick={() => {
                setSelectedSaleId(sale.id);
                setDetailDialogOpen(true);
              }}
              size="sm"
              variant="ghost"
              className="text-blue-600 hover:bg-blue-50"
            >
              Ver
            </Button>
          )}
          {(user?.role === 'admin' || user?.role === 'bo' || user?.role === 'partner') && (
            <Button onClick={() => openNotesDialog(sale)} size="sm" variant="ghost" className="text-purple-600 hover:bg-purple-50">
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
    </>
  );

  const renderMobileCard = (sale) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-bold text-lg" style={{ color: '#000000' }}>
          {sale.sale_code}
        </span>
        <Badge className={getStatusBadge(sale.status)}>
          {sale.status}
        </Badge>
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span style={{ color: '#595959' }}>Cliente:</span>
          <span style={{ color: '#000000' }} className="font-semibold">{sale.client_name}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: '#595959' }}>Parceiro:</span>
          <span style={{ color: '#000000' }}>{partners.find(p => p.id === sale.partner_id)?.name}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: '#595959' }}>Operadora:</span>
          <span style={{ color: '#000000' }}>{operators.find(o => o.id === sale.operator_id)?.name}</span>
        </div>
        {user?.role !== 'bo' && user?.role !== 'partner_commercial' && (
          <div className="flex justify-between">
            <span style={{ color: '#595959' }}>Comissão:</span>
            <span className="font-bold text-green-600">
              {(() => {
                const commission = sale.manual_commission || sale.calculated_commission;
                return commission ? `€${parseFloat(commission).toFixed(2)}` : '-';
              })()}
            </span>
          </div>
        )}
      </div>
      <div className="flex gap-2 pt-2 border-t border-white/20">
        {(user?.role === 'admin' || user?.role === 'bo') ? (
          <Button
            onClick={() => openEditDialog(sale)}
            size="sm"
            className="flex-1 btn-primary"
          >
            Editar
          </Button>
        ) : (
          <Button
            onClick={() => {
              setSelectedSaleId(sale.id);
              setDetailDialogOpen(true);
            }}
            size="sm"
            className="flex-1 btn-primary"
          >
            Ver Detalhes
          </Button>
        )}
        {(user?.role === 'admin' || user?.role === 'bo' || user?.role === 'partner') && (
          <Button onClick={() => openNotesDialog(sale)} size="sm" variant="outline" className="flex-1">
            Notas
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 p-6 animate-fade-in">
      {/* Header with Title and Actions */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
      >
        <div>
          <h1 className="text-4xl font-bold text-gradient-navy mb-2">Vendas</h1>
          <p className="text-sm" style={{ color: '#7a7a7a' }}>
            Gerencie as vendas e acompanhe o desempenho
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-green-500 text-green-600 hover:bg-green-50 spring-transition">
                <Download className="w-4 h-4 mr-2" />
                Exportar Excel
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-ultra">
              <DialogHeader>
                <DialogTitle style={{ color: '#000000' }}>Exportar Vendas para Excel</DialogTitle>
                <DialogDescription>Selecione o formato de exportação</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Data Início (opcional)</Label>
                  <Input
                    type="date"
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                    className="glass-input"
                  />
                </div>
                <div>
                  <Label>Data Fim (opcional)</Label>
                  <Input
                    type="date"
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                    className="glass-input"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setExportDialogOpen(false)} className="btn-secondary">
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
          {(user?.role === 'admin' || user?.role === 'backoffice') && (
            <>
              <Button
                variant="outline"
                className="border-blue-500 text-blue-600 hover:bg-blue-50 spring-transition"
                onClick={() => setImportDialogOpen(true)}
              >
                <Upload className="w-4 h-4 mr-2" />
                Importar Excel
              </Button>
              <Button
                variant="outline"
                className="border-purple-500 text-purple-600 hover:bg-purple-50 spring-transition"
                onClick={() => setRecalcDialogOpen(true)}
                disabled={loading}
              >
                <ArrowUpDown className="w-4 h-4 mr-2" />
                Recalcular Comissões
              </Button>
            </>
          )}
          <Button
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
            className="btn-gold shadow-gold-glow spring-transition"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Venda
          </Button>

          <SaleFormDialog
            isOpen={dialogOpen}
            onClose={() => setDialogOpen(false)}
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleSubmit}
            partners={partners}
            operators={operators}
            filteredOperators={filteredOperators}
            operatorCommissions={operatorCommissions}
            availableServiceTypes={availableServiceTypes}
            availableActivationTypes={availableActivationTypes}
            operatorEnergyType={operatorEnergyType}
            currentOperator={currentOperator}
            uploadFiles={uploadFiles}
            setUploadFiles={setUploadFiles}
            fetchOperatorCommissions={fetchOperatorCommissions}
            user={user}
          />
        </div>
      </motion.div>

      {/* View Mode Selector */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="flex gap-2 p-1 glass-ultra rounded-lg w-fit"
      >
        <Button
          onClick={() => {
            setViewMode("sales");
            setSelectedStatus("");
          }}
          variant={viewMode === "sales" ? "default" : "ghost"}
          size="sm"
          className={viewMode === "sales" ? "bg-gradient-to-r from-navy-900 to-navy-800 text-white hover:from-navy-800 hover:to-navy-700" : ""}
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
          className={viewMode === "proposals" ? "bg-gradient-to-r from-navy-900 to-navy-800 text-white hover:from-navy-800 hover:to-navy-700" : ""}
        >
          Propostas
        </Button>
      </motion.div>

      {/* Status Filters */}
      {viewMode === "sales" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          className="flex flex-wrap gap-2"
        >
          <Button onClick={() => setSelectedStatus("")} variant={selectedStatus === "" ? "default" : "outline"} size="sm" className="spring-transition">Todas</Button>
          <Button onClick={() => setSelectedStatus("Para registo")} variant={selectedStatus === "Para registo" ? "default" : "outline"} size="sm" className="spring-transition">Para registo</Button>
          <Button onClick={() => setSelectedStatus("Pendente")} variant={selectedStatus === "Pendente" ? "default" : "outline"} size="sm" className="spring-transition">Pendente</Button>
          <Button onClick={() => setSelectedStatus("Concluido")} variant={selectedStatus === "Concluido" ? "default" : "outline"} size="sm" className="spring-transition">Concluído</Button>
          <Button onClick={() => setSelectedStatus("Ativo")} variant={selectedStatus === "Ativo" ? "default" : "outline"} size="sm" className="spring-transition">Ativo</Button>
          <Button onClick={() => setSelectedStatus("Cancelado")} variant={selectedStatus === "Cancelado" ? "default" : "outline"} size="sm" className="spring-transition">Cancelado</Button>

          <Button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            variant={showAdvancedFilters ? "default" : "outline"}
            size="sm"
            className="ml-auto gap-2 spring-transition"
          >
            <Filter className="w-4 h-4" />
            Filtros Avançados
          </Button>
        </motion.div>
      )}

      {viewMode === "proposals" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          className="flex flex-wrap gap-2"
        >
          <Button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            variant={showAdvancedFilters ? "default" : "outline"}
            size="sm"
            className="gap-2 spring-transition"
          >
            <Filter className="w-4 h-4" />
            Filtros Avançados
          </Button>
        </motion.div>
      )}

      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
          className="glass-ultra p-6 space-y-4"
        >
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-lg" style={{ color: '#000000' }}>Filtros Avançados</h3>
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
              className="text-red-600 hover:bg-red-50"
            >
              <XIcon className="w-4 h-4 mr-1" />
              Limpar Filtros
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label>Pesquisar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Código, Cliente, NIF, Contacto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 glass-input"
                />
              </div>
            </div>

            {user?.role === 'admin' || user?.role === 'bo' ? (
              <div>
                <Label>Parceiro</Label>
                <Select value={selectedPartner} onValueChange={setSelectedPartner}>
                  <SelectTrigger className="glass-input">
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

            <div>
              <Label>Operadora</Label>
              <Select value={selectedOperator} onValueChange={setSelectedOperator}>
                <SelectTrigger className="glass-input">
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

            <div>
              <Label>Âmbito</Label>
              <Select value={selectedScope} onValueChange={setSelectedScope}>
                <SelectTrigger className="glass-input">
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

            <div>
              <Label>Data de Início</Label>
              <Input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="glass-input"
              />
            </div>

            <div>
              <Label>Data de Fim</Label>
              <Input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="glass-input"
              />
            </div>
          </div>

          <div className="text-sm pt-2 border-t border-white/10" style={{ color: '#7a7a7a' }}>
            {filteredSales.length} venda(s) encontrada(s) {filteredSales.length !== sales.length && `de ${sales.length} total`}
          </div>
        </motion.div>
      )}

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
      >
        <ResponsiveTable
          headers={headers}
          data={paginatedSales}
          renderRow={renderRow}
          renderMobileCard={renderMobileCard}
          emptyMessage="Nenhuma venda encontrada"
        />

        {/* Pagination */}
        {filteredSales.length > 0 && (
          <div className="mt-6 glass-ultra p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm" style={{ color: '#7a7a7a' }}>
              A mostrar {startIndex + 1} a {Math.min(endIndex, sortedSales.length)} de {sortedSales.length} vendas
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToFirstPage}
                disabled={currentPage === 1}
                className="spring-transition"
              >
                Primeira
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={goToPreviousPage}
                disabled={currentPage === 1}
                className="spring-transition"
              >
                Anterior
              </Button>
              <div className="flex items-center gap-1">
                {[...Array(totalPages)].map((_, index) => {
                  const pageNum = index + 1;
                  if (
                    pageNum === 1 ||
                    pageNum === totalPages ||
                    (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                  ) {
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className={currentPage === pageNum ? "bg-gradient-to-r from-navy-900 to-navy-800 text-white hover:from-navy-800 hover:to-navy-700" : "spring-transition"}
                      >
                        {pageNum}
                      </Button>
                    );
                  } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                    return <span key={pageNum} className="px-2">...</span>;
                  }
                  return null;
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
                className="spring-transition"
              >
                Próxima
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={goToLastPage}
                disabled={currentPage === totalPages}
                className="spring-transition"
              >
                Última
              </Button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Edit Sale Dialog (Admin/BO) */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="glass-ultra max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ color: '#000000' }}>Editar Venda - {editingSale?.sale_code}</DialogTitle>
            <DialogDescription>Altere os campos necessários</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateSale} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data da Venda *</Label>
                <Input
                  type="date"
                  value={editFormData.date}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setEditFormData({...editFormData, date: e.target.value})}
                  required
                  className="glass-input"
                />
                <p className="text-xs text-gray-500 mt-1">Data não pode ser futura</p>
              </div>

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
                  <SelectTrigger className="glass-input"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Para registo">Para registo</SelectItem>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                    <SelectItem value="Concluido">Concluído</SelectItem>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Cancelado">Cancelado</SelectItem>
                    <SelectItem value="Em proposta">Em proposta</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Parceiro *</Label>
                <Select
                  value={editFormData.partner_id || ""}
                  onValueChange={(v) => setEditFormData({...editFormData, partner_id: v === "admin_commissioned" ? null : v})}
                >
                  <SelectTrigger className="glass-input"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {user?.is_commissioned && (
                      <SelectItem value="admin_commissioned">Venda Própria (Admin Comissionado)</SelectItem>
                    )}
                    {partners.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Tipo de Cliente *</Label>
                <Select value={editFormData.client_type} onValueChange={(v) => setEditFormData({...editFormData, client_type: v})}>
                  <SelectTrigger className="glass-input"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="particular">Particular</SelectItem>
                    <SelectItem value="empresarial">Empresarial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Operadora *</Label>
                <Select
                  value={editFormData.operator_id}
                  onValueChange={(v) => setEditFormData({...editFormData, operator_id: v})}
                >
                  <SelectTrigger className="glass-input"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {operators.map(op => (
                      <SelectItem key={op.id} value={op.id}>
                        {op.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 bg-amber-100 border border-amber-300 rounded-lg p-3">
                <p className="text-sm text-amber-900 font-semibold">
                  🔒 Nome e NIF do cliente não podem ser alterados
                </p>
              </div>

              <div>
                <Label>Nome Cliente (Bloqueado)</Label>
                <Input
                  value={editFormData.client_name}
                  disabled
                  className="bg-gray-100 cursor-not-allowed"
                />
              </div>

              <div>
                <Label>NIF Cliente (Bloqueado)</Label>
                <Input
                  value={editFormData.client_nif}
                  disabled
                  className="bg-gray-100 cursor-not-allowed"
                />
              </div>

              <div>
                <Label>Contacto Cliente *</Label>
                <Input
                  value={editFormData.client_contact}
                  onChange={(e) => setEditFormData({...editFormData, client_contact: e.target.value})}
                  required
                  className="glass-input"
                />
              </div>

              <div>
                <Label>Email Cliente</Label>
                <Input
                  type="email"
                  value={editFormData.client_email}
                  onChange={(e) => setEditFormData({...editFormData, client_email: e.target.value})}
                  className="glass-input"
                />
              </div>

              <div>
                <Label>IBAN Cliente</Label>
                <Input
                  value={editFormData.client_iban}
                  onChange={(e) => setEditFormData({...editFormData, client_iban: e.target.value})}
                  className="glass-input"
                />
              </div>

              <div className="col-span-2">
                <Alert>
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    Os campos de morada não podem ser alterados após a criação da venda
                  </AlertDescription>
                </Alert>
              </div>

              <div className="col-span-2">
                <Label>Morada do Cliente *</Label>
                <Input
                  value={editFormData.street}
                  disabled
                  className="bg-gray-100"
                />
              </div>

              <div>
                <Label>Código Postal *</Label>
                <Input
                  value={editFormData.postal_code}
                  disabled
                  className="bg-gray-100"
                />
              </div>

              <div>
                <Label>Localidade *</Label>
                <Input
                  value={editFormData.locality}
                  disabled
                  className="bg-gray-100"
                />
              </div>

              <div className="col-span-2">
                <Label>Morada de Instalação/Fornecimento</Label>
                <Input
                  value={editFormData.installation_address}
                  disabled
                  className="bg-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">Se diferente da morada do cliente</p>
              </div>

              {editFormData.scope === 'telecomunicacoes' && (
                <>
                  <div>
                    <Label>Tipo de Serviço</Label>
                    <Select value={editFormData.service_type} onValueChange={(v) => setEditFormData({...editFormData, service_type: v})}>
                      <SelectTrigger className="glass-input"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NI">NI (Nova Instalação)</SelectItem>
                        <SelectItem value="MC">MC (Mudança de Casa)</SelectItem>
                        <SelectItem value="REFID">REFID (Refidelização)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Tipo de Ativação</Label>
                    <Select value={editFormData.activation_type} onValueChange={(v) => setEditFormData({...editFormData, activation_type: v})}>
                      <SelectTrigger className="glass-input"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Fast">Fast</SelectItem>
                        <SelectItem value="Normal">Normal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Requisição (REQ)</Label>
                    <Input
                      value={editFormData.request_number}
                      onChange={(e) => setEditFormData({...editFormData, request_number: e.target.value})}
                      placeholder="Número de requisição"
                      className="glass-input"
                    />
                  </div>

                  {(editFormData.service_type === 'REFID' || editFormData.service_type === 'Refid') ? (
                    <>
                      <div>
                        <Label>Mensalidade Atual (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editFormData.current_monthly_fee}
                          onChange={(e) => setEditFormData({...editFormData, current_monthly_fee: e.target.value})}
                          placeholder="Ex: 45.00"
                          className="glass-input"
                        />
                      </div>
                      <div>
                        <Label>Mensalidade Contratada (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editFormData.contracted_monthly_fee}
                          onChange={(e) => setEditFormData({...editFormData, contracted_monthly_fee: e.target.value})}
                          placeholder="Ex: 35.00"
                          className="glass-input"
                        />
                      </div>
                    </>
                  ) : (
                    <div>
                      <Label>Mensalidade (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editFormData.monthly_value}
                        onChange={(e) => setEditFormData({...editFormData, monthly_value: e.target.value})}
                        className="glass-input"
                      />
                    </div>
                  )}

                  <div className="col-span-2 border-t pt-4">
                    <Label className="text-base font-semibold mb-3 block">Serviços Contratados</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="edit_has_tv"
                          checked={editFormData.has_tv}
                          onChange={(e) => setEditFormData({...editFormData, has_tv: e.target.checked})}
                          className="w-4 h-4"
                        />
                        <Label htmlFor="edit_has_tv" className="cursor-pointer">TV</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="edit_has_net"
                          checked={editFormData.has_net}
                          onChange={(e) => setEditFormData({...editFormData, has_net: e.target.checked})}
                          className="w-4 h-4"
                        />
                        <Label htmlFor="edit_has_net" className="cursor-pointer">NET/Fibra</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="edit_has_lr"
                          checked={editFormData.has_lr}
                          onChange={(e) => setEditFormData({...editFormData, has_lr: e.target.checked})}
                          className="w-4 h-4"
                        />
                        <Label htmlFor="edit_has_lr" className="cursor-pointer">Linha Fixa/LR</Label>
                      </div>
                      <div>
                        <Label htmlFor="edit_mobile_count" className="text-sm">Móveis</Label>
                        <Input
                          id="edit_mobile_count"
                          type="number"
                          min="0"
                          value={editFormData.mobile_count}
                          onChange={(e) => setEditFormData({...editFormData, mobile_count: parseInt(e.target.value) || 0})}
                          className="mt-1 glass-input"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {editFormData.scope === 'solar' && (
                <>
                  <div>
                    <Label>CPE</Label>
                    <Input
                      value={editFormData.cpe}
                      onChange={(e) => setEditFormData({...editFormData, cpe: e.target.value.toUpperCase()})}
                      placeholder="PT0002XXXXXXXXXXXX"
                      className="glass-input"
                    />
                  </div>
                  <div>
                    <Label>Potência</Label>
                    <Select value={editFormData.power} onValueChange={(v) => setEditFormData({...editFormData, power: v})}>
                      <SelectTrigger className="glass-input"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {POWER_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {editFormData.scope === 'energia' && (
                <>
                  <div>
                    <Label>Tipo de Venda Energia</Label>
                    <Select value={editFormData.energy_sale_type} onValueChange={(v) => setEditFormData({...editFormData, energy_sale_type: v})}>
                      <SelectTrigger className="glass-input"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="eletricidade">Eletricidade</SelectItem>
                        <SelectItem value="gas">Gás</SelectItem>
                        <SelectItem value="dual">Dual (Eletricidade + Gás)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Tipo de Entrada</Label>
                    <Select value={editFormData.entry_type} onValueChange={(v) => setEditFormData({...editFormData, entry_type: v})}>
                      <SelectTrigger className="glass-input"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Alteração de comercializadora">Alteração de comercializadora</SelectItem>
                        <SelectItem value="Alteração de comercializadora com alteração de titular">Alteração de comercializadora com alteração de titular</SelectItem>
                        <SelectItem value="Entrada Direta">Entrada Direta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(editFormData.energy_sale_type === 'eletricidade' || editFormData.energy_sale_type === 'dual') && (
                    <>
                      <div>
                        <Label>CPE</Label>
                        <Input
                          value={editFormData.cpe}
                          onChange={(e) => setEditFormData({...editFormData, cpe: e.target.value.toUpperCase()})}
                          placeholder="PT0002XXXXXXXXXXXX"
                          className="glass-input"
                        />
                      </div>
                      <div>
                        <Label>Potência</Label>
                        <Select value={editFormData.power} onValueChange={(v) => setEditFormData({...editFormData, power: v})}>
                          <SelectTrigger className="glass-input"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>
                            {POWER_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {(editFormData.energy_sale_type === 'gas' || editFormData.energy_sale_type === 'dual') && (
                    <>
                      <div>
                        <Label>CUI</Label>
                        <Input
                          value={editFormData.cui}
                          onChange={(e) => setEditFormData({...editFormData, cui: e.target.value.toUpperCase()})}
                          placeholder="PT16XXXXXXXXXXXXXX"
                          className="glass-input"
                        />
                      </div>
                      <div>
                        <Label>Escalão</Label>
                        <Select value={editFormData.tier} onValueChange={(v) => setEditFormData({...editFormData, tier: v})}>
                          <SelectTrigger className="glass-input"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Escalão 1">Escalão 1</SelectItem>
                            <SelectItem value="Escalão 2">Escalão 2</SelectItem>
                            <SelectItem value="Escalão 3">Escalão 3</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </>
              )}

              <div className="col-span-2 flex items-center gap-4 border-t pt-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit_direct_debit"
                    checked={editFormData.has_direct_debit}
                    onChange={(e) => setEditFormData({...editFormData, has_direct_debit: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="edit_direct_debit">Débito Direto (DD)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit_electronic_invoice"
                    checked={editFormData.has_electronic_invoice}
                    onChange={(e) => setEditFormData({...editFormData, has_electronic_invoice: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="edit_electronic_invoice">Fatura Eletrónica (FE)</Label>
                </div>
              </div>

              <div className="col-span-2">
                <Label>Observações</Label>
                <Textarea
                  value={editFormData.observations}
                  onChange={(e) => setEditFormData({...editFormData, observations: e.target.value})}
                  rows={3}
                  className="glass-input"
                />
              </div>

              <div className="col-span-2 flex flex-col gap-2 border-t pt-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit_paid_to_operator"
                    checked={editFormData.paid_to_operator}
                    onChange={(e) => setEditFormData({...editFormData, paid_to_operator: e.target.checked})}
                    disabled={editFormData.status !== 'Ativo'}
                    className="w-4 h-4 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <Label htmlFor="edit_paid_to_operator" className={editFormData.status !== 'Ativo' ? 'text-gray-400' : ''}>
                    Paga pelo Operador
                  </Label>
                </div>
                {editFormData.status !== 'Ativo' && (
                  <p className="text-xs text-gray-500">Apenas disponível para vendas com estado "Ativo"</p>
                )}
              </div>

              {editFormData.paid_to_operator && (
                <div className="col-span-2">
                  <Label>Data de Pagamento</Label>
                  <Input
                    type="date"
                    value={editFormData.payment_date}
                    onChange={(e) => setEditFormData({...editFormData, payment_date: e.target.value})}
                    className="glass-input"
                  />
                </div>
              )}

              {(() => {
                const saleOperator = operators.find(op => op.id === editFormData.operator_id);
                const canEditCommission = user?.role === 'admin';
                const hasAutomaticCommission = saleOperator?.commission_mode !== 'manual' && editFormData.scope !== 'solar';
                const commissionChanged = editFormData.manual_commission !== (editingSale?.manual_commission || '');

                return (
                  <div className="col-span-2">
                    <Label>Comissão Manual (€) {!canEditCommission && <span className="text-red-500">*Apenas Administradores</span>}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editFormData.manual_commission}
                      onChange={(e) => setEditFormData({...editFormData, manual_commission: e.target.value})}
                      placeholder={hasAutomaticCommission ? "Deixar vazio para cálculo automático" : "Definir comissão"}
                      disabled={!canEditCommission}
                      className={!canEditCommission ? "bg-gray-100 cursor-not-allowed" : "glass-input"}
                    />
                    {hasAutomaticCommission && commissionChanged && editFormData.manual_commission && (
                      <Alert className="mt-2 bg-amber-50 border-amber-300">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-amber-900 text-sm">
                          <strong>Atenção:</strong> Esta operadora tem comissão automática. Ao definir um valor manual,
                          você está sobrescrevendo o cálculo automático. Deixe o campo vazio para manter o cálculo automático.
                        </AlertDescription>
                      </Alert>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {hasAutomaticCommission
                        ? 'Operadora com cálculo automático de comissão'
                        : saleOperator?.commission_mode === 'manual'
                        ? 'Operadora com comissão definida ao contrato'
                        : 'Comissão para venda Solar'}
                      {!canEditCommission && ' - Apenas administradores podem definir comissões manuais'}
                    </p>
                  </div>
                );
              })()}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)} className="btn-secondary">
                Cancelar
              </Button>
              <Button type="submit" className="btn-primary">
                Guardar Alterações
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
          <DialogContent className="glass-ultra">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2" style={{ color: '#000000' }}>
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Aviso de Validação
              </DialogTitle>
              <DialogDescription>Os seguintes avisos foram detectados</DialogDescription>
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
                <Button variant="outline" onClick={handleCancelWarnings} className="btn-secondary">
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
        <DialogContent className="glass-ultra max-w-2xl">
          <DialogHeader>
            <DialogTitle style={{ color: '#000000' }}>Notas - {selectedSaleForNotes?.sale_code}</DialogTitle>
            <DialogDescription>Visualize e adicione notas a esta venda</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Adicionar Nota</Label>
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Escreva uma nota..."
                rows={3}
                className="glass-input"
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

            <div className="space-y-2">
              <h3 className="font-semibold" style={{ color: '#000000' }}>Histórico de Notas (últimas 3):</h3>
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
      <SalesImport
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={fetchData}
      />

      {/* Recalculate Commissions Dialog (lines 1997-2044) */}
      <Dialog open={recalcDialogOpen} onOpenChange={setRecalcDialogOpen}>
        <DialogContent className="glass-ultra">
          <DialogHeader>
            <DialogTitle style={{ color: '#000000' }}>Recalcular Comissões</DialogTitle>
            <DialogDescription>
              Escolha a data a partir da qual as comissões devem ser recalculadas. Vendas anteriores a esta data não serão afetadas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Data de Início (opcional)</Label>
              <Input
                type="date"
                value={recalcStartDate}
                onChange={(e) => setRecalcStartDate(e.target.value)}
                placeholder="Deixe vazio para recalcular todas"
                className="glass-input"
              />
              <p className="text-xs text-gray-500 mt-1">
                Se deixar vazio, todas as comissões serão recalculadas desde sempre.
                Se selecionar uma data (ex: 01/01/2024), apenas vendas a partir desta data serão recalculadas.
              </p>
            </div>
            <Alert className="bg-amber-50 border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <AlertDescription>
                Esta operação pode demorar alguns minutos dependendo do número de vendas.
                As comissões serão recalculadas com base nas configurações atuais.
              </AlertDescription>
            </Alert>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => {
                setRecalcDialogOpen(false);
                setRecalcStartDate("");
              }} className="btn-secondary">
                Cancelar
              </Button>
              <Button
                onClick={handleRecalculateCommissions}
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <ArrowUpDown className="w-4 h-4 mr-2" />
                <span className="text-white">{loading ? "A recalcular..." : "Recalcular"}</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Sales;
