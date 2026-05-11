import React, { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { scopesService } from '../services/scopesService';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/sonner';
import ScopeFieldEditor from '../components/ScopeFieldEditor';
import { Plus, Trash2, Settings, FileText, Mail, Layers, Eye, EyeOff, Copy, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';

const ICON_OPTIONS = [
  'phone', 'zap', 'sun', 'car', 'building2', 'wifi', 'globe', 'shield',
  'heart', 'star', 'home', 'briefcase', 'truck', 'monitor', 'radio', 'circle',
];

function ReorderableList({ items, onReorder, renderItem, keyExtractor }) {
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  const handleDragStart = (idx) => {
    dragItem.current = idx;
  };

  const handleDragEnter = (idx) => {
    dragOverItem.current = idx;
  };

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) {
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }
    const reordered = [...items];
    const [removed] = reordered.splice(dragItem.current, 1);
    reordered.splice(dragOverItem.current, 0, removed);
    dragItem.current = null;
    dragOverItem.current = null;
    onReorder(reordered);
  };

  const moveItem = (fromIdx, toIdx) => {
    if (toIdx < 0 || toIdx >= items.length) return;
    const reordered = [...items];
    const [removed] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, removed);
    onReorder(reordered);
  };

  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div
          key={keyExtractor(item, idx)}
          draggable
          onDragStart={() => handleDragStart(idx)}
          onDragEnter={() => handleDragEnter(idx)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => e.preventDefault()}
          className="group"
        >
          {renderItem(item, idx, {
            onMoveUp: idx > 0 ? () => moveItem(idx, idx - 1) : null,
            onMoveDown: idx < items.length - 1 ? () => moveItem(idx, idx + 1) : null,
          })}
        </div>
      ))}
    </div>
  );
}

export default function ScopesManagement({ user }) {
  const queryClient = useQueryClient();
  const [editScope, setEditScope] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newScope, setNewScope] = useState({ slug: '', display_name: '', icon: 'circle', color: '#06b6d4', counting_mode: 'per_contract', quantity_field: '' });
  const [editTab, setEditTab] = useState('fields');
  const [scopeFields, setScopeFields] = useState([]);
  const [scopeEmailFields, setScopeEmailFields] = useState([]);
  const [newFieldData, setNewFieldData] = useState({ field_key: '', label: '', field_type: 'text' });
  const [showNewField, setShowNewField] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState(null);
  const [duplicateData, setDuplicateData] = useState({ slug: '', display_name: '', icon: 'circle', color: '#06b6d4' });

  const { data: scopes = [], isLoading } = useQuery({
    queryKey: ['scopes'],
    queryFn: () => scopesService.getAll(false),
  });

  const createMutation = useMutation({
    mutationFn: (data) => scopesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scopes'] });
      setShowCreate(false);
      setNewScope({ slug: '', display_name: '', icon: 'circle', color: '#06b6d4', counting_mode: 'per_contract', quantity_field: '' });
      toast.success('Ambito criado com sucesso');
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => scopesService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scopes'] });
      toast.success('Ambito atualizado');
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => scopesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scopes'] });
      toast.success('Ambito eliminado');
    },
    onError: (err) => toast.error(err.message),
  });

  const duplicateMutation = useMutation({
    mutationFn: ({ sourceId, data }) => scopesService.duplicate(sourceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scopes'] });
      setDuplicateSource(null);
      setDuplicateData({ slug: '', display_name: '', icon: 'circle', color: '#06b6d4', counting_mode: 'per_contract', quantity_field: '' });
      toast.success('Ambito duplicado com sucesso');
    },
    onError: (err) => toast.error(err.message),
  });

  const createFieldMutation = useMutation({
    mutationFn: (data) => scopesService.createField(data),
    onSuccess: () => {
      loadScopeFields(editScope.id);
      setShowNewField(false);
      setNewFieldData({ field_key: '', label: '', field_type: 'text' });
      toast.success('Campo criado');
    },
    onError: (err) => toast.error(err.message),
  });

  const updateFieldMutation = useMutation({
    mutationFn: ({ id, data }) => scopesService.updateField(id, data),
    onSuccess: (_, variables) => {
      toast.success('Campo atualizado');
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteFieldMutation = useMutation({
    mutationFn: (id) => scopesService.deleteField(id),
    onSuccess: () => {
      loadScopeFields(editScope.id);
      toast.success('Campo eliminado');
    },
    onError: (err) => toast.error(err.message),
  });

  const loadScopeFields = async (scopeId) => {
    const fields = await scopesService.getFields(scopeId, false);
    setScopeFields(fields);
    const emailFields = await scopesService.getEmailFields(scopeId);
    setScopeEmailFields(emailFields);
  };

  const handleEditScope = async (scope) => {
    setEditScope(scope);
    setEditTab('fields');
    await loadScopeFields(scope.id);
  };

  const handleFieldUpdate = useCallback((updatedField) => {
    setScopeFields(prev => prev.map(f => f.id === updatedField.id ? updatedField : f));
    updateFieldMutation.mutate({ id: updatedField.id, data: updatedField });
  }, [updateFieldMutation]);

  const handleFieldDelete = useCallback((fieldId) => {
    setScopeFields(prev => prev.filter(f => f.id !== fieldId));
    deleteFieldMutation.mutate(fieldId);
  }, [deleteFieldMutation]);

  const handleCreateField = () => {
    if (!newFieldData.field_key || !newFieldData.label) {
      toast.error('Preencha chave e label do campo');
      return;
    }
    createFieldMutation.mutate({
      ...newFieldData,
      scope_id: editScope.id,
      sort_order: scopeFields.length,
    });
  };

  const handleFieldsReorder = useCallback(async (reorderedFields) => {
    const updated = reorderedFields.map((f, idx) => ({ ...f, sort_order: idx }));
    setScopeFields(updated);
    try {
      await scopesService.saveFieldsOrder(updated);
    } catch (err) {
      toast.error('Erro ao reordenar campos');
    }
  }, []);

  const handleEmailFieldsReorder = useCallback((reorderedFields) => {
    setScopeEmailFields(reorderedFields.map((ef, idx) => ({ ...ef, sort_order: idx })));
  }, []);

  const handleSaveEmailFields = async () => {
    try {
      await scopesService.saveEmailFields(editScope.id, scopeEmailFields);
      toast.success('Campos de email guardados');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleAddEmailField = () => {
    setScopeEmailFields(prev => [
      ...prev,
      { field_key: '', label: '', sort_order: prev.length },
    ]);
  };

  const handleRemoveEmailField = (idx) => {
    setScopeEmailFields(prev => prev.filter((_, i) => i !== idx));
  };

  const handleToggleActive = (scope) => {
    updateMutation.mutate({ id: scope.id, data: { active: !scope.active } });
  };

  const handleStartDuplicate = (scope) => {
    setDuplicateSource(scope);
    setDuplicateData({
      slug: '',
      display_name: '',
      icon: scope.icon || 'circle',
      color: scope.color || '#06b6d4',
    });
  };

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
          <h1 className="text-xl font-bold text-white">Gestao de Ambitos</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(6, 182, 212, 0.5)' }}>
            Configure ambitos de venda, campos de formulario e templates de email
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="gap-2"
          style={{ background: '#06b6d4', color: '#080c14' }}
        >
          <Plus className="w-4 h-4" /> Novo Ambito
        </Button>
      </div>

      <div className="grid gap-4">
        {scopes.map(scope => (
          <div
            key={scope.id}
            className="rounded-xl p-4 flex items-center gap-4 transition-all duration-200"
            style={{
              background: 'rgba(6, 182, 212, 0.03)',
              border: '1px solid rgba(6, 182, 212, 0.1)',
              opacity: scope.active ? 1 : 0.5,
            }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: `${scope.color}20`, color: scope.color }}
            >
              <Layers className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white">{scope.display_name}</h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(6, 182, 212, 0.1)', color: 'rgba(6, 182, 212, 0.6)' }}>
                  {scope.slug}
                </span>
                {scope.is_system && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                    Sistema
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleToggleActive(scope)}
                className="p-2 rounded-lg transition-colors"
                style={{ color: scope.active ? '#10b981' : 'rgba(239, 68, 68, 0.5)' }}
                title={scope.active ? 'Desativar' : 'Ativar'}
              >
                {scope.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              <button
                onClick={() => handleStartDuplicate(scope)}
                className="p-2 rounded-lg transition-colors hover:bg-dark-800"
                style={{ color: 'rgba(6, 182, 212, 0.5)' }}
                title="Duplicar"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleEditScope(scope)}
                className="p-2 rounded-lg transition-colors hover:bg-dark-800"
                style={{ color: 'rgba(6, 182, 212, 0.5)' }}
                title="Configurar"
              >
                <Settings className="w-4 h-4" />
              </button>
              {!scope.is_system && (
                <button
                  onClick={() => { if (confirm('Eliminar ambito?')) deleteMutation.mutate(scope.id); }}
                  className="p-2 rounded-lg transition-colors hover:bg-dark-800"
                  style={{ color: 'rgba(239, 68, 68, 0.5)' }}
                  title="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create Scope Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-dark-900 border-dark-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Ambito de Venda</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-slate-400">Nome de Exibicao</Label>
              <Input
                value={newScope.display_name}
                onChange={(e) => {
                  const displayName = e.target.value;
                  const slug = displayName.toLowerCase()
                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-z0-9]+/g, '_')
                    .replace(/^_|_$/g, '');
                  setNewScope({ ...newScope, display_name: displayName, slug });
                }}
                className="bg-dark-800 border-dark-700 text-white"
                placeholder="ex: Seguros"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Identificador (slug)</Label>
              <Input
                value={newScope.slug}
                onChange={(e) => setNewScope({ ...newScope, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                className="bg-dark-800 border-dark-700 text-white"
                placeholder="ex: seguros"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Icone</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {ICON_OPTIONS.map(icon => (
                  <button
                    key={icon}
                    onClick={() => setNewScope({ ...newScope, icon })}
                    className="px-2 py-1 text-xs rounded-md transition-all"
                    style={{
                      background: newScope.icon === icon ? 'rgba(6, 182, 212, 0.2)' : 'rgba(6, 182, 212, 0.05)',
                      border: `1px solid ${newScope.icon === icon ? 'rgba(6, 182, 212, 0.5)' : 'rgba(6, 182, 212, 0.1)'}`,
                      color: newScope.icon === icon ? '#06b6d4' : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-400">Cor</Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={newScope.color}
                  onChange={(e) => setNewScope({ ...newScope, color: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                />
                <Input
                  value={newScope.color}
                  onChange={(e) => setNewScope({ ...newScope, color: e.target.value })}
                  className="bg-dark-800 border-dark-700 text-white flex-1 h-8 text-sm"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-400">Forma de Contabilizacao</Label>
              <select
                value={newScope.counting_mode}
                onChange={(e) => setNewScope({ ...newScope, counting_mode: e.target.value, quantity_field: e.target.value === 'per_contract' ? '' : newScope.quantity_field })}
                className="w-full h-9 text-sm bg-dark-800 border border-dark-700 text-white rounded-md px-3 mt-1"
              >
                <option value="per_contract">Por contrato (1 venda = 1 comissao)</option>
                <option value="by_quantity">Por quantidade (comissao x quantidade de item)</option>
              </select>
            </div>
            {newScope.counting_mode === 'by_quantity' && (
              <div>
                <Label className="text-xs text-slate-400">Campo de Quantidade (field_key)</Label>
                <Input
                  value={newScope.quantity_field}
                  onChange={(e) => setNewScope({ ...newScope, quantity_field: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                  className="bg-dark-800 border-dark-700 text-white"
                  placeholder="ex: ev_outlet_count"
                />
                <p className="text-[10px] text-slate-500 mt-1">Chave do campo cujo valor numerico multiplica a comissao</p>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button
                onClick={() => createMutation.mutate(newScope)}
                disabled={!newScope.slug || !newScope.display_name}
                style={{ background: '#06b6d4', color: '#080c14' }}
              >
                Criar Ambito
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Scope Dialog */}
      <Dialog open={!!editScope} onOpenChange={(open) => !open && setEditScope(null)}>
        <DialogContent className="bg-dark-900 border-dark-700 text-white max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" style={{ color: editScope?.color }} />
              Configurar: {editScope?.display_name}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={editTab} onValueChange={setEditTab}>
            <TabsList className="bg-dark-800 border-dark-700 mb-4">
              <TabsTrigger value="fields" className="gap-1.5 text-xs">
                <FileText className="w-3.5 h-3.5" /> Campos do Formulario
              </TabsTrigger>
              <TabsTrigger value="email" className="gap-1.5 text-xs">
                <Mail className="w-3.5 h-3.5" /> Campos de Email
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-1.5 text-xs">
                <Settings className="w-3.5 h-3.5" /> Definicoes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="fields" className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Arraste para reordenar. Os campos globais (Nome, NIF, etc.) sao sempre incluidos.
                </p>
                <Button size="sm" onClick={() => setShowNewField(true)} className="gap-1.5" variant="outline">
                  <Plus className="w-3.5 h-3.5" /> Adicionar Campo
                </Button>
              </div>

              <ReorderableList
                items={scopeFields}
                onReorder={handleFieldsReorder}
                keyExtractor={(item) => item.id}
                renderItem={(field, idx, { onMoveUp, onMoveDown }) => (
                  <div className="flex items-start gap-1">
                    <div className="flex flex-col items-center pt-3 gap-0.5">
                      <button
                        onClick={onMoveUp}
                        disabled={!onMoveUp}
                        className="p-0.5 rounded transition-colors disabled:opacity-20"
                        style={{ color: 'rgba(6, 182, 212, 0.5)' }}
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <span className="text-[9px] text-slate-600 select-none">{idx + 1}</span>
                      <button
                        onClick={onMoveDown}
                        disabled={!onMoveDown}
                        className="p-0.5 rounded transition-colors disabled:opacity-20"
                        style={{ color: 'rgba(6, 182, 212, 0.5)' }}
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex-1">
                      <ScopeFieldEditor
                        field={field}
                        onUpdate={handleFieldUpdate}
                        onDelete={handleFieldDelete}
                        isSystem={field.is_system}
                        allFields={scopeFields}
                      />
                    </div>
                  </div>
                )}
              />

              {scopeFields.length === 0 && (
                <div className="text-center py-8 text-slate-500 text-sm">
                  Nenhum campo configurado. Adicione campos para este ambito.
                </div>
              )}

              {showNewField && (
                <div className="rounded-lg p-4 space-y-3" style={{ background: 'rgba(6, 182, 212, 0.05)', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
                  <h4 className="text-sm font-semibold text-white">Novo Campo</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs text-slate-400">Chave (field_key)</Label>
                      <Input
                        value={newFieldData.field_key}
                        onChange={(e) => setNewFieldData({ ...newFieldData, field_key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                        className="h-8 text-sm bg-dark-900 border-dark-700 text-white"
                        placeholder="ex: numero_contrato"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-400">Label</Label>
                      <Input
                        value={newFieldData.label}
                        onChange={(e) => setNewFieldData({ ...newFieldData, label: e.target.value })}
                        className="h-8 text-sm bg-dark-900 border-dark-700 text-white"
                        placeholder="ex: Numero do Contrato"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-400">Tipo</Label>
                      <select
                        value={newFieldData.field_type}
                        onChange={(e) => setNewFieldData({ ...newFieldData, field_type: e.target.value })}
                        className="w-full h-8 text-sm bg-dark-900 border border-dark-700 text-white rounded-md px-2"
                      >
                        <option value="text">Texto</option>
                        <option value="number">Numero</option>
                        <option value="select">Lista de opcoes</option>
                        <option value="checkbox">Checkbox</option>
                        <option value="date">Data</option>
                        <option value="textarea">Texto longo</option>
                        <option value="email">Email</option>
                        <option value="phone">Telefone</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowNewField(false)}>Cancelar</Button>
                    <Button
                      size="sm"
                      onClick={handleCreateField}
                      disabled={!newFieldData.field_key || !newFieldData.label}
                      style={{ background: '#06b6d4', color: '#080c14' }}
                    >
                      Criar Campo
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="email" className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Arraste para reordenar. Campos incluidos nos emails de notificacao de venda.
                </p>
                <Button size="sm" onClick={handleAddEmailField} className="gap-1.5" variant="outline">
                  <Plus className="w-3.5 h-3.5" /> Adicionar
                </Button>
              </div>

              <ReorderableList
                items={scopeEmailFields}
                onReorder={handleEmailFieldsReorder}
                keyExtractor={(_, idx) => idx}
                renderItem={(ef, idx, { onMoveUp, onMoveDown }) => (
                  <div
                    className="flex items-center gap-2 p-2 rounded-lg"
                    style={{ background: 'rgba(6, 182, 212, 0.03)', border: '1px solid rgba(6, 182, 212, 0.1)' }}
                  >
                    <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                      <button
                        onClick={onMoveUp}
                        disabled={!onMoveUp}
                        className="p-0.5 rounded transition-colors disabled:opacity-20"
                        style={{ color: 'rgba(6, 182, 212, 0.5)' }}
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={onMoveDown}
                        disabled={!onMoveDown}
                        className="p-0.5 rounded transition-colors disabled:opacity-20"
                        style={{ color: 'rgba(6, 182, 212, 0.5)' }}
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                    <Input
                      value={ef.field_key}
                      onChange={(e) => {
                        const updated = [...scopeEmailFields];
                        updated[idx] = { ...updated[idx], field_key: e.target.value };
                        setScopeEmailFields(updated);
                      }}
                      className="h-8 text-sm bg-dark-900 border-dark-700 text-white flex-1"
                      placeholder="field_key"
                    />
                    <Input
                      value={ef.label}
                      onChange={(e) => {
                        const updated = [...scopeEmailFields];
                        updated[idx] = { ...updated[idx], label: e.target.value };
                        setScopeEmailFields(updated);
                      }}
                      className="h-8 text-sm bg-dark-900 border-dark-700 text-white flex-1"
                      placeholder="Label do campo no email"
                    />
                    <button
                      onClick={() => handleRemoveEmailField(idx)}
                      className="p-1.5 rounded transition-colors"
                      style={{ color: 'rgba(239, 68, 68, 0.5)' }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              />

              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveEmailFields} size="sm" style={{ background: '#06b6d4', color: '#080c14' }}>
                  Guardar Campos de Email
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              {editScope && (
                <>
                  <div>
                    <Label className="text-xs text-slate-400">Nome de Exibicao</Label>
                    <Input
                      value={editScope.display_name}
                      onChange={(e) => setEditScope({ ...editScope, display_name: e.target.value })}
                      className="bg-dark-800 border-dark-700 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">Cor</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editScope.color}
                        onChange={(e) => setEditScope({ ...editScope, color: e.target.value })}
                        className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                      />
                      <Input
                        value={editScope.color}
                        onChange={(e) => setEditScope({ ...editScope, color: e.target.value })}
                        className="bg-dark-800 border-dark-700 text-white flex-1 h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">Icone</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {ICON_OPTIONS.map(icon => (
                        <button
                          key={icon}
                          onClick={() => setEditScope({ ...editScope, icon })}
                          className="px-2 py-1 text-xs rounded-md transition-all"
                          style={{
                            background: editScope.icon === icon ? 'rgba(6, 182, 212, 0.2)' : 'rgba(6, 182, 212, 0.05)',
                            border: `1px solid ${editScope.icon === icon ? 'rgba(6, 182, 212, 0.5)' : 'rgba(6, 182, 212, 0.1)'}`,
                            color: editScope.icon === icon ? '#06b6d4' : 'rgba(255,255,255,0.5)',
                          }}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-dark-700 pt-4">
                    <Label className="text-xs text-slate-400">Forma de Contabilizacao</Label>
                    <select
                      value={editScope.counting_mode || 'per_contract'}
                      onChange={(e) => setEditScope({ ...editScope, counting_mode: e.target.value, quantity_field: e.target.value === 'per_contract' ? '' : (editScope.quantity_field || '') })}
                      className="w-full h-9 text-sm bg-dark-800 border border-dark-700 text-white rounded-md px-3 mt-1"
                    >
                      <option value="per_contract">Por contrato (1 venda = 1 comissao)</option>
                      <option value="by_quantity">Por quantidade (comissao x quantidade de item)</option>
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Define como a comissao e calculada: por contrato (valor fixo por venda) ou por quantidade (valor da comissao multiplicado pelo campo de quantidade)
                    </p>
                  </div>
                  {(editScope.counting_mode || 'per_contract') === 'by_quantity' && (
                    <div>
                      <Label className="text-xs text-slate-400">Campo de Quantidade</Label>
                      {scopeFields.length > 0 ? (
                        <select
                          value={editScope.quantity_field || ''}
                          onChange={(e) => setEditScope({ ...editScope, quantity_field: e.target.value })}
                          className="w-full h-9 text-sm bg-dark-800 border border-dark-700 text-white rounded-md px-3 mt-1"
                        >
                          <option value="">Selecione um campo...</option>
                          {scopeFields.filter(f => f.field_type === 'number').map(f => (
                            <option key={f.field_key} value={f.field_key}>{f.label} ({f.field_key})</option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          value={editScope.quantity_field || ''}
                          onChange={(e) => setEditScope({ ...editScope, quantity_field: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                          className="bg-dark-800 border-dark-700 text-white mt-1"
                          placeholder="ex: ev_outlet_count"
                        />
                      )}
                      <p className="text-[10px] text-slate-500 mt-1">
                        Campo numerico cujo valor multiplica a comissao. Ex: "Quantidade de tomadas" = 2 tomadas, comissao = 2 x valor base
                      </p>
                    </div>
                  )}
                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={() => {
                        updateMutation.mutate({
                          id: editScope.id,
                          data: {
                            display_name: editScope.display_name,
                            color: editScope.color,
                            icon: editScope.icon,
                            counting_mode: editScope.counting_mode || 'per_contract',
                            quantity_field: editScope.quantity_field || null,
                          },
                        });
                      }}
                      size="sm"
                      style={{ background: '#06b6d4', color: '#080c14' }}
                    >
                      Guardar Definicoes
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Duplicate Scope Dialog */}
      <Dialog open={!!duplicateSource} onOpenChange={(open) => !open && setDuplicateSource(null)}>
        <DialogContent className="bg-dark-900 border-dark-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="w-5 h-5" style={{ color: duplicateSource?.color }} />
              Duplicar: {duplicateSource?.display_name}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-400">
            Todos os campos e definicoes de email do ambito original serao copiados. Pode ajustar depois.
          </p>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-slate-400">Nome do Novo Ambito *</Label>
              <Input
                value={duplicateData.display_name}
                onChange={(e) => {
                  const displayName = e.target.value;
                  const slug = displayName.toLowerCase()
                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-z0-9]+/g, '_')
                    .replace(/^_|_$/g, '');
                  setDuplicateData({ ...duplicateData, display_name: displayName, slug });
                }}
                className="bg-dark-800 border-dark-700 text-white"
                placeholder="ex: Energia Solar Pro"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Identificador (slug) *</Label>
              <Input
                value={duplicateData.slug}
                onChange={(e) => setDuplicateData({ ...duplicateData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                className="bg-dark-800 border-dark-700 text-white"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Icone</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {ICON_OPTIONS.map(icon => (
                  <button
                    key={icon}
                    onClick={() => setDuplicateData({ ...duplicateData, icon })}
                    className="px-2 py-1 text-xs rounded-md transition-all"
                    style={{
                      background: duplicateData.icon === icon ? 'rgba(6, 182, 212, 0.2)' : 'rgba(6, 182, 212, 0.05)',
                      border: `1px solid ${duplicateData.icon === icon ? 'rgba(6, 182, 212, 0.5)' : 'rgba(6, 182, 212, 0.1)'}`,
                      color: duplicateData.icon === icon ? '#06b6d4' : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-400">Cor</Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={duplicateData.color}
                  onChange={(e) => setDuplicateData({ ...duplicateData, color: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                />
                <Input
                  value={duplicateData.color}
                  onChange={(e) => setDuplicateData({ ...duplicateData, color: e.target.value })}
                  className="bg-dark-800 border-dark-700 text-white flex-1 h-8 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDuplicateSource(null)}>Cancelar</Button>
              <Button
                onClick={() => duplicateMutation.mutate({ sourceId: duplicateSource.id, data: duplicateData })}
                disabled={!duplicateData.slug || !duplicateData.display_name || duplicateMutation.isPending}
                style={{ background: '#06b6d4', color: '#080c14' }}
              >
                {duplicateMutation.isPending ? 'A duplicar...' : 'Duplicar Ambito'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
