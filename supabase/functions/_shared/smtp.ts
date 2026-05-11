// Cached SMTP config from database
let cachedSmtpConfig: Record<string, unknown> | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );

    const data = await res.json();
    if (data?.[0]?.setting_value) {
      cachedSmtpConfig = data[0].setting_value;
      cacheExpiry = now + CACHE_TTL;
      return cachedSmtpConfig;
    }
  } catch (e) {
    console.warn("Failed to fetch SMTP config from DB, using env vars:", e);
  }

  return null;
}

export async function getSmtpSettings() {
  const dbConfig = await getSmtpConfigFromDB();

  return {
    smtp_host: (dbConfig?.smtp_host as string) || Deno.env.get("SMTP_HOST") || "mail.mpgrupo.pt",
    smtp_port: (dbConfig?.smtp_port as number) || parseInt(Deno.env.get("SMTP_PORT") || "465"),
    smtp_user: (dbConfig?.smtp_user as string) || Deno.env.get("SMTP_USER") || "info@mpgrupo.pt",
    smtp_pass: Deno.env.get("SMTP_PASS") || "",
    from_email: (dbConfig?.from_email as string) || Deno.env.get("FROM_EMAIL") || "info@mpgrupo.pt",
    from_name: (dbConfig?.from_name as string) || Deno.env.get("FROM_NAME") || "MP Grupo CRM",
    reply_to: (dbConfig?.reply_to as string) || "",
    bcc_enabled: (dbConfig?.bcc_enabled as boolean) || false,
    bcc_emails: (dbConfig?.bcc_emails as string[]) || [],
    new_sale_email_enabled: dbConfig?.new_sale_email_enabled !== false,
    alert_email_enabled: dbConfig?.alert_email_enabled !== false,
    commission_report_email_enabled: dbConfig?.commission_report_email_enabled !== false,
    operator_notification_email_enabled: dbConfig?.operator_notification_email_enabled !== false,
  };
}

export function clearSmtpConfigCache() {
  cachedSmtpConfig = null;
  cacheExpiry = 0;
}

export async function sendEmailSMTP(
  to: string,
  subject: string,
  html: string,
  options?: {
    fromEmail?: string;
    fromName?: string;
    smtpUser?: string;
    smtpPass?: string;
    replyTo?: string;
  }
) {
  const settings = await getSmtpSettings();

  const smtpHost = settings.smtp_host;
  const smtpPort = settings.smtp_port;
  const smtpUser = options?.smtpUser || settings.smtp_user;
  const smtpPass = options?.smtpPass || settings.smtp_pass;
  const fromEmail = options?.fromEmail || settings.from_email;
  const fromName = options?.fromName || settings.from_name;
  const replyTo = options?.replyTo || settings.reply_to;

  if (!smtpPass) {
    throw new Error("SMTP_PASS not configured");
  }

  const boundary = `----=_Part_${Date.now()}`;
  const messageId = `<${Date.now()}.${Math.random()}@mpgrupo.pt>`;

  const headers = [
    `From: ${fromName} <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Message-ID: ${messageId}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  if (replyTo) {
    headers.push(`Reply-To: ${replyTo}`);
  }

  const emailBody = [
    ...headers,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    html,
    ``,
    `--${boundary}--`,
  ].join("\r\n");

  const connectTimeout = 8000;
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("SMTP connection timeout")), connectTimeout)
  );

  const connectionPromise = (async () => {
    const conn = await Deno.connect({
      hostname: smtpHost,
      port: smtpPort,
    });

    const encoder = new TextEncoder();
    const buffer = new Uint8Array(2048);

    try {
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
  })();

  await Promise.race([connectionPromise, timeoutPromise]);
}

export async function sendEmailWithAttachment(
  to: string,
  subject: string,
  html: string,
  attachment: {
    filename: string;
    content: Uint8Array;
    contentType: string;
  },
  options?: {
    fromEmail?: string;
    fromName?: string;
    smtpUser?: string;
    smtpPass?: string;
    replyTo?: string;
  }
) {
  const settings = await getSmtpSettings();

  const smtpHost = settings.smtp_host;
  const smtpPort = settings.smtp_port;
  const smtpUser = options?.smtpUser || settings.smtp_user;
  const smtpPass = options?.smtpPass || settings.smtp_pass;
  const fromEmail = options?.fromEmail || settings.from_email;
  const fromName = options?.fromName || settings.from_name;
  const replyTo = options?.replyTo || settings.reply_to;

  if (!smtpPass) {
    throw new Error("SMTP_PASS not configured");
  }

  const boundary = `----=_Part_${Date.now()}`;
  const messageId = `<${Date.now()}.${Math.random()}@mpgrupo.pt>`;

  const base64Attachment = btoa(
    String.fromCharCode(...attachment.content)
  );

  const headers = [
    `From: ${fromName} <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Message-ID: ${messageId}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ];

  if (replyTo) {
    headers.push(`Reply-To: ${replyTo}`);
  }

  const emailBody = [
    ...headers,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    html,
    ``,
    `--${boundary}`,
    `Content-Type: ${attachment.contentType}; name="${attachment.filename}"`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="${attachment.filename}"`,
    ``,
    base64Attachment,
    ``,
    `--${boundary}--`,
  ].join("\r\n");

  const connectTimeout = 10000;
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("SMTP connection timeout")), connectTimeout)
  );

  const connectionPromise = (async () => {
    const conn = await Deno.connect({
      hostname: smtpHost,
      port: smtpPort,
    });

    const encoder = new TextEncoder();
    const buffer = new Uint8Array(2048);

    try {
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
  })();

  await Promise.race([connectionPromise, timeoutPromise]);
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
