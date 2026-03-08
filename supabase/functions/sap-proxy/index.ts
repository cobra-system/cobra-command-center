import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SapSession {
  sessionId: string;
  expiresAt: number;
}

let cachedSession: SapSession | null = null;

async function getSapSession(): Promise<string> {
  const now = Date.now();
  if (cachedSession && cachedSession.expiresAt > now) {
    return cachedSession.sessionId;
  }

  const sapUrl = Deno.env.get("SAP_SERVICE_LAYER_URL");
  const companyDb = Deno.env.get("SAP_COMPANY_DB");
  const username = Deno.env.get("SAP_USERNAME");
  const password = Deno.env.get("SAP_PASSWORD");

  if (!sapUrl || !companyDb || !username || !password) {
    throw new Error("SAP credentials not configured");
  }

  const loginRes = await fetch(`${sapUrl}/Login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      CompanyDB: companyDb,
      UserName: username,
      Password: password,
    }),
  });

  if (!loginRes.ok) {
    const errText = await loginRes.text();
    throw new Error(`SAP Login failed: ${errText}`);
  }

  const loginData = await loginRes.json();
  const sessionId = loginData.SessionId;

  // Session valid for 25 minutes (SAP default is 30)
  cachedSession = {
    sessionId,
    expiresAt: now + 25 * 60 * 1000,
  };

  return sessionId;
}

async function sapRequest(method: string, endpoint: string, body?: any): Promise<any> {
  const sapUrl = Deno.env.get("SAP_SERVICE_LAYER_URL");
  const sessionId = await getSapSession();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cookie": `B1SESSION=${sessionId}`,
  };

  const res = await fetch(`${sapUrl}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    // Session expired, retry once
    cachedSession = null;
    const newSessionId = await getSapSession();
    headers["Cookie"] = `B1SESSION=${newSessionId}`;
    const retryRes = await fetch(`${sapUrl}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!retryRes.ok) {
      const errText = await retryRes.text();
      throw new Error(`SAP request failed: ${errText}`);
    }
    return retryRes.json();
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`SAP request failed: ${errText}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return { status: "ok" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, method, endpoint, body } = await req.json();

    // Test connection
    if (action === "test") {
      try {
        await getSapSession();
        return new Response(JSON.stringify({ success: true, message: "Connected to SAP B1" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ success: false, message: e.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Sync items (products)
    if (action === "sync-items") {
      const data = await sapRequest("GET", "/Items?$select=ItemCode,ItemName,ItemType,QuantityOnStock,AvgStdPrice&$top=500");
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sync business partners (suppliers)
    if (action === "sync-suppliers") {
      const data = await sapRequest("GET", "/BusinessPartners?$filter=CardType eq 'S'&$select=CardCode,CardName,EmailAddress,Phone1,Country,Website&$top=500");
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sync warehouses
    if (action === "sync-warehouses") {
      const data = await sapRequest("GET", "/Warehouses?$select=WarehouseCode,WarehouseName,City,Street");
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create purchase order
    if (action === "create-po") {
      const data = await sapRequest("POST", "/PurchaseOrders", body);
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get stock by warehouse
    if (action === "stock-by-warehouse") {
      const data = await sapRequest("GET", `/Items('${body.itemCode}')?$select=ItemWarehouseInfoCollection`);
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generic proxy
    if (action === "proxy") {
      const data = await sapRequest(method || "GET", endpoint, body);
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
