import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ContactData {
  nome: string;
  email: string;
  telefone?: string;
  mensagem: string;
  simulacao?: {
    custoAtual: number;
    operadoraSelecionada?: string;
    custoNovo?: number;
    poupancaMensal?: number;
    poupancaAnual?: number;
  };
  pdfBase64?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const data: ContactData = await req.json();

    const { nome, email, telefone, mensagem, simulacao, pdfBase64 } = data;

    if (!nome || !email || !mensagem) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios em falta" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #FFC107 0%, #FF9800 100%);
              color: #1a1a1a;
              padding: 30px;
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .content {
              background: #f9f9f9;
              padding: 30px;
              border-radius: 0 0 8px 8px;
            }
            .section {
              background: white;
              padding: 20px;
              margin: 20px 0;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .label {
              font-weight: bold;
              color: #666;
              margin-bottom: 5px;
            }
            .value {
              color: #333;
              margin-bottom: 15px;
            }
            .simulacao {
              background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
              color: white;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .simulacao-item {
              display: flex;
              justify-content: space-between;
              margin: 10px 0;
              padding: 10px 0;
              border-bottom: 1px solid rgba(255,255,255,0.2);
            }
            .simulacao-item:last-child {
              border-bottom: none;
            }
            .highlight {
              font-size: 24px;
              font-weight: bold;
            }
            .footer {
              text-align: center;
              padding: 20px;
              color: #666;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin: 0;">MP GRUPO</h1>
            <p style="margin: 10px 0 0 0;">Novo Contacto do Simulador de Energia</p>
          </div>

          <div class="content">
            <div class="section">
              <h2 style="color: #FFC107; margin-top: 0;">Dados do Cliente</h2>
              <div class="label">Nome:</div>
              <div class="value">${nome}</div>

              <div class="label">Email:</div>
              <div class="value">${email}</div>

              ${telefone ? `
                <div class="label">Telefone:</div>
                <div class="value">${telefone}</div>
              ` : ''}

              <div class="label">Mensagem:</div>
              <div class="value">${mensagem}</div>
            </div>

            ${simulacao ? `
              <div class="simulacao">
                <h2 style="margin-top: 0; color: white;">Dados da Simulação</h2>

                <div class="simulacao-item">
                  <span>Custo Atual Mensal:</span>
                  <span class="highlight">€${simulacao.custoAtual.toFixed(2)}</span>
                </div>

                ${simulacao.operadoraSelecionada ? `
                  <div class="simulacao-item">
                    <span>Operadora de Interesse:</span>
                    <span><strong>${simulacao.operadoraSelecionada}</strong></span>
                  </div>

                  <div class="simulacao-item">
                    <span>Novo Custo Mensal:</span>
                    <span class="highlight">€${simulacao.custoNovo?.toFixed(2) || '0.00'}</span>
                  </div>

                  <div class="simulacao-item">
                    <span>Poupança Mensal:</span>
                    <span class="highlight" style="color: #FFD700;">€${simulacao.poupancaMensal?.toFixed(2) || '0.00'}</span>
                  </div>

                  <div class="simulacao-item">
                    <span>Poupança Anual:</span>
                    <span class="highlight" style="color: #FFD700;">€${simulacao.poupancaAnual?.toFixed(2) || '0.00'}</span>
                  </div>
                ` : ''}
              </div>
            ` : ''}

            ${pdfBase64 ? `
              <div class="section">
                <p><strong>Nota:</strong> Simulação detalhada em anexo (PDF).</p>
              </div>
            ` : ''}
          </div>

          <div class="footer">
            <p>Este email foi enviado automaticamente através do Simulador de Energia MP GRUPO.</p>
            <p>Data: ${new Date().toLocaleString('pt-PT')}</p>
          </div>
        </body>
      </html>
    `;

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const emailData: any = {
      from: "MP GRUPO Simulador <noreply@mpgrupo.pt>",
      to: ["geral@mpgrupo.pt"],
      subject: `Novo Contacto Simulador - ${nome}`,
      html: emailHtml,
    };

    if (pdfBase64) {
      emailData.attachments = [
        {
          filename: `Simulacao_${nome.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
          content: pdfBase64,
          encoding: "base64",
        },
      ];
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify(emailData),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.text();
      console.error("Resend API error:", errorData);
      throw new Error(`Failed to send email: ${errorData}`);
    }

    const result = await resendResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email enviado com sucesso",
        emailId: result.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in send-simulator-contact:", error);
    return new Response(
      JSON.stringify({
        error: "Erro ao enviar email",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
