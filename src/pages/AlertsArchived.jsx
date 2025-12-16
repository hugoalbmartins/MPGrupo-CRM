import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Bell, CheckCircle, AlertCircle, MessageSquare, Eye, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { alertsService } from "../services/alertsService";
import { salesService } from "../services/salesService";

const AlertsArchived = ({ user }) => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAlerts, setTotalAlerts] = useState(0);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchAlerts();
  }, [currentPage, filter]);

  const fetchAlerts = async () => {
    try {
      const result = await alertsService.getAll({
        page: currentPage,
        limit: 10,
        filter: filter,
        archived: true
      });
      setAlerts(result.alerts);
      setTotalPages(result.totalPages);
      setTotalAlerts(result.total);
    } catch (error) {
      toast.error("Erro ao carregar alertas arquivados");
    } finally {
      setLoading(false);
    }
  };

  const handleViewSale = async (alert) => {
    try {
      const sale = await salesService.getById(alert.sale_id);
      setSelectedSale(sale);
      setViewDialogOpen(true);
    } catch (error) {
      toast.error("Erro ao visualizar venda");
    }
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'new_sale':
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
      case 'status_change':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'note_added':
        return <MessageSquare className="w-5 h-5 text-purple-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const isUnread = (alert) => !alert.read_by.includes(user?.id);

  if (loading) {
    return <div className="text-center py-8">A carregar alertas arquivados...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/alerts')}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Alertas Arquivados</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Bell className="w-4 h-4" />
          <span>{totalAlerts} alertas arquivados</span>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-800">
          <strong>Arquivamento automático:</strong> Os alertas são automaticamente arquivados após 60 dias da sua criação.
          Os alertas arquivados permanecem acessíveis para consulta histórica.
        </p>
      </div>

      <div className="flex justify-between items-center gap-4 flex-wrap">
        <Select value={filter} onValueChange={(value) => { setFilter(value); setCurrentPage(1); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar alertas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Alertas</SelectItem>
            <SelectItem value="unread">Não Lidos</SelectItem>
            <SelectItem value="read">Lidos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {alerts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">
            {filter === 'all' ? 'Nenhum alerta arquivado' : filter === 'unread' ? 'Nenhum alerta arquivado não lido' : 'Nenhum alerta arquivado lido'}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {alerts.map((alert) => {
              const unread = isUnread(alert);
              return (
                <div
                  key={alert.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 transition-all hover:shadow-md"
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-1">{getAlertIcon(alert.type)}</div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className={`text-sm ${unread ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                            {alert.message}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <p className="text-xs text-gray-500">
                              Criado: {new Date(alert.created_at).toLocaleString('pt-PT')}
                            </p>
                            {alert.archived_at && (
                              <p className="text-xs text-amber-600">
                                Arquivado: {new Date(alert.archived_at).toLocaleString('pt-PT')}
                              </p>
                            )}
                          </div>
                        </div>

                        {unread && (
                          <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
                            Não lido
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-blue-600 h-8 px-3"
                          onClick={() => handleViewSale(alert)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Ver Venda
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Anterior
              </Button>
              <span className="text-sm text-gray-600">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Seguinte
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Venda - {selectedSale?.sale_code}</DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Código</label>
                  <p className="text-gray-900">{selectedSale.sale_code}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Data</label>
                  <p className="text-gray-900">{new Date(selectedSale.date).toLocaleDateString('pt-PT')}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Âmbito</label>
                  <p className="text-gray-900 capitalize">{selectedSale.scope}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Tipo Cliente</label>
                  <p className="text-gray-900 capitalize">{selectedSale.client_type}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Nome Cliente</label>
                  <p className="text-gray-900">{selectedSale.client_name}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">NIF</label>
                  <p className="text-gray-900">{selectedSale.client_nif}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Status</label>
                  <p className="text-gray-900">
                    <span className={`status-badge status-${selectedSale.status.toLowerCase().replace(' ', '-')}`}>
                      {selectedSale.status}
                    </span>
                  </p>
                </div>
                {selectedSale.commission && user?.role !== 'bo' && user?.role !== 'partner_commercial' && (
                  <div>
                    <label className="text-sm font-semibold text-gray-700">Comissão</label>
                    <p className="text-green-600 font-semibold">€{selectedSale.commission.toFixed(2)}</p>
                  </div>
                )}
              </div>

              {selectedSale.notes && selectedSale.notes.length > 0 && (
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">Notas</label>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedSale.notes.map((note) => (
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
                </div>
              )}

              <div className="flex justify-end pt-4 border-t">
                <Button onClick={() => setViewDialogOpen(false)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AlertsArchived;
