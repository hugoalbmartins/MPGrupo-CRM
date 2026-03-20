import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, MapPin } from "lucide-react";

const POWER_OPTIONS = ["1.15kVA", "2.3kVA", "3.45kVA", "4.6kVA", "5.75kVA", "6.9kVA", "10.35kVA", "13.8kVA", "17.25kVA", "20.7kVA", "27.6kVA", "34.5kVA", "41.4kVA", "Outros"];

const parsePowerKva = (value) => {
  if (!value || value === 'Outros') return null;
  const numeric = parseFloat(String(value).replace(/kVA$/i, '').trim());
  return isNaN(numeric) ? null : numeric;
};

const formatPowerKvaForDisplay = (value) => {
  if (!value && value !== 0) return '';
  const str = String(value);
  if (str.toLowerCase().includes('kva')) return str;
  const num = parseFloat(str);
  if (isNaN(num)) return '';
  const match = POWER_OPTIONS.find(opt => opt !== 'Outros' && parseFloat(opt) === num);
  return match || '';
};

const createEmptyMultipuntoPoint = () => ({
  id: crypto.randomUUID(),
  point_code: '',
  power_kva: '',
  installation_address: '',
  billing_address: '',
});

const createEmptyMultilocalLocation = () => ({
  id: crypto.randomUUID(),
  energy_type: 'eletricidade',
  cpe: '',
  power_kva: '',
  cui: '',
  tier: '',
  installation_address: '',
  billing_address: '',
  entry_type: '',
  voltage_type: '',
  additional_services: '',
});

const EnergyPointsManager = ({ saleType, points, onChange, isNew = true, user, energySaleMode, onEnergySaleModeChange, currentOperator }) => {
  const canSeeOperatorPaid = user?.role === 'admin' || user?.role === 'bo';

  const createNormalPoint = () => {
    const needsCPE = saleType === 'eletricidade' || saleType === 'dual';
    const needsCUI = saleType === 'gas' || saleType === 'dual';
    return {
      id: crypto.randomUUID(),
      point_type: needsCPE && !needsCUI ? 'cpe' : needsCUI && !needsCPE ? 'cui' : 'cpe',
      point_code: '',
      cui_code: '',
      cui_id: null,
      power_kva: '',
      tier: '',
      activation_status: 'pending',
      activation_date: null,
      operator_paid: false
    };
  };

  const [localPoints, setLocalPoints] = useState([]);
  const [multilocalLocations, setMultilocalLocations] = useState([createEmptyMultilocalLocation()]);

  useEffect(() => {
    if (energySaleMode === 'multilocal') return;

    if (points && points.length > 0) {
      if (saleType === 'dual') {
        const merged = [];
        const cpePoints = points.filter(p => p.point_type === 'cpe');
        const cuiPoints = points.filter(p => p.point_type === 'cui');
        const count = Math.max(cpePoints.length, cuiPoints.length, 1);
        for (let i = 0; i < count; i++) {
          merged.push({
            id: cpePoints[i]?.id || crypto.randomUUID(),
            cui_id: cuiPoints[i]?.id,
            point_type: 'cpe',
            point_code: cpePoints[i]?.point_code || '',
            cui_code: cuiPoints[i]?.point_code || '',
            power_kva: formatPowerKvaForDisplay(cpePoints[i]?.power_kva),
            tier: cuiPoints[i]?.tier || '',
            activation_status: cpePoints[i]?.activation_status || 'pending',
            activation_date: cpePoints[i]?.activation_date || null,
            operator_paid: cpePoints[i]?.operator_paid || false
          });
        }
        setLocalPoints(merged);
      } else if (energySaleMode === 'multiponto') {
        const cpes = points.filter(p => p.point_type === 'cpe' || saleType === 'eletricidade');
        setLocalPoints(cpes.map(p => ({
          id: p.id || crypto.randomUUID(),
          point_code: p.point_code || '',
          power_kva: formatPowerKvaForDisplay(p.power_kva),
        })));
      } else {
        const displayPoints = points.map(p => ({ ...p, power_kva: formatPowerKvaForDisplay(p.power_kva) }));
        setLocalPoints(displayPoints);
      }
    } else {
      if (energySaleMode === 'multiponto') {
        setLocalPoints([createEmptyMultipuntoPoint(), createEmptyMultipuntoPoint()]);
      } else {
        setLocalPoints([createNormalPoint()]);
      }
    }
  }, [points, energySaleMode]);

  const emitNormalChange = (pts) => {
    let expanded = [];
    if (saleType === 'gas') {
      expanded = pts.map(p => ({
        id: p.id, point_type: 'cui', point_code: p.point_code,
        power_kva: null, tier: p.tier || null,
        activation_status: p.activation_status || 'pending',
        activation_date: p.activation_date || null, operator_paid: p.operator_paid || false,
      }));
    } else if (saleType === 'eletricidade') {
      expanded = pts.map(p => ({
        id: p.id, point_type: 'cpe', point_code: p.point_code,
        power_kva: parsePowerKva(p.power_kva), tier: null,
        activation_status: p.activation_status || 'pending',
        activation_date: p.activation_date || null, operator_paid: p.operator_paid || false,
      }));
    } else {
      pts.forEach(point => {
        if (point.point_code) {
          expanded.push({
            id: point.id, point_type: 'cpe', point_code: point.point_code,
            power_kva: parsePowerKva(point.power_kva), tier: null,
            activation_status: point.activation_status || 'pending',
            activation_date: point.activation_date || null, operator_paid: point.operator_paid || false,
          });
        }
        if (point.cui_code) {
          expanded.push({
            id: point.cui_id || crypto.randomUUID(), point_type: 'cui', point_code: point.cui_code,
            power_kva: null, tier: point.tier || null,
            activation_status: point.activation_status || 'pending',
            activation_date: point.activation_date || null, operator_paid: point.operator_paid || false,
          });
        }
      });
    }
    onChange(expanded, 'normal');
  };

  const emitMultipuntoChange = (pts) => {
    const expanded = pts.map(p => ({
      id: p.id, point_type: 'cpe', point_code: p.point_code,
      power_kva: parsePowerKva(p.power_kva), tier: null,
      installation_address: p.installation_address || null,
      billing_address: p.billing_address || null,
      activation_status: 'pending', activation_date: null, operator_paid: false,
    }));
    onChange(expanded, 'multiponto');
  };

  const emitMultilocalChange = (locs) => {
    const expanded = [];
    locs.forEach(loc => {
      const locMeta = {
        installation_address: loc.installation_address || null,
        billing_address: loc.billing_address || null,
        entry_type: loc.entry_type || null,
        voltage_type: loc.voltage_type || null,
        additional_services: loc.additional_services || null,
        activation_status: 'pending', activation_date: null, operator_paid: false,
      };
      if (loc.energy_type === 'eletricidade' || loc.energy_type === 'dual') {
        expanded.push({
          id: loc.id, point_type: 'cpe', point_code: loc.cpe,
          power_kva: parsePowerKva(loc.power_kva), tier: null,
          ...locMeta,
        });
      }
      if (loc.energy_type === 'gas' || loc.energy_type === 'dual') {
        expanded.push({
          id: loc.energy_type === 'dual' ? crypto.randomUUID() : loc.id,
          point_type: 'cui', point_code: loc.cui,
          power_kva: null, tier: loc.tier || null,
          ...locMeta,
        });
      }
    });
    onChange(expanded, 'multilocal');
  };

  if (!saleType) return null;

  if (energySaleMode === 'multiponto') {
    return (
      <MultipuntoManager
        points={localPoints}
        setPoints={(pts) => { setLocalPoints(pts); emitMultipuntoChange(pts); }}
        canSeeOperatorPaid={canSeeOperatorPaid}
        isNew={isNew}
      />
    );
  }

  if (energySaleMode === 'multilocal') {
    return (
      <MultiLocalManager
        locations={multilocalLocations}
        setLocations={(locs) => { setMultilocalLocations(locs); emitMultilocalChange(locs); }}
        isNew={isNew}
        currentOperator={currentOperator}
      />
    );
  }

  const needsCPE = saleType === 'eletricidade' || saleType === 'dual';
  const needsCUI = saleType === 'gas' || saleType === 'dual';

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {localPoints.map((point, index) => (
          <Card key={point.id || index} className="p-4 space-y-4 bg-dark-850 border-dark-700">
            <div className="flex justify-between items-center">
              <h4 className="font-semibold text-white">
                Ponto {index + 1}
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {needsCPE && (
                <>
                  <div>
                    <Label className="text-slate-400">CPE {!needsCUI && '*'}</Label>
                    <Input
                      className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20"
                      value={point.point_code}
                      onChange={(e) => {
                        const updated = [...localPoints];
                        updated[index] = { ...updated[index], point_code: e.target.value };
                        setLocalPoints(updated);
                        emitNormalChange(updated);
                      }}
                      placeholder="Codigo do Ponto de Entrega"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-400">Potencia {!needsCUI && '*'}</Label>
                    <Select
                      value={point.power_kva}
                      onValueChange={(v) => {
                        const updated = [...localPoints];
                        updated[index] = { ...updated[index], power_kva: v };
                        setLocalPoints(updated);
                        emitNormalChange(updated);
                      }}
                    >
                      <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {POWER_OPTIONS.map(p => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {needsCUI && (
                <>
                  <div>
                    <Label className="text-slate-400">CUI {!needsCPE && '*'}</Label>
                    <Input
                      className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20"
                      value={needsCPE ? point.cui_code : point.point_code}
                      onChange={(e) => {
                        const updated = [...localPoints];
                        if (needsCPE) {
                          updated[index] = { ...updated[index], cui_code: e.target.value };
                        } else {
                          updated[index] = { ...updated[index], point_code: e.target.value };
                        }
                        setLocalPoints(updated);
                        emitNormalChange(updated);
                      }}
                      placeholder="Codigo Universal de Instalacao"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-400">Escalao {!needsCPE && '*'}</Label>
                    <Input
                      className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20"
                      value={point.tier}
                      onChange={(e) => {
                        const updated = [...localPoints];
                        updated[index] = { ...updated[index], tier: e.target.value };
                        setLocalPoints(updated);
                        emitNormalChange(updated);
                      }}
                      placeholder="Ex: 1, 2, 3..."
                    />
                  </div>
                </>
              )}

              {!isNew && (
                <>
                  <div>
                    <Label className="text-slate-400">Estado de Ativacao</Label>
                    <Select
                      value={point.activation_status}
                      onValueChange={(v) => {
                        const updated = [...localPoints];
                        updated[index] = { ...updated[index], activation_status: v };
                        setLocalPoints(updated);
                        emitNormalChange(updated);
                      }}
                    >
                      <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                        <SelectItem value="rejected">Rejeitado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-slate-400">Data de Ativacao</Label>
                    <Input
                      className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20"
                      type="date"
                      value={point.activation_date || ''}
                      onChange={(e) => {
                        const updated = [...localPoints];
                        updated[index] = { ...updated[index], activation_date: e.target.value || null };
                        setLocalPoints(updated);
                        emitNormalChange(updated);
                      }}
                    />
                  </div>
                </>
              )}

              {canSeeOperatorPaid && (
                <div className="col-span-1 sm:col-span-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`operator-paid-${index}`}
                      checked={point.operator_paid}
                      onCheckedChange={(checked) => {
                        const updated = [...localPoints];
                        updated[index] = { ...updated[index], operator_paid: checked };
                        setLocalPoints(updated);
                        emitNormalChange(updated);
                      }}
                    />
                    <Label htmlFor={`operator-paid-${index}`} className="text-sm text-slate-300 cursor-pointer">
                      Pago pelo operador
                    </Label>
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

const MultipuntoManager = ({ points, setPoints, canSeeOperatorPaid, isNew }) => {
  const handlePointChange = (index, field, value) => {
    const updated = [...points];
    updated[index] = { ...updated[index], [field]: value };
    setPoints(updated);
  };

  const handleAddPoint = () => {
    setPoints([...points, createEmptyMultipuntoPoint()]);
  };

  const handleRemovePoint = (index) => {
    if (points.length <= 2) return;
    setPoints(points.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
        <p className="text-xs text-blue-300">
          <strong>Venda Multiponto:</strong> Exclusivo para Eletricidade. Preencha os CPE e Potencia de cada ponto. Sera criada uma venda independente por cada CPE.
        </p>
      </div>

      <div className="space-y-4">
        {points.map((point, index) => (
          <Card key={point.id || index} className="p-4 space-y-3 bg-dark-850 border-dark-700">
            <div className="flex justify-between items-center">
              <h4 className="font-semibold text-white text-sm">CPE {index + 1}</h4>
              {points.length > 2 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemovePoint(index)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 w-7 p-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-400 text-xs">CPE *</Label>
                <Input
                  className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-sm"
                  value={point.point_code}
                  onChange={(e) => handlePointChange(index, 'point_code', e.target.value.toUpperCase())}
                  placeholder="PT0002..."
                />
              </div>
              <div>
                <Label className="text-slate-400 text-xs">Potencia *</Label>
                <Select
                  value={point.power_kva}
                  onValueChange={(v) => handlePointChange(index, 'power_kva', v)}
                >
                  <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-sm">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {POWER_OPTIONS.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 sm:col-span-2">
                <Label className="text-slate-400 text-xs">Morada de Instalação *</Label>
                <Input
                  className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-sm"
                  value={point.installation_address || ''}
                  onChange={(e) => handlePointChange(index, 'installation_address', e.target.value)}
                  placeholder="Rua, número, código postal, localidade"
                />
              </div>
              <div className="col-span-1 sm:col-span-2">
                <Label className="text-slate-400 text-xs">Morada de Faturação</Label>
                <Input
                  className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-sm"
                  value={point.billing_address || ''}
                  onChange={(e) => handlePointChange(index, 'billing_address', e.target.value)}
                  placeholder="Se diferente da morada de instalação"
                />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={handleAddPoint}
        className="w-full border-dashed border-2 border-dark-700 hover:border-cyber-500 hover:bg-cyber-500/10 text-slate-300 hover:text-white text-sm"
      >
        <Plus className="w-4 h-4 mr-2" />
        Adicionar CPE
      </Button>
    </div>
  );
};

const MultiLocalManager = ({ locations, setLocations, isNew, currentOperator }) => {
  const handleLocationChange = (index, field, value) => {
    const updated = [...locations];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'energy_type') {
      updated[index].cpe = '';
      updated[index].power_kva = '';
      updated[index].cui = '';
      updated[index].tier = '';
    }
    setLocations(updated);
  };

  const handleAddLocation = () => {
    setLocations([...locations, createEmptyMultilocalLocation()]);
  };

  const handleRemoveLocation = (index) => {
    if (locations.length <= 1) return;
    setLocations(locations.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
        <p className="text-xs text-emerald-300">
          <strong>Venda Multilocal:</strong> Cada local pode ter Eletricidade, Gas ou Dual (ambos). Preencha os dados de cada local. Sera criada uma venda independente por cada CPE/CUI.
        </p>
      </div>

      <div className="space-y-4">
        {locations.map((loc, index) => (
          <Card key={loc.id || index} className="p-4 space-y-4 bg-dark-850 border-dark-700">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <h4 className="font-semibold text-white text-sm">Local {index + 1}</h4>
              </div>
              {locations.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveLocation(index)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 w-7 p-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>

            <div>
              <Label className="text-slate-400 text-xs">Tipo de Energia *</Label>
              <Select
                value={loc.energy_type}
                onValueChange={(v) => handleLocationChange(index, 'energy_type', v)}
              >
                <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="eletricidade">Eletricidade</SelectItem>
                  <SelectItem value="gas">Gas</SelectItem>
                  <SelectItem value="dual">Dual (Eletricidade + Gas)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(loc.energy_type === 'eletricidade' || loc.energy_type === 'dual') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400 text-xs">CPE *</Label>
                  <Input
                    className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-sm"
                    value={loc.cpe}
                    onChange={(e) => handleLocationChange(index, 'cpe', e.target.value.toUpperCase())}
                    placeholder="PT0002..."
                  />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Potencia *</Label>
                  <Select
                    value={loc.power_kva}
                    onValueChange={(v) => handleLocationChange(index, 'power_kva', v)}
                  >
                    <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-sm">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {POWER_OPTIONS.map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {(loc.energy_type === 'gas' || loc.energy_type === 'dual') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400 text-xs">CUI *</Label>
                  <Input
                    className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-sm"
                    value={loc.cui}
                    onChange={(e) => handleLocationChange(index, 'cui', e.target.value.toUpperCase())}
                    placeholder="PT16..."
                  />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Escalao *</Label>
                  <Input
                    className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-sm"
                    value={loc.tier}
                    onChange={(e) => handleLocationChange(index, 'tier', e.target.value)}
                    placeholder="Ex: 1, 2, 3..."
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-400 text-xs">Morada de Instalação *</Label>
                <Input
                  className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-sm"
                  value={loc.installation_address}
                  onChange={(e) => handleLocationChange(index, 'installation_address', e.target.value)}
                  placeholder="Rua, número, código postal, localidade"
                />
              </div>
              <div>
                <Label className="text-slate-400 text-xs">Morada de Faturação</Label>
                <Input
                  className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-sm"
                  value={loc.billing_address}
                  onChange={(e) => handleLocationChange(index, 'billing_address', e.target.value)}
                  placeholder="Se diferente da morada de instalação"
                />
              </div>
            </div>

            <div className={`grid grid-cols-1 gap-3 ${currentOperator?.requires_voltage_type ? 'sm:grid-cols-2' : ''}`}>
              <div>
                <Label className="text-slate-400 text-xs">Tipo de Entrada *</Label>
                <Select
                  value={loc.entry_type}
                  onValueChange={(v) => handleLocationChange(index, 'entry_type', v)}
                >
                  <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-sm">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Alteração de comercializadora">Alteração de comercializadora</SelectItem>
                    <SelectItem value="Alteração de comercializadora com alteração de titular">Alt. comercializadora com alt. de titular</SelectItem>
                    <SelectItem value="Entrada Direta">Entrada Direta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {currentOperator?.requires_voltage_type && (
                <div>
                  <Label className="text-slate-400 text-xs">Tipo de Tensão *</Label>
                  <Select
                    value={loc.voltage_type}
                    onValueChange={(v) => handleLocationChange(index, 'voltage_type', v)}
                  >
                    <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-sm">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Monofásico">Monofásico</SelectItem>
                      <SelectItem value="Trifásico">Trifásico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {currentOperator?.requires_additional_services && (currentOperator?.additional_services_list || []).length > 0 && (
              <div>
                <Label className="text-slate-400 text-xs">Serviços Adicionais *</Label>
                <Select
                  value={loc.additional_services || ''}
                  onValueChange={(v) => handleLocationChange(index, 'additional_services', v)}
                >
                  <SelectTrigger className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-sm">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sem serviços adicionais">Sem serviços adicionais</SelectItem>
                    {(currentOperator.additional_services_list || []).filter((service) => {
                      const applies = typeof service === 'string' ? 'todos' : (service.applies_to || 'todos');
                      return applies === 'todos' || applies === loc.energy_type;
                    }).map((service, idx) => {
                      const name = typeof service === 'string' ? service : service.name;
                      return <SelectItem key={idx} value={name}>{name}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
          </Card>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={handleAddLocation}
        className="w-full border-dashed border-2 border-dark-700 hover:border-emerald-500 hover:bg-emerald-500/10 text-slate-300 hover:text-white text-sm"
      >
        <Plus className="w-4 h-4 mr-2" />
        Adicionar Local
      </Button>
    </div>
  );
};

export default EnergyPointsManager;
export { MultipuntoManager, MultiLocalManager };
