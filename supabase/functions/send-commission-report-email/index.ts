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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log("Processing commission report request");
    const payload: EmailPayload = await req.json();
    const { partnerId, partnerEmail, partnerName, month, year, userId, filePath, fileName, version } = payload;

    console.log("Validating payload fields");
    if (!partnerId || !partnerEmail || !partnerName || !month || !year || !userId || !filePath || !fileName || !version) {
      console.error("Missing fields:", { partnerId: !!partnerId, partnerEmail: !!partnerEmail, partnerName: !!partnerName, month: !!month, year: !!year, userId: !!userId, filePath: !!filePath, fileName: !!fileName, version: !!version });
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Creating Supabase client");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Processing month");
    let monthNum: number;
    if (typeof month === 'string') {
      const monthNames = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
      const monthLower = month.toLowerCase();
      const monthIndex = monthNames.indexOf(monthLower);
      if (monthIndex !== -1) {
        monthNum = monthIndex + 1;
      } else {
        monthNum = parseInt(month);
      }
    } else {
      monthNum = month;
    }

    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      throw new Error(`Invalid month value: ${month}`);
    }

    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const monthName = monthNames[monthNum - 1];

    console.log("PDF already uploaded at:", filePath);

    console.log("Inserting record into database");
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
      console.error("Database insert error:", insertError);
      throw new Error(`Database error: ${insertError.message}`);
    }

    console.log("Database record created successfully");
    console.log("Getting administrators list...");

    const { data: admins, error: adminsError } = await supabase
      .from("users")
      .select("email, name")
      .eq("role", "admin");

    if (adminsError) {
      console.error("Error getting administrators:", adminsError);
    }

    const subject = `Auto de Comissões - ${monthName}/${year}`;
    const appUrl = Deno.env.get("APP_URL") || "https://www.mpgrupo.pt";

    const partnerHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.8;
            color: #333;
            max-width: 700px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
          }
          .email-container {
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header {
            background: linear-gradient(135deg, #1F4E78 0%, #2C5F8D 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0 0 10px 0;
            font-size: 28px;
            font-weight: 600;
          }
          .header p {
            margin: 0;
            opacity: 0.95;
            font-size: 16px;
          }
          .content {
            padding: 40px 30px;
          }
          .greeting {
            font-size: 18px;
            margin-bottom: 25px;
            color: #1F4E78;
          }
          .info-section {
            background: #f8f9fa;
            border-left: 4px solid #1F4E78;
            padding: 20px;
            margin: 25px 0;
            border-radius: 5px;
          }
          .info-section h3 {
            margin: 0 0 15px 0;
            color: #1F4E78;
            font-size: 18px;
          }
          .info-row {
            margin: 10px 0;
            padding: 8px 0;
            border-bottom: 1px solid #e0e0e0;
          }
          .info-row:last-child {
            border-bottom: none;
          }
          .info-label {
            font-weight: 600;
            color: #555;
            display: inline-block;
            min-width: 140px;
          }
          .billing-box {
            background: #fff9e6;
            border: 2px solid #ffc107;
            padding: 20px;
            margin: 25px 0;
            border-radius: 8px;
          }
          .billing-box h3 {
            margin: 0 0 15px 0;
            color: #f57c00;
            font-size: 18px;
          }
          .company-details {
            background: white;
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            line-height: 1.6;
          }
          .important-note {
            background: #e3f2fd;
            border-left: 4px solid #2196f3;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .important-note strong {
            color: #1976d2;
          }
          .footer {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            color: #666;
            font-size: 13px;
            border-top: 1px solid #e0e0e0;
          }
          .footer p {
            margin: 5px 0;
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>Auto de Comissões</h1>
            <p>${monthName} ${year}</p>
          </div>

          <div class="content">
            <p class="greeting">Exmo(a). Sr(a). <strong>${partnerName}</strong>,</p>

            <p>Vimos por este meio enviar o <strong>Auto de Comissões</strong> referente ao período de <strong>${monthName}/${year}</strong>, conforme documento em anexo.</p>

            <div class="info-section">
              <h3>📋 Detalhes do Auto</h3>
              <div class="info-row">
                <span class="info-label">Período:</span> ${monthName}/${year}
              </div>
              <div class="info-row">
                <span class="info-label">Versão:</span> V${version}
              </div>
              <div class="info-row">
                <span class="info-label">Parceiro:</span> ${partnerName}
              </div>
            </div>

            <div class="billing-box">
              <h3>💼 Dados de Faturação</h3>
              <p>Para processamento do pagamento, solicitamos a emissão de fatura com os seguintes dados:</p>

              <div class="company-details">
                <strong>MARCIO & SANDRA LDA</strong><br>
                Avenida Rainha Santa Isabel, Lt 8, Loja 1<br>
                5000-434 Vila Real<br>
                <strong>NIF:</strong> 518162796
              </div>

              <p style="margin-top: 15px;"><strong>Conforme enquadramento legal aplicável.</strong></p>
            </div>

            <div class="important-note">
              <p style="margin: 0;"><strong>⚠️ Ação Requerida:</strong></p>
              <p style="margin: 10px 0 0 0;">
                Por favor, <strong>responda a este email</strong> com a respetiva fatura em anexo para o endereço <strong>financeira@mpgrupo.pt</strong>.
              </p>
            </div>

            <div class="info-section">
              <h3>💳 Condições de Pagamento</h3>
              <div class="info-row">
                <span class="info-label">Prazo:</span> Até 48 horas úteis após receção da fatura
              </div>
              <div class="info-row">
                <span class="info-label">Método:</span> Transferência Bancária
              </div>
            </div>

            <p style="margin-top: 30px;">Para qualquer esclarecimento adicional, não hesite em contactar-nos.</p>

            <p style="margin-top: 25px;">
              <strong>Com os melhores cumprimentos,</strong><br>
              Departamento Financeiro<br>
              MP Grupo
            </p>
          </div>

          <div class="footer">
            <p><strong>MARCIO & SANDRA LDA</strong></p>
            <p>Avenida Rainha Santa Isabel, Lt 8, Loja 1 | 5000-434 Vila Real</p>
            <p>NIF: 518162796</p>
            <p style="margin-top: 15px; font-size: 11px; color: #999;">
              Este email foi enviado automaticamente. Por favor responda para financeira@mpgrupo.pt
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const adminHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #1F4E78 0%, #2C5F8D 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
          }
          .content {
            background: #f9f9f9;
            padding: 30px 20px;
            border-radius: 0 0 10px 10px;
          }
          .info-box {
            background: white;
            border-left: 4px solid #1F4E78;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .button {
            display: inline-block;
            background: #1F4E78;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
            font-weight: bold;
          }
          .footer {
            text-align: center;
            padding: 20px;
            color: #666;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Auto de Comissões Aprovado</h1>
        </div>
        <div class="content">
          <p>Foi aprovado um auto de comissões:</p>

          <div class="info-box">
            <strong>Parceiro:</strong> ${partnerName}<br>
            <strong>Período:</strong> ${monthName}/${year}<br>
            <strong>Versão:</strong> V${version}<br>
            <strong>Estado:</strong> Enviado ao parceiro
          </div>

          <p>O auto foi enviado automaticamente para o email do parceiro.</p>

          <center>
            <a href="${appUrl}/commission-reports" class="button">
              Ver Todos os Autos
            </a>
          </center>

          <p style="margin-top: 30px; font-size: 14px; color: #666;">
            Este email é automático. Por favor não responda diretamente a este email.
          </p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} MP Grupo - Sistema de Gestão de Comissões</p>
          <p>MARCIO & SANDRA LDA | NIF: 518162796</p>
        </div>
      </body>
      </html>
    `;

    let emailsSent = 0;
    let emailsFailed = 0;

    console.log("Downloading PDF from storage:", filePath);
    let pdfContent: Uint8Array | null = null;

    try {
      const { data: pdfData, error: downloadError } = await supabase.storage
        .from("commission-reports")
        .download(filePath);

      if (downloadError) {
        throw new Error(`Failed to download PDF: ${downloadError.message}`);
      }

      pdfContent = new Uint8Array(await pdfData.arrayBuffer());
      console.log("PDF downloaded successfully, size:", pdfContent.length, "bytes");
    } catch (downloadError) {
      console.error("Error downloading PDF:", downloadError);
      throw new Error("Failed to download commission report PDF");
    }

    console.log("Sending email with attachment to partner:", partnerEmail);
    try {
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
      emailsSent++;
      console.log("Email with attachment sent successfully to partner");
    } catch (emailError) {
      emailsFailed++;
      console.error("Failed to send email to partner:", emailError);
    }

    if (admins && admins.length > 0) {
      console.log(`Sending emails to ${admins.length} administrators...`);
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
          emailsSent++;
          console.log(`Email sent successfully to admin: ${admin.email}`);
        } catch (emailError) {
          emailsFailed++;
          console.error(`Failed to send email to admin ${admin.email}:`, emailError);
        }
      }
    }

    console.log(`Email summary: ${emailsSent} sent, ${emailsFailed} failed`);

    await supabase
      .from("commission_reports")
      .update({
        email_sent: emailsSent > 0,
        email_sent_at: new Date().toISOString()
      })
      .eq("id", reportData.id);

    console.log("Process completed successfully");
    return new Response(
      JSON.stringify({
        success: true,
        message: "Report registered and emails sent successfully",
        reportId: reportData.id,
        emailsSent,
        emailsFailed
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing commission report:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
