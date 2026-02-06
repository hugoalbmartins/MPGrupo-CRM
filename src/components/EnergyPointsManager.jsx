import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";

const POWER_OPTIONS = ["1.15kVA", "2.3kVA", "3.45kVA", "4.6kVA", "5.75kVA", "6.9kVA", "10.35kVA", "13.8kVA", "17.25kVA", "20.7kVA", "27.6kVA", "34.5kVA", "41.4kVA", "Outros"];

const EnergyPointsManager = ({ saleType, points, onChange, isNew = true }) => {
  const [isMultipoint, setIsMultipoint] = useState(false);
  const [pointCount, setPointCount] = useState(1);
  const [localPoints, setLocalPoints] = useState([]);

  useEffect(() => {
    if (points && points.length > 0) {
      setLocalPoints(points);
      setIsMultipoint(points.length > 1);
      setPointCount(points.length);
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
      power_kva: '',
      tier: '',
      activation_status: 'pending',
      activation_date: null,
      operator_paid: false
    };
  };

  const handleMultipointToggle = (enabled) => {
    setIsMultipoint(enabled);

    if (enabled && localPoints.length === 1) {
      setPointCount(2);
      const newPoints = [
        localPoints[0],
        createEmptyPoint()
      ];
      setLocalPoints(newPoints);
      onChange(newPoints);
    } else if (!enabled) {
      setPointCount(1);
      const singlePoint = [localPoints[0] || createEmptyPoint()];
      setLocalPoints(singlePoint);
      onChange(singlePoint);
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
    onChange(currentPoints);
  };

  const handlePointChange = (index, field, value) => {
    const updated = [...localPoints];
    const finalValue = field === 'activation_date' && value === '' ? null : value;
    updated[index] = {
      ...updated[index],
      [field]: finalValue
    };
    setLocalPoints(updated);
    onChange(updated);
  };

  const handleRemovePoint = (index) => {
    if (localPoints.length <= 1) return;

    const updated = localPoints.filter((_, i) => i !== index);
    setLocalPoints(updated);
    setPointCount(updated.length);
    onChange(updated);

    if (updated.length === 1) {
      setIsMultipoint(false);
    }
  };

  const handleAddPoint = () => {
    const updated = [...localPoints, createEmptyPoint()];
    setLocalPoints(updated);
    setPointCount(updated.length);
    onChange(updated);
  };

  const needsCPE = saleType === 'eletricidade' || saleType === 'dual';
  const needsCUI = saleType === 'gas' || saleType === 'dual';

  if (!saleType) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <div className="flex items-center gap-3 mb-3">
          <Checkbox
            id="is-multipoint"
            checked={isMultipoint}
            onCheckedChange={handleMultipointToggle}
          />
          <Label htmlFor="is-multipoint" className="text-sm font-semibold cursor-pointer">
            Venda Multi-Ponto
          </Label>
        </div>
        <p className="text-xs text-dark-400">
          Ative esta opção se a venda incluir múltiplos CPE e/ou CUI (ex: condomínios, empresas com várias instalações).
        </p>

        {isMultipoint && (
          <div className="mt-3">
            <Label className="text-sm">Quantidade de Pontos *</Label>
            <Input
              type="number"
              min="2"
              value={pointCount}
              onChange={(e) => handlePointCountChange(e.target.value)}
              className="glass-input w-32 mt-1"
            />
          </div>
        )}
      </div>

      <div className="space-y-4">
        {localPoints.map((point, index) => (
          <Card key={point.id || index} className="p-4 space-y-4 bg-dark-800 border-dark-600">
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
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {needsCPE && (
                <>
                  <div>
                    <Label>CPE {!needsCUI && '*'}</Label>
                    <Input
                      className="glass-input"
                      value={point.point_code}
                      onChange={(e) => handlePointChange(index, 'point_code', e.target.value)}
                      placeholder="Código do Ponto de Entrega"
                      required={!needsCUI}
                    />
                  </div>
                  <div>
                    <Label>Potência {!needsCUI && '*'}</Label>
                    <Select
                      value={point.power_kva}
                      onValueChange={(v) => handlePointChange(index, 'power_kva', v)}
                    >
                      <SelectTrigger className="glass-input">
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
                    <Label>CUI {!needsCPE && '*'}</Label>
                    <Input
                      className="glass-input"
                      value={needsCPE ? point.cui_code : point.point_code}
                      onChange={(e) => {
                        if (needsCPE) {
                          handlePointChange(index, 'cui_code', e.target.value);
                        } else {
                          handlePointChange(index, 'point_code', e.target.value);
                        }
                      }}
                      placeholder="Código Universal de Instalação"
                      required={!needsCPE}
                    />
                  </div>
                  <div>
                    <Label>Escalão {!needsCPE && '*'}</Label>
                    <Input
                      className="glass-input"
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
                    <Label>Estado de Ativação</Label>
                    <Select
                      value={point.activation_status}
                      onValueChange={(v) => handlePointChange(index, 'activation_status', v)}
                    >
                      <SelectTrigger className="glass-input">
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
                    <Label>Data de Ativação</Label>
                    <Input
                      className="glass-input"
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
                  <Label htmlFor={`operator-paid-${index}`} className="text-sm cursor-pointer">
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
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Mais Um Ponto
        </Button>
      )}
    </div>
  );
};

export default EnergyPointsManager;
