import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { text, filename } = await req.json();

    if (!text && !filename) {
      return new Response(JSON.stringify({ error: "No content provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `You are a document classifier for a purchasing/procurement system. Based on the following document content or filename, classify it into one of these categories:
- "PI" (Proforma Invoice / הצעת מחיר)
- "PO" (Purchase Order / הזמנת רכש)
- "PAYMENT" (Payment document / מסמך תשלום)
- "OTHER" (Other document)

Also extract the following if available:
- supplier_name: the supplier/vendor name
- total_amount: total monetary amount
- currency: currency code (USD, EUR, ILS, etc.)
- document_date: date of the document

Document filename: ${filename || "unknown"}
Document content: ${text || "No text extracted"}

Respond ONLY with a JSON object.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        tools: [{
          type: "function",
          function: {
            name: "classify_document",
            description: "Classify a procurement document and extract metadata",
            parameters: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["PI", "PO", "PAYMENT", "OTHER"] },
                supplier_name: { type: "string" },
                total_amount: { type: "number" },
                currency: { type: "string" },
                document_date: { type: "string" },
                confidence: { type: "number", description: "0-1 confidence score" },
              },
              required: ["type", "confidence"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "classify_document" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI classification failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    
    let classification = { type: "OTHER", confidence: 0 };
    if (toolCall?.function?.arguments) {
      try {
        classification = JSON.parse(toolCall.function.arguments);
      } catch {
        // fallback
      }
    }

    return new Response(JSON.stringify(classification), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("classify error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
