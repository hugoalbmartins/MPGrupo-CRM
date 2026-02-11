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

async function sendEmailSMTP(to: string, subject: string, html: string) {
  const smtpHost = Deno.env.get("SMTP_HOST") || "mail.mpgrupo.pt";
  const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
  const smtpUser = Deno.env.get("SMTP_USER") || "info@mpgrupo.pt";
  const smtpPass = Deno.env.get("SMTP_PASS") || "";
  const fromEmail = Deno.env.get("FROM_EMAIL") || "info@mpgrupo.pt";
  const fromName = Deno.env.get("FROM_NAME") || "MP Grupo CRM";

  if (!smtpPass) {
    throw new Error("SMTP_PASS not configured");
  }

  console.log(`[SMTP Alert] Connecting to ${smtpHost}:${smtpPort}`);

  const boundary = `----=_Part_${Date.now()}`;
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
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
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

      console.log(`[SMTP Alert] ${label}: ${fullResponse.substring(0, 120).trim()}`);

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

    console.log(`[SMTP Alert] Sending email body (${emailBody.length} bytes)`);
    await conn!.write(encoder.encode(emailBody + "\r\n.\r\n"));
    await readFullResponse("DATA END", 60000);

    try {
      await writeCommand(`QUIT`);
      await readFullResponse("QUIT", 3000);
    } catch (_e) {
      console.log("[SMTP Alert] QUIT ignored");
    }

    console.log("[SMTP Alert] Email sent successfully");
  } catch (error) {
    console.error("[SMTP Alert] Error:", error.message);
    throw error;
  } finally {
    if (conn) {
      try {
        conn.close();
        console.log("[SMTP Alert] Connection closed");
      } catch (_e) {
        console.error("[SMTP Alert] Error closing connection");
      }
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
    console.error("Error in send-alert-email:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
