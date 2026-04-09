import { supabase } from '../lib/supabase';

export const partnerTypesService = {
  async getAll(activeOnly = true) {
    let query = supabase
      .from('partner_types')
      .select('*')
      .order('created_at', { ascending: true });

    if (activeOnly) {
      query = query.eq('active', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('partner_types')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getBySlug(slug) {
    const { data, error } = await supabase
      .from('partner_types')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async create(typeData) {
    const { data, error } = await supabase
      .from('partner_types')
      .insert({
        slug: typeData.slug,
        display_name: typeData.display_name,
        code_prefix: typeData.code_prefix,
        has_levels: typeData.has_levels || false,
        level_type: typeData.level_type || 'named',
        max_levels: typeData.max_levels || 5,
        default_level_names: typeData.default_level_names || [],
        is_system: false,
        active: true,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id, typeData) {
    const updateData = {};
    if (typeData.display_name !== undefined) updateData.display_name = typeData.display_name;
    if (typeData.code_prefix !== undefined) updateData.code_prefix = typeData.code_prefix;
    if (typeData.has_levels !== undefined) updateData.has_levels = typeData.has_levels;
    if (typeData.level_type !== undefined) updateData.level_type = typeData.level_type;
    if (typeData.max_levels !== undefined) updateData.max_levels = typeData.max_levels;
    if (typeData.default_level_names !== undefined) updateData.default_level_names = typeData.default_level_names;
    if (typeData.active !== undefined) updateData.active = typeData.active;
    if (typeData.slug !== undefined) updateData.slug = typeData.slug;

    const { data, error } = await supabase
      .from('partner_types')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { data: pType } = await supabase
      .from('partner_types')
      .select('is_system, slug')
      .eq('id', id)
      .maybeSingle();

    if (pType?.is_system) {
      throw new Error('Nao e possivel eliminar tipos de parceiro de sistema');
    }

    const { data: partners } = await supabase
      .from('partners')
      .select('id')
      .eq('partner_type', pType.slug)
      .limit(1);

    if (partners && partners.length > 0) {
      throw new Error('Nao e possivel eliminar tipo de parceiro com parceiros associados');
    }

    const { error } = await supabase
      .from('partner_types')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  getLevelNames(partnerType) {
    if (!partnerType?.has_levels) return [];
    const names = partnerType.default_level_names || [];
    if (names.length > 0) return names;
    if (partnerType.level_type === 'numeric') {
      return Array.from({ length: partnerType.max_levels }, (_, i) => String(i + 1));
    }
    return Array.from({ length: partnerType.max_levels }, (_, i) => `Nv${i + 1}`);
  },
};
