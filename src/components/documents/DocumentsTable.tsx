import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useData, useAuth } from "@/contexts/AppContext";
import { ArrowUpDown, ArrowUp, ArrowDown, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import type { PurchaseDocument } from "./types";
import { docStatusFlow, docStatusColors, currencySymbol } from "./constants";
import { DocTypeBadge } from "./DocStatusBadge";

type SortField = "name" | "type" | "supplier" | "product" | "quantity" | "total_price" | "status" | "created_at" | "order";
type SortDir = "asc" | "desc" | null;

interface Props {
  docs: PurchaseDocument[];
  search: string;
  onRefresh: () => void;
  onEdit?: (doc: PurchaseDocument) => void;
}

export default function DocumentsTable({ docs, search, onRefresh, onEdit }: Props) {
  const { suppliers, products, orders } = useData();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const supplierName = (id: string | null) => suppliers.find(s => s.id === id)?.company || "—";
  const productName = (id: string | null) => products.find(p => p.id === id)?.name || "—";
  const orderLabel = (id: string | null) => {
    if (!id) return null;
    const o = orders.find(o => o.id === id);
    return o ? (o.supplier_name || o.id.slice(0, 8)) : null;
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") { setSortField(null); setSortDir(null); }
      else setSortDir("asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const filtered = useMemo(() => {
    let result = docs;

    if (typeFilter !== "all") result = result.filter(d => d.type === typeFilter);
    if (statusFilter !== "all") result = result.filter(d => d.status === statusFilter);
      if (search) {
      const q = search.toLowerCase();
      result = result.filter(d =>
        supplierName(d.supplier_id).toLowerCase().includes(q) ||
        productName(d.product_id).toLowerCase().includes(q) ||
        (d.document_name || "").toLowerCase().includes(q)
      );
    }

    if (sortField && sortDir) {
      result = [...result].sort((a, b) => {
        let cmp = 0;
        switch (sortField) {
          case "name": cmp = (a.document_name || "").localeCompare(b.document_name || ""); break;
          case "type": cmp = a.type.localeCompare(b.type); break;
          case "supplier": cmp = supplierName(a.supplier_id).localeCompare(supplierName(b.supplier_id)); break;
          case "product": cmp = productName(a.product_id).localeCompare(productName(b.product_id)); break;
          case "quantity": cmp = (a.quantity || 0) - (b.quantity || 0); break;
          case "total_price": cmp = (a.total_price || 0) - (b.total_price || 0); break;
          case "status": cmp = docStatusFlow.indexOf(a.status) - docStatusFlow.indexOf(b.status); break;
          case "created_at": cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break;
        }
        return sortDir === "desc" ? -cmp : cmp;
      });
    }

    return result;
  }, [docs, typeFilter, statusFilter, search, sortField, sortDir]);

  const handleStatusChange = async (docId: string, newStatus: string) => {
    const updates: Record<string, any> = { status: newStatus };
    if (newStatus === "אושר") {
      updates.approval_date = new Date().toISOString();
      updates.approved_by = currentUser?.id;
    }
    await supabase.from("purchase_documents").update(updates).eq("id", docId);
    onRefresh();
  };

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[120px]"><SelectValue placeholder="סוג" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסוגים</SelectItem>
            <SelectItem value="PI">PI</SelectItem>
            <SelectItem value="PO">PO</SelectItem>
            <SelectItem value="כללי">כללי</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="סטטוס" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסטטוסים</SelectItem>
            {docStatusFlow.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-right p-3 font-semibold text-foreground cursor-pointer select-none" onClick={() => toggleSort("name")}>
                <span className="flex items-center gap-1">שם <SortIcon field="name" /></span>
              </th>
              <th className="text-right p-3 font-semibold text-foreground cursor-pointer select-none" onClick={() => toggleSort("type")}>
                <span className="flex items-center gap-1">סוג <SortIcon field="type" /></span>
              </th>
              <th className="text-right p-3 font-semibold text-foreground cursor-pointer select-none" onClick={() => toggleSort("supplier")}>
                <span className="flex items-center gap-1">ספק <SortIcon field="supplier" /></span>
              </th>
              <th className="text-right p-3 font-semibold text-foreground cursor-pointer select-none" onClick={() => toggleSort("product")}>
                <span className="flex items-center gap-1">מוצר <SortIcon field="product" /></span>
              </th>
              <th className="text-right p-3 font-semibold text-foreground cursor-pointer select-none" onClick={() => toggleSort("quantity")}>
                <span className="flex items-center gap-1">כמות <SortIcon field="quantity" /></span>
              </th>
              <th className="text-right p-3 font-semibold text-foreground cursor-pointer select-none" onClick={() => toggleSort("total_price")}>
                <span className="flex items-center gap-1">מחיר כולל <SortIcon field="total_price" /></span>
              </th>
              <th className="text-right p-3 font-semibold text-foreground">הזמנה</th>
              <th className="text-right p-3 font-semibold text-foreground cursor-pointer select-none" onClick={() => toggleSort("status")}>
                <span className="flex items-center gap-1">סטטוס <SortIcon field="status" /></span>
              </th>
              <th className="text-right p-3 font-semibold text-foreground">אישור</th>
              <th className="text-right p-3 font-semibold text-foreground cursor-pointer select-none" onClick={() => toggleSort("created_at")}>
                <span className="flex items-center gap-1">תאריך <SortIcon field="created_at" /></span>
              </th>
              
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">אין מסמכים</td></tr>
            ) : filtered.map(doc => (
              <tr
                key={doc.id}
                className="hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => navigate(`/documents/${doc.id}`)}
              >
                <td className="p-3 text-foreground">
                  <div className="flex items-center gap-1.5">
                    {doc.file_url && <Paperclip className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                    <span className="truncate max-w-[200px]">{doc.document_name || doc.notes || "ללא שם"}</span>
                  </div>
                </td>
                <td className="p-3"><DocTypeBadge type={doc.type} /></td>
                <td className="p-3 text-foreground">{supplierName(doc.supplier_id)}</td>
                <td className="p-3 text-foreground">{productName(doc.product_id)}</td>
                <td className="p-3 text-muted-foreground">{doc.quantity || "—"}</td>
                <td className="p-3 text-muted-foreground font-mono" dir="ltr">
                  {doc.total_price ? `${currencySymbol[doc.currency] || ""}${doc.total_price.toLocaleString()}` : "—"}
                </td>
                <td className="p-3" onClick={e => e.stopPropagation()}>
                  {doc.order_id && orderLabel(doc.order_id) ? (
                    <button
                      className="text-xs text-accent hover:underline"
                      onClick={() => navigate(`/orders/${doc.order_id}`)}
                    >
                      {orderLabel(doc.order_id)}
                    </button>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="p-3" onClick={e => e.stopPropagation()}>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className={cn("px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer", docStatusColors[doc.status] || "bg-muted text-muted-foreground")}>
                        {doc.status}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-1" align="start">
                      <div className="flex flex-col gap-0.5">
                        {docStatusFlow.map(s => (
                          <button
                            key={s}
                            onClick={() => handleStatusChange(doc.id, s)}
                            className={cn("px-3 py-1.5 rounded text-xs font-medium text-right transition-colors hover:bg-muted", doc.status === s && "bg-muted")}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </td>
                <td className="p-3 text-xs text-muted-foreground">
                  {doc.approved_by ? format(new Date(doc.approval_date!), "dd/MM/yy") : "—"}
                </td>
                <td className="p-3 text-muted-foreground text-xs">{format(new Date(doc.created_at), "dd/MM/yy")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
