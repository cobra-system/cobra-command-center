import { useParams, useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { useData, categories, divisions, type ProductComponent } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowRight, ExternalLink, Pencil, Trash2 } from "lucide-react";
import ProductIssuesTab from "@/components/ProductIssuesTab";
import ProductLicensesTab from "@/components/ProductLicensesTab";
import DocumentsSection from "@/components/DocumentsSection";
import ComplianceTab from "@/components/documents/ComplianceTab";
import ProductEditDialog from "@/components/products/ProductEditDialog";
import { usePermissions } from "@/hooks/usePermissions";
import { useProductScope } from "@/hooks/useProductScope";
import { toast } from "sonner";
import { ProductDetailsGrid } from "@/components/product-detail/ProductDetailsGrid";
import { BOMTable } from "@/components/product-detail/BOMTable";
import { OrdersHistoryTable } from "@/components/product-detail/OrdersHistoryTable";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { products, orders, updateProduct, suppliers, addComponent, updateComponent, deleteComponent, deleteProduct } = useData();
  const [editOpen, setEditOpen] = useState(false);

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
  if (!product || (isScoped && id && !scopedProductIds.has(id))) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-lg text-muted-foreground">מוצר לא נמצא</p>
        <Button variant="outline" onClick={() => navigate("/products")}><ArrowRight className="h-4 w-4 ml-2" />חזרה למוצרים</Button>
      </div>
    );
  }
  const relatedOrders = orders.filter(o => o.items.some(item => item.name === product.name || item.product_id === product.id));

  const stockStatus = product.stock_qty === 0
    ? { label: "אזל מהמלאי", className: "bg-destructive/15 text-destructive" }
    : product.monthly_order && product.stock_qty < product.monthly_order
    ? { label: "מלאי נמוך", className: "bg-warning/15 text-warning" }
    : { label: "תקין", className: "bg-success/15 text-success" };

  const handleInlineSave = async (field: string, value: string) => {
    const numericFields = ["purchase_price", "sale_price", "monthly_sales", "monthly_order", "stock_qty", "incoming_qty"];
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

  const details: { label: string; field: string; value: string | number | undefined | null; isSupplierLink?: boolean; options?: { value: string; label: string }[]; multiSelect?: boolean }[] = [
    { label: "קטגוריה", field: "category", value: product.category, options: categoryOptions },
    { label: "חטיבות", field: "division", value: product.division, options: divisionOptions, multiSelect: true },
    { label: "מק״ט", field: "sku", value: product.sku },
    { label: "סוג מוצר", field: "product_type", value: product.product_type, options: productTypeOptions },
    { label: "תיאור", field: "description", value: product.description },
    { label: "ספק", field: "supplier", value: product.supplier, isSupplierLink: true, options: supplierOptions },
    { label: "שיטת משלוח", field: "shipping", value: product.shipping, options: shippingOptions },
    { label: "מחיר רכישה", field: "purchase_price", value: product.purchase_price },
    { label: "מחיר מכירה", field: "sale_price", value: product.sale_price },
    { label: "מכירות חודשיות", field: "monthly_sales", value: product.monthly_sales },
    { label: "הזמנה חודשית", field: "monthly_order", value: product.monthly_order },
    { label: "מלאי קיים", field: "stock_qty", value: product.stock_qty },
    { label: "בדרך", field: "incoming_qty", value: product.incoming_qty },
    { label: "הערות", field: "notes", value: product.notes },
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

  const handleDeleteProduct = async (e: React.MouseEvent) => {
    e.preventDefault();
    await deleteProduct(product.id);
    toast.success("המוצר נמחק");
    navigate("/products");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/products")} data-navigate-to="/products"><ArrowRight className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{product.name}</h1>
          <p className="text-sm text-muted-foreground font-mono" dir="ltr">{product.sku}</p>
        </div>
        {product.end_product_url && (
          <Button variant="outline" size="sm" asChild>
            <a href={product.end_product_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 ml-1" />אתר המוצר</a>
          </Button>
        )}
        {hasEdit && <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4 ml-1" />עריכה</Button>}
        {hasEdit && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4 ml-1" />מחק</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>מחיקת מוצר</AlertDialogTitle>
                <AlertDialogDescription>האם למחוק את "{product.name}"? פעולה זו לא ניתנת לביטול.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>ביטול</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteProduct} className="bg-destructive text-destructive-foreground">מחק</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${stockStatus.className}`}>{stockStatus.label}</span>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          product.product_type === "מורכב" ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"
        }`}>{product.product_type}</span>
      </div>

      <ProductEditDialog open={editOpen} onOpenChange={setEditOpen} product={product} onSave={handleSaveEdit} />

      <ProductDetailsGrid
        details={details}
        suppliers={suppliers}
        hasEdit={hasEdit}
        onInlineSave={handleInlineSave}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "מלאי קיים", field: "stock_qty", value: product.stock_qty, danger: product.stock_qty === 0 },
          { label: "בדרך", field: "incoming_qty", value: product.incoming_qty },
          { label: "מכירות חודשיות", field: "monthly_sales", value: product.monthly_sales ?? "—" },
          { label: "הזמנה חודשית", field: "monthly_order", value: product.monthly_order ?? "—" },
        ].map((item) => (
          <div key={item.label} className="bg-card rounded-xl border p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
            <p className={`text-2xl font-bold ${item.danger ? "text-destructive" : "text-foreground"}`}>{item.value}</p>
          </div>
        ))}
      </div>

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
    </div>
  );
}
