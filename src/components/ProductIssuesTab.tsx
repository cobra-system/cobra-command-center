import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Plus } from "lucide-react";
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

export default function ProductIssuesTab({ productId }: { productId: string }) {
  const [issues, setIssues] = useState<ProductIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [reporter, setReporter] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("בינוני");

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

  const handleAdd = async () => {
    if (!description.trim()) return;
    await supabase.from("product_issues").insert({
      product_id: productId,
      reporter: reporter.trim() || "לא צוין",
      description: description.trim(),
      severity,
    });
    toast.success("תקלה דווחה בהצלחה");
    setDialogOpen(false);
    setReporter(""); setDescription(""); setSeverity("בינוני");
    fetchIssues();
  };

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
            <DialogHeader><DialogTitle>דיווח תקלה חדשה</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label>מדווח</Label>
                <Input value={reporter} onChange={e => setReporter(e.target.value)} placeholder="שם הלקוח / טכנאי" />
              </div>
              <div className="space-y-1">
                <Label>תיאור התקלה *</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="תאר את הבעיה..." />
              </div>
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
              <Button onClick={handleAdd} disabled={!description.trim()} className="w-full">דווח תקלה</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

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
                <th className="text-right p-3 font-semibold text-foreground">חומרה</th>
                <th className="text-right p-3 font-semibold text-foreground">סטטוס</th>
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
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityColors[issue.severity] || "bg-muted text-muted-foreground"}`}>
                      {issue.severity}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${issueStatusColors[issue.status] || "bg-muted text-muted-foreground"}`}>
                      {issue.status}
                    </span>
                  </td>
                  <td className="p-3">
                    {issue.status === "פתוח" && (
                      <Button variant="outline" size="sm" onClick={() => updateIssueStatus(issue.id, "בטיפול")}>בטיפול</Button>
                    )}
                    {issue.status === "בטיפול" && (
                      <Button variant="success" size="sm" onClick={() => updateIssueStatus(issue.id, "נסגר")}>סגור</Button>
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
