import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Plus, Download, ArrowUpDown, Trash2, Paperclip, AlertTriangle, Filter, X as XIcon, Search, Upload, Mail, MoreVertical } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/responsive-table";
import { Card } from "@/components/ui/card";
import { salesService } from "../services/salesService";
import { partnersService } from "../services/partnersService";
import { operatorsService } from "../services/operatorsService";
import { energyPointsService } from "../services/energyPointsService";
import { recalculateAllCommissions, recalculateSaleCommission } from "../services/commissionRecalculator";
import { supabase } from "../lib/supabase";
import SaleDetailDialog from "../components/SaleDetailDialog";
import SalesImport from "../components/SalesImport";
import SaleFormDialog from "../components/SaleFormDialog";
import SaleEditDialog from "../components/SaleEditDialog";

const POWER_OPTIONS = ["1.15kVA", "2.3kVA", "3.45kVA", "4.6kVA", "5.75kVA", "6.9kVA", "10.35kVA", "13.8kVA", "17.25kVA", "20.7kVA", "27.6kVA", "34.5kVA", "41.4kVA", "Outros"];

const Sales = ({ user }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const todayDate = new Date().toISOString().split('T')[0];
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
  const [sortField, setSortField] = useState("date");
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
      } else if (user?.role === 'admin' && user?.is_commissioned && user?.partner_id) {
        setFormData(prev => ({ ...prev, partner_id: user.partner_id }));
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
      toast.error("Nao e possivel criar venda: operadora sem comissoes configuradas!");
      return;
    }

    if (formData.scope === 'telecomunicacoes') {
      if (availableServiceTypes.length === 0) {
        toast.error("Operadora nao tem tipos de servico com comissoes configuradas!");
        return;
      }
      if (!availableServiceTypes.includes(formData.service_type)) {
        toast.error("Tipo de servico selecionado nao tem comissao configurada!");
        return;
      }
      if (availableActivationTypes.length > 0 && !formData.activation_type) {
        toast.error("Selecione o tipo de ativacao!");
        return;
      }
    }

    if (!formData.street || !formData.postal_code || !formData.locality) {
      toast.error("Morada, codigo postal e localidade sao obrigatorios!");
      return;
    }

    const postalCodeRegex = /^\d{4}-\d{3}$/;
    if (!postalCodeRegex.test(formData.postal_code)) {
      toast.error("Codigo postal invalido! Use o formato: 0000-000");
      return;
    }

    if (formData.scope === 'energia') {
      const selectedOperator = operators.find(op => op.id === formData.operator_id);
      const energyType = selectedOperator?.energy_type;
      const saleType = energyType === 'dual' ? formData.energy_sale_type : energyType;

      if (energyType === 'dual' && !formData.energy_sale_type) {
        toast.error("Selecione o tipo de adesao (Eletricidade, Gas ou Ambos)!");
        return;
      }

      const hasEletricidadeCommission = operatorCommissions.some(c =>
        c.service_type === 'eletricidade' || (c.service_types && c.service_types.includes('eletricidade'))
      );
      const hasGasCommission = operatorCommissions.some(c =>
        c.service_type === 'gas' || (c.service_types && c.service_types.includes('gas'))
      );

      if (saleType === 'eletricidade' && !hasEletricidadeCommission) {
        toast.error("Nao ha comissoes configuradas para vendas de eletricidade nesta operadora!");
        return;
      }

      if (saleType === 'gas' && !hasGasCommission) {
        toast.error("Nao ha comissoes configuradas para vendas de gas nesta operadora!");
        return;
      }

      if (saleType === 'dual' && (!hasEletricidadeCommission || !hasGasCommission)) {
        toast.error("Nao ha comissoes configuradas para vendas dual (eletricidade + gas) nesta operadora!");
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
            toast.error(`Ponto ${i + 1}: CPE e Potencia sao obrigatorios!`);
            return;
          }
        }

        if (saleType === 'gas' || saleType === 'dual') {
          const cuiField = saleType === 'dual' ? 'cui_code' : 'point_code';
          if (!point[cuiField] || !point.tier) {
            toast.error(`Ponto ${i + 1}: CUI e Escalao sao obrigatorios!`);
            return;
          }
        }
      }

      if (!formData.entry_type) {
        toast.error("Tipo de Entrada e obrigatorio!");
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
        navigate('/dashboard');
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
        navigate('/dashboard');
      }
    } catch (error) {
      const errorMessage = error.message || "Erro ao criar venda";

      if (errorMessage.includes('REQ_DUPLICATE')) {
        toast.error("Numero de requisicao ja existe no sistema");
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
    let defaultPartnerId = "";
    if (user?.role === 'partner' && partners.length > 0) {
      defaultPartnerId = partners[0].id;
    } else if (user?.role === 'admin' && user?.is_commissioned && user?.partner_id) {
      defaultPartnerId = user.partner_id;
    }

    setFormData({
      date: new Date().toISOString().split('T')[0],
      partner_id: defaultPartnerId,
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
          'Ambito': sale.scope,
          'Tipo Cliente': sale.client_type,
          'Nome Cliente': sale.client_name,
          'NIF': sale.client_nif,
          'Contacto': sale.client_contact,
          'Email': sale.client_email || '',
          'IBAN': sale.client_iban || '',
          'Debito Direto': sale.has_direct_debit ? 'Sim' : 'Nao',
          'Fatura Eletronica': sale.has_electronic_invoice ? 'Sim' : 'Nao',
          'Morada': sale.street || '',
          'Codigo Postal': sale.postal_code || '',
          'Localidade': sale.locality || '',
          'Morada Instalacao': sale.installation_address || '',
          'ID Operadora': operator?.name || sale.operator_id || '',
          'Tipo Servico': sale.service_type || '',
          'Tipo Ativacao': sale.activation_type || '',
          'Valor Mensal': sale.monthly_value || '',
          'Tipo Venda Energia': sale.energy_sale_type || '',
          'Paga Operador': sale.paid_to_operator ? 'Sim' : 'Nao',
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
                  'Potencia': point.power_kva || '',
                  'CUI': point.point_type === 'cui' ? point.point_code : '',
                  'Escalao': point.tier || '',
                  'Estado Ativacao': point.activation_status,
                  'Data Ativacao': point.activation_date ? new Date(point.activation_date).toLocaleDateString('pt-PT') : '',
                  'Pago Operador Ponto': point.operator_paid ? 'Sim' : 'Nao',
                  'Tipo Entrada': sale.entry_type || '',
                  'Status': sale.status,
                  'Nr Requisicao': sale.request_number || '',
                  'Comissao': `EUR${commission.toFixed(2)}`,
                  'Observacoes': sale.observations || ''
                });
              }
            } else {
              const showCUI = sale.energy_sale_type !== 'eletricidade';
              excelData.push({
                ...baseData,
                'CPE': sale.cpe || '',
                'Potencia': sale.power || '',
                'CUI': showCUI ? (sale.cui || '') : '',
                'Escalao': showCUI ? (sale.tier || '') : '',
                'Tipo Entrada': sale.entry_type || '',
                'Status': sale.status,
                'Nr Requisicao': sale.request_number || '',
                'Comissao': `EUR${commission.toFixed(2)}`,
                'Observacoes': sale.observations || ''
              });
            }
          } catch (error) {
            console.error('Erro ao buscar pontos de energia:', error);
            const showCUI = sale.energy_sale_type !== 'eletricidade';
            excelData.push({
              ...baseData,
              'CPE': sale.cpe || '',
              'Potencia': sale.power || '',
              'CUI': showCUI ? (sale.cui || '') : '',
              'Escalao': showCUI ? (sale.tier || '') : '',
              'Tipo Entrada': sale.entry_type || '',
              'Status': sale.status,
              'Nr Requisicao': sale.request_number || '',
              'Comissao': `EUR${commission.toFixed(2)}`,
              'Observacoes': sale.observations || ''
            });
          }
        } else {
          excelData.push({
            ...baseData,
            'CPE': sale.cpe || '',
            'Potencia': sale.power || '',
            'CUI': sale.cui || '',
            'Escalao': sale.tier || '',
            'Tipo Entrada': sale.entry_type || '',
            'Status': sale.status,
            'Nr Requisicao': sale.request_number || '',
            'Comissao': `EUR${commission.toFixed(2)}`,
            'Observacoes': sale.observations || ''
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
      toast.info('Recalculando comissoes...');

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recalculate-commissions`;
      const { data: { session } } = await supabase.auth.getSession();

      const requestBody = { force: true, ...(recalcStartDate ? { startDate: recalcStartDate } : {}) };

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

      toast.success(`Comissoes recalculadas! ${result.success_count} atualizadas, ${result.skipped} ignoradas, ${result.failed} falharam`);

      setRecalcDialogOpen(false);
      setRecalcStartDate("");
      await fetchData();
    } catch (error) {
      console.error('Erro ao recalcular comissoes:', error);
      toast.error('Erro ao recalcular comissoes');
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
          toast.error("Data de venda nao pode ser futura");
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
    const ok = await confirm({
      title: `Apagar venda ${sale.sale_code}`,
      description: 'Esta acao e irreversivel e ira remover todos os dados associados a esta venda.',
      confirmLabel: 'Apagar venda',
    });
    if (!ok) return;

    try {
      await salesService.delete(sale.id);
      toast.success("Venda apagada com sucesso!");
      fetchData();
    } catch (error) {
      toast.error("Erro ao apagar venda");
      console.error('Erro ao apagar venda:', error);
    }
  };

  const handleResendNewSaleEmail = async (sale) => {
    try {
      const result = await salesService.resendNewSaleEmail(sale.id);
      toast.success(`Email de nova venda reenviado com sucesso! (${result.to_count} destinatarios principais, ${result.bcc_count} em BCC)`);
    } catch (error) {
      toast.error(error.message || "Erro ao reenviar email de nova venda");
      console.error('Erro ao reenviar email:', error);
    }
  };

  const handleResendEditAlert = async (sale) => {
    try {
      const result = await salesService.resendEditAlert(sale.id);
      toast.success(`Alerta de edicao reenviado com sucesso! (${result.recipients_count} destinatarios)`);
    } catch (error) {
      toast.error(error.message || "Erro ao reenviar alerta de edicao");
      console.error('Erro ao reenviar alerta:', error);
    }
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      'Para registo': 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
      'Pendente': 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
      'Concluido': 'bg-green-500/10 text-green-400 border border-green-500/20',
      'Ativo': 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
      'Cancelado': 'bg-red-500/10 text-red-400 border border-red-500/20',
      'Em proposta': 'bg-slate-700/40 text-slate-300 border border-slate-600/30',
    };
    return statusColors[status] || 'bg-slate-700/40 text-slate-300 border border-slate-600/30';
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6 animate-fade-in" style={{ backgroundColor: '#080c14', minHeight: '100vh' }}>
        <div className="flex items-center justify-between">
          <div className="h-10 w-48 rounded animate-pulse" style={{ backgroundColor: '#111d2e' }} />
          <div className="flex gap-3">
            <div className="h-10 w-32 rounded animate-pulse" style={{ backgroundColor: '#111d2e' }} />
            <div className="h-10 w-32 rounded animate-pulse" style={{ backgroundColor: '#111d2e' }} />
          </div>
        </div>
        <TableSkeleton rows={10} columns={8} />
      </div>
    );
  }

  const renderSaleCard = (sale, index) => {
    const partner = partners.find(p => p.id === sale.partner_id);
    const operator = operators.find(o => o.id === sale.operator_id);
    const commission = sale.manual_commission || sale.calculated_commission;

    return (
      <motion.div
        key={sale.id || index}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.03, duration: 0.3 }}
      >
        <Card
          className="p-5 spring-transition border"
          style={{
            backgroundColor: '#111d2e',
            borderColor: 'rgba(255,255,255,0.06)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(6,182,212,0.3)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-bold text-lg text-white">{sale.sale_code}</span>
                <span className="text-sm text-slate-500">{new Date(sale.date).toLocaleDateString('pt-PT')}</span>
              </div>
              <Badge className={getStatusBadge(sale.status)}>{sale.status}</Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm">
              <div>
                <span className="text-slate-500 text-xs uppercase tracking-wide">Cliente</span>
                <p className="text-white font-semibold truncate">{sale.client_name || '-'}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs uppercase tracking-wide">Parceiro</span>
                <p className="text-slate-300 truncate">{partner?.name || '-'}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs uppercase tracking-wide">Operadora</span>
                <p className="text-slate-300 truncate">{operator?.name || '-'}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs uppercase tracking-wide">Ambito</span>
                <p className="text-slate-300 capitalize">{sale.scope || '-'}</p>
              </div>
            </div>

            {(sale.cpe || sale.cui || sale.request_number) && (
              <div className="flex flex-wrap gap-4 text-sm pt-1">
                {sale.cpe && (
                  <div>
                    <span className="text-slate-500 text-xs uppercase tracking-wide">CPE</span>
                    <p className="text-slate-300 font-mono text-xs mt-0.5">{sale.cpe}</p>
                  </div>
                )}
                {sale.cui && (
                  <div>
                    <span className="text-slate-500 text-xs uppercase tracking-wide">CUI</span>
                    <p className="text-slate-300 font-mono text-xs mt-0.5">{sale.cui}</p>
                  </div>
                )}
                {sale.request_number && (
                  <div>
                    <span className="text-slate-500 text-xs uppercase tracking-wide">Requisicao</span>
                    <p className="text-slate-300 font-mono text-xs mt-0.5">{sale.request_number}</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-2" style={{ borderTopWidth: '1px', borderTopColor: 'rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-4">
                {user?.role !== 'bo' && user?.role !== 'partner_commercial' && (
                  <span className="font-bold text-cyan-400 text-sm">
                    {commission ? `\u20AC${parseFloat(commission).toFixed(2)}` : '-'}
                  </span>
                )}
                {sale.service_type && (
                  <span className="text-xs text-slate-400 px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(17,29,46,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>{sale.service_type}</span>
                )}
                {sale.activation_type && (
                  <span className="text-xs text-slate-400 px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(17,29,46,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>{sale.activation_type}</span>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {(user?.role === 'admin' || user?.role === 'bo') ? (
                  <Button onClick={() => openEditDialog(sale)} size="sm" variant="ghost" className="text-cyan-400 hover:bg-cyan-500/10">
                    Editar
                  </Button>
                ) : (
                  <Button
                    onClick={() => { setSelectedSaleId(sale.id); setDetailDialogOpen(true); }}
                    size="sm" variant="ghost" className="text-cyan-400 hover:bg-cyan-500/10"
                  >
                    Ver
                  </Button>
                )}
                {(user?.role === 'admin' || user?.role === 'bo' || user?.role === 'partner') && (
                  <Button onClick={() => openNotesDialog(sale)} size="sm" variant="ghost" className="text-slate-400 hover:bg-slate-700/40">
                    Notas ({sale.notes?.length || 0})
                  </Button>
                )}
                {(user?.role === 'admin' || user?.role === 'bo') && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-slate-400 hover:bg-slate-700/40">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56" style={{ backgroundColor: '#111d2e', borderColor: 'rgba(255,255,255,0.1)' }}>
                      <DropdownMenuItem
                        onClick={() => handleResendNewSaleEmail(sale)}
                        className="cursor-pointer text-slate-300 focus:bg-cyan-500/10 focus:text-cyan-400"
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Reenviar Email de Venda
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleResendEditAlert(sale)}
                        className="cursor-pointer text-slate-300 focus:bg-cyan-500/10 focus:text-cyan-400"
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Reenviar Alerta de Edicao
                      </DropdownMenuItem>
                      {user?.role === 'admin' && (
                        <>
                          <DropdownMenuSeparator style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
                          <DropdownMenuItem
                            onClick={() => handleDeleteSale(sale)}
                            className="cursor-pointer text-red-400 focus:bg-red-500/10 focus:text-red-400"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Apagar Venda
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6 p-6 animate-fade-in" style={{ backgroundColor: '#080c14', minHeight: '100vh' }}>
      {confirmDialog}
      {/* Header with Title and Actions */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
      >
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Vendas</h1>
          <p className="text-sm text-slate-500">
            Gerencie as vendas e acompanhe o desempenho
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="spring-transition border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/60"
                style={{ backgroundColor: 'transparent' }}
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar Excel
              </Button>
            </DialogTrigger>
            <DialogContent style={{ backgroundColor: '#111d2e', borderColor: 'rgba(255,255,255,0.06)' }}>
              <DialogHeader>
                <DialogTitle className="text-white">Exportar Vendas para Excel</DialogTitle>
                <DialogDescription className="text-slate-400">Selecione o formato de exportacao</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label className="text-slate-400">Data Inicio (opcional)</Label>
                  <Input
                    type="date"
                    value={exportStartDate}
                    max={todayDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                    className="focus:ring-cyan-500/20 focus:border-cyan-500 text-white"
                    style={{ backgroundColor: '#0a0f1a', borderColor: '#1e3a5f' }}
                  />
                </div>
                <div>
                  <Label className="text-slate-400">Data Fim (opcional)</Label>
                  <Input
                    type="date"
                    value={exportEndDate}
                    max={todayDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                    className="focus:ring-cyan-500/20 focus:border-cyan-500 text-white"
                    style={{ backgroundColor: '#0a0f1a', borderColor: '#1e3a5f' }}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setExportDialogOpen(false)}
                    className="text-slate-300 hover:text-white"
                    style={{ backgroundColor: 'transparent', borderColor: '#1e3a5f' }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleExportExcel}
                    className="text-white font-semibold"
                    style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2)', border: 'none' }}
                  >
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
                className="spring-transition text-cyan-400 hover:bg-cyan-500/10"
                style={{ backgroundColor: 'transparent', borderColor: 'rgba(6,182,212,0.4)' }}
                onClick={() => setImportDialogOpen(true)}
              >
                <Upload className="w-4 h-4 mr-2" />
                Importar Excel
              </Button>
              <Button
                variant="outline"
                className="spring-transition text-purple-400 hover:bg-purple-500/10"
                style={{ backgroundColor: 'transparent', borderColor: 'rgba(168,85,247,0.4)' }}
                onClick={() => setRecalcDialogOpen(true)}
                disabled={loading}
              >
                <ArrowUpDown className="w-4 h-4 mr-2" />
                Recalcular Comissoes
              </Button>
            </>
          )}
          <Button
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
            className="text-white font-semibold spring-transition shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
              boxShadow: '0 0 20px rgba(6,182,212,0.3)',
              border: 'none'
            }}
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
        className="flex gap-2 p-1 rounded-lg w-fit"
        style={{ backgroundColor: 'rgba(17,29,46,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <Button
          onClick={() => {
            setViewMode("sales");
            setSelectedStatus("");
          }}
          variant={viewMode === "sales" ? "default" : "ghost"}
          size="sm"
          className={viewMode === "sales" ? "text-white" : "text-slate-400 hover:text-white"}
          style={viewMode === "sales" ? { background: 'linear-gradient(135deg, #06b6d4, #0891b2)' } : {}}
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
          className={viewMode === "proposals" ? "text-white" : "text-slate-400 hover:text-white"}
          style={viewMode === "proposals" ? { background: 'linear-gradient(135deg, #06b6d4, #0891b2)' } : {}}
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
          {[
            { label: "Todas", value: "" },
            { label: "Para registo", value: "Para registo" },
            { label: "Pendente", value: "Pendente" },
            { label: "Concluido", value: "Concluido" },
            { label: "Ativo", value: "Ativo" },
            { label: "Cancelado", value: "Cancelado" },
          ].map((statusBtn) => (
            <Button
              key={statusBtn.value}
              onClick={() => setSelectedStatus(statusBtn.value)}
              variant={selectedStatus === statusBtn.value ? "default" : "outline"}
              size="sm"
              className={
                selectedStatus === statusBtn.value
                  ? "text-white spring-transition"
                  : "text-slate-400 hover:text-white spring-transition"
              }
              style={
                selectedStatus === statusBtn.value
                  ? { background: 'linear-gradient(135deg, #06b6d4, #0891b2)', border: 'none' }
                  : { backgroundColor: 'transparent', borderColor: '#1e3a5f' }
              }
            >
              {statusBtn.label}
            </Button>
          ))}

          <Button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            variant={showAdvancedFilters ? "default" : "outline"}
            size="sm"
            className={
              showAdvancedFilters
                ? "ml-auto gap-2 spring-transition text-white"
                : "ml-auto gap-2 spring-transition text-slate-400 hover:text-white"
            }
            style={
              showAdvancedFilters
                ? { background: 'linear-gradient(135deg, #06b6d4, #0891b2)', border: 'none' }
                : { backgroundColor: 'transparent', borderColor: '#1e3a5f' }
            }
          >
            <Filter className="w-4 h-4" />
            Filtros Avancados
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
            className={
              showAdvancedFilters
                ? "gap-2 spring-transition text-white"
                : "gap-2 spring-transition text-slate-400 hover:text-white"
            }
            style={
              showAdvancedFilters
                ? { background: 'linear-gradient(135deg, #06b6d4, #0891b2)', border: 'none' }
                : { backgroundColor: 'transparent', borderColor: '#1e3a5f' }
            }
          >
            <Filter className="w-4 h-4" />
            Filtros Avancados
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
          className="glass-ultra p-6 space-y-4 rounded-xl"
          style={{ backgroundColor: 'rgba(17,29,46,0.6)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(16px)' }}
        >
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-lg text-white">Filtros Avancados</h3>
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
              className="text-red-400 hover:bg-red-500/10"
            >
              <XIcon className="w-4 h-4 mr-1" />
              Limpar Filtros
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label className="text-slate-400">Pesquisar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  placeholder="Codigo, Cliente, NIF, Contacto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 focus:ring-cyan-500/20 focus:border-cyan-500 text-white placeholder:text-slate-600"
                  style={{ backgroundColor: '#0a0f1a', borderColor: '#1e3a5f' }}
                />
              </div>
            </div>

            {user?.role === 'admin' || user?.role === 'bo' ? (
              <div>
                <Label className="text-slate-400">Parceiro</Label>
                <Select value={selectedPartner} onValueChange={setSelectedPartner}>
                  <SelectTrigger
                    className="focus:ring-cyan-500/20 focus:border-cyan-500 text-white"
                    style={{ backgroundColor: '#0a0f1a', borderColor: '#1e3a5f' }}
                  >
                    <SelectValue placeholder="Todos os parceiros" />
                  </SelectTrigger>
                  <SelectContent style={{ backgroundColor: '#111d2e', borderColor: '#1e3a5f' }}>
                    <SelectItem value="all">Todos</SelectItem>
                    {partners.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div>
              <Label className="text-slate-400">Operadora</Label>
              <Select value={selectedOperator} onValueChange={setSelectedOperator}>
                <SelectTrigger
                  className="focus:ring-cyan-500/20 focus:border-cyan-500 text-white"
                  style={{ backgroundColor: '#0a0f1a', borderColor: '#1e3a5f' }}
                >
                  <SelectValue placeholder="Todas as operadoras" />
                </SelectTrigger>
                <SelectContent style={{ backgroundColor: '#111d2e', borderColor: '#1e3a5f' }}>
                  <SelectItem value="all">Todas</SelectItem>
                  {operators.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-slate-400">Ambito</Label>
              <Select value={selectedScope} onValueChange={setSelectedScope}>
                <SelectTrigger
                  className="focus:ring-cyan-500/20 focus:border-cyan-500 text-white"
                  style={{ backgroundColor: '#0a0f1a', borderColor: '#1e3a5f' }}
                >
                  <SelectValue placeholder="Todos os ambitos" />
                </SelectTrigger>
                <SelectContent style={{ backgroundColor: '#111d2e', borderColor: '#1e3a5f' }}>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="telecomunicacoes">Telecomunicacoes</SelectItem>
                  <SelectItem value="energia">Energia</SelectItem>
                  <SelectItem value="solar">Solar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-slate-400">Data de Inicio</Label>
              <Input
                type="date"
                value={filterStartDate}
                max={todayDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="focus:ring-cyan-500/20 focus:border-cyan-500 text-white"
                style={{ backgroundColor: '#0a0f1a', borderColor: '#1e3a5f' }}
              />
            </div>

            <div>
              <Label className="text-slate-400">Data de Fim</Label>
              <Input
                type="date"
                value={filterEndDate}
                max={todayDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="focus:ring-cyan-500/20 focus:border-cyan-500 text-white"
                style={{ backgroundColor: '#0a0f1a', borderColor: '#1e3a5f' }}
              />
            </div>
          </div>

          <div className="text-sm pt-2 text-slate-500" style={{ borderTopWidth: '1px', borderTopColor: 'rgba(255,255,255,0.06)' }}>
            {filteredSales.length} venda(s) encontrada(s) {filteredSales.length !== sales.length && `de ${sales.length} total`}
          </div>
        </motion.div>
      )}

      {/* Sort Controls */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">
          {filteredSales.length} venda(s)
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Ordenar por:</span>
          <Select value={sortField} onValueChange={(v) => { setSortField(v); setCurrentPage(1); }}>
            <SelectTrigger
              className="w-[160px] h-8 text-xs text-white focus:ring-cyan-500/20 focus:border-cyan-500"
              style={{ backgroundColor: '#0a0f1a', borderColor: '#1e3a5f' }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent style={{ backgroundColor: '#111d2e', borderColor: '#1e3a5f' }}>
              <SelectItem value="date">Data</SelectItem>
              <SelectItem value="client_name">Cliente</SelectItem>
              <SelectItem value="partner_name">Parceiro</SelectItem>
              <SelectItem value="operator_name">Operadora</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="scope">Ambito</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc'); setCurrentPage(1); }}
            className="h-8 px-2 text-slate-400 hover:text-cyan-400"
            title={sortDirection === 'asc' ? 'Ascendente' : 'Descendente'}
          >
            <ArrowUpDown className="w-4 h-4" style={{ color: '#06b6d4' }} />
            <span className="text-xs ml-1">{sortDirection === 'asc' ? 'A-Z' : 'Z-A'}</span>
          </Button>
        </div>
      </div>

      {/* Sales Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
      >
        {paginatedSales.length === 0 ? (
          <div className="p-12 text-center rounded-xl" style={{ backgroundColor: '#111d2e', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-sm font-medium text-slate-400">Nenhuma venda encontrada</p>
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedSales.map((sale, index) => renderSaleCard(sale, index))}
          </div>
        )}

        {/* Pagination */}
        {filteredSales.length > 0 && (
          <div
            className="mt-6 p-4 flex flex-col md:flex-row items-center justify-between gap-4 rounded-xl"
            style={{ backgroundColor: '#111d2e', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="text-sm text-slate-500">
              A mostrar {startIndex + 1} a {Math.min(endIndex, sortedSales.length)} de {sortedSales.length} vendas
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToFirstPage}
                disabled={currentPage === 1}
                className="spring-transition text-slate-400 hover:text-white disabled:opacity-30"
                style={{ backgroundColor: 'transparent', borderColor: '#1e3a5f' }}
              >
                Primeira
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={goToPreviousPage}
                disabled={currentPage === 1}
                className="spring-transition text-slate-400 hover:text-white disabled:opacity-30"
                style={{ backgroundColor: 'transparent', borderColor: '#1e3a5f' }}
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
                        className={
                          currentPage === pageNum
                            ? "text-white spring-transition"
                            : "spring-transition text-slate-400 hover:text-white"
                        }
                        style={
                          currentPage === pageNum
                            ? { background: 'linear-gradient(135deg, #06b6d4, #0891b2)', border: 'none' }
                            : { backgroundColor: 'transparent', borderColor: '#1e3a5f' }
                        }
                      >
                        {pageNum}
                      </Button>
                    );
                  } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                    return <span key={pageNum} className="px-2 text-slate-500">...</span>;
                  }
                  return null;
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
                className="spring-transition text-slate-400 hover:text-white disabled:opacity-30"
                style={{ backgroundColor: 'transparent', borderColor: '#1e3a5f' }}
              >
                Proxima
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={goToLastPage}
                disabled={currentPage === totalPages}
                className="spring-transition text-slate-400 hover:text-white disabled:opacity-30"
                style={{ backgroundColor: 'transparent', borderColor: '#1e3a5f' }}
              >
                Ultima
              </Button>
            </div>
          </div>
        )}
      </motion.div>

      <SaleEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        editingSale={editingSale}
        editFormData={editFormData}
        setEditFormData={setEditFormData}
        onSubmit={handleUpdateSale}
        partners={partners}
        operators={operators}
        user={user}
      />

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
          <DialogContent style={{ backgroundColor: '#111d2e', borderColor: 'rgba(255,255,255,0.06)' }}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-white">
                <AlertTriangle className="w-5 h-5 text-cyan-400" />
                Aviso de Validacao
              </DialogTitle>
              <DialogDescription className="text-slate-400">Os seguintes avisos foram detectados</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <Alert className="bg-cyan-500/10 border border-cyan-500/20">
                <AlertTriangle className="w-4 h-4 text-cyan-400" />
                <AlertDescription className="text-slate-300">
                  <p className="font-semibold mb-2 text-white">Foram detetados os seguintes avisos:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {validationWarnings.map((warning, index) => (
                      <li key={index} className="text-sm text-slate-300">{warning}</li>
                    ))}
                  </ul>
                  <p className="mt-3 text-sm text-slate-400">
                    Pode corrigir os dados ou continuar mesmo assim. A venda sera criada de qualquer forma.
                  </p>
                </AlertDescription>
              </Alert>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={handleCancelWarnings}
                  className="text-slate-300 hover:text-white"
                  style={{ backgroundColor: 'transparent', borderColor: '#1e3a5f' }}
                >
                  Voltar e Corrigir
                </Button>
                <Button
                  onClick={handleContinueWithWarnings}
                  className="text-white font-semibold"
                  style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2)', border: 'none' }}
                >
                  Continuar Mesmo Assim
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Notes Dialog */}
      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent className="max-w-2xl" style={{ backgroundColor: '#111d2e', borderColor: 'rgba(255,255,255,0.06)' }}>
          <DialogHeader>
            <DialogTitle className="text-white">Notas - {selectedSaleForNotes?.sale_code}</DialogTitle>
            <DialogDescription className="text-slate-400">Visualize e adicione notas a esta venda</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-slate-400">Adicionar Nota</Label>
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Escreva uma nota..."
                rows={3}
                className="focus:ring-cyan-500/20 focus:border-cyan-500 text-white placeholder:text-slate-600"
                style={{ backgroundColor: '#0a0f1a', borderColor: '#1e3a5f' }}
              />

              <div className="flex items-center gap-2">
                <Label htmlFor="note-attachments" className="cursor-pointer">
                  <div
                    className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors hover:opacity-80"
                    style={{ backgroundColor: 'rgba(17,29,46,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <Paperclip className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-300">Anexar Documentos</span>
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
                  <span className="text-sm text-slate-400">
                    {noteAttachments.length} ficheiro(s) selecionado(s)
                  </span>
                )}
              </div>

              <Button
                onClick={handleAddNote}
                size="sm"
                className="text-white font-semibold"
                style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2)', border: 'none' }}
              >
                Adicionar Nota
              </Button>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-white">Historico de Notas (ultimas 3):</h3>
              {(!selectedSaleForNotes?.notes || selectedSaleForNotes.notes.length === 0) ? (
                <p className="text-slate-500 text-sm py-4 text-center">Nenhuma nota ainda</p>
              ) : (
                <div
                  className="space-y-2 max-h-[300px] overflow-y-auto rounded-lg p-2"
                  style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  {selectedSaleForNotes.notes.slice(0, 3).map((note) => (
                    <div key={note.id} className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(17,29,46,0.7)' }}>
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-sm text-white">{note.author}</span>
                        <span className="text-xs text-slate-500">
                          {new Date(note.created_at).toLocaleString('pt-PT')}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300">{note.content}</p>
                      {note.attachments && note.attachments.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {note.attachments.map((attachment) => (
                            <div key={attachment.id} className="flex items-center gap-2 text-xs text-cyan-400">
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
                                    toast.success("Download concluido!");
                                  } catch (error) {
                                    console.error('Error downloading:', error);
                                    toast.error("Erro ao descarregar ficheiro");
                                  }
                                }}
                                className="hover:underline text-cyan-400"
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
                    <p className="text-xs text-slate-500 text-center py-2">
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

      {/* Recalculate Commissions Dialog */}
      <Dialog open={recalcDialogOpen} onOpenChange={setRecalcDialogOpen}>
        <DialogContent style={{ backgroundColor: '#111d2e', borderColor: 'rgba(255,255,255,0.06)' }}>
          <DialogHeader>
            <DialogTitle className="text-white">Recalcular Comissoes</DialogTitle>
            <DialogDescription className="text-slate-400">
              Escolha a data a partir da qual as comissoes devem ser recalculadas. Vendas anteriores a esta data nao serao afetadas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-slate-400">Data de Inicio (opcional)</Label>
              <Input
                type="date"
                value={recalcStartDate}
                max={todayDate}
                onChange={(e) => setRecalcStartDate(e.target.value)}
                placeholder="Deixe vazio para recalcular todas"
                className="focus:ring-cyan-500/20 focus:border-cyan-500 text-white"
                style={{ backgroundColor: '#0a0f1a', borderColor: '#1e3a5f' }}
              />
              <p className="text-xs text-slate-500 mt-1">
                Se deixar vazio, todas as comissoes serao recalculadas desde sempre.
                Se selecionar uma data (ex: 01/01/2024), apenas vendas a partir desta data serao recalculadas.
              </p>
            </div>
            <Alert className="bg-cyan-500/10 border border-cyan-500/20">
              <AlertTriangle className="w-4 h-4 text-cyan-400" />
              <AlertDescription className="text-slate-300">
                Esta operacao pode demorar alguns minutos dependendo do numero de vendas.
                As comissoes serao recalculadas com base nas configuracoes atuais.
              </AlertDescription>
            </Alert>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setRecalcDialogOpen(false);
                  setRecalcStartDate("");
                }}
                className="text-slate-300 hover:text-white"
                style={{ backgroundColor: 'transparent', borderColor: '#1e3a5f' }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleRecalculateCommissions}
                disabled={loading}
                className="text-white font-semibold"
                style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)', border: 'none' }}
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
