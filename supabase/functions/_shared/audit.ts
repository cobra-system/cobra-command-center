import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface AuditEntry {
  user_id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
}

/**
 * Log an audit entry. Fire-and-forget — never throws.
 */
export async function logAudit(
  supabaseAdmin: SupabaseClient,
  entry: AuditEntry
): Promise<void> {
  try {
    await supabaseAdmin.from("audit_log").insert({
      user_id: entry.user_id,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id ?? null,
      details: entry.details ?? null,
      ip_address: entry.ip_address ?? null,
    });
  } catch {
    // Audit logging should never break the main flow
  }
}

/**
 * Extract client IP from request headers.
 */
export function getClientIp(req: Request): string | undefined {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    undefined
  );
}
