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

    const interval = setInterval(() => fetchAlerts(), 30000);

    const unsubscribe = alertsService.subscribeToAlerts(() => {
      fetchAlerts();
    });

    return () => {
      clearInterval(interval);
      if (unsubscribe) unsubscribe();
    };
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
      setSelectedAlerts([]);
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
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const isUnread = (alert) => !alert.read_by.includes(user?.id);

  if (loading) {
    return (
      <div className="space-y-6 p-6 animate-fade-in">
        <div className="h-10 bg-gray-200 rounded-lg w-1/4 animate-pulse"></div>
        <div className="glass-ultra p-6">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 animate-fade-in">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-3xl font-bold" style={{ color: '#000000' }}>Alertas</h1>
        <div className="flex items-center gap-4">
          <Button
            onClick={() => navigate('/alerts/archived')}
            className="btn-secondary spring-transition gap-2"
          >
            <Archive className="w-4 h-4" />
            Ver Arquivados
          </Button>
          <div className="glass-ultra px-4 py-2 flex items-center gap-2">
            <Bell className="w-4 h-4 text-gold-ultra" />
            <span className="text-sm font-bold" style={{ color: '#000000' }}>
              {alerts.filter(a => isUnread(a)).length}
            </span>
            <span className="text-sm" style={{ color: '#7a7a7a' }}>
              não lidos de {totalAlerts}
            </span>
          </div>
        </div>
      </div>

      {user?.role === 'admin' && (
        <>
          <div className={`glass-ultra p-5 spring-transition ${
            alertsSuspended
              ? 'border-red-300'
              : 'border-green-300'
          }`} style={{ borderWidth: '2px' }}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  alertsSuspended
                    ? 'bg-red-100'
                    : 'bg-green-100'
                }`}>
                  {alertsSuspended ? (
                    <BellOff className="w-5 h-5 text-red-600" />
                  ) : (
                    <Bell className="w-5 h-5 text-green-600" />
                  )}
                </div>
                <div>
                  <Label htmlFor="global-alerts-suspension" className="text-sm font-bold cursor-pointer" style={{ color: '#000000' }}>
                    Suspensão Global de Alertas
                  </Label>
                  <p className="text-xs mt-1" style={{ color: '#7a7a7a' }}>
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

          <div className="glass-ultra p-5 spring-transition" style={{ borderWidth: '2px', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Mail className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <Label htmlFor="email-alerts" className="text-sm font-bold cursor-pointer" style={{ color: '#000000' }}>
                    Receber Alertas por Email
                  </Label>
                  <p className="text-xs mt-1" style={{ color: '#7a7a7a' }}>
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
            <SelectTrigger className="w-48">
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
              <Label htmlFor="select-all" className="text-sm cursor-pointer">
                Selecionar todos
              </Label>
            </div>
          )}
        </div>

        {selectedAlerts.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{selectedAlerts.length} selecionado(s)</span>
            <Button size="sm" onClick={handleMarkAsRead} className="gap-1">
              <Check className="w-4 h-4" />
              Marcar como Lido
            </Button>
            <Button size="sm" variant="outline" onClick={handleMarkAsUnread} className="gap-1">
              <X className="w-4 h-4" />
              Marcar como Não Lido
            </Button>
          </div>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="glass-ultra p-12 text-center spring-transition">
          <div className="w-20 h-20 bg-gradient-to-r from-navy-900 to-navy-800 rounded-full flex items-center justify-center mx-auto mb-4 animate-scale-in">
            <Bell className="w-10 h-10 text-white" />
          </div>
          <p className="text-lg font-semibold" style={{ color: '#000000' }}>
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
                  className={`glass-ultra p-4 spring-transition ${
                    unread ? 'border-gold-ultra' : 'border-gray-200'
                  } ${isSelected ? 'ring-2 ring-gold-ultra shadow-gold-glow' : ''}`}
                  style={{
                    animationDelay: `${index * 0.03}s`,
                    borderWidth: unread ? '2px' : '1px',
                    backgroundColor: unread ? 'rgba(212, 175, 55, 0.05)' : 'white'
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
                          <p className={`text-sm ${unread ? 'font-bold' : 'font-medium'}`} style={{ color: '#000000' }}>
                            {alert.message}
                          </p>
                          <p className="text-xs mt-1" style={{ color: '#7a7a7a' }}>
                            {new Date(alert.created_at).toLocaleString('pt-PT')}
                          </p>
                        </div>

                        {unread && (
                          <span className="bg-gradient-to-r from-gold-ultra to-gold-500 text-navy-900 text-xs px-3 py-1 rounded-full font-bold shadow-gold">
                            Novo
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <Button
                          size="sm"
                          className="btn-gold shadow-gold spring-transition h-8"
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

      {/* Sale View Dialog (Read-only) */}
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
                  <p className="text-navy-900">{selectedSale.sale_code}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Data</label>
                  <p className="text-navy-900">{new Date(selectedSale.date).toLocaleDateString('pt-PT')}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Âmbito</label>
                  <p className="text-navy-900 capitalize">{selectedSale.scope}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Tipo Cliente</label>
                  <p className="text-navy-900 capitalize">{selectedSale.client_type}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Nome Cliente</label>
                  <p className="text-navy-900">{selectedSale.client_name}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">NIF</label>
                  <p className="text-navy-900">{selectedSale.client_nif}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Status</label>
                  <p className="text-navy-900">
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

export default Alerts;
