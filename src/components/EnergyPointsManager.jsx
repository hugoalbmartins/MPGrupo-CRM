import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";

const POWER_OPTIONS = ["1.15kVA", "2.3kVA", "3.45kVA", "4.6kVA", "5.75kVA", "6.9kVA", "10.35kVA", "13.8kVA", "17.25kVA", "20.7kVA", "27.6kVA", "34.5kVA", "41.4kVA", "Outros"];

const expandPointsForDB = (localPoints, saleType) => {
  if (saleType !== 'dual') return localPoints;
  const expanded = [];
  localPoints.forEach(point => {
    if (point.point_code) {
      expanded.push({
        id: point.id,
        point_type: 'cpe',
        point_code: point.point_code,
        power_kva: point.power_kva,
        tier: null,
        activation_status: point.activation_status,
        activation_date: point.activation_date,
        operator_paid: point.operator_paid
      });
    }
    if (point.cui_code) {
      expanded.push({
        id: point.cui_id || crypto.randomUUID(),
        point_type: 'cui',
        point_code: point.cui_code,
        power_kva: null,
        tier: point.tier,
        activation_status: point.activation_status,
        activation_date: point.activation_date,
        operator_paid: point.operator_paid
      });
    }
  });
  return expanded;
};

const EnergyPointsManager = ({ saleType, points, onChange, isNew = true }) => {
  const [isMultipoint, setIsMultipoint] = useState(false);
  const [pointCount, setPointCount] = useState(1);
  const [localPoints, setLocalPoints] = useState([]);

  useEffect(() => {
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
            power_kva: cpePoints[i]?.power_kva || '',
            tier: cuiPoints[i]?.tier || '',
            activation_status: cpePoints[i]?.activation_status || 'pending',
            activation_date: cpePoints[i]?.activation_date || null,
            operator_paid: cpePoints[i]?.operator_paid || false
          });
        }
        setLocalPoints(merged);
        setIsMultipoint(merged.length > 1);
        setPointCount(merged.length);
      } else {
        setLocalPoints(points);
        setIsMultipoint(points.length > 1);
        setPointCount(points.length);
      }
    } else {
      const initialPoint = createEmptyPoint();
      setLocalPoints([initialPoint]);
    }
  }, [points]);

  const createEmptyPoint = () => {
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

  const emitChange = (pts) => {
    onChange(expandPointsForDB(pts, saleType));
  };

  const handleMultipointToggle = (enabled) => {
    setIsMultipoint(enabled);

    if (enabled && localPoints.length === 1) {
      setPointCount(2);
      const newPoints = [localPoints[0], createEmptyPoint()];
      setLocalPoints(newPoints);
      emitChange(newPoints);
    } else if (!enabled) {
      setPointCount(1);
      const singlePoint = [localPoints[0] || createEmptyPoint()];
      setLocalPoints(singlePoint);
      emitChange(singlePoint);
    }
  };

  const handlePointCountChange = (count) => {
    const newCount = parseInt(count) || 1;
    setPointCount(newCount);

    const currentPoints = [...localPoints];

    if (newCount > currentPoints.length) {
      for (let i = currentPoints.length; i < newCount; i++) {
        currentPoints.push(createEmptyPoint());
      }
    } else if (newCount < currentPoints.length) {
      currentPoints.splice(newCount);
    }

    setLocalPoints(currentPoints);
    emitChange(currentPoints);
  };

  const handlePointChange = (index, field, value) => {
    const updated = [...localPoints];
    const finalValue = field === 'activation_date' && value === '' ? null : value;
    updated[index] = { ...updated[index], [field]: finalValue };
    setLocalPoints(updated);
    emitChange(updated);
  };

  const handleRemovePoint = (index) => {
    if (localPoints.length <= 1) return;

    const updated = localPoints.filter((_, i) => i !== index);
    setLocalPoints(updated);
    setPointCount(updated.length);
    emitChange(updated);

    if (updated.length === 1) {
      setIsMultipoint(false);
    }
  };

  const handleAddPoint = () => {
    const updated = [...localPoints, createEmptyPoint()];
    setLocalPoints(updated);
    setPointCount(updated.length);
    emitChange(updated);
  };

  const needsCPE = saleType === 'eletricidade' || saleType === 'dual';
  const needsCUI = saleType === 'gas' || saleType === 'dual';

  if (!saleType) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="bg-cyber-500/10 border border-cyber-500/20 rounded-lg p-4">
        <div className="flex items-center gap-3 mb-3">
          <Checkbox
            id="is-multipoint"
            checked={isMultipoint}
            onCheckedChange={handleMultipointToggle}
          />
          <Label htmlFor="is-multipoint" className="text-sm font-semibold text-white cursor-pointer">
            Venda Multi-Ponto
          </Label>
        </div>
        <p className="text-xs text-slate-400">
          Ative esta opcao se a venda incluir multiplos CPE e/ou CUI (ex: condominios, empresas com varias instalacoes).
        </p>

        {isMultipoint && (
          <div className="mt-3">
            <Label className="text-sm text-slate-300">Quantidade de Pontos *</Label>
            <Input
              type="number"
              min="2"
              value={pointCount}
              onChange={(e) => handlePointCountChange(e.target.value)}
              className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 w-32 mt-1"
            />
          </div>
        )}
      </div>

      <div className="space-y-4">
        {localPoints.map((point, index) => (
          <Card key={point.id || index} className="p-4 space-y-4 bg-dark-850 border-dark-700">
            <div className="flex justify-between items-center">
              <h4 className="font-semibold text-white">
                Ponto {index + 1} {isMultipoint && localPoints.length > 1 && `de ${localPoints.length}`}
              </h4>
              {isMultipoint && localPoints.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemovePoint(index)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {needsCPE && (
                <>
                  <div>
                    <Label className="text-slate-400">CPE {!needsCUI && '*'}</Label>
                    <Input
                      className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20"
                      value={point.point_code}
                      onChange={(e) => handlePointChange(index, 'point_code', e.target.value)}
                      placeholder="Codigo do Ponto de Entrega"
                      required={!needsCUI}
                    />
                  </div>
                  <div>
                    <Label className="text-slate-400">Potencia {!needsCUI && '*'}</Label>
                    <Select
                      value={point.power_kva}
                      onValueChange={(v) => handlePointChange(index, 'power_kva', v)}
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
                        if (needsCPE) {
                          handlePointChange(index, 'cui_code', e.target.value);
                        } else {
                          handlePointChange(index, 'point_code', e.target.value);
                        }
                      }}
                      placeholder="Codigo Universal de Instalacao"
                      required={!needsCPE}
                    />
                  </div>
                  <div>
                    <Label className="text-slate-400">Escalao {!needsCPE && '*'}</Label>
                    <Input
                      className="bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20"
                      value={point.tier}
                      onChange={(e) => handlePointChange(index, 'tier', e.target.value)}
                      placeholder="Ex: 1, 2, 3..."
                      required={!needsCPE}
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
                      onValueChange={(v) => handlePointChange(index, 'activation_status', v)}
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
                      onChange={(e) => handlePointChange(index, 'activation_date', e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="col-span-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`operator-paid-${index}`}
                    checked={point.operator_paid}
                    onCheckedChange={(checked) => handlePointChange(index, 'operator_paid', checked)}
                  />
                  <Label htmlFor={`operator-paid-${index}`} className="text-sm text-slate-300 cursor-pointer">
                    Pago pelo operador
                  </Label>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {isMultipoint && (
        <Button
          type="button"
          variant="outline"
          onClick={handleAddPoint}
          className="w-full border-dashed border-2 border-dark-700 hover:border-cyber-500 hover:bg-cyber-500/10 text-slate-300 hover:text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Mais Um Ponto
        </Button>
      )}
    </div>
  );
};

export default EnergyPointsManager;
