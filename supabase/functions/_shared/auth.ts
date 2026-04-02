/**
 * Shared auth middleware for Edge Functions.
 * Validates JWT tokens and checks user roles.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

export interface AuthResult {
  user: { id: string; email?: string };
  profile: { role: string } | null;
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
}

function getSupabaseAdmin() {
  const url = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, serviceKey);
}

/**
 * Verifies the auth token from the request and returns the authenticated user.
 * Optionally checks if the user has one of the required roles.
 */
export async function verifyAuth(
  req: Request,
  requiredRoles?: string[]
): Promise<{ auth: AuthResult } | { error: string; status: number }> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return { error: "לא מורשה", status: 401 };
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return { error: "לא מורשה", status: 401 };
  }

  const supabaseAdmin = getSupabaseAdmin();

  // Validate token and get user (this verifies expiration server-side)
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !user) {
    return { error: "טוקן לא תקף או פג תוקף", status: 401 };
  }

  // Fetch user profile for role checking
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError) {
    return { error: "שגיאה בשליפת פרופיל המשתמש", status: 500 };
  }

  // Check required roles if specified
  if (requiredRoles && requiredRoles.length > 0) {
    if (!profile || !requiredRoles.includes(profile.role)) {
      return { error: "אין הרשאה מתאימה לפעולה זו", status: 403 };
    }
  }

  return {
    auth: {
      user: { id: user.id, email: user.email },
      profile,
      supabaseAdmin,
    },
  };
}

export { getSupabaseAdmin };
