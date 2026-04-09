import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Trash2, GripVertical, ChevronDown, ChevronUp, Plus, X } from 'lucide-react';

const FIELD_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Numero' },
  { value: 'select', label: 'Lista de opcoes' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'date', label: 'Data' },
  { value: 'textarea', label: 'Texto longo' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Telefone' },
];

export default function ScopeFieldEditor({ field, onUpdate, onDelete, isSystem }) {
  const [expanded, setExpanded] = useState(false);
  const [newOption, setNewOption] = useState('');

  const options = Array.isArray(field.options) ? field.options : [];
  const rules = field.validation_rules || {};

  const handleAddOption = () => {
    if (!newOption.trim()) return;
    const updated = [...options, newOption.trim()];
    onUpdate({ ...field, options: updated });
    setNewOption('');
  };

  const handleRemoveOption = (idx) => {
    const updated = options.filter((_, i) => i !== idx);
    onUpdate({ ...field, options: updated });
  };

  const handleRuleChange = (key, value) => {
    onUpdate({
      ...field,
      validation_rules: { ...rules, [key]: value || undefined },
    });
  };

  return (
    <div
      className="rounded-lg p-3 transition-all duration-200"
      style={{
        background: 'rgba(6, 182, 212, 0.03)',
        border: '1px solid rgba(6, 182, 212, 0.1)',
      }}
    >
      <div className="flex items-center gap-2">
        <GripVertical className="w-4 h-4 cursor-grab flex-shrink-0" style={{ color: 'rgba(6, 182, 212, 0.3)' }} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white truncate">{field.label}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(6, 182, 212, 0.1)', color: 'rgba(6, 182, 212, 0.6)' }}>
              {field.field_key}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
              {FIELD_TYPES.find(t => t.value === field.field_type)?.label || field.field_type}
            </span>
            {field.is_required && (
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                Obrigatorio
              </span>
            )}
            {isSystem && (
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(6, 182, 212, 0.1)', color: 'rgba(6, 182, 212, 0.5)' }}>
                Sistema
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'rgba(6, 182, 212, 0.5)' }}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {!isSystem && (
          <button
            onClick={() => onDelete(field.id)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'rgba(239, 68, 68, 0.5)' }}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-3 pt-3 space-y-3" style={{ borderTop: '1px solid rgba(6, 182, 212, 0.08)' }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-slate-400 mb-1">Chave (field_key)</Label>
              <Input
                value={field.field_key}
                onChange={(e) => onUpdate({ ...field, field_key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                disabled={isSystem}
                className="h-8 text-sm bg-dark-900 border-dark-700 text-white"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-400 mb-1">Label</Label>
              <Input
                value={field.label}
                onChange={(e) => onUpdate({ ...field, label: e.target.value })}
                className="h-8 text-sm bg-dark-900 border-dark-700 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-slate-400 mb-1">Tipo de Campo</Label>
              <Select
                value={field.field_type}
                onValueChange={(v) => onUpdate({ ...field, field_type: v })}
                disabled={isSystem}
              >
                <SelectTrigger className="h-8 text-sm bg-dark-900 border-dark-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-400 mb-1">Seccao</Label>
              <Input
                value={field.section || ''}
                onChange={(e) => onUpdate({ ...field, section: e.target.value })}
                className="h-8 text-sm bg-dark-900 border-dark-700 text-white"
                placeholder="ex: service_details"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-slate-400 mb-1">Placeholder</Label>
              <Input
                value={field.placeholder || ''}
                onChange={(e) => onUpdate({ ...field, placeholder: e.target.value })}
                className="h-8 text-sm bg-dark-900 border-dark-700 text-white"
              />
            </div>
            <div className="flex items-end gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={field.is_required || false}
                  onCheckedChange={(v) => onUpdate({ ...field, is_required: v })}
                />
                <Label className="text-xs text-slate-400">Obrigatorio</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={field.active !== false}
                  onCheckedChange={(v) => onUpdate({ ...field, active: v })}
                />
                <Label className="text-xs text-slate-400">Ativo</Label>
              </div>
            </div>
          </div>

          {(field.field_type === 'text' || field.field_type === 'textarea' || field.field_type === 'phone') && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-slate-400 mb-1">Min. caracteres</Label>
                <Input
                  type="number"
                  value={rules.min_length || ''}
                  onChange={(e) => handleRuleChange('min_length', e.target.value ? parseInt(e.target.value) : undefined)}
                  className="h-8 text-sm bg-dark-900 border-dark-700 text-white"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-400 mb-1">Max. caracteres</Label>
                <Input
                  type="number"
                  value={rules.max_length || ''}
                  onChange={(e) => handleRuleChange('max_length', e.target.value ? parseInt(e.target.value) : undefined)}
                  className="h-8 text-sm bg-dark-900 border-dark-700 text-white"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-400 mb-1">Padrao (regex)</Label>
                <Input
                  value={rules.pattern || ''}
                  onChange={(e) => handleRuleChange('pattern', e.target.value || undefined)}
                  className="h-8 text-sm bg-dark-900 border-dark-700 text-white"
                  placeholder="^PT0002"
                />
              </div>
            </div>
          )}

          {field.field_type === 'number' && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-slate-400 mb-1">Valor minimo</Label>
                <Input
                  type="number"
                  value={rules.min_value ?? ''}
                  onChange={(e) => handleRuleChange('min_value', e.target.value !== '' ? parseFloat(e.target.value) : undefined)}
                  className="h-8 text-sm bg-dark-900 border-dark-700 text-white"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-400 mb-1">Valor maximo</Label>
                <Input
                  type="number"
                  value={rules.max_value ?? ''}
                  onChange={(e) => handleRuleChange('max_value', e.target.value !== '' ? parseFloat(e.target.value) : undefined)}
                  className="h-8 text-sm bg-dark-900 border-dark-700 text-white"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-400 mb-1">Incremento (step)</Label>
                <Input
                  type="number"
                  value={rules.step ?? ''}
                  onChange={(e) => handleRuleChange('step', e.target.value !== '' ? parseFloat(e.target.value) : undefined)}
                  className="h-8 text-sm bg-dark-900 border-dark-700 text-white"
                  step="0.01"
                />
              </div>
            </div>
          )}

          {field.field_type === 'select' && (
            <div>
              <Label className="text-xs text-slate-400 mb-1">Opcoes</Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {options.map((opt, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md"
                    style={{ background: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4' }}
                  >
                    {opt}
                    <button onClick={() => handleRemoveOption(idx)} className="hover:text-red-400">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddOption())}
                  className="h-8 text-sm bg-dark-900 border-dark-700 text-white flex-1"
                  placeholder="Nova opcao..."
                />
                <Button onClick={handleAddOption} size="sm" variant="outline" className="h-8">
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs text-slate-400 mb-1">Coluna mapeada (sales table)</Label>
            <Input
              value={field.maps_to_column || ''}
              onChange={(e) => onUpdate({ ...field, maps_to_column: e.target.value || null })}
              className="h-8 text-sm bg-dark-900 border-dark-700 text-white"
              placeholder="ex: cpe, power (vazio = custom_fields JSON)"
              disabled={isSystem}
            />
          </div>
        </div>
      )}
    </div>
  );
}
