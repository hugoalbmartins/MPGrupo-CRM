async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMsg: string): Promise<T> {
  const timeoutPromise = new Promise<T>((_, reject) => {
    setTimeout(() => reject(new Error(errorMsg)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]);
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

  let conn = null;

  try {
    conn = await withTimeout(
      Deno.connectTls({ hostname: host, port: port }),
      10000,
      "SMTP connection timeout"
    );

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let buffer = new Uint8Array(8192);

    const readResponse = async () => {
      const bytesRead = await withTimeout(
        conn.read(buffer),
        15000,
        "SMTP read timeout"
      );

      if (bytesRead) {
        const response = decoder.decode(buffer.subarray(0, bytesRead));
        console.log(`[SMTP Notification] Response: ${response.substring(0, 100)}...`);
        return response;
      }
      return "";
    };

    const writeCommand = async (cmd: string) => {
      await withTimeout(
        conn.write(encoder.encode(cmd)),
        5000,
        "SMTP write timeout"
      );
    };

    await readResponse();

    await writeCommand(`EHLO ${host}\r\n`);
    await readResponse();

    const credentials = btoa(`\0${user}\0${pass}`);
    await writeCommand(`AUTH PLAIN ${credentials}\r\n`);
    const authResponse = await readResponse();

    if (authResponse.startsWith("5")) {
      throw new Error(`SMTP Auth Error: ${authResponse}`);
    }

    await writeCommand(`MAIL FROM:<${fromEmail}>\r\n`);
    await readResponse();

    await writeCommand(`RCPT TO:<${to}>\r\n`);
    await readResponse();

    await writeCommand(`DATA\r\n`);
    await readResponse();

    await writeCommand(`${emailBody}\r\n.\r\n`);
    await readResponse();

    await writeCommand(`QUIT\r\n`);
    try {
      await withTimeout(readResponse(), 3000, "QUIT timeout");
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
        console.log("[SMTP Notification] Connection closed");
      } catch (e) {
        console.error("[SMTP Notification] Error closing connection:", e);
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
  const smtpHost = Deno.env.get("SMTP_HOST") || "cpanel75.dnscpanel.com";
  const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
  const smtpUser = config?.smtpUser || Deno.env.get("SMTP_USER") || "noreply@mpgrupo.pt";
  const smtpPass = config?.smtpPass || Deno.env.get("SMTP_PASS") || "";
  const fromEmail = config?.fromEmail || Deno.env.get("FROM_EMAIL") || "noreply@mpgrupo.pt";
  const fromName = config?.fromName || Deno.env.get("FROM_NAME") || "MP Grupo CRM";

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
