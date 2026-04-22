import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Users, Loader as Loader2, Save, Layers, Ban } from "lucide-react";
import { partnersService } from "../services/partnersService";
import { recalculatePartnerCommissions } from "../services/commissionRecalculator";

const DISABLED = 'disabled';

const isNamedType = (slug) => slug === 'D2D';

export default function BulkPartnerLevelsDialog({
  open,
  onOpenChange,
  operator,
  levelsByType = {},
  partnerTypes = [],
}) {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assignments, setAssignments] = useState({});
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState(null);
  const [bulkLevel, setBulkLevel] = useState('');
  const [draggingId, setDraggingId] = useState(null);

  const availableTypes = useMemo(
    () => partnerTypes.filter(pt => pt.has_levels && (levelsByType[pt.slug] || []).length > 0),
    [partnerTypes, levelsByType]
  );

  useEffect(() => {
    if (!open || !operator?.id) return;
    setSearch('');
    setSelected(new Set());
    setBulkLevel('');
    setActiveType(availableTypes[0]?.slug || null);

    const load = async () => {
      setLoading(true);
      try {
        const [allPartners, d2dLvls, revLvls] = await Promise.all([
          partnersService.getAll(),
          partnersService.getLevelsForOperator(operator.id, 'D2D'),
          partnersService.getLevelsForOperator(operator.id, 'REV'),
        ]);
        setPartners(allPartners);

        const initial = {};
        const d2dMap = new Map(d2dLvls.map(l => [l.partner_id, l.d2d_level]));
        const revMap = new Map(revLvls.map(l => [l.partner_id, l.rev_level]));
        allPartners.forEach(p => {
          if (p.partner_type === 'D2D') {
            initial[p.id] = d2dMap.get(p.id) || DISABLED;
          } else if (p.partner_type === 'REV' || p.partner_type === 'Rev+') {
            const lvl = revMap.get(p.id);
            initial[p.id] = (lvl && lvl !== 0) ? lvl : 0;
          }
        });
        setAssignments(initial);
      } catch (error) {
        console.error('Error loading bulk data:', error);
        toast.error('Erro ao carregar parceiros');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open, operator?.id, availableTypes]);

  const partnersOfActiveType = useMemo(() => {
    if (!activeType) return [];
    return partners
      .filter(p => p.partner_type === activeType)
      .filter(p => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (p.name || '').toLowerCase().includes(q) || (p.partner_code || '').toLowerCase().includes(q);
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [partners, activeType, search]);

  const buckets = useMemo(() => {
    if (!activeType) return [];
    const named = isNamedType(activeType);
    const levels = levelsByType[activeType] || [];
    const unavailableValue = named ? DISABLED : 0;
    const unavailableLabel = 'Indisponível';
    const list = levels.map(l => ({ value: l, label: named ? l : `Nível ${l}` }));
    list.push({ value: unavailableValue, label: unavailableLabel, unavailable: true });
    return list;
  }, [activeType, levelsByType]);

  const partnersInBucket = (bucketValue) => {
    const named = isNamedType(activeType);
    return partnersOfActiveType.filter(p => {
      const current = assignments[p.id];
      if (named) {
        return (current ?? DISABLED) === bucketValue;
      }
      const numericCurrent = current && current !== DISABLED ? Number(current) : 0;
      return numericCurrent === Number(bucketValue);
    });
  };

  const toggleSelect = (partnerId) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(partnerId)) next.delete(partnerId);
      else next.add(partnerId);
      return next;
    });
  };

  const assignLevelToSelected = (level) => {
    if (selected.size === 0) {
      toast.error('Selecione pelo menos um parceiro');
      return;
    }
    setAssignments(prev => {
      const next = { ...prev };
      selected.forEach(id => { next[id] = level; });
      return next;
    });
    toast.success(`${selected.size} parceiro(s) atualizado(s) (não guardado)`);
  };

  const selectAllVisible = () => {
    setSelected(prev => {
      const next = new Set(prev);
      partnersOfActiveType.forEach(p => next.add(p.id));
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const handleDrop = (bucketValue) => {
    const ids = selected.size > 0 ? Array.from(selected) : (draggingId ? [draggingId] : []);
    if (ids.length === 0) return;
    setAssignments(prev => {
      const next = { ...prev };
      ids.forEach(id => { next[id] = bucketValue; });
      return next;
    });
    setDraggingId(null);
    toast.success(`${ids.length} parceiro(s) movido(s) (não guardado)`);
  };

  const handleSave = async () => {
    if (!operator?.id) return;
    setSaving(true);
    try {
      const d2dAssignments = [];
      const revAssignments = [];
      partners.forEach(p => {
        const value = assignments[p.id];
        if (value === undefined) return;
        if (p.partner_type === 'D2D') {
          d2dAssignments.push({ partner_id: p.id, d2d_level: value });
        } else if (p.partner_type === 'REV' || p.partner_type === 'Rev+') {
          const num = value && value !== DISABLED ? Number(value) : 0;
          revAssignments.push({ partner_id: p.id, rev_level: num });
        }
      });

      if (d2dAssignments.length > 0) {
        await partnersService.bulkSetD2DLevelForOperator(operator.id, d2dAssignments);
      }
      if (revAssignments.length > 0) {
        await partnersService.bulkSetREVLevelForOperator(operator.id, revAssignments);
      }

      const affectedPartnerIds = [
        ...d2dAssignments.filter(a => a.d2d_level && a.d2d_level !== DISABLED).map(a => a.partner_id),
        ...revAssignments.filter(a => a.rev_level && a.rev_level !== 0).map(a => a.partner_id),
      ];
      toast.success(`Atribuições guardadas para ${d2dAssignments.length + revAssignments.length} parceiro(s).`);
      affectedPartnerIds.forEach(pid => {
        recalculatePartnerCommissions(pid, [operator.id]);
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving bulk levels:', error);
      toast.error(`Erro ao guardar: ${error?.message || 'Erro desconhecido'}`);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-dark-850 border border-cyber-500/10">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-cyber-400" />
            Definição de níveis a parceiros — {operator?.name}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> A carregar parceiros...
          </div>
        ) : availableTypes.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            Nenhum tipo de parceiro com níveis configurados para esta operadora. Configure primeiro as comissões.
          </div>
        ) : (
          <div className="space-y-4">
            <Tabs value={activeType || ''} onValueChange={(v) => { setActiveType(v); setSelected(new Set()); }}>
              <TabsList className="bg-dark-900 border border-dark-700 p-1">
                {availableTypes.map(pt => (
                  <TabsTrigger key={pt.slug} value={pt.slug} className="data-[state=active]:bg-cyber-500/10 data-[state=active]:text-cyber-400 font-semibold">
                    {pt.display_name || pt.slug}
                  </TabsTrigger>
                ))}
              </TabsList>

              {availableTypes.map(pt => (
                <TabsContent key={pt.slug} value={pt.slug} className="mt-4 space-y-4">
                  <div className="flex flex-wrap items-end gap-3 bg-dark-900/60 border border-dark-700 p-3 rounded">
                    <div className="flex-1 min-w-[200px]">
                      <Label className="text-slate-400 text-xs">Pesquisar</Label>
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                        <Input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Nome ou código"
                          className="pl-8 bg-dark-900 border-dark-700 text-white"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-slate-400 text-xs">Nível para selecionados</Label>
                      <div className="flex gap-2">
                        <Select value={bulkLevel} onValueChange={setBulkLevel}>
                          <SelectTrigger className="bg-dark-900 border-dark-700 text-white w-40">
                            <SelectValue placeholder="Escolher..." />
                          </SelectTrigger>
                          <SelectContent>
                            {(levelsByType[pt.slug] || []).map(l => (
                              <SelectItem key={l} value={String(l)}>{isNamedType(pt.slug) ? l : `Nível ${l}`}</SelectItem>
                            ))}
                            <SelectItem value="__disabled__">Indisponível</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          onClick={() => {
                            if (!bulkLevel) return;
                            const val = bulkLevel === '__disabled__'
                              ? (isNamedType(pt.slug) ? DISABLED : 0)
                              : (isNamedType(pt.slug) ? bulkLevel : Number(bulkLevel));
                            assignLevelToSelected(val);
                          }}
                          className="bg-cyber-500 text-white hover:bg-cyber-600"
                        >
                          Aplicar
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={selectAllVisible}>Selecionar todos</Button>
                      <Button type="button" variant="outline" size="sm" onClick={clearSelection}>Limpar seleção</Button>
                    </div>
                    <div className="text-xs text-slate-400 ml-auto">
                      {selected.size} selecionado(s) de {partnersOfActiveType.length}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4">
                    <div className="bg-dark-900/40 border border-dark-700 rounded p-3">
                      <p className="text-xs text-slate-400 mb-2">Parceiros (arrastar ou selecionar)</p>
                      <div className="space-y-1 max-h-[420px] overflow-y-auto">
                        {partnersOfActiveType.map(p => {
                          const isSelected = selected.has(p.id);
                          const current = assignments[p.id];
                          const isUnavail = current === DISABLED || current === 0;
                          return (
                            <div
                              key={p.id}
                              draggable
                              onDragStart={() => setDraggingId(p.id)}
                              onDragEnd={() => setDraggingId(null)}
                              onClick={() => toggleSelect(p.id)}
                              className={`cursor-pointer px-3 py-2 rounded border text-sm flex items-center justify-between transition-colors ${
                                isSelected
                                  ? 'bg-cyber-500/10 border-cyber-500/40 text-white'
                                  : 'bg-dark-900 border-dark-700 text-slate-300 hover:border-cyber-500/30'
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="truncate font-medium">{p.name}</div>
                                <div className="text-xs text-slate-500">{p.partner_code}</div>
                              </div>
                              <Badge className={`ml-2 ${isUnavail ? 'bg-slate-700 text-slate-300' : 'bg-cyber-500/15 text-cyber-300'}`}>
                                {isUnavail ? 'Indisp.' : (isNamedType(activeType) ? current : `Nv ${current}`)}
                              </Badge>
                            </div>
                          );
                        })}
                        {partnersOfActiveType.length === 0 && (
                          <p className="text-slate-500 text-sm text-center py-6">Sem parceiros para exibir.</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
                      {buckets.map(b => (
                        <div
                          key={String(b.value)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleDrop(b.value)}
                          className={`min-h-[120px] rounded border-2 border-dashed p-3 transition-colors ${
                            b.unavailable
                              ? 'border-red-500/30 bg-red-500/5'
                              : 'border-cyber-500/30 bg-cyber-500/5'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            {b.unavailable ? <Ban className="w-4 h-4 text-red-400" /> : <Layers className="w-4 h-4 text-cyber-400" />}
                            <span className={`text-sm font-semibold ${b.unavailable ? 'text-red-300' : 'text-cyber-300'}`}>{b.label}</span>
                            <span className="ml-auto text-xs text-slate-500">{partnersInBucket(b.value).length}</span>
                          </div>
                          <div className="space-y-1">
                            {partnersInBucket(b.value).map(p => (
                              <div key={p.id} className="text-xs bg-dark-900/60 border border-dark-700 rounded px-2 py-1 text-slate-300 truncate">
                                {p.name} <span className="text-slate-500">({p.partner_code})</span>
                              </div>
                            ))}
                            {partnersInBucket(b.value).length === 0 && (
                              <p className="text-xs text-slate-500 italic">Largue parceiros aqui</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        )}

        <DialogFooter className="pt-3 border-t border-dark-700">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || loading} className="bg-cyber-500 hover:bg-cyber-600 text-white">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Guardar atribuições
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
