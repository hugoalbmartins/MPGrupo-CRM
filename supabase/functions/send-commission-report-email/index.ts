import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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
  pdfBase64: string;
}

async function sendEmailSMTP(to: string, subject: string, html: string) {
  const smtpHost = Deno.env.get("SMTP_HOST") || "cpanel75.dnscpanel.com";
  const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
  const smtpUser = Deno.env.get("SMTP_USER") || "noreply@mpgrupo.pt";
  const smtpPass = Deno.env.get("SMTP_PASS") || "";
  const fromEmail = Deno.env.get("FROM_EMAIL") || "noreply@mpgrupo.pt";
  const fromName = Deno.env.get("FROM_NAME") || "MP Grupo CRM";

  if (!smtpPass) {
    throw new Error("SMTP_PASS not configured");
  }

  const boundary = `----=_Part_${Date.now()}`;
  const messageId = `<${Date.now()}.${Math.random()}@mpgrupo.pt>`;

  const emailBody = [
    `From: ${fromName} <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Message-ID: ${messageId}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary=\"${boundary}\"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    html,
    ``,
    `--${boundary}--`,
  ].join("\r\n");

  const conn = await Deno.connect({
    hostname: smtpHost,
    port: smtpPort,
  });

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  try {
    const buffer = new Uint8Array(1024);
    await conn.read(buffer);

    await conn.write(encoder.encode(`EHLO ${smtpHost}\r\n`));
    await conn.read(buffer);

    const credentials = btoa(`\0${smtpUser}\0${smtpPass}`);
    await conn.write(encoder.encode(`AUTH PLAIN ${credentials}\r\n`));
    await conn.read(buffer);

    await conn.write(encoder.encode(`MAIL FROM:<${fromEmail}>\r\n`));
    await conn.read(buffer);

    await conn.write(encoder.encode(`RCPT TO:<${to}>\r\n`));
    await conn.read(buffer);

    await conn.write(encoder.encode(`DATA\r\n`));
    await conn.read(buffer);

    await conn.write(encoder.encode(`${emailBody}\r\n.\r\n`));
    await conn.read(buffer);

    await conn.write(encoder.encode(`QUIT\r\n`));
    await conn.read(buffer);
  } finally {
    conn.close();
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
    const { partnerId, partnerEmail, partnerName, month, year, userId, pdfBase64 } = payload;

    if (!partnerId || !partnerEmail || !partnerName || !month || !year || !userId || !pdfBase64) {
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

    const { data: versionData } = await supabase
      .from("commission_reports")
      .select("version")
      .eq("partner_id", partnerId)
      .eq("month", monthNum)
      .eq("year", year)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const version = versionData ? versionData.version + 1 : 1;
    const fileName = `${partnerName.replace(/[^a-zA-Z0-9]/g, '_')}_Auto_${monthName}_${year}_V${version}.pdf`;
    const filePath = `${partnerId}/${year}/${fileName}`;

    const pdfBuffer = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));

    const { error: uploadError } = await supabase.storage
      .from("commission-reports")
      .upload(filePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload error: ${uploadError.message}`);
    }

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

    const html = `
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
        <div class=\"header\">
          <h1>🧾 Novo Auto de Comissões</h1>
        </div>
        <div class=\"content\">
          <p>Olá <strong>${partnerName}</strong>,</p>

          <p>Foi emitido um novo auto de comissões para o período:</p>

          <div class=\"info-box\">
            <strong>📅 Período:</strong> ${monthName}/${year}<br>
            <strong>📊 Estado:</strong> Disponível para download
          </div>

          <p>Pode aceder ao auto através da sua área de parceiro no CRM:</p>

          <center>
            <a href=\"${Deno.env.get("APP_URL") || "https://seu-crm.com"}/my-reports\" class=\"button\">
              Aceder aos Meus Autos
            </a>
          </center>

          <p style=\"margin-top: 30px; font-size: 14px; color: #666;\">
            Este email é automático. Por favor não responda diretamente a este email.
          </p>
        </div>
        <div class=\"footer\">
          <p>© ${new Date().getFullYear()} MP Grupo - Sistema de Gestão de Comissões</p>
          <p>MARCIO & SANDRA LDA | NIF: 518162796</p>
        </div>
      </body>
      </html>
    `;

    try {
      await sendEmailSMTP(partnerEmail, subject, html);
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
    }

    await supabase
      .from("commission_reports")
      .update({ email_sent: true, email_sent_at: new Date().toISOString() })
      .eq("id", reportData.id);

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
    console.error("Error processing commission report:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
