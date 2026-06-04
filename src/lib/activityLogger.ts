import { supabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";

interface ActivityEntry {
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
}

/**
 * Fire-and-forget activity logging to the audit_log table.
 * Never throws — activity logging must not break the app.
 */
export async function logActivity(entry: ActivityEntry): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("audit_log" as any).insert({
      user_id: user.id,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      details: entry.details ?? {},
    });

    if (error) {
      logger.warn("Failed to log activity", { error: error.message, action: entry.action });
    }
  } catch (err) {
    logger.warn("Activity logging error", { error: err });
  }
}
