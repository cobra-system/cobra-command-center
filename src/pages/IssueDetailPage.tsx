import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useRef } from "react";
import { useFileDropPaste } from "@/hooks/useFileDropPaste";
import { useData, useAuth } from "@/contexts/AppContext";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/activityLogger";
import { InlineEditField } from "@/components/InlineEditField";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ArrowRight, Wrench, AlertTriangle, Clock, Check, Circle,
  Minus, Hash, Upload, Trash2, Play, ImageIcon, Loader2, Plus,
  ExternalLink, MessageSquare, Package, Building2,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Issue {
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
  diagnostic_steps: Record<string, string>[] | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

interface IssueUpdate {
  id: string;
  issue_id: string;
  user_id: string | null;
  author_name: string;
  content: string;
  created_at: string;
}

interface IssueAttachment {
  id: string;
  issue_id: string;
  file_url: string;
  file_type: "image" | "video";
  file_name: string | null;
  created_by: string | null;
  created_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const severityColors: Record<string, string> = {
  "נמוך":   "bg-muted text-muted-foreground",
  "בינוני": "bg-warning/15 text-warning",
  "גבוה":   "bg-destructive/20 text-destructive",
  "קריטי":  "bg-destructive text-destructive-foreground",
};

const statusColors: Record<string, string> = {
  "פתוח":   "bg-destructive/15 text-destructive",
  "בטיפול": "bg-warning/15 text-warning",
  "נסגר":   "bg-success/15 text-success",
};

const severityBorderColors: Record<string, string> = {
  "נמוך":   "border-r-border",
  "בינוני": "border-r-warning",
  "גבוה":   "border-r-destructive",
  "קריטי":  "border-r-destructive",
};

const severities = ["נמוך", "בינוני", "גבוה", "קריטי"];
const issueStatuses = ["פתוח", "בטיפול", "נסגר"];

// ── MediaThumbnail ─────────────────────────────────────────────────────────────

function MediaThumbnail({
  url, fileType, fileName, onView, onDelete,
}: {
  url: string;
  fileType: "image" | "video";
  fileName?: string | null;
  onView: () => void;
  onDelete: (() => void) | null;
}) {
  return (
    <div className="relative group rounded-lg border overflow-hidden aspect-square bg-muted/30">
      {fileType === "image" ? (
        <img src={url} alt={fileName || "media"} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2">
          <Play className="h-8 w-8 text-muted-foreground" />
          <span className="text-xs text-muted-foreground truncate w-full text-center">{fileName || "וידאו"}</span>
        </div>
      )}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        <button
          onClick={onView}
          className="bg-white/20 hover:bg-white/40 rounded-full p-1.5 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5 text-white" />
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            className="bg-destructive/60 hover:bg-destructive rounded-full p-1.5 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5 text-white" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function IssueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { products, suppliers } = useData();
  const { currentUser } = useAuth();
  const { hasEdit, isManager } = usePermissions("issues");

  const [issue, setIssue] = useState<Issue | null>(null);
  const [updates, setUpdates] = useState<IssueUpdate[]>([]);
  const [attachments, setAttachments] = useState<IssueAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUpdateContent, setNewUpdateContent] = useState("");
  const [submittingUpdate, setSubmittingUpdate] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [deleteAttachmentConfirm, setDeleteAttachmentConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Fetchers ────────────────────────────────────────────────────────────────

  const fetchIssue = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("product_issues")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) { navigate("/issues"); return; }
    setIssue(data as Issue);
  }, [id, navigate]);

  const fetchUpdates = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("issue_updates")
      .select("*")
      .eq("issue_id", id)
      .order("created_at", { ascending: true });
    if (data) setUpdates(data as IssueUpdate[]);
  }, [id]);

  const fetchAttachments = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("issue_attachments")
      .select("*")
      .eq("issue_id", id)
      .order("created_at", { ascending: true });
    if (data) setAttachments(data as IssueAttachment[]);
  }, [id]);

  useEffect(() => {
    Promise.all([fetchIssue(), fetchUpdates(), fetchAttachments()])
      .then(() => setLoading(false));
  }, [fetchIssue, fetchUpdates, fetchAttachments]);

  // ── Field Save ──────────────────────────────────────────────────────────────

  const handleFieldSave = async (field: string, value: string) => {
    if (!issue) return;
    const patch: Record<string, string | null> = { updated_at: new Date().toISOString() };

    if (field === "status") {
      patch.status = value;
      if (value === "נסגר") patch.resolved_date = new Date().toISOString().split("T")[0];
      logActivity({
        action: "issue.status",
        entityType: "issue",
        entityId: issue.id,
        details: { status: { old: issue.status, new: value } },
      });
    } else if (field === "severity") {
      patch.severity = value;
      logActivity({
        action: "issue.severity",
        entityType: "issue",
        entityId: issue.id,
        details: { severity: { old: issue.severity, new: value } },
      });
    } else {
      patch[field] = value || null;
    }

    const { error } = await supabase
      .from("product_issues")
      .update(patch)
      .eq("id", issue.id);

    if (error) { toast.error("שגיאה בעדכון"); return; }
    toast.success("עודכן");
    await fetchIssue();
  };

  // ── Updates ─────────────────────────────────────────────────────────────────

  const handleAddUpdate = async () => {
    if (!issue || !newUpdateContent.trim()) return;
    setSubmittingUpdate(true);
    const authorName = currentUser?.name || "משתמש";
    const { error } = await supabase.from("issue_updates").insert({
      issue_id: issue.id,
      user_id: currentUser?.id ?? null,
      author_name: authorName,
      content: newUpdateContent.trim(),
    });
    if (error) { toast.error("שגיאה בהוספת עדכון"); setSubmittingUpdate(false); return; }
    setNewUpdateContent("");
    setSubmittingUpdate(false);
    await fetchUpdates();
  };

  const handleDeleteUpdate = async (updateId: string) => {
    const { error } = await supabase.from("issue_updates").delete().eq("id", updateId);
    if (error) { toast.error("שגיאה במחיקה"); return; }
    await fetchUpdates();
  };

  // ── Media ────────────────────────────────────────────────────────────────────

  const uploadMediaFile = useCallback(async (file: File) => {
    if (!issue) return;
    if (file.size > 50 * 1024 * 1024) { toast.error("הקובץ גדול מדי (מקסימום 50MB)"); return; }
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) { toast.error("סוג קובץ לא נתמך"); return; }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("issue-media").upload(path, file);
    if (uploadError) { toast.error("שגיאה בהעלאה"); setUploading(false); return; }

    const { data: { publicUrl } } = supabase.storage.from("issue-media").getPublicUrl(path);
    const { data: { user } } = await supabase.auth.getUser();
    const { error: insertError } = await supabase.from("issue_attachments").insert({
      issue_id: issue.id,
      file_url: publicUrl,
      file_type: isVideo ? "video" : "image",
      file_name: file.name,
      created_by: user?.id ?? null,
    });

    if (insertError) { toast.error("שגיאה בשמירת קובץ"); setUploading(false); return; }
    toast.success("הקובץ הועלה בהצלחה");
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await fetchAttachments();
  }, [issue, fetchAttachments]);

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMediaFile(file);
  };

  const isMediaFile = (f: File) => f.type.startsWith("image/") || f.type.startsWith("video/");
  const { isDragging: isMediaDragging, dropProps: mediaDropProps } = useFileDropPaste(uploadMediaFile, {
    accept: isMediaFile,
    disabled: uploading,
  });

  const handleDeleteAttachment = async (attachmentId: string) => {
    const { error } = await supabase.from("issue_attachments").delete().eq("id", attachmentId);
    if (error) { toast.error("שגיאה במחיקה"); return; }
    await fetchAttachments();
  };

  // ── Derived ─────────────────────────────────────────────────────────────────

  const product = issue ? products.find(p => p.id === issue.product_id) : null;
  const supplier = product?.supplier
    ? suppliers.find(s => s.company === product.supplier || s.id === product.supplier)
    : null;

  const totalMediaCount = (issue?.image_url ? 1 : 0) + attachments.length;

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-lg text-muted-foreground">תקלה לא נמצאה</p>
        <Button variant="outline" onClick={() => navigate("/issues")}>
          <ArrowRight className="h-4 w-4 ml-2" />חזרה לתקלות
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className={`bg-card rounded-xl border shadow-sm p-4 border-r-4 ${severityBorderColors[issue.severity] || "border-r-border"}`}>
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" className="shrink-0 mt-0.5" onClick={() => navigate("/issues")}>
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Wrench className="h-5 w-5 text-primary shrink-0" />
              <h1 className="text-xl font-bold text-foreground leading-tight">{issue.description}</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {new Date(issue.reported_date).toLocaleDateString("he-IL")} · {issue.reporter}
              {issue.ticket_number && (
                <span className="inline-flex items-center gap-0.5 mr-2 bg-muted/70 border border-border rounded px-1.5 py-0.5 text-xs font-mono">
                  <Hash className="h-3 w-3" />{issue.ticket_number}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {/* Severity badge / popover */}
            {hasEdit ? (
              <Popover>
                <PopoverTrigger asChild>
                  <button className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer flex items-center gap-1", severityColors[issue.severity] || "bg-muted text-muted-foreground")}>
                    {(issue.severity === "קריטי" || issue.severity === "גבוה")
                      ? <AlertTriangle className="h-3 w-3" />
                      : issue.severity === "בינוני"
                        ? <Minus className="h-3 w-3" />
                        : <Circle className="h-2.5 w-2.5 fill-current" />}
                    {issue.severity}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-1" align="end">
                  <div className="flex flex-col gap-0.5">
                    {severities.map(s => (
                      <button
                        key={s}
                        onClick={() => handleFieldSave("severity", s)}
                        className={cn("px-3 py-1.5 rounded text-xs font-medium text-right transition-colors hover:bg-muted", issue.severity === s && "bg-muted")}
                      >{s}</button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1", severityColors[issue.severity] || "bg-muted text-muted-foreground")}>
                {(issue.severity === "קריטי" || issue.severity === "גבוה")
                  ? <AlertTriangle className="h-3 w-3" />
                  : issue.severity === "בינוני"
                    ? <Minus className="h-3 w-3" />
                    : <Circle className="h-2.5 w-2.5 fill-current" />}
                {issue.severity}
              </span>
            )}

            {/* Status badge / popover */}
            {hasEdit ? (
              <Popover>
                <PopoverTrigger asChild>
                  <button className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer flex items-center gap-1", statusColors[issue.status] || "bg-muted text-muted-foreground")}>
                    {issue.status === "פתוח"
                      ? <Circle className="h-2.5 w-2.5" />
                      : issue.status === "בטיפול"
                        ? <Clock className="h-3 w-3" />
                        : <Check className="h-3 w-3" />}
                    {issue.status}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-1" align="end">
                  <div className="flex flex-col gap-0.5">
                    {issueStatuses.map(s => (
                      <button
                        key={s}
                        onClick={() => handleFieldSave("status", s)}
                        className={cn("px-3 py-1.5 rounded text-xs font-medium text-right transition-colors hover:bg-muted", issue.status === s && "bg-muted")}
                      >{s}</button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1", statusColors[issue.status] || "bg-muted text-muted-foreground")}>
                {issue.status === "פתוח"
                  ? <Circle className="h-2.5 w-2.5" />
                  : issue.status === "בטיפול"
                    ? <Clock className="h-3 w-3" />
                    : <Check className="h-3 w-3" />}
                {issue.status}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Metadata + Description ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Metadata card */}
        <div className="bg-card rounded-xl border shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground border-b pb-2">פרטי תקלה</h2>

          <div className="space-y-3 text-sm">
            {/* Product */}
            <div className="flex items-start gap-2">
              <Package className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">מוצר</p>
                {product ? (
                  <button
                    onClick={() => navigate(`/products/${product.id}`)}
                    className="text-primary hover:underline font-medium text-sm text-right"
                  >
                    {product.name}
                  </button>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </div>

            {/* Supplier */}
            <div className="flex items-start gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">ספק</p>
                {supplier ? (
                  <button
                    onClick={() => navigate(`/suppliers/${supplier.id}`)}
                    className="text-primary hover:underline font-medium text-sm text-right"
                  >
                    {supplier.company}
                  </button>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </div>

            {/* Reporter */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">מדווח</p>
              <InlineEditField
                value={issue.reporter}
                onSave={v => handleFieldSave("reporter", v)}
                disabled={!hasEdit}
              />
            </div>

            {/* Date */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">תאריך דיווח</p>
              <p className="text-sm font-medium text-foreground">
                {new Date(issue.reported_date).toLocaleDateString("he-IL")}
              </p>
            </div>

            {/* Ticket number */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">מספר פנייה</p>
              <InlineEditField
                value={issue.ticket_number}
                onSave={v => handleFieldSave("ticket_number", v)}
                disabled={!hasEdit}
                displayValue={issue.ticket_number
                  ? <span className="inline-flex items-center gap-0.5 font-mono text-xs"><Hash className="h-3 w-3" />{issue.ticket_number}</span>
                  : undefined}
              />
            </div>

            {/* Diagnostic source */}
            {(issue.diagnostic_source || hasEdit) && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">מקור אבחון</p>
                <InlineEditField
                  value={issue.diagnostic_source}
                  onSave={v => handleFieldSave("diagnostic_source", v)}
                  disabled={!hasEdit}
                />
              </div>
            )}

            {/* Resolved date */}
            {issue.resolved_date && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">תאריך סגירה</p>
                <p className="text-sm font-medium text-foreground">
                  {new Date(issue.resolved_date).toLocaleDateString("he-IL")}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Description + Resolution + Diagnostic Steps */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card rounded-xl border shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground border-b pb-2">תיאור</h2>
            <InlineEditField
              value={issue.description}
              type="textarea"
              onSave={v => handleFieldSave("description", v)}
              disabled={!hasEdit}
            />
          </div>

          <div className="bg-card rounded-xl border shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground border-b pb-2">פתרון</h2>
            <InlineEditField
              value={issue.resolution}
              type="textarea"
              onSave={v => handleFieldSave("resolution", v)}
              disabled={!hasEdit}
            />
          </div>

          {/* Diagnostic Steps (JSONB) */}
          {issue.diagnostic_steps && issue.diagnostic_steps.length > 0 && (
            <div className="bg-card rounded-xl border shadow-sm p-5 space-y-3">
              <h2 className="text-sm font-semibold text-foreground border-b pb-2">מהלך אבחון</h2>
              <div className="bg-muted/40 rounded-lg p-3 space-y-1.5">
                {issue.diagnostic_steps.map((step, i) => {
                  const entries = Object.entries(step);
                  return entries.map(([key, val]) => (
                    <p key={`${i}-${key}`} className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{key}:</span> {String(val)}
                    </p>
                  ));
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Updates / Comments ──────────────────────────────────────────────── */}
      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-foreground">עדכונים ({updates.length})</h2>
        </div>

        <div className="divide-y">
          {updates.length === 0 && (
            <p className="p-5 text-sm text-muted-foreground text-center">אין עדכונים עדיין</p>
          )}
          {updates.map(u => (
            <div key={u.id} className="p-4 flex gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-sm font-medium text-foreground">{u.author_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(u.created_at).toLocaleString("he-IL", {
                      day: "2-digit", month: "2-digit", year: "2-digit",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{u.content}</p>
              </div>
              {isManager && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive shrink-0 self-start"
                  onClick={() => handleDeleteUpdate(u.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Add update form */}
        <div className="p-4 border-t space-y-2">
          <Textarea
            value={newUpdateContent}
            onChange={e => setNewUpdateContent(e.target.value)}
            placeholder="הוסף עדכון..."
            rows={2}
            className="text-sm resize-none"
          />
          <Button
            size="sm"
            disabled={!newUpdateContent.trim() || submittingUpdate}
            onClick={handleAddUpdate}
          >
            {submittingUpdate
              ? <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" />
              : <Plus className="h-3.5 w-3.5 ml-1" />}
            הוסף עדכון
          </Button>
        </div>
      </div>

      {/* ── Media Gallery ───────────────────────────────────────────────────── */}
      <div
        className={cn(
          "bg-card rounded-xl border shadow-sm transition-colors",
          isMediaDragging && "border-primary ring-2 ring-primary/20"
        )}
        onDragOver={mediaDropProps.onDragOver}
        onDragLeave={mediaDropProps.onDragLeave}
        onDrop={mediaDropProps.onDrop}
      >
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-foreground">מדיה ({totalMediaCount})</h2>
          </div>
          <div className="flex items-center gap-2">
            {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="h-3.5 w-3.5 ml-1" />
              העלה מדיה
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm"
              onChange={handleMediaUpload}
            />
          </div>
        </div>

        <div className="p-4">
          {totalMediaCount === 0 ? (
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
                isMediaDragging ? "border-primary bg-primary/5" : "border-muted-foreground/20"
              )}
            >
              <p className="text-sm text-muted-foreground">גרור מדיה לכאן, הדבק (Ctrl+V) או לחץ &ldquo;העלה מדיה&rdquo;</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {/* Legacy image_url */}
              {issue.image_url && (
                <MediaThumbnail
                  url={issue.image_url}
                  fileType="image"
                  onView={() => setLightboxUrl(issue.image_url!)}
                  onDelete={null}
                />
              )}
              {/* New attachments */}
              {attachments.map(att => (
                <MediaThumbnail
                  key={att.id}
                  url={att.file_url}
                  fileType={att.file_type}
                  fileName={att.file_name}
                  onView={() => {
                    if (att.file_type === "image") setLightboxUrl(att.file_url);
                    else window.open(att.file_url, "_blank");
                  }}
                  onDelete={isManager ? () => setDeleteAttachmentConfirm(att.id) : null}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Lightbox ────────────────────────────────────────────────────────── */}
      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="sm:max-w-3xl p-2">
          {lightboxUrl && (
            <img src={lightboxUrl} alt="media" className="w-full rounded-lg max-h-[80vh] object-contain" />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete Attachment Confirmation ──────────────────────────────────── */}
      <Dialog open={!!deleteAttachmentConfirm} onOpenChange={(open) => { if (!open) setDeleteAttachmentConfirm(null); }}>
        <DialogContent className="sm:max-w-sm">
          <div className="pt-2">
            <h2 className="font-semibold text-base mb-1">מחיקת קובץ מצורף</h2>
            <p className="text-sm text-muted-foreground">האם למחוק את הקובץ? פעולה זו אינה ניתנת לביטול.</p>
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" onClick={() => setDeleteAttachmentConfirm(null)}>ביטול</Button>
              <Button variant="destructive" onClick={() => { handleDeleteAttachment(deleteAttachmentConfirm!); setDeleteAttachmentConfirm(null); }}>מחק</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
