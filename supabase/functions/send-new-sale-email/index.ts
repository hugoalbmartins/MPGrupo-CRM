import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Recipient {
  email: string;
  name: string;
}

interface SaleEmailPayload {
  to_recipients: Recipient[];
  bcc_recipients: Recipient[];
  sale_code: string;
  customer_name: string;
  customer_nif: string;
  operator_name: string;
  message: string;
  attachments: Array<{ id: string; filename: string; path: string }>;
  sale_id: string;
  scope?: string;
  entry_type?: string;
  cpe?: string;
  power?: string;
  cui?: string;
  tier?: string;
}

function buildEmailTemplate(payload: SaleEmailPayload): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 640px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color: white; padding: 32px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 22px; }
    .header p { margin: 8px 0 0 0; opacity: 0.9; font-size: 14px; }
    .content { background: #f9fafb; padding: 32px; border: 1px solid #e5e7eb; }
    .badge { display: inline-block; padding: 6px 14px; background: #059669; color: white; border-radius: 16px; font-size: 13px; font-weight: 600; margin-bottom: 20px; }
    .sale-info { background: white; padding: 20px; border-left: 4px solid #2563eb; margin: 20px 0; border-radius: 0 6px 6px 0; }
    .sale-info table { width: 100%; border-collapse: collapse; }
    .sale-info td { padding: 8px 0; vertical-align: top; }
    .sale-info td:first-child { font-weight: 600; color: #374151; width: 160px; }
    .sale-info td:last-child { color: #6b7280; }
    .attachments { background: #eff6ff; padding: 16px; border-radius: 6px; margin: 20px 0; }
    .attachments h3 { margin: 0 0 8px 0; font-size: 14px; color: #1e40af; }
    .attachments ul { margin: 0; padding-left: 20px; }
    .attachments li { font-size: 13px; color: #374151; margin: 4px 0; }
    .footer { background: #1f2937; color: #9ca3af; padding: 20px; text-align: center; font-size: 12px; border-radius: 0 0 8px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>MP Grupo CRM</h1>
      <p>Nova Venda da Operadora ${payload.operator_name}</p>
    </div>
    <div class="content">
      <p>Boa tarde,</p>
      <p>Foi registada uma nova venda no sistema CRM.</p>

      <div class="badge">Nova Venda</div>

      <div class="sale-info">
        <table>
          <tr><td>Codigo:</td><td><strong>${payload.sale_code}</strong></td></tr>
          <tr><td>Cliente:</td><td>${payload.customer_name}</td></tr>
          <tr><td>NIF:</td><td>${payload.customer_nif || "N/A"}</td></tr>
          <tr><td>Operadora:</td><td>${payload.operator_name}</td></tr>
          ${payload.scope === "energia" || payload.scope === "energias" ? `
          <tr><td colspan="2" style="padding-top: 16px; padding-bottom: 8px; border-top: 1px solid #e5e7eb;"><strong style="color: #1e3a8a;">Detalhes Energia</strong></td></tr>
          ${payload.entry_type ? `<tr><td>Tipo de Entrada:</td><td>${payload.entry_type}</td></tr>` : ""}
          ${payload.cpe && payload.power ? `<tr><td>CPE / Potencia:</td><td>${payload.cpe} / ${payload.power}</td></tr>` : payload.cpe ? `<tr><td>CPE:</td><td>${payload.cpe}</td></tr>` : payload.power ? `<tr><td>Potencia:</td><td>${payload.power}</td></tr>` : ""}
          ${payload.cui && payload.tier ? `<tr><td>CUI / Escalao:</td><td>${payload.cui} / ${payload.tier}</td></tr>` : payload.cui ? `<tr><td>CUI:</td><td>${payload.cui}</td></tr>` : payload.tier ? `<tr><td>Escalao:</td><td>${payload.tier}</td></tr>` : ""}
          ` : ""}
        </table>
      </div>

      ${
        payload.attachments && payload.attachments.length > 0
          ? `<div class="attachments">
        <h3>Anexos (${payload.attachments.length})</h3>
        <ul>
          ${payload.attachments.map((a) => `<li>${a.filename}</li>`).join("")}
        </ul>
        <p style="font-size: 12px; color: #6b7280; margin: 8px 0 0 0;">Os anexos estao incluidos neste email.</p>
      </div>`
          : ""
      }

      <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
        Esta e uma notificacao automatica do sistema CRM. Por favor, nao responda a este email.
      </p>
    </div>
    <div class="footer">
      <p style="margin: 0;">&copy; ${new Date().getFullYear()} MP Grupo. Todos os direitos reservados.</p>
    </div>
  </div>
</body>
</html>`;
}

function getFirstFourNames(fullName: string): string {
  const names = fullName.trim().split(/\s+/);
  return names.slice(0, 4).join(' ');
}

function encodeBase64(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

function wrapBase64(base64: string, lineLength = 76): string {
  const lines: string[] = [];
  for (let i = 0; i < base64.length; i += lineLength) {
    lines.push(base64.substring(i, i + lineLength));
  }
  return lines.join("\r\n");
}

function textToBase64Wrapped(text: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  const base64 = encodeBase64(bytes);
  return wrapBase64(base64);
}

function encodeSubject(subject: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(subject);
  const base64 = encodeBase64(bytes);
  return `=?UTF-8?B?${base64}?=`;
}

function buildMimeEmail(
  fromEmail: string,
  fromName: string,
  toAddresses: string[],
  bccAddresses: string[],
  subject: string,
  html: string,
  attachmentParts: Array<{ filename: string; contentBase64: string; contentType: string }>
): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  const messageId = `<${Date.now()}.${Math.random().toString(36)}@mpgrupo.pt>`;

  const encodedSubject = encodeSubject(subject);

  const headers = [
    `From: ${fromName} <${fromEmail}>`,
    `To: ${toAddresses.join(", ")}`,
    `Subject: ${encodedSubject}`,
    `Message-ID: ${messageId}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`
  ];

  const htmlBase64 = textToBase64Wrapped(html);

  const parts = [
    headers.join("\r\n"),
    "",
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    "",
    htmlBase64,
  ];

  for (const att of attachmentParts) {
    parts.push(
      `--${boundary}`,
      `Content-Type: ${att.contentType}; name="${att.filename}"`,
      `Content-Disposition: attachment; filename="${att.filename}"`,
      `Content-Transfer-Encoding: base64`,
      "",
      wrapBase64(att.contentBase64)
    );
  }

  parts.push(`--${boundary}--`);

  return parts.join("\r\n");
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMsg: string): Promise<T> {
  const timeoutPromise = new Promise<T>((_, reject) => {
    setTimeout(() => reject(new Error(errorMsg)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]);
}

async function sendViaSMTP(
  host: string,
  port: number,
  user: string,
  pass: string,
  fromEmail: string,
  allRecipients: string[],
  emailBody: string
): Promise<void> {
  console.log(`[SMTP] Connecting to ${host}:${port}`);

  let conn: Deno.TlsConn | null = null;

  try {
    conn = await withTimeout(
      Deno.connectTls({ hostname: host, port: port }),
      10000,
      "SMTP connection timeout"
    );

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const buffer = new Uint8Array(8192);

    const readResponse = async (command: string) => {
      const bytesRead = await withTimeout(
        conn!.read(buffer),
        15000,
        `SMTP read timeout on ${command}`
      );

      if (bytesRead) {
        const resp = decoder.decode(buffer.subarray(0, bytesRead));
        console.log(`[SMTP] ${command}: ${resp.substring(0, 100).trim()}`);
        if (resp.startsWith("4") || resp.startsWith("5")) {
          throw new Error(`SMTP error on ${command}: ${resp.trim()}`);
        }
        return resp;
      }
      return "";
    };

    const writeCommand = async (cmd: string) => {
      await withTimeout(
        conn!.write(encoder.encode(cmd)),
        5000,
        `SMTP write timeout for: ${cmd.substring(0, 20)}`
      );
    };

    await readResponse("CONNECT");
    await writeCommand(`EHLO ${host}\r\n`);
    await readResponse("EHLO");

    const credentials = btoa(`\0${user}\0${pass}`);
    await writeCommand(`AUTH PLAIN ${credentials}\r\n`);
    await readResponse("AUTH");

    await writeCommand(`MAIL FROM:<${fromEmail}>\r\n`);
    await readResponse("MAIL FROM");

    for (const recipient of allRecipients) {
      await writeCommand(`RCPT TO:<${recipient}>\r\n`);
      await readResponse(`RCPT TO:${recipient}`);
    }

    await writeCommand(`DATA\r\n`);
    await readResponse("DATA");

    console.log(`[SMTP] Sending email body (${emailBody.length} bytes)`);
    await withTimeout(
      conn!.write(encoder.encode(`${emailBody}\r\n.\r\n`)),
      30000,
      "SMTP DATA body write timeout"
    );
    await withTimeout(
      readResponse("DATA END"),
      30000,
      "SMTP DATA END response timeout"
    );

    await writeCommand(`QUIT\r\n`);
    try {
      await withTimeout(readResponse("QUIT"), 3000, "QUIT timeout");
    } catch (_e) {
      console.log("[SMTP] QUIT response ignored");
    }

    console.log("[SMTP] Email sent successfully");
  } catch (error) {
    console.error("[SMTP] Error:", error.message);
    throw error;
  } finally {
    if (conn) {
      try {
        conn.close();
        console.log("[SMTP] Connection closed");
      } catch (_e) {
        console.error("[SMTP] Error closing connection");
      }
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload: SaleEmailPayload = await req.json();

    if (!payload.to_recipients || payload.to_recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: "No TO recipients" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const smtpHost = Deno.env.get("SMTP_HOST") || "mail.mpgrupo.pt";
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
    const smtpUser = Deno.env.get("SMTP_USER") || "info@mpgrupo.pt";
    const smtpPass = Deno.env.get("SMTP_PASS") || "";
    const fromEmail = "info@mpgrupo.pt";
    const fromName = "MP Grupo CRM";

    if (!smtpPass) {
      throw new Error("SMTP_PASS not configured");
    }

    const html = buildEmailTemplate(payload);

    const attachmentParts: Array<{ filename: string; contentBase64: string; contentType: string }> = [];

    if (payload.attachments && payload.attachments.length > 0 && payload.sale_id) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      for (const att of payload.attachments) {
        try {
          const { data, error } = await supabase.storage
            .from("sales-documents")
            .download(att.path);

          if (error || !data) {
            console.error(`Failed to download attachment ${att.filename}:`, error);
            continue;
          }

          const arrayBuffer = await data.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          const base64Content = encodeBase64(bytes);

          const ext = att.filename.split(".").pop()?.toLowerCase() || "";
          let contentType = "application/octet-stream";
          if (ext === "pdf") contentType = "application/pdf";
          else if (["jpg", "jpeg"].includes(ext)) contentType = "image/jpeg";
          else if (ext === "png") contentType = "image/png";
          else if (ext === "doc") contentType = "application/msword";
          else if (ext === "docx") contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          else if (ext === "xls") contentType = "application/vnd.ms-excel";
          else if (ext === "xlsx") contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

          attachmentParts.push({
            filename: att.filename,
            contentBase64: base64Content,
            contentType,
          });
        } catch (e) {
          console.error(`Error processing attachment ${att.filename}:`, e);
        }
      }
    }

    const toAddresses = payload.to_recipients.map((r) => r.email);
    const bccAddresses = (payload.bcc_recipients || []).map((r) => r.email);
    const allRecipients = [...new Set([...toAddresses, ...bccAddresses])];

    const customerNameShort = getFirstFourNames(payload.customer_name);
    const nifPart = payload.customer_nif ? ` - NIF ${payload.customer_nif}` : '';
    const subject = `${customerNameShort}${nifPart} - ${payload.operator_name}`;

    const emailBody = buildMimeEmail(
      fromEmail,
      fromName,
      toAddresses,
      bccAddresses,
      subject,
      html,
      attachmentParts
    );

    await sendViaSMTP(
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      fromEmail,
      allRecipients,
      emailBody
    );

    console.log(`New sale email sent: TO=${toAddresses.length}, BCC=${bccAddresses.length}, attachments=${attachmentParts.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        to_count: toAddresses.length,
        bcc_count: bccAddresses.length,
        attachments_count: attachmentParts.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending new sale email:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
