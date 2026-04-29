import { useParams, useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { useData, categories, divisions, type ProductComponent } from "@/contexts/AppContext";
import { useLiveProductMetrics } from "@/hooks/useLiveProductMetrics";
import { usePickupMonthlyAvg } from "@/hooks/usePickupMonthlyAvg";
import { Button } from "@/components/ui/button";
import { ArrowRight, ExternalLink, Info, Pencil, Trash2 } from "lucide-react";
import ProductDeleteDialog from "@/components/products/ProductDeleteDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import ProductIssuesTab from "@/components/ProductIssuesTab";
import ProductLicensesTab from "@/components/ProductLicensesTab";
import DocumentsSection from "@/components/DocumentsSection";
import ComplianceTab from "@/components/documents/ComplianceTab";
import ProductEditDialog from "@/components/products/ProductEditDialog";
import { usePermissions } from "@/hooks/usePermissions";
import { useProductScope } from "@/hooks/useProductScope";
import { useProductSupplierPayments } from "@/hooks/useProductSupplierPayments";
import { toast } from "sonner";
import { ProductDetailsGrid } from "@/components/product-detail/ProductDetailsGrid";
import { QuantityBar } from "@/components/ui/QuantityBar";
import { BOMTable } from "@/components/product-detail/BOMTable";
import { PhotoCaptureButton } from "@/components/ui/PhotoCaptureButton";
import { OrdersHistoryTable } from "@/components/product-detail/OrdersHistoryTable";
import { WasteItemsSection } from "@/components/product-detail/WasteItemsSection";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { products, orders, updateProduct, suppliers, addComponent, updateComponent, deleteComponent, deleteProduct } = useData();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const categoryOptions = useMemo(() => categories.filter(c => c !== "הכל").map(c => ({ value: c, label: c })), []);
  const supplierOptions = useMemo(() => suppliers.map(s => ({ value: s.company, label: s.company })), [suppliers]);
  const divisionOptions = useMemo(() => divisions.map(d => ({ value: d, label: d })), []);
  const productTypeOptions = [{ value: "פשוט", label: "פשוט" }, { value: "מורכב", label: "מורכב" }];
  const shippingOptions = [
    { value: "ים", label: "ים" }, { value: "אוויר", label: "אוויר" },
    { value: "יבשה", label: "יבשה" }, { value: "אקספרס", label: "אקספרס" },
  ];

  const { hasEdit } = usePermissions("products");
  const { hasEdit: hasInventoryEdit } = usePermissions("inventory");
  const canEditStock = hasEdit || hasInventoryEdit;
  const { isScoped, scopedProductIds } = useProductScope();

  const product = products.find(p => p.id === id);
  const productArr = useMemo(() => (product ? [product] : []), [product]);
  const { metrics } = useLiveProductMetrics(productArr);
  const { avgByProduct } = usePickupMonthlyAvg();
  const relatedOrders = useMemo(
    () => product ? orders.filter(o => o.items.some(item => item.name === product.name || item.product_id === product.id)) : [],
    [orders, product]
  );
  const supplierPayments = useProductSupplierPayments(product?.id ?? "", relatedOrders);

  if (!product || (isScoped && id && !scopedProductIds.has(id))) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-lg text-muted-foreground">מוצר לא נמצא</p>
        <Button variant="outline" onClick={() => navigate("/products")}><ArrowRight className="h-4 w-4 ml-2" />חזרה למוצרים</Button>
      </div>
    );
  }

  const stockStatus = product.stock_qty === 0
    ? { label: "אזל מהמלאי", className: "bg-destructive/15 text-destructive" }
    : product.monthly_order && product.stock_qty < product.monthly_order
    ? { label: "מלאי נמוך", className: "bg-warning/15 text-warning" }
    : { label: "תקין", className: "bg-success/15 text-success" };

  const handleInlineSave = async (field: string, value: string) => {
    const numericFields = ["purchase_price", "sale_price", "monthly_order", "stock_qty", "monthly_sales_avg"];
    const updates: Record<string, string | number | null> = {};
    const finalValue = field === "sku" ? value.toUpperCase() : value;
    updates[field] = numericFields.includes(field) ? (finalValue ? Number(finalValue) : null) : (finalValue || null);

    try {
      await updateProduct(product.id, updates);
      toast.success("עודכן");
    } catch {
      // error toast already shown by AppContext
    }
  };

  const details: { label: string; field: string; value: string | number | undefined | null; isSupplierLink?: boolean; options?: { value: string; label: string }[]; multiSelect?: boolean; readOnly?: boolean; tooltip?: string; isComputed?: boolean }[] = [
    { label: "קטגוריה", field: "category", value: product.category, options: categoryOptions, tooltip: "הקטגוריה שהמוצר שייך אליה" },
    { label: "חטיבות", field: "division", value: product.division, options: divisionOptions, multiSelect: true, tooltip: "החטיבות הארגוניות שמשתמשות במוצר" },
    { label: "מק״ט", field: "sku", value: product.sku, tooltip: "קוד מוצר ייחודי (SKU)" },
    { label: "סוג מוצר", field: "product_type", value: product.product_type, options: productTypeOptions, tooltip: "מוגמר = מוצר בסיסי, מורכב = הרכבה מרכיבים" },
    { label: "תיאור", field: "description", value: product.description, tooltip: "תיאור חופשי של המוצר" },
    { label: "ספק", field: "supplier", value: product.supplier, isSupplierLink: true, options: supplierOptions, tooltip: "הספק הראשי שממנו מזמינים את המוצר" },
    { label: "שיטת משלוח", field: "shipping", value: product.shipping, options: shippingOptions, tooltip: "אופן המשלוח המועדף מהספק" },
    { label: "מחיר רכישה", field: "purchase_price", value: product.purchase_price, tooltip: product.product_type === "מורכב" ? "מחושב אוטומטית — סכום מחירי הרכיבים" : "מחיר קנייה מהספק ($)" },
    { label: "מחיר מכירה", field: "sale_price", value: product.sale_price, tooltip: "מחיר מכירה ללקוח הסופי ($)" },
    { label: "מכירות חודשיות (לפי הצטיידות)", field: "monthly_sales", value: avgByProduct.get(product.id) ?? undefined, readOnly: true, isComputed: true, tooltip: "מחושב אוטומטית — ממוצע כמויות שהוצאו מהמלאי בחודשים האחרונים" },
    { label: "הזמנה חודשית", field: "monthly_order", value: product.monthly_order, tooltip: "כמות ההזמנה החודשית המתוכננת — מוגדרת ידנית" },
    { label: "ממוצע צריכה שנתי (SAP)", field: "monthly_sales_avg", value: product.monthly_sales_avg, tooltip: "ממוצע צריכה שנתי ממערכת SAP — מוגדר ידנית" },
    { label: "מלאי קיים", field: "stock_qty", value: product.stock_qty, tooltip: "כמות יחידות פיזיות במחסן — מוגדרת ידנית" },
    { label: 'עול"ב', field: "incoming_qty", value: metrics[product.id]?.incomingQty ?? product.incoming_qty, readOnly: true, isComputed: true, tooltip: 'מחושב אוטומטית — סכום כמויות מהזמנות פעילות (נשלח / הגיע לנמל / שחרור מכס)' },
    { label: "הערות", field: "notes", value: product.notes, tooltip: "הערות חופשיות על המוצר" },
  ];

  const handleSaveEdit = async (id: string, updates: Record<string, unknown>) => {
    try {
      await updateProduct(id, updates);
      toast.success("המוצר עודכן");
    } catch {
      // error toast already shown by AppContext
    }
  };

  const handleAddComponent = async (comp: {
    product_id: string;
    name: string;
    sku: string | null;
    supplier: string | null;
    origin: string | null;
    stock_qty: number | null;
    price: number | null;
    notes: string | null;
  }) => {
    await addComponent(comp);
    toast.success("רכיב נוסף");
  };

  const handleUpdateComponent = async (compId: string, updates: Partial<ProductComponent>) => {
    await updateComponent(compId, updates);
    toast.success("רכיב עודכן");
  };

  const handleDeleteComponent = async (compId: string) => {
    await deleteComponent(compId);
    toast.success("רכיב נמחק");
  };

  const handleDeleteProduct = async () => {
    try {
      await deleteProduct(product.id);
      navigate("/products");
    } catch {
      // error already shown by context
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {/* Row 1: back + photo + name + badges */}
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate("/products")} data-navigate-to="/products"><ArrowRight className="h-5 w-5" /></Button>
          <div className="shrink-0">
            <PhotoCaptureButton
              imageUrl={product.end_product_image}
              storagePath={`products/${product.id}`}
              onSave={async (url) => { await updateProduct(product.id, { end_product_image: url }); toast.success("תמונת מוצר עודכנה"); }}
              disabled={!hasEdit}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{product.name}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground font-mono" dir="ltr">{product.sku}</p>
          </div>
          <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${stockStatus.className}`}>{stockStatus.label}</span>
          <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${
            product.product_type === "מורכב" ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"
          }`}>{product.product_type}</span>
        </div>

        {/* Row 2: action buttons */}
        <div className="flex flex-wrap items-center gap-2 pr-1">
          {product.end_product_url && (
            <Button variant="outline" size="sm" asChild>
              <a href={product.end_product_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 ml-1" />אתר המוצר</a>
            </Button>
          )}
          {hasEdit && <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4 ml-1" />עריכה</Button>}
          {hasEdit && (
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 ml-1" />מחק
            </Button>
          )}
        </div>
      </div>

      <ProductEditDialog open={editOpen} onOpenChange={setEditOpen} product={product} onSave={handleSaveEdit} />

      {/* Quantity bar — visual stock level indicator */}
      <div className="bg-card rounded-xl border shadow-sm px-5 py-4 space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>רמת מלאי</span>
          <span className="tabular-nums">{product.stock_qty} יח׳</span>
        </div>
        <QuantityBar
          value={product.stock_qty}
          min={product.reorder_point ?? 0}
          max={product.monthly_order ?? 0}
          label="מלאי קיים"
          onMinChange={v => handleInlineSave("reorder_point", String(v))}
          onMaxChange={v => handleInlineSave("monthly_order", String(v))}
          readOnly={!canEditStock}
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {product.reorder_point ? <span>מינ׳: {product.reorder_point}</span> : <span />}
          {product.monthly_order ? <span>מקס׳: {product.monthly_order}</span> : <span />}
        </div>
      </div>

      <ProductDetailsGrid
        details={details}
        suppliers={suppliers}
        hasEdit={hasEdit}
        onInlineSave={handleInlineSave}
      />

      <TooltipProvider delayDuration={200}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: "מלאי קיים", value: product.stock_qty, danger: product.stock_qty === 0, tooltip: "כמות יחידות פיזיות במחסן" },
            { label: 'עול"ב', value: metrics[product.id]?.incomingQty ?? product.incoming_qty, tooltip: 'מחושב מהזמנות פעילות (נשלח / הגיע לנמל / שחרור מכס)' },
            { label: "מכירות חודשיות (לפי הצטיידות)", value: avgByProduct.get(product.id) ?? "—", tooltip: "ממוצע מכירות חודשי מחושב מהיסטוריית הוצאות המלאי" },
            { label: "הזמנה חודשית", value: product.monthly_order ?? "—", tooltip: "כמות הזמנה חודשית מתוכננת — מוגדרת ידנית" },
            {
              label: "תשלומים לספק החודש",
              value: supplierPayments.loading ? "..." : supplierPayments.monthly > 0 ? `$${supplierPayments.monthly.toLocaleString("en", { maximumFractionDigits: 0 })}` : "—",
              tooltip: "סה\"כ תשלומים ששולמו לספק עבור הזמנות של מוצר זה בחודש הנוכחי (יחסי לשווי המוצר בהזמנה)",
            },
            {
              label: "תשלומים לספק ברבעון",
              value: supplierPayments.loading ? "..." : supplierPayments.quarterly > 0 ? `$${supplierPayments.quarterly.toLocaleString("en", { maximumFractionDigits: 0 })}` : "—",
              tooltip: "סה\"כ תשלומים ששולמו לספק עבור הזמנות של מוצר זה ברבעון הנוכחי (יחסי לשווי המוצר בהזמנה)",
            },
          ].map((item) => (
            <div key={item.label} className="bg-card rounded-xl border p-4 text-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-xs text-muted-foreground mb-1 inline-flex items-center gap-1 cursor-help">
                    {item.label}
                    <Info className="h-3 w-3 opacity-40 hover:opacity-80 transition-opacity" />
                  </p>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px] text-xs text-right leading-relaxed">
                  {item.tooltip}
                </TooltipContent>
              </Tooltip>
              <p className={`text-2xl font-bold ${item.danger ? "text-destructive" : "text-foreground"}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </TooltipProvider>

      <BOMTable
        product={product}
        suppliers={suppliers}
        hasEdit={hasEdit}
        canEditStock={canEditStock}
        onAddComponent={handleAddComponent}
        onUpdateComponent={handleUpdateComponent}
        onDeleteComponent={handleDeleteComponent}
      />

      <OrdersHistoryTable
        relatedOrders={relatedOrders}
        product={product}
        hasEdit={hasEdit}
      />

      <WasteItemsSection product={product} />

      {/* Documents */}
      <DocumentsSection productId={product.id} />

      {/* Product Licenses Tab */}
      <div className="bg-card rounded-xl border shadow-sm p-5">
        <ProductLicensesTab productId={product.id} hasEdit={hasEdit} />
      </div>

      {/* Compliance */}
      <div className="bg-card rounded-xl border shadow-sm p-5">
        <ComplianceTab productId={product.id} />
      </div>

      {/* Product Issues Tab */}
      <div className="bg-card rounded-xl border shadow-sm p-5">
        <ProductIssuesTab productId={product.id} productName={product.name} />
      </div>

      <ProductDeleteDialog
        open={deleteOpen}
        productId={product.id}
        productName={product.name}
        onConfirm={handleDeleteProduct}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
