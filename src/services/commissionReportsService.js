import { supabase } from '../lib/supabase';

export const commissionReportsService = {
  async getAll(year = null) {
    let query = supabase
      .from('commission_reports')
      .select(`
        *,
        partner:partners(id, name, email),
        creator:users!commission_reports_created_by_fkey(id, name, email)
      `)
      .order('created_at', { ascending: false });

    if (year) {
      query = query.eq('year', year);
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
        partner:partners(id, name, email),
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
        partner:partners(id, name, email),
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
  }
};
