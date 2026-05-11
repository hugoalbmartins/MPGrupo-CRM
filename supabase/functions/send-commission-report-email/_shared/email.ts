// Cached SMTP config from database
let cachedSmtpConfig: Record<string, unknown> | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function getSmtpConfigFromDB(): Promise<Record<string, unknown> | null> {
  const now = Date.now();
  if (cachedSmtpConfig && now < cacheExpiry) {
    return cachedSmtpConfig;
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) return null;

    const res = await fetch(
      `${supabaseUrl}/rest/v1/system_settings?select=setting_value&setting_key=eq.smtp_config`,
      {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      }
    );
    const data = await res.json();
    if (data?.[0]?.setting_value) {
      cachedSmtpConfig = data[0].setting_value;
      cacheExpiry = now + CACHE_TTL;
      return cachedSmtpConfig;
    }
  } catch (e) {
    console.warn("Failed to fetch SMTP config from DB:", e);
  }
  return null;
}

export interface EmailConfig {
  from?: string;
  fromName?: string;
  replyTo?: string;
  bcc?: string[];
}

function encodeSubject(subject: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(subject);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return `=?UTF-8?B?${base64}?=`;
}

function encodeBase64Wrapped(text: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  const lines: string[] = [];
  for (let i = 0; i < base64.length; i += 76) {
    lines.push(base64.substring(i, i + 76));
  }
  return lines.join("\r\n");
}

export async function sendEmailResend(
  to: string,
  subject: string,
  html: string,
  config?: EmailConfig
) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

  const dbConfig = await getSmtpConfigFromDB();
  const fromEmail = config?.from || (dbConfig?.from_email as string) || Deno.env.get("FROM_EMAIL") || "noreply@mpgrupo.pt";
  const fromName = config?.fromName || (dbConfig?.from_name as string) || Deno.env.get("FROM_NAME") || "MP Grupo CRM";
  const from = `${fromName} <${fromEmail}>`;

  const payload: any = { from, to: [to], subject, html };
  if (config?.replyTo) payload.reply_to = config.replyTo;
  if (config?.bcc && config.bcc.length > 0) payload.bcc = config.bcc;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }

  const data = await response.json();
  console.log(`Email sent via Resend: ${data.id}`);
  return data.id;
}

export async function sendEmailSMTP(
  to: string,
  subject: string,
  html: string,
  config?: EmailConfig
) {
  const dbConfig = await getSmtpConfigFromDB();

  const smtpHost = (dbConfig?.smtp_host as string) || Deno.env.get("SMTP_HOST") || "mail.mpgrupo.pt";
  const smtpPort = (dbConfig?.smtp_port as number) || parseInt(Deno.env.get("SMTP_PORT") || "465");
  const smtpUser = Deno.env.get("SMTP_USER") || (dbConfig?.smtp_user as string) || "info@mpgrupo.pt";
  const smtpPass = Deno.env.get("SMTP_PASS") || "";
  const fromEmail = config?.from || (dbConfig?.from_email as string) || Deno.env.get("FROM_EMAIL") || "info@mpgrupo.pt";
  const fromName = config?.fromName || (dbConfig?.from_name as string) || Deno.env.get("FROM_NAME") || "MP Grupo CRM";
  const replyTo = config?.replyTo || (dbConfig?.reply_to as string) || "";

  if (!smtpPass) throw new Error("SMTP_PASS not configured");

  console.log(`[SMTP Commission] Connecting to ${smtpHost}:${smtpPort}`);

  const boundary = `----=_Part_${Date.now()}`;
  const messageId = `<${Date.now()}.${Math.random()}@mpgrupo.pt>`;
  const encodedSubject = encodeSubject(subject);
  const htmlBase64 = encodeBase64Wrapped(html);

  const emailHeaders = [
    `From: ${fromName} <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    `Message-ID: ${messageId}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  if (replyTo) emailHeaders.push(`Reply-To: ${replyTo}`);
  if (config?.bcc && config.bcc.length > 0) emailHeaders.push(`Bcc: ${config.bcc.join(", ")}`);

  const emailBody = [
    ...emailHeaders,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    htmlBase64,
    ``,
    `--${boundary}--`,
  ].join("\r\n");

  let conn: Deno.TlsConn | null = null;

  try {
    conn = await Promise.race([
      Deno.connectTls({ hostname: smtpHost, port: smtpPort }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("SMTP connection timeout")), 15000)
      ),
    ]);

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const readFullResponse = async (label: string, timeoutMs = 15000): Promise<string> => {
      let fullResponse = "";
      const deadline = Date.now() + timeoutMs;
      while (true) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) throw new Error(`SMTP timeout waiting for ${label}`);
        const buffer = new Uint8Array(4096);
        const bytesRead = await Promise.race([
          conn!.read(buffer),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`SMTP read timeout on ${label}`)), remaining)
          ),
        ]);
        if (bytesRead === null) throw new Error(`SMTP connection closed on ${label}`);
        fullResponse += decoder.decode(buffer.subarray(0, bytesRead));
        const lines = fullResponse.split("\r\n").filter((l) => l.length > 0);
        const lastLine = lines[lines.length - 1];
        if (lastLine && lastLine.length >= 4 && lastLine[3] === " ") break;
      }
      console.log(`[SMTP Commission] ${label}: ${fullResponse.substring(0, 120).trim()}`);
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
    await writeCommand(`EHLO ${smtpHost}`);
    await readFullResponse("EHLO", 10000);

    const credentials = btoa(`\0${smtpUser}\0${smtpPass}`);
    await writeCommand(`AUTH PLAIN ${credentials}`);
    await readFullResponse("AUTH", 10000);

    await writeCommand(`MAIL FROM:<${fromEmail}>`);
    await readFullResponse("MAIL FROM");

    await writeCommand(`RCPT TO:<${to}>`);
    await readFullResponse("RCPT TO");

    if (config?.bcc && config.bcc.length > 0) {
      for (const bccAddr of config.bcc) {
        await writeCommand(`RCPT TO:<${bccAddr.trim()}>`);
        await readFullResponse(`RCPT TO BCC ${bccAddr.trim()}`);
      }
    }

    await writeCommand(`DATA`);
    await readFullResponse("DATA");

    console.log(`[SMTP Commission] Sending email body (${emailBody.length} bytes)`);
    await conn!.write(encoder.encode(emailBody + "\r\n.\r\n"));
    await readFullResponse("DATA END", 60000);

    try {
      await writeCommand(`QUIT`);
      await readFullResponse("QUIT", 3000);
    } catch (_e) {
      console.log("[SMTP Commission] QUIT ignored");
    }

    console.log(`[SMTP Commission] Email sent successfully: ${messageId}`);
  } catch (error) {
    console.error("[SMTP Commission] Error:", error.message);
    throw error;
  } finally {
    if (conn) {
      try { conn.close(); } catch (_e) { /* ignore */ }
    }
  }

  return messageId;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  config?: EmailConfig
): Promise<string> {
  const useResend = Deno.env.get("USE_RESEND") !== "false";
  let messageId: string;

  try {
    if (useResend) {
      messageId = await sendEmailResend(to, subject, html, config);
    } else {
      messageId = await sendEmailSMTP(to, subject, html, config);
    }
    return messageId;
  } catch (primaryError) {
    console.error(`Failed to send via ${useResend ? 'Resend' : 'SMTP'}:`, primaryError);
    try {
      if (useResend) {
        console.log("Trying SMTP fallback...");
        messageId = await sendEmailSMTP(to, subject, html, config);
      } else {
        console.log("Trying Resend fallback...");
        messageId = await sendEmailResend(to, subject, html, config);
      }
      return messageId;
    } catch (fallbackError) {
      console.error("Fallback also failed:", fallbackError);
      throw primaryError;
    }
  }
}
