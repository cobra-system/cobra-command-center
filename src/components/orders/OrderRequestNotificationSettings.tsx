import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, Mail, Smartphone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  pushSupported, getCurrentPermission,
  subscribePush, unsubscribePush,
  setEmailNotifications, getMySubscriptions,
} from "@/lib/pushNotifications";

interface Props {
  /** VAPID public key (must be configured server-side too). Optional: when missing, push is disabled. */
  vapidPublicKey?: string;
}

export function OrderRequestNotificationSettings({ vapidPublicKey }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushActive, setPushActive] = useState(false);
  const [email, setEmail] = useState("");
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const subs = await getMySubscriptions();
      if (cancelled) return;
      setPushActive(subs.pushActive);
      setEmail(subs.email ?? "");
      setEmailEnabled(!!subs.email);
      setPermission(await getCurrentPermission());
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const togglePush = async () => {
    if (!vapidPublicKey) {
      toast.error("Push לא מוגדר במערכת (חסר מפתח VAPID)");
      return;
    }
    setSaving(true);
    if (pushActive) {
      await unsubscribePush();
      setPushActive(false);
      toast.success("התראות Push בוטלו");
    } else {
      const r = await subscribePush(vapidPublicKey);
      if (r.ok) {
        setPushActive(true);
        setPermission("granted");
        toast.success("התראות Push הופעלו במכשיר זה");
      } else {
        toast.error(r.error ?? "שגיאה בהפעלה");
      }
    }
    setSaving(false);
  };

  const saveEmail = async () => {
    setSaving(true);
    if (emailEnabled && email.trim()) {
      await setEmailNotifications(email.trim());
      toast.success("התראות אימייל הופעלו");
    } else {
      await setEmailNotifications(null);
      toast.success("התראות אימייל בוטלו");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
        <Loader2 className="h-4 w-4 animate-spin" /> טוען...
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center gap-2 mb-3">
        <Bell className="h-4 w-4" />
        <h3 className="text-sm font-semibold">התראות בקשות הזמנה</h3>
      </div>

      {/* Email */}
      <div className="rounded-lg border bg-card p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">אימייל</span>
          </div>
          <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} disabled={saving} />
        </div>
        {emailEnabled && (
          <div className="space-y-2">
            <Label className="text-xs">כתובת אימייל</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@example.com"
                disabled={saving}
                dir="ltr"
              />
              <Button size="sm" onClick={saveEmail} disabled={saving || !email.includes("@")}>
                {saving ? "שומר..." : "שמור"}
              </Button>
            </div>
          </div>
        )}
        <div className="text-[11px] text-muted-foreground">
          תקבל אימייל כשבקשה רלוונטית נפתחת, מומשת או נדחית.
        </div>
      </div>

      {/* Push */}
      <div className="rounded-lg border bg-card p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">התראות בדפדפן (Push)</span>
          </div>
          <Switch
            checked={pushActive}
            onCheckedChange={togglePush}
            disabled={saving || !pushSupported() || !vapidPublicKey}
          />
        </div>
        {!pushSupported() && (
          <div className="text-[11px] text-amber-700">הדפדפן הזה לא תומך ב-Push.</div>
        )}
        {pushSupported() && !vapidPublicKey && (
          <div className="text-[11px] text-amber-700">Push לא הוגדר במערכת. נדרשים מפתחות VAPID.</div>
        )}
        {pushSupported() && vapidPublicKey && permission === "denied" && (
          <div className="text-[11px] text-red-700">חסומה ההרשאה לפי הגדרות הדפדפן. שחרר חסימה ידנית כדי להפעיל.</div>
        )}
        <div className="text-[11px] text-muted-foreground">
          ההתראות יופיעו במכשיר הזה גם כשהאתר סגור. ניתן להפעיל בכמה מכשירים.
        </div>
      </div>
    </div>
  );
}
