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
        return <AlertCircle className="w-5 h-5 text-blue-400" />;
      case 'status_change':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'note_added':
        return <MessageSquare className="w-5 h-5 text-cyan-400" />;
      default:
        return <Bell className="w-5 h-5 text-slate-400" />;
    }
  };

  const isUnread = (alert) => !alert.read_by.includes(user?.id);

  if (loading) {
    return <div className="text-center py-8 text-slate-300">A carregar alertas arquivados...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/alerts')}
            className="gap-2 text-slate-300 hover:text-white hover:bg-dark-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
          <h1 className="text-3xl font-bold text-white">Alertas Arquivados</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Bell className="w-4 h-4 text-slate-400" />
          <span>{totalAlerts} alertas arquivados</span>
        </div>
      </div>

      <div className="bg-cyber-500/5 border border-cyber-500/20 rounded-xl p-4">
        <p className="text-sm text-cyber-400">
          <strong>Arquivamento automatico:</strong> Os alertas sao automaticamente arquivados apos 60 dias da sua criacao.
          Os alertas arquivados permanecem acessiveis para consulta historica.
        </p>
      </div>

      <div className="flex justify-between items-center gap-4 flex-wrap">
        <Select value={filter} onValueChange={(value) => { setFilter(value); setCurrentPage(1); }}>
          <SelectTrigger className="w-48 bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20">
            <SelectValue placeholder="Filtrar alertas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Alertas</SelectItem>
            <SelectItem value="unread">Nao Lidos</SelectItem>
            <SelectItem value="read">Lidos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {alerts.length === 0 ? (
        <div className="bg-dark-850 border border-white/[0.06] rounded-xl p-12 text-center">
          <Bell className="w-16 h-16 text-slate-500 mx-auto mb-4" />
          <p className="text-slate-400 text-lg">
            {filter === 'all' ? 'Nenhum alerta arquivado' : filter === 'unread' ? 'Nenhum alerta arquivado nao lido' : 'Nenhum alerta arquivado lido'}
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
                  className={`bg-dark-850 border border-white/[0.06] rounded-xl p-4 transition-all ${unread ? 'border-cyber-500/20' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-1">{getAlertIcon(alert.type)}</div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className={`text-sm ${unread ? 'font-semibold text-white' : 'text-slate-300'}`}>
                            {alert.message}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <p className="text-xs text-slate-500">
                              Criado: {new Date(alert.created_at).toLocaleString('pt-PT')}
                            </p>
                            {alert.archived_at && (
                              <p className="text-xs text-cyber-400/70">
                                Arquivado: {new Date(alert.archived_at).toLocaleString('pt-PT')}
                              </p>
                            )}
                          </div>
                        </div>

                        {unread && (
                          <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs px-2 py-1 rounded-full font-semibold">
                            Nao lido
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-cyber-400 h-8 px-3 hover:bg-dark-700"
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
                className="bg-dark-900 border border-dark-700 text-slate-300 hover:border-cyber-500/30"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Anterior
              </Button>
              <span className="text-sm text-slate-300">
                Pagina {currentPage} de {totalPages}
              </span>
              <Button
                className="bg-dark-900 border border-dark-700 text-slate-300 hover:border-cyber-500/30"
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
        <DialogContent className="bg-dark-850 border border-cyber-500/10 max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Detalhes da Venda - {selectedSale?.sale_code}</DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-400">Codigo</label>
                  <p className="text-white">{selectedSale.sale_code}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-400">Data</label>
                  <p className="text-white">{new Date(selectedSale.date).toLocaleDateString('pt-PT')}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-400">Ambito</label>
                  <p className="text-white capitalize">{selectedSale.scope}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-400">Tipo Cliente</label>
                  <p className="text-white capitalize">{selectedSale.client_type}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-400">Nome Cliente</label>
                  <p className="text-white">{selectedSale.client_name}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-400">NIF</label>
                  <p className="text-white">{selectedSale.client_nif}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-400">Status</label>
                  <p className="text-white">
                    <span className={`status-badge status-${selectedSale.status.toLowerCase().replace(' ', '-')}`}>
                      {selectedSale.status}
                    </span>
                  </p>
                </div>
                {selectedSale.commission && user?.role !== 'bo' && user?.role !== 'partner_commercial' && (
                  <div>
                    <label className="text-sm font-semibold text-slate-400">Comissao</label>
                    <p className="text-green-400 font-semibold">{selectedSale.commission.toFixed(2)}</p>
                  </div>
                )}
              </div>

              {selectedSale.notes && selectedSale.notes.length > 0 && (
                <div>
                  <label className="text-sm font-semibold text-slate-400 block mb-2">Notas</label>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedSale.notes.map((note) => (
                      <div key={note.id} className="p-3 bg-dark-900 border border-dark-700 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-sm text-white">{note.author}</span>
                          <span className="text-xs text-slate-500">
                            {new Date(note.created_at).toLocaleString('pt-PT')}
                          </span>
                        </div>
                        <p className="text-sm text-slate-300">{note.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-dark-700">
                <Button onClick={() => setViewDialogOpen(false)} className="bg-gradient-to-r from-cyber-500 to-cyber-600 text-white hover:from-cyber-400 hover:to-cyber-500">
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
