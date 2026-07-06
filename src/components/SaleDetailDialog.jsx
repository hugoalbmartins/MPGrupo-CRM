import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { X, LocationEdit as Edit2, Save, History, MessageSquare, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle, Upload, FileText, Download, Paperclip } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { salesService } from "../services/salesService";
import { operatorsService } from "../services/operatorsService";
import { partnersService } from "../services/partnersService";
import { chargebackService } from "../services/chargebackService";
import { supabase } from "../lib/supabase";

const STATUSES = [
  "Em proposta",
  "Pendente",
  "Para registo",
  "Registado",
  "Ativo",
  "Concluido",
  "Cancelado",
  "Recusado"
];

const SaleDetailDialog = ({ open, onOpenChange, saleId, user, onSaleUpdated, onEditRequested }) => {
  const [sale, setSale] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [operatorDoc, setOperatorDoc] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [operators, setOperators] = useState([]);
  const [partners, setPartners] = useState([]);
  const [chargebacks, setChargebacks] = useState([]);
  const [editingChargeback, setEditingChargeback] = useState(null);

  useEffect(() => {
    if (open && saleId) {
      fetchSaleDetails();
      loadOperatorsAndPartners();
    }
  }, [open, saleId]);

  const loadOperatorsAndPartners = async () => {
    try {
      const [operatorsData, partnersData] = await Promise.all([
        operatorsService.getAll(),
        partnersService.getAll()
      ]);
      setOperators(operatorsData);
      setPartners(partnersData);
    } catch (error) {
      console.error("Erro ao carregar operadoras e parceiros:", error);
    }
  };

  const fetchSaleDetails = async () => {
    try {
      setLoading(true);
      const [saleData, logs] = await Promise.all([
        salesService.getById(saleId),
        salesService.getAuditLogs(saleId)
      ]);
      setSale(saleData);
      setAuditLogs(logs);

      if (saleData.has_chargeback) {
        chargebackService.getBySaleId(saleId).then(setChargebacks).catch(() => {});
      } else {
        setChargebacks([]);
      }
      setEditData({
        date: saleData.date ? saleData.date.split('T')[0] : "",
        status: saleData.status,
        request_number: saleData.request_number || "",
        paid_to_operator: saleData.paid_to_operator || false,
        payment_date: saleData.payment_date || "",
        manual_commission: saleData.manual_commission || "",
        partner_id: saleData.partner_id || "",
        operator_id: saleData.operator_id || "",
        monthly_value: saleData.monthly_value || "",
        client_name: saleData.client_name || "",
        client_nif: saleData.client_nif || "",
        client_contact: saleData.client_contact || "",
        client_email: saleData.client_email || "",
        client_iban: saleData.client_iban || "",
        street: saleData.street || "",
        postal_code: saleData.postal_code || "",
        locality: saleData.locality || "",
        installation_address: saleData.installation_address || "",
        has_direct_debit: saleData.has_direct_debit || false,
        has_electronic_invoice: saleData.has_electronic_invoice || false,
        activation_date: saleData.activation_date || "",
        observations: saleData.observations || ""
      });
    } catch (error) {
      toast.error("Erro ao carregar detalhes da venda");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    try {
      setSavingEdit(true);

      if (editData.date) {
        const todayStr = new Date().toLocaleDateString('sv-SE');
        if (editData.date > todayStr) {
          toast.error("Data de venda não pode ser futura");
          setSavingEdit(false);
          return;
        }
      }

      if (editData.status === 'Ativo' && !editData.activation_date) {
        toast.error("Data de ativacao e obrigatoria para o estado Ativo");
        setSavingEdit(false);
        return;
      }

      if (editData.status === 'Cancelado' && !editData.observations?.trim()) {
        toast.error("Observacoes sao obrigatorias para o estado Cancelado");
        setSavingEdit(false);
        return;
      }

      if (editData.request_number && sale.scope === 'telecomunicacoes') {
        const isDuplicate = await salesService.checkDuplicateRequisition(
          editData.request_number,
          sale.scope,
          saleId
        );

        if (isDuplicate) {
          toast.error("Número de requisição já existe no sistema");
          return;
        }
      }

      const updateData = user?.role === 'bo'
        ? {
            status: editData.status,
            request_number: editData.request_number,
            ...(editData.status === 'Ativo' ? { activation_date: editData.activation_date } : {}),
            ...(editData.status === 'Cancelado' ? { observations: editData.observations } : {})
          }
        : editData;

      if (editData.status === 'Ativo') {
        updateData.activated_at = new Date().toISOString();
      }
      if (editData.status === 'Cancelado') {
        updateData.cancelled_at = new Date().toISOString();
      }

      await salesService.update(saleId, updateData);
      toast.success("Venda atualizada com sucesso");
      setIsEditing(false);
      await fetchSaleDetails();
      if (onSaleUpdated) onSaleUpdated();
    } catch (error) {
      toast.error("Erro ao atualizar venda");
      console.error(error);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) {
      toast.error("A nota não pode estar vazia");
      return;
    }

    try {
      setSavingNote(true);
      await salesService.addNote(saleId, newNote);
      toast.success("Nota adicionada com sucesso");
      setNewNote("");
      await fetchSaleDetails();
      if (onSaleUpdated) onSaleUpdated();
    } catch (error) {
      toast.error("Erro ao adicionar nota");
      console.error(error);
    } finally {
      setSavingNote(false);
    }
  };

  const handleUploadOperatorDoc = async () => {
    if (!operatorDoc) {
      toast.error("Selecione um ficheiro");
      return;
    }

    try {
      setUploadingDoc(true);
      await salesService.uploadOperatorValidation(saleId, operatorDoc);
      toast.success("Documento de validação carregado com sucesso");
      setOperatorDoc(null);
      await fetchSaleDetails();
      if (onSaleUpdated) onSaleUpdated();
    } catch (error) {
      toast.error("Erro ao carregar documento");
      console.error(error);
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDownloadOperatorDoc = async () => {
    try {
      await salesService.downloadOperatorValidation(sale.operator_doc_file);
      toast.success("Download iniciado");
    } catch (error) {
      toast.error("Erro ao fazer download");
      console.error(error);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      "Pendente": "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
      "Para registo": "bg-blue-500/10 text-blue-400 border-blue-500/20",
      "Registado": "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
      "Ativo": "bg-green-500/10 text-green-400 border-green-500/20",
      "Concluido": "bg-green-500/10 text-green-400 border-green-500/20",
      "Cancelado": "bg-red-500/10 text-red-400 border-red-500/20",
      "Recusado": "bg-red-500/10 text-red-400 border-red-500/20"
    };
    return colors[status] || "bg-slate-500/10 text-slate-400 border-slate-500/20";
  };

  const getActionTypeLabel = (actionType) => {
    const labels = {
      create: "Criação",
      update: "Atualização",
      status_change: "Mudança de Estado",
      note_added: "Nota Adicionada",
      payment_update: "Atualização de Pagamento"
    };
    return labels[actionType] || actionType;
  };

  const getActionTypeColor = (actionType) => {
    const colors = {
      create: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      update: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
      status_change: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      note_added: "bg-green-500/10 text-green-400 border-green-500/20",
      payment_update: "bg-orange-500/10 text-orange-400 border-orange-500/20"
    };
    return colors[actionType] || "bg-slate-500/10 text-slate-400 border-slate-500/20";
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-dark-850 border border-cyber-500/10 max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-dark-700 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold text-white">
                Detalhes da Venda
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-1">
                Código: {sale?.sale_code}
              </DialogDescription>
            </div>
            {(user?.role === 'admin' || user?.role === 'bo') && sale && (
              <Button
                size="sm"
                onClick={() => {
                  if (onEditRequested) {
                    onEditRequested(sale);
                    onOpenChange(false);
                  } else {
                    setIsEditing(true);
                  }
                }}
                className="gap-2 bg-gradient-to-r from-cyber-500 to-cyber-600 text-white"
              >
                <Edit2 className="w-4 h-4" />
                <span>Editar</span>
              </Button>
            )}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyber-500 mx-auto"></div>
            <p className="mt-4 text-slate-500">A carregar...</p>
          </div>
        ) : sale ? (
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-dark-900 border border-dark-700 p-1 rounded-lg">
              <TabsTrigger value="details" className="data-[state=active]:bg-cyber-500/10 data-[state=active]:text-cyber-400 text-slate-400">
                Detalhes
              </TabsTrigger>
              <TabsTrigger value="notes" className="data-[state=active]:bg-cyber-500/10 data-[state=active]:text-cyber-400 text-slate-400">
                Notas {sale.notes?.length > 0 && `(${sale.notes.length})`}
              </TabsTrigger>
              <TabsTrigger value="attachments" className="data-[state=active]:bg-cyber-500/10 data-[state=active]:text-cyber-400 text-slate-400">
                Anexos {sale.attachments?.length > 0 && `(${sale.attachments.length})`}
              </TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-cyber-500/10 data-[state=active]:text-cyber-400 text-slate-400">
                Histórico {auditLogs.length > 0 && `(${auditLogs.length})`}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6 mt-4">
              {isEditing ? (
                <div className="space-y-4">
                  <Alert className="bg-cyber-500/10 border border-cyber-500/20">
                    <AlertTriangle className="w-4 h-4 text-cyber-400" />
                    <AlertDescription className="text-slate-300">
                      {user?.role === 'bo'
                        ? 'Modo de edição - Pode alterar Estado e Número de Requisição'
                        : 'Modo de edição - Apenas campos específicos podem ser alterados'}
                    </AlertDescription>
                  </Alert>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-400">Data da Venda</Label>
                      <Input
                        type="date"
                        value={editData.date}
                        max={new Date().toLocaleDateString('sv-SE')}
                        onChange={(e) => setEditData({ ...editData, date: e.target.value })}
                        className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                      />
                      <p className="text-xs text-slate-500 mt-1">Data não pode ser futura</p>
                    </div>

                    <div>
                      <Label className="text-slate-400">Estado</Label>
                      <Select
                        value={editData.status}
                        onValueChange={(value) => {
                          const d = { ...editData, status: value };
                          if (value === 'Ativo' && !d.activation_date) {
                            d.activation_date = new Date().toLocaleDateString('sv-SE');
                          }
                          if (value !== 'Ativo') { d.activation_date = ""; }
                          setEditData(d);
                        }}
                      >
                        <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {editData.status === 'Ativo' && (
                      <div>
                        <Label className="text-slate-400">Data de Ativacao *</Label>
                        <Input
                          type="date"
                          value={editData.activation_date || ""}
                          onChange={(e) => setEditData({ ...editData, activation_date: e.target.value })}
                          className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                        />
                        <p className="text-xs text-slate-500 mt-1">Data em que a venda foi ativada</p>
                      </div>
                    )}

                    {editData.status === 'Cancelado' && (
                      <div className="col-span-2">
                        <Label className="text-red-400">Observacoes * (motivo do cancelamento)</Label>
                        <Textarea
                          value={editData.observations || ""}
                          onChange={(e) => setEditData({ ...editData, observations: e.target.value })}
                          rows={2}
                          placeholder="Indique o motivo do cancelamento..."
                          className={`bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white ${!editData.observations?.trim() ? 'border-red-500/50' : ''}`}
                        />
                      </div>
                    )}

                    <div>
                      <Label className="text-slate-400">Número de Requisição</Label>
                      <Input
                        value={editData.request_number}
                        onChange={(e) => setEditData({ ...editData, request_number: e.target.value })}
                        placeholder="REQ-XXXXX"
                        className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                      />
                    </div>

                    {(user?.role === 'admin' || user?.role === 'bo') && (
                      <>
                        <div>
                          <Label className="text-slate-400">Comissão Manual</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={editData.manual_commission}
                            onChange={(e) => setEditData({ ...editData, manual_commission: e.target.value })}
                            placeholder="0.00"
                            className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                          />
                        </div>

                        <div>
                          <Label className="text-slate-400">Data de Pagamento</Label>
                          <Input
                            type="date"
                            value={editData.payment_date}
                            onChange={(e) => setEditData({ ...editData, payment_date: e.target.value })}
                            className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                          />
                        </div>

                        <div className="col-span-2">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={editData.paid_to_operator}
                              onCheckedChange={(checked) => setEditData({ ...editData, paid_to_operator: checked })}
                              className="data-[state=checked]:bg-cyber-500"
                            />
                            <Label className="text-white">Pago ao Operador</Label>
                          </div>
                        </div>
                      </>
                    )}

                    {(user?.role === 'admin' || user?.role === 'bo') && (
                      <div className="col-span-2 pt-4 border-t border-dark-700">
                        <Label className="text-base font-semibold mb-2 block text-white">Validação pela Operadora</Label>

                        {sale?.operator_doc_file ? (
                          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                                  <CheckCircle className="w-5 h-5 text-green-400" />
                                </div>
                                <div>
                                  <p className="font-semibold text-green-400">Documento Carregado</p>
                                  <p className="text-xs text-green-400/70">
                                    {sale.operator_doc_uploaded_at && new Date(sale.operator_doc_uploaded_at).toLocaleString('pt-PT')}
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleDownloadOperatorDoc}
                                className="gap-2 bg-dark-900 border-dark-700 text-slate-300 hover:bg-dark-800"
                              >
                                <Download className="w-4 h-4" />
                                Download
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={(e) => setOperatorDoc(e.target.files[0])}
                                className="hidden"
                                id="operator-doc-upload"
                              />
                              <label
                                htmlFor="operator-doc-upload"
                                className="flex-1 cursor-pointer bg-dark-900 border-2 border-dashed border-dark-700 rounded-lg p-4 hover:bg-dark-800 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <FileText className="w-5 h-5 text-slate-500" />
                                  <div>
                                    <p className="text-sm font-medium text-slate-300">
                                      {operatorDoc ? operatorDoc.name : 'Clique para selecionar documento'}
                                    </p>
                                    <p className="text-xs text-slate-500">PDF, JPG, PNG (máx 10MB)</p>
                                  </div>
                                </div>
                              </label>
                              <Button
                                onClick={handleUploadOperatorDoc}
                                disabled={!operatorDoc || uploadingDoc}
                                size="sm"
                                className="gap-2 bg-gradient-to-r from-cyber-500 to-cyber-600 text-white"
                              >
                                <Upload className="w-4 h-4" />
                                {uploadingDoc ? 'A carregar...' : 'Carregar'}
                              </Button>
                            </div>
                            <p className="text-xs text-slate-500">
                              Carregue o auto ou documento de validação fornecido pela operadora
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {user?.role === 'admin' && (
                    <>
                      <div className="pt-4 border-t border-dark-700 space-y-4">
                        <h3 className="font-semibold text-lg text-white">Dados Comerciais</h3>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-slate-400">Parceiro *</Label>
                            <Select
                              value={editData.partner_id}
                              onValueChange={(v) => setEditData({...editData, partner_id: v})}
                            >
                              <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"><SelectValue placeholder="Selecione parceiro" /></SelectTrigger>
                              <SelectContent>
                                {partners.map((partner) => (
                                  <SelectItem key={partner.id} value={partner.id}>
                                    {partner.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-slate-400">Operadora *</Label>
                            <Select
                              value={editData.operator_id}
                              onValueChange={(v) => setEditData({...editData, operator_id: v})}
                            >
                              <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"><SelectValue placeholder="Selecione operadora" /></SelectTrigger>
                              <SelectContent>
                                {operators.map((operator) => (
                                  <SelectItem key={operator.id} value={operator.id}>
                                    {operator.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div>
                          <Label className="text-slate-400">Valor Mensal (€)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={editData.monthly_value}
                            onChange={(e) => setEditData({...editData, monthly_value: e.target.value})}
                            placeholder="0.00"
                            className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                          />
                        </div>
                      </div>

                      <div className="pt-4 border-t border-dark-700 space-y-4">
                        <h3 className="font-semibold text-lg text-white">Dados do Cliente</h3>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-slate-400">Nome do Cliente *</Label>
                            <Input
                              value={editData.client_name}
                              onChange={(e) => setEditData({...editData, client_name: e.target.value})}
                              placeholder="Nome completo"
                              className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                            />
                          </div>

                          <div>
                            <Label className="text-slate-400">NIF *</Label>
                            <Input
                              value={editData.client_nif}
                              onChange={(e) => setEditData({...editData, client_nif: e.target.value})}
                              placeholder="000000000"
                              className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-slate-400">Contacto *</Label>
                            <Input
                              value={editData.client_contact}
                              onChange={(e) => setEditData({...editData, client_contact: e.target.value})}
                              placeholder="Telefone"
                              className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                            />
                          </div>

                          <div>
                            <Label className="text-slate-400">Email</Label>
                            <Input
                              type="email"
                              value={editData.client_email}
                              onChange={(e) => setEditData({...editData, client_email: e.target.value})}
                              placeholder="email@exemplo.com"
                              className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                            />
                          </div>
                        </div>

                        <div>
                          <Label className="text-slate-400">IBAN</Label>
                          <Input
                            value={editData.client_iban}
                            onChange={(e) => setEditData({...editData, client_iban: e.target.value})}
                            placeholder="PT50 0000 0000 0000 0000 0000 0"
                            className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
                          />
                        </div>

                        <div className="flex gap-4">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="has_direct_debit"
                              checked={editData.has_direct_debit}
                              onChange={(e) => setEditData({...editData, has_direct_debit: e.target.checked})}
                              className="w-4 h-4 rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900"
                            />
                            <Label htmlFor="has_direct_debit" className="text-white">Débito Direto</Label>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="has_electronic_invoice"
                              checked={editData.has_electronic_invoice}
                              onChange={(e) => setEditData({...editData, has_electronic_invoice: e.target.checked})}
                              className="w-4 h-4 rounded border-dark-700 text-cyber-500 focus:ring-cyber-500/20 bg-dark-900"
                            />
                            <Label htmlFor="has_electronic_invoice" className="text-white">Fatura Eletrónica</Label>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-dark-700 space-y-4">
                        <h3 className="font-semibold text-lg text-white">Moradas</h3>
                        <Alert className="bg-cyber-500/10 border border-cyber-500/20">
                          <AlertTriangle className="w-4 h-4 text-cyber-400" />
                          <AlertDescription className="text-slate-300">
                            Os campos de morada não podem ser alterados após a criação da venda
                          </AlertDescription>
                        </Alert>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-slate-400">Morada</Label>
                            <Input
                              value={editData.street}
                              disabled
                              className="bg-dark-900 border-dark-700 text-slate-500"
                            />
                          </div>

                          <div>
                            <Label className="text-slate-400">Código Postal</Label>
                            <Input
                              value={editData.postal_code}
                              disabled
                              className="bg-dark-900 border-dark-700 text-slate-500"
                            />
                          </div>
                        </div>

                        <div>
                          <Label className="text-slate-400">Localidade</Label>
                          <Input
                            value={editData.locality}
                            disabled
                            className="bg-dark-900 border-dark-700 text-slate-500"
                          />
                        </div>

                        <div>
                          <Label className="text-slate-400">Morada de Instalação</Label>
                          <Input
                            value={editData.installation_address}
                            disabled
                            className="bg-dark-900 border-dark-700 text-slate-500"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="flex gap-2 justify-end pt-4 border-t border-dark-700">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditing(false);
                        setEditData({
                          date: sale.date ? sale.date.split('T')[0] : "",
                          status: sale.status,
                          request_number: sale.request_number || "",
                          paid_to_operator: sale.paid_to_operator || false,
                          payment_date: sale.payment_date || "",
                          manual_commission: sale.manual_commission || "",
                          partner_id: sale.partner_id || "",
                          operator_id: sale.operator_id || "",
                          monthly_value: sale.monthly_value || "",
                          client_name: sale.client_name || "",
                          client_nif: sale.client_nif || "",
                          client_contact: sale.client_contact || "",
                          client_email: sale.client_email || "",
                          client_iban: sale.client_iban || "",
                          street: sale.street || "",
                          postal_code: sale.postal_code || "",
                          locality: sale.locality || "",
                          installation_address: sale.installation_address || "",
                          has_direct_debit: sale.has_direct_debit || false,
                          has_electronic_invoice: sale.has_electronic_invoice || false
                        });
                      }}
                      className="bg-dark-900 border-dark-700 text-slate-300 hover:bg-dark-800"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleSaveEdit}
                      disabled={savingEdit}
                      className="bg-gradient-to-r from-cyber-500 to-cyber-600 text-white"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      <span className="text-white">{savingEdit ? "A guardar..." : "Guardar"}</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-dark-900 border border-dark-700 rounded-lg p-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-500">Código</p>
                        <p className="font-bold text-lg text-white">{sale.sale_code}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Data</p>
                        <p className="font-bold text-lg text-white">
                          {new Date(sale.date).toLocaleDateString('pt-PT')}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Estado</p>
                        <Badge className={`mt-1 border ${getStatusColor(sale.status)}`}>{sale.status}</Badge>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Âmbito</p>
                        <p className="font-bold capitalize text-white">{sale.scope}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-dark-900 border border-dark-700 rounded-lg p-5">
                    <h3 className="font-bold text-lg text-white mb-4 flex items-center gap-2">
                      <div className="w-1 h-6 bg-cyber-500 rounded"></div>
                      Informação do Cliente
                    </h3>
                    <div className="grid grid-cols-2 gap-4">

                      <div>
                        <Label className="text-slate-500 text-xs uppercase">Nome</Label>
                        <p className="font-semibold text-white mt-1">{sale.client_name}</p>
                      </div>

                      <div>
                        <Label className="text-slate-500 text-xs uppercase">NIF</Label>
                        <p className="font-semibold text-white mt-1">{sale.client_nif}</p>
                      </div>

                      <div>
                        <Label className="text-slate-500 text-xs uppercase">Tipo</Label>
                        <p className="font-semibold text-white mt-1 capitalize">{sale.client_type}</p>
                      </div>

                      <div>
                        <Label className="text-slate-500 text-xs uppercase">Contacto</Label>
                        <p className="font-semibold text-white mt-1">{sale.client_contact}</p>
                      </div>

                      {sale.client_email && (
                        <div className="col-span-2">
                          <Label className="text-slate-500 text-xs uppercase">Email</Label>
                          <p className="font-semibold text-white mt-1">{sale.client_email}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-dark-900 border border-dark-700 rounded-lg p-5">
                    <h3 className="font-bold text-lg text-white mb-4 flex items-center gap-2">
                      <div className="w-1 h-6 bg-cyber-500 rounded"></div>
                      Detalhes da Venda
                    </h3>
                    <div className="grid grid-cols-2 gap-4">

                      <div>
                        <Label className="text-slate-500 text-xs uppercase">Parceiro</Label>
                        <p className="font-semibold text-white mt-1">{sale.partner_name}</p>
                      </div>

                      <div>
                        <Label className="text-slate-500 text-xs uppercase">Operador</Label>
                        <p className="font-semibold text-white mt-1">{sale.operator_name}</p>
                      </div>

                      {sale.request_number && (
                        <div>
                          <Label className="text-slate-500 text-xs uppercase">Requisição</Label>
                          <p className="font-semibold text-white mt-1">{sale.request_number}</p>
                        </div>
                      )}

                      {sale.monthly_value && (
                        <div>
                          <Label className="text-slate-500 text-xs uppercase">Valor Mensal</Label>
                          <p className="font-semibold text-white mt-1">€{parseFloat(sale.monthly_value).toFixed(2)}</p>
                        </div>
                      )}

                      {user?.role !== 'bo' && user?.role !== 'partner_commercial' && sale.calculated_commission && (
                        <div>
                          <Label className="text-slate-500 text-xs uppercase">Comissão</Label>
                          <p className="font-bold text-cyber-400 mt-1 text-lg">
                            €{parseFloat(sale.calculated_commission).toFixed(2)}
                          </p>
                        </div>
                      )}

                      {(sale.cpe || sale.cui) && (
                        <div className={sale.cpe && sale.cui ? "col-span-2" : ""}>
                          <Label className="text-slate-500 text-xs uppercase">
                            {sale.cpe && sale.cui ? 'CPE / CUI' : sale.cpe ? 'CPE' : 'CUI'}
                          </Label>
                          <div className="flex flex-wrap gap-3 mt-1">
                            {sale.cpe && (
                              <span className="font-semibold text-white font-mono text-sm bg-dark-900 border border-dark-700 rounded px-2 py-0.5">{sale.cpe}</span>
                            )}
                            {sale.cui && (
                              <span className="font-semibold text-white font-mono text-sm bg-dark-900 border border-dark-700 rounded px-2 py-0.5">{sale.cui}</span>
                            )}
                          </div>
                        </div>
                      )}

                      {(user?.role === 'admin' || user?.role === 'bo') && sale.paid_to_operator && (
                        <div className="col-span-2 bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                          <div className="flex items-center gap-2 text-green-400">
                            <CheckCircle className="w-5 h-5" />
                            <span className="font-bold">Pago ao Operador</span>
                            {sale.payment_date && (
                              <span className="text-sm font-normal">
                                em {new Date(sale.payment_date).toLocaleDateString('pt-PT')}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {sale.paid_in_report_id && (
                        <div className="col-span-2 bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                          <div className="flex items-center gap-2 text-blue-400">
                            <CheckCircle className="w-5 h-5" />
                            <span className="font-bold">Pago ao Parceiro (Auto Emitido)</span>
                            {sale.paid_in_report_at && (
                              <span className="text-sm font-normal">
                                em {new Date(sale.paid_in_report_at).toLocaleDateString('pt-PT')}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {sale.has_chargeback && chargebacks.length > 0 && (
                        <div className="col-span-2 bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                          <div className="flex items-center gap-2 text-red-400 mb-3">
                            <AlertTriangle className="w-5 h-5" />
                            <span className="font-bold">Chargeback</span>
                          </div>
                          <div className="space-y-2">
                            {chargebacks.map(cb => (
                              <div key={cb.id} className="bg-dark-900 border border-dark-700 rounded-lg p-3">
                                {editingChargeback === cb.id ? (
                                  <ChargebackEditForm
                                    chargeback={cb}
                                    onSave={async (updated) => {
                                      try {
                                        await supabase
                                          .from('chargebacks')
                                          .update({ reason: updated.reason, percentage: updated.percentage, chargeback_amount: parseFloat((updated.percentage * cb.commission_amount / 100).toFixed(2)) })
                                          .eq('id', cb.id);
                                        toast.success("Chargeback atualizado");
                                        setEditingChargeback(null);
                                        const fresh = await chargebackService.getBySaleId(saleId);
                                        setChargebacks(fresh);
                                      } catch (e) { toast.error("Erro ao atualizar chargeback"); }
                                    }}
                                    onCancel={() => setEditingChargeback(null)}
                                  />
                                ) : (
                                  <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                      <p className="text-sm text-white">
                                        <span className="text-red-400 font-semibold">{cb.percentage}%</span> da comissao = <span className="font-bold text-red-300">{parseFloat(cb.chargeback_amount || 0).toFixed(2)} EUR</span>
                                      </p>
                                      <p className="text-xs text-slate-400">Motivo: {cb.reason || 'N/A'}</p>
                                      <p className="text-xs text-slate-500">
                                        Criado em {new Date(cb.created_at).toLocaleDateString('pt-PT')}
                                        {cb.commission_report_id ? (
                                          <Badge variant="outline" className="ml-2 text-xs border-green-500/30 text-green-400">Descontado em Auto</Badge>
                                        ) : (
                                          <Badge variant="outline" className="ml-2 text-xs border-red-500/30 text-red-400">Pendente</Badge>
                                        )}
                                      </p>
                                    </div>
                                    {(user?.role === 'admin' || user?.role === 'bo') && !cb.commission_report_id && (
                                      <div className="flex gap-1">
                                        <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-400 hover:text-white" onClick={() => setEditingChargeback(cb.id)}>
                                          Editar
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400 hover:text-red-300" onClick={async () => {
                                          if (!window.confirm("Anular este chargeback?")) return;
                                          try {
                                            await chargebackService.delete(cb.id, saleId);
                                            toast.success("Chargeback anulado");
                                            const fresh = await chargebackService.getBySaleId(saleId);
                                            setChargebacks(fresh);
                                            if (fresh.length === 0 && onSaleUpdated) onSaleUpdated();
                                          } catch (e) { toast.error("Erro ao anular chargeback"); }
                                        }}>
                                          Anular
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {sale.scope === 'energia' && (sale.energy_sale_type || sale.entry_type || sale.power || sale.tier || sale.voltage_type || sale.additional_services) && (
                    <div className="bg-dark-900 border border-dark-700 rounded-lg p-5">
                      <h3 className="font-bold text-lg text-white mb-4 flex items-center gap-2">
                        <div className="w-1 h-6 bg-cyber-500 rounded"></div>
                        Detalhes Energia
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        {sale.energy_sale_type && (
                          <div>
                            <Label className="text-slate-500 text-xs uppercase">Tipo de Adesao</Label>
                            <p className="font-semibold text-white mt-1 capitalize">{sale.energy_sale_type === 'dual' ? 'Eletricidade + Gas (Dual)' : sale.energy_sale_type === 'eletricidade' ? 'Eletricidade' : 'Gas'}</p>
                          </div>
                        )}
                        {sale.entry_type && (
                          <div>
                            <Label className="text-slate-500 text-xs uppercase">Tipo de Entrada</Label>
                            <p className="font-semibold text-white mt-1">{sale.entry_type}</p>
                          </div>
                        )}
                        {sale.power && (
                          <div>
                            <Label className="text-slate-500 text-xs uppercase">Potencia</Label>
                            <p className="font-semibold text-white mt-1">{sale.power}</p>
                          </div>
                        )}
                        {sale.tier && (
                          <div>
                            <Label className="text-slate-500 text-xs uppercase">Escalao (Gas)</Label>
                            <p className="font-semibold text-white mt-1">{sale.tier}</p>
                          </div>
                        )}
                        {sale.voltage_type && (
                          <div>
                            <Label className="text-slate-500 text-xs uppercase">Tipo de Tensao</Label>
                            <p className="font-semibold text-white mt-1">{sale.voltage_type}</p>
                          </div>
                        )}
                        {sale.additional_services && (
                          <div>
                            <Label className="text-slate-500 text-xs uppercase">Servicos Adicionais</Label>
                            <p className="font-semibold text-white mt-1">{sale.additional_services}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {sale.scope === 'telecomunicacoes' && (sale.service_type || sale.activation_type || sale.has_tv || sale.has_net || sale.has_lr || (sale.mobile_numbers && sale.mobile_numbers.length > 0)) && (
                    <div className="bg-dark-900 border border-dark-700 rounded-lg p-5">
                      <h3 className="font-bold text-lg text-white mb-4 flex items-center gap-2">
                        <div className="w-1 h-6 bg-cyber-500 rounded"></div>
                        Telecomunicacoes
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        {sale.service_type && (
                          <div>
                            <Label className="text-slate-500 text-xs uppercase">Tipo de Servico</Label>
                            <p className="font-semibold text-white mt-1">{sale.service_type}</p>
                          </div>
                        )}
                        {sale.activation_type && (
                          <div>
                            <Label className="text-slate-500 text-xs uppercase">Tipo de Ativacao</Label>
                            <p className="font-semibold text-white mt-1">{sale.activation_type}</p>
                          </div>
                        )}
                        {(sale.has_tv || sale.has_net || sale.has_lr) && (
                          <div className="col-span-2">
                            <Label className="text-slate-500 text-xs uppercase">Servicos Contratados</Label>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {sale.has_tv && <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">TV</Badge>}
                              {sale.has_net && <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20">NET/Fibra</Badge>}
                              {sale.has_lr && <Badge className="bg-green-500/10 text-green-400 border-green-500/20">Linha Fix/LR</Badge>}
                            </div>
                          </div>
                        )}
                        {sale.has_lr && (
                          <div className="col-span-2">
                            <Label className="text-slate-500 text-xs uppercase">Portabilidade Fixo</Label>
                            <p className="font-semibold text-white mt-1">{sale.fix_ported ? 'Sim — fixo portado' : 'Nao'}</p>
                            {sale.fix_ported && (
                              <div className="mt-2 ml-4 space-y-1">
                                {sale.fix_number && (
                                  <p className="text-sm text-slate-300">Numero a portar: <span className="font-mono text-white">{sale.fix_number}</span></p>
                                )}
                                {sale.fix_operator && (
                                  <p className="text-sm text-slate-300">Operadora atual: <span className="text-white">{sale.fix_operator}</span></p>
                                )}
                                {sale.fix_cvp && (
                                  <p className="text-sm text-slate-300">CVP: <span className="font-mono text-white">{sale.fix_cvp}</span></p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {sale.activation_type === 'M4' && sale.mobile_numbers && sale.mobile_numbers.length > 0 && (
                          <div className="col-span-2">
                            <Label className="text-slate-500 text-xs uppercase">Numeros Moveis ({sale.mobile_numbers.length})</Label>
                            <div className="space-y-2 mt-2">
                              {sale.mobile_numbers.map((mob, idx) => (
                                <div key={idx} className="flex items-center gap-4 p-3 bg-dark-850 rounded-lg border border-dark-700">
                                  <span className="text-xs text-slate-500 w-16">Movel {idx + 1}</span>
                                  <span className="font-mono text-white text-sm">{mob.novo ? 'Novo' : (mob.number || '-')}</span>
                                  {mob.novo ? (
                                    <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs">Novo</Badge>
                                  ) : mob.ported ? (
                                    <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20 text-xs">Portado</Badge>
                                  ) : (
                                    <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/20 text-xs">Nao portado</Badge>
                                  )}
                                  {mob.ported && !mob.novo && mob.cvp && (
                                    <span className="text-xs text-slate-400">CVP: <span className="font-mono text-white">{mob.cvp}</span></span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="notes" className="space-y-4 mt-4">
              <div className="space-y-3">
                {sale.notes && sale.notes.length > 0 ? (
                  sale.notes.map((note) => (
                    <div key={note.id} className="p-4 bg-dark-900 rounded-lg border border-dark-700">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-semibold text-sm text-white">{note.author}</span>
                          <Badge className="ml-2 text-xs bg-cyber-500/10 text-cyber-400 border-cyber-500/20">{note.author_role}</Badge>
                        </div>
                        <span className="text-xs text-slate-500">
                          {new Date(note.created_at).toLocaleString('pt-PT')}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300 whitespace-pre-wrap">{note.content}</p>
                      {note.attachments && note.attachments.length > 0 && (
                        <div className="mt-3 space-y-1 border-t border-dark-700 pt-2">
                          <p className="text-xs text-slate-500 font-medium mb-1">Anexos:</p>
                          {note.attachments.map((attachment) => (
                            <div key={attachment.id} className="flex items-center gap-2 text-xs text-cyber-400">
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
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma nota adicionada</p>
                  </div>
                )}
              </div>

              <div className="border-t border-dark-700 pt-4">
                <Label className="text-slate-400">Adicionar Nova Nota</Label>
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Escreva uma nota..."
                  className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white mt-2"
                  rows={3}
                />
                <Button
                  onClick={handleAddNote}
                  disabled={savingNote || !newNote.trim()}
                  className="mt-2 bg-gradient-to-r from-cyber-500 to-cyber-600 text-white"
                >
                  {savingNote ? "A adicionar..." : "Adicionar Nota"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="attachments" className="space-y-4 mt-4">
              <div className="space-y-3">
                {sale.attachments && sale.attachments.length > 0 ? (
                  sale.attachments.map((attachment) => (
                    <div key={attachment.id} className={`p-4 rounded-lg border transition-colors ${attachment.expired ? 'bg-dark-900/50 border-dark-700/50 opacity-60' : 'bg-dark-900 border-dark-700 hover:bg-dark-800'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Paperclip className={`w-5 h-5 ${attachment.expired ? 'text-slate-600' : 'text-cyber-400'}`} />
                          <div>
                            <p className={`font-medium text-sm ${attachment.expired ? 'text-slate-500 line-through' : 'text-white'}`}>{attachment.filename}</p>
                            <p className="text-xs text-slate-500">
                              {new Date(attachment.uploaded_at).toLocaleString('pt-PT')}
                            </p>
                            {attachment.expired && (
                              <p className="text-xs text-red-500/70 mt-0.5">
                                Expirado em {new Date(attachment.expired_at).toLocaleDateString('pt-PT')} — ficheiro removido apos 60 dias
                              </p>
                            )}
                          </div>
                        </div>
                        {!attachment.expired && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                const { data, error } = await supabase.storage
                                  .from('sales-documents')
                                  .download(attachment.path);

                                if (error) throw error;

                                const url = window.URL.createObjectURL(data);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = attachment.filename;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                window.URL.revokeObjectURL(url);

                                toast.success('Ficheiro transferido com sucesso');
                              } catch (error) {
                                console.error('Error downloading file:', error);
                                toast.error('Erro ao transferir ficheiro');
                              }
                            }}
                            className="gap-1 bg-dark-900 border-dark-700 text-slate-300 hover:bg-dark-800"
                          >
                            <Download className="w-4 h-4" />
                            Transferir
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <Paperclip className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhum anexo disponível</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-3 mt-4">
              {auditLogs.length > 0 ? (
                auditLogs.map((log) => (
                  <div key={log.id} className="p-4 bg-dark-900 rounded-lg border border-dark-700">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className={`border ${getActionTypeColor(log.action_type)}`}>
                          {getActionTypeLabel(log.action_type)}
                        </Badge>
                        <span className="text-sm font-medium text-white">{log.user_name}</span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {new Date(log.created_at).toLocaleString('pt-PT')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300">{log.description}</p>
                    {log.changed_fields && log.changed_fields.length > 0 && (
                      <div className="mt-2 text-xs text-slate-500">
                        <span className="font-semibold">Campos alterados: </span>
                        {log.changed_fields.join(', ')}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum histórico disponível</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-8 text-slate-500">Venda não encontrada</div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const ChargebackEditForm = ({ chargeback, onSave, onCancel }) => {
  const [reason, setReason] = useState(chargeback.reason || '');
  const [percentage, setPercentage] = useState(chargeback.percentage || 100);

  return (
    <div className="space-y-2">
      <div>
        <Label className="text-xs text-slate-400">Motivo</Label>
        <Input className="h-8 text-xs bg-dark-800 border-dark-600" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <div>
        <Label className="text-xs text-slate-400">Percentagem (%)</Label>
        <Input type="number" min="1" max="100" className="h-8 text-xs bg-dark-800 border-dark-600 w-24" value={percentage} onChange={(e) => setPercentage(Number(e.target.value))} />
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="h-7 text-xs" onClick={() => onSave({ reason, percentage })}>Guardar</Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
};

export default SaleDetailDialog;
