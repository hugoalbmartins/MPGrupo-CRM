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

interface MobileNumber {
  number: string;
  ported: boolean;
  cvp?: string;
}

interface SaleEmailPayload {
  to_recipients: Recipient[];
  bcc_recipients?: Recipient[];
  show_partner?: boolean;
  sale_code: string;
  customer_name: string;
  customer_nif: string;
  operator_name: string;
  partner_name?: string;
  message: string;
  attachments: Array<{ id: string; filename: string; path: string }>;
  sale_id: string;
  scope?: string;
  client_contact?: string;
  client_email?: string;
  client_iban?: string;
  address?: string;
  installation_address?: string;
  entry_type?: string;
  energy_sale_type?: string;
  cpe?: string;
  power?: string;
  cui?: string;
  tier?: string;
  autoriza_documentos?: string;
  service_type?: string;
  activation_type?: string;
  monthly_value?: number | string;
  current_monthly_fee?: number | string;
  contracted_monthly_fee?: number | string;
  has_tv?: boolean;
  has_net?: boolean;
  has_lr?: boolean;
  has_direct_debit?: boolean;
  has_electronic_invoice?: boolean;
  fix_ported?: boolean;
  fix_number?: string;
  fix_operator?: string;
  mobile_count?: number;
  mobile_numbers?: MobileNumber[];
  observations?: string;
  email_fields?: string[] | null;
  voltage_type?: string;
  additional_services?: string;
  from_email?: string | null;
  from_smtp_user?: string | null;
  from_smtp_pass?: string | null;
}

function hasField(payload: SaleEmailPayload, key: string): boolean {
  if (!payload.email_fields) return true;
  return payload.email_fields.includes(key);
}

function buildEmailTemplate(payload: SaleEmailPayload, showPartner = true): string {
  const hidePartner = !showPartner;
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
      <p>Olá!</p>
      <p>Foi registada uma nova venda no sistema CRM${hidePartner ? '.' : ` no parceiro <strong>${payload.partner_name || 'N/A'}</strong>.`}</p>

      <div class="badge">Nova Venda</div>

      <div class="sale-info">
        <table>
          <tr><td>Codigo:</td><td><strong>${payload.sale_code}</strong></td></tr>
          <tr><td>Cliente:</td><td>${payload.customer_name}</td></tr>
          <tr><td>NIF:</td><td>${payload.customer_nif || "N/A"}</td></tr>
          <tr><td>Operadora:</td><td>${payload.operator_name}</td></tr>

          ${(hasField(payload, 'client_contact') && payload.client_contact) || (hasField(payload, 'client_email') && payload.client_email) || (hasField(payload, 'client_iban') && payload.client_iban) ? `
          <tr><td colspan="2" style="padding-top: 16px; padding-bottom: 8px; border-top: 1px solid #e5e7eb;"><strong style="color: #1e3a8a;">Dados de Contacto</strong></td></tr>
          ${hasField(payload, 'client_contact') && payload.client_contact ? `<tr><td>Contacto:</td><td>${payload.client_contact}</td></tr>` : ""}
          ${hasField(payload, 'client_email') && payload.client_email ? `<tr><td>Email:</td><td>${payload.client_email}</td></tr>` : ""}
          ${hasField(payload, 'client_iban') && payload.client_iban ? `<tr><td>IBAN:</td><td>${payload.client_iban}</td></tr>` : ""}
          ` : ""}

          ${hasField(payload, 'address') && payload.address ? `
          <tr><td colspan="2" style="padding-top: 16px; padding-bottom: 8px; border-top: 1px solid #e5e7eb;"><strong style="color: #1e3a8a;">Morada</strong></td></tr>
          <tr><td>Morada:</td><td>${payload.address}</td></tr>
          <tr><td>Local de Instalacao:</td><td>${payload.installation_address || "Mesma"}</td></tr>
          ` : ""}

          ${hasField(payload, 'autoriza_documentos') && payload.autoriza_documentos ? `<tr><td>Autoriza docs. pessoais:</td><td>${payload.autoriza_documentos}</td></tr>` : ""}

          ${payload.scope === "telecomunicacoes" ? `
          <tr><td colspan="2" style="padding-top: 16px; padding-bottom: 8px; border-top: 1px solid #e5e7eb;"><strong style="color: #1e3a8a;">Detalhes Telecomunicacoes</strong></td></tr>
          ${hasField(payload, 'service_type') && payload.service_type ? `<tr><td>Tipo de Servico:</td><td>${payload.service_type === 'NI' ? 'NI (Nova Instalacao)' : payload.service_type === 'MC' ? 'MC (Mudanca de Casa)' : payload.service_type === 'REFID' ? 'REFID (Refidelizacao)' : payload.service_type}</td></tr>` : ""}
          ${hasField(payload, 'activation_type') && payload.activation_type ? `<tr><td>Tipo de Ativacao:</td><td>${payload.activation_type}</td></tr>` : ""}
          ${hasField(payload, 'monthly_value') && payload.monthly_value && payload.service_type !== 'REFID' ? `<tr><td>Mensalidade:</td><td>${payload.monthly_value}€</td></tr>` : ""}
          ${hasField(payload, 'refid_fees') && payload.current_monthly_fee && payload.contracted_monthly_fee ? `<tr><td>Mensalidade atual:</td><td>${payload.current_monthly_fee}€</td></tr><tr><td>Mensalidade contratada:</td><td>${payload.contracted_monthly_fee}€</td></tr>` : ""}
          ${hasField(payload, 'services') ? (() => {
            const services: string[] = [];
            if (payload.has_tv) services.push("TV");
            if (payload.has_net) services.push("NET/Fibra");
            if (payload.has_lr) {
              let lrText = "Linha Fixa/LR";
              if (payload.fix_ported) {
                lrText += ` (portado de ${payload.fix_operator || "operadora anterior"}: ${payload.fix_number || ""})`;
              }
              services.push(lrText);
            }
            if (services.length === 0) return "";
            return `<tr><td>Servicos:</td><td>${services.join(", ")}</td></tr>`;
          })() : ""}
          ${hasField(payload, 'mobile_lines') ? (() => {
            if (!payload.activation_type || payload.activation_type !== "M4") return "";
            const total = payload.mobile_count || 0;
            if (total === 0) return "";
            const portedCount = (payload.mobile_numbers || []).filter(m => m.ported).length;
            let mobileText = `${total} linha${total > 1 ? "s" : ""}`;
            if (portedCount > 0) mobileText += `, das quais ${portedCount} portada${portedCount > 1 ? "s" : ""}`;
            return `<tr><td>Moveis:</td><td>${mobileText}</td></tr>`;
          })() : ""}
          ${hasField(payload, 'direct_debit') && payload.has_direct_debit ? `<tr><td>Debito Direto:</td><td>Sim</td></tr>` : ""}
          ${hasField(payload, 'electronic_invoice') && payload.has_electronic_invoice ? `<tr><td>Fatura Eletronica:</td><td>Sim</td></tr>` : ""}
          ` : ""}

          ${payload.scope === "energia" || payload.scope === "energias" ? `
          <tr><td colspan="2" style="padding-top: 16px; padding-bottom: 8px; border-top: 1px solid #e5e7eb;"><strong style="color: #1e3a8a;">Detalhes Energia</strong></td></tr>
          ${hasField(payload, 'energy_sale_type') && payload.energy_sale_type ? `<tr><td>Tipo de Energia:</td><td>${payload.energy_sale_type === 'eletricidade' ? 'Eletricidade' : payload.energy_sale_type === 'gas' ? 'Gas' : payload.energy_sale_type === 'dual' ? 'Eletricidade + Gas (Dual)' : payload.energy_sale_type}</td></tr>` : ""}
          ${hasField(payload, 'entry_type') && payload.entry_type ? `<tr><td>Tipo de Entrada:</td><td>${payload.entry_type}</td></tr>` : ""}
          ${hasField(payload, 'voltage_type') ? `<tr><td>Tipo de Tensao:</td><td>${payload.voltage_type || "N/A"}</td></tr>` : ""}
          ${hasField(payload, 'cpe_power') ? (payload.cpe && payload.power ? `<tr><td>CPE / Potencia:</td><td>${payload.cpe} / ${payload.power}</td></tr>` : payload.cpe ? `<tr><td>CPE:</td><td>${payload.cpe}</td></tr>` : payload.power ? `<tr><td>Potencia:</td><td>${payload.power}</td></tr>` : "") : ""}
          ${hasField(payload, 'cui_tier') ? (payload.cui && payload.tier ? `<tr><td>CUI / Escalao:</td><td>${payload.cui} / ${payload.tier}</td></tr>` : payload.cui ? `<tr><td>CUI:</td><td>${payload.cui}</td></tr>` : payload.tier ? `<tr><td>Escalao:</td><td>${payload.tier}</td></tr>` : "") : ""}
          ${hasField(payload, 'direct_debit') ? `<tr><td>Debito Direto:</td><td>${payload.has_direct_debit ? "Sim" : "Nao"}</td></tr>` : ""}
          ${hasField(payload, 'electronic_invoice') ? `<tr><td>Fatura Eletronica:</td><td>${payload.has_electronic_invoice ? "Sim" : "Nao"}</td></tr>` : ""}
          ${hasField(payload, 'additional_services') && payload.additional_services ? `<tr><td>Servicos Adicionais:</td><td>${payload.additional_services}</td></tr>` : ""}
          ` : ""}

          ${payload.scope === "solar" ? `
          <tr><td colspan="2" style="padding-top: 16px; padding-bottom: 8px; border-top: 1px solid #e5e7eb;"><strong style="color: #1e3a8a;">Detalhes Solar</strong></td></tr>
          ${hasField(payload, 'cpe_power') ? (payload.cpe && payload.power ? `<tr><td>CPE / Potencia:</td><td>${payload.cpe} / ${payload.power}</td></tr>` : payload.cpe ? `<tr><td>CPE:</td><td>${payload.cpe}</td></tr>` : payload.power ? `<tr><td>Potencia:</td><td>${payload.power}</td></tr>` : "") : ""}
          ` : ""}

          ${hasField(payload, 'observations') && payload.observations ? `
          <tr><td colspan="2" style="padding-top: 16px; padding-bottom: 8px; border-top: 1px solid #e5e7eb;"><strong style="color: #1e3a8a;">Observacoes</strong></td></tr>
          <tr><td colspan="2" style="color: #6b7280; font-style: italic;">${payload.observations}</td></tr>
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
    const connectPromise = Deno.connectTls({ hostname: host, port: port });
    const timeoutId = setTimeout(() => {}, 15000);
    conn = await Promise.race([
      connectPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("SMTP connection timeout")), 15000)
      ),
    ]);
    clearTimeout(timeoutId);

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const readFullResponse = async (label: string, timeoutMs = 15000): Promise<string> => {
      let fullResponse = "";
      const deadline = Date.now() + timeoutMs;

      while (true) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) throw new Error(`SMTP timeout waiting for ${label}`);

        const buffer = new Uint8Array(4096);
        const readPromise = conn!.read(buffer);
        const bytesRead = await Promise.race([
          readPromise,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`SMTP read timeout on ${label}`)), remaining)
          ),
        ]);

        if (bytesRead === null) throw new Error(`SMTP connection closed on ${label}`);

        fullResponse += decoder.decode(buffer.subarray(0, bytesRead));

        const lines = fullResponse.split("\r\n").filter((l) => l.length > 0);
        const lastLine = lines[lines.length - 1];
        if (lastLine && lastLine.length >= 4 && lastLine[3] === " ") {
          break;
        }
      }

      console.log(`[SMTP] ${label}: ${fullResponse.substring(0, 120).trim()}`);

      const lines = fullResponse.split("\r\n").filter((l) => l.length > 0);
      const lastLine = lines[lines.length - 1];
      if (lastLine.startsWith("4") || lastLine.startsWith("5")) {
        throw new Error(`SMTP error on ${label}: ${lastLine.trim()}`);
      }

      return fullResponse;
    };

    const writeCommand = async (cmd: string) => {
      await conn!.write(encoder.encode(cmd + "\r\n"));
    };

    await readFullResponse("CONNECT");

    await writeCommand(`EHLO ${host}`);
    await readFullResponse("EHLO", 10000);

    const credentials = btoa(`\0${user}\0${pass}`);
    await writeCommand(`AUTH PLAIN ${credentials}`);
    await readFullResponse("AUTH", 10000);

    await writeCommand(`MAIL FROM:<${fromEmail}>`);
    await readFullResponse("MAIL FROM");

    for (const recipient of allRecipients) {
      await writeCommand(`RCPT TO:<${recipient}>`);
      await readFullResponse(`RCPT TO:${recipient}`);
    }

    await writeCommand(`DATA`);
    await readFullResponse("DATA");

    const bodyBytes = encoder.encode(`${emailBody}\r\n.\r\n`);
    const chunkSize = 65536;
    console.log(`[SMTP] Sending email body (${bodyBytes.length} bytes) in chunks of ${chunkSize}`);
    for (let offset = 0; offset < bodyBytes.length; offset += chunkSize) {
      await conn!.write(bodyBytes.subarray(offset, Math.min(offset + chunkSize, bodyBytes.length)));
    }
    const dataSendTimeoutMs = Math.max(60000, Math.ceil(bodyBytes.length / 10000) * 1000);
    await readFullResponse("DATA END", dataSendTimeoutMs);

    try {
      await writeCommand(`QUIT`);
      await readFullResponse("QUIT", 3000);
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
    const globalSmtpUser = Deno.env.get("SMTP_USER") || "info@mpgrupo.pt";
    const globalSmtpPass = Deno.env.get("SMTP_PASS") || "";

    const hasOperatorEmail = payload.from_email && payload.from_smtp_user && payload.from_smtp_pass;
    const smtpUser = hasOperatorEmail ? payload.from_smtp_user! : globalSmtpUser;
    const smtpPass = hasOperatorEmail ? payload.from_smtp_pass! : globalSmtpPass;
    const fromEmail = hasOperatorEmail ? payload.from_email! : "info@mpgrupo.pt";
    const fromName = "MP Grupo CRM";

    if (!smtpPass) {
      throw new Error("SMTP_PASS not configured");
    }

    console.log(`[EMAIL] Using from: ${fromEmail} (operator-specific: ${!!hasOperatorEmail})`);

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

    const customerNameShort = getFirstFourNames(payload.customer_name);
    const nifPart = payload.customer_nif ? ` NIF ${payload.customer_nif}` : '';
    const subject = `MPGrupo - ${payload.operator_name} - ${customerNameShort}${nifPart}`;

    const showPartner = payload.show_partner !== false;
    const html = buildEmailTemplate(payload, showPartner);
    const emailBody = buildMimeEmail(
      fromEmail,
      fromName,
      toAddresses,
      [],
      subject,
      html,
      attachmentParts
    );
    await sendViaSMTP(smtpHost, smtpPort, smtpUser, smtpPass, fromEmail, toAddresses, emailBody);

    console.log(`New sale email sent: TO=${toAddresses.length}, showPartner=${showPartner}, attachments=${attachmentParts.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        to_count: toAddresses.length,
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
