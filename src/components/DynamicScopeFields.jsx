import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

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
    default:
      return true;
  }
}

export default function DynamicScopeFields({ fields, formData, onChange, className }) {
  if (!fields || fields.length === 0) return null;

  const sections = {};
  fields.forEach(field => {
    if (!field.active) return;
    if (!evaluateDependency(field.depends_on, formData)) return;
    const section = field.section || 'general';
    if (!sections[section]) sections[section] = [];
    sections[section].push(field);
  });

  const handleChange = (fieldKey, value) => {
    onChange({ ...formData, [fieldKey]: value });
  };

  const renderField = (field) => {
    const value = formData[field.field_key];
    const rules = field.validation_rules || {};
    const options = Array.isArray(field.options) ? field.options : [];

    switch (field.field_type) {
      case 'text':
      case 'email':
      case 'phone':
        return (
          <Input
            type={field.field_type === 'email' ? 'email' : field.field_type === 'phone' ? 'tel' : 'text'}
            value={value || ''}
            onChange={(e) => handleChange(field.field_key, e.target.value)}
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
            onChange={(e) => handleChange(field.field_key, e.target.value !== '' ? parseFloat(e.target.value) : '')}
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
          <Select
            value={value || ''}
            onValueChange={(v) => handleChange(field.field_key, v)}
          >
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
            <Switch
              checked={!!value}
              onCheckedChange={(v) => handleChange(field.field_key, v)}
            />
            <span className="text-sm text-slate-300">{field.label}</span>
          </div>
        );

      case 'date':
        return (
          <Input
            type="date"
            value={value || ''}
            onChange={(e) => handleChange(field.field_key, e.target.value)}
            required={field.is_required}
            className="bg-dark-900 border-dark-700 text-white"
          />
        );

      case 'textarea':
        return (
          <textarea
            value={value || ''}
            onChange={(e) => handleChange(field.field_key, e.target.value)}
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
            onChange={(e) => handleChange(field.field_key, e.target.value)}
            className="bg-dark-900 border-dark-700 text-white"
          />
        );
    }
  };

  return (
    <div className={className}>
      {Object.entries(sections).map(([sectionKey, sectionFields]) => (
        <div key={sectionKey} className="space-y-3">
          {sectionFields.map(field => (
            <div key={field.id || field.field_key}>
              {field.field_type !== 'checkbox' && (
                <Label className="text-xs text-slate-400 mb-1 block">
                  {field.label} {field.is_required && <span className="text-red-400">*</span>}
                </Label>
              )}
              {renderField(field)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export { evaluateDependency };
