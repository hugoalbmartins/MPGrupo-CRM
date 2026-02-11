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
  const smtpHost = Deno.env.get("SMTP_HOST") || "mail.mpgrupo.pt";
  const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
  const smtpUser = Deno.env.get("SMTP_USER") || "info@mpgrupo.pt";
  const smtpPass = Deno.env.get("SMTP_PASS") || "";
  const fromEmail = config?.from || Deno.env.get("FROM_EMAIL") || "info@mpgrupo.pt";
  const fromName = config?.fromName || Deno.env.get("FROM_NAME") || "MP Grupo CRM";

  if (!smtpPass) {
    throw new Error("SMTP_PASS not configured");
  }

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

  if (config?.replyTo) {
    emailHeaders.push(`Reply-To: ${config.replyTo}`);
  }

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
        if (lastLine && lastLine.length >= 4 && lastLine[3] === " ") {
          break;
        }
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
      try {
        conn.close();
        console.log("[SMTP Commission] Connection closed");
      } catch (_e) {
        console.error("[SMTP Commission] Error closing connection");
      }
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
