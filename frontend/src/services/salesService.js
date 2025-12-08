import { supabase } from '../lib/supabase';
import { generateSaleCode, calculateCommission, validateCPE, validateCUI } from '../lib/utils-crm';

export const salesService = {
  async getAll(statusFilter = null) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: currentUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    let query = supabase
      .from('sales')
      .select('*')
      .order('sale_date', { ascending: false });

    if (currentUser.role === 'partner') {
      const { data: partner } = await supabase
        .from('partners')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (partner) {
        query = query.eq('partner_id', partner.id);
      }
    } else if (currentUser.role === 'partner_commercial') {
      query = query.eq('created_by_user_id', user.id);
    }

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async create(saleData) {
    const saleDate = new Date(saleData.date);
    if (saleDate > new Date()) {
      throw new Error('Cannot create sales with future dates');
    }

    if (saleData.cpe && !validateCPE(saleData.cpe)) {
      throw new Error('CPE invalid format');
    }
    if (saleData.cui && !validateCUI(saleData.cui)) {
      throw new Error('CUI invalid format');
    }

    const saleCode = await generateSaleCode(saleData.partner_id, saleData.date, supabase);

    const { data: { user } } = await supabase.auth.getUser();
    const { data: currentUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const status = ['partner', 'partner_commercial'].includes(currentUser.role)
      ? 'Para registo'
      : 'Pendente';

    const { data: operator } = await supabase
      .from('operators')
      .select('*')
      .eq('id', saleData.operator_id)
      .single();

    if (!operator) throw new Error('Operator not found');

    const commission = await calculateCommission(operator, {
      ...saleData,
      partner_id: saleData.partner_id
    }, supabase);

    const { data: partner } = await supabase
      .from('partners')
      .select('name')
      .eq('id', saleData.partner_id)
      .single();

    const insertData = {
      sale_code: saleCode,
      sale_date: saleData.date,
      partner_id: saleData.partner_id,
      partner_name: partner?.name || 'Unknown',
      created_by_user_id: user.id,
      scope: saleData.scope,
      customer_type: saleData.customer_type,
      customer_name: saleData.customer_name,
      nif: saleData.nif,
      contact: saleData.contact,
      operator_id: saleData.operator_id,
      operator_name: operator.name,
      status,
      request_number: saleData.request_number || null,
      monthly_value: saleData.monthly_value || null,
      commission_value: saleData.commission_value || null,
      calculated_commission: commission,
      cpe: saleData.cpe?.toUpperCase() || null,
      cui: saleData.cui?.toUpperCase() || null,
      street: saleData.street || null,
      door_number: saleData.door_number || null,
      postal_code: saleData.postal_code || null,
      locality: saleData.locality || null,
      province: saleData.province || null
    };

    const { data, error } = await supabase
      .from('sales')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    await this.createAlert('new_sale', data.id, data.sale_code,
      `Nova venda registada: ${data.sale_code} - ${partner?.name || 'Unknown'}`);

    return data;
  },

  async update(id, updateData) {
    const { data: oldSale } = await supabase
      .from('sales')
      .select('status')
      .eq('id', id)
      .single();

    const updates = {};
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== null && updateData[key] !== undefined) {
        updates[key] = updateData[key];
      }
    });

    const { data, error } = await supabase
      .from('sales')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (updateData.status && oldSale.status !== updateData.status) {
      if (['Concluido', 'Ativo'].includes(updateData.status)) {
        await this.createAlert('status_change', data.id, data.sale_code,
          `Status alterado para ${updateData.status}: ${data.sale_code}`);
      }
    }

    return data;
  },

  async addNote(saleId, content) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: currentUser } = await supabase
      .from('users')
      .select('name, role')
      .eq('id', user.id)
      .single();

    const { data: sale } = await supabase
      .from('sales')
      .select('notes, sale_code')
      .eq('id', saleId)
      .single();

    const note = {
      id: crypto.randomUUID(),
      content,
      author: currentUser.name,
      author_role: currentUser.role,
      created_at: new Date().toISOString()
    };

    const newNotes = [...(sale.notes || []), note];

    const { data, error } = await supabase
      .from('sales')
      .update({ notes: newNotes })
      .eq('id', saleId)
      .select()
      .single();

    if (error) throw error;

    await this.createAlert('note_added', saleId, sale.sale_code,
      `Nova nota adicionada em ${sale.sale_code} por ${currentUser.name}`);

    return note;
  },

  async createAlert(type, saleId, saleCode, message) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: currentUser } = await supabase
      .from('users')
      .select('name')
      .eq('id', user.id)
      .single();

    const { data: sale } = await supabase
      .from('sales')
      .select('partner_id, created_by_user_id')
      .eq('id', saleId)
      .single();

    const userIds = [];

    const { data: partner } = await supabase
      .from('partners')
      .select('user_id')
      .eq('id', sale.partner_id)
      .single();

    if (partner?.user_id) userIds.push(partner.user_id);
    if (sale.created_by_user_id) userIds.push(sale.created_by_user_id);

    const { data: adminUsers } = await supabase
      .from('users')
      .select('id')
      .in('role', ['admin', 'bo']);

    if (adminUsers) {
      userIds.push(...adminUsers.map(u => u.id));
    }

    const uniqueUserIds = [...new Set(userIds)].filter(id => id !== user.id);

    await supabase.from('alerts').insert({
      type,
      sale_id: saleId,
      sale_code: saleCode,
      message,
      user_ids: uniqueUserIds,
      created_by: user.id,
      created_by_name: currentUser.name
    });
  }
};
