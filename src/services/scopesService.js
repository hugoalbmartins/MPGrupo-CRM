import { supabase } from '../lib/supabase';

export const scopesService = {
  async getAll(activeOnly = true) {
    let query = supabase
      .from('scopes')
      .select('*')
      .order('sort_order', { ascending: true });

    if (activeOnly) {
      query = query.eq('active', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('scopes')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getBySlug(slug) {
    const { data, error } = await supabase
      .from('scopes')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async create(scopeData) {
    const { data, error } = await supabase
      .from('scopes')
      .insert({
        slug: scopeData.slug,
        display_name: scopeData.display_name,
        icon: scopeData.icon || 'circle',
        color: scopeData.color || '#06b6d4',
        sort_order: scopeData.sort_order || 0,
        is_system: false,
        active: true,
        counting_mode: scopeData.counting_mode || 'per_contract',
        quantity_field: scopeData.quantity_field || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id, scopeData) {
    const updateData = {};
    if (scopeData.display_name !== undefined) updateData.display_name = scopeData.display_name;
    if (scopeData.icon !== undefined) updateData.icon = scopeData.icon;
    if (scopeData.color !== undefined) updateData.color = scopeData.color;
    if (scopeData.sort_order !== undefined) updateData.sort_order = scopeData.sort_order;
    if (scopeData.active !== undefined) updateData.active = scopeData.active;
    if (scopeData.slug !== undefined) updateData.slug = scopeData.slug;
    if (scopeData.counting_mode !== undefined) updateData.counting_mode = scopeData.counting_mode;
    if (scopeData.quantity_field !== undefined) updateData.quantity_field = scopeData.quantity_field;

    const { data, error } = await supabase
      .from('scopes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { data: scope } = await supabase
      .from('scopes')
      .select('is_system, slug')
      .eq('id', id)
      .maybeSingle();

    if (scope?.is_system) {
      throw new Error('Nao e possivel eliminar ambitos de sistema');
    }

    const { data: operators } = await supabase
      .from('operators')
      .select('id')
      .eq('scope', scope.slug)
      .limit(1);

    if (operators && operators.length > 0) {
      throw new Error('Nao e possivel eliminar ambito com operadoras associadas');
    }

    const { error } = await supabase
      .from('scopes')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async getFields(scopeId, activeOnly = true) {
    let query = supabase
      .from('scope_fields')
      .select('*')
      .eq('scope_id', scopeId)
      .order('sort_order', { ascending: true });

    if (activeOnly) {
      query = query.eq('active', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getFieldsByScopeSlug(slug, activeOnly = true) {
    const scope = await this.getBySlug(slug);
    if (!scope) return [];
    return this.getFields(scope.id, activeOnly);
  },

  async createField(fieldData) {
    const { data, error } = await supabase
      .from('scope_fields')
      .insert({
        scope_id: fieldData.scope_id,
        field_key: fieldData.field_key,
        label: fieldData.label,
        field_type: fieldData.field_type || 'text',
        is_required: fieldData.is_required || false,
        placeholder: fieldData.placeholder || '',
        validation_rules: fieldData.validation_rules || {},
        options: fieldData.options || [],
        sort_order: fieldData.sort_order || 0,
        section: fieldData.section || 'general',
        depends_on: fieldData.depends_on || null,
        dependency_mode: fieldData.dependency_mode || null,
        repeat_group: fieldData.repeat_group || null,
        is_system: false,
        maps_to_column: fieldData.maps_to_column || null,
        active: true,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateField(id, fieldData) {
    const updateData = {};
    if (fieldData.label !== undefined) updateData.label = fieldData.label;
    if (fieldData.field_type !== undefined) updateData.field_type = fieldData.field_type;
    if (fieldData.is_required !== undefined) updateData.is_required = fieldData.is_required;
    if (fieldData.placeholder !== undefined) updateData.placeholder = fieldData.placeholder;
    if (fieldData.validation_rules !== undefined) updateData.validation_rules = fieldData.validation_rules;
    if (fieldData.options !== undefined) updateData.options = fieldData.options;
    if (fieldData.sort_order !== undefined) updateData.sort_order = fieldData.sort_order;
    if (fieldData.section !== undefined) updateData.section = fieldData.section;
    if (fieldData.depends_on !== undefined) updateData.depends_on = fieldData.depends_on;
    if (fieldData.active !== undefined) updateData.active = fieldData.active;
    if (fieldData.field_key !== undefined) updateData.field_key = fieldData.field_key;
    if (fieldData.maps_to_column !== undefined) updateData.maps_to_column = fieldData.maps_to_column;
    if (fieldData.dependency_mode !== undefined) updateData.dependency_mode = fieldData.dependency_mode;
    if (fieldData.repeat_group !== undefined) updateData.repeat_group = fieldData.repeat_group;

    const { data, error } = await supabase
      .from('scope_fields')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteField(id) {
    const { data: field } = await supabase
      .from('scope_fields')
      .select('is_system')
      .eq('id', id)
      .maybeSingle();

    if (field?.is_system) {
      throw new Error('Nao e possivel eliminar campos de sistema');
    }

    const { error } = await supabase
      .from('scope_fields')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async saveFieldsOrder(fields) {
    const updates = fields.map((f, idx) =>
      supabase
        .from('scope_fields')
        .update({ sort_order: idx })
        .eq('id', f.id)
    );
    await Promise.all(updates);
  },

  async getEmailFields(scopeId) {
    const { data, error } = await supabase
      .from('scope_email_fields')
      .select('*')
      .eq('scope_id', scopeId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async duplicate(sourceScopeId, { slug, display_name, icon, color }) {
    const sourceScope = await this.getById(sourceScopeId);
    if (!sourceScope) throw new Error('Ambito de origem nao encontrado');

    const { data: newScope, error: scopeError } = await supabase
      .from('scopes')
      .insert({
        slug,
        display_name,
        icon: icon || sourceScope.icon,
        color: color || sourceScope.color,
        sort_order: sourceScope.sort_order + 1,
        is_system: false,
        active: true,
      })
      .select()
      .single();

    if (scopeError) throw scopeError;

    const sourceFields = await this.getFields(sourceScopeId, false);
    if (sourceFields.length > 0) {
      const fieldRows = sourceFields.map(f => ({
        scope_id: newScope.id,
        field_key: f.field_key,
        label: f.label,
        field_type: f.field_type,
        is_required: f.is_required,
        placeholder: f.placeholder,
        validation_rules: f.validation_rules,
        options: f.options,
        sort_order: f.sort_order,
        section: f.section,
        depends_on: f.depends_on,
        dependency_mode: f.dependency_mode,
        repeat_group: f.repeat_group,
        is_system: false,
        maps_to_column: f.maps_to_column,
        active: f.active,
      }));

      const { error: fieldsError } = await supabase
        .from('scope_fields')
        .insert(fieldRows);

      if (fieldsError) throw fieldsError;
    }

    const sourceEmailFields = await this.getEmailFields(sourceScopeId);
    if (sourceEmailFields.length > 0) {
      const emailRows = sourceEmailFields.map(ef => ({
        scope_id: newScope.id,
        field_key: ef.field_key,
        label: ef.label,
        sort_order: ef.sort_order,
      }));

      const { error: emailError } = await supabase
        .from('scope_email_fields')
        .insert(emailRows);

      if (emailError) throw emailError;
    }

    return newScope;
  },

  async saveEmailFields(scopeId, emailFields) {
    await supabase
      .from('scope_email_fields')
      .delete()
      .eq('scope_id', scopeId);

    if (!emailFields || emailFields.length === 0) return [];

    const rows = emailFields.map((ef, idx) => ({
      scope_id: scopeId,
      field_key: ef.field_key,
      label: ef.label,
      sort_order: idx,
    }));

    const { data, error } = await supabase
      .from('scope_email_fields')
      .insert(rows)
      .select();

    if (error) throw error;
    return data;
  },
};
