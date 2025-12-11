import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

async function sendEmailSMTP(to: string, subject: string, html: string) {
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

  const conn = await Deno.connect({
    hostname: smtpHost,
    port: smtpPort,
    transport: "tcp",
  });

  const tls = await Deno.startTls(conn, { hostname: smtpHost });
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const reader = tls.readable.getReader();
  const writer = tls.writable.getWriter();

  async function readResponse(): Promise<string> {
    const { value } = await reader.read();
    return decoder.decode(value);
  }

  async function sendCommand(command: string): Promise<string> {
    await writer.write(encoder.encode(command + "\r\n"));
    return await readResponse();
  }

  try {
    await readResponse();
    await sendCommand(`EHLO ${smtpHost}`);
    await sendCommand(`AUTH LOGIN`);
    await sendCommand(btoa(smtpUser));
    await sendCommand(btoa(smtpPass));
    await sendCommand(`MAIL FROM:<${fromEmail}>`);
    await sendCommand(`RCPT TO:<${to}>`);
    await sendCommand(`DATA`);
    await writer.write(encoder.encode(emailBody + "\r\n.\r\n"));
    await readResponse();
    await sendCommand(`QUIT`);
  } finally {
    try {
      await writer.close();
      await reader.cancel();
      tls.close();
    } catch (e) {
      console.error("Error closing connection:", e);
    }
  }

  return messageId;
}

async function sendEmailResend(to: string, subject: string, html: string) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: "noreply@mpgrupo.pt",
      to: [to],
      subject: subject,
      html: html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }

  const data = await response.json();
  return data.id;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { to, subject, html }: EmailPayload = await req.json();

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, html" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const useResend = Deno.env.get("USE_RESEND") === "true";
    let messageId: string;

    try {
      if (useResend) {
        messageId = await sendEmailResend(to, subject, html);
        console.log("Email sent via Resend:", messageId);
      } else {
        messageId = await sendEmailSMTP(to, subject, html);
        console.log("Email sent via SMTP:", messageId);
      }
    } catch (primaryError) {
      console.error(`Failed to send via ${useResend ? 'Resend' : 'SMTP'}:`, primaryError);

      try {
        if (useResend) {
          messageId = await sendEmailSMTP(to, subject, html);
          console.log("Email sent via SMTP (fallback):", messageId);
        } else {
          messageId = await sendEmailResend(to, subject, html);
          console.log("Email sent via Resend (fallback):", messageId);
        }
      } catch (fallbackError) {
        console.error("Fallback also failed:", fallbackError);
        throw primaryError;
      }
    }

    return new Response(
      JSON.stringify({ success: true, messageId }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});