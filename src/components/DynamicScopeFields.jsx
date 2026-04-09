import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Trash2, Plus } from 'lucide-react';

function evaluateDependency(dep, formData) {
  if (!dep) return true;
  const fieldValue = formData[dep.field];
  switch (dep.operator) {
    case 'equals':
      return fieldValue === dep.value;
    case 'not_equals':
      return fieldValue !== dep.value;
    case 'in':
      return Array.isArray(dep.value) && dep.value.includes(fieldValue);
    case 'not_in':
      return Array.isArray(dep.value) && !dep.value.includes(fieldValue);
    case 'truthy':
      return !!fieldValue;
    case 'falsy':
      return !fieldValue;
    case 'gt':
      return parseFloat(fieldValue) > parseFloat(dep.value);
    case 'gte':
      return parseFloat(fieldValue) >= parseFloat(dep.value);
    default:
      return true;
  }
}

function getRepeatCount(fields, formData) {
  const repeaters = fields.filter(f => f.dependency_mode === 'repeat_by_quantity' && f.depends_on?.field);
  if (repeaters.length === 0) return 0;
  const sourceKey = repeaters[0].depends_on.field;
  return Math.max(0, Math.min(parseInt(formData[sourceKey]) || 0, 50));
}

function renderFieldInput(field, value, handleChange, rules, options) {
  switch (field.field_type) {
    case 'text':
    case 'email':
    case 'phone':
      return (
        <Input
          type={field.field_type === 'email' ? 'email' : field.field_type === 'phone' ? 'tel' : 'text'}
          value={value || ''}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={field.placeholder || ''}
          maxLength={rules.max_length || undefined}
          minLength={rules.min_length || undefined}
          required={field.is_required}
          className="bg-dark-900 border-dark-700 text-white"
        />
      );
    case 'number':
      return (
        <Input
          type="number"
          value={value ?? ''}
          onChange={(e) => handleChange(e.target.value !== '' ? parseFloat(e.target.value) : '')}
          placeholder={field.placeholder || ''}
          min={rules.min_value ?? undefined}
          max={rules.max_value ?? undefined}
          step={rules.step || 'any'}
          required={field.is_required}
          className="bg-dark-900 border-dark-700 text-white"
        />
      );
    case 'select':
      return (
        <Select value={value || ''} onValueChange={handleChange}>
          <SelectTrigger className="bg-dark-900 border-dark-700 text-white">
            <SelectValue placeholder={field.placeholder || 'Selecionar...'} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case 'checkbox':
      return (
        <div className="flex items-center gap-2 pt-1">
          <Switch checked={!!value} onCheckedChange={handleChange} />
          <span className="text-sm text-slate-300">{field.label}</span>
        </div>
      );
    case 'date':
      return (
        <Input
          type="date"
          value={value || ''}
          onChange={(e) => handleChange(e.target.value)}
          required={field.is_required}
          className="bg-dark-900 border-dark-700 text-white"
        />
      );
    case 'textarea':
      return (
        <textarea
          value={value || ''}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={field.placeholder || ''}
          maxLength={rules.max_length || undefined}
          required={field.is_required}
          className="w-full rounded-md bg-dark-900 border border-dark-700 text-white text-sm p-2 min-h-[80px]"
          rows={3}
        />
      );
    default:
      return (
        <Input
          value={value || ''}
          onChange={(e) => handleChange(e.target.value)}
          className="bg-dark-900 border-dark-700 text-white"
        />
      );
  }
}

export default function DynamicScopeFields({ fields, formData, onChange, className }) {
  if (!fields || fields.length === 0) return null;

  const repeatGroups = {};
  const standaloneRepeatFields = {};
  const normalFields = [];

  fields.forEach(field => {
    if (!field.active) return;

    if (field.dependency_mode === 'repeat_by_quantity' || field.dependency_mode === 'group_with') {
      const groupKey = field.repeat_group;
      if (groupKey) {
        if (!repeatGroups[groupKey]) repeatGroups[groupKey] = { fields: [], sourceKey: null };
        repeatGroups[groupKey].fields.push(field);
        if (field.dependency_mode === 'repeat_by_quantity' && field.depends_on?.field) {
          repeatGroups[groupKey].sourceKey = field.depends_on.field;
        }
      } else if (field.dependency_mode === 'repeat_by_quantity' && field.depends_on?.field) {
        standaloneRepeatFields[field.field_key] = field;
      } else {
        normalFields.push(field);
      }
    } else {
      normalFields.push(field);
    }
  });

  for (const groupKey of Object.keys(repeatGroups)) {
    const group = repeatGroups[groupKey];
    if (!group.sourceKey) {
      const repeater = group.fields.find(f => f.dependency_mode === 'repeat_by_quantity');
      if (repeater?.depends_on?.field) {
        group.sourceKey = repeater.depends_on.field;
      }
    }
    group.fields.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  const handleChange = (fieldKey, value) => {
    onChange({ ...formData, [fieldKey]: value });
  };

  const handleRepeatingChange = (fieldKey, index, value) => {
    const arr = Array.isArray(formData[fieldKey]) ? [...formData[fieldKey]] : [];
    arr[index] = value;
    onChange({ ...formData, [fieldKey]: arr });
  };

  const handleAddRepeatingRow = (groupKey) => {
    const group = repeatGroups[groupKey];
    if (!group) return;
    const updated = { ...formData };
    group.fields.forEach(f => {
      const arr = Array.isArray(updated[f.field_key]) ? [...updated[f.field_key]] : [];
      arr.push('');
      updated[f.field_key] = arr;
    });
    if (group.sourceKey && updated[group.sourceKey] !== undefined) {
      const currentCount = Array.isArray(updated[group.fields[0]?.field_key]) ? updated[group.fields[0].field_key].length : 0;
      updated[group.sourceKey] = currentCount;
    }
    onChange(updated);
  };

  const handleRemoveRepeatingRow = (groupKey, index) => {
    const group = repeatGroups[groupKey];
    if (!group) return;
    const updated = { ...formData };
    group.fields.forEach(f => {
      const arr = Array.isArray(updated[f.field_key]) ? [...updated[f.field_key]] : [];
      arr.splice(index, 1);
      updated[f.field_key] = arr;
    });
    if (group.sourceKey && updated[group.sourceKey] !== undefined) {
      const currentCount = Array.isArray(updated[group.fields[0]?.field_key]) ? updated[group.fields[0].field_key].length : 0;
      updated[group.sourceKey] = currentCount;
    }
    onChange(updated);
  };

  const sections = {};
  normalFields.forEach(field => {
    if (field.dependency_mode === 'show_when' || (field.depends_on && !field.dependency_mode)) {
      if (!evaluateDependency(field.depends_on, formData)) return;
    }
    const section = field.section || 'general';
    if (!sections[section]) sections[section] = [];
    sections[section].push(field);
  });

  const renderSingleField = (field) => {
    const value = formData[field.field_key];
    const rules = field.validation_rules || {};
    const options = Array.isArray(field.options) ? field.options : [];

    return (
      <div key={field.id || field.field_key}>
        {field.field_type !== 'checkbox' && (
          <Label className="text-xs text-slate-400 mb-1 block">
            {field.label} {field.is_required && <span className="text-red-400">*</span>}
          </Label>
        )}
        {renderFieldInput(field, value, (v) => handleChange(field.field_key, v), rules, options)}
      </div>
    );
  };

  const renderRepeatGroup = (groupKey) => {
    const group = repeatGroups[groupKey];
    if (!group || !group.sourceKey) return null;

    const sourceValue = parseInt(formData[group.sourceKey]) || 0;
    const repeatCount = Math.max(0, Math.min(sourceValue, 50));

    if (repeatCount === 0 && !Array.isArray(formData[group.fields[0]?.field_key])) return null;

    const actualCount = Array.isArray(formData[group.fields[0]?.field_key])
      ? formData[group.fields[0].field_key].length
      : repeatCount;

    const rowCount = Math.max(actualCount, repeatCount);

    if (rowCount === 0) return null;

    return (
      <div key={groupKey} className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-slate-400 font-medium uppercase tracking-wider">
            {groupKey.replace(/_/g, ' ')} ({rowCount})
          </Label>
          <button
            type="button"
            onClick={() => handleAddRepeatingRow(groupKey)}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors"
            style={{ background: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4' }}
          >
            <Plus className="w-3 h-3" /> Adicionar
          </button>
        </div>

        <div className="space-y-2">
          {/* Header row */}
          <div
            className="grid gap-2 px-2"
            style={{ gridTemplateColumns: `repeat(${group.fields.length}, 1fr) 32px` }}
          >
            {group.fields.map(f => (
              <span key={f.field_key} className="text-[10px] text-slate-500 uppercase tracking-wider">
                {f.label} {f.is_required && <span className="text-red-400">*</span>}
              </span>
            ))}
            <span />
          </div>

          {Array.from({ length: rowCount }).map((_, idx) => (
            <div
              key={idx}
              className="grid gap-2 items-center rounded-lg px-2 py-1.5"
              style={{
                gridTemplateColumns: `repeat(${group.fields.length}, 1fr) 32px`,
                background: 'rgba(6, 182, 212, 0.02)',
                border: '1px solid rgba(6, 182, 212, 0.06)',
              }}
            >
              {group.fields.map(f => {
                const arr = Array.isArray(formData[f.field_key]) ? formData[f.field_key] : [];
                const val = arr[idx] ?? '';
                const rules = f.validation_rules || {};
                const options = Array.isArray(f.options) ? f.options : [];
                return (
                  <div key={f.field_key}>
                    {renderFieldInput(f, val, (v) => handleRepeatingChange(f.field_key, idx, v), rules, options)}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => handleRemoveRepeatingRow(groupKey, idx)}
                className="p-1 rounded transition-colors self-center"
                style={{ color: 'rgba(239, 68, 68, 0.5)' }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderStandaloneRepeat = (field) => {
    const sourceKey = field.depends_on?.field;
    if (!sourceKey) return null;
    const count = Math.max(0, Math.min(parseInt(formData[sourceKey]) || 0, 50));
    if (count === 0) return null;

    const rules = field.validation_rules || {};
    const options = Array.isArray(field.options) ? field.options : [];

    return (
      <div key={field.field_key} className="space-y-2">
        <Label className="text-xs text-slate-400 mb-1 block">
          {field.label} {field.is_required && <span className="text-red-400">*</span>}
        </Label>
        {Array.from({ length: count }).map((_, idx) => {
          const arr = Array.isArray(formData[field.field_key]) ? formData[field.field_key] : [];
          return (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-6 text-right flex-shrink-0">{idx + 1}.</span>
              <div className="flex-1">
                {renderFieldInput(field, arr[idx] ?? '', (v) => handleRepeatingChange(field.field_key, idx, v), rules, options)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderedGroups = new Set();

  return (
    <div className={className}>
      {Object.entries(sections).map(([sectionKey, sectionFields]) => (
        <div key={sectionKey} className="space-y-3">
          {sectionFields.map(field => {
            const groupKey = field.repeat_group;
            if (groupKey && repeatGroups[groupKey] && repeatGroups[groupKey].sourceKey === field.field_key) {
              if (renderedGroups.has(groupKey)) return null;
              renderedGroups.add(groupKey);
              return (
                <React.Fragment key={field.id || field.field_key}>
                  {renderSingleField(field)}
                  {renderRepeatGroup(groupKey)}
                </React.Fragment>
              );
            }

            if (standaloneRepeatFields[field.field_key]) return null;

            return renderSingleField(field);
          })}
        </div>
      ))}

      {Object.entries(repeatGroups).map(([groupKey, group]) => {
        if (renderedGroups.has(groupKey)) return null;
        const sourceKey = group.sourceKey;
        const sourceValue = parseInt(formData[sourceKey]) || 0;
        if (sourceValue === 0 && !Array.isArray(formData[group.fields[0]?.field_key])) return null;
        renderedGroups.add(groupKey);
        return renderRepeatGroup(groupKey);
      })}

      {Object.values(standaloneRepeatFields).map(field => renderStandaloneRepeat(field))}
    </div>
  );
}

export { evaluateDependency };
