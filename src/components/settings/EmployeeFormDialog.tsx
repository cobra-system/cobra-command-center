import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Package, Search } from "lucide-react";
import type { Product } from "@/contexts/types";
import { DIVISIONS } from "@/components/equipment/constants";

interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editingId: string | null;
  empName: string;
  setEmpName: (v: string) => void;
  empEmail: string;
  setEmpEmail: (v: string) => void;
  empPassword: string;
  setEmpPassword: (v: string) => void;
  empRoleDefId: string;
  setEmpRoleDefId: (v: string) => void;
  empAllowedProductIds: string[];
  setEmpAllowedProductIds: (v: string[]) => void;
  empDivision: string;
  setEmpDivision: (v: string) => void;
  nonManagerRoleDefinitions: Array<{ id: string; name: string; system_key?: string }>;
  products: Product[];
  submitting: boolean;
  onSubmit: () => void;
  onReset: () => void;
}

export default function EmployeeFormDialog({
  open,
  onOpenChange,
  editingId,
  empName,
  setEmpName,
  empEmail,
  setEmpEmail,
  empPassword,
  setEmpPassword,
  empRoleDefId,
  setEmpRoleDefId,
  empAllowedProductIds,
  setEmpAllowedProductIds,
  empDivision,
  setEmpDivision,
  nonManagerRoleDefinitions,
  products,
  submitting,
  onSubmit,
  onReset,
}: EmployeeFormDialogProps) {
  const [showProducts, setShowProducts] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  const productsByDivision = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of products) {
      const div = p.division || "ללא חטיבה";
      if (!map.has(div)) map.set(div, []);
      map.get(div)!.push(p);
    }
    return map;
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products;
    const q = productSearch.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.division || "").toLowerCase().includes(q)
    );
  }, [products, productSearch]);

  const filteredDivisions = useMemo(() => {
    const divs = new Set(filteredProducts.map(p => p.division || "ללא חטיבה"));
    return Array.from(productsByDivision.keys()).filter(d => divs.has(d));
  }, [filteredProducts, productsByDivision]);

  const toggleProduct = (id: string) => {
    setEmpAllowedProductIds(
      empAllowedProductIds.includes(id)
        ? empAllowedProductIds.filter(x => x !== id)
        : [...empAllowedProductIds, id]
    );
  };

  const toggleDivision = (division: string) => {
    const divProducts = productsByDivision.get(division) || [];
    const divIds = divProducts.map(p => p.id);
    const allSelected = divIds.every(id => empAllowedProductIds.includes(id));
    if (allSelected) {
      setEmpAllowedProductIds(empAllowedProductIds.filter(id => !divIds.includes(id)));
    } else {
      const newIds = new Set([...empAllowedProductIds, ...divIds]);
      setEmpAllowedProductIds(Array.from(newIds));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) onReset(); }}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader><DialogTitle>{editingId ? "עריכת משתמש" : "הוספת משתמש חדש"}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2 overflow-y-auto flex-1">
          <div className="space-y-2">
            <Label>שם *</Label>
            <Input value={empName} onChange={e => setEmpName(e.target.value)} placeholder="שם המשתמש" />
          </div>
          {!editingId && (
            <div className="space-y-2">
              <Label>אימייל *</Label>
              <Input type="email" value={empEmail} onChange={e => setEmpEmail(e.target.value)} placeholder="user@example.com" dir="ltr" />
            </div>
          )}
          <div className="space-y-2">
            <Label>תפקיד</Label>
            <Select value={empRoleDefId} onValueChange={v => setEmpRoleDefId(v)}>
              <SelectTrigger><SelectValue placeholder="בחר תפקיד" /></SelectTrigger>
              <SelectContent>
                {nonManagerRoleDefinitions.map(rd => (
                  <SelectItem key={rd.id} value={rd.id}>{rd.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>חטיבה</Label>
            <Select value={empDivision || "none"} onValueChange={v => setEmpDivision(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="ללא חטיבה" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ללא חטיבה</SelectItem>
                {DIVISIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{editingId ? "סיסמה חדשה (אופציונלי)" : "סיסמה ראשונית *"}</Label>
            <Input
              type="password"
              value={empPassword}
              onChange={e => setEmpPassword(e.target.value)}
              placeholder={editingId ? "השאר ריק לאי-שינוי" : "לפחות 6 תווים"}
              dir="ltr"
            />
          </div>

          {/* Product scope selector */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowProducts(!showProducts)}
              className="flex items-center gap-2 w-full text-right"
            >
              <Package className="h-4 w-4 text-muted-foreground" />
              <Label className="cursor-pointer flex-1">הגבלת גישה למוצרים</Label>
              {empAllowedProductIds.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {empAllowedProductIds.length} נבחרו
                </Badge>
              )}
              {showProducts ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showProducts && (
              <div className="border rounded-lg p-3 space-y-3">
                <p className="text-xs text-muted-foreground">
                  בחר מוצרים שהעובד יוכל לגשת אליהם. אם לא נבחרו מוצרים - העובד יראה הכל לפי הרשאות התפקיד.
                </p>

                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    placeholder="חיפוש מוצר..."
                    className="h-8 text-xs pr-8"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto space-y-2">
                  {filteredDivisions.map(div => {
                    const divProducts = (productsByDivision.get(div) || []).filter(p =>
                      filteredProducts.some(fp => fp.id === p.id)
                    );
                    const allSelected = divProducts.every(p => empAllowedProductIds.includes(p.id));
                    const someSelected = divProducts.some(p => empAllowedProductIds.includes(p.id));

                    return (
                      <div key={div}>
                        <div
                          className="flex items-center gap-2 py-1 cursor-pointer hover:bg-muted/50 rounded px-1"
                          onClick={() => toggleDivision(div)}
                        >
                          <Checkbox
                            checked={allSelected ? true : someSelected ? "indeterminate" : false}
                            className="pointer-events-none"
                          />
                          <span className="text-xs font-semibold text-muted-foreground">{div}</span>
                        </div>
                        <div className="mr-5 space-y-0.5">
                          {divProducts.map(p => (
                            <div
                              key={p.id}
                              className="flex items-center gap-2 py-0.5 cursor-pointer hover:bg-muted/50 rounded px-1"
                              onClick={() => toggleProduct(p.id)}
                            >
                              <Checkbox
                                checked={empAllowedProductIds.includes(p.id)}
                                className="pointer-events-none"
                              />
                              <span className="text-xs truncate">{p.name}</span>
                              <span className="text-[10px] text-muted-foreground mr-auto" dir="ltr">{p.sku}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {empAllowedProductIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setEmpAllowedProductIds([])}
                    className="text-xs text-destructive hover:underline"
                  >
                    נקה בחירה
                  </button>
                )}
              </div>
            )}
          </div>

          <Button
            onClick={onSubmit}
            disabled={!empName.trim() || (!editingId && (!empEmail.trim() || empPassword.length < 6)) || submitting}
            className="w-full"
          >
            {submitting ? "שומר..." : editingId ? "עדכן משתמש" : "הוסף משתמש"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
