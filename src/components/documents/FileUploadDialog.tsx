import { useState } from "react";
import { useData } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export default function FileUploadDialog({ open, onOpenChange, onSaved }: Props) {
  const { suppliers } = useData();
  const [uploading, setUploading] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [classificationResult, setClassificationResult] = useState<any>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setClassificationResult(null);

    const path = `uploads/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("documents").upload(path, file);
    if (uploadError) {
      toast.error("שגיאה בהעלאה: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
    const fileUrl = urlData.publicUrl;
    setUploading(false);

    setClassifying(true);
    let textContent = "";
    if (file.type === "application/pdf" || file.type.includes("text")) {
      try { textContent = await file.text(); } catch { textContent = ""; }
    }

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/classify-document`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ text: textContent.slice(0, 5000), filename: file.name }),
      });
      if (res.ok) {
        const result = await res.json();
        setClassificationResult({ ...result, file_url: fileUrl, filename: file.name });
        toast.success(`סווג כ-${result.type} (ביטחון: ${Math.round((result.confidence || 0) * 100)}%)`);
      }
    } catch {
      toast.error("שגיאה בסיווג");
    }
    setClassifying(false);
  };

  const saveClassifiedDocument = async () => {
    if (!classificationResult) return;
    const r = classificationResult;

    if (r.type === "PAYMENT") {
      const matchedSupplier = suppliers.find(s =>
        s.company.toLowerCase().includes((r.supplier_name || "").toLowerCase())
      );
      await supabase.from("supplier_payments").insert({
        supplier_id: matchedSupplier?.id || null,
        amount: r.total_amount || 0,
        currency: r.currency || "USD",
        notes: `קובץ: ${r.filename}`,
      });
    } else {
      const matchedSupplier = suppliers.find(s =>
        s.company.toLowerCase().includes((r.supplier_name || "").toLowerCase())
      );
      await supabase.from("purchase_documents").insert({
        type: r.type === "OTHER" ? "PI" : r.type,
        supplier_id: matchedSupplier?.id || null,
        quantity: 0,
        currency: r.currency || "USD",
        total_price: r.total_amount || null,
        file_url: r.file_url,
        notes: `קובץ: ${r.filename}`,
      });
    }
    toast.success("מסמך נשמר בהצלחה");
    setClassificationResult(null);
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setClassificationResult(null); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>העלאת מסמך</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">העלה PDF או מסמך והמערכת תסווג אותו אוטומטית באמצעות AI.</p>
          <Input type="file" accept=".pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.jpg,.png" onChange={handleFileUpload} disabled={uploading || classifying} />
          {uploading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />מעלה...</div>}
          {classifying && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />מסווג עם AI...</div>}
          {classificationResult && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="font-semibold text-sm text-foreground">תוצאת סיווג:</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">סוג:</span>
                <span className="font-medium text-foreground">{classificationResult.type}</span>
                {classificationResult.supplier_name && (
                  <><span className="text-muted-foreground">ספק:</span><span className="text-foreground">{classificationResult.supplier_name}</span></>
                )}
                {classificationResult.total_amount && (
                  <><span className="text-muted-foreground">סכום:</span><span className="text-foreground">{classificationResult.currency || "$"}{classificationResult.total_amount}</span></>
                )}
                <span className="text-muted-foreground">ביטחון:</span>
                <span className="text-foreground">{Math.round((classificationResult.confidence || 0) * 100)}%</span>
              </div>
              <Button onClick={saveClassifiedDocument} className="w-full mt-2">שמור מסמך</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
