import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useData } from "@/contexts/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Bell, Plus, Trash2, Mail, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface DigestConfig {
  id: string;
  digest_enabled: boolean;
  days_of_week: number[];
  include_overdue_orders: boolean;
  include_upcoming_payments: boolean;
  payment_days_ahead: number;
}

interface Recipient {
  id: string;
  profile_id: string | null;
  external_email: string | null;
  external_name: string | null;
  is_enabled: boolean;
  profile_name?: string;
  profile_email?: string;
}

const DAY_LABELS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const DAY_NAMES  = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export default function NotificationSettings() {
  const { profiles } = useData();

  const [config, setConfig]         = useState<DigestConfig | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [saving, setSaving]         = useState(false);
  const [loading, setLoading]       = useState(true);

  const [newEmail, setNewEmail]     = useState("");
  const [newName, setNewName]       = useState("");
  const [addingExternal, setAddingExternal] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: cfgData }, { data: recData }] = await Promise.all([
        supabase.from("notification_digest_config").select("*").limit(1).single(),
        supabase.from("notification_recipients").select("*").order("created_at"),
      ]);
      if (cfgData) setConfig(cfgData as DigestConfig);

      // Enrich recipients with profile email via auth admin lookup is not available
      // on the frontend — we use profiles table for name, and rely on display only
      const enriched: Recipient[] = (recData ?? []).map(r => {
        const profile = r.profile_id ? profiles.find(p => p.id === r.profile_id) : null;
        return {
          ...r,
          profile_name: profile?.name,
          profile_email: undefined, // emails are in auth.users, not exposed to frontend
        };
      });
      setRecipients(enriched);
    } finally {
      setLoading(false);
    }
  }, [profiles]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaveConfig = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("notification_digest_config")
        .update({
          digest_enabled: config.digest_enabled,
          days_of_week: config.days_of_week,
          include_overdue_orders: config.include_overdue_orders,
          include_upcoming_payments: config.include_upcoming_payments,
          payment_days_ahead: config.payment_days_ahead,
          updated_at: new Date().toISOString(),
        })
        .eq("id", config.id);
      if (error) throw error;
      toast.success("הגדרות ההתראות נשמרו");
    } catch {
      toast.error("שגיאה בשמירת הגדרות");
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: number) => {
    if (!config) return;
    const days = config.days_of_week.includes(day)
      ? config.days_of_week.filter(d => d !== day)
      : [...config.days_of_week, day].sort();
    setConfig({ ...config, days_of_week: days });
  };

  const handleToggleRecipient = async (id: string, enabled: boolean) => {
    const { error } = await supabase
      .from("notification_recipients")
      .update({ is_enabled: enabled })
      .eq("id", id);
    if (error) { toast.error("שגיאה בעדכון"); return; }
    setRecipients(prev => prev.map(r => r.id === id ? { ...r, is_enabled: enabled } : r));
  };

  const handleAddProfileRecipient = async (profileId: string) => {
    const already = recipients.find(r => r.profile_id === profileId);
    if (already) { toast.error("משתמש זה כבר ברשימה"); return; }
    const { data, error } = await supabase
      .from("notification_recipients")
      .insert({ profile_id: profileId, is_enabled: true })
      .select()
      .single();
    if (error) { toast.error("שגיאה בהוספה"); return; }
    const profile = profiles.find(p => p.id === profileId);
    setRecipients(prev => [...prev, { ...data, profile_name: profile?.name }]);
    toast.success("נמען נוסף");
  };

  const handleAddExternalRecipient = async () => {
    if (!newEmail.trim() || !newEmail.includes("@")) { toast.error("כתובת מייל לא תקינה"); return; }
    setAddingExternal(true);
    try {
      const { data, error } = await supabase
        .from("notification_recipients")
        .insert({ external_email: newEmail.trim(), external_name: newName.trim() || null, is_enabled: true })
        .select()
        .single();
      if (error) throw error;
      setRecipients(prev => [...prev, data]);
      setNewEmail(""); setNewName("");
      toast.success("נמען חיצוני נוסף");
    } catch {
      toast.error("שגיאה בהוספת נמען");
    } finally {
      setAddingExternal(false);
    }
  };

  const handleRemoveRecipient = async (id: string) => {
    const { error } = await supabase.from("notification_recipients").delete().eq("id", id);
    if (error) { toast.error("שגיאה במחיקה"); return; }
    setRecipients(prev => prev.filter(r => r.id !== id));
    toast.success("נמען הוסר");
  };

  const profilesNotYetAdded = profiles.filter(
    p => !recipients.find(r => r.profile_id === p.id)
  );

  if (loading) return <Card><CardContent className="p-6 text-sm text-muted-foreground">טוען...</CardContent></Card>;
  if (!config)  return <Card><CardContent className="p-6 text-sm text-red-500">שגיאה בטעינת הגדרות</CardContent></Card>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-5 w-5" />
          הגדרות התראות מייל
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Master toggle */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="font-medium">שליחת דוח יומי</p>
            <p className="text-sm text-muted-foreground">סיכום יומי של הזמנות באיחור ותשלומים קרובים</p>
          </div>
          <button
            onClick={() => setConfig({ ...config, digest_enabled: !config.digest_enabled })}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
              config.digest_enabled ? "bg-primary" : "bg-gray-200"
            )}
          >
            <span className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow",
              config.digest_enabled ? "translate-x-6" : "translate-x-1"
            )} />
          </button>
        </div>

        {config.digest_enabled && (
          <>
            {/* Days of week */}
            <div className="space-y-2">
              <Label>ימי שליחה</Label>
              <div className="flex gap-2 flex-wrap">
                {[0, 1, 2, 3, 4, 5, 6].map(day => (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    title={DAY_NAMES[day]}
                    className={cn(
                      "w-10 h-10 rounded-full text-sm font-medium border transition-colors",
                      config.days_of_week.includes(day)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {DAY_LABELS[day]}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">הדוח נשלח ב-08:00 שעון ישראל בימים המסומנים</p>
            </div>

            {/* Content options */}
            <div className="space-y-3">
              <Label>תוכן הדוח</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.include_overdue_orders}
                    onChange={e => setConfig({ ...config, include_overdue_orders: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm">הזמנות באיחור</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.include_upcoming_payments}
                    onChange={e => setConfig({ ...config, include_upcoming_payments: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm">תשלומים קרובים</span>
                </label>
                {config.include_upcoming_payments && (
                  <div className="flex items-center gap-3 mr-7">
                    <span className="text-sm text-muted-foreground">כמה ימים קדימה:</span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={config.payment_days_ahead}
                      onChange={e => setConfig({ ...config, payment_days_ahead: Math.min(30, Math.max(1, Number(e.target.value))) })}
                      className="w-16 border rounded px-2 py-1 text-sm text-center"
                    />
                    <span className="text-sm text-muted-foreground">ימים</span>
                  </div>
                )}
              </div>
            </div>

            <Button onClick={handleSaveConfig} disabled={saving} size="sm">
              {saving ? "שומר..." : "שמור הגדרות"}
            </Button>
          </>
        )}

        {!config.digest_enabled && (
          <Button onClick={handleSaveConfig} disabled={saving} size="sm">
            {saving ? "שומר..." : "שמור"}
          </Button>
        )}

        {/* Recipients */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>נמענים ({recipients.filter(r => r.is_enabled).length} פעילים)</Label>
          </div>

          {/* Existing recipients */}
          {recipients.length > 0 && (
            <div className="space-y-2">
              {recipients.map(r => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    {r.profile_id ? (
                      <User className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {r.profile_id ? (r.profile_name ?? "משתמש מערכת") : (r.external_name || r.external_email)}
                      </p>
                      {r.external_email && (
                        <p className="text-xs text-muted-foreground">{r.external_email}</p>
                      )}
                      {r.profile_id && (
                        <p className="text-xs text-muted-foreground">משתמש מערכת</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleRecipient(r.id, !r.is_enabled)}
                      className={cn(
                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                        r.is_enabled ? "bg-primary" : "bg-gray-200"
                      )}
                    >
                      <span className={cn(
                        "inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform",
                        r.is_enabled ? "translate-x-5" : "translate-x-1"
                      )} />
                    </button>
                    <button
                      onClick={() => handleRemoveRecipient(r.id)}
                      className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add system user */}
          {profilesNotYetAdded.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">הוסף משתמש מערכת:</p>
              <div className="flex flex-wrap gap-2">
                {profilesNotYetAdded.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleAddProfileRecipient(p.id)}
                    className="flex items-center gap-1.5 text-xs border rounded-full px-3 py-1 hover:bg-muted transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add external email */}
          <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground">הוסף כתובת מייל חיצונית:</p>
            <div className="flex gap-2">
              <Input
                placeholder="שם (אופציונלי)"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="text-sm h-8"
              />
              <Input
                placeholder="כתובת מייל"
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                className="text-sm h-8"
              />
              <Button
                size="sm"
                onClick={handleAddExternalRecipient}
                disabled={addingExternal || !newEmail.trim()}
                className="h-8 px-3"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
