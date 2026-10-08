import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, Eye, CheckCircle, Clock } from "lucide-react";
import { supabase } from "../lib/supabase";
import { salesService } from "../services/salesService";
import { toast } from "sonner";
import SaleDetailDialog from "./SaleDetailDialog";

const PendingSalesPopup = ({ user }) => {
  const [pendingSales, setPendingSales] = useState([]);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detailSaleId, setDetailSaleId] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [oportunidadeModal, setOportunidadeModal] = useState(null);
  const [oportunidadeNumber, setOportunidadeNumber] = useState("");
  const [savingTratamento, setSavingTratamento] = useState(false);

  const fetchPendingSales = useCallback(async () => {
    if (!user || (user.role !== 'admin' && user.role !== 'bo')) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('id, sale_code, client_name, client_nif, operator_name, partner_name, scope, date, pending_validation, internal_treatment, validation_reason, partner_id, operator_id')
        .or('pending_validation.eq.true,internal_treatment.eq.true')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setPendingSales(data || []);
      setVisible((data || []).length > 0);
    } catch (err) {
      console.error('Error fetching pending sales:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPendingSales();
  }, [fetchPendingSales]);

  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'bo')) return;
    if (visible) return;

    const interval = setInterval(() => {
      fetchPendingSales();
    }, 60000);

    return () => clearInterval(interval);
  }, [user, visible, fetchPendingSales]);

  const handleDismiss = () => {
    setVisible(false);
  };

  const handleView = (saleId) => {
    setDetailSaleId(saleId);
    setDetailOpen(true);
  };

  const handleApprove = async (sale) => {
    try {
      await salesService.update(sale.id, {
        pending_validation: false,
        validation_reason: null,
        status: 'Para registo',
        is_bulk_import: false,
      });

      try {
        await salesService.resendNewSaleEmail(sale.id, {}, true);
      } catch (emailErr) {
        toast.warning("Venda aprovada, mas o email falhou. Pode reenviar manualmente.");
      }

      toast.success("Venda aprovada e movida para registo");
      setPendingSales(prev => prev.filter(s => s.id !== sale.id));
      if (pendingSales.length <= 1) setVisible(false);
    } catch (err) {
      toast.error("Erro ao aprovar venda: " + err.message);
    }
  };

  const handleOpenTratamento = (sale) => {
    setOportunidadeModal(sale);
    setOportunidadeNumber("");
  };

  const handleConfirmTratamento = async () => {
    if (!oportunidadeNumber.trim()) {
      toast.error("O número de oportunidade/registo é obrigatório");
      return;
    }
    try {
      setSavingTratamento(true);
      await salesService.markInternalTreatmentDone(oportunidadeModal.id, oportunidadeNumber.trim());
      toast.success("Venda marcada como tratada. Emails de venda enviados.");
      setOportunidadeModal(null);
      setOportunidadeNumber("");
      setPendingSales(prev => prev.filter(s => s.id !== oportunidadeModal.id));
      if (pendingSales.length <= 1) setVisible(false);
    } catch (err) {
      toast.error("Erro: " + err.message);
    } finally {
      setSavingTratamento(false);
    }
  };

  if (!user || (user.role !== 'admin' && user.role !== 'bo')) return null;

  const validationCount = pendingSales.filter(s => s.pending_validation).length;
  const treatmentCount = pendingSales.filter(s => s.internal_treatment).length;

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="bg-dark-850 border border-cyan-500/30 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
              style={{ backgroundColor: '#111d2e' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(217,119,6,0.1))', border: '1px solid rgba(249,115,22,0.25)' }}>
                    <Bell className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Vendas Pendentes</h2>
                    <p className="text-xs text-slate-400">
                      {validationCount} para validação · {treatmentCount} para tratamento
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleDismiss}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto scrollbar-premium p-4 space-y-3">
                <div className="text-xs text-slate-500 px-1 pb-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Se ignorado, este aviso reaparecerá em 1 minuto.</span>
                </div>
                {pendingSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="rounded-xl p-4 border transition-all"
                    style={{
                      backgroundColor: 'rgba(8,12,20,0.6)',
                      borderColor: sale.pending_validation ? 'rgba(249,115,22,0.2)' : 'rgba(139,92,246,0.2)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-white text-sm">{sale.sale_code}</span>
                          {sale.pending_validation && (
                            <span className="text-[10px] font-semibold text-orange-400 px-2 py-0.5 rounded-full" style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)' }}>
                              Validação
                            </span>
                          )}
                          {sale.internal_treatment && (
                            <span className="text-[10px] font-semibold text-amber-400 px-2 py-0.5 rounded-full" style={{ background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.25)' }}>
                              Tratamento
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-300 truncate">{sale.client_name || 'N/A'}</p>
                        <div className="flex gap-3 text-xs text-slate-500 mt-1">
                          <span>{sale.operator_name || '-'}</span>
                          <span>·</span>
                          <span>{sale.partner_name || '-'}</span>
                          <span>·</span>
                          <span>{new Date(sale.date).toLocaleDateString('pt-PT')}</span>
                        </div>
                        {sale.validation_reason && (
                          <p className="text-xs text-orange-400/80 mt-1 truncate">{sale.validation_reason}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleView(sale.id)}
                          className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 px-2.5 py-1.5 rounded-lg transition-colors"
                          style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.15)' }}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Ver
                        </button>
                        {sale.pending_validation && (
                          <button
                            onClick={() => handleApprove(sale)}
                            className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 px-2.5 py-1.5 rounded-lg transition-colors"
                            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Aprovar
                          </button>
                        )}
                        {sale.internal_treatment && (
                          <button
                            onClick={() => handleOpenTratamento(sale)}
                            className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 px-2.5 py-1.5 rounded-lg transition-colors"
                            style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.15)' }}
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Tratar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between p-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <span className="text-xs text-slate-500">{pendingSales.length} venda(s) pendente(s)</span>
                <button
                  onClick={handleDismiss}
                  className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sale Detail Dialog */}
      <SaleDetailDialog
        saleId={detailSaleId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        user={user}
      />
      <AnimatePresence>
        {oportunidadeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60"
            onClick={() => !savingTratamento && setOportunidadeModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-dark-850 border border-amber-500/30 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl"
              style={{ backgroundColor: '#111d2e' }}
            >
              <h3 className="text-lg font-bold text-white mb-2">Tratado Interno</h3>
              <p className="text-sm text-slate-400 mb-4">
                Insira o número de oportunidade/registo. Ao confirmar, a venda será movida para "Para registo" e os emails normais de venda serão enviados.
              </p>
              <div className="mb-4">
                <label className="text-slate-300 mb-1 block text-sm font-medium">Número de Oportunidade/Registo *</label>
                <input
                  type="text"
                  value={oportunidadeNumber}
                  onChange={(e) => setOportunidadeNumber(e.target.value)}
                  placeholder="Ex: OPP-12345"
                  className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none focus:ring-2 focus:ring-amber-500/20"
                  style={{ backgroundColor: '#0a0f1a', border: '1px solid rgba(255,255,255,0.1)' }}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setOportunidadeModal(null)}
                  disabled={savingTratamento}
                  className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white transition-colors"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmTratamento}
                  disabled={savingTratamento || !oportunidadeNumber.trim()}
                  className="px-4 py-2 rounded-lg text-sm text-white font-medium transition-all"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                >
                  {savingTratamento ? "A processar..." : "Confirmar e Enviar Emails"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default PendingSalesPopup;
