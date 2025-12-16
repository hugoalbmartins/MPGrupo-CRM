import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { sendEmail } from "./_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailPayload {
  partnerId: string;
  partnerEmail: string;
  partnerName: string;
  month: string | number;
  year: number;
  userId: string;
  filePath: string;
  fileName: string;
  version: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    console.log("[CommissionReport] Starting email process");

    const payload: EmailPayload = await req.json();
    const { partnerId, partnerEmail, partnerName, month, year, userId, filePath, fileName, version } = payload;

    if (!partnerId || !partnerEmail || !partnerName || !month || !year || !userId || !filePath || !fileName || !version) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let monthNum: number;
    if (typeof month === 'string') {
      const monthNames = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
      const monthIndex = monthNames.indexOf(month.toLowerCase());
      monthNum = monthIndex !== -1 ? monthIndex + 1 : parseInt(month);
    } else {
      monthNum = month;
    }

    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      throw new Error(`Invalid month: ${month}`);
    }

    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const monthName = monthNames[monthNum - 1];

    console.log(`[CommissionReport] Processing: ${partnerName} - ${monthName}/${year}`);

    const { data: reportData, error: insertError } = await supabase
      .from("commission_reports")
      .insert({
        partner_id: partnerId,
        month: monthNum,
        year: year,
        version: version,
        file_name: fileName,
        file_path: filePath,
        created_by: userId,
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Database error: ${insertError.message}`);
    }

    console.log(`[CommissionReport] Report registered with ID: ${reportData.id}`);

    const subject = `Auto de Comissões - ${monthName}/${year}`;

    const { data: urlData } = await supabase.storage
      .from("commission-reports")
      .createSignedUrl(filePath, 2592000);

    const downloadUrl = urlData?.signedUrl || `${supabaseUrl}/storage/v1/object/public/commission-reports/${filePath}`;

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 650px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1F4E78 0%, #2C5F8D 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0 0 8px 0; font-size: 24px; }
    .content { padding: 30px; }
    .info-box { background: #f8f9fa; border-left: 4px solid #1F4E78; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .billing-box { background: #fff9e6; border: 2px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 6px; }
    .company-details { background: white; padding: 12px; border-radius: 4px; margin: 12px 0; font-family: monospace; font-size: 13px; }
    .download-button { display: inline-block; background: #1F4E78; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #e0e0e0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Auto de Comissões</h1>
      <p style="margin: 0;">${monthName} ${year} - Versão ${version}</p>
    </div>
    <div class="content">
      <p>Exmo(a). Sr(a). <strong>${partnerName}</strong>,</p>
      <p>Vimos por este meio enviar o <strong>Auto de Comissões</strong> referente ao período de <strong>${monthName}/${year}</strong>.</p>

      <center>
        <a href="${downloadUrl}" class="download-button">📥 Descarregar Auto de Comissões (PDF)</a>
      </center>

      <div class="billing-box">
        <h3 style="margin-top: 0;">💼 Dados de Faturação</h3>
        <p>Para processamento do pagamento, solicitamos a emissão de fatura com os seguintes dados:</p>
        <div class="company-details">
          <strong>MARCIO & SANDRA LDA</strong><br>
          Avenida Rainha Santa Isabel, Lt 8, Loja 1<br>
          5000-434 Vila Real<br>
          <strong>NIF:</strong> 518162796
        </div>
      </div>

      <div class="info-box">
        <p style="margin: 0;"><strong>⚠️ Ação Requerida:</strong></p>
        <p style="margin: 8px 0 0 0;">Por favor, <strong>responda a este email</strong> com a respetiva fatura em anexo para <strong>financeira@mpgrupo.pt</strong></p>
      </div>

      <div class="info-box">
        <strong>💳 Condições de Pagamento</strong><br>
        <strong>Prazo:</strong> Até 48 horas úteis após receção da fatura<br>
        <strong>Método:</strong> Transferência Bancária
      </div>

      <p style="margin-top: 25px;"><strong>Com os melhores cumprimentos,</strong><br>Departamento Financeiro<br>MP Grupo</p>
    </div>
    <div class="footer">
      <p><strong>MARCIO & SANDRA LDA</strong></p>
      <p>Avenida Rainha Santa Isabel, Lt 8, Loja 1 | 5000-434 Vila Real | NIF: 518162796</p>
    </div>
  </div>
</body>
</html>
    `;

    console.log(`[CommissionReport] Sending email to: ${partnerEmail}`);

    await sendEmail(
      partnerEmail,
      subject,
      emailHtml,
      {
        from: "noreply@mpgrupo.pt",
        fromName: "MP Grupo - Departamento Financeiro",
        replyTo: "financeira@mpgrupo.pt"
      }
    );

    console.log(`[CommissionReport] Email sent successfully`);

    await supabase
      .from("commission_reports")
      .update({ email_sent: true, email_sent_at: new Date().toISOString() })
      .eq("id", reportData.id);

    console.log(`[CommissionReport] Database updated`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Report registered and email sent successfully",
        reportId: reportData.id
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[CommissionReport] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
