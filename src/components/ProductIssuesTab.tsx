import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Plus, Mail, MessageCircle, CheckCircle, ArrowLeft, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ProductIssue {
  id: string;
  product_id: string;
  reported_date: string;
  reporter: string;
  description: string;
  severity: string;
  status: string;
  resolution: string | null;
  resolved_date: string | null;
  ticket_number: string | null;
  diagnostic_source: string | null;
  image_url: string | null;
  created_at: string;
}

const severityColors: Record<string, string> = {
  "נמוך": "bg-muted text-muted-foreground",
  "בינוני": "bg-warning/15 text-warning",
  "גבוה": "bg-destructive/20 text-destructive",
  "קריטי": "bg-destructive text-destructive-foreground",
};

const issueStatusColors: Record<string, string> = {
  "פתוח": "bg-destructive/15 text-destructive",
  "בטיפול": "bg-warning/15 text-warning",
  "נסגר": "bg-success/15 text-success",
};

// Image upload helper
async function uploadIssueImage(file: File): Promise<string | null> {
  const ext = file.name.split(".").pop();
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("issue-images").upload(path, file);
  if (error) { toast.error("שגיאה בהעלאת תמונה"); return null; }
  const { data } = supabase.storage.from("issue-images").getPublicUrl(path);
  return data.publicUrl;
}

// Image picker component
function ImagePicker({ imageFile, setImageFile, previewUrl, setPreviewUrl }: {
  imageFile: File | null; setImageFile: (f: File | null) => void;
  previewUrl: string | null; setPreviewUrl: (u: string | null) => void;
}) {
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast.error("הקובץ גדול מדי (מקסימום 5MB)"); return; }
    setImageFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  return (
    <div className="space-y-1">
      <Label className="text-xs">צילום מסך / תמונה</Label>
      {previewUrl ? (
        <div className="relative inline-block">
          <img src={previewUrl} alt="preview" className="h-24 rounded-lg border object-cover" />
          <button
            type="button"
            onClick={() => { setImageFile(null); setPreviewUrl(null); }}
            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <label className="flex items-center gap-2 border border-dashed rounded-lg p-3 cursor-pointer hover:bg-muted/30 transition-colors">
          <ImagePlus className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">הוסף תמונה</span>
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </label>
      )}
    </div>
  );
}

// Diagnostic Wizard Component
export function DiagnosticWizard({ productId, onClose, onSaved }: { productId: string; onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState(1);
  const [source, setSource] = useState<"app" | "device" | null>(null);
  const [resolved, setResolved] = useState<boolean | null>(null);
  const [ticketNumber, setTicketNumber] = useState("");
  const [reporter, setReporter] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("בינוני");
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const diagnosticSteps: Record<string, string>[] = [];
  if (source) diagnosticSteps.push({ step: "מקור", value: source === "app" ? "אפליקציה" : "מוצר" });
  if (source === "device" && resolved !== null) diagnosticSteps.push({ step: "איפוס", value: resolved ? "הבעיה נפתרה" : "הבעיה נמשכת" });
  if (source === "device" && resolved === false && ticketNumber) diagnosticSteps.push({ step: "פנייה ל-iStar", value: ticketNumber });

  const handleSave = async () => {
    if (!description.trim()) { toast.error("נא להזין תיאור"); return; }
    setSaving(true);

    let imageUrl: string | null = null;
    if (imageFile) imageUrl = await uploadIssueImage(imageFile);

    const status = source === "device" && resolved === true ? "נסגר" : "פתוח";
    const resolvedDate = resolved === true ? new Date().toISOString().split("T")[0] : null;

    await supabase.from("product_issues").insert({
      product_id: productId,
      reporter: reporter.trim() || "לא צוין",
      description: description.trim(),
      severity,
      status,
      resolved_date: resolvedDate,
      resolution: resolved === true ? "נפתר לאחר איפוס מצלמה" : null,
      ticket_number: ticketNumber || null,
      diagnostic_source: source,
      diagnostic_steps: diagnosticSteps,
      image_url: imageUrl,
    } as any);

    toast.success("תקלה דווחה בהצלחה");
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className={`h-2 flex-1 rounded-full ${s <= step ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground text-center">מה מקור התקלה?</h3>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => { setSource("app"); setStep(4); }}>
              <span className="text-2xl">📱</span>
              <span>תקלה באפליקציה</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => { setSource("device"); setStep(2); }}>
              <span className="text-2xl">📷</span>
              <span>תקלה במוצר</span>
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 text-center">
            <h3 className="font-semibold text-foreground mb-2">בקש מהלקוח לחיצה ארוכה לאיפוס המצלמה</h3>
            <p className="text-sm text-muted-foreground">לחיצה ארוכה על כפתור ההפעלה למשך 10 שניות</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-16 flex-col gap-1 border-success/50 hover:bg-success/10" onClick={() => { setResolved(true); setStep(4); }}>
              <CheckCircle className="h-5 w-5 text-success" />
              <span className="text-sm">הבעיה נפתרה ✅</span>
            </Button>
            <Button variant="outline" className="h-16 flex-col gap-1 border-warning/50 hover:bg-warning/10" onClick={() => { setResolved(false); setStep(3); }}>
              <ArrowLeft className="h-5 w-5 text-warning" />
              <span className="text-sm">הבעיה נמשכת ➡️</span>
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground">שלח פנייה ל-iStar</h3>
          <Button variant="outline" className="w-full justify-start gap-2" asChild>
            <a href="mailto:support@istar.com.tw?subject=PROOF%20Issue%20Report">
              <Mail className="h-4 w-4 text-primary" />
              שלח אימייל ל- support@istar.com.tw
            </a>
          </Button>
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 flex items-start gap-2">
            <MessageCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <p className="text-sm text-warning font-medium">⚠️ אל תשכח לעדכן גם ב-WeChat</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">מספר פנייה (Ticket Number)</Label>
            <Input value={ticketNumber} onChange={e => setTicketNumber(e.target.value)} placeholder="T-XXXXX" dir="ltr" />
          </div>
          <Button onClick={() => setStep(4)} className="w-full">המשך לסיכום</Button>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground">סיכום ושמירה</h3>
          {diagnosticSteps.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <p className="text-xs font-medium text-foreground mb-1">מהלך אבחון:</p>
              {diagnosticSteps.map((ds, i) => (
                <p key={i} className="text-xs text-muted-foreground">{ds.step}: <span className="text-foreground">{ds.value}</span></p>
              ))}
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">מדווח</Label>
            <Input value={reporter} onChange={e => setReporter(e.target.value)} placeholder="שם הלקוח / טכנאי" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">תיאור התקלה *</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="תאר את הבעיה..." />
          </div>
          <ImagePicker imageFile={imageFile} setImageFile={setImageFile} previewUrl={previewUrl} setPreviewUrl={setPreviewUrl} />
          <div className="space-y-1">
            <Label className="text-xs">חומרה</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="נמוך">נמוך</SelectItem>
                <SelectItem value="בינוני">בינוני</SelectItem>
                <SelectItem value="גבוה">גבוה</SelectItem>
                <SelectItem value="קריטי">קריטי</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSave} disabled={saving || !description.trim()} className="w-full">
            {saving ? "שומר..." : "דווח תקלה"}
          </Button>
        </div>
      )}
    </div>
  );
}

// Simple form for non-PROOF products
export function SimpleIssueForm({ productId, onClose, onSaved }: { productId: string; onClose: () => void; onSaved: () => void }) {
  const [reporter, setReporter] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("בינוני");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!description.trim()) return;
    setSaving(true);

    let imageUrl: string | null = null;
    if (imageFile) imageUrl = await uploadIssueImage(imageFile);

    await supabase.from("product_issues").insert({
      product_id: productId,
      reporter: reporter.trim() || "לא צוין",
      description: description.trim(),
      severity,
      image_url: imageUrl,
    } as any);
    toast.success("תקלה דווחה בהצלחה");
    setSaving(false);
    onClose();
    onSaved();
  };

  return (
    <div className="space-y-3 pt-2">
      <div className="space-y-1">
        <Label>מדווח</Label>
        <Input value={reporter} onChange={e => setReporter(e.target.value)} placeholder="שם הלקוח / טכנאי" />
      </div>
      <div className="space-y-1">
        <Label>תיאור התקלה *</Label>
        <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="תאר את הבעיה..." />
      </div>
      <ImagePicker imageFile={imageFile} setImageFile={setImageFile} previewUrl={previewUrl} setPreviewUrl={setPreviewUrl} />
      <div className="space-y-1">
        <Label>חומרה</Label>
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="נמוך">נמוך</SelectItem>
            <SelectItem value="בינוני">בינוני</SelectItem>
            <SelectItem value="גבוה">גבוה</SelectItem>
            <SelectItem value="קריטי">קריטי</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button onClick={handleAdd} disabled={saving || !description.trim()} className="w-full">
        {saving ? "שומר..." : "דווח תקלה"}
      </Button>
    </div>
  );
}

export default function ProductIssuesTab({ productId, productName }: { productId: string; productName?: string }) {
  const [issues, setIssues] = useState<ProductIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewImage, setViewImage] = useState<string | null>(null);

  const isProof = productName ? /proof|פרוף/i.test(productName) : false;

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("product_issues")
      .select("*")
      .eq("product_id", productId)
      .order("reported_date", { ascending: false });
    if (data) setIssues(data as ProductIssue[]);
    setLoading(false);
  }, [productId]);

  useEffect(() => { fetchIssues(); }, [fetchIssues]);

  const updateIssueStatus = async (issueId: string, newStatus: string) => {
    const updates: Record<string, any> = { status: newStatus };
    if (newStatus === "נסגר") updates.resolved_date = new Date().toISOString().split("T")[0];
    await supabase.from("product_issues").update(updates).eq("id", issueId);
    toast.success(`סטטוס עודכן ל-${newStatus}`);
    fetchIssues();
  };

  const openCount = issues.filter(i => i.status !== "נסגר").length;

  if (loading) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <h2 className="text-lg font-semibold text-foreground">⚠️ תקלות</h2>
          {openCount > 0 && (
            <span className="bg-destructive/15 text-destructive text-xs px-2 py-0.5 rounded-full font-medium">
              {openCount} פתוחות
            </span>
          )}
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm"><Plus className="h-3 w-3 ml-1" />דווח תקלה</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>{isProof ? "אבחון תקלה — PROOF" : "דיווח תקלה חדשה"}</DialogTitle></DialogHeader>
            {isProof ? (
              <DiagnosticWizard productId={productId} onClose={() => setDialogOpen(false)} onSaved={fetchIssues} />
            ) : (
              <SimpleIssueForm productId={productId} onClose={() => setDialogOpen(false)} onSaved={fetchIssues} />
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Image viewer dialog */}
      <Dialog open={!!viewImage} onOpenChange={() => setViewImage(null)}>
        <DialogContent className="sm:max-w-lg p-2">
          {viewImage && <img src={viewImage} alt="issue" className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>

      {issues.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">אין תקלות מתועדות למוצר זה 🎉</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-right p-3 font-semibold text-foreground">תאריך</th>
                <th className="text-right p-3 font-semibold text-foreground">מדווח</th>
                <th className="text-right p-3 font-semibold text-foreground">תיאור</th>
                <th className="text-right p-3 font-semibold text-foreground">תמונה</th>
                <th className="text-right p-3 font-semibold text-foreground">חומרה</th>
                <th className="text-right p-3 font-semibold text-foreground">סטטוס</th>
                <th className="text-right p-3 font-semibold text-foreground">פנייה</th>
                <th className="text-right p-3 font-semibold text-foreground">פעולה</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {issues.map(issue => (
                <tr key={issue.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-3 text-muted-foreground text-xs">{format(new Date(issue.reported_date), "dd/MM/yy")}</td>
                  <td className="p-3 text-foreground">{issue.reporter}</td>
                  <td className="p-3 text-foreground max-w-[300px] truncate">{issue.description}</td>
                  <td className="p-3">
                    {issue.image_url ? (
                      <img
                        src={issue.image_url}
                        alt="תקלה"
                        className="h-10 w-10 rounded object-cover cursor-pointer border hover:opacity-80 transition-opacity"
                        onClick={() => setViewImage(issue.image_url)}
                      />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityColors[issue.severity] || "bg-muted text-muted-foreground"}`}>
                      {issue.severity}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${issueStatusColors[issue.status] || "bg-muted text-muted-foreground"}`}>
                      {issue.status}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground font-mono">{issue.ticket_number || "—"}</td>
                  <td className="p-3">
                    {issue.status === "פתוח" && (
                      <Button variant="outline" size="sm" onClick={() => updateIssueStatus(issue.id, "בטיפול")}>בטיפול</Button>
                    )}
                    {issue.status === "בטיפול" && (
                      <Button variant="outline" size="sm" className="border-success/50 text-success hover:bg-success/10" onClick={() => updateIssueStatus(issue.id, "נסגר")}>סגור</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
