import { useState, useCallback } from "react";
import { useData } from "@/contexts/AppContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  documentId: string;
  linkedProductIds: string[];
  onProductsUpdated: (productIds: string[]) => void;
}

export default function DocumentProductSelector({
  documentId,
  linkedProductIds,
  onProductsUpdated,
}: Props) {
  const { products } = useData();
  const [selectedProductId, setSelectedProductId] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);
  const [productToRemove, setProductToRemove] = useState<string | null>(null);

  const linkedProducts = products.filter(p => linkedProductIds.includes(p.id));
  const availableProducts = products.filter(p => !linkedProductIds.includes(p.id));

  const handleAddProduct = useCallback(async () => {
    if (!selectedProductId) return;

    setIsAdding(true);
    try {
      const { error } = await supabase
        .from("document_products")
        .insert({
          document_id: documentId,
          product_id: selectedProductId,
        });

      if (error) throw error;

      const newProductIds = [...linkedProductIds, selectedProductId];
      onProductsUpdated(newProductIds);
      setSelectedProductId("");
      toast.success("מוצר נוסף בהצלחה");
    } catch (error) {
      console.error("Error adding product:", error);
      toast.error("שגיאה בהוספת מוצר");
    } finally {
      setIsAdding(false);
    }
  }, [selectedProductId, documentId, linkedProductIds, onProductsUpdated]);

  const handleRemoveProduct = useCallback(async (productId: string) => {
    setIsRemoving(productId);
    try {
      const { error } = await supabase
        .from("document_products")
        .delete()
        .eq("document_id", documentId)
        .eq("product_id", productId);

      if (error) throw error;

      const newProductIds = linkedProductIds.filter(id => id !== productId);
      onProductsUpdated(newProductIds);
      setProductToRemove(null);
      toast.success("מוצר הוסר בהצלחה");
    } catch (error) {
      console.error("Error removing product:", error);
      toast.error("שגיאה בהסרת מוצר");
    } finally {
      setIsRemoving(null);
    }
  }, [documentId, linkedProductIds, onProductsUpdated]);

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">מוצרים מקושרים</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {linkedProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">לא קושרו מוצרים</p>
          ) : (
            linkedProducts.map(product => (
              <div key={product.id} className="flex items-center gap-1">
                <Badge variant="secondary" className="pr-1">
                  {product.name}
                  <button
                    onClick={() => setProductToRemove(product.id)}
                    className="ml-1 inline-flex items-center hover:text-destructive transition-colors"
                    disabled={isRemoving === product.id}
                  >
                    {isRemoving === product.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                  </button>
                </Badge>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <Select value={selectedProductId} onValueChange={setSelectedProductId}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="בחר מוצר להוספה..." />
          </SelectTrigger>
          <SelectContent>
            {availableProducts.length === 0 ? (
              <div className="p-2 text-sm text-muted-foreground">
                כל המוצרים מקושרים כבר
              </div>
            ) : (
              availableProducts.map(product => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <Button
          onClick={handleAddProduct}
          disabled={!selectedProductId || isAdding}
          size="sm"
          className="gap-1"
        >
          {isAdding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          הוסף
        </Button>
      </div>

      <AlertDialog open={!!productToRemove} onOpenChange={(open) => {
        if (!open) setProductToRemove(null);
      }}>
        <AlertDialogContent>
          <AlertDialogTitle>הסר מוצר</AlertDialogTitle>
          <AlertDialogDescription>
            האם אתה בטוח שברצונך להסיר את המוצר הזה מהמסמך?
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => productToRemove && handleRemoveProduct(productToRemove)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              הסר
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
