export async function sendEmailSMTP(to: string, subject: string, html: string) {
  const smtpHost = Deno.env.get("SMTP_HOST") || "cpanel75.dnscpanel.com";
  const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
  const smtpUser = Deno.env.get("SMTP_USER") || "noreply@mpgrupo.pt";
  const smtpPass = Deno.env.get("SMTP_PASS") || "";
  const fromEmail = Deno.env.get("FROM_EMAIL") || "noreply@mpgrupo.pt";
  const fromName = Deno.env.get("FROM_NAME") || "MP Grupo CRM";

  if (!smtpPass) {
    throw new Error("SMTP_PASS not configured");
  }

  const boundary = `----=_Part_${Date.now()}`;
  const messageId = `<${Date.now()}.${Math.random()}@mpgrupo.pt>`;

  const emailBody = [
    `From: ${fromName} <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Message-ID: ${messageId}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
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
