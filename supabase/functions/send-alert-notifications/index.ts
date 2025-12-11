import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Recipient {
  email: string;
  name: string;
}

interface NotificationPayload {
  recipients: Recipient[];
  subject: string;
  message: string;
  sale_code: string;
  alert_type: 'new_sale' | 'status_change' | 'note_added';
}

function getEmailTemplate(
  recipientName: string,
  subject: string,
  message: string,
  saleCode: string,
  alertType: string
): string {
  const typeLabels = {
    new_sale: 'Nova Venda',
    status_change: 'Alteração de Estado',
    note_added: 'Nova Nota/Resposta'
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
        .alert-badge { display: inline-block; padding: 8px 16px; background: #3b82f6; color: white; border-radius: 20px; font-size: 14px; margin-bottom: 20px; }
        .sale-code { font-size: 24px; font-weight: bold; color: #1e3a8a; margin: 20px 0; }
        .message-box { background: white; padding: 20px; border-left: 4px solid #3b82f6; margin: 20px 0; border-radius: 4px; }
        .footer { background: #1f2937; color: #9ca3af; padding: 20px; text-align: center; font-size: 12px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>MP Grupo CRM</h1>
          <p style="margin: 0; opacity: 0.9;">Sistema de Alertas</p>
        </div>
        <div class="content">
          <p>Olá <strong>${recipientName}</strong>,</p>

          <div class="alert-badge">${typeLabels[alertType] || alertType}</div>

          <div class="sale-code">Venda: ${saleCode}</div>

          <div class="message-box">
            <p style="margin: 0;"><strong>Detalhes:</strong></p>
            <p style="margin: 10px 0 0 0;">${message}</p>
          </div>

          <p>
            <a href="${Deno.env.get('APP_URL') || 'https://crm.mpgrupo.pt'}/sales" class="button">
              Ver Detalhes da Venda
            </a>
          </p>

          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Esta é uma notificação automática do sistema CRM. Por favor, não responda a este email.
          </p>
        </div>
        <div class="footer">
          <p style="margin: 0;">© ${new Date().getFullYear()} MP Grupo. Todos os direitos reservados.</p>
          <p style="margin: 10px 0 0 0;">Sistema de Gestão CRM</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { recipients, subject, message, sale_code, alert_type }: NotificationPayload = await req.json();

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: "No recipients provided" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!subject || !message || !sale_code) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: subject, message, sale_code" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.log("RESEND_API_KEY not configured - emails not sent (dev mode)");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Dev mode - emails logged but not sent",
          recipients: recipients.length
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const emailPromises = recipients.map(async (recipient) => {
      try {
        const html = getEmailTemplate(
          recipient.name,
          subject,
          message,
          sale_code,
          alert_type
        );

        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "CRM MP Grupo <noreply@mpgrupo.pt>",
            to: [recipient.email],
            subject: subject,
            html: html,
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          console.error(`Failed to send email to ${recipient.email}:`, error);
          return { recipient: recipient.email, success: false, error };
        }

        const data = await response.json();
        console.log(`Email sent successfully to ${recipient.email}`);
        return { recipient: recipient.email, success: true, messageId: data.id };
      } catch (error) {
        console.error(`Error sending email to ${recipient.email}:`, error);
        return { recipient: recipient.email, success: false, error: error.message };
      }
    });

    const results = await Promise.allSettled(emailPromises);

    const successCount = results.filter(
      r => r.status === 'fulfilled' && r.value.success
    ).length;

    const failedCount = results.length - successCount;

    return new Response(
      JSON.stringify({
        success: true,
        totalRecipients: recipients.length,
        sent: successCount,
        failed: failedCount,
        results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false })
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing notification request:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});