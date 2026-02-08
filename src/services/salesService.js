import { supabase } from '../lib/supabase';
import { generateSaleCode, calculateCommission, validateCPE, validateCUI } from '../lib/utils-crm';

export const salesService = {
  async getAll(statusFilter = null, includeOperator = false) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: currentUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (!currentUser) throw new Error('User not found');

    const selectFields = includeOperator
      ? '*, operator:operators!sales_operator_id_fkey(id, name)'
      : '*';

    let query = supabase
      .from('sales')
      .select(selectFields)
      .order('date', { ascending: false });

    if (currentUser.role === 'partner') {
      const { data: partner } = await supabase
        .from('partners')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

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
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Sale not found');
    return data;
  },

  async checkWarningsAndCreateSale(saleData, files = []) {
    const saleDate = new Date(saleData.date);
    if (saleDate > new Date()) {
      throw new Error('Cannot create sales with future dates');
    }

    const warnings = [];

    if (saleData.cpe && !validateCPE(saleData.cpe)) {
      warnings.push('CPE com formato inválido (esperado: PT seguido de 13 dígitos)');
    }
    if (saleData.cui && !validateCUI(saleData.cui)) {
      warnings.push('CUI com formato inválido (esperado: PT seguido de 16 dígitos)');
    }

    if (saleData.scope === 'telecomunicacoes' && saleData.requisition) {
      const { data: duplicateCheck } = await supabase
        .rpc('check_duplicate_requisition', {
          p_requisition: saleData.requisition,
          p_scope: 'telecomunicacoes',
          p_sale_id: null
        });

      if (duplicateCheck) {
        throw new Error('REQ_DUPLICATE|Número de requisição já existe no sistema');
      }
    }

    if (warnings.length > 0) {
      return { warnings };
    }

    return await this.create(saleData, files);
  },

  async uploadAttachments(saleId, files) {
    if (!files || files.length === 0) return [];

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const attachments = [];

    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const timestamp = Date.now();
      const randomId = crypto.randomUUID();
      const fileName = `${saleId}_${timestamp}_${randomId}.${fileExt}`;
      const filePath = `${saleId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('sales-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        continue;
      }

      attachments.push({
        id: randomId,
        filename: file.name,
        path: filePath,
        uploaded_at: new Date().toISOString(),
        uploaded_by: user.id
      });
    }

    return attachments;
  },

  async findPartnerByNameOrCode(nameOrCode) {
    const searchTerm = nameOrCode.trim();

    const { data: byCode } = await supabase
      .from('partners')
      .select('id, name, partner_code')
      .ilike('partner_code', searchTerm);

    if (byCode && byCode.length > 0) {
      return byCode[0];
    }

    const { data: byExactName } = await supabase
      .from('partners')
      .select('id, name, partner_code')
      .ilike('name', searchTerm);

    if (byExactName && byExactName.length > 0) {
      return byExactName[0];
    }

    const { data: byPartialName, error } = await supabase
      .from('partners')
      .select('id, name, partner_code')
      .ilike('name', `%${searchTerm}%`);

    if (error) throw error;

    if (!byPartialName || byPartialName.length === 0) {
      return null;
    }

    return byPartialName[0];
  },

  async findOperatorByName(name) {
    const searchTerm = name.trim();

    const { data: byExactName } = await supabase
      .from('operators')
      .select('id, name')
      .ilike('name', searchTerm);

    if (byExactName && byExactName.length > 0) {
      return byExactName[0];
    }

    const { data: byPartialName, error } = await supabase
      .from('operators')
      .select('id, name')
      .ilike('name', `%${searchTerm}%`);

    if (error) throw error;

    if (!byPartialName || byPartialName.length === 0) {
      return null;
    }

    return byPartialName[0];
  },

  async createSale(saleData, files = []) {
    let partnerId = saleData.partner_id;
    let operatorId = saleData.operator_id;

    if (partnerId && typeof partnerId === 'string' && isNaN(partnerId)) {
      const partner = await this.findPartnerByNameOrCode(partnerId);
      if (!partner) {
        const { data: unknownPartner } = await supabase
          .from('partners')
          .select('id')
          .eq('partner_code', 'DESCONHECIDO')
          .maybeSingle();

        if (!unknownPartner) {
          throw new Error(`Parceiro não encontrado: ${partnerId}`);
        }
        partnerId = unknownPartner.id;
      } else {
        partnerId = partner.id;
      }
    }

    if (operatorId && typeof operatorId === 'string' && isNaN(operatorId)) {
      const operator = await this.findOperatorByName(operatorId);
      if (!operator) {
        throw new Error(`Operadora não encontrada: ${operatorId}`);
      }
      operatorId = operator.id;
    }

    return await this.create({
      ...saleData,
      partner_id: partnerId,
      operator_id: operatorId
    }, files);
  },

  async create(saleData, files = []) {
    const saleDate = new Date(saleData.date);
    if (saleDate > new Date()) {
      throw new Error('Cannot create sales with future dates');
    }

    if (saleData.scope === 'telecomunicacoes' && saleData.requisition) {
      const { data: duplicateCheck } = await supabase
        .rpc('check_duplicate_requisition', {
          p_requisition: saleData.requisition,
          p_scope: 'telecomunicacoes',
          p_sale_id: null
        });

      if (duplicateCheck) {
        throw new Error('REQ_DUPLICATE|Número de requisição já existe no sistema');
      }
    }

    const { data: { user } } = await supabase.auth.getUser();
    const { data: currentUser } = await supabase
      .from('users')
      .select('role, is_commissioned, name')
      .eq('id', user.id)
      .maybeSingle();

    if (!currentUser) throw new Error('User not found');

    const isAdminSale = saleData.partner_id === '__admin__';
    if (isAdminSale && currentUser.role !== 'admin') {
      throw new Error('Only admins can create own sales');
    }
    if (isAdminSale && !currentUser.is_commissioned) {
      throw new Error('Only commissioned admins can create own sales');
    }

    const actualPartnerId = isAdminSale ? null : (saleData.partner_id || null);

    let saleCode;
    let retries = 0;
    const maxRetries = 5;

    while (retries < maxRetries) {
      saleCode = await generateSaleCode(actualPartnerId, saleData.date, supabase);
      const { data: existing } = await supabase
        .from('sales')
        .select('id')
        .eq('sale_code', saleCode)
        .maybeSingle();

      if (!existing) break;

      retries++;
      if (retries >= maxRetries) {
        throw new Error('Failed to generate unique sale code after multiple attempts');
      }

      await new Promise(resolve => setTimeout(resolve, 100 * retries));
    }

    let status;
    if (saleData.is_proposal) {
      status = 'Em proposta';
    } else if (['partner', 'partner_commercial'].includes(currentUser.role)) {
      status = 'Para registo';
    } else {
      status = 'Pendente';
    }

    const { data: operator } = await supabase
      .from('operators')
      .select('*')
      .eq('id', saleData.operator_id)
      .maybeSingle();

    if (!operator) throw new Error('Operator not found');

    const commission = await calculateCommission(operator, {
      ...saleData,
      partner_id: actualPartnerId,
      isAdminSale,
      isCommissioned: currentUser.is_commissioned
    }, supabase);

    let partnerName = 'Unknown';
    if (isAdminSale) {
      partnerName = currentUser.name + ' (Admin)';
    } else if (actualPartnerId) {
      const { data: partner } = await supabase
        .from('partners')
        .select('name')
        .eq('id', actualPartnerId)
        .maybeSingle();
      partnerName = partner?.name || 'Unknown';
    }

    const insertData = {
      sale_code: saleCode,
      date: saleData.date,
      partner_id: actualPartnerId,
      partner_name: partnerName,
      created_by_user_id: user.id,
      scope: saleData.scope,
      client_type: saleData.client_type,
      client_name: saleData.client_name,
      client_nif: saleData.client_nif,
      client_contact: saleData.client_contact,
      client_email: saleData.client_email || null,
      client_iban: saleData.client_iban || null,
      installation_address: saleData.installation_address || null,
      operator_id: saleData.operator_id,
      operator_name: operator.name,
      status,
      service_type: saleData.service_type || null,
      activation_type: saleData.activation_type || null,
      monthly_value: saleData.monthly_value || null,
      current_monthly_fee: saleData.current_monthly_fee || null,
      contracted_monthly_fee: saleData.contracted_monthly_fee || null,
      energy_sale_type: saleData.energy_sale_type || null,
      cpe: saleData.cpe?.toUpperCase() || null,
      power: saleData.power || null,
      entry_type: saleData.entry_type || null,
      cui: saleData.cui?.toUpperCase() || null,
      tier: saleData.tier || null,
      observations: saleData.observations || null,
      calculated_commission: commission,
      attachments: []
    };

    const { data, error } = await supabase
      .from('sales')
      .insert(insertData)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Sale created but not returned from database');

    if (files && files.length > 0) {
      const attachments = await this.uploadAttachments(data.id, files);

      if (attachments.length > 0) {
        const { error: updateError } = await supabase
          .from('sales')
          .update({ attachments })
          .eq('id', data.id);

        if (updateError) {
          console.error('Error updating sale with attachments:', updateError);
        } else {
          data.attachments = attachments;
        }
      }
    }

    return data;
  },

  async update(id, updateData) {
    const { data: oldSale } = await supabase
      .from('sales')
      .select('status')
      .eq('id', id)
      .maybeSingle();

    if (!oldSale) throw new Error('Sale not found');

    const PROTECTED_ADDRESS_FIELDS = ['street', 'postal_code', 'locality', 'installation_address'];

    const updates = {};
    Object.keys(updateData).forEach(key => {
      if (PROTECTED_ADDRESS_FIELDS.includes(key)) {
        return;
      }

      if (key === 'partner_id') {
        updates[key] = updateData[key] === null || updateData[key] === '' || updateData[key] === 'admin_commissioned' ? null : updateData[key];
      } else if (updateData[key] !== null && updateData[key] !== undefined && updateData[key] !== '') {
        if (key === 'manual_commission') {
          updates[key] = parseFloat(updateData[key]) || null;
        } else {
          updates[key] = updateData[key];
        }
      }
    });

    const { data, error } = await supabase
      .from('sales')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Sale update failed');

    return data;
  },

  async addNote(saleId, content, attachments = []) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: currentUser } = await supabase
      .from('users')
      .select('name, role')
      .eq('id', user.id)
      .maybeSingle();

    if (!currentUser) throw new Error('User not found');

    const { data: sale } = await supabase
      .from('sales')
      .select('notes, sale_code')
      .eq('id', saleId)
      .maybeSingle();

    if (!sale) throw new Error('Sale not found');

    const note = {
      id: crypto.randomUUID(),
      content,
      author: currentUser.name,
      author_role: currentUser.role,
      created_at: new Date().toISOString(),
      attachments: attachments || []
    };

    const newNotes = [...(sale.notes || []), note];

    const { data, error } = await supabase
      .from('sales')
      .update({ notes: newNotes })
      .eq('id', saleId)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Failed to add note to sale');

    return note;
  },

  async getAuditLogs(saleId) {
    const { data, error } = await supabase
      .from('sales_audit_log')
      .select('*')
      .eq('sale_id', saleId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async checkDuplicateRequisition(requisition, scope, saleId = null) {
    if (scope !== 'telecomunicacoes' || !requisition) {
      return false;
    }

    const { data, error } = await supabase
      .rpc('check_duplicate_requisition', {
        p_requisition: requisition,
        p_scope: scope,
        p_sale_id: saleId
      });

    if (error) throw error;
    return data || false;
  },

  async validateCPECUI(cpe, cui) {
    const warnings = [];

    if (cpe) {
      const { data: isValidCPE } = await supabase
        .rpc('validate_cpe', { cpe_value: cpe });

      if (!isValidCPE) {
        warnings.push('CPE com formato inválido (esperado: PT seguido de 13 dígitos)');
      }
    }

    if (cui) {
      const { data: isValidCUI } = await supabase
        .rpc('validate_cui', { cui_value: cui });

      if (!isValidCUI) {
        warnings.push('CUI com formato inválido (esperado: PT seguido de 16 dígitos)');
      }
    }

    return warnings;
  },

  async uploadOperatorValidation(saleId, file) {
    if (!file) throw new Error('No file provided');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const fileExt = file.name.split('.').pop();
    const fileName = `${saleId}_${Date.now()}.${fileExt}`;
    const filePath = `${saleId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('operator-validations')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { error: updateError } = await supabase
      .from('sales')
      .update({
        operator_doc_file: filePath,
        operator_doc_uploaded_at: new Date().toISOString(),
        operator_doc_uploaded_by: user.id,
        operator_validated: true,
        operator_validation_date: new Date().toISOString()
      })
      .eq('id', saleId);

    if (updateError) {
      await supabase.storage
        .from('operator-validations')
        .remove([filePath]);
      throw updateError;
    }

    return { filePath };
  },

  async downloadOperatorValidation(filePath) {
    if (!filePath) throw new Error('No file path provided');

    const { data, error } = await supabase.storage
      .from('operator-validations')
      .download(filePath);

    if (error) throw error;

    const url = window.URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = filePath.split('/').pop();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    return data;
  },

  async delete(id) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: currentUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!currentUser || currentUser.role !== 'admin') {
      throw new Error('Only administrators can delete sales');
    }

    const { data: sale } = await supabase
      .from('sales')
      .select('operator_doc_file')
      .eq('id', id)
      .maybeSingle();

    if (!sale) throw new Error('Sale not found');

    if (sale.operator_doc_file) {
      await supabase.storage
        .from('operator-validations')
        .remove([sale.operator_doc_file]);
    }

    const { error } = await supabase
      .from('sales')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return { success: true };
  }
};
