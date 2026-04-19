import { useNavigate } from "react-router-dom";
import { Package } from "lucide-react";
import { InlineEditField } from "@/components/InlineEditField";
import type { Supplier } from "@/contexts/AppContext";

interface ProductDetailsGridProps {
  details: Array<{
    label: string;
    field: string;
    value: string | number | undefined | null;
    isSupplierLink?: boolean;
    options?: Array<{ value: string; label: string }>;
    multiSelect?: boolean;
    readOnly?: boolean;
    tooltip?: string;
    isComputed?: boolean;
  }>;
  suppliers: Array<{ id: string; company: string }>;
  hasEdit: boolean;
  onInlineSave: (field: string, value: string) => Promise<void>;
}

export function ProductDetailsGrid({ details, suppliers, hasEdit, onInlineSave }: ProductDetailsGridProps) {
  const navigate = useNavigate();

  return (
    <div className="bg-card rounded-xl border shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Package className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">פרטי מוצר</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {details.filter(d => d.value != null && d.value !== "").map(d => {
          const supplierMatch = d.isSupplierLink && typeof d.value === "string"
            ? suppliers.find(s => s.company === d.value)
            : null;

          return (
            <InlineEditField
              key={d.label}
              label={d.label}
              value={d.value}
              displayValue={
                supplierMatch ? (
                  <button
                    onClick={() => navigate(`/suppliers/${supplierMatch.id}`)}
                    data-navigate-to={`/suppliers/${supplierMatch.id}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {d.value}
                  </button>
                ) : d.field === "purchase_price" || d.field === "sale_price"
                  ? (d.value ? `$${d.value}` : "—")
                  : undefined
              }
              type={
                ["purchase_price", "sale_price", "monthly_sales", "monthly_order", "stock_qty", "incoming_qty"].includes(d.field)
                  ? "number"
                  : "text"
              }
              onSave={(v) => onInlineSave(d.field, v)}
              disabled={!hasEdit || !!d.readOnly}
              options={d.options}
              multiSelect={d.multiSelect}
              tooltip={d.tooltip}
              isComputed={d.isComputed}
            />
          );
        })}
      </div>
    </div>
  );
}
