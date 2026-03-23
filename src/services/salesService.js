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
      .order('created_at', { ascending: false });

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
        size: file.size,
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

    const actualPartnerId = saleData.partner_id || null;

    let saleCode;
    const multipointIndex = saleData._multipoint_index || null;
    const multipointBaseCode = saleData._multipoint_base_code || null;

    if (multipointIndex && multipointBaseCode) {
      saleCode = `${multipointBaseCode}_${multipointIndex}`;
      const { data: existing } = await supabase
        .from('sales')
        .select('id')
        .eq('sale_code', saleCode)
        .maybeSingle();
      if (existing) {
        saleCode = `${multipointBaseCode}_${multipointIndex}_${Date.now()}`;
      }
    } else if (multipointIndex === 1 || multipointIndex === null) {
      let retries = 0;
      const maxRetries = 5;

      while (retries < maxRetries) {
        const baseCode = await generateSaleCode(actualPartnerId, saleData.date, supabase);
        const codeToCheck = multipointIndex ? `${baseCode}_1` : baseCode;
        const { data: existing } = await supabase
          .from('sales')
          .select('id')
          .eq('sale_code', codeToCheck)
          .maybeSingle();

        if (!existing) {
          saleCode = codeToCheck;
          break;
        }

        retries++;
        if (retries >= maxRetries) {
          throw new Error('Failed to generate unique sale code after multiple attempts');
        }

        await new Promise(resolve => setTimeout(resolve, 100 * retries));
      }
    } else {
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
    }

    let status;
    if (saleData.is_proposal) {
      status = 'Em proposta';
    } else {
      status = 'Para registo';
    }

    const { data: operator } = await supabase
      .from('operators')
      .select('*')
      .eq('id', saleData.operator_id)
      .maybeSingle();

    if (!operator) throw new Error('Operator not found');

    const commission = await calculateCommission(operator, {
      ...saleData,
      partner_id: actualPartnerId
    }, supabase);

    let partnerName = 'Unknown';
    if (actualPartnerId) {
      const { data: partner } = await supabase
        .from('partners')
        .select('name')
        .eq('id', actualPartnerId)
        .maybeSingle();
      partnerName = partner?.name || 'Unknown';
    }

    const saleId = crypto.randomUUID();

    let attachments = [];
    if (files && files.length > 0) {
      attachments = await this.uploadAttachments(saleId, files);
    }

    const insertData = {
      id: saleId,
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
      street: saleData.street || null,
      postal_code: saleData.postal_code || null,
      locality: saleData.locality || null,
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
      autoriza_documentos: saleData.autoriza_documentos || null,
      voltage_type: saleData.voltage_type || null,
      additional_services: saleData.additional_services || null,
      has_direct_debit: saleData.has_direct_debit || false,
      has_electronic_invoice: saleData.has_electronic_invoice || false,
      has_tv: saleData.has_tv || false,
      has_net: saleData.has_net || false,
      has_lr: saleData.has_lr || false,
      fix_ported: saleData.fix_ported || false,
      fix_number: saleData.fix_ported ? (saleData.fix_number || null) : null,
      fix_operator: saleData.fix_ported ? (saleData.fix_operator || null) : null,
      fix_cvp: saleData.fix_ported ? (saleData.fix_cvp || null) : null,
      mobile_count: (saleData.activation_type === 'M4' || saleData.activation_type === 'Movel') ? (parseInt(saleData.mobile_count) || 0) : 0,
      mobile_numbers: (saleData.activation_type === 'M4' || saleData.activation_type === 'Movel') ? (saleData.mobile_numbers || []) : [],
      tratar_oop: saleData.scope === 'telecomunicacoes' ? (saleData.tratar_oop || false) : false,
      calculated_commission: commission,
      attachments,
      is_bulk_import: saleData.is_bulk_import === true,
      sale_type: saleData.sale_type || 'normal',
      parent_sale_id: saleData.parent_sale_id || null,
      billing_address: saleData.billing_address || null,
      ev_outlet_count: saleData.ev_outlet_count ? parseInt(saleData.ev_outlet_count) : null,
      ev_monthly_fee: saleData.ev_monthly_fee ? parseFloat(saleData.ev_monthly_fee) : null,
      ev_margin: saleData.ev_margin ? parseFloat(saleData.ev_margin) : null,
      ev_fidelization_months: saleData.ev_fidelization_months ? parseInt(saleData.ev_fidelization_months) : null,
    };

    const { data, error } = await supabase
      .from('sales')
      .insert(insertData)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Sale created but not returned from database');

    return data;
  },

  async update(id, updateData) {
    const { data: oldSale } = await supabase
      .from('sales')
      .select('status')
      .eq('id', id)
      .maybeSingle();

    if (!oldSale) throw new Error('Sale not found');

    const ADDRESS_FIELDS = ['street', 'postal_code', 'locality', 'installation_address', 'billing_address'];
    const BOOLEAN_FIELDS = ['paid_to_operator', 'has_direct_debit', 'has_electronic_invoice', 'has_tv', 'has_net', 'has_lr', 'fix_ported', 'is_gestor_own_sale', 'operator_validated', 'electricity_paid', 'gas_paid', 'is_partial_payment', 'retention_paid', 'is_multibanco', 'is_multipoint', 'tratar_oop'];
    const OPTIONAL_FIELDS_WITH_CONSTRAINTS = ['energy_sale_type', 'refid_type', 'activation_type', 'service_type', 'power', 'entry_type', 'tier', 'cui', 'cpe', 'fix_number', 'fix_operator', 'fix_cvp', 'activated_at', 'refidelizacao_prazo', 'refidelizacao_unidade', 'ev_outlet_count', 'ev_monthly_fee', 'ev_margin', 'ev_fidelization_months', 'voltage_type', 'additional_services'];

    const updates = {};
    Object.keys(updateData).forEach(key => {
      const value = updateData[key];

      if (ADDRESS_FIELDS.includes(key)) {
        updates[key] = value === '' ? null : (value || null);
        return;
      }

      if (key === 'partner_id') {
        updates[key] = value === null || value === '' || value === 'admin_commissioned' ? null : value;
      } else if (BOOLEAN_FIELDS.includes(key)) {
        updates[key] = Boolean(value);
      } else if (key === 'mobile_count') {
        updates[key] = parseInt(value) || 0;
      } else if (key === 'mobile_numbers') {
        updates[key] = Array.isArray(value) ? value : [];
      } else if (key === 'manual_commission') {
        updates[key] = value === '' || value === null || value === undefined ? null : parseFloat(value);
      } else if (OPTIONAL_FIELDS_WITH_CONSTRAINTS.includes(key)) {
        updates[key] = value === '' || value === null || value === undefined ? null : value;
      } else if (value !== null && value !== undefined && value !== '') {
        updates[key] = value;
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
      .select('operator_doc_file, attachments')
      .eq('id', id)
      .maybeSingle();

    if (!sale) throw new Error('Sale not found');

    if (sale.operator_doc_file) {
      await supabase.storage
        .from('operator-validations')
        .remove([sale.operator_doc_file]);
    }

    if (Array.isArray(sale.attachments) && sale.attachments.length > 0) {
      const paths = sale.attachments
        .map(a => a.path)
        .filter(Boolean);
      if (paths.length > 0) {
        await supabase.storage
          .from('sales-documents')
          .remove(paths);
      }
    }

    const { error } = await supabase
      .from('sales')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return { success: true };
  },

  async resendNewSaleEmail(saleId, overridePayload = {}) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: currentUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!currentUser || !['admin', 'bo'].includes(currentUser.role)) {
      throw new Error('Only administrators and backoffice can resend emails');
    }

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select(`
        *,
        partner:partners!sales_partner_id_fkey(id, name, user_id, partner_type),
        operator:operators!sales_operator_id_fkey(id, name, notification_emails, notification_user_ids, email_fields, email_envio, email_envio_password, requires_additional_services)
      `)
      .eq('id', saleId)
      .maybeSingle();

    if (saleError || !sale) throw new Error('Sale not found');

    const effectiveSaleType = overridePayload.sale_type || sale.sale_type || 'normal';
    const isMultiSale = effectiveSaleType === 'multiponto' || effectiveSaleType === 'multilocal';
    const parentSaleIdForPoints = sale.parent_sale_id || saleId;

    let parentSale = sale;
    if (isMultiSale && sale.parent_sale_id) {
      const { data: pSale } = await supabase
        .from('sales')
        .select(`
          *,
          partner:partners!sales_partner_id_fkey(id, name, user_id, partner_type),
          operator:operators!sales_operator_id_fkey(id, name, notification_emails, notification_user_ids, email_fields, email_envio, email_envio_password, requires_additional_services)
        `)
        .eq('id', sale.parent_sale_id)
        .maybeSingle();
      if (pSale) parentSale = pSale;
    }

    const { data: attachmentsData } = await supabase
      .from('sales')
      .select('attachments')
      .eq('id', parentSaleIdForPoints)
      .maybeSingle();

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const fromEmail = parentSale.operator?.email_envio ? `${parentSale.operator.email_envio}@mpgrupo.pt` : null;
    const fromSmtpPass = (parentSale.operator?.email_envio && parentSale.operator?.email_envio_password)
      ? parentSale.operator.email_envio_password
      : null;

    let energyPointsList = overridePayload.energy_points_list || null;

    if (isMultiSale && !energyPointsList) {
      const { data: points } = await supabase
        .from('sales_energy_points')
        .select('point_type, point_code, power_kva, tier, inst_street, inst_postal_code, inst_locality, installation_address, billing_address, energy_type, entry_type, voltage_type, additional_services')
        .eq('sale_id', parentSaleIdForPoints)
        .order('created_at', { ascending: true });

      if (points && points.length > 0) {
        energyPointsList = points.map(pt => ({
          point_type: pt.point_type,
          point_code: pt.point_code || '',
          power_kva: pt.power_kva || null,
          tier: pt.tier || null,
          inst_street: pt.inst_street || null,
          inst_postal_code: pt.inst_postal_code || null,
          inst_locality: pt.inst_locality || null,
          installation_address: pt.installation_address || null,
          billing_address: pt.billing_address || null,
          energy_type: pt.energy_type || null,
          entry_type: pt.entry_type || null,
          voltage_type: pt.voltage_type || null,
          additional_services: pt.additional_services || null,
        }));
      }
    }

    const basePayload = {
      sale_code: parentSale.sale_code,
      customer_name: parentSale.client_name,
      customer_nif: parentSale.client_nif || '',
      operator_name: parentSale.operator?.name || 'N/A',
      partner_name: parentSale.partner?.name || parentSale.partner_name || 'N/A',
      message: `Venda registada para ${parentSale.client_name}`,
      attachments: attachmentsData?.attachments || [],
      sale_id: parentSale.id,
      scope: parentSale.scope,
      client_contact: parentSale.client_contact,
      client_email: parentSale.client_email,
      client_iban: parentSale.client_iban,
      address: [parentSale.street, parentSale.postal_code, parentSale.locality].filter(Boolean).join(', '),
      installation_address: parentSale.installation_address,
      billing_address: parentSale.billing_address,
      ev_outlet_count: parentSale.ev_outlet_count,
      ev_monthly_fee: parentSale.ev_monthly_fee,
      ev_margin: parentSale.ev_margin,
      ev_fidelization_months: parentSale.ev_fidelization_months,
      entry_type: parentSale.entry_type,
      energy_sale_type: parentSale.energy_sale_type,
      cpe: parentSale.cpe,
      power: parentSale.power,
      cui: parentSale.cui,
      tier: parentSale.tier,
      autoriza_documentos: parentSale.autoriza_documentos,
      service_type: parentSale.service_type,
      activation_type: parentSale.activation_type,
      monthly_value: parentSale.monthly_value,
      current_monthly_fee: parentSale.current_monthly_fee,
      contracted_monthly_fee: parentSale.contracted_monthly_fee,
      has_tv: parentSale.has_tv,
      has_net: parentSale.has_net,
      has_lr: parentSale.has_lr,
      has_direct_debit: parentSale.has_direct_debit,
      has_electronic_invoice: parentSale.has_electronic_invoice,
      fix_ported: parentSale.fix_ported,
      fix_number: parentSale.fix_number,
      fix_operator: parentSale.fix_operator,
      fix_cvp: parentSale.fix_cvp,
      mobile_count: parentSale.mobile_count,
      mobile_numbers: parentSale.mobile_numbers,
      tratar_oop: parentSale.tratar_oop || false,
      observations: parentSale.observations,
      email_fields: parentSale.operator?.email_fields || null,
      voltage_type: parentSale.voltage_type,
      additional_services: parentSale.additional_services,
      operator_requires_additional_services: parentSale.operator?.requires_additional_services || false,
      from_email: fromEmail,
      from_smtp_user: fromEmail,
      from_smtp_pass: fromSmtpPass,
      sale_type: effectiveSaleType,
      ...(energyPointsList ? { energy_points_list: energyPointsList } : {}),
    };

    const sendEmail = async (extraPayload) => {
      const finalPayload = { ...basePayload, ...overridePayload, ...extraPayload };
      if (energyPointsList && !finalPayload.energy_points_list) {
        finalPayload.energy_points_list = energyPointsList;
      }
      const response = await fetch(`${supabaseUrl}/functions/v1/send-new-sale-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify(finalPayload),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to send email');
      }
      return response.json();
    };

    const isD2DPartner = parentSale.partner?.partner_type === 'D2D';
    const operatorUserIds = parentSale.operator?.notification_user_ids;
    let adminRecipients = [];
    let partnerRecipients = [];
    let notificationRecipients = [];

    // CALL 1 recipients: operator-specific users or all admins/BO
    if (operatorUserIds && Array.isArray(operatorUserIds) && operatorUserIds.length > 0) {
      const { data: operatorUsers } = await supabase
        .from('users')
        .select('email, name')
        .in('id', operatorUserIds)
        .eq('email_alerts_enabled', true);
      adminRecipients = operatorUsers || [];
    } else {
      const { data: adminBoUsers } = await supabase
        .from('users')
        .select('email, name')
        .in('role', ['admin', 'bo'])
        .eq('email_alerts_enabled', true);
      adminRecipients = adminBoUsers || [];
    }

    // CALL 2 recipients: partner/creator users (skip for D2D)
    if (!isD2DPartner) {
      const userIds = [parentSale.partner?.user_id, parentSale.created_by_user_id].filter(Boolean);
      if (userIds.length > 0) {
        const { data: partnerUsers } = await supabase
          .from('users')
          .select('email, name')
          .in('id', userIds)
          .eq('email_alerts_enabled', true);
        partnerRecipients = partnerUsers || [];
      }
    }

    // CALL 3 recipients: operator notification_emails (external addresses, no partner info)
    if (parentSale.operator?.notification_emails && Array.isArray(parentSale.operator.notification_emails)) {
      parentSale.operator.notification_emails.forEach(email => {
        if (email && email.trim()) {
          notificationRecipients.push({ email: email.trim(), name: parentSale.operator.name });
        }
      });
    }

    let sentCount = 0;
    const errors = [];

    if (adminRecipients.length > 0) {
      try {
        await sendEmail({ to_recipients: adminRecipients, show_partner: true, attachments: [] });
        sentCount++;
      } catch (e) { errors.push(e.message); }
    }

    if (partnerRecipients.length > 0) {
      try {
        await sendEmail({ to_recipients: partnerRecipients, show_partner: true, attachments: [] });
        sentCount++;
      } catch (e) { errors.push(e.message); }
    }

    if (notificationRecipients.length > 0) {
      try {
        await sendEmail({ to_recipients: notificationRecipients, show_partner: false });
        sentCount++;
      } catch (e) { errors.push(e.message); }
    }

    if (sentCount === 0 && errors.length > 0) {
      throw new Error(errors[0]);
    }

    const totalRecipients = adminRecipients.length + partnerRecipients.length + notificationRecipients.length;

    return {
      success: true,
      to_count: adminRecipients.length,
      bcc_count: partnerRecipients.length + notificationRecipients.length,
      sent_count: sentCount,
      total_recipients: totalRecipients,
    };
  },

  async resendEditAlert(saleId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: currentUser } = await supabase
      .from('users')
      .select('role, name')
      .eq('id', user.id)
      .maybeSingle();

    if (!currentUser || !['admin', 'bo'].includes(currentUser.role)) {
      throw new Error('Only administrators and backoffice can resend alerts');
    }

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('sale_code, partner_id, created_by_user_id')
      .eq('id', saleId)
      .maybeSingle();

    if (saleError || !sale) throw new Error('Sale not found');

    const { data: recipients } = await supabase.rpc('get_alert_recipients', {
      p_sale_id: saleId,
      p_partner_id: sale.partner_id,
      p_created_by_user_id: sale.created_by_user_id,
    });

    const userIds = recipients ? recipients.map(r => r.user_id) : [];

    const { error: alertError } = await supabase
      .from('alerts')
      .insert({
        type: 'sale_edit',
        sale_id: saleId,
        sale_code: sale.sale_code,
        message: `Email de alerta reenviado manualmente por ${currentUser.name}`,
        user_ids: userIds,
        created_by: user.id,
        created_by_name: currentUser.name,
      });

    if (alertError) throw alertError;

    return { success: true, recipients_count: userIds.length };
  }
};
