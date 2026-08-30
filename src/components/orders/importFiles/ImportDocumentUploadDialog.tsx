/**
 * Upload one PDF into an import dossier.
 *
 * Supports drag-and-drop and Ctrl+V like the rest of the app's upload surfaces.
 * The document kind is guessed from the file name — forwarders name their
 * attachments consistently enough that this is right most of the time — and is
 * always editable before saving.
 */
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFileDropPaste } from "@/hooks/useFileDropPaste";
import {
  IMPORT_FILE_ACCEPT,
  IMPORT_DOC_SUBTYPES,
  importDocSubtypeLabels,
  uploadImportDocument,
  guessSubtype,
  guessDocumentNumber,
  type ImportDocSubtype,
} from "@/lib/importFiles";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importFileId: string;
  orderId?: string | null;
  supplierId?: string | null;
  onUploaded: () => void;
}

export default function ImportDocumentUploadDialog({
  open,
  onOpenChange,
  importFileId,
  orderId,
  supplierId,
  onUploaded,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [subtype, setSubtype] = useState<ImportDocSubtype>("OTHER");
  const [documentName, setDocumentName] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("ILS");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) return;
    // Clear on close so the next upload starts blank.
    setFile(null);
    setSubtype("OTHER");
    setDocumentName("");
    setDocumentNumber("");
    setAmount("");
    setCurrency("ILS");
  }, [open]);

  const acceptFile = (picked: File) => {
    setFile(picked);
    setSubtype(guessSubtype(picked.name));
    setDocumentName(picked.name.replace(/\.[^/.]+$/, ""));
    setDocumentNumber(guessDocumentNumber(picked.name));
  };

  const { isDragging, dropProps } = useFileDropPaste(acceptFile, { disabled: !open });

  const handleUpload = async () => {
    if (!file) {
      toast.error("לא נבחר קובץ");
      return;
    }

    setUploading(true);
    const parsedAmount = amount.trim() ? Number(amount.replace(/,/g, "")) : null;

    const result = await uploadImportDocument({
      file,
      importFileId,
      subtype,
      documentName,
      documentNumber: documentNumber || null,
      supplierId,
      orderId,
      totalPrice: parsedAmount !== null && Number.isFinite(parsedAmount) ? parsedAmount : null,
      currency,
    });

    setUploading(false);

    if (result.error) {
      toast.error(`ההעלאה נכשלה: ${result.error}`);
      return;
    }

    toast.success("המסמך הועלה");
    onOpenChange(false);
    onUploaded();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>העלאת מסמך יבוא</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div
            {...dropProps}
            className={cn(
              "rounded-lg border-2 border-dashed p-6 text-center transition-colors",
              isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
            )}
          >
            {file ? (
              <div className="flex items-center justify-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-medium">{file.name}</span>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">גרור קובץ לכאן, הדבק, או בחר קובץ</p>
              </div>
            )}
            <Input
              type="file"
              accept={IMPORT_FILE_ACCEPT}
              className="mt-3"
              onChange={e => {
                const picked = e.target.files?.[0];
                if (picked) acceptFile(picked);
              }}
            />
          </div>

          <div>
            <Label>סוג המסמך</Label>
            <Select value={subtype} onValueChange={v => setSubtype(v as ImportDocSubtype)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {IMPORT_DOC_SUBTYPES.map(s => (
                  <SelectItem key={s} value={s}>{importDocSubtypeLabels[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>שם המסמך</Label>
              <Input value={documentName} onChange={e => setDocumentName(e.target.value)} />
            </div>
            <div>
              <Label>מספר מסמך</Label>
              <Input value={documentNumber} onChange={e => setDocumentNumber(e.target.value)} placeholder="197112" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>סכום המסמך</Label>
              <Input value={amount} onChange={e => setAmount(e.target.value)} placeholder="132601.53" inputMode="decimal" />
            </div>
            <div>
              <Label>מטבע</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ILS">ILS</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>ביטול</Button>
          <Button onClick={handleUpload} disabled={uploading || !file}>
            {uploading && <Loader2 className="h-4 w-4 ml-1 animate-spin" />}
            העלה
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
