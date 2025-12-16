import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { sendEmailSMTP } from "./_shared/smtp.ts";

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
          <h1>Novo Auto de Comissões</h1>
        </div>
        <div class="content">
          <p>Olá <strong>${partnerName}</strong>,</p>

          <p>Foi emitido um novo auto de comissões para o período:</p>

          <div class="info-box">
            <strong>Período:</strong> ${monthName}/${year}<br>
            <strong>Estado:</strong> Disponível para download
          </div>

          <p>Pode aceder ao auto através da sua área de parceiro no CRM:</p>

          <center>
            <a href="${appUrl}/commission-reports-partner" class="button">
              Aceder aos Meus Autos
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

    console.log("Sending email to partner:", partnerEmail);
    try {
      await sendEmailSMTP(partnerEmail, subject, partnerHtml);
      emailsSent++;
      console.log("Email sent successfully to partner");
    } catch (emailError) {
      emailsFailed++;
      console.error("Failed to send email to partner:", emailError);
    }

    if (admins && admins.length > 0) {
      console.log(`Sending emails to ${admins.length} administrators...`);
      for (const admin of admins) {
        try {
          await sendEmailSMTP(admin.email, `[Admin] ${subject}`, adminHtml);
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
