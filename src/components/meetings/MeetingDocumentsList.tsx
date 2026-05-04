import { useState, useEffect, useRef, useCallback } from "react";
import { useFileDropPaste } from "@/hooks/useFileDropPaste";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Trash2, Loader2, X, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { MeetingDocument } from "./types";

interface Props {
  meetingId: string;
}

export default function MeetingDocumentsList({ meetingId }: Props) {
  const [docs, setDocs] = useState<MeetingDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = async () => {
    const { data } = await supabase
      .from("meeting_documents")
      .select("*")
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: false });
    if (data) setDocs(data as MeetingDocument[]);
  };

  useEffect(() => {
    (async () => {
      await fetchDocs();
      setLoading(false);
    })();
  }, [meetingId]);

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true);
    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_{2,}/g, "_");
    const path = `meeting-documents/${meetingId}/${Date.now()}_${sanitized}`;

    const { error: uploadError } = await supabase.storage.from("documents").upload(path, file);
    if (uploadError) {
      toast({ title: "שגיאה בהעלאה", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);

    const { error: dbError } = await supabase.from("meeting_documents").insert({
      meeting_id: meetingId,
      document_name: file.name.replace(/\.[^/.]+$/, ""),
      file_url: urlData.publicUrl,
    });

    if (dbError) {
      await supabase.storage.from("documents").remove([path]);
      toast({ title: "שגיאה בשמירה", description: dbError.message, variant: "destructive" });
    } else {
      toast({ title: "מסמך הועלה בהצלחה" });
      await fetchDocs();
    }
    setUploading(false);
  }, [meetingId, fetchDocs]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  useFileDropPaste(uploadFile, { disabled: uploading });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
      e.target.value = "";
    }
  };

  const handleDelete = async (doc: MeetingDocument) => {
    // Extract storage path from public URL
    const urlParts = doc.file_url.split("/storage/v1/object/public/documents/");
    if (urlParts[1]) {
      await supabase.storage.from("documents").remove([urlParts[1]]);
    }
    await supabase.from("meeting_documents").delete().eq("id", doc.id);
    toast({ title: "מסמך נמחק" });
    await fetchDocs();
  };

  if (loading) {
    return <div className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-3">
      {/* Document list */}
      {docs.length === 0 && !uploading && (
        <p className="text-sm text-muted-foreground text-center py-2">אין מסמכים מצורפים</p>
      )}
      {docs.map(doc => (
        <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
          <FileText className="h-4 w-4 text-primary shrink-0" />
          <span className="flex-1 text-sm truncate">{doc.document_name}</span>
          <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </a>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => handleDelete(doc)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      {/* Upload zone */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
          uploading && "pointer-events-none opacity-60"
        )}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            מעלה...
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">גרור, הדבק (Ctrl+V) או לחץ להעלאה</p>
            <p className="text-xs text-muted-foreground">PDF, Word, Excel, תמונה</p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt,.csv"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
    </div>
  );
}
