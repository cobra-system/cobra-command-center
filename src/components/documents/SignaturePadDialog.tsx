import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (dataUrl: string) => void;
}

export default function SignaturePadDialog({ open, onOpenChange, onConfirm }: Props) {
  const padRef = useRef<SignatureCanvas>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const handleClear = () => {
    padRef.current?.clear();
    setIsEmpty(true);
  };

  const handleConfirm = () => {
    if (!padRef.current || padRef.current.isEmpty()) return;
    const dataUrl = padRef.current.getTrimmedCanvas().toDataURL("image/png");
    onConfirm(dataUrl);
    onOpenChange(false);
    setTimeout(() => { padRef.current?.clear(); setIsEmpty(true); }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>צייר חתימה</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="border-2 border-dashed border-muted-foreground/30 rounded-xl overflow-hidden bg-white">
            <SignatureCanvas
              ref={padRef}
              penColor="#1a1a1a"
              canvasProps={{ width: 440, height: 200, className: "w-full touch-none" }}
              onBegin={() => setIsEmpty(false)}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">צייר את חתימתך בתיבה למעלה</p>
          <div className="flex gap-2 justify-between">
            <Button variant="outline" size="sm" onClick={handleClear} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />נקה
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
              <Button onClick={handleConfirm} disabled={isEmpty}>הוסף חתימה</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
