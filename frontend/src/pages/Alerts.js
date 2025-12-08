import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Bell, CheckCircle, AlertCircle, MessageSquare, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "../lib/supabase";

const Alerts = ({ user }) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const response = await axios.get(`${API}/alerts`);
      setAlerts(response.data);
    } catch (error) {
      toast.error("Erro ao carregar alertas");
    } finally {
      setLoading(false);
    }
  };

  const handleViewSale = async (alert) => {
    try {
      // Mark alert as read
      await axios.post(`${API}/alerts/${alert.id}/mark-read`);
      
      // Fetch sale details
      const response = await axios.get(`${API}/sales/${alert.sale_id}`);
      setSelectedSale(response.data);
      setViewDialogOpen(true);
      
      // Refresh alerts
      fetchAlerts();
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
    return <div className="text-center py-8">A carregar alertas...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Alertas</h1>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Bell className="w-4 h-4" />
          <span>{alerts.filter(a => isUnread(a)).length} não lidos</span>
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Nenhum alerta</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const unread = isUnread(alert);
            return (
              <div
                key={alert.id}
                className={`bg-white rounded-xl shadow-sm border p-4 transition-all hover:shadow-md cursor-pointer ${
                  unread ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                }`}
                onClick={() => handleViewSale(alert)}
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1">{getAlertIcon(alert.type)}</div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className={`text-sm ${unread ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                          {alert.message}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(alert.created_at).toLocaleString('pt-PT')}
                        </p>
                      </div>
                      
                      {unread && (
                        <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
                          Novo
                        </span>
                      )}
                    </div>
                    
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-blue-600 h-8 px-3"
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

export default Alerts;
