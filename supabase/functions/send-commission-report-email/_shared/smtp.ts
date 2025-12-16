interface SMTPConfig {
  fromEmail?: string;
  fromName?: string;
  smtpUser?: string;
  smtpPass?: string;
  replyTo?: string;
}

interface EmailAttachment {
  filename: string;
  content: Uint8Array;
  contentType: string;
}

async function connectAndSend(
  host: string,
  port: number,
  commands: string[],
  timeout: number
): Promise<void> {
  console.log(`Connecting to ${host}:${port} with timeout ${timeout}ms`);

  const conn = await Deno.connect({
    hostname: host,
    port: port,
  });

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = new Uint8Array(4096);

  try {
    for (const command of commands) {
      console.log(`Sending: ${command.substring(0, 50)}...`);
      await conn.write(encoder.encode(command + "\r\n"));

      const bytesRead = await conn.read(buffer);
      if (bytesRead) {
        const response = decoder.decode(buffer.subarray(0, bytesRead));
        console.log(`Response: ${response.substring(0, 100)}...`);

        if (response.startsWith("5")) {
          throw new Error(`SMTP Error: ${response}`);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log("SMTP commands sent successfully");
  } finally {
    try {
      conn.close();
    } catch (e) {
      console.error("Error closing connection:", e);
    }
  }
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

  const boundary = `----=_Part_${Date.now()}`;
  const messageId = `<${Date.now()}.${Math.random()}@mpgrupo.pt>`;

  const emailBody = [
    `From: ${fromName} <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Message-ID: ${messageId}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    html
  ].join("\r\n");

  const credentials = btoa(`\0${smtpUser}\0${smtpPass}`);

  const commands = [
    `EHLO ${smtpHost}`,
    `AUTH PLAIN ${credentials}`,
    `MAIL FROM:<${fromEmail}>`,
    `RCPT TO:<${to}>`,
    `DATA`,
    `${emailBody}\r\n.`,
    `QUIT`
  ];

  try {
    await connectAndSend(smtpHost, smtpPort, commands, 20000);
    console.log("Email sent successfully");
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
}

export async function sendEmailWithAttachment(
  to: string,
  subject: string,
  html: string,
  attachment: EmailAttachment,
  config?: SMTPConfig
) {
  const smtpHost = Deno.env.get("SMTP_HOST") || "cpanel75.dnscpanel.com";
  const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
  const smtpUser = config?.smtpUser || Deno.env.get("SMTP_USER") || "noreply@mpgrupo.pt";
  const smtpPass = config?.smtpPass || Deno.env.get("SMTP_PASS") || "";
  const fromEmail = config?.fromEmail || Deno.env.get("FROM_EMAIL") || "noreply@mpgrupo.pt";
  const fromName = config?.fromName || Deno.env.get("FROM_NAME") || "MP Grupo CRM";

  if (!smtpPass) {
    throw new Error("SMTP_PASS not configured");
  }

  console.log(`Preparing email with attachment to ${to} from ${fromEmail}`);
  console.log(`Attachment size: ${attachment.content.length} bytes`);

  const boundary = `----=_Part_${Date.now()}`;
  const messageId = `<${Date.now()}.${Math.random()}@mpgrupo.pt>`;

  let base64Content: string;
  try {
    console.log("Converting attachment to base64...");
    base64Content = btoa(String.fromCharCode(...attachment.content));
    console.log(`Base64 size: ${base64Content.length} characters`);
  } catch (error) {
    console.error("Failed to convert attachment to base64:", error);
    throw new Error("Failed to encode attachment");
  }

  const emailHeaders = [
    `From: ${fromName} <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Message-ID: ${messageId}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
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
    `--${boundary}`,
    `Content-Type: ${attachment.contentType}; name="${attachment.filename}"`,
    `Content-Disposition: attachment; filename="${attachment.filename}"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    base64Content,
    ``,
    `--${boundary}--`,
  ].join("\r\n");

  console.log(`Total email size: ${emailBody.length} bytes`);

  const credentials = btoa(`\0${smtpUser}\0${smtpPass}`);

  const commands = [
    `EHLO ${smtpHost}`,
    `AUTH PLAIN ${credentials}`,
    `MAIL FROM:<${fromEmail}>`,
    `RCPT TO:<${to}>`,
    `DATA`,
    `${emailBody}\r\n.`,
    `QUIT`
  ];

  try {
    await connectAndSend(smtpHost, smtpPort, commands, 30000);
    console.log("Email with attachment sent successfully");
  } catch (error) {
    console.error("Failed to send email with attachment:", error);
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
