import { supabase } from '../lib/supabase';

export const commissionReportsService = {
  async getAll(year = null, month = null) {
    let query = supabase
      .from('commission_reports')
      .select(`
        *,
        partner:partners!commission_reports_partner_id_fkey(id, name, email),
        creator:users!commission_reports_created_by_fkey(id, name, email),
        validator:users!commission_reports_paid_validated_by_fkey(id, name, email)
      `)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .order('created_at', { ascending: false });

    if (year) {
      query = query.eq('year', year);
    }

    if (month) {
      query = query.eq('month', month);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  async getByPartnerId(partnerId, year = null) {
    let query = supabase
      .from('commission_reports')
      .select(`
        *,
        partner:partners!commission_reports_partner_id_fkey(id, name, email),
        creator:users!commission_reports_created_by_fkey(id, name, email)
      `)
      .eq('partner_id', partnerId)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (year) {
      query = query.eq('year', year);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  async getNextVersion(partnerId, month, year) {
    const { data, error } = await supabase.rpc('get_next_commission_report_version', {
      p_partner_id: partnerId,
      p_month: month,
      p_year: year
    });

    if (error) throw error;
    return data || 1;
  },

  async create(reportData) {
    const { data, error } = await supabase
      .from('commission_reports')
      .insert({
        partner_id: reportData.partner_id,
        month: reportData.month,
        year: reportData.year,
        version: reportData.version,
        file_name: reportData.file_name,
        file_path: reportData.file_path,
        created_by: reportData.created_by
      })
      .select(`
        *,
        partner:partners!commission_reports_partner_id_fkey(id, name, email),
        creator:users!commission_reports_created_by_fkey(id, name, email)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  async uploadFile(file, fileName) {
    const { data, error } = await supabase.storage
      .from('commission-reports')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) throw error;
    return data;
  },

  async getFileUrl(filePath) {
    const { data } = supabase.storage
      .from('commission-reports')
      .getPublicUrl(filePath);

    return data.publicUrl;
  },

  async downloadFile(filePath) {
    const { data, error } = await supabase.storage
      .from('commission-reports')
      .download(filePath);

    if (error) throw error;
    return data;
  },

  async markAsEmailed(reportId) {
    const { data, error } = await supabase
      .from('commission_reports')
      .update({ emailed_at: new Date().toISOString() })
      .eq('id', reportId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(reportId) {
    const { data: report } = await supabase
      .from('commission_reports')
      .select('file_path')
      .eq('id', reportId)
      .single();

    if (report?.file_path) {
      await supabase.storage
        .from('commission-reports')
        .remove([report.file_path]);
    }

    const { error } = await supabase
      .from('commission_reports')
      .delete()
      .eq('id', reportId);

    if (error) throw error;
  },

  async isMonthAvailableForEmission(month, year) {
    const { data, error } = await supabase.rpc('is_month_available_for_emission', {
      p_month: month,
      p_year: year
    });

    if (error) throw error;
    return data;
  },

  async getSettledSalesForPartner(partnerId, month, year) {
    const { data, error } = await supabase.rpc('get_settled_sales_for_partner', {
      p_partner_id: partnerId,
      p_month: month,
      p_year: year
    });

    if (error) throw error;
    return (data || []).map(row => row.sale_id);
  },

  async validatePayment(reportId, adminId) {
    const { error } = await supabase.rpc('validate_commission_report_payment', {
      p_report_id: reportId,
      p_admin_id: adminId
    });

    if (error) throw error;
  },

  async getLatestEmittedReport() {
    const { data, error } = await supabase
      .from('commission_reports')
      .select('month, year')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getPartnersWithSalesForMonth(month, year) {
    const { data, error } = await supabase.rpc('get_partners_with_sales_for_month', {
      p_month: month,
      p_year: year
    });

    if (error) throw error;
    return data || [];
  },

  async getPendingChargebacksForPartner(partnerId) {
    const { data, error } = await supabase
      .from('chargebacks')
      .select(`
        *,
        sale:sales!chargebacks_sale_id_fkey(
          id, sale_code, client_name, client_nif, calculated_commission,
          manual_commission, operator_name, request_number, activated_at
        )
      `)
      .eq('partner_id', partnerId)
      .is('commission_report_id', null)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async settleChargebacks(chargebackIds, commissionReportId) {
    if (!chargebackIds || chargebackIds.length === 0) return;
    const { error } = await supabase
      .from('chargebacks')
      .update({ commission_report_id: commissionReportId })
      .in('id', chargebackIds);

    if (error) throw error;
  }
};
