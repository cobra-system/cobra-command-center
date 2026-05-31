import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (buyerName: string, price: number | null) => void;
  itemName: string;
}

export function SaleDialog({ open, onClose, onConfirm, itemName }: Props) {
  const [buyerName, setBuyerName] = useState("");
  const [price, setPrice] = useState("");

  const handleConfirm = () => {
    if (!buyerName.trim()) return;
    onConfirm(buyerName.trim(), price ? parseFloat(price) : null);
    setBuyerName("");
    setPrice("");
  };

  const handleClose = () => {
    setBuyerName("");
    setPrice("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-amber-600" />
            סימון כמכירה
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            סימון <strong>{itemName}</strong> כנמכר לצד שלישי
          </p>

          <div className="space-y-2">
            <Label htmlFor="buyer-name">שם הקונה *</Label>
            <Input
              id="buyer-name"
              placeholder="שם הקונה..."
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sale-price">מחיר (₪, אופציונלי)</Label>
            <Input
              id="sale-price"
              type="number"
              min={0}
              step={0.01}
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={handleClose}>
            ביטול
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!buyerName.trim()}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            סמן כמכירה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
