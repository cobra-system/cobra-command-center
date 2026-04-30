import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Boxes, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SupplierComparisonPanel from "@/components/SupplierComparisonPanel";
import { InlineEditField } from "@/components/InlineEditField";
import { PhotoCaptureButton } from "@/components/ui/PhotoCaptureButton";
import { toast } from "sonner";
import type { Product, Supplier, ProductComponent } from "@/contexts/AppContext";

interface BOMTableProps {
  product: Product;
  suppliers: Supplier[];
  hasEdit: boolean;
  canEditStock?: boolean;
  onAddComponent: (comp: {
    product_id: string;
    name: string;
    sku: string | null;
    supplier: string | null;
    origin: string | null;
    stock_qty: number | null;
    price: number | null;
    notes: string | null;
  }) => Promise<void>;
  onUpdateComponent: (id: string, updates: Partial<ProductComponent>) => Promise<void>;
  onDeleteComponent: (id: string) => Promise<void>;
}

const emptyNewComp = { name: "", sku: "", supplier: "", origin: "", stock_qty: "", price: "", notes: "" };

export function BOMTable({ product, suppliers, hasEdit, canEditStock, onAddComponent, onUpdateComponent, onDeleteComponent }: BOMTableProps) {
  const navigate = useNavigate();
  const [addCompOpen, setAddCompOpen] = useState(false);
  const [editingCompId, setEditingCompId] = useState<string | null>(null);
  const [editCompFields, setEditCompFields] = useState<Record<string, string>>({});
  const [mobileEditComp, setMobileEditComp] = useState<ProductComponent | null>(null);
  const [mobileEditFields, setMobileEditFields] = useState<Record<string, string>>({});
  const [savingMobileEdit, setSavingMobileEdit] = useState(false);
  const [newComp, setNewComp] = useState(emptyNewComp);
  const [savingComp, setSavingComp] = useState(false);

  const startEditComp = (comp: ProductComponent) => {
    setEditingCompId(comp.id);
    setEditCompFields({
      name: comp.name || "",
      sku: comp.sku || "",
      supplier: comp.supplier || "",
      origin: comp.origin || "",
      stock_qty: comp.stock_qty?.toString() || "",
      price: comp.price?.toString() || "",
      notes: comp.notes || "",
    });
  };

  const handleSaveComp = async () => {
    if (!editingCompId) return;
    setSavingComp(true);
    try {
      await onUpdateComponent(editingCompId, {
        name: editCompFields.name,
        sku: editCompFields.sku || null,
        supplier: editCompFields.supplier || null,
        origin: editCompFields.origin || null,
        stock_qty: editCompFields.stock_qty ? Number(editCompFields.stock_qty) : null,
        price: editCompFields.price ? Number(editCompFields.price) : null,
        notes: editCompFields.notes || null,
      });
      setEditingCompId(null);
    } finally {
      setSavingComp(false);
    }
  };

  const handleAddComponent = async () => {
    if (!newComp.name.trim()) return;
    setSavingComp(true);
    try {
      await onAddComponent({
        product_id: product.id,
        name: newComp.name,
        sku: newComp.sku || null,
        supplier: newComp.supplier || null,
        origin: newComp.origin || null,
        stock_qty: newComp.stock_qty ? Number(newComp.stock_qty) : null,
        price: newComp.price ? Number(newComp.price) : null,
        notes: newComp.notes || null,
      });
      setNewComp(emptyNewComp);
      setAddCompOpen(false);
    } finally {
      setSavingComp(false);
    }
  };

  const openMobileEdit = (comp: ProductComponent) => {
    setMobileEditComp(comp);
    setMobileEditFields({
      name: comp.name || "",
      sku: comp.sku || "",
      supplier: comp.supplier || "",
      origin: comp.origin || "",
      stock_qty: comp.stock_qty?.toString() || "",
      price: comp.price?.toString() || "",
      notes: comp.notes || "",
    });
  };

  const handleSaveMobileEdit = async () => {
    if (!mobileEditComp) return;
    setSavingMobileEdit(true);
    try {
      await onUpdateComponent(mobileEditComp.id, {
        name: mobileEditFields.name,
        sku: mobileEditFields.sku || null,
        supplier: mobileEditFields.supplier || null,
        origin: mobileEditFields.origin || null,
        stock_qty: mobileEditFields.stock_qty ? Number(mobileEditFields.stock_qty) : null,
        price: mobileEditFields.price ? Number(mobileEditFields.price) : null,
        notes: mobileEditFields.notes || null,
      });
      setMobileEditComp(null);
    } finally {
      setSavingMobileEdit(false);
    }
  };

  return (
    <>
      {product.product_type === "מורכב" && (
        <div className="bg-card rounded-xl border shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Boxes className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-semibold text-foreground">רכיבים (BOM)</h2>
            </div>
            {hasEdit && (
              <Button variant="outline" size="sm" onClick={() => setAddCompOpen(true)}>
                <Plus className="h-4 w-4 ml-1" />הוסף רכיב
              </Button>
            )}
          </div>
          {product.components && product.components.length > 0 ? (
            <>
              {/* Mobile card list */}
              <div className="md:hidden space-y-2">
                {product.components.map(comp => (
                  <div key={comp.id} className="bg-muted/30 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <div className="shrink-0">
                        <PhotoCaptureButton
                          imageUrl={comp.image_url}
                          storagePath={`components/${comp.id}`}
                          onSave={async (url) => { await onUpdateComponent(comp.id, { image_url: url }); }}
                          disabled={!canEditStock}
                        />
                      </div>
                      <button
                        onClick={() => navigate(`/products/${product.id}/components/${comp.id}`)}
                        className="flex-1 font-medium text-sm text-foreground truncate text-right hover:text-primary hover:underline"
                      >
                        {comp.name}
                      </button>
                      {hasEdit && (
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openMobileEdit(comp)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onDeleteComponent(comp.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                      {comp.sku && <span className="font-mono" dir="ltr">{comp.sku}</span>}
                      {comp.supplier && (
                        <span>
                          ספק:{" "}
                          {(() => {
                            const s = suppliers.find(s => s.company === comp.supplier);
                            return s ? (
                              <button onClick={() => navigate(`/suppliers/${s.id}`)} className="text-primary hover:underline">{comp.supplier}</button>
                            ) : comp.supplier;
                          })()}
                        </span>
                      )}
                      <span>מלאי: {comp.stock_qty ?? "—"}</span>
                      {comp.price != null && <span>${comp.price}</span>}
                      {comp.notes && <span className="truncate max-w-[200px]">💡 {comp.notes}</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 w-8"></th>
                    <th className="text-right p-3 font-semibold text-foreground">רכיב</th>
                    <th className="text-right p-3 font-semibold text-foreground">מק״ט</th>
                    <th className="text-right p-3 font-semibold text-foreground">ספק</th>
                    <th className="text-right p-3 font-semibold text-foreground">מלאי</th>
                    <th className="text-right p-3 font-semibold text-foreground">מחיר</th>
                    <th className="text-right p-3 font-semibold text-foreground">הערות</th>
                    {hasEdit && <th className="text-right p-3 font-semibold text-foreground">פעולות</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {product.components.map(comp =>
                    editingCompId === comp.id ? (
                      <tr key={comp.id} className="bg-accent/5">
                        <td className="p-2">
                          <PhotoCaptureButton
                            imageUrl={comp.image_url}
                            storagePath={`components/${comp.id}`}
                            onSave={async (url) => { await onUpdateComponent(comp.id, { image_url: url }); }}
                            disabled={!canEditStock}
                          />
                        </td>
                        <td className="p-2">
                          <Input value={editCompFields.name} onChange={e => setEditCompFields(p => ({ ...p, name: e.target.value }))} className="h-8 text-sm" />
                        </td>
                        <td className="p-2">
                          <Input value={editCompFields.sku} onChange={e => setEditCompFields(p => ({ ...p, sku: e.target.value.toUpperCase() }))} className="h-8 text-sm" dir="ltr" />
                        </td>
                        <td className="p-2">
                          <Select value={editCompFields.supplier || "__none__"} onValueChange={v => setEditCompFields(p => ({ ...p, supplier: v === "__none__" ? "" : v }))}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="בחר ספק" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">ללא</SelectItem>
                              {suppliers.map(s => <SelectItem key={s.id} value={s.company}>{s.company}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Input type="number" value={editCompFields.stock_qty} onChange={e => setEditCompFields(p => ({ ...p, stock_qty: e.target.value }))} className="h-8 text-sm w-20" />
                        </td>
                        <td className="p-2">
                          <Input type="number" value={editCompFields.price} onChange={e => setEditCompFields(p => ({ ...p, price: e.target.value }))} className="h-8 text-sm w-20" />
                        </td>
                        <td className="p-2">
                          <Input value={editCompFields.notes} onChange={e => setEditCompFields(p => ({ ...p, notes: e.target.value }))} className="h-8 text-sm" />
                        </td>
                        <td className="p-2">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveComp} disabled={savingComp}>
                              <Save className="h-3.5 w-3.5 text-success" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingCompId(null)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={comp.id}>
                        <td className="p-3">
                          <PhotoCaptureButton
                            imageUrl={comp.image_url}
                            storagePath={`components/${comp.id}`}
                            onSave={async (url) => { await onUpdateComponent(comp.id, { image_url: url }); }}
                            disabled={!canEditStock}
                          />
                        </td>
                        <td className="p-3 font-medium text-foreground">
                          <button
                            onClick={() => navigate(`/products/${product.id}/components/${comp.id}`)}
                            className="hover:text-primary hover:underline text-right"
                          >
                            {comp.name}
                          </button>
                        </td>
                        <td className="p-3 text-muted-foreground font-mono text-xs" dir="ltr">{comp.sku || "—"}</td>
                        <td className="p-3 text-muted-foreground">
                          {(() => {
                            const s = suppliers.find(s => s.company === comp.supplier);
                            return s ? (
                              <button onClick={() => navigate(`/suppliers/${s.id}`)} data-navigate-to={`/suppliers/${s.id}`} className="text-primary hover:underline">
                                {comp.supplier}
                              </button>
                            ) : (comp.supplier || "—");
                          })()}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {canEditStock ? (
                            <InlineEditField
                              value={comp.stock_qty ?? 0}
                              type="number"
                              onSave={async (v) => {
                                await onUpdateComponent(comp.id, { stock_qty: v !== "" ? Number(v) : null });
                                toast.success("מלאי רכיב עודכן");
                              }}
                              inputClassName="w-16 h-8 text-center text-sm"
                              displayValue={<span className="text-sm text-muted-foreground">{comp.stock_qty ?? "—"}</span>}
                            />
                          ) : (
                            comp.stock_qty ?? "—"
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground">{comp.price ? `$${comp.price}` : "—"}</td>
                        <td className="p-3 text-muted-foreground text-xs">{comp.notes || "—"}</td>
                        {hasEdit && (
                          <td className="p-3">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditComp(comp)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onDeleteComponent(comp.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  )}
                </tbody>
              </table>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">לא הוגדרו רכיבים למוצר זה</p>
          )}
          {product.components && product.components.length > 0 && (
            <div className="mt-4 space-y-3">
              {product.components.map(comp => (
                <SupplierComparisonPanel key={comp.id} componentName={comp.name} productId={product.id} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Component Dialog */}
      <Dialog open={addCompOpen} onOpenChange={setAddCompOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>הוספת רכיב</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">שם רכיב *</Label>
                <Input value={newComp.name} onChange={e => setNewComp(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">מק״ט</Label>
                <Input value={newComp.sku} onChange={e => setNewComp(p => ({ ...p, sku: e.target.value.toUpperCase() }))} dir="ltr" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">ספק</Label>
                <Select value={newComp.supplier || "__none__"} onValueChange={v => setNewComp(p => ({ ...p, supplier: v === "__none__" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="בחר ספק" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">ללא</SelectItem>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.company}>{s.company}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">מלאי</Label>
                <Input type="number" value={newComp.stock_qty} onChange={e => setNewComp(p => ({ ...p, stock_qty: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">מחיר ($)</Label>
                <Input type="number" value={newComp.price} onChange={e => setNewComp(p => ({ ...p, price: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">הערות</Label>
              <Input value={newComp.notes} onChange={e => setNewComp(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <Button onClick={handleAddComponent} className="w-full" disabled={savingComp || !newComp.name.trim()}>
              {savingComp ? "שומר..." : "הוסף רכיב"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile edit dialog */}
      <Dialog open={!!mobileEditComp} onOpenChange={open => { if (!open) setMobileEditComp(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>עריכת רכיב</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">שם רכיב *</Label>
                <Input value={mobileEditFields.name || ""} onChange={e => setMobileEditFields(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">מק״ט</Label>
                <Input value={mobileEditFields.sku || ""} onChange={e => setMobileEditFields(p => ({ ...p, sku: e.target.value.toUpperCase() }))} dir="ltr" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">ספק</Label>
                <Select value={mobileEditFields.supplier || "__none__"} onValueChange={v => setMobileEditFields(p => ({ ...p, supplier: v === "__none__" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="בחר ספק" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">ללא</SelectItem>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.company}>{s.company}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">מלאי</Label>
                <Input type="number" value={mobileEditFields.stock_qty || ""} onChange={e => setMobileEditFields(p => ({ ...p, stock_qty: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">מחיר ($)</Label>
                <Input type="number" value={mobileEditFields.price || ""} onChange={e => setMobileEditFields(p => ({ ...p, price: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">הערות</Label>
              <Input value={mobileEditFields.notes || ""} onChange={e => setMobileEditFields(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <Button onClick={handleSaveMobileEdit} className="w-full" disabled={savingMobileEdit || !mobileEditFields.name?.trim()}>
              {savingMobileEdit ? "שומר..." : "שמור שינויים"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
