import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Bell, CheckCircle, AlertCircle, MessageSquare, Eye, Mail, Check, X, ChevronLeft, ChevronRight, Archive, BellOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { useAlerts, useMarkAlertAsRead } from "@/hooks/useAlertsData";
import { alertsService } from "../services/alertsService";
import { salesService } from "../services/salesService";
import { usersService } from "../services/usersService";
import { systemSettingsService } from "../services/systemSettingsService";

const Alerts = ({ user }) => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(true);
  const [selectedAlerts, setSelectedAlerts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAlerts, setTotalAlerts] = useState(0);
  const [filter, setFilter] = useState('all');
  const [alertsSuspended, setAlertsSuspended] = useState(false);
  const [suspensionLoading, setSuspensionLoading] = useState(false);

  useEffect(() => {
    fetchAlerts();
    fetchEmailPreference();
    if (user?.role === 'admin') {
      fetchAlertsSuspensionStatus();
    }

    const unsubscribe = alertsService.subscribeToAlerts(() => {
      fetchAlerts();
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentPage, filter]);

  useEffect(() => {
    setSelectedAlerts([]);
  }, [currentPage, filter]);

  const fetchAlerts = async () => {
    try {
      const result = await alertsService.getAll({
        page: currentPage,
        limit: 10,
        filter: filter,
        archived: false
      });
      setAlerts(result.alerts);
      setTotalPages(result.totalPages);
      setTotalAlerts(result.total);
    } catch (error) {
      toast.error("Erro ao carregar alertas");
    } finally {
      setLoading(false);
    }
  };

  const fetchEmailPreference = async () => {
    try {
      if (user?.role === 'admin') {
        const userData = await usersService.getCurrentUser();
        setEmailAlertsEnabled(userData.email_alerts_enabled !== false);
      }
    } catch (error) {
      console.error("Erro ao carregar preferências:", error);
    }
  };

  const fetchAlertsSuspensionStatus = async () => {
    try {
      const status = await systemSettingsService.getAlertsSuspensionStatus();
      setAlertsSuspended(status.suspended);
    } catch (error) {
      console.error("Erro ao carregar estado de suspensão:", error);
    }
  };

  const handleToggleAlertsSuspension = async (suspended) => {
    setSuspensionLoading(true);
    try {
      await systemSettingsService.setAlertsSuspension(suspended);
      setAlertsSuspended(suspended);
      toast.success(
        suspended
          ? "Criação de alertas suspensa globalmente"
          : "Criação de alertas reativada"
      );
    } catch (error) {
      toast.error("Erro ao atualizar suspensão de alertas");
    } finally {
      setSuspensionLoading(false);
    }
  };

  const handleToggleEmailAlerts = async (enabled) => {
    try {
      await usersService.updateEmailAlertPreference(enabled);
      setEmailAlertsEnabled(enabled);
      toast.success(enabled ? "Alertas por email ativados" : "Alertas por email desativados");
    } catch (error) {
      toast.error("Erro ao atualizar preferência");
    }
  };

  const handleViewSale = async (alert) => {
    try {
      await alertsService.markAsRead(alert.id);

      const sale = await salesService.getById(alert.sale_id);
      setSelectedSale(sale);
      setViewDialogOpen(true);

      fetchAlerts();
    } catch (error) {
      toast.error("Erro ao visualizar venda");
    }
  };

  const handleSelectAlert = (alertId) => {
    setSelectedAlerts(prev =>
      prev.includes(alertId)
        ? prev.filter(id => id !== alertId)
        : [...prev, alertId]
    );
  };

  const handleSelectAll = () => {
    if (selectedAlerts.length === alerts.length) {
      setSelectedAlerts([]);
    } else {
      setSelectedAlerts(alerts.map(a => a.id));
    }
  };

  const handleMarkAsRead = async () => {
    if (selectedAlerts.length === 0) {
      toast.error("Selecione pelo menos um alerta");
      return;
    }

    try {
      await alertsService.markAsRead(selectedAlerts);
      toast.success(`${selectedAlerts.length} alerta(s) marcado(s) como lido(s)`);
      fetchAlerts();
    } catch (error) {
      toast.error("Erro ao marcar alertas como lidos");
    }
  };

  const handleMarkAsUnread = async () => {
    if (selectedAlerts.length === 0) {
      toast.error("Selecione pelo menos um alerta");
      return;
    }

    try {
      await alertsService.markAsUnread(selectedAlerts);
      toast.success(`${selectedAlerts.length} alerta(s) marcado(s) como não lido(s)`);
      fetchAlerts();
    } catch (error) {
      toast.error("Erro ao marcar alertas como não lidos");
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
        return <Bell className="w-5 h-5 text-slate-500" />;
    }
  };

  const isUnread = (alert) => !alert.read_by.includes(user?.id);

  if (loading) {
    return (
      <div className="space-y-6 p-6 animate-fade-in">
        <div className="h-10 bg-dark-700 rounded-lg w-1/4 animate-pulse"></div>
        <div className="bg-dark-850 border border-white/[0.06] rounded-xl p-6">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-24 bg-dark-800 rounded-lg animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 animate-fade-in">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-white">Alertas</h1>
        <div className="flex items-center gap-4">
          <Button
            onClick={() => navigate('/alerts/archived')}
            className="bg-dark-900 border border-dark-700 text-slate-300 hover:border-cyber-500/30 hover:text-white transition-all gap-2"
          >
            <Archive className="w-4 h-4" />
            Ver Arquivados
          </Button>
          <div className="bg-dark-850 border border-white/[0.06] rounded-lg px-4 py-2 flex items-center gap-2">
            <Bell className="w-4 h-4 text-cyber-400" />
            <span className="text-sm font-bold text-white">
              {alerts.filter(a => isUnread(a)).length}
            </span>
            <span className="text-sm text-slate-400">
              não lidos de {totalAlerts}
            </span>
          </div>
        </div>
      </div>

      {user?.role === 'admin' && (
        <>
          <div className={`bg-dark-850 border-2 border-white/[0.06] rounded-xl p-5 transition-all ${
            alertsSuspended
              ? 'border-red-500/30'
              : 'border-green-500/30'
          }`}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  alertsSuspended
                    ? 'bg-red-500/10'
                    : 'bg-cyber-500/10'
                }`}>
                  {alertsSuspended ? (
                    <BellOff className="w-5 h-5 text-red-600" />
                  ) : (
                    <Bell className="w-5 h-5 text-green-600" />
                  )}
                </div>
                <div>
                  <Label htmlFor="global-alerts-suspension" className="text-sm font-bold cursor-pointer text-white">
                    Suspensão Global de Alertas
                  </Label>
                  <p className="text-xs mt-1 text-slate-400">
                    {alertsSuspended
                      ? 'Nenhum alerta novo será criado no sistema'
                      : 'Os alertas estão a ser criados normalmente'
                    }
                  </p>
                </div>
              </div>
              <Switch
                id="global-alerts-suspension"
                checked={alertsSuspended}
                onCheckedChange={handleToggleAlertsSuspension}
                disabled={suspensionLoading}
              />
            </div>
          </div>

          <div className="bg-dark-850 border-2 border-blue-500/30 rounded-xl p-5 transition-all">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center">
                  <Mail className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <Label htmlFor="email-alerts" className="text-sm font-bold cursor-pointer text-white">
                    Receber Alertas por Email
                  </Label>
                  <p className="text-xs mt-1 text-slate-400">
                    Desative para receber alertas apenas na aplicação
                  </p>
                </div>
              </div>
              <Switch
                id="email-alerts"
                checked={emailAlertsEnabled}
                onCheckedChange={handleToggleEmailAlerts}
              />
            </div>
          </div>
        </>
      )}

      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Select value={filter} onValueChange={(value) => { setFilter(value); setCurrentPage(1); }}>
            <SelectTrigger className="w-48 bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20">
              <SelectValue placeholder="Filtrar alertas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Alertas</SelectItem>
              <SelectItem value="unread">Não Lidos</SelectItem>
              <SelectItem value="read">Lidos</SelectItem>
            </SelectContent>
          </Select>

          {alerts.length > 0 && (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedAlerts.length === alerts.length && alerts.length > 0}
                onCheckedChange={handleSelectAll}
                id="select-all"
              />
              <Label htmlFor="select-all" className="text-sm cursor-pointer text-slate-300">
                Selecionar todos
              </Label>
            </div>
          )}
        </div>

        {selectedAlerts.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">{selectedAlerts.length} selecionado(s)</span>
            <Button size="sm" onClick={handleMarkAsRead} className="bg-gradient-to-r from-cyber-500 to-cyber-600 text-white hover:from-cyber-400 hover:to-cyber-500 gap-1">
              <Check className="w-4 h-4" />
              Marcar como Lido
            </Button>
            <Button size="sm" onClick={handleMarkAsUnread} className="bg-dark-900 border border-dark-700 text-slate-300 hover:border-cyber-500/30 gap-1">
              <X className="w-4 h-4" />
              Marcar como Não Lido
            </Button>
          </div>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="bg-dark-850 border border-white/[0.06] rounded-xl p-12 text-center transition-all">
          <div className="w-20 h-20 bg-gradient-to-r from-dark-900 to-dark-800 rounded-full flex items-center justify-center mx-auto mb-4 animate-scale-in">
            <Bell className="w-10 h-10 text-white" />
          </div>
          <p className="text-lg font-semibold text-slate-400">
            {filter === 'all' ? 'Nenhum alerta' : filter === 'unread' ? 'Nenhum alerta não lido' : 'Nenhum alerta lido'}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {alerts.map((alert, index) => {
              const unread = isUnread(alert);
              const isSelected = selectedAlerts.includes(alert.id);
              return (
                <div
                  key={alert.id}
                  className={`bg-dark-850 border border-white/[0.06] rounded-xl p-4 transition-all ${
                    unread ? 'border-cyber-500/20 bg-cyber-500/5' : 'border-dark-700 bg-dark-800'
                  } ${isSelected ? 'ring-2 ring-cyber-500/30 shadow-[0_0_15px_rgba(6,182,212,0.1)]' : ''}`}
                  style={{
                    animationDelay: `${index * 0.03}s`,
                    borderWidth: unread ? '2px' : '1px'
                  }}
                >
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleSelectAlert(alert.id)}
                      className="mt-1"
                    />
                    <div className="mt-1">{getAlertIcon(alert.type)}</div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className={`text-sm ${unread ? 'font-bold' : 'font-medium'} text-slate-300`}>
                            {alert.message}
                          </p>
                          <p className="text-xs mt-1 text-slate-500">
                            {new Date(alert.created_at).toLocaleString('pt-PT')}
                          </p>
                        </div>

                        {unread && (
                          <span className="bg-gradient-to-r from-cyber-500 to-cyber-600 text-white text-xs px-3 py-1 rounded-full font-bold shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                            Novo
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <Button
                          size="sm"
                          className="bg-gradient-to-r from-cyber-500 to-cyber-600 text-white hover:from-cyber-400 hover:to-cyber-500 shadow-[0_0_10px_rgba(6,182,212,0.2)] transition-all h-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewSale(alert);
                          }}
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
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="bg-dark-900 border border-dark-700 text-slate-300 hover:border-cyber-500/30"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Anterior
              </Button>
              <span className="text-sm text-slate-400">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="bg-dark-900 border border-dark-700 text-slate-300 hover:border-cyber-500/30"
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
                  <label className="text-sm font-semibold text-slate-400">Código</label>
                  <p className="text-white">{selectedSale.sale_code}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-400">Data</label>
                  <p className="text-white">{new Date(selectedSale.date).toLocaleDateString('pt-PT')}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-400">Âmbito</label>
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
                    <label className="text-sm font-semibold text-slate-400">Comissão</label>
                    <p className="text-green-400 font-semibold">&euro;{selectedSale.commission.toFixed(2)}</p>
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

export default Alerts;
