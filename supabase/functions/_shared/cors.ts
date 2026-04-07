/**
 * Shared CORS configuration for all Edge Functions.
 * Restricts access to the configured frontend origin instead of allowing "*".
 */
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "https://cobra-command-center.lovable.app";

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  return null;
}
