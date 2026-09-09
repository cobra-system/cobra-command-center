/**
 * Where the goods-receipt mail (מייל קליטת סחורה) goes by default.
 *
 * The values live in app_config next to the Resend credentials. Only a manager
 * can write them (the ac_manager_all policy), while any signed-in user may read
 * these three keys — the send dialog has to show the sender who the mail is
 * addressed to before they press send.
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PackageCheck, Loader2 } from "lucide-react";

const KEYS = ["goods_receipt_recipient_email", "goods_receipt_cc_emails", "goods_receipt_recipient_name"] as const;

export default function GoodsReceiptSettings() {
  const [recipient, setRecipient] = useState("");
  const [ccEmails, setCcEmails] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from("app_config").select("key, value").in("key", KEYS as unknown as string[]);
      const config = Object.fromEntries((data ?? []).map(r => [r.key, r.value ?? ""]));
      setRecipient(config.goods_receipt_recipient_email ?? "");
      setCcEmails(config.goods_receipt_cc_emails ?? "");
      setRecipientName(config.goods_receipt_recipient_name ?? "");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchConfig(); }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("app_config").upsert([
        { key: "goods_receipt_recipient_email", value: recipient.trim() },
        { key: "goods_receipt_cc_emails", value: ccEmails.trim() },
        { key: "goods_receipt_recipient_name", value: recipientName.trim() },
      ], { onConflict: "key" });
      if (error) throw error;
      toast.success("ההגדרות נשמרו");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שמירת ההגדרות נכשלה");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PackageCheck className="h-4 w-4 text-primary" />
          מייל קליטת סחורה
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          הנמען שאליו נשלח מייל קליטת הסחורה מתיק ההזמנה. אפשר לשנות אותו נקודתית לפני כל שליחה.
        </p>

        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="gr-cfg-to">כתובת הנמען</Label>
                <Input id="gr-cfg-to" dir="ltr" value={recipient}
                  onChange={e => setRecipient(e.target.value)} placeholder="clerk@cobra.co.il" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="gr-cfg-name">שם לפנייה במייל</Label>
                <Input id="gr-cfg-name" value={recipientName}
                  onChange={e => setRecipientName(e.target.value)} placeholder="אלינור" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="gr-cfg-cc">עותק (כתובות מופרדות בפסיקים)</Label>
                <Input id="gr-cfg-cc" dir="ltr" value={ccEmails}
                  onChange={e => setCcEmails(e.target.value)} placeholder="—" />
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
              שמור
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
