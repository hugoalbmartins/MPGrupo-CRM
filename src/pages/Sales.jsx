import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Plus, Download, ArrowUpDown, Trash2, Paperclip, TriangleAlert as AlertTriangle, ListFilter as Filter, X as XIcon, Search, Upload, Mail, MoveVertical as MoreVertical } from "lucide-react";
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
import { generateSaleCode } from "../lib/utils-crm";
import { processFilesForUpload } from "../lib/imageCompression";
import { scopesService } from "../services/scopesService";
import SaleDetailDialog from "../components/SaleDetailDialog";
import SalesImport from "../components/SalesImport";
import SaleFormDialog from "../components/SaleFormDialog";
import SaleEditDialog from "../components/SaleEditDialog";

const POWER_OPTIONS = ["1.15kVA", "2.3kVA", "3.45kVA", "4.6kVA", "5.75kVA", "6.9kVA", "10.35kVA", "13.8kVA", "17.25kVA", "20.7kVA", "27.6kVA", "34.5kVA", "41.4kVA", "Outros"];

const formatPowerForEdit = (value) => {
  if (!value && value !== 0) return '';
  const str = String(value);
  if (str.toLowerCase().includes('kva')) return str;
  const num = parseFloat(str);
  if (isNaN(num)) return '';
  const match = POWER_OPTIONS.find(opt => opt !== 'Outros' && parseFloat(opt) === num);
  return match || '';
};

const Sales = ({ user }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { confirm, dialog: confirmDialog, close: closeConfirm } = useConfirm();
  const todayDate = new Date().toLocaleDateString('sv-SE');
  const [sales, setSales] = useState([]);
  const [partners, setPartners] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const openNewSaleHandled = useRef(false);
  const [viewMode, setViewMode] = useState("sales");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedPartner, setSelectedPartner] = useState("all");
  const [selectedOperator, setSelectedOperator] = useState("all");
  const [selectedScope, setSelectedScope] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterChargeback, setFilterChargeback] = useState("all");
  const [filterPaidPartner, setFilterPaidPartner] = useState("all");
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [exportOperatorFilter, setExportOperatorFilter] = useState("all");
  const [exportPartnerFilter, setExportPartnerFilter] = useState("all");
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
  const [skipEmail, setSkipEmail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [operatorCommissions, setOperatorCommissions] = useState([]);
  const [availableServiceTypes, setAvailableServiceTypes] = useState([]);
  const [availableActivationTypes, setAvailableActivationTypes] = useState([]);
  const [recalcDialogOpen, setRecalcDialogOpen] = useState(false);
  const [recalcStartDate, setRecalcStartDate] = useState("");
  const [recalcEndDate, setRecalcEndDate] = useState("");
  const [recalcOperatorId, setRecalcOperatorId] = useState("all");
  const [recalcPartnerType, setRecalcPartnerType] = useState("all");
  const [energySaleMode, setEnergySaleMode] = useState('normal');
  const [dynamicScopes, setDynamicScopes] = useState([]);
  const [dynamicScopeFields, setDynamicScopeFields] = useState([]);
  const [partnerAvailableOperatorIds, setPartnerAvailableOperatorIds] = useState(null);
  const [groupScopeDialog, setGroupScopeDialog] = useState({ open: false, sharedFields: [], pendingUpdatedData: null, pendingCommissionRecalc: false });

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
    mobile_numbers: [],
    fix_ported: false,
    fix_number: "",
    fix_operator: "",
    fix_cvp: "",
    observations: "",
    autoriza_documentos: "",
    is_proposal: false,
    energy_points: [],
    voltage_type: "",
    additional_services: "",
    billing_address: "",
    ev_outlet_count: "",
    ev_monthly_fee: "",
    ev_margin: "",
    ev_fidelization_months: "",
    technology: "Fibra"
  });

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [location.pathname]);

  useEffect(() => {
    if (!loading && location.state?.openNewSale && partners.length > 0 && !openNewSaleHandled.current) {
      openNewSaleHandled.current = true;
      const { partnerId } = location.state;
      resetForm();
      if (partnerId) {
        setFormData(prev => ({ ...prev, partner_id: partnerId }));
      }
      setDialogOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [loading, location.state, partners]);

  useEffect(() => {
    if (!formData.partner_id || formData.partner_id === '__admin__') {
      setPartnerAvailableOperatorIds(null);
      return;
    }
    const selectedPartner = partners.find(p => p.id === formData.partner_id);
    if (!selectedPartner) {
      setPartnerAvailableOperatorIds(null);
      return;
    }
    partnersService.getPartnerAvailableOperatorIds(formData.partner_id, selectedPartner.partner_type)
      .then(ids => setPartnerAvailableOperatorIds(ids))
      .catch(() => setPartnerAvailableOperatorIds(null));
  }, [formData.partner_id, partners]);

  useEffect(() => {
    if (!formData.scope || ['telecomunicacoes', 'energia', 'solar', 'mobilidade_eletrica'].includes(formData.scope)) {
      setDynamicScopeFields([]);
      return;
    }
    scopesService.getFieldsByScopeSlug(formData.scope).then(fields => {
      setDynamicScopeFields(fields || []);
    }).catch(() => setDynamicScopeFields([]));
  }, [formData.scope]);

  const fetchData = async () => {
    try {
      const [salesData, partnersData, operatorsData, scopesData] = await Promise.all([
        salesService.getAll(),
        partnersService.getAll(),
        operatorsService.getAll(),
        scopesService.getAll(true).catch(() => [])
      ]);
      setSales(salesData);
      setPartners(partnersData);
      setOperators(operatorsData);
      setDynamicScopes(scopesData);

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

  const handleSubmit = async (e, forceSkipEmail = false) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (!formData.partner_id) {
      toast.error("Selecione um parceiro!");
      return;
    }

    if (operatorCommissions.length === 0) {
      if (['telecomunicacoes', 'energia'].includes(formData.scope)) {
        toast.error("Nao e possivel criar venda: operadora sem comissoes configuradas!");
        return;
      }
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

    if (!formData.client_contact?.trim()) {
      toast.error("Contacto móvel do cliente é obrigatório!");
      return;
    }

    if (!formData.autoriza_documentos) {
      toast.error("Indique se o cliente autoriza copia dos documentos pessoais!");
      return;
    }

    if (energySaleMode !== 'multiponto' && energySaleMode !== 'multilocal') {
      if (!formData.street || !formData.postal_code || !formData.locality) {
        toast.error("Morada de instalação, código postal e localidade são obrigatórios!");
        return;
      }

      const postalCodeRegex = /^\d{4}-\d{3}$/;
      if (!postalCodeRegex.test(formData.postal_code)) {
        toast.error("Código postal inválido! Use o formato: 0000-000");
        return;
      }
    }

    if (formData.scope === 'mobilidade_eletrica') {
      if (!formData.ev_outlet_count || parseInt(formData.ev_outlet_count) < 1) {
        toast.error("Quantidade de tomadas instaladas é obrigatória!");
        return;
      }
      if (!formData.ev_monthly_fee || parseFloat(formData.ev_monthly_fee) < 0) {
        toast.error("Mensalidade negociada é obrigatória!");
        return;
      }
      if (!formData.ev_fidelization_months || parseInt(formData.ev_fidelization_months) < 1) {
        toast.error("Prazo de fidelização é obrigatório!");
        return;
      }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const selectedOperatorForEmail = operators.find(op => op.id === formData.operator_id);

    if (selectedOperatorForEmail?.requires_email) {
      if (!formData.client_email?.trim()) {
        toast.error("Email do cliente é obrigatório!");
        return;
      }
      if (!emailRegex.test(formData.client_email.trim())) {
        toast.error("Formato de email inválido!");
        return;
      }
    } else if (formData.client_email?.trim() && !emailRegex.test(formData.client_email.trim())) {
      toast.error("Formato de email inválido!");
      return;
    }

    if (formData.has_direct_debit && !formData.client_iban?.trim()) {
      toast.error("IBAN é obrigatório quando o cliente adere a Débito Direto!");
      return;
    }

    if (uploadFiles.length === 0) {
      toast.error("E obrigatorio adicionar pelo menos 1 anexo para criar a venda!");
      return;
    }

    if (formData.scope === 'energia') {
      const selectedOperator = operators.find(op => op.id === formData.operator_id);
      const energyType = selectedOperator?.energy_type;
      const saleType = energyType === 'dual' ? formData.energy_sale_type : energyType;

      if (energyType === 'dual' && !formData.energy_sale_type && energySaleMode !== 'multilocal') {
        toast.error("Selecione o tipo de adesao (Eletricidade, Gas ou Ambos)!");
        return;
      }

      const hasEletricidadeCommission = operatorCommissions.some(c =>
        c.service_type === 'eletricidade' || (c.service_types && c.service_types.includes('eletricidade'))
      );
      const hasGasCommission = operatorCommissions.some(c =>
        c.service_type === 'gas' || (c.service_types && c.service_types.includes('gas'))
      );

      if (energySaleMode === 'normal') {
        if (saleType === 'eletricidade' && !hasEletricidadeCommission) {
          toast.error("Nao ha comissoes configuradas para vendas de eletricidade nesta operadora!");
          return;
        }
        if (saleType === 'gas' && !hasGasCommission) {
          toast.error("Nao ha comissoes configuradas para vendas de gas nesta operadora!");
          return;
        }
        if (saleType === 'dual' && (!hasEletricidadeCommission || !hasGasCommission)) {
          toast.error("Nao ha comissoes configuradas para vendas dual nesta operadora!");
          return;
        }
      }

      if (!formData.energy_points || formData.energy_points.length === 0) {
        toast.error("Adicione pelo menos um ponto de energia (CPE/CUI)!");
        return;
      }

      const cpRegex = /^\d{4}-\d{3}$/;
      if (energySaleMode === 'multiponto') {
        const cpePoints = formData.energy_points.filter(p => p.point_type === 'cpe');
        if (cpePoints.length < 2) {
          toast.error("Venda Multiponto requer pelo menos 2 CPEs!");
          return;
        }
        for (let i = 0; i < cpePoints.length; i++) {
          if (!cpePoints[i].point_code || !cpePoints[i].power_kva) {
            toast.error(`CPE ${i + 1}: Código e Potência são obrigatórios!`);
            return;
          }
          if (!cpePoints[i].inst_street || !cpePoints[i].inst_postal_code || !cpePoints[i].inst_locality) {
            toast.error(`CPE ${i + 1}: Rua, Código Postal e Localidade são obrigatórios!`);
            return;
          }
          if (!cpRegex.test(cpePoints[i].inst_postal_code)) {
            toast.error(`CPE ${i + 1}: Código postal inválido! Use o formato: 0000-000`);
            return;
          }
        }
      } else if (energySaleMode === 'multilocal') {
        const cpePoints = formData.energy_points.filter(p => p.point_type === 'cpe');
        const cuiPoints = formData.energy_points.filter(p => p.point_type === 'cui');
        if (cpePoints.length === 0 && cuiPoints.length === 0) {
          toast.error("Adicione pelo menos um local com CPE ou CUI!");
          return;
        }
        const allLocPoints = [...cpePoints, ...cuiPoints];
        for (let i = 0; i < allLocPoints.length; i++) {
          const pt = allLocPoints[i];
          if (!pt.inst_street || !pt.inst_postal_code || !pt.inst_locality) {
            toast.error(`Local ${i + 1}: Rua, Código Postal e Localidade são obrigatórios!`);
            return;
          }
          if (!cpRegex.test(pt.inst_postal_code)) {
            toast.error(`Local ${i + 1}: Código postal inválido! Use o formato: 0000-000`);
            return;
          }
        }
        for (let i = 0; i < cpePoints.length; i++) {
          if (!cpePoints[i].point_code || !cpePoints[i].power_kva) {
            toast.error(`Local CPE ${i + 1}: Código e Potência são obrigatórios!`);
            return;
          }
          if (!cpePoints[i].entry_type) {
            toast.error(`Local ${i + 1}: Tipo de Entrada é obrigatório!`);
            return;
          }
        }
        for (let i = 0; i < cuiPoints.length; i++) {
          if (!cuiPoints[i].point_code || !cuiPoints[i].tier) {
            toast.error(`Local CUI ${i + 1}: Código e Escalão são obrigatórios!`);
            return;
          }
          const hasCPEatSameLoc = cpePoints.some(c => c.installation_address && c.installation_address === cuiPoints[i].installation_address);
          if (!hasCPEatSameLoc && !cuiPoints[i].entry_type) {
            toast.error(`Local CUI ${i + 1}: Tipo de Entrada é obrigatório!`);
            return;
          }
        }
      } else {
        const cpePoints = formData.energy_points.filter(p => p.point_type === 'cpe');
        const cuiPoints = formData.energy_points.filter(p => p.point_type === 'cui');

        if (saleType === 'eletricidade' || saleType === 'dual') {
          for (let i = 0; i < cpePoints.length; i++) {
            if (!cpePoints[i].point_code || !cpePoints[i].power_kva) {
              toast.error(`Ponto ${i + 1}: CPE e Potencia sao obrigatorios!`);
              return;
            }
          }
        }

        if (saleType === 'gas' || saleType === 'dual') {
          for (let i = 0; i < cuiPoints.length; i++) {
            if (!cuiPoints[i].point_code || !cuiPoints[i].tier) {
              toast.error(`Ponto ${i + 1}: CUI e Escalao sao obrigatorios!`);
              return;
            }
          }
        }
      }

      if (energySaleMode !== 'multilocal') {
        if (!formData.entry_type) {
          toast.error("Tipo de Entrada e obrigatorio!");
          return;
        }

        const selectedEnergyOperator = operators.find(op => op.id === formData.operator_id);
        if (selectedEnergyOperator?.requires_additional_services && (selectedEnergyOperator?.additional_services_list || []).length > 0 && !formData.additional_services?.trim()) {
          toast.error("Servicos Adicionais sao obrigatorios para esta operadora!");
          return;
        }
        if (selectedEnergyOperator?.requires_voltage_type && !formData.voltage_type) {
          toast.error("Tipo de Tensao e obrigatorio para esta operadora!");
          return;
        }
      }
    }

    try {
      const nifForCheck = (formData.client_nif || '').trim();
      const cpeCandidates = [];
      if (formData.cpe) cpeCandidates.push(formData.cpe);
      (formData.energy_points || []).forEach(p => {
        if (p.point_type === 'cpe' && p.point_code) cpeCandidates.push(p.point_code);
      });
      const cpeListForCheck = Array.from(new Set(cpeCandidates.map(c => c.toString().trim().toUpperCase()))).filter(Boolean);

      if (nifForCheck && cpeListForCheck.length > 0) {
        const duplicates = await salesService.findRecentNifCpeDuplicates(nifForCheck, cpeListForCheck);
        if (duplicates.length > 0) {
          const lines = duplicates.slice(0, 5).map(d => {
            const dt = d.date ? new Date(d.date).toLocaleDateString('pt-PT') : (d.created_at ? new Date(d.created_at).toLocaleDateString('pt-PT') : '-');
            const op = d.operator?.name ? ` · ${d.operator.name}` : '';
            return `• ${dt} · CPE ${d.cpe || '-'} · Estado: ${d.status || '-'}${op}`;
          }).join('\n');

          const confirmPromise = confirm({
            title: 'Possivel venda duplicada',
            description: `Ja existe venda com o mesmo NIF (${nifForCheck}) e CPE nas ultimas 48h:\n\n${lines}\n\nDeseja registar a venda mesmo assim? (sem resposta em 60s a venda e cancelada)`,
            confirmLabel: 'Registar mesmo assim',
            confirmVariant: 'destructive',
          });
          let timeoutId;
          const timeoutPromise = new Promise(resolve => {
            timeoutId = setTimeout(() => resolve('__timeout__'), 60000);
          });
          const result = await Promise.race([confirmPromise, timeoutPromise]);
          clearTimeout(timeoutId);

          if (result === '__timeout__') {
            closeConfirm(false);
            toast.error('Sem resposta em 60 segundos. Venda nao registada.');
            return;
          }
          if (!result) {
            return;
          }
        }
      }
    } catch (dupErr) {
      console.error('Duplicate check error:', dupErr);
    }

    setIsSubmitting(true);
    try {
      const shouldSkipEmail = skipEmail || forceSkipEmail;
      const submitData = { ...formData };
      if (shouldSkipEmail) submitData.is_bulk_import = true;
      if (submitData.monthly_value) submitData.monthly_value = parseFloat(submitData.monthly_value);
      if (submitData.current_monthly_fee) submitData.current_monthly_fee = parseFloat(submitData.current_monthly_fee);
      if (submitData.contracted_monthly_fee) submitData.contracted_monthly_fee = parseFloat(submitData.contracted_monthly_fee);

      if (submitData.service_type !== 'REFID' && submitData.service_type !== 'Refid') {
        delete submitData.current_monthly_fee;
        delete submitData.contracted_monthly_fee;
      }

      const energyPoints = submitData.energy_points || [];
      delete submitData.energy_points;

      if (formData.scope === 'energia' && (energySaleMode === 'multiponto' || energySaleMode === 'multilocal')) {
        const selectedOperator = operators.find(op => op.id === formData.operator_id);
        const energyType = selectedOperator?.energy_type;

        let allPointsForEmail = [...energyPoints];

        if (energySaleMode === 'multiponto') {
          const cpePoints = energyPoints.filter(p => p.point_type === 'cpe');
          let parentSaleId = null;
          let baseCode = null;
          let createdCount = 0;

          for (let i = 0; i < cpePoints.length; i++) {
            const pt = cpePoints[i];
            const salePayload = {
              ...submitData,
              cpe: pt.point_code?.toUpperCase() || '',
              power: formatPowerForEdit(pt.power_kva) || '',
              energy_sale_type: 'eletricidade',
              sale_type: 'multiponto',
              parent_sale_id: parentSaleId,
              street: pt.inst_street || '',
              postal_code: pt.inst_postal_code || '',
              locality: pt.inst_locality || '',
              installation_address: pt.installation_address || '',
              billing_address: pt.billing_address || '',
              is_bulk_import: true,
              _multipoint_index: i + 1,
              _multipoint_base_code: baseCode,
            };

            try {
              const result = await salesService.create(salePayload, i === 0 ? uploadFiles : []);
              if (i === 0) {
                parentSaleId = result.id;
                baseCode = result.sale_code?.replace(/_\d+$/, '') || result.sale_code;
              }
              createdCount++;
            } catch (err) {
              toast.error(`Erro ao criar venda para CPE ${i + 1}: ${err.message}`);
            }
          }

          if (parentSaleId && allPointsForEmail.length > 0) {
            energyPointsService.replacePointsForSale(parentSaleId, allPointsForEmail).catch(() => {});
          }

          toast.success(`${createdCount} ${createdCount === 1 ? 'venda criada' : 'vendas criadas'} com sucesso (Multiponto)!`);

          if (parentSaleId && !shouldSkipEmail) {
            const emailPoints = cpePoints.map(p => ({
              point_type: 'cpe',
              point_code: p.point_code?.toUpperCase() || '',
              power_kva: p.power_kva || null,
              inst_street: p.inst_street || null,
              inst_postal_code: p.inst_postal_code || null,
              inst_locality: p.inst_locality || null,
              installation_address: p.installation_address || null,
              billing_address: p.billing_address || null,
            }));
            try {
              await salesService.resendNewSaleEmail(parentSaleId, {
                sale_type: 'multiponto',
                energy_points_list: emailPoints,
              }, true);
            } catch (emailErr) {
              toast.warning("Vendas criadas, mas o email de notificação falhou. Pode reenviar manualmente.");
            }
          }
        } else if (energySaleMode === 'multilocal') {
          const cpePoints = energyPoints.filter(p => p.point_type === 'cpe');
          const cuiPoints = energyPoints.filter(p => p.point_type === 'cui');

          const localeSales = [];
          for (const pt of cpePoints) {
            localeSales.push({
              type: 'cpe', point: pt,
              energy_sale_type: cuiPoints.find(c => c.installation_address && pt.installation_address && c.installation_address === pt.installation_address) ? 'dual' : 'eletricidade'
            });
          }
          for (const pt of cuiPoints) {
            const hasCPEAtSameLocation = pt.installation_address && cpePoints.some(c => c.installation_address === pt.installation_address);
            if (!hasCPEAtSameLocation) {
              localeSales.push({ type: 'cui', point: pt, energy_sale_type: 'gas' });
            }
          }

          if (localeSales.length === 0) {
            for (const pt of cuiPoints) {
              localeSales.push({ type: 'cui', point: pt, energy_sale_type: 'gas' });
            }
          }

          let parentSaleId = null;
          let baseCode = null;
          let createdCount = 0;

          for (let i = 0; i < localeSales.length; i++) {
            const { type, point, energy_sale_type } = localeSales[i];
            const salePayload = {
              ...submitData,
              cpe: type === 'cpe' ? (point.point_code?.toUpperCase() || '') : '',
              power: type === 'cpe' ? (formatPowerForEdit(point.power_kva) || '') : '',
              cui: type === 'cui' ? (point.point_code?.toUpperCase() || '') : '',
              tier: type === 'cui' ? (point.tier || '') : '',
              energy_sale_type,
              street: point.inst_street || '',
              postal_code: point.inst_postal_code || '',
              locality: point.inst_locality || '',
              installation_address: point.installation_address || '',
              billing_address: point.billing_address || '',
              entry_type: point.entry_type || submitData.entry_type || '',
              voltage_type: point.voltage_type || submitData.voltage_type || '',
              additional_services: point.additional_services || submitData.additional_services || '',
              sale_type: 'multilocal',
              parent_sale_id: parentSaleId,
              is_bulk_import: true,
              _multipoint_index: i + 1,
              _multipoint_base_code: baseCode,
            };

            try {
              const result = await salesService.create(salePayload, i === 0 ? uploadFiles : []);
              if (i === 0) {
                parentSaleId = result.id;
                baseCode = result.sale_code?.replace(/_\d+$/, '') || result.sale_code;
              }
              createdCount++;
            } catch (err) {
              toast.error(`Erro ao criar venda para local ${i + 1}: ${err.message}`);
            }
          }

          const multilocalEmailPoints = localeSales.map(({ type, point, energy_sale_type }) => ({
            point_type: type,
            point_code: point.point_code?.toUpperCase() || '',
            power_kva: type === 'cpe' ? (point.power_kva || null) : null,
            tier: type === 'cui' ? (point.tier || null) : null,
            inst_street: point.inst_street || null,
            inst_postal_code: point.inst_postal_code || null,
            inst_locality: point.inst_locality || null,
            installation_address: point.installation_address || null,
            billing_address: point.billing_address || null,
            energy_type: energy_sale_type,
            entry_type: point.entry_type || null,
            voltage_type: point.voltage_type || null,
            additional_services: point.additional_services || null,
          }));

          if (parentSaleId && multilocalEmailPoints.length > 0) {
            energyPointsService.replacePointsForSale(parentSaleId, multilocalEmailPoints).catch(() => {});
          }

          toast.success(`${createdCount} ${createdCount === 1 ? 'venda criada' : 'vendas criadas'} com sucesso (Multilocal)!`);

          if (parentSaleId && !shouldSkipEmail) {
            try {
              await salesService.resendNewSaleEmail(parentSaleId, {
                sale_type: 'multilocal',
                energy_points_list: multilocalEmailPoints,
              }, true);
            } catch (emailErr) {
              toast.warning("Vendas criadas, mas o email de notificação falhou. Pode reenviar manualmente.");
            }
          }
        }

        setDialogOpen(false);
        resetForm();
        setSkipEmail(false);
        navigate('/dashboard');
        return;
      }

      if (formData.scope === 'energia' && energyPoints.length > 0) {
        const selectedOperator = operators.find(op => op.id === formData.operator_id);
        const energyType = selectedOperator?.energy_type;
        const saleType = energyType === 'dual' ? formData.energy_sale_type : energyType;

        const firstCPE = energyPoints.find(p => p.point_type === 'cpe') || energyPoints[0];
        const firstCUI = energyPoints.find(p => p.point_type === 'cui');

        if (saleType === 'eletricidade' || saleType === 'dual') {
          submitData.cpe = firstCPE?.point_code || '';
          submitData.power = formatPowerForEdit(firstCPE?.power_kva) || '';
        }

        if (saleType === 'gas') {
          submitData.cui = firstCPE?.point_code || '';
          submitData.tier = firstCPE?.tier || '';
        } else if (saleType === 'dual') {
          submitData.cui = firstCUI?.point_code || '';
          submitData.tier = firstCUI?.tier || '';
        }
      }

      let createdSale;

      if (!pendingSubmit) {
        const result = await salesService.checkWarningsAndCreateSale(submitData, uploadFiles);

        if (result.warnings) {
          setValidationWarnings(result.warnings);
          setPendingSubmit(true);
          if (shouldSkipEmail) setSkipEmail(true);
          return;
        }

        createdSale = result;
      } else {
        createdSale = await salesService.create(submitData, uploadFiles);
      }

      toast.success("Venda criada com sucesso!");
      setDialogOpen(false);
      resetForm();
      setValidationWarnings([]);
      setPendingSubmit(false);
      setSkipEmail(false);

      if (createdSale && createdSale.id && energyPoints && energyPoints.length > 0) {
        energyPointsService.replacePointsForSale(createdSale.id, energyPoints).catch(() => {});
      }

      if (createdSale && createdSale.id && !shouldSkipEmail) {
        try {
          await salesService.resendNewSaleEmail(createdSale.id, {}, true);
        } catch (emailErr) {
          toast.warning("Venda criada, mas o email de notificacao falhou. Pode reenviar manualmente.");
        }
      }

      navigate('/dashboard');
    } catch (error) {
      const errorMessage = error.message || "Erro ao criar venda";

      if (errorMessage.includes('REQ_DUPLICATE')) {
        toast.error("Numero de requisicao ja existe no sistema");
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
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
      mobile_numbers: [],
      fix_ported: false,
      fix_number: "",
      fix_operator: "",
      fix_cvp: "",
      energy_points: [],
      observations: "",
      autoriza_documentos: "",
      is_proposal: false,
      voltage_type: "",
      additional_services: "",
      technology: "Fibra"
    });
    setUploadFiles([]);
    setOperatorCommissions([]);
    setAvailableServiceTypes([]);
    setAvailableActivationTypes([]);
    setEnergySaleMode('normal');
  };

  const fetchOperatorCommissions = async (operatorId, partnerId = null, clientType = null) => {
    try {
      let partnerType = 'D2D';
      let assignedD2DLevel = null;
      let assignedREVLevel = null;
      const partnerIdToUse = partnerId || formData.partner_id;
      const clientTypeToUse = clientType || formData.client_type;

      if (partnerIdToUse === '__admin__') {
        partnerType = 'Rev+';
      } else if (partnerIdToUse) {
        const selectedPartner = partners.find(p => p.id === partnerIdToUse);
        if (selectedPartner) {
          partnerType = selectedPartner.partner_type;

          if (partnerType === 'D2D') {
            const { data: d2dLevelData } = await supabase
              .from('partner_d2d_operator_levels')
              .select('d2d_level')
              .eq('partner_id', partnerIdToUse)
              .eq('operator_id', operatorId)
              .maybeSingle();
            assignedD2DLevel = d2dLevelData?.d2d_level || null;
          } else if (partnerType === 'REV' || partnerType === 'Rev+') {
            const { data: revLevelData } = await supabase
              .from('partner_rev_operator_levels')
              .select('rev_level')
              .eq('partner_id', partnerIdToUse)
              .eq('operator_id', operatorId)
              .maybeSingle();
            assignedREVLevel = revLevelData?.rev_level ?? (selectedPartner.rev_level || 1);
          }
        }
      }

      let query = supabase
        .from('commission_configurations')
        .select('*')
        .eq('operator_id', operatorId)
        .eq('partner_type', partnerType);

      if (partnerType === 'D2D' && assignedD2DLevel) {
        query = query.eq('d2d_level', assignedD2DLevel);
      } else if ((partnerType === 'REV' || partnerType === 'Rev+') && assignedREVLevel) {
        query = query.eq('rev_level', assignedREVLevel);
      }

      if (clientTypeToUse) {
        query = query.eq('client_type', clientTypeToUse);
      }

      const { data, error } = await query;

      if (error) throw error;

      setOperatorCommissions(data || []);

      if (data && data.length > 0) {
        const serviceTypesSet = new Set();
        const activationTypesSet = new Set();
        const TELECOM_SERVICE_TYPES = new Set(['NI', 'MC', 'REFID', 'Refid']);
        let hasTelecomConfigs = false;

        data.forEach(config => {
          if (config.service_type) {
            serviceTypesSet.add(config.service_type);
            if (TELECOM_SERVICE_TYPES.has(config.service_type)) {
              hasTelecomConfigs = true;
            }
          }
          if (config.service_types && Array.isArray(config.service_types)) {
            config.service_types.forEach(st => {
              serviceTypesSet.add(st);
              if (TELECOM_SERVICE_TYPES.has(st)) {
                hasTelecomConfigs = true;
              }
            });
          }
          if (config.activation_type) {
            activationTypesSet.add(config.activation_type);
          }
        });

        setAvailableServiceTypes(Array.from(serviceTypesSet));

        if (activationTypesSet.size === 0 && hasTelecomConfigs) {
          setAvailableActivationTypes(['M2', 'M3', 'M4']);
        } else {
          const allTypes = Array.from(activationTypesSet).filter(t => t && t !== 'all');
          setAvailableActivationTypes(allTypes);
        }
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

  const userAllowedByOperatorAccess = (op) => {
    const access = op.sales_access || 'all_commissioned';
    const role = user?.role;
    if (access === 'everyone') return true;
    if (access === 'admin_only') return role === 'admin';
    if (access === 'bo_only') return role === 'bo';
    if (access === 'admin_bo') return role === 'admin' || role === 'bo';
    return true;
  };

  const filteredOperators = operators.filter(op => {
    if (op.scope !== formData.scope) return false;
    if (!userAllowedByOperatorAccess(op)) return false;
    if (partnerAvailableOperatorIds !== null) {
      return partnerAvailableOperatorIds.includes(op.id);
    }
    return true;
  });

  const filteredScopes = (() => {
    const allScopeSlugs = new Set(operators.map(op => op.scope).filter(Boolean));
    return dynamicScopes.filter(s => allScopeSlugs.has(s.slug));
  })();

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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStatus, selectedPartner, selectedOperator, selectedScope, filterStartDate, filterEndDate, filterChargeback, filterPaidPartner, viewMode]);

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
    if (filterChargeback === "yes" && !sale.has_chargeback) return false;
    if (filterChargeback === "pending" && sale.chargeback_status !== 'pending') return false;
    if (filterChargeback === "settled" && sale.chargeback_status !== 'settled') return false;
    if (filterChargeback === "no" && sale.has_chargeback) return false;
    if (filterPaidPartner === "yes" && !sale.paid_in_report_id) return false;
    if (filterPaidPartner === "no" && sale.paid_in_report_id) return false;
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      const haystack = [
        sale.sale_code,
        sale.client_name,
        sale.customer_name,
        sale.client_nif,
        sale.client_contact,
        sale.client_email,
        sale.cpe,
        sale.cui,
        sale.request_number,
      ]
        .filter(v => v !== null && v !== undefined)
        .map(v => String(v).toLowerCase())
        .join(' | ');
      if (!haystack.includes(query)) return false;
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

    if (sortField === 'created_at' || sortField === 'date') {
      const aTime = aValue ? new Date(aValue).getTime() : 0;
      const bTime = bValue ? new Date(bValue).getTime() : 0;
      return sortDirection === 'asc' ? aTime - bTime : bTime - aTime;
    }
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

  const formatDateExtended = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('pt-PT');
    } catch {
      return '';
    }
  };

  const handleExportExcel = async () => {
    try {
      let dataToExport = [...sales];

      if (exportStartDate) {
        dataToExport = dataToExport.filter(sale => new Date(sale.date) >= new Date(exportStartDate));
      }
      if (exportEndDate) {
        dataToExport = dataToExport.filter(sale => new Date(sale.date) <= new Date(exportEndDate));
      }
      if (exportOperatorFilter && exportOperatorFilter !== 'all') {
        dataToExport = dataToExport.filter(sale => sale.operator_id === exportOperatorFilter);
      }
      if (exportPartnerFilter && exportPartnerFilter !== 'all') {
        dataToExport = dataToExport.filter(sale => sale.partner_id === exportPartnerFilter);
      }

      dataToExport = dataToExport.filter(sale =>
        !sale.parent_sale_id || (sale.sale_type !== 'multiponto' && sale.sale_type !== 'multilocal')
      );

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
          'Codigo Venda': sale.sale_code || '',
          'Data': formatDateExtended(sale.date),
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
          'Tecnologia': sale.scope === 'telecomunicacoes' ? (sale.technology || 'Fibra') : '',
          'Tipo Servico': sale.service_type || '',
          'Tipo Ativacao': sale.activation_type || '',
          'Valor Mensal': sale.monthly_value || '',
          'TV': sale.has_tv ? 'Sim' : 'Nao',
          'NET/Fibra': sale.has_net ? 'Sim' : 'Nao',
          'Linha Fixa/LR': sale.has_lr ? 'Sim' : 'Nao',
          'Fixo Portado': sale.fix_ported ? 'Sim' : 'Nao',
          'Numero Fixo Portar': sale.fix_ported ? (sale.fix_number || '') : '',
          'Operadora Fixo Atual': sale.fix_ported ? (sale.fix_operator || '') : '',
          'CVP Fixo': sale.fix_ported ? (sale.fix_cvp || '') : '',
          'Qtd Moveis': sale.mobile_count || 0,
          ...(() => {
            const mobiles = sale.mobile_numbers || [];
            const cols = {};
            for (let i = 0; i < 5; i++) {
              const mob = mobiles[i];
              if (mob) {
                cols[`Movel ${i+1} Numero`] = mob.novo ? 'Novo' : (mob.number || '');
                cols[`Movel ${i+1} Portado`] = mob.novo ? 'Novo' : (mob.ported ? 'Sim' : 'Nao');
                cols[`Movel ${i+1} CVP`] = mob.novo ? '' : (mob.ported ? (mob.cvp || '') : '');
              } else {
                cols[`Movel ${i+1} Numero`] = '';
                cols[`Movel ${i+1} Portado`] = '';
                cols[`Movel ${i+1} CVP`] = '';
              }
            }
            return cols;
          })(),
          'Tipo Venda Energia': sale.energy_sale_type || '',
          'Campanha': sale.campaign || '',
          'Servicos Adicionais': sale.additional_services || '',
          ...((user?.role === 'admin' || user?.role === 'bo') ? {
            'Paga Operador': sale.paid_to_operator ? 'Sim' : 'Nao',
            'Data Pagamento': formatDateExtended(sale.payment_date)
          } : {})
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
                  'Data Ativacao Ponto': formatDateExtended(point.activation_date),
                  ...((user?.role === 'admin' || user?.role === 'bo') ? { 'Pago Operador Ponto': point.operator_paid ? 'Sim' : 'Nao' } : {}),
                  'Tipo Entrada': sale.entry_type || '',
                  'Status': sale.status,
                  'Data Ativacao': formatDateExtended(sale.activation_date),
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
                'Data Ativacao': formatDateExtended(sale.activation_date),
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
              'Data Ativacao': formatDateExtended(sale.activation_date),
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
            'Data Ativacao': formatDateExtended(sale.activation_date),
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

      const requestBody = { force: true };
      if (recalcStartDate) requestBody.startDate = recalcStartDate;
      if (recalcEndDate) requestBody.endDate = recalcEndDate;
      if (recalcOperatorId && recalcOperatorId !== 'all') requestBody.operatorId = recalcOperatorId;
      if (recalcPartnerType && recalcPartnerType !== 'all') requestBody.partnerType = recalcPartnerType;

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
      setRecalcEndDate("");
      setRecalcOperatorId("all");
      setRecalcPartnerType("all");
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
      power: formatPowerForEdit(sale.power),
      cui: sale.cui || "",
      tier: sale.tier || "",
      entry_type: sale.entry_type || "",
      has_direct_debit: Boolean(sale.has_direct_debit),
      has_electronic_invoice: Boolean(sale.has_electronic_invoice),
      has_tv: Boolean(sale.has_tv),
      has_net: Boolean(sale.has_net),
      has_lr: Boolean(sale.has_lr),
      mobile_count: sale.mobile_count || 0,
      mobile_numbers: sale.mobile_numbers || [],
      fix_ported: Boolean(sale.fix_ported),
      fix_number: sale.fix_number || "",
      fix_operator: sale.fix_operator || "",
      fix_cvp: sale.fix_cvp || "",
      observations: sale.observations || "",
      attachments: sale.attachments || [],
      activated_at: sale.activated_at ? sale.activated_at.split('T')[0] : "",
      activation_date: sale.activation_date || "",
      refidelizacao_prazo: sale.refidelizacao_prazo || null,
      refidelizacao_unidade: sale.refidelizacao_unidade || 'dias',
      has_chargeback: Boolean(sale.has_chargeback),
      voltage_type: sale.voltage_type || "",
      additional_services: sale.additional_services || "",
    });
    setEditDialogOpen(true);
  };

  const GROUP_SHARED_FIELDS = [
    'date', 'status', 'activation_date', 'activated_at', 'cancelled_at',
    'paid_to_operator', 'payment_date',
    'client_type', 'client_name', 'client_nif', 'client_contact', 'client_email', 'client_iban',
  ];

  const detectChangedSharedFields = (originalSale, updatedData) => {
    const changed = [];
    for (const key of GROUP_SHARED_FIELDS) {
      if (!(key in updatedData)) continue;
      const newVal = updatedData[key];
      let oldVal = originalSale?.[key];
      if (key === 'date' && typeof oldVal === 'string') oldVal = oldVal.split('T')[0];
      if (key === 'payment_date' && typeof oldVal === 'string') oldVal = oldVal ? oldVal.split('T')[0] : '';
      if (key === 'activated_at' && typeof oldVal === 'string') oldVal = oldVal ? oldVal.split('T')[0] : '';
      const normOld = oldVal === null || oldVal === undefined ? '' : (typeof oldVal === 'boolean' ? oldVal : String(oldVal));
      const normNew = newVal === null || newVal === undefined ? '' : (typeof newVal === 'boolean' ? newVal : String(newVal));
      if (normOld !== normNew) changed.push(key);
    }
    return changed;
  };

  const applyUpdateToSale = async (saleId, updatedData, isPrimary, recalcCommission) => {
    await salesService.update(saleId, updatedData);
    if (recalcCommission) {
      try {
        await recalculateSaleCommission(saleId);
      } catch (err) {
        console.error('Error recalculating commission for sale', saleId, err);
      }
    }
  };

  const persistSaleUpdate = async (updatedData, applyToGroup, sharedFields) => {
    const recalc = !editFormData.manual_commission;
    await applyUpdateToSale(editingSale.id, updatedData, true, recalc);

    if (applyToGroup) {
      try {
        const siblingIds = await salesService.getGroupSiblings(editingSale);
        if (siblingIds.length > 0) {
          const siblingUpdate = {};
          for (const field of sharedFields) {
            if (field in updatedData) siblingUpdate[field] = updatedData[field];
          }
          if ('status' in siblingUpdate) {
            if (siblingUpdate.status === 'Ativo') siblingUpdate.activated_at = updatedData.activated_at;
            if (siblingUpdate.status === 'Cancelado' || siblingUpdate.status === 'Recusado') {
              siblingUpdate.cancelled_at = updatedData.cancelled_at;
              siblingUpdate.calculated_commission = '0';
              siblingUpdate.manual_commission = null;
              siblingUpdate.direct_debit_value = null;
              siblingUpdate.electronic_invoice_value = null;
            }
          }
          await Promise.all(siblingIds.map(id => applyUpdateToSale(id, siblingUpdate, false, recalc)));
        }
      } catch (err) {
        console.error('Error propagating update to group siblings:', err);
        toast.error('Venda atualizada, mas falhou a propagacao a outros pontos do grupo');
      }
    }

    toast.success(applyToGroup ? "Venda e pontos do grupo atualizados!" : "Venda atualizada com sucesso!");
    setEditDialogOpen(false);
    fetchData();
  };

  const handleUpdateSale = async (e) => {
    e.preventDefault();
    try {
      if (editFormData.date) {
        const todayStr = new Date().toLocaleDateString('sv-SE');
        if (editFormData.date > todayStr) {
          toast.error("Data de venda nao pode ser futura");
          return;
        }
      }

      if (editFormData.status === 'Ativo' && !editFormData.activation_date) {
        toast.error("Data de ativacao e obrigatoria para o estado Ativo");
        return;
      }

      if ((editFormData.status === 'Cancelado' || editFormData.status === 'Recusado') && !editFormData.observations?.trim()) {
        toast.error("Observacoes sao obrigatorias para o estado Cancelado/Recusado (motivo)");
        return;
      }

      const updatedData = { ...editFormData };

      if (editFormData.status === 'Ativo') {
        updatedData.activated_at = new Date().toISOString();
      }
      if (editFormData.status === 'Cancelado' || editFormData.status === 'Recusado') {
        updatedData.cancelled_at = new Date().toISOString();
        updatedData.calculated_commission = '0';
        updatedData.manual_commission = null;
        updatedData.direct_debit_value = null;
        updatedData.electronic_invoice_value = null;
      }

      const originalPartnerId = editingSale.partner_id || null;
      const newPartnerId = editFormData.partner_id === 'admin_commissioned' ? null : (editFormData.partner_id || null);

      if (newPartnerId !== originalPartnerId) {
        try {
          const newCode = await generateSaleCode(newPartnerId, editFormData.date || editingSale.date, supabase);
          updatedData.sale_code = newCode;
        } catch (codeError) {
          console.error('Error generating new sale code:', codeError);
        }
      }

      const isGroupSale = editingSale?.sale_type === 'multiponto' || editingSale?.sale_type === 'multilocal';
      if (isGroupSale) {
        const changedShared = detectChangedSharedFields(editingSale, updatedData);
        if (changedShared.length > 0) {
          setGroupScopeDialog({
            open: true,
            sharedFields: changedShared,
            pendingUpdatedData: updatedData,
          });
          return;
        }
      }

      await persistSaleUpdate(updatedData, false, []);
    } catch (error) {
      console.error(error);
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
        const processedNoteFiles = await processFilesForUpload(noteAttachments);
        for (const file of processedNoteFiles) {
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
    toast.promise(
      salesService.resendNewSaleEmail(sale.id),
      {
        loading: "A enviar email de nova venda...",
        success: (result) => {
          const total = result.total_recipients || 0;
          if (total === 0) return "Nenhum destinatario encontrado com alertas de email ativos";
          return `Email de nova venda enviado para ${total} destinatario${total !== 1 ? 's' : ''}`;
        },
        error: (err) => err.message || "Erro ao reenviar email de nova venda",
      }
    );
  };

  const handleResendEditAlert = async (sale) => {
    toast.promise(
      salesService.resendEditAlert(sale.id),
      {
        loading: "A reenviar alerta de edicao...",
        success: (result) => `Alerta de edicao reenviado para ${result.recipients_count || 0} destinatario${result.recipients_count !== 1 ? 's' : ''}`,
        error: (err) => err.message || "Erro ao reenviar alerta de edicao",
      }
    );
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
                {sale.sale_type === 'multiponto' && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/25">Multiponto</span>
                )}
                {sale.sale_type === 'multilocal' && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">Multilocal</span>
                )}
              </div>
              <Badge className={getStatusBadge(sale.status)}>{sale.status}</Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm">
              <div>
                <span className="text-slate-500 text-xs uppercase tracking-wide">Cliente</span>
                <p className="text-white font-semibold truncate">{sale.client_name || '-'}</p>
                {sale.client_nif && (
                  <p className="text-slate-400 font-mono text-xs mt-0.5">{sale.client_nif}</p>
                )}
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
                {sale.scope === 'telecomunicacoes' && sale.technology && sale.technology !== 'Fibra' && (
                  <span className="text-xs font-semibold text-amber-400 px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.2)' }}>{sale.technology}</span>
                )}
                {sale.scope === 'telecomunicacoes' && (!sale.technology || sale.technology === 'Fibra') && (
                  <span className="text-xs text-slate-400 px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(17,29,46,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>Fibra</span>
                )}
                {sale.service_type && (
                  <span className="text-xs text-slate-400 px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(17,29,46,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>{sale.service_type}</span>
                )}
                {sale.activation_type && (
                  <span className="text-xs text-slate-400 px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(17,29,46,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>{sale.activation_type}</span>
                )}
                {sale.has_chargeback && sale.chargeback_status === 'pending' && (
                  <span className="text-xs font-semibold text-red-400 px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>Chargeback Pendente</span>
                )}
                {sale.has_chargeback && sale.chargeback_status === 'settled' && (
                  <span className="text-xs font-semibold text-amber-400 px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.25)' }}>Chargeback Descontado</span>
                )}
                {sale.paid_in_report_id && (
                  <span className="text-xs font-semibold text-blue-400 px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)' }}>Pago Parceiro</span>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={() => { setSelectedSaleId(sale.id); setDetailDialogOpen(true); }}
                  size="sm" variant="ghost" className="text-cyan-400 hover:bg-cyan-500/10"
                >
                  Ver
                </Button>
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
                <div>
                  <Label className="text-slate-400">Operadora (opcional)</Label>
                  <Select value={exportOperatorFilter} onValueChange={setExportOperatorFilter}>
                    <SelectTrigger className="focus:ring-cyan-500/20 focus:border-cyan-500 text-white" style={{ backgroundColor: '#0a0f1a', borderColor: '#1e3a5f' }}>
                      <SelectValue placeholder="Todas as operadoras" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as operadoras</SelectItem>
                      {operators.map(op => (
                        <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-400">Parceiro (opcional)</Label>
                  <Select value={exportPartnerFilter} onValueChange={setExportPartnerFilter}>
                    <SelectTrigger className="focus:ring-cyan-500/20 focus:border-cyan-500 text-white" style={{ backgroundColor: '#0a0f1a', borderColor: '#1e3a5f' }}>
                      <SelectValue placeholder="Todos os parceiros" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os parceiros</SelectItem>
                      {partners.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
            onClose={() => { setDialogOpen(false); resetForm(); }}
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
            skipEmail={skipEmail}
            setSkipEmail={setSkipEmail}
            isSubmitting={isSubmitting}
            energySaleMode={energySaleMode}
            setEnergySaleMode={setEnergySaleMode}
            dynamicScopes={filteredScopes}
            filteredScopes={filteredScopes}
            dynamicScopeFields={dynamicScopeFields}
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
                  placeholder="Codigo, Cliente, NIF, Contacto, CPE, CUI..."
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
                  {dynamicScopes.length > 0 ? (
                    dynamicScopes.map(s => (
                      <SelectItem key={s.slug} value={s.slug}>{s.display_name}</SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="telecomunicacoes">Telecomunicacoes</SelectItem>
                      <SelectItem value="energia">Energia</SelectItem>
                      <SelectItem value="solar">Solar</SelectItem>
                    </>
                  )}
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
                className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
              />
            </div>

            <div>
              <Label className="text-slate-400">Data de Fim</Label>
              <Input
                type="date"
                value={filterEndDate}
                max={todayDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
              />
            </div>

            <div>
              <Label className="text-slate-400">Chargeback</Label>
              <Select value={filterChargeback} onValueChange={setFilterChargeback}>
                <SelectTrigger
                  className="focus:ring-cyan-500/20 focus:border-cyan-500 text-white"
                  style={{ backgroundColor: '#0a0f1a', borderColor: '#1e3a5f' }}
                >
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent style={{ backgroundColor: '#111d2e', borderColor: '#1e3a5f' }}>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="yes">Com Chargeback</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="settled">Descontado</SelectItem>
                  <SelectItem value="no">Sem Chargeback</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-slate-400">Pago Parceiro</Label>
              <Select value={filterPaidPartner} onValueChange={setFilterPaidPartner}>
                <SelectTrigger
                  className="focus:ring-cyan-500/20 focus:border-cyan-500 text-white"
                  style={{ backgroundColor: '#0a0f1a', borderColor: '#1e3a5f' }}
                >
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent style={{ backgroundColor: '#111d2e', borderColor: '#1e3a5f' }}>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="yes">Pago</SelectItem>
                  <SelectItem value="no">Nao Pago</SelectItem>
                </SelectContent>
              </Select>
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

      <Dialog open={groupScopeDialog.open} onOpenChange={(open) => { if (!open) setGroupScopeDialog({ open: false, sharedFields: [], pendingUpdatedData: null }); }}>
        <DialogContent className="bg-dark-850 border border-cyan-500/10 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white font-display">Aplicar alteracoes a {editingSale?.sale_type === 'multilocal' ? 'Multilocal' : 'Multiponto'}</DialogTitle>
            <DialogDescription className="text-slate-400">
              Esta venda pertence a um grupo com varios pontos. Detetamos alteracoes em campos partilhados: <span className="text-cyan-400 font-medium">{groupScopeDialog.sharedFields.map(f => {
                const labels = {
                  date: 'Data da venda',
                  status: 'Estado',
                  activation_date: 'Data de ativacao',
                  activated_at: 'Data de ativacao',
                  cancelled_at: 'Data de cancelamento',
                  paid_to_operator: 'Pago pela operadora',
                  payment_date: 'Data de pagamento da operadora',
                  client_type: 'Tipo de cliente',
                  client_name: 'Nome do cliente',
                  client_nif: 'NIF do cliente',
                  client_contact: 'Contacto do cliente',
                  client_email: 'Email do cliente',
                  client_iban: 'IBAN do cliente',
                };
                return labels[f] || f;
              }).join(', ')}</span>. Pretende aplicar as alteracoes apenas a este ponto ou a todos os pontos do grupo?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row gap-2 mt-4 justify-end">
            <Button
              variant="outline"
              onClick={() => setGroupScopeDialog({ open: false, sharedFields: [], pendingUpdatedData: null })}
              className="border-dark-700 text-slate-300 hover:bg-dark-700"
            >
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                const { pendingUpdatedData, sharedFields } = groupScopeDialog;
                setGroupScopeDialog({ open: false, sharedFields: [], pendingUpdatedData: null });
                try {
                  await persistSaleUpdate(pendingUpdatedData, false, sharedFields);
                } catch (err) {
                  toast.error("Erro ao atualizar venda");
                }
              }}
              className="bg-dark-900 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
            >
              Apenas este ponto
            </Button>
            <Button
              onClick={async () => {
                const { pendingUpdatedData, sharedFields } = groupScopeDialog;
                setGroupScopeDialog({ open: false, sharedFields: [], pendingUpdatedData: null });
                try {
                  await persistSaleUpdate(pendingUpdatedData, true, sharedFields);
                } catch (err) {
                  toast.error("Erro ao atualizar venda");
                }
              }}
              className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white"
            >
              Aplicar a todos os pontos
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sale Detail Dialog */}
      <SaleDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        saleId={selectedSaleId}
        user={user}
        onSaleUpdated={fetchData}
        onEditRequested={(sale) => {
          setDetailDialogOpen(false);
          openEditDialog(sale);
        }}
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
                  onChange={(e) => {
                    const MAX_SIZE = 15 * 1024 * 1024;
                    const files = Array.from(e.target.files);
                    const oversized = files.filter(f => f.size > MAX_SIZE);
                    if (oversized.length > 0) {
                      toast.error(`Ficheiro(s) excedem o limite de 15MB: ${oversized.map(f => f.name).join(', ')}`);
                      e.target.value = '';
                      return;
                    }
                    setNoteAttachments(files);
                  }}
                  className="hidden"
                />
                {noteAttachments.length > 0 && (
                  <span className="text-sm text-slate-400">
                    {noteAttachments.length} ficheiro(s) selecionado(s)
                  </span>
                )}
                <span className="text-xs text-slate-600">Max 15MB</span>
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
                            <div key={attachment.id} className={`flex items-center gap-2 text-xs ${attachment.expired ? 'text-slate-600' : 'text-cyan-400'}`}>
                              <Paperclip className="w-3 h-3" />
                              {attachment.expired ? (
                                <span className="line-through text-slate-600" title={`Expirado em ${new Date(attachment.expired_at).toLocaleDateString('pt-PT')} — ficheiro removido apos 60 dias`}>
                                  {attachment.filename}
                                </span>
                              ) : (
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
                              )}
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
      <Dialog open={recalcDialogOpen} onOpenChange={(open) => {
        setRecalcDialogOpen(open);
        if (!open) {
          setRecalcStartDate("");
          setRecalcEndDate("");
          setRecalcOperatorId("all");
          setRecalcPartnerType("all");
        }
      }}>
        <DialogContent style={{ backgroundColor: '#111d2e', borderColor: 'rgba(255,255,255,0.06)' }}>
          <DialogHeader>
            <DialogTitle className="text-white">Recalcular Comissoes</DialogTitle>
            <DialogDescription className="text-slate-400">
              Filtre por intervalo de datas, operadora e/ou tipo de parceiro. Sem filtros, todas as comissoes serao recalculadas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-400 text-xs mb-1 block">Data de Inicio (opcional)</Label>
                <Input
                  type="date"
                  value={recalcStartDate}
                  max={recalcEndDate || todayDate}
                  onChange={(e) => setRecalcStartDate(e.target.value)}
                  className="focus:ring-cyan-500/20 focus:border-cyan-500 text-white"
                  style={{ backgroundColor: '#0a0f1a', borderColor: '#1e3a5f' }}
                />
              </div>
              <div>
                <Label className="text-slate-400 text-xs mb-1 block">Data de Fim (opcional)</Label>
                <Input
                  type="date"
                  value={recalcEndDate}
                  min={recalcStartDate || undefined}
                  max={todayDate}
                  onChange={(e) => setRecalcEndDate(e.target.value)}
                  className="focus:ring-cyan-500/20 focus:border-cyan-500 text-white"
                  style={{ backgroundColor: '#0a0f1a', borderColor: '#1e3a5f' }}
                />
              </div>
            </div>
            <div>
              <Label className="text-slate-400 text-xs mb-1 block">Operadora (opcional)</Label>
              <Select value={recalcOperatorId} onValueChange={setRecalcOperatorId}>
                <SelectTrigger className="focus:ring-cyan-500/20 focus:border-cyan-500 text-white" style={{ backgroundColor: '#0a0f1a', borderColor: '#1e3a5f' }}>
                  <SelectValue placeholder="Todas as operadoras" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as operadoras</SelectItem>
                  {operators.map(op => (
                    <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-400 text-xs mb-1 block">Tipo de Parceiro (opcional)</Label>
              <Select value={recalcPartnerType} onValueChange={setRecalcPartnerType}>
                <SelectTrigger className="focus:ring-cyan-500/20 focus:border-cyan-500 text-white" style={{ backgroundColor: '#0a0f1a', borderColor: '#1e3a5f' }}>
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="D2D">D2D</SelectItem>
                  <SelectItem value="REV">REV</SelectItem>
                  <SelectItem value="Rev+">Rev+</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Alert className="bg-cyan-500/10 border border-cyan-500/20">
              <AlertTriangle className="w-4 h-4 text-cyan-400" />
              <AlertDescription className="text-slate-300 text-xs">
                O recalculo e feito em lotes para evitar erros de limite de recursos.
                As comissoes serao atualizadas com base nas configuracoes atuais.
              </AlertDescription>
            </Alert>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setRecalcDialogOpen(false);
                  setRecalcStartDate("");
                  setRecalcEndDate("");
                  setRecalcOperatorId("all");
                  setRecalcPartnerType("all");
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
                style={{ background: 'linear-gradient(135deg, #0ea5e9, #0369a1)', border: 'none' }}
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
