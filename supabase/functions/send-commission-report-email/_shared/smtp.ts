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

async function connectAndSendTLS(
  host: string,
  port: number,
  user: string,
  pass: string,
  fromEmail: string,
  to: string,
  emailBody: string
): Promise<void> {
  console.log(`Connecting to ${host}:${port} with TLS`);

  const conn = await Deno.connectTls({
    hostname: host,
    port: port,
  });

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = new Uint8Array(8192);

  try {
    const readResponse = async () => {
      const bytesRead = await conn.read(buffer);
      if (bytesRead) {
        const response = decoder.decode(buffer.subarray(0, bytesRead));
        console.log(`Response: ${response.substring(0, 200)}...`);
        return response;
      }
      return "";
    };

    await readResponse();

    await conn.write(encoder.encode(`EHLO ${host}\r\n`));
    await readResponse();

    const credentials = btoa(`\0${user}\0${pass}`);
    await conn.write(encoder.encode(`AUTH PLAIN ${credentials}\r\n`));
    const authResponse = await readResponse();

    if (authResponse.startsWith("5")) {
      throw new Error(`SMTP Auth Error: ${authResponse}`);
    }

    await conn.write(encoder.encode(`MAIL FROM:<${fromEmail}>\r\n`));
    await readResponse();

    await conn.write(encoder.encode(`RCPT TO:<${to}>\r\n`));
    await readResponse();

    await conn.write(encoder.encode(`DATA\r\n`));
    await readResponse();

    await conn.write(encoder.encode(`${emailBody}\r\n.\r\n`));
    await readResponse();

    await conn.write(encoder.encode(`QUIT\r\n`));
    await readResponse();

    console.log("Email sent successfully via TLS");
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

  const messageId = `<${Date.now()}.${Math.random()}@mpgrupo.pt>`;

  const emailBody = [
    `From: ${fromName} <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Message-ID: ${messageId}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    html
  ].join("\r\n");

  try {
    await connectAndSendTLS(smtpHost, smtpPort, smtpUser, smtpPass, fromEmail, to, emailBody);
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
    let binaryString = '';
    const chunkSize = 8192;
    for (let i = 0; i < attachment.content.length; i += chunkSize) {
      const chunk = attachment.content.slice(i, i + chunkSize);
      binaryString += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const fullBase64 = btoa(binaryString);
    const lines: string[] = [];
    for (let i = 0; i < fullBase64.length; i += 76) {
      lines.push(fullBase64.substring(i, i + 76));
    }
    base64Content = lines.join("\r\n");
    console.log(`Base64 conversion complete, size: ${base64Content.length} chars`);
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
    `Content-Transfer-Encoding: 8bit`,
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

  try {
    await connectAndSendTLS(smtpHost, smtpPort, smtpUser, smtpPass, fromEmail, to, emailBody);
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
