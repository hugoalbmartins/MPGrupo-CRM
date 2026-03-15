import React, { useState } from "react";
import { motion } from "framer-motion";
import { RotateCcw, Calendar, User, Building2, Phone, ChevronRight, Search, ListFilter as Filter, Clock, CircleCheck as CheckCircle2, Loader as Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { refidelizacoesService } from "../services/refidelizacoesService";
import SaleDetailDialog from "../components/SaleDetailDialog";

const StatusBadge = ({ status }) => {
  if (status === 'pronto') {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 gap-1 font-normal">
        <CheckCircle2 className="w-3 h-3" />
        Pronto para contactar
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 gap-1 font-normal">
      <Clock className="w-3 h-3" />
      Em breve
    </Badge>
  );
};

const Refidelizacoes = ({ user }) => {
  const [search, setSearch] = useState("");
  const [filterOperator, setFilterOperator] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedSaleId, setSelectedSaleId] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const isPartner = user?.role === 'partner' || user?.role === 'partner_commercial';

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['refidelizacoes'],
    queryFn: () => refidelizacoesService.getAll(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const operators = [...new Map(
    items.map(i => [i.operator_id, { id: i.operator_id, name: i.operator_name }])
  ).values()];

  const filtered = items.filter(item => {
    if (filterOperator !== 'all' && item.operator_id !== filterOperator) return false;
    if (filterStatus !== 'all' && item.status_refidelizacao !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !item.customer_name?.toLowerCase().includes(q) &&
        !item.client_nif?.toLowerCase().includes(q) &&
        !item.operator_name?.toLowerCase().includes(q) &&
        !item.partner_name?.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const readyCount = items.filter(i => i.status_refidelizacao === 'pronto').length;
  const soonCount = items.filter(i => i.status_refidelizacao === 'brevemente').length;

  const openDetail = (saleId) => {
    setSelectedSaleId(saleId);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <RotateCcw className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Refidelização</h1>
            <p className="text-sm text-slate-400">Clientes disponíveis para refidelizar ou renegociar</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-dark-850 border-dark-700">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-500/15 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Prontos para contactar</p>
              <p className="text-2xl font-bold text-white">{isLoading ? '—' : readyCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-dark-850 border-dark-700">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-500/15 rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Disponíveis em 2 dias</p>
              <p className="text-2xl font-bold text-white">{isLoading ? '—' : soonCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-dark-850 border-dark-700">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-500/15 rounded-lg flex items-center justify-center">
              <RotateCcw className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total visível</p>
              <p className="text-2xl font-bold text-white">{isLoading ? '—' : items.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-dark-850 border-dark-700">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Pesquisar por cliente, NIF, operadora..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-dark-900 border-dark-700 text-white placeholder:text-slate-500"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-44 bg-dark-900 border-dark-700 text-white">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent className="bg-dark-800 border-dark-700">
                <SelectItem value="all" className="text-white">Todos os estados</SelectItem>
                <SelectItem value="pronto" className="text-white">Pronto para contactar</SelectItem>
                <SelectItem value="brevemente" className="text-white">Em breve</SelectItem>
              </SelectContent>
            </Select>
            {operators.length > 0 && (
              <Select value={filterOperator} onValueChange={setFilterOperator}>
                <SelectTrigger className="w-full sm:w-48 bg-dark-900 border-dark-700 text-white">
                  <SelectValue placeholder="Operadora" />
                </SelectTrigger>
                <SelectContent className="bg-dark-800 border-dark-700">
                  <SelectItem value="all" className="text-white">Todas as operadoras</SelectItem>
                  {operators.map(op => (
                    <SelectItem key={op.id} value={op.id} className="text-white">{op.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-3">
                <RotateCcw className="w-6 h-6 text-emerald-500/50" />
              </div>
              <p className="text-slate-400 font-medium">Sem clientes para refidelizar</p>
              <p className="text-slate-600 text-sm mt-1">
                {items.length === 0
                  ? 'Nenhum cliente com prazo de refidelização configurado a atingir nos próximos 2 dias.'
                  : 'Sem resultados para os filtros aplicados.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-700">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">NIF</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Operadora</th>
                    {!isPartner && <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Parceiro</th>}
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Ativação</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data de Contacto</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                    <th className="px-4 py-3 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <motion.tr
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onClick={() => openDetail(item.id)}
                      className="border-b border-dark-700/50 hover:bg-dark-800/50 cursor-pointer transition-colors group"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-dark-700 rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                          <span className="text-white text-sm font-medium truncate max-w-[140px]">{item.customer_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-slate-300 text-sm font-mono">{item.client_nif}</span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-slate-300 text-sm">{item.operator_name}</span>
                      </td>
                      {!isPartner && (
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-slate-400 text-sm">{item.partner_name}</span>
                        </td>
                      )}
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-slate-400 text-sm">
                          {item.activated_at ? new Date(item.activated_at).toLocaleDateString('pt-PT') : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <span className={`text-sm font-semibold ${item.status_refidelizacao === 'pronto' ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {new Date(item.contact_date + 'T00:00:00').toLocaleDateString('pt-PT')}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.status_refidelizacao} />
                      </td>
                      <td className="px-4 py-3">
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <SaleDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        saleId={selectedSaleId}
        user={user}
      />
    </div>
  );
};

export default Refidelizacoes;
