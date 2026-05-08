import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { useData, type Role, type RoleDefinition } from "@/contexts/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { UserPlus, Check, X, Mail, Briefcase, Clock } from "lucide-react";
import { DIVISIONS } from "@/components/equipment/constants";

interface SignupRequest {
  id: string;
  email: string;
  name: string;
  message: string | null;
  requested_role: string | null;
  provider: string;
  status: "pending" | "approved" | "rejected";
  reject_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
}

const VALID_BASE_ROLES: Role[] = ["MANAGER", "WAREHOUSE_MANAGER", "LOGISTICS", "DRIVER"];

export default function SignupRequestsPanel() {
  const { roleDefinitions } = useData();
  const [requests, setRequests] = useState<SignupRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const [reviewing, setReviewing] = useState<SignupRequest | null>(null);
  const [mode, setMode] = useState<"approve" | "reject">("approve");
  const [submitting, setSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [roleDefId, setRoleDefId] = useState<string>("");
  const [division, setDivision] = useState<string>("");
  const [rejectReason, setRejectReason] = useState("");

  const nonManagerRoleDefs = useMemo(
    () => roleDefinitions.filter(rd => rd.system_key !== "MANAGER"),
    [roleDefinitions],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    // signup_requests is not yet in the generated Database types — query through a helper.
    type Query = {
      eq: (c: string, v: string) => Query;
      then: <T>(cb: (r: { data: SignupRequest[] | null; error: { message: string } | null }) => T) => Promise<T>;
    };
    const client = supabase as unknown as { from: (t: string) => { select: (s: string) => { order: (c: string, o: { ascending: boolean }) => Query } } };
    let q: Query = client.from("signup_requests").select("*").order("created_at", { ascending: false });
    if (filter === "pending") q = q.eq("status", "pending");
    const { data, error } = (await q) as { data: SignupRequest[] | null; error: { message: string } | null };
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRequests((data ?? []) as SignupRequest[]);
  }, [filter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openApprove = (r: SignupRequest) => {
    setReviewing(r);
    setMode("approve");
    setName(r.name);
    setPassword(generatePassword());
    setRoleDefId("");
    setDivision("");
  };

  const openReject = (r: SignupRequest) => {
    setReviewing(r);
    setMode("reject");
    setRejectReason("");
  };

  const close = () => {
    setReviewing(null);
    setSubmitting(false);
    setPassword("");
    setName("");
    setRoleDefId("");
    setDivision("");
    setRejectReason("");
  };

  const submit = async () => {
    if (!reviewing) return;
    setSubmitting(true);
    try {
      const sess = await supabase.auth.getSession();
      const token = sess.data.session?.access_token;
      if (!token) {
        toast.error("נדרשת כניסה מחדש");
        setSubmitting(false);
        return;
      }

      let body: Record<string, unknown>;
      if (mode === "approve") {
        const selectedRd = nonManagerRoleDefs.find(rd => rd.id === roleDefId);
        const sysKey = selectedRd?.system_key as Role | undefined;
        const resolvedRole: Role = sysKey && VALID_BASE_ROLES.includes(sysKey) ? sysKey : "DRIVER";
        if (!password || password.length < 8) {
          toast.error("סיסמה צריכה להיות באורך 8 תווים לפחות");
          setSubmitting(false);
          return;
        }
        body = {
          action: "approve",
          request_id: reviewing.id,
          role: resolvedRole,
          password,
          name: name.trim() || reviewing.name,
          role_definition_id: selectedRd?.id ?? null,
          division: division || null,
        };
      } else {
        body = {
          action: "reject",
          request_id: reviewing.id,
          reason: rejectReason.trim() || null,
        };
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/review-signup-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "שגיאה");
      } else {
        toast.success(mode === "approve" ? "המשתמש אושר ונשלח לו מייל" : "הבקשה נדחתה");
        close();
        await refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בחיבור לשרת");
    }
    setSubmitting(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-lg">
            <UserPlus className="h-5 w-5" />
            בקשות הרשמה
            {requests.filter(r => r.status === "pending").length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {requests.filter(r => r.status === "pending").length}
              </Badge>
            )}
          </span>
          <div className="flex gap-2">
            <Button
              variant={filter === "pending" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("pending")}
            >
              ממתינות
            </Button>
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              הכל
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-6">טוען...</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {filter === "pending" ? "אין בקשות ממתינות" : "אין בקשות"}
          </p>
        ) : (
          <div className="space-y-3">
            {requests.map(r => (
              <RequestRow
                key={r.id}
                request={r}
                onApprove={() => openApprove(r)}
                onReject={() => openReject(r)}
              />
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={!!reviewing} onOpenChange={(open) => !open && close()}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {mode === "approve" ? "אישור בקשת הרשמה" : "דחיית בקשת הרשמה"}
            </DialogTitle>
            <DialogDescription>
              {reviewing?.email} {reviewing?.name && `· ${reviewing.name}`}
            </DialogDescription>
          </DialogHeader>

          {mode === "approve" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>שם מלא</Label>
                <Input value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>תפקיד</Label>
                <Select value={roleDefId} onValueChange={setRoleDefId}>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר תפקיד..." />
                  </SelectTrigger>
                  <SelectContent>
                    {nonManagerRoleDefs.map((rd: RoleDefinition) => (
                      <SelectItem key={rd.id} value={rd.id}>{rd.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>אגף (אופציונלי)</Label>
                <Select value={division || "__none__"} onValueChange={v => setDivision(v === "__none__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="ללא אגף" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">ללא אגף</SelectItem>
                    {DIVISIONS.map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>סיסמה זמנית</Label>
                <div className="flex gap-2">
                  <Input
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    dir="ltr"
                    className="text-left font-mono"
                  />
                  <Button type="button" variant="outline" onClick={() => setPassword(generatePassword())}>
                    הגרל
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  הסיסמה תישלח למשתמש במייל. מומלץ לבקש להחליף לאחר הכניסה הראשונה.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>סיבת הדחייה (אופציונלי)</Label>
              <Textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
                placeholder="הסבר קצר שיישלח למבקש..."
              />
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={close} disabled={submitting}>ביטול</Button>
            <Button
              onClick={submit}
              disabled={submitting}
              variant={mode === "reject" ? "destructive" : "default"}
            >
              {submitting ? "שולח..." : mode === "approve" ? "אישור והקמת חשבון" : "דחה בקשה"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function RequestRow({
  request, onApprove, onReject,
}: { request: SignupRequest; onApprove: () => void; onReject: () => void }) {
  const isPending = request.status === "pending";
  return (
    <div className="border rounded-lg p-3 bg-background">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">{request.name}</span>
            <StatusBadge status={request.status} />
            {request.provider === "google" && (
              <Badge variant="outline" className="text-xs">Google</Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
            <span dir="ltr">{request.email}</span>
          </div>
          {request.requested_role && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Briefcase className="h-3.5 w-3.5" />
              {request.requested_role}
            </div>
          )}
          {request.message && (
            <p className="text-sm text-foreground/80 mt-2 whitespace-pre-wrap break-words">
              {request.message}
            </p>
          )}
          {request.reject_reason && (
            <p className="text-sm text-destructive mt-2 whitespace-pre-wrap break-words">
              סיבת דחייה: {request.reject_reason}
            </p>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <Clock className="h-3 w-3" />
            {new Date(request.created_at).toLocaleString("he-IL")}
          </div>
        </div>
        {isPending && (
          <div className="flex gap-2 shrink-0">
            <Button size="sm" onClick={onApprove}>
              <Check className="h-4 w-4 ml-1" /> אישור
            </Button>
            <Button size="sm" variant="outline" onClick={onReject}>
              <X className="h-4 w-4 ml-1" /> דחה
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: SignupRequest["status"] }) {
  if (status === "pending") return <Badge variant="secondary">ממתין</Badge>;
  if (status === "approved") return <Badge className="bg-emerald-600">אושר</Badge>;
  return <Badge variant="destructive">נדחה</Badge>;
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  for (const n of arr) out += chars[n % chars.length];
  return out;
}
