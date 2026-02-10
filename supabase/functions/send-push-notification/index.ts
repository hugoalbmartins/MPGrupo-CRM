import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const VAPID_PUBLIC_KEY =
  "BJEE_mv62Tnt5wGmJHwMCrjHii0ocGmAjFZKJ87to6AG1YdQ8hVNIILMKdMzyajjcdey2tc5BGmIGMLbdXXZ0b0";
const VAPID_PRIVATE_KEY = "hAx1UdVSfpo0lfrd4VboseBSxTsSbXgIFj2UXeSRFo";
const VAPID_SUBJECT = "mailto:info@mpgrupo.pt";

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const array = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    array[i] = rawData.charCodeAt(i);
  }
  return array;
}

function uint8ArrayToBase64Url(array: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < array.length; i++) {
    binary += String.fromCharCode(array[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function importVapidKeys() {
  const publicKeyBytes = base64UrlToUint8Array(VAPID_PUBLIC_KEY);
  const privateKeyBytes = base64UrlToUint8Array(VAPID_PRIVATE_KEY);

  const rawKey = new Uint8Array(65 + 32);
  rawKey.set(publicKeyBytes, 0);
  rawKey.set(privateKeyBytes, 65);

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    buildPkcs8(privateKeyBytes, publicKeyBytes),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  return { privateKey, publicKeyBytes };
}

function buildPkcs8(
  privateKeyBytes: Uint8Array,
  publicKeyBytes: Uint8Array
): ArrayBuffer {
  const pkcs8Header = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86,
    0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);

  const pkcs8Middle = new Uint8Array([0xa1, 0x44, 0x03, 0x42, 0x00]);

  const result = new Uint8Array(
    pkcs8Header.length +
      privateKeyBytes.length +
      pkcs8Middle.length +
      publicKeyBytes.length
  );
  let offset = 0;
  result.set(pkcs8Header, offset);
  offset += pkcs8Header.length;
  result.set(privateKeyBytes, offset);
  offset += privateKeyBytes.length;
  result.set(pkcs8Middle, offset);
  offset += pkcs8Middle.length;
  result.set(publicKeyBytes, offset);

  return result.buffer;
}

async function createVapidAuthHeader(
  endpoint: string,
  privateKey: CryptoKey
): Promise<string> {
  const endpointUrl = new URL(endpoint);
  const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;

  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: VAPID_SUBJECT,
  };

  const headerB64 = uint8ArrayToBase64Url(
    new TextEncoder().encode(JSON.stringify(header))
  );
  const payloadB64 = uint8ArrayToBase64Url(
    new TextEncoder().encode(JSON.stringify(payload))
  );

  const signInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    signInput
  );

  const signatureBytes = new Uint8Array(signature);
  const signatureB64 = uint8ArrayToBase64Url(signatureBytes);

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth_key: string },
  payload: string,
  privateKey: CryptoKey,
  publicKeyBytes: Uint8Array
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  try {
    const jwt = await createVapidAuthHeader(subscription.endpoint, privateKey);

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        Authorization: `vapid t=${jwt}, k=${uint8ArrayToBase64Url(publicKeyBytes)}`,
        "Content-Type": "application/json",
        TTL: "86400",
      },
      body: payload,
    });

    if (response.ok || response.status === 201) {
      return { success: true, statusCode: response.status };
    }

    const errorText = await response.text().catch(() => "unknown");
    if (response.status === 410 || response.status === 404) {
      return {
        success: false,
        statusCode: response.status,
        error: `Subscription expired: ${errorText}`,
      };
    }

    return {
      success: false,
      statusCode: response.status,
      error: `Push failed: ${response.status} ${errorText}`,
    };
  } catch (error) {
    return { success: false, error: `Network error: ${error.message}` };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { user_id, title, body, data } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user_id);

    if (subError) {
      console.error("Error fetching subscriptions:", subError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch subscriptions" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({
          message: "No subscriptions found for user",
          sent: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let vapidKeys: { privateKey: CryptoKey; publicKeyBytes: Uint8Array };
    try {
      vapidKeys = await importVapidKeys();
    } catch (err) {
      console.error("VAPID key import failed, falling back to simple push:", err);
      vapidKeys = null as any;
    }

    const pushPayload = JSON.stringify({
      title: title || "CRM MPGrupo",
      body: body || "Nova notificacao",
      tag: data?.type ? `${data.type}-${data.sale_code || ""}` : "crm-alert",
      url: data?.url || "/alerts",
      ...data,
    });

    let sent = 0;
    const expiredEndpoints: string[] = [];

    for (const sub of subscriptions) {
      if (vapidKeys) {
        const result = await sendWebPush(sub, pushPayload, vapidKeys.privateKey, vapidKeys.publicKeyBytes);
        if (result.success) {
          sent++;
        } else if (result.statusCode === 410 || result.statusCode === 404) {
          expiredEndpoints.push(sub.endpoint);
        } else {
          console.error(`Push failed for ${sub.endpoint}:`, result.error);
        }
      } else {
        try {
          const response = await fetch(sub.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", TTL: "86400" },
            body: pushPayload,
          });
          if (response.ok || response.status === 201) {
            sent++;
          } else if (response.status === 410 || response.status === 404) {
            expiredEndpoints.push(sub.endpoint);
          }
        } catch (err) {
          console.error(`Simple push failed for ${sub.endpoint}:`, err);
        }
      }
    }

    if (expiredEndpoints.length > 0) {
      for (const endpoint of expiredEndpoints) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user_id)
          .eq("endpoint", endpoint);
      }
      console.log(`Cleaned up ${expiredEndpoints.length} expired subscriptions`);
    }

    return new Response(
      JSON.stringify({
        sent,
        total: subscriptions.length,
        expired_cleaned: expiredEndpoints.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Push notification error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
