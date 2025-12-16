import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { X, Edit2, Save, History, MessageSquare, AlertTriangle, CheckCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

const STATUSES = [
  "Pendente",
  "Para registo",
  "Registado",
  "Ativo",
  "Concluido",
  "Cancelado",
  "Recusado"
];

const SaleDetailDialog = ({ open, onOpenChange, saleId, user, onSaleUpdated }) => {
  const [sale, setSale] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (open && saleId) {
      fetchSaleDetails();
    }
  }, [open, saleId]);

  const fetchSaleDetails = async () => {
    try {
      setLoading(true);
      const [saleData, logs] = await Promise.all([
        salesService.getById(saleId),
        salesService.getAuditLogs(saleId)
      ]);
      setSale(saleData);
      setAuditLogs(logs);
      setEditData({
        status: saleData.status,
        requisition: saleData.requisition || "",
        paid_to_operator: saleData.paid_to_operator || false,
        payment_date: saleData.payment_date || "",
        manual_commission: saleData.manual_commission || ""
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

      if (editData.requisition && sale.scope === 'telecomunicacoes') {
        const isDuplicate = await salesService.checkDuplicateRequisition(
          editData.requisition,
          sale.scope,
          saleId
        );

        if (isDuplicate) {
          toast.error("Número de requisição já existe no sistema");
          return;
        }
      }

      await salesService.update(saleId, editData);
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

  const getStatusColor = (status) => {
    const colors = {
      "Pendente": "bg-yellow-100 text-yellow-800",
      "Para registo": "bg-blue-100 text-blue-800",
      "Registado": "bg-cyan-100 text-cyan-800",
      "Ativo": "bg-green-100 text-green-800",
      "Concluido": "bg-green-100 text-green-800",
      "Cancelado": "bg-red-100 text-red-800",
      "Recusado": "bg-red-100 text-red-800"
    };
    return colors[status] || "bg-gray-100 text-gray-800";
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
      create: "bg-blue-100 text-blue-800",
      update: "bg-cyan-100 text-cyan-800",
      status_change: "bg-purple-100 text-purple-800",
      note_added: "bg-green-100 text-green-800",
      payment_update: "bg-orange-100 text-orange-800"
    };
    return colors[actionType] || "bg-gray-100 text-gray-800";
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Detalhes da Venda - {sale?.sale_code}</span>
            {user?.role === 'admin' && sale && !isEditing && (
              <Button size="sm" onClick={() => setIsEditing(true)} className="gap-2">
                <Edit2 className="w-4 h-4" />
                Editar
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8">A carregar...</div>
        ) : sale ? (
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="notes">
                Notas {sale.notes?.length > 0 && `(${sale.notes.length})`}
              </TabsTrigger>
              <TabsTrigger value="history">
                Histórico {auditLogs.length > 0 && `(${auditLogs.length})`}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6 mt-4">
              {isEditing ? (
                <div className="space-y-4">
                  <Alert>
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>
                      Modo de edição - Apenas campos específicos podem ser alterados
                    </AlertDescription>
                  </Alert>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Estado</Label>
                      <Select
                        value={editData.status}
                        onValueChange={(value) => setEditData({ ...editData, status: value })}
                      >
                        <SelectTrigger>
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

                    <div>
                      <Label>Número de Requisição</Label>
                      <Input
                        value={editData.requisition}
                        onChange={(e) => setEditData({ ...editData, requisition: e.target.value })}
                        placeholder="REQ-XXXXX"
                      />
                    </div>

                    <div>
                      <Label>Comissão Manual</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editData.manual_commission}
                        onChange={(e) => setEditData({ ...editData, manual_commission: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <Label>Data de Pagamento</Label>
                      <Input
                        type="date"
                        value={editData.payment_date}
                        onChange={(e) => setEditData({ ...editData, payment_date: e.target.value })}
                      />
                    </div>

                    <div className="col-span-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={editData.paid_to_operator}
                          onCheckedChange={(checked) => setEditData({ ...editData, paid_to_operator: checked })}
                        />
                        <Label>Pago ao Operador</Label>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditing(false);
                        setEditData({
                          status: sale.status,
                          requisition: sale.requisition || "",
                          paid_to_operator: sale.paid_to_operator || false,
                          payment_date: sale.payment_date || "",
                          manual_commission: sale.manual_commission || ""
                        });
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={handleSaveEdit} disabled={savingEdit}>
                      <Save className="w-4 h-4 mr-2" />
                      {savingEdit ? "A guardar..." : "Guardar"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-600">Código</Label>
                    <p className="font-semibold">{sale.sale_code}</p>
                  </div>

                  <div>
                    <Label className="text-gray-600">Data</Label>
                    <p className="font-semibold">
                      {new Date(sale.date).toLocaleDateString('pt-PT')}
                    </p>
                  </div>

                  <div>
                    <Label className="text-gray-600">Estado</Label>
                    <Badge className={getStatusColor(sale.status)}>{sale.status}</Badge>
                  </div>

                  <div>
                    <Label className="text-gray-600">Âmbito</Label>
                    <p className="font-semibold capitalize">{sale.scope}</p>
                  </div>

                  <div className="col-span-2 border-t pt-4">
                    <h3 className="font-semibold mb-3">Informação do Cliente</h3>
                  </div>

                  <div>
                    <Label className="text-gray-600">Nome</Label>
                    <p className="font-semibold">{sale.client_name}</p>
                  </div>

                  <div>
                    <Label className="text-gray-600">NIF</Label>
                    <p className="font-semibold">{sale.client_nif}</p>
                  </div>

                  <div>
                    <Label className="text-gray-600">Tipo</Label>
                    <p className="font-semibold capitalize">{sale.client_type}</p>
                  </div>

                  <div>
                    <Label className="text-gray-600">Contacto</Label>
                    <p className="font-semibold">{sale.client_contact}</p>
                  </div>

                  {sale.client_email && (
                    <div>
                      <Label className="text-gray-600">Email</Label>
                      <p className="font-semibold">{sale.client_email}</p>
                    </div>
                  )}

                  <div className="col-span-2 border-t pt-4">
                    <h3 className="font-semibold mb-3">Detalhes da Venda</h3>
                  </div>

                  <div>
                    <Label className="text-gray-600">Parceiro</Label>
                    <p className="font-semibold">{sale.partner_name}</p>
                  </div>

                  <div>
                    <Label className="text-gray-600">Operador</Label>
                    <p className="font-semibold">{sale.operator_name}</p>
                  </div>

                  {sale.requisition && (
                    <div>
                      <Label className="text-gray-600">Requisição</Label>
                      <p className="font-semibold">{sale.requisition}</p>
                    </div>
                  )}

                  {sale.monthly_value && (
                    <div>
                      <Label className="text-gray-600">Valor Mensal</Label>
                      <p className="font-semibold">€{parseFloat(sale.monthly_value).toFixed(2)}</p>
                    </div>
                  )}

                  {user?.role !== 'bo' && user?.role !== 'partner_commercial' && sale.calculated_commission && (
                    <div>
                      <Label className="text-gray-600">Comissão</Label>
                      <p className="font-semibold text-green-600">
                        €{parseFloat(sale.calculated_commission).toFixed(2)}
                      </p>
                    </div>
                  )}

                  {sale.cpe && (
                    <div>
                      <Label className="text-gray-600">CPE</Label>
                      <p className="font-semibold">{sale.cpe}</p>
                    </div>
                  )}

                  {sale.cui && (
                    <div>
                      <Label className="text-gray-600">CUI</Label>
                      <p className="font-semibold">{sale.cui}</p>
                    </div>
                  )}

                  {sale.paid_to_operator && (
                    <div className="col-span-2">
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-semibold">Pago ao Operador</span>
                        {sale.payment_date && (
                          <span className="text-sm">
                            em {new Date(sale.payment_date).toLocaleDateString('pt-PT')}
                          </span>
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
                    <div key={note.id} className="p-4 bg-gray-50 rounded-lg border">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-semibold text-sm">{note.author}</span>
                          <Badge className="ml-2 text-xs">{note.author_role}</Badge>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(note.created_at).toLocaleString('pt-PT')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma nota adicionada</p>
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <Label>Adicionar Nova Nota</Label>
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Escreva uma nota..."
                  className="mt-2"
                  rows={3}
                />
                <Button
                  onClick={handleAddNote}
                  disabled={savingNote || !newNote.trim()}
                  className="mt-2"
                >
                  {savingNote ? "A adicionar..." : "Adicionar Nota"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-3 mt-4">
              {auditLogs.length > 0 ? (
                auditLogs.map((log) => (
                  <div key={log.id} className="p-4 bg-gray-50 rounded-lg border">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className={getActionTypeColor(log.action_type)}>
                          {getActionTypeLabel(log.action_type)}
                        </Badge>
                        <span className="text-sm font-medium">{log.user_name}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(log.created_at).toLocaleString('pt-PT')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{log.description}</p>
                    {log.changed_fields && log.changed_fields.length > 0 && (
                      <div className="mt-2 text-xs text-gray-600">
                        <span className="font-semibold">Campos alterados: </span>
                        {log.changed_fields.join(', ')}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum histórico disponível</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-8 text-gray-500">Venda não encontrada</div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SaleDetailDialog;
