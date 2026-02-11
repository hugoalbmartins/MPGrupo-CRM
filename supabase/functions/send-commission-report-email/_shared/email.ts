export interface EmailConfig {
  from?: string;
  fromName?: string;
  replyTo?: string;
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

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMsg: string): Promise<T> {
  const timeoutPromise = new Promise<T>((_, reject) => {
    setTimeout(() => reject(new Error(errorMsg)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]);
}

export async function sendEmailResend(
  to: string,
  subject: string,
  html: string,
  config?: EmailConfig
) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const fromEmail = config?.from || "noreply@mpgrupo.pt";
  const fromName = config?.fromName || "MP Grupo CRM";
  const from = `${fromName} <${fromEmail}>`;

  const payload: any = {
    from,
    to: [to],
    subject,
    html,
  };

  if (config?.replyTo) {
    payload.reply_to = config.replyTo;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
    },
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
  const smtpHost = Deno.env.get("SMTP_HOST") || "cpanel75.dnscpanel.com";
  const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
  const smtpUser = Deno.env.get("SMTP_USER") || "noreply@mpgrupo.pt";
  const smtpPass = Deno.env.get("SMTP_PASS") || "";
  const fromEmail = config?.from || Deno.env.get("FROM_EMAIL") || "noreply@mpgrupo.pt";
  const fromName = config?.fromName || Deno.env.get("FROM_NAME") || "MP Grupo CRM";

  if (!smtpPass) {
    throw new Error("SMTP_PASS not configured");
  }

  console.log(`[SMTP Commission] Sending to ${to}`);

  const boundary = `----=_Part_${Date.now()}`;
  const messageId = `<${Date.now()}.${Math.random()}@mpgrupo.pt>`;
  const encodedSubject = encodeSubject(subject);

  const emailHeaders = [
    `From: ${fromName} <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    `Message-ID: ${messageId}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  if (config?.replyTo) {
    emailHeaders.push(`Reply-To: ${config.replyTo}`);
  }

  const emailBody = [
    ...emailHeaders,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    html,
    ``,
    `--${boundary}--`,
  ].join("\r\n");

  let conn = null;
  let tls = null;
  let reader = null;
  let writer = null;

  try {
    conn = await withTimeout(
      Deno.connect({ hostname: smtpHost, port: smtpPort, transport: "tcp" }),
      10000,
      "SMTP connection timeout"
    );

    tls = await withTimeout(
      Deno.startTls(conn, { hostname: smtpHost }),
      10000,
      "TLS handshake timeout"
    );

    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    reader = tls.readable.getReader();
    writer = tls.writable.getWriter();

    async function readResponse(): Promise<string> {
      const { value } = await withTimeout(reader.read(), 15000, "SMTP read timeout");
      return decoder.decode(value);
    }

    async function sendCommand(command: string): Promise<string> {
      await withTimeout(writer.write(encoder.encode(command + "\r\n")), 5000, "SMTP write timeout");
      return await readResponse();
    }

    await readResponse();
    await sendCommand(`EHLO ${smtpHost}`);
    await sendCommand(`AUTH LOGIN`);
    await sendCommand(btoa(smtpUser));
    await sendCommand(btoa(smtpPass));
    await sendCommand(`MAIL FROM:<${fromEmail}>`);
    await sendCommand(`RCPT TO:<${to}>`);
    await sendCommand(`DATA`);
    console.log(`[SMTP Commission] Sending email body (${emailBody.length} bytes)`);
    await withTimeout(writer.write(encoder.encode(emailBody + "\r\n.\r\n")), 30000, "DATA write timeout");
    await withTimeout(readResponse(), 30000, "DATA END response timeout");

    try {
      await withTimeout(sendCommand(`QUIT`), 3000, "QUIT timeout");
    } catch (_e) {
      console.log("[SMTP Commission] QUIT ignored");
    }

    console.log(`[SMTP Commission] Email sent successfully: ${messageId}`);
  } catch (error) {
    console.error("[SMTP Commission] Error:", error.message);
    throw error;
  } finally {
    try {
      if (writer) await writer.close();
      if (reader) await reader.cancel();
      if (tls) tls.close();
    } catch (e) {
      console.error("[SMTP Commission] Error closing connection:", e);
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