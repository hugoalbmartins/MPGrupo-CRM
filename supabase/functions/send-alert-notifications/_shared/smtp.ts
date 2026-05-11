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

async function connectAndSendTLS(
  host: string,
  port: number,
  user: string,
  pass: string,
  fromEmail: string,
  to: string,
  emailBody: string
): Promise<void> {
  console.log(`[SMTP Notification] Connecting to ${host}:${port}`);

  let conn: Deno.TlsConn | null = null;

  try {
    conn = await Promise.race([
      Deno.connectTls({ hostname: host, port: port }),
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
        if (lastLine && lastLine.length >= 4 && lastLine[3] === " ") {
          break;
        }
      }

      console.log(`[SMTP Notification] ${label}: ${fullResponse.substring(0, 120).trim()}`);

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

    await writeCommand(`RCPT TO:<${to}>`);
    await readFullResponse("RCPT TO");

    await writeCommand(`DATA`);
    await readFullResponse("DATA");

    console.log(`[SMTP Notification] Sending email body (${emailBody.length} bytes)`);
    await conn!.write(encoder.encode(`${emailBody}\r\n.\r\n`));
    await readFullResponse("DATA END", 60000);

    try {
      await writeCommand(`QUIT`);
      await readFullResponse("QUIT", 3000);
    } catch (_e) {
      console.log("[SMTP Notification] QUIT ignored");
    }

    console.log("[SMTP Notification] Email sent successfully");
  } catch (error) {
    console.error("[SMTP Notification] Error:", error.message);
    throw error;
  } finally {
    if (conn) {
      try {
        conn.close();
      } catch (_e) {
        console.error("[SMTP Notification] Error closing connection");
      }
    }
  }
}

interface SMTPConfig {
  fromEmail?: string;
  fromName?: string;
  smtpUser?: string;
  smtpPass?: string;
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

export async function sendEmailSMTP(to: string, subject: string, html: string, config?: SMTPConfig) {
  const dbConfig = await getSmtpConfigFromDB();

  const smtpHost = (dbConfig?.smtp_host as string) || Deno.env.get("SMTP_HOST") || "mail.mpgrupo.pt";
  const smtpPort = (dbConfig?.smtp_port as number) || parseInt(Deno.env.get("SMTP_PORT") || "465");
  const smtpUser = config?.smtpUser || (dbConfig?.smtp_user as string) || Deno.env.get("SMTP_USER") || "info@mpgrupo.pt";
  const smtpPass = config?.smtpPass || Deno.env.get("SMTP_PASS") || "";
  const fromEmail = config?.fromEmail || (dbConfig?.from_email as string) || Deno.env.get("FROM_EMAIL") || "info@mpgrupo.pt";
  const fromName = config?.fromName || (dbConfig?.from_name as string) || Deno.env.get("FROM_NAME") || "MP Grupo CRM";

  if (!smtpPass) {
    throw new Error("SMTP_PASS not configured");
  }

  console.log(`Preparing email to ${to} from ${fromEmail}`);

  const messageId = `<${Date.now()}.${Math.random()}@mpgrupo.pt>`;
  const htmlBase64 = encodeBase64Wrapped(html);
  const encodedSubject = encodeSubject(subject);

  const emailBody = [
    `From: ${fromName} <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    `Message-ID: ${messageId}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    htmlBase64
  ].join("\r\n");

  try {
    await connectAndSendTLS(smtpHost, smtpPort, smtpUser, smtpPass, fromEmail, to, emailBody);
    console.log("Email sent successfully");
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
}

export async function sendEmailToMultipleRecipients(
  recipients: Array<{ email: string; name: string }>,
  subject: string,
  html: string
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const results = {
    sent: 0,
    failed: 0,
    errors: [] as string[]
  };

  for (const recipient of recipients) {
    try {
      await sendEmailSMTP(recipient.email, subject, html);
      results.sent++;
      console.log(`Email sent successfully to ${recipient.email}`);
    } catch (error) {
      results.failed++;
      const errorMsg = `Failed to send to ${recipient.email}: ${error.message}`;
      results.errors.push(errorMsg);
      console.error(errorMsg);
    }
  }

  return results;
}
