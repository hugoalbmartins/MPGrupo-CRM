import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { sendEmailSMTP, sendEmailWithAttachment } from "./_shared/smtp.ts";

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

async function sendAdminNotifications(
  admins: Array<{ email: string; name: string }>,
  subject: string,
  partnerName: string,
  monthName: string,
  year: number,
  version: number,
  appUrl: string
) {
  const adminHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #1F4E78 0%, #2C5F8D 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px 20px; border-radius: 0 0 10px 10px; }
        .info-box { background: white; border-left: 4px solid #1F4E78; padding: 15px; margin: 20px 0; border-radius: 5px; }
        .button { display: inline-block; background: #1F4E78; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header"><h1>Auto de Comissões Aprovado</h1></div>
      <div class="content">
        <p>Foi aprovado um auto de comissões:</p>
        <div class="info-box">
          <strong>Parceiro:</strong> ${partnerName}<br>
          <strong>Período:</strong> ${monthName}/${year}<br>
          <strong>Versão:</strong> V${version}<br>
          <strong>Estado:</strong> Enviado ao parceiro
        </div>
        <center><a href="${appUrl}/commission-reports" class="button">Ver Todos os Autos</a></center>
      </div>
      <div class="footer">© ${new Date().getFullYear()} MP Grupo - Sistema de Gestão de Comissões</div>
    </body>
    </html>
  `;

  for (const admin of admins) {
    try {
      await sendEmailSMTP(
        admin.email,
        `[Admin] ${subject}`,
        adminHtml,
        {
          fromEmail: "noreply@mpgrupo.pt",
          fromName: "MP Grupo CRM",
          smtpUser: "noreply@mpgrupo.pt",
          smtpPass: "bmEcxN_X^mol"
        }
      );
      console.log(`Admin email sent to: ${admin.email}`);
    } catch (error) {
      console.error(`Failed admin email to ${admin.email}:`, error);
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const payload: EmailPayload = await req.json();
    const { partnerId, partnerEmail, partnerName, month, year, userId, filePath, fileName, version } = payload;

    if (!partnerId || !partnerEmail || !partnerName || !month || !year || !userId || !filePath || !fileName || !version) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
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

    const subject = `Auto de Comissões - ${monthName}/${year}`;
    const appUrl = Deno.env.get("APP_URL") || "https://www.mpgrupo.pt";

    const partnerHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.8; color: #333; max-width: 700px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
          .email-container { background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #1F4E78 0%, #2C5F8D 100%); color: white; padding: 40px 30px; text-align: center; }
          .header h1 { margin: 0 0 10px 0; font-size: 28px; }
          .content { padding: 40px 30px; }
          .info-section { background: #f8f9fa; border-left: 4px solid #1F4E78; padding: 20px; margin: 25px 0; border-radius: 5px; }
          .billing-box { background: #fff9e6; border: 2px solid #ffc107; padding: 20px; margin: 25px 0; border-radius: 8px; }
          .company-details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; font-family: 'Courier New', monospace; font-size: 14px; }
          .important-note { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .footer { background: #f8f9fa; padding: 30px; text-align: center; color: #666; font-size: 13px; border-top: 1px solid #e0e0e0; }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>Auto de Comissões</h1>
            <p>${monthName} ${year}</p>
          </div>
          <div class="content">
            <p>Exmo(a). Sr(a). <strong>${partnerName}</strong>,</p>
            <p>Vimos por este meio enviar o <strong>Auto de Comissões</strong> referente ao período de <strong>${monthName}/${year}</strong>, conforme documento em anexo.</p>

            <div class="billing-box">
              <h3>💼 Dados de Faturação</h3>
              <p>Para processamento do pagamento, solicitamos a emissão de fatura com os seguintes dados:</p>
              <div class="company-details">
                <strong>MARCIO & SANDRA LDA</strong><br>
                Avenida Rainha Santa Isabel, Lt 8, Loja 1<br>
                5000-434 Vila Real<br>
                <strong>NIF:</strong> 518162796
              </div>
            </div>

            <div class="important-note">
              <p><strong>⚠️ Ação Requerida:</strong></p>
              <p>Por favor, <strong>responda a este email</strong> com a respetiva fatura em anexo para o endereço <strong>financeira@mpgrupo.pt</strong>.</p>
            </div>

            <p style="margin-top: 30px;"><strong>Com os melhores cumprimentos,</strong><br>Departamento Financeiro<br>MP Grupo</p>
          </div>
          <div class="footer">
            <p><strong>MARCIO & SANDRA LDA</strong></p>
            <p>Avenida Rainha Santa Isabel, Lt 8, Loja 1 | 5000-434 Vila Real | NIF: 518162796</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const { data: pdfData, error: downloadError } = await supabase.storage
      .from("commission-reports")
      .download(filePath);

    if (downloadError) {
      throw new Error(`Failed to download PDF: ${downloadError.message}`);
    }

    const pdfContent = new Uint8Array(await pdfData.arrayBuffer());
    console.log(`PDF ready: ${pdfContent.length} bytes`);

    await sendEmailWithAttachment(
      partnerEmail,
      subject,
      partnerHtml,
      {
        filename: fileName,
        content: pdfContent,
        contentType: "application/pdf"
      },
      {
        fromEmail: "financeira@mpgrupo.pt",
        fromName: "MP Grupo - Departamento Financeiro",
        smtpUser: "financeira@mpgrupo.pt",
        smtpPass: "c1MAW?9{i?fj",
        replyTo: "financeira@mpgrupo.pt"
      }
    );

    await supabase
      .from("commission_reports")
      .update({
        email_sent: true,
        email_sent_at: new Date().toISOString()
      })
      .eq("id", reportData.id);

    const { data: admins } = await supabase
      .from("users")
      .select("email, name")
      .eq("role", "admin");

    if (admins && admins.length > 0) {
      sendAdminNotifications(admins, subject, partnerName, monthName, year, version, appUrl);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Report registered and email sent successfully",
        reportId: reportData.id
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
