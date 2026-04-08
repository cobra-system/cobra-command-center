import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Upload, Search, CreditCard, ScrollText } from "lucide-react";
import type { PurchaseDocument, Payment } from "@/components/documents/types";
import DocumentSummaryCards from "@/components/documents/DocumentSummaryCards";
import DocumentsDriveView from "@/components/documents/DocumentsDriveView";
import DocumentAnnotationEditor from "@/components/documents/DocumentAnnotationEditor";
import PaymentsTable from "@/components/documents/PaymentsTable";
import ComplianceTab from "@/components/documents/ComplianceTab";
import SimpleFileUploadDialog from "@/components/documents/SimpleFileUploadDialog";
import PaymentFormDialog from "@/components/documents/PaymentFormDialog";
import { usePermissions } from "@/hooks/usePermissions";

export default function DocumentsPage() {
  const [docs, setDocs] = useState<PurchaseDocument[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("documents");
  const [search, setSearch] = useState("");

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [annotatingDoc, setAnnotatingDoc] = useState<PurchaseDocument | null>(null);
  const { hasEdit } = usePermissions("documents");

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
          {hasEdit && tab === "documents" && (
            <Button onClick={() => setUploadDialogOpen(true)}>
              <Upload className="h-4 w-4 ml-1" />העלה מסמך
            </Button>
          )}
          {hasEdit && tab === "payments" && (
            <Button onClick={() => setPayDialogOpen(true)}>
              <CreditCard className="h-4 w-4 ml-1" />תשלום חדש
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      {tab !== "compliance" && (
        <div className="relative max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="חפש לפי ספק, מוצר או שם מסמך..." className="pr-10" />
        </div>
      )}

      {/* Summary Cards */}
      {tab !== "compliance" && (
        <DocumentSummaryCards docs={docs} payments={payments} />
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="documents" className="gap-1">
            <FileText className="h-4 w-4" />מסמכים ({docs.length})
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-1">
            <CreditCard className="h-4 w-4" />תשלומים ({payments.length})
          </TabsTrigger>
          <TabsTrigger value="compliance" className="gap-1">
            <ScrollText className="h-4 w-4" />ציות ורישיונות
          </TabsTrigger>
        </TabsList>
        <TabsContent value="documents">
          <DocumentsDriveView docs={docs} search={search} onRefresh={fetchData} onAnnotate={setAnnotatingDoc} />
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
      <SimpleFileUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onSaved={fetchData}
      />
      <PaymentFormDialog
        open={payDialogOpen}
        onOpenChange={v => { setPayDialogOpen(v); if (!v) setEditingPayment(null); }}
        onSaved={fetchData}
        docs={docs}
        editPayment={editingPayment}
      />
      {annotatingDoc && (
        <DocumentAnnotationEditor
          open={!!annotatingDoc}
          onOpenChange={v => { if (!v) setAnnotatingDoc(null); }}
          doc={annotatingDoc}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}
