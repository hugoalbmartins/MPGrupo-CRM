import { supabase } from '../lib/supabase';

export const chargebackService = {
  async create({ saleId, partnerId, reason, reasonDate, percentage, commissionAmount, createdBy, chargebackType = 'full', activationIndication = null, activationDate = null }) {
    const chargebackAmount = parseFloat((commissionAmount * percentage / 100).toFixed(2));

    const insertData = {
      sale_id: saleId,
      partner_id: partnerId,
      reason,
      reason_date: reasonDate,
      percentage,
      commission_amount: commissionAmount,
      chargeback_amount: chargebackAmount,
      created_by: createdBy,
      chargeback_type: chargebackType,
    };

    if (activationIndication) insertData.activation_indication = activationIndication;
    if (activationDate) insertData.activation_date = activationDate;

    const { data, error } = await supabase
      .from('chargebacks')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    await supabase
      .from('sales')
      .update({ has_chargeback: true, chargeback_id: data.id })
      .eq('id', saleId);

    return data;
  },

  async getBySaleId(saleId) {
    const { data, error } = await supabase
      .from('chargebacks')
      .select('*')
      .eq('sale_id', saleId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getByPartnerId(partnerId) {
    const { data, error } = await supabase
      .from('chargebacks')
      .select(`
        *,
        sale:sales!chargebacks_sale_id_fkey(
          id, sale_code, customer_name, client_nif, calculated_commission,
          operator_name, status, activated_at
        )
      `)
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getPendingForPartner(partnerId) {
    const { data, error } = await supabase
      .from('chargebacks')
      .select(`
        *,
        sale:sales!chargebacks_sale_id_fkey(
          id, sale_code, customer_name, client_nif, calculated_commission,
          operator_name, status, activated_at, request_number
        )
      `)
      .eq('partner_id', partnerId)
      .is('commission_report_id', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async checkSaleInPaidReport(saleId) {
    const { data: reports, error } = await supabase
      .from('commission_reports')
      .select('id, month, year, version, paid_validated_at')
      .not('paid_validated_at', 'is', null);

    if (error) throw error;
    if (!reports || reports.length === 0) return null;

    for (const report of reports) {
      if (report.sales_included && Array.isArray(report.sales_included)) {
        const found = report.sales_included.find(s => s.sale_id === saleId || s.id === saleId);
        if (found) return report;
      }
    }

    const { data: reportsWithSales, error: error2 } = await supabase
      .from('commission_reports')
      .select('id, month, year, version, paid_validated_at, sales_included')
      .not('paid_validated_at', 'is', null);

    if (error2) throw error2;

    for (const report of (reportsWithSales || [])) {
      if (report.sales_included && Array.isArray(report.sales_included)) {
        const found = report.sales_included.find(s =>
          s.sale_id === saleId || s.id === saleId
        );
        if (found) return report;
      }
    }

    return null;
  },

  async markAsSettled(chargebackIds, commissionReportId) {
    const { error } = await supabase
      .from('chargebacks')
      .update({ commission_report_id: commissionReportId })
      .in('id', chargebackIds);

    if (error) throw error;
  },

  async getChargebackForSale(saleId) {
    const { data, error } = await supabase
      .from('chargebacks')
      .select('*')
      .eq('sale_id', saleId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async delete(chargebackId, saleId) {
    const { data: chargeback, error: fetchError } = await supabase
      .from('chargebacks')
      .select('commission_report_id')
      .eq('id', chargebackId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!chargeback) throw new Error('Chargeback nao encontrado');

    if (chargeback.commission_report_id) {
      throw new Error('Nao e possivel anular um chargeback ja incluido num auto de comissoes pago');
    }

    const { error } = await supabase
      .from('chargebacks')
      .delete()
      .eq('id', chargebackId);

    if (error) throw error;

    const { data: remaining } = await supabase
      .from('chargebacks')
      .select('id')
      .eq('sale_id', saleId)
      .limit(1);

    if (!remaining || remaining.length === 0) {
      await supabase
        .from('sales')
        .update({ has_chargeback: false, chargeback_id: null })
        .eq('id', saleId);
    }
  }
};
