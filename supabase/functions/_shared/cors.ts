/**
 * Shared CORS configuration for all Edge Functions.
 * Uses "*" because every function enforces authentication via JWT (verifyAuth),
 * making origin-based restriction redundant while preventing "Failed to fetch"
 * errors when the app is served from preview or staging URLs.
 */
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  return null;
}
