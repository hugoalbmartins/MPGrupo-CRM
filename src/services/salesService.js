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
      .maybeSingle();

    if (!currentUser) throw new Error('User not found');

    let query = supabase
      .from('sales')
      .select('*')
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

  async checkWarningsAndCreateSale(saleData) {
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

    return await this.create(saleData);
  },

  async create(saleData) {
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

    const saleCode = await generateSaleCode(saleData.partner_id, saleData.date, supabase);

    const { data: { user } } = await supabase.auth.getUser();
    const { data: currentUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!currentUser) throw new Error('User not found');

    const status = ['partner', 'partner_commercial'].includes(currentUser.role)
      ? 'Para registo'
      : 'Pendente';

    const { data: operator } = await supabase
      .from('operators')
      .select('*')
      .eq('id', saleData.operator_id)
      .maybeSingle();

    if (!operator) throw new Error('Operator not found');

    const commission = await calculateCommission(operator, {
      ...saleData,
      partner_id: saleData.partner_id
    }, supabase);

    const { data: partner } = await supabase
      .from('partners')
      .select('name')
      .eq('id', saleData.partner_id)
      .maybeSingle();

    const insertData = {
      sale_code: saleCode,
      date: saleData.date,
      partner_id: saleData.partner_id,
      partner_name: partner?.name || 'Unknown',
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
      energy_sale_type: saleData.energy_sale_type || null,
      cpe: saleData.cpe?.toUpperCase() || null,
      power: saleData.power || null,
      entry_type: saleData.entry_type || null,
      cui: saleData.cui?.toUpperCase() || null,
      tier: saleData.tier || null,
      observations: saleData.observations || null,
      calculated_commission: commission
    };

    const { data, error } = await supabase
      .from('sales')
      .insert(insertData)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Sale created but not returned from database');

    await this.createAlert('new_sale', data.id, data.sale_code,
      `Nova venda registada: ${data.sale_code} - ${partner?.name || 'Unknown'}`);

    return data;
  },

  async update(id, updateData) {
    const { data: oldSale } = await supabase
      .from('sales')
      .select('status')
      .eq('id', id)
      .maybeSingle();

    if (!oldSale) throw new Error('Sale not found');

    const updates = {};
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== null && updateData[key] !== undefined && updateData[key] !== '') {
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

    if (updateData.status && oldSale.status !== updateData.status) {
      await this.createAlert('status_change', data.id, data.sale_code,
        `Status alterado para ${updateData.status}: ${data.sale_code}`);
    } else {
      await this.createAlert('sale_updated', data.id, data.sale_code,
        `Venda atualizada: ${data.sale_code}`);
    }

    return data;
  },

  async addNote(saleId, content) {
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
      created_at: new Date().toISOString()
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
      .maybeSingle();

    if (!currentUser) throw new Error('User not found');

    const { data: sale } = await supabase
      .from('sales')
      .select('partner_id, created_by_user_id, client_name, client_nif, scope')
      .eq('id', saleId)
      .maybeSingle();

    if (!sale) throw new Error('Sale not found');

    const userIds = [];

    const { data: partner } = await supabase
      .from('partners')
      .select('user_id')
      .eq('id', sale.partner_id)
      .maybeSingle();

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

    const { data: recipientUsers } = await supabase
      .from('users')
      .select('email, name')
      .in('id', uniqueUserIds);

    if (recipientUsers && recipientUsers.length > 0) {
      const scopeTranslation = {
        telecomunicacoes: 'Telecomunicações',
        energia: 'Energia',
        solar: 'Solar',
        dual: 'Dual'
      };

      const emailSubject = `${sale.client_name} - ${sale.client_nif} - ${scopeTranslation[sale.scope] || sale.scope}`;

      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%); padding: 30px; text-align: center;">
            <h1 style="color: #FFFFFF; margin: 0; font-size: 24px;">MP GRUPO</h1>
            <p style="color: #FFFFFF; margin: 5px 0 0 0; font-size: 14px;">Sales CRM</p>
          </div>

          <div style="padding: 30px; background-color: #FFFFFF;">
            <h2 style="color: #1E293B; margin-top: 0;">Notificação de Venda</h2>
            <p style="color: #475569; line-height: 1.6;">${message}</p>

            <div style="background-color: #F8FAFC; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0; color: #475569;"><strong>Código:</strong> ${saleCode}</p>
              <p style="margin: 5px 0; color: #475569;"><strong>Cliente:</strong> ${sale.client_name}</p>
              <p style="margin: 5px 0; color: #475569;"><strong>NIF:</strong> ${sale.client_nif}</p>
              <p style="margin: 5px 0; color: #475569;"><strong>Tipo:</strong> ${scopeTranslation[sale.scope] || sale.scope}</p>
            </div>

            <p style="color: #64748B; font-size: 14px; margin-top: 30px;">
              Melhores cumprimentos,<br>
              <strong>Gestão de vendas da Grupo MarcioPinto</strong>
            </p>
          </div>

          <div style="background-color: #F8FAFC; padding: 20px; text-align: center; border-top: 1px solid #E2E8F0;">
            <p style="color: #94A3B8; font-size: 12px; margin: 0;">
              Esta é uma notificação automática do sistema de gestão de vendas MP GRUPO.
            </p>
          </div>
        </div>
      `;

      (async () => {
        for (const recipient of recipientUsers) {
          try {
            const response = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-alert-email`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  to: recipient.email,
                  subject: emailSubject,
                  html: emailBody,
                }),
              }
            );

            if (!response.ok) {
              console.error(`Failed to send email to ${recipient.email}`);
            }
          } catch (error) {
            console.error(`Error sending email to ${recipient.email}:`, error);
          }
        }
      })();
    }
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
  }
};
