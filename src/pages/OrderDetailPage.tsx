/* eslint-disable @typescript-eslint/no-explicit-any */
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { useData, useCurrency, type Priority, type OrderStatus } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { OrderStatusBadge } from "@/components/StatusBadge";
import { ArrowRight, Package, Truck, Calendar, DollarSign, FileText, Trash2, CreditCard, Check, Ship, Hash, Plus, Pencil, ChevronRight, Warehouse } from "lucide-react";
import DocumentsSection from "@/components/DocumentsSection";
import { OrderPaymentsSection } from "@/components/orders/OrderPaymentsSection";
import { OrderAuditLog } from "@/components/orders/OrderAuditLog";
import { ShipmentGroupSelector } from "@/components/orders/ShipmentGroupSelector";
import { DhlTrackingWidget } from "@/components/orders/DhlTrackingWidget";
import { TclogTrackingWidget } from "@/components/orders/TclogTrackingWidget";
import { detectCarrier, carrierLabel } from "@/lib/trackingCarrierDetect";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InlineEditField } from "@/components/InlineEditField";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { useProductScope } from "@/hooks/useProductScope";
import { useAuth } from "@/contexts/AppContext";
import { canSeePrices } from "@/lib/permissions";
import { toast } from "sonner";

import { format } from "date-fns";
const allStatuses: { value: OrderStatus; label: string }[] = [
  { value: "PENDING", label: "ממתין" },
  { value: "ORDERED", label: "הוזמן" },
  { value: "SHIPPED", label: "נשלח" },
  { value: "ARRIVED_PORT", label: "הגיע לנמל" },
  { value: "CUSTOMS_CLEARANCE", label: "שחרור מכס" },
  { value: "DELIVERED", label: "נמסר" },
  { value: "ARRIVED", label: "הגיע (ישן)" },
  { value: "CANCELLED", label: "בוטל" },
];

const priorities: { value: Priority; label: string }[] = [
  { value: "דחוף", label: "דחוף" },
  { value: "גבוה", label: "גבוה" },
  { value: "בינוני", label: "בינוני" },
  { value: "נמוך", label: "נמוך" },
];

const shippingOptions = [
  { value: "ים", label: "ים" },
  { value: "אוויר", label: "אוויר" },
  { value: "יבשה", label: "יבשה" },
  { value: "אקספרס", label: "אקספרס" },
  { value: "בין ספקים", label: "בין ספקים" },
];

const statusOptions = allStatuses.map(s => ({ value: s.value, label: s.label }));
const priorityOptions = priorities.map(p => ({ value: p.value, label: p.label }));

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { updateOrderStatus, updateOrder, deleteOrder, refreshOrders, updateProduct, updateComponent } = useData();
  const { scopedOrders: orders, scopedSuppliers: suppliers, scopedProducts: products, scopeOrderItems } = useProductScope();
  const { currentUser } = useAuth();
  const { formatPrice } = useCurrency();
  const showPrices = canSeePrices(currentUser);

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteItemConfirm, setDeleteItemConfirm] = useState<string | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [inventoryDialog, setInventoryDialog] = useState(false);
  const [editItemDialog, setEditItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [itemName, setItemName] = useState("");
  const [itemQty, setItemQty] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemProductId, setItemProductId] = useState("");
  const [itemComponentId, setItemComponentId] = useState("");

  const order = orders.find(o => o.id === id);
  const supplier = order?.supplier_id ? suppliers.find(s => s.id === order.supplier_id) : null;
  const { hasEdit } = usePermissions("orders");
  const visibleItems = useMemo(() => (order ? scopeOrderItems(order.items) : []), [order, scopeOrderItems]);

  const supplierOptions = useMemo(() => suppliers.map(s => ({ value: s.id, label: s.company })), [suppliers]);

  if (!order) return <div className="p-8 text-center text-muted-foreground">הזמנה לא נמצאה</div>;

  const handleDelete = async () => {
    await deleteOrder(order.id);
    toast.success("ההזמנה נמחקה");
    navigate("/orders");
  };

  const handleInlineSave = async (field: string, value: string) => {
    const updates: Record<string, any> = {};
    if (field === "total_price") {
      updates[field] = value ? Number(value) : null;
    } else if (field === "status") {
      await updateOrderStatus(order.id, value as OrderStatus);
      if (value === "ARRIVED") {
        const hasLinked = order.items.some(item => item.product_id && products.find(p => p.id === item.product_id));
        if (hasLinked) setInventoryDialog(true);
      }
      return;
    } else if (field === "priority") {
      updates[field] = value;
    } else if (field === "supplier_id") {
      updates.supplier_id = value || null;
      const s = suppliers.find(s => s.id === value);
      updates.supplier_name = s?.company || null;
    } else if (field === "destination_supplier_id") {
      updates.destination_supplier_id = value || null;
      const ds = suppliers.find(s => s.id === value);
      updates.destination_supplier_name = ds?.company || null;
    } else if (field === "tracking_number") {
      updates[field] = value || null;
    } else {
      updates[field] = value || null;
    }
    await updateOrder(order.id, updates as any);
    toast.success("עודכן");
  };

  const handleDateSave = async (field: string, date: Date | undefined) => {
    await updateOrder(order.id, { [field]: date ? date.toISOString() : null } as any);
    toast.success("עודכן");
  };

  // Item CRUD
  const openAddItem = () => {
    setEditingItem(null);
    setItemName("");
    setItemQty("1");
    setItemPrice("");
    setItemProductId("");
    setItemComponentId("");
    setEditItemDialog(true);
  };

  const openEditItem = (item: any) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemQty(item.qty?.toString() || "1");
    setItemPrice(item.price?.toString() || "");
    setItemProductId(item.product_id || "");
    setEditItemDialog(true);
  };

  const handleSaveItem = async () => {
    let name = itemName;
    const linkedProduct = itemProductId ? products.find(p => p.id === itemProductId) : null;
    const linkedComponent = itemComponentId && linkedProduct
      ? linkedProduct.components?.find(c => c.id === itemComponentId)
      : null;

    if (linkedComponent) {
      name = `${linkedComponent.name} (${linkedProduct?.name})`;
    } else if (linkedProduct) {
      name = linkedProduct.name;
    }
    if (!name.trim()) return;

    const enteredPrice = itemPrice ? Number(itemPrice) : null;

    if (editingItem) {
      const { error } = await supabase.from("order_items").update({
        name: name.trim(),
        qty: Number(itemQty) || 1,
        price: enteredPrice,
        product_id: itemProductId || null,
      }).eq("id", editingItem.id);
      if (error) { toast.error("שגיאה בעדכון פריט"); return; }
      toast.success("פריט עודכן");
    } else {
      const { error } = await supabase.from("order_items").insert({
        order_id: order.id,
        name: name.trim(),
        qty: Number(itemQty) || 1,
        price: enteredPrice,
        product_id: itemProductId || null,
      });
      if (error) { toast.error("שגיאה בהוספת פריט"); return; }
      toast.success("פריט נוסף");
    }
    setEditItemDialog(false);
    await refreshOrders();

    // Suggest updating the source price if it differs
    if (enteredPrice !== null && enteredPrice > 0) {
      if (linkedComponent && enteredPrice !== linkedComponent.price) {
        const compName = linkedComponent.name;
        toast.info(`מחיר הרכיב "${compName}" לא מוגדר או שונה. תרצה לעדכן ל-${formatPrice(enteredPrice)}?`, {
          action: {
            label: "עדכן",
            onClick: async () => {
              await updateComponent(linkedComponent.id, { price: enteredPrice });
              toast.success(`מחיר הרכיב "${compName}" עודכן ל-${formatPrice(enteredPrice)}`);
            },
          },
          duration: 10000,
        });
      } else if (linkedProduct && !linkedComponent && enteredPrice !== linkedProduct.purchase_price) {
        const prodName = linkedProduct.name;
        toast.info(`מחיר הרכישה של "${prodName}" לא מוגדר או שונה. תרצה לעדכן ל-${formatPrice(enteredPrice)}?`, {
          action: {
            label: "עדכן",
            onClick: async () => {
              try {
                await updateProduct(linkedProduct.id, { purchase_price: enteredPrice });
                toast.success(`מחיר הרכישה של "${prodName}" עודכן ל-${formatPrice(enteredPrice)}`);
              } catch {
                // error toast already shown by AppContext
              }
            },
          },
          duration: 10000,
        });
      }
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    const { error } = await supabase.from("order_items").delete().eq("id", itemId);
    if (error) { toast.error("שגיאה במחיקת פריט"); return; }
    toast.success("פריט נמחק");
    await refreshOrders();
  };

  const handleRefreshTracking = async () => {
    if (!order.tracking_number) { toast.error("אין מספר מעקב להזמנה זו"); return; }
    if (order.tracking_carrier !== "dhl") { toast.error("רענון אוטומטי זמין רק עבור משלוחי DHL — בחר \"DHL\" בשדה \"חברת שילוח\""); return; }
    setTrackingLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-shipment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
        body: JSON.stringify({ order_id: order.id }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || "שגיאה בעדכון מעקב"); return; }
      toast.success("מעקב DHL עודכן");
      await refreshOrders();
    } finally {
      setTrackingLoading(false);
    }
  };

  const allDetails: { label: string; field: string; value: string | number | null | undefined; options?: { value: string; label: string }[]; isDate?: boolean; isSupplierLink?: boolean; icon?: any; isReadOnly?: boolean; priceGated?: boolean; managerOnly?: boolean }[] = [
    { label: "סטטוס", field: "status", value: order.status, options: statusOptions, icon: Check },
    { label: "עדיפות", field: "priority", value: order.priority, options: priorityOptions, icon: Hash },
    { label: "ספק", field: "supplier_id", value: order.supplier_id, options: supplierOptions, isSupplierLink: true, icon: Truck },
    { label: "סה״כ ($)", field: "total_price", value: order.total_price?.toString() ?? "", icon: DollarSign, isReadOnly: true, priceGated: true },
    { label: "שיטת משלוח", field: "shipping", value: order.shipping, options: shippingOptions, icon: Ship },
    { label: "מספר מעקב", field: "tracking_number", value: order.tracking_number, icon: Hash },
    { label: "חברת שילוח", field: "tracking_carrier", value: order.tracking_carrier, icon: Truck, options: [
      { value: "dhl", label: "DHL" },
      { value: "tclog", label: "TCLOG" },
      { value: "other", label: "אחר" },
    ] },
    { label: "מספר PI", field: "pi_number", value: order.pi_number, icon: Hash, priceGated: true },
    { label: "שם אונייה", field: "vessel_name", value: order.vessel_name, icon: Ship },
    { label: "מספר הזמנת מקום", field: "booking_number", value: order.booking_number, icon: Hash },
    { label: "אסמכתא TCLOG", field: "tclog_reference", value: order.tclog_reference, icon: FileText },
    { label: "הערות", field: "notes", value: order.notes, icon: FileText, managerOnly: true },
  ];
  const details = allDetails.filter(d => (showPrices || !d.priceGated) && (showPrices || !d.managerOnly));

  const dateFields = [
    { label: "תאריך הזמנה", field: "order_date", value: order.order_date, icon: Calendar },
    { label: "ETD (יציאה)", field: "etd", value: order.etd, icon: Calendar },
    { label: "ETA (הגעה)", field: "eta", value: order.eta, icon: Calendar },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate("/orders")} className="shrink-0">
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground">תיק הזמנה</h1>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {visibleItems.map((i, idx) => {
              const linkedProduct = i.product_id ? products.find(p => p.id === i.product_id) : products.find(p => p.name === i.name);
              return (
                <span key={idx}>
                  {linkedProduct ? (
                    <button onClick={(e) => { e.preventDefault(); navigate(`/products/${linkedProduct.id}`); }} className="text-primary hover:underline cursor-pointer">{i.name}</button>
                  ) : i.name}
                  {idx < visibleItems.length - 1 && <span>, </span>}
                </span>
              );
            })}
          </p>
        </div>
        {hasEdit && (
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(true)}>
            <Trash2 className="h-4 w-4 ml-1" />מחיקה
          </Button>
        )}
        <PriorityBadge priority={order.priority as Priority} />
      </div>

      {/* Details Grid */}
      <div className="bg-card rounded-xl border shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Package className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">פרטי הזמנה</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {details.map(d => {
            const supplierMatch = d.isSupplierLink && d.value ? suppliers.find(s => s.id === d.value) : null;
            if (d.field === "status") {
              return (
                <InlineEditField key={d.label} label={d.label} value={d.value as string}
                  displayValue={<OrderStatusBadge status={order.status as OrderStatus} />}
                  onSave={(v) => handleInlineSave(d.field, v)} disabled={!hasEdit} options={d.options} />
              );
            }
            if (d.field === "priority") {
              return (
                <InlineEditField key={d.label} label={d.label} value={d.value as string}
                  displayValue={<PriorityBadge priority={order.priority as Priority} />}
                  onSave={(v) => handleInlineSave(d.field, v)} disabled={!hasEdit} options={d.options} />
              );
            }
            return (
              <InlineEditField key={d.label} label={d.label} value={d.value}
                displayValue={supplierMatch ? (
                  <button onClick={() => navigate(`/suppliers/${supplierMatch.id}`)} className="text-sm font-medium text-primary hover:underline">{supplierMatch.company}</button>
                ) : d.field === "total_price" && d.value ? formatPrice(Number(d.value)) : undefined}
                type={d.field === "total_price" ? "number" : "text"}
                onSave={(v) => handleInlineSave(d.field, v)} disabled={d.isReadOnly || !hasEdit} options={d.options} />
            );
          })}
          <ShipmentGroupSelector
            orderId={order.id}
            currentGroupId={order.shipment_group_id}
            hasEdit={hasEdit}
            onUpdated={refreshOrders}
          />
          {order.shipping === "בין ספקים" && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                <Truck className="h-3.5 w-3.5" />
                ספק יעד
              </div>
              {hasEdit ? (
                <Combobox
                  value={(order as any).destination_supplier_id || ""}
                  onValueChange={v => handleInlineSave("destination_supplier_id", v)}
                  options={supplierOptions}
                  placeholder="בחר ספק יעד..."
                  searchPlaceholder="חיפוש ספק..."
                />
              ) : (
                <span className="text-sm font-medium">{(order as any).destination_supplier_name || "—"}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Carrier prompt — tracking_number is set but the carrier hasn't been chosen */}
      {order.tracking_number && !order.tracking_carrier && (() => {
        const guess = detectCarrier(order.tracking_number, order.tclog_reference);
        return (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 flex items-start gap-3 flex-wrap">
            <Truck className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-[14rem]">
              <div className="font-semibold mb-1">בחר את חברת השילוח להזמנה זו</div>
              <p className="text-xs leading-relaxed">
                המספר <span className="font-mono">{order.tracking_number}</span> יכול להיות של DHL או של TCLOG.
                {guess && <> לפי הפורמט נראה שזו <strong>{carrierLabel(guess.carrier)}</strong>{guess.confidence === "low" && " (לא בטוח)"}.</>}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {guess && hasEdit && (
                <Button size="sm" variant="default" onClick={() => handleInlineSave("tracking_carrier", guess.carrier)}>
                  סמן כ-{carrierLabel(guess.carrier)}
                </Button>
              )}
              {hasEdit && guess?.carrier !== "dhl" && (
                <Button size="sm" variant="outline" onClick={() => handleInlineSave("tracking_carrier", "dhl")}>סמן כ-DHL</Button>
              )}
              {hasEdit && guess?.carrier !== "tclog" && (
                <Button size="sm" variant="outline" onClick={() => handleInlineSave("tracking_carrier", "tclog")}>סמן כ-TCLOG</Button>
              )}
            </div>
          </div>
        );
      })()}

      {/* DHL Tracking */}
      {order.tracking_carrier === "dhl" && order.tracking_number && (
        <DhlTrackingWidget order={order} loading={trackingLoading} onRefresh={handleRefreshTracking} />
      )}

      {/* TCLOG Tracking — show whenever there's a TCLOG signal (carrier=tclog OR tclog_reference filled) */}
      {(order.tracking_carrier === "tclog" || order.tclog_reference) && (
        <TclogTrackingWidget order={order} />
      )}

      {/* Dates Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {dateFields.map(d => {
          const date = d.value ? new Date(d.value) : undefined;
          // For the ETA card, surface DHL's tracking_eta when it differs from the user's eta
          // by more than 24 hours (or when the user hasn't set one).
          const isEta = d.field === "eta";
          const trackingEta = isEta && order.tracking_eta ? new Date(order.tracking_eta) : undefined;
          const showDhlEta = !!trackingEta && (
            !date || Math.abs(date.getTime() - trackingEta.getTime()) > 24 * 3600 * 1000
          );
          return (
            <div key={d.field} className="bg-card rounded-xl border p-4 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
                <d.icon className="h-3.5 w-3.5" />{d.label}
              </div>
              {hasEdit ? (
                <DateInput value={date} onChange={dt => handleDateSave(d.field, dt)} clearable />
              ) : (
                <div className="text-sm font-semibold text-foreground">{date ? format(date, "dd/MM/yyyy") : "—"}</div>
              )}
              {isEta && showDhlEta && trackingEta && hasEdit && (
                <button
                  type="button"
                  onClick={() => handleDateSave("eta", trackingEta)}
                  className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                  title="עדכן ETA לפי DHL"
                >
                  DHL: {format(trackingEta, "dd/MM/yyyy")} — סנכרן
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Items with CRUD */}
      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-accent" />
            <h2 className="font-semibold text-foreground">פריטים ({visibleItems.length})</h2>
          </div>
          {hasEdit && (
            <Button variant="outline" size="sm" onClick={openAddItem}>
              <Plus className="h-3.5 w-3.5 ml-1" />הוסף פריט
            </Button>
          )}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-right p-3 font-semibold text-foreground">מוצר</th>
              <th className="text-right p-3 font-semibold text-foreground">כמות</th>
              {showPrices && <th className="text-right p-3 font-semibold text-foreground">מחיר יחידה</th>}
              {showPrices && <th className="text-right p-3 font-semibold text-foreground">סה״כ</th>}
              {hasEdit && <th className="text-right p-3 font-semibold text-foreground w-20">פעולות</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {visibleItems.map(item => {
              const linkedProduct = item.product_id ? products.find(p => p.id === item.product_id) : products.find(p => p.name === item.name);
              return (
                <tr key={item.id} className={linkedProduct ? "cursor-pointer hover:bg-muted/30" : ""} onClick={() => linkedProduct && navigate(`/products/${linkedProduct.id}`)}>
                  <td className="p-3 font-medium text-foreground">
                    {linkedProduct ? <span className="text-primary hover:underline">{item.name}</span> : item.name}
                  </td>
                  <td className="p-3 text-muted-foreground">{item.qty}</td>
                  {showPrices && <td className="p-3 text-muted-foreground">{item.price ? formatPrice(item.price) : "—"}</td>}
                  {showPrices && <td className="p-3 text-muted-foreground">{item.price ? formatPrice(item.price * item.qty) : "—"}</td>}
                  {hasEdit && (
                    <td className="p-3" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditItem(item)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteItemConfirm(item.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Payment Schedule — pricing is hidden from division managers */}
      {showPrices && (
        <OrderPaymentsSection orderId={order.id} orderTotal={order.total_price} hasEdit={hasEdit} supplierId={order.supplier_id} />
      )}

      {/* Documents */}
      <DocumentsSection orderId={order.id} />

      {/* Audit Log / Change History */}
      <OrderAuditLog orderId={order.id} />

      {/* Inventory Update on Arrival */}
      <Dialog open={inventoryDialog} onOpenChange={setInventoryDialog}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-primary" />
              עדכון מלאי
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">הסחורה הגיעה. תרצה לעדכן את המלאי עבור המוצרים הבאים?</p>
          <div className="divide-y rounded-lg border overflow-hidden">
            {order.items
              .filter(item => item.product_id && products.find(p => p.id === item.product_id))
              .map(item => {
                const product = products.find(p => p.id === item.product_id)!;
                return (
                  <div key={item.id} className="flex items-center justify-between px-3 py-2.5 text-sm">
                    <span className="font-medium text-foreground">{item.name}</span>
                    <span className="text-muted-foreground">
                      {product.stock_qty} → <span className="text-success font-semibold">{product.stock_qty + item.qty}</span>
                      <span className="text-xs mr-1">(+{item.qty})</span>
                    </span>
                  </div>
                );
              })}
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setInventoryDialog(false)}>דלג</Button>
            <Button className="flex-1" onClick={async () => {
              const itemsToUpdate = order.items.filter(item => item.product_id && products.find(p => p.id === item.product_id));
              for (const item of itemsToUpdate) {
                const product = products.find(p => p.id === item.product_id)!;
                await updateProduct(product.id, { stock_qty: product.stock_qty + item.qty });
              }
              setInventoryDialog(false);
              toast.success("המלאי עודכן בהצלחה");
            }}>
              עדכן מלאי
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>מחיקת הזמנה</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">האם למחוק את ההזמנה? פעולה זו אינה ניתנת לביטול.</p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(false)}>ביטול</Button>
            <Button variant="destructive" className="flex-1" onClick={handleDelete}>מחק</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Item Confirmation */}
      <Dialog open={!!deleteItemConfirm} onOpenChange={(open) => { if (!open) setDeleteItemConfirm(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>מחיקת פריט</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">האם למחוק את הפריט מההזמנה? פעולה זו אינה ניתנת לביטול.</p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteItemConfirm(null)}>ביטול</Button>
            <Button variant="destructive" className="flex-1" onClick={() => { handleDeleteItem(deleteItemConfirm!); setDeleteItemConfirm(null); }}>מחק</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Item Edit Dialog */}
      <Dialog open={editItemDialog} onOpenChange={setEditItemDialog}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{editingItem ? "עריכת פריט" : "הוספת פריט"}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label>מוצר</Label>
              <Combobox
                value={itemProductId}
                onValueChange={v => {
                  setItemProductId(v);
                  setItemComponentId("");
                  const p = products.find(p => p.id === v);
                  if (p) { setItemName(p.name); setItemPrice(p.purchase_price?.toString() || ""); }
                }}
                options={[{ value: "", label: "ללא" }, ...products.map(p => {
                    const hint = [p.sku, p.supplier].filter(Boolean).join(" · ");
                    return {
                      value: p.id,
                      label: p.name,
                      hint: hint || undefined,
                      keywords: [p.sku, p.supplier].filter((v): v is string => !!v),
                    };
                  })]}
                placeholder="בחר מוצר (אופציונלי)"
                searchPlaceholder="חיפוש מוצר..."
              />
            </div>
            {/* Component selector for composite products */}
            {itemProductId && (() => {
              const selectedProduct = products.find(p => p.id === itemProductId);
              const comps = selectedProduct?.components || [];
              if (comps.length === 0) return null;
              return (
                <div className="space-y-1">
                  <Label>רכיב (מתוך {selectedProduct?.name})</Label>
                  <Combobox
                    value={itemComponentId}
                    onValueChange={v => {
                      setItemComponentId(v);
                      const comp = comps.find(c => c.id === v);
                      if (comp) {
                        setItemName(`${comp.name} (${selectedProduct?.name})`);
                        setItemPrice(comp.price?.toString() || "");
                      }
                    }}
                    options={[{ value: "", label: "ללא" }, ...comps.map(c => ({ value: c.id, label: `${c.name}${c.sku ? ` — ${c.sku}` : ""}` }))]}
                    placeholder="בחר רכיב (אופציונלי)"
                    searchPlaceholder="חיפוש רכיב..."
                  />
                </div>
              );
            })()}
            <div className="space-y-1">
              <Label>שם פריט</Label>
              <Input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="שם הפריט" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>כמות</Label>
                <Input type="number" value={itemQty} onChange={e => setItemQty(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>מחיר יחידה ($)</Label>
                <Input type="number" value={itemPrice} onChange={e => setItemPrice(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleSaveItem} disabled={!itemName.trim()} className="w-full">
              {editingItem ? "שמור שינויים" : "הוסף פריט"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

