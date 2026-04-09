import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { partnerTypesService } from '../services/partnerTypesService';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import { Plus, Pencil, Trash2, Users, Eye, EyeOff, X } from 'lucide-react';

export default function PartnerTypesManagement({ user }) {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editType, setEditType] = useState(null);
  const [formData, setFormData] = useState({
    slug: '', display_name: '', code_prefix: '',
    has_levels: true, level_type: 'named', max_levels: 5,
    default_level_names: [],
  });
  const [newLevelName, setNewLevelName] = useState('');

  const { data: partnerTypes = [], isLoading } = useQuery({
    queryKey: ['partnerTypes'],
    queryFn: () => partnerTypesService.getAll(false),
  });

  const createMutation = useMutation({
    mutationFn: (data) => partnerTypesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partnerTypes'] });
      setShowCreate(false);
      resetForm();
      toast.success('Tipo de parceiro criado');
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => partnerTypesService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partnerTypes'] });
      setEditType(null);
      toast.success('Tipo de parceiro atualizado');
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => partnerTypesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partnerTypes'] });
      toast.success('Tipo de parceiro eliminado');
    },
    onError: (err) => toast.error(err.message),
  });

  const resetForm = () => {
    setFormData({
      slug: '', display_name: '', code_prefix: '',
      has_levels: true, level_type: 'named', max_levels: 5,
      default_level_names: [],
    });
    setNewLevelName('');
  };

  const handleEdit = (pt) => {
    setFormData({
      slug: pt.slug,
      display_name: pt.display_name,
      code_prefix: pt.code_prefix,
      has_levels: pt.has_levels,
      level_type: pt.level_type,
      max_levels: pt.max_levels,
      default_level_names: pt.default_level_names || [],
    });
    setEditType(pt);
  };

  const handleAddLevel = () => {
    if (!newLevelName.trim()) return;
    setFormData(prev => ({
      ...prev,
      default_level_names: [...prev.default_level_names, newLevelName.trim()],
    }));
    setNewLevelName('');
  };

  const handleRemoveLevel = (idx) => {
    setFormData(prev => ({
      ...prev,
      default_level_names: prev.default_level_names.filter((_, i) => i !== idx),
    }));
  };

  const handleToggleActive = (pt) => {
    updateMutation.mutate({ id: pt.id, data: { active: !pt.active } });
  };

  const handleSubmit = () => {
    if (!formData.slug || !formData.display_name || !formData.code_prefix) {
      toast.error('Preencha todos os campos obrigatorios');
      return;
    }
    if (editType) {
      updateMutation.mutate({ id: editType.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const dialogOpen = showCreate || !!editType;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-dark-800 rounded w-48" />
          <div className="h-32 bg-dark-800 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Tipos de Parceiro</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(6, 182, 212, 0.5)' }}>
            Configure tipos de parceiro, niveis e prefixos de codigo
          </p>
        </div>
        <Button
          onClick={() => { resetForm(); setShowCreate(true); }}
          className="gap-2"
          style={{ background: '#06b6d4', color: '#080c14' }}
        >
          <Plus className="w-4 h-4" /> Novo Tipo
        </Button>
      </div>

      <div className="grid gap-4">
        {partnerTypes.map(pt => (
          <div
            key={pt.id}
            className="rounded-xl p-4 flex items-center gap-4 transition-all duration-200"
            style={{
              background: 'rgba(6, 182, 212, 0.03)',
              border: '1px solid rgba(6, 182, 212, 0.1)',
              opacity: pt.active ? 1 : 0.5,
            }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4' }}
            >
              <Users className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-white">{pt.display_name}</h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(6, 182, 212, 0.1)', color: 'rgba(6, 182, 212, 0.6)' }}>
                  Prefixo: {pt.code_prefix}
                </span>
                {pt.has_levels && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                    {pt.level_type === 'named' ? 'Niveis nomeados' : 'Niveis numericos'} (max {pt.max_levels})
                  </span>
                )}
                {pt.is_system && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                    Sistema
                  </span>
                )}
              </div>
              {pt.has_levels && pt.default_level_names?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {pt.default_level_names.map((name, idx) => (
                    <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(6, 182, 212, 0.08)', color: 'rgba(6, 182, 212, 0.6)' }}>
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleToggleActive(pt)}
                className="p-2 rounded-lg transition-colors"
                style={{ color: pt.active ? '#10b981' : 'rgba(239, 68, 68, 0.5)' }}
              >
                {pt.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              <button
                onClick={() => handleEdit(pt)}
                className="p-2 rounded-lg transition-colors"
                style={{ color: 'rgba(6, 182, 212, 0.5)' }}
              >
                <Pencil className="w-4 h-4" />
              </button>
              {!pt.is_system && (
                <button
                  onClick={() => { if (confirm('Eliminar tipo de parceiro?')) deleteMutation.mutate(pt.id); }}
                  className="p-2 rounded-lg transition-colors"
                  style={{ color: 'rgba(239, 68, 68, 0.5)' }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setShowCreate(false); setEditType(null); } }}>
        <DialogContent className="bg-dark-900 border-dark-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>{editType ? 'Editar Tipo de Parceiro' : 'Novo Tipo de Parceiro'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-slate-400">Nome de Exibicao</Label>
              <Input
                value={formData.display_name}
                onChange={(e) => {
                  const displayName = e.target.value;
                  if (!editType) {
                    const slug = displayName.toUpperCase().replace(/[^A-Z0-9+]/g, '');
                    setFormData({ ...formData, display_name: displayName, slug, code_prefix: slug });
                  } else {
                    setFormData({ ...formData, display_name: displayName });
                  }
                }}
                className="bg-dark-800 border-dark-700 text-white"
                placeholder="ex: Agente"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-400">Slug (identificador)</Label>
                <Input
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.replace(/[^A-Za-z0-9+_]/g, '') })}
                  className="bg-dark-800 border-dark-700 text-white"
                  disabled={editType?.is_system}
                />
              </div>
              <div>
                <Label className="text-xs text-slate-400">Prefixo Codigo</Label>
                <Input
                  value={formData.code_prefix}
                  onChange={(e) => setFormData({ ...formData, code_prefix: e.target.value.replace(/[^A-Za-z0-9+]/g, '') })}
                  className="bg-dark-800 border-dark-700 text-white"
                  placeholder="ex: AG"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={formData.has_levels}
                onCheckedChange={(v) => setFormData({ ...formData, has_levels: v })}
              />
              <Label className="text-sm text-slate-300">Tem niveis de comissionamento</Label>
            </div>

            {formData.has_levels && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-slate-400">Tipo de Nivel</Label>
                    <Select
                      value={formData.level_type}
                      onValueChange={(v) => setFormData({ ...formData, level_type: v })}
                    >
                      <SelectTrigger className="bg-dark-800 border-dark-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="named">Nomeado (Nv1, Nv2...)</SelectItem>
                        <SelectItem value="numeric">Numerico (1, 2, 3...)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">Max. Niveis</Label>
                    <Input
                      type="number"
                      value={formData.max_levels}
                      onChange={(e) => setFormData({ ...formData, max_levels: parseInt(e.target.value) || 5 })}
                      className="bg-dark-800 border-dark-700 text-white"
                      min={1}
                      max={20}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-slate-400 mb-1.5">Nomes dos Niveis</Label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {formData.default_level_names.map((name, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md"
                        style={{ background: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4' }}
                      >
                        {name}
                        <button onClick={() => handleRemoveLevel(idx)} className="hover:text-red-400">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newLevelName}
                      onChange={(e) => setNewLevelName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddLevel())}
                      className="h-8 text-sm bg-dark-900 border-dark-700 text-white flex-1"
                      placeholder={formData.level_type === 'named' ? 'ex: Nv1' : 'ex: 1'}
                    />
                    <Button onClick={handleAddLevel} size="sm" variant="outline" className="h-8">
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowCreate(false); setEditType(null); }}>Cancelar</Button>
              <Button
                onClick={handleSubmit}
                disabled={!formData.slug || !formData.display_name || !formData.code_prefix}
                style={{ background: '#06b6d4', color: '#080c14' }}
              >
                {editType ? 'Guardar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
