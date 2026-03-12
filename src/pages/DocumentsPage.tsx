import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Plus, Search, Upload, CreditCard, ScrollText } from "lucide-react";
import type { PurchaseDocument, Payment } from "@/components/documents/types";
import DocumentSummaryCards from "@/components/documents/DocumentSummaryCards";
import DocumentsTable from "@/components/documents/DocumentsTable";
import PaymentsTable from "@/components/documents/PaymentsTable";
import ComplianceTab from "@/components/documents/ComplianceTab";
import DocumentFormDialog from "@/components/documents/DocumentFormDialog";
import PaymentFormDialog from "@/components/documents/PaymentFormDialog";
import FileUploadDialog from "@/components/documents/FileUploadDialog";

export default function DocumentsPage() {
  const [docs, setDocs] = useState<PurchaseDocument[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("documents");
  const [search, setSearch] = useState("");

  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<PurchaseDocument | null>(null);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [docsRes, paysRes] = await Promise.all([
      supabase.from("purchase_documents").select("*").order("created_at", { ascending: false }),
      supabase.from("supplier_payments").select("*").order("created_at", { ascending: false }),
    ]);
    if (docsRes.data) setDocs(docsRes.data as PurchaseDocument[]);
    if (paysRes.data) setPayments(paysRes.data as Payment[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">מסמכים</h1>
        </div>
        <div className="flex gap-2">
          {tab !== "compliance" && (
            <Button variant="outline" onClick={() => setUploadDialogOpen(true)}>
              <Upload className="h-4 w-4 ml-1" />העלה קובץ
            </Button>
          )}
          {tab === "documents" && (
            <Button onClick={() => setDocDialogOpen(true)}>
              <Plus className="h-4 w-4 ml-1" />מסמך חדש
            </Button>
          )}
          {tab === "payments" && (
            <Button onClick={() => setPayDialogOpen(true)}>
              <Plus className="h-4 w-4 ml-1" />תשלום חדש
            </Button>
          )}
        </div>
      </div>

      {/* Search (only for documents & payments tabs) */}
      {tab !== "compliance" && (
        <div className="relative max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="חפש לפי ספק או מוצר..." className="pr-10" />
        </div>
      )}

      {/* Summary Cards (only for documents & payments tabs) */}
      {tab !== "compliance" && (
        <DocumentSummaryCards docs={docs} payments={payments} />
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="documents" className="gap-1">
            <FileText className="h-4 w-4" />PI / PO ({docs.length})
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-1">
            <CreditCard className="h-4 w-4" />תשלומים ({payments.length})
          </TabsTrigger>
          <TabsTrigger value="compliance" className="gap-1">
            <ScrollText className="h-4 w-4" />ציות ורישיונות
          </TabsTrigger>
        </TabsList>
        <TabsContent value="documents">
          <DocumentsTable
            docs={docs}
            search={search}
            onRefresh={fetchData}
            onEdit={doc => { setEditingDoc(doc); setDocDialogOpen(true); }}
          />
        </TabsContent>
        <TabsContent value="payments">
          <PaymentsTable
            payments={payments}
            search={search}
            onRefresh={fetchData}
            onEdit={p => { setEditingPayment(p); setPayDialogOpen(true); }}
          />
        </TabsContent>
        <TabsContent value="compliance">
          <ComplianceTab />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <DocumentFormDialog
        open={docDialogOpen}
        onOpenChange={v => { setDocDialogOpen(v); if (!v) setEditingDoc(null); }}
        onSaved={fetchData}
        editDocument={editingDoc}
      />
      <PaymentFormDialog
        open={payDialogOpen}
        onOpenChange={v => { setPayDialogOpen(v); if (!v) setEditingPayment(null); }}
        onSaved={fetchData}
        docs={docs}
        editPayment={editingPayment}
      />
      <FileUploadDialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen} onSaved={fetchData} />
    </div>
  );
}
