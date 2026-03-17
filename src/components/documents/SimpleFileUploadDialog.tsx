import { useState, useRef, useCallback } from "react";
import { useData } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, FileText, Loader2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  defaultSupplierId?: string;
  defaultProductId?: string;
  defaultOrderId?: string;
}

export default function SimpleFileUploadDialog({
  open, onOpenChange, onSaved,
  defaultSupplierId, defaultProductId, defaultOrderId,
}: Props) {
  const { suppliers, products, orders } = useData();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState("כללי");
  const [supplierId, setSupplierId] = useState(defaultSupplierId || "");
  const [productId, setProductId] = useState(defaultProductId || "");
  const [orderId, setOrderId] = useState(defaultOrderId || "");
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const hasContext = !!(defaultSupplierId || defaultProductId || defaultOrderId);

  const reset = () => {
    setFile(null);
    setDocName("");
    setDocType("כללי");
    setSupplierId(defaultSupplierId || "");
    setProductId(defaultProductId || "");
    setOrderId(defaultOrderId || "");
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) {
      setFile(f);
      if (!docName) setDocName(f.name.replace(/\.[^/.]+$/, ""));
    }
  }, [docName]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      if (!docName) setDocName(f.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const handleSave = async () => {
    if (!docName.trim()) {
      toast.error("יש להזין שם למסמך");
      return;
    }

    setSaving(true);
    let fileUrl: string | null = null;

    let uploadedPath: string | null = null;

    if (file) {
      const sanitizedName = file.name
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/_{2,}/g, "_");
      const path = `uploads/${Date.now()}_${sanitizedName}`;
      const { error } = await supabase.storage.from("documents").upload(path, file);
      if (error) {
        toast.error("שגיאה בהעלאה: " + error.message);
        setSaving(false);
        return;
      }
      uploadedPath = path;
      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
      fileUrl = urlData.publicUrl;
    }

    const { error } = await supabase.from("purchase_documents").insert({
      document_name: docName.trim(),
      type: docType,
      file_url: fileUrl,
      supplier_id: supplierId || null,
      product_id: productId || null,
      order_id: orderId || null,
      quantity: 0,
    } as any);

    if (error) {
      // Rollback: delete uploaded file if DB insert failed
      if (uploadedPath) {
        await supabase.storage.from("documents").remove([uploadedPath]);
      }
      toast.error("שגיאה בשמירה: " + error.message);
    } else {
      toast.success("מסמך נשמר בהצלחה");
      reset();
      onOpenChange(false);
      onSaved();
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>העלאת מסמך</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Drop zone */}
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
              file && "border-primary/50 bg-primary/5"
            )}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-foreground">{file.name}</span>
                <Button
                  variant="ghost" size="icon" className="h-6 w-6"
                  onClick={e => { e.stopPropagation(); setFile(null); }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">גרור קובץ לכאן או לחץ לבחירה</p>
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

          {/* Document name */}
          <div className="space-y-1.5">
            <Label>שם מסמך *</Label>
            <Input
              value={docName}
              onChange={e => setDocName(e.target.value)}
              placeholder="לדוגמה: הצעת מחיר מסין - מצלמות"
            />
          </div>

          {/* Document type */}
          <div className="space-y-1.5">
            <Label>סוג</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PI">PI — הצעת מחיר</SelectItem>
                <SelectItem value="PO">PO — הזמנת רכש</SelectItem>
                <SelectItem value="כללי">כללי</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Entity linking - only show when not in entity context */}
          {!hasContext && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>שיוך לספק</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger><SelectValue placeholder="ללא" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">ללא</SelectItem>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.company}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>שיוך למוצר</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger><SelectValue placeholder="ללא" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">ללא</SelectItem>
                    {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>שיוך להזמנה</Label>
                <Select value={orderId} onValueChange={setOrderId}>
                  <SelectTrigger><SelectValue placeholder="ללא" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">ללא</SelectItem>
                    {orders.map(o => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.supplier_name || o.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <Button onClick={handleSave} disabled={saving || !docName.trim()} className="w-full">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin ml-1" />שומר...</> : "שמור מסמך"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
