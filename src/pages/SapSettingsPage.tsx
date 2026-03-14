import { useState, useEffect, useCallback } from "react";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Server,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Package,
  Truck,
  Warehouse,
  Clock,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";

interface SyncLogEntry {
  id: string;
  entity_type: string;
  entity_id: string | null;
  sap_code: string | null;
  direction: string;
  status: string;
  details: string | null;
  error_message: string | null;
  created_at: string;
}

export default function SapSettingsPage() {
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"unknown" | "connected" | "error">("unknown");
  const [connectionMessage, setConnectionMessage] = useState("");
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});

  const fetchLogs = useCallback(async () => {
    const { data } = await supabase
      .from("sap_sync_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setSyncLogs(data as SyncLogEntry[]);
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const callSapProxy = async (action: string, body?: any) => {
    const sess = await supabase.auth.getSession();
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const res = await fetch(`https://${projectId}.supabase.co/functions/v1/sap-proxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${sess.data.session?.access_token}`,
      },
      body: JSON.stringify({ action, ...body }),
    });
    return res.json();
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const result = await callSapProxy("test");
      if (result.success) {
        setConnectionStatus("connected");
        setConnectionMessage(result.message);
        toast.success("חיבור ל-SAP B1 הצליח!");
      } else {
        setConnectionStatus("error");
        setConnectionMessage(result.message || result.error);
        toast.error("חיבור ל-SAP B1 נכשל");
      }
    } catch (e: any) {
      setConnectionStatus("error");
      setConnectionMessage(e.message);
      toast.error("שגיאה בבדיקת חיבור");
    }
    setTesting(false);
  };

  const logSync = async (entityType: string, status: string, details?: string, errorMessage?: string) => {
    await supabase.from("sap_sync_log").insert({
      entity_type: entityType,
      direction: "pull",
      status,
      details,
      error_message: errorMessage,
    } as any);
    await fetchLogs();
  };

  const handleSyncItems = async () => {
    setSyncing(prev => ({ ...prev, items: true }));
    try {
      const result = await callSapProxy("sync-items");
      if (result.error) throw new Error(result.error);
      const items = result.value || [];
      let synced = 0;
      for (const item of items) {
        const { data: existing } = await supabase
          .from("products")
          .select("id")
          .eq("sap_code", item.ItemCode)
          .maybeSingle();
        if (existing) {
          await supabase.from("products").update({
            stock_qty: item.QuantityOnStock || 0,
            purchase_price: item.AvgStdPrice || null,
          } as any).eq("id", existing.id);
        }
        synced++;
      }
      await logSync("products", "success", `סונכרנו ${synced} פריטים מ-SAP`);
      toast.success(`סונכרנו ${synced} פריטים`);
    } catch (e: any) {
      await logSync("products", "error", undefined, e.message);
      toast.error(`שגיאה בסנכרון: ${e.message}`);
    }
    setSyncing(prev => ({ ...prev, items: false }));
  };

  const handleSyncSuppliers = async () => {
    setSyncing(prev => ({ ...prev, suppliers: true }));
    try {
      const result = await callSapProxy("sync-suppliers");
      if (result.error) throw new Error(result.error);
      const partners = result.value || [];
      let synced = 0;
      for (const bp of partners) {
        const { data: existing } = await supabase
          .from("suppliers")
          .select("id")
          .eq("sap_code", bp.CardCode)
          .maybeSingle();
        if (existing) {
          await supabase.from("suppliers").update({
            email: bp.EmailAddress || null,
            phone: bp.Phone1 || null,
          } as any).eq("id", existing.id);
        }
        synced++;
      }
      await logSync("suppliers", "success", `סונכרנו ${synced} ספקים מ-SAP`);
      toast.success(`סונכרנו ${synced} ספקים`);
    } catch (e: any) {
      await logSync("suppliers", "error", undefined, e.message);
      toast.error(`שגיאה בסנכרון: ${e.message}`);
    }
    setSyncing(prev => ({ ...prev, suppliers: false }));
  };

  const handleSyncWarehouses = async () => {
    setSyncing(prev => ({ ...prev, warehouses: true }));
    try {
      const result = await callSapProxy("sync-warehouses");
      if (result.error) throw new Error(result.error);
      const warehouses = result.value || [];
      let synced = 0;
      for (const wh of warehouses) {
        const { data: existing } = await supabase
          .from("distribution_centers")
          .select("id")
          .eq("sap_code", wh.WarehouseCode)
          .maybeSingle();
        if (existing) {
          await supabase.from("distribution_centers").update({
            city: wh.City || null,
            address: wh.Street || null,
          } as any).eq("id", existing.id);
        }
        synced++;
      }
      await logSync("warehouses", "success", `סונכרנו ${synced} מחסנים מ-SAP`);
      toast.success(`סונכרנו ${synced} מחסנים`);
    } catch (e: any) {
      await logSync("warehouses", "error", undefined, e.message);
      toast.error(`שגיאה בסנכרון: ${e.message}`);
    }
    setSyncing(prev => ({ ...prev, warehouses: false }));
  };

  const entityTypeLabel: Record<string, string> = {
    products: "מוצרים",
    suppliers: "ספקים",
    warehouses: "מחסנים",
    orders: "הזמנות",
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2">
        <Server className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">SAP Business One</h1>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-lg">
              <Server className="h-5 w-5" />
              סטטוס חיבור
            </div>
            <Button onClick={handleTestConnection} disabled={testing} size="sm">
              {testing ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <RefreshCw className="h-4 w-4 ml-1" />}
              {testing ? "בודק..." : "בדוק חיבור"}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            {connectionStatus === "unknown" && (
              <Badge variant="secondary" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                לא נבדק
              </Badge>
            )}
            {connectionStatus === "connected" && (
              <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle className="h-3 w-3" />
                מחובר
              </Badge>
            )}
            {connectionStatus === "error" && (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3 w-3" />
                שגיאה
              </Badge>
            )}
            {connectionMessage && (
              <span className="text-sm text-muted-foreground">{connectionMessage}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            ה-credentials של SAP מוגדרים כ-secrets בצד השרת. לעדכון, פנה למנהל המערכת.
          </p>
        </CardContent>
      </Card>

      {/* Sync Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <RefreshCw className="h-5 w-5" />
            סנכרון נתונים
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={handleSyncItems}
              disabled={syncing.items}
            >
              {syncing.items ? <Loader2 className="h-6 w-6 animate-spin" /> : <Package className="h-6 w-6" />}
              <span>סנכרון מוצרים</span>
              <span className="text-xs text-muted-foreground">Items ← SAP</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={handleSyncSuppliers}
              disabled={syncing.suppliers}
            >
              {syncing.suppliers ? <Loader2 className="h-6 w-6 animate-spin" /> : <Truck className="h-6 w-6" />}
              <span>סנכרון ספקים</span>
              <span className="text-xs text-muted-foreground">BusinessPartners ← SAP</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={handleSyncWarehouses}
              disabled={syncing.warehouses}
            >
              {syncing.warehouses ? <Loader2 className="h-6 w-6 animate-spin" /> : <Warehouse className="h-6 w-6" />}
              <span>סנכרון מחסנים</span>
              <span className="text-xs text-muted-foreground">Warehouses ← SAP</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sync Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5" />
              לוג סנכרונים
            </div>
            <Button variant="ghost" size="sm" onClick={fetchLogs}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {syncLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">אין סנכרונים עדיין</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {syncLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 text-sm"
                >
                  <div className="flex items-center gap-2">
                    {log.status === "success" ? (
                      <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                    <div>
                      <span className="font-medium text-foreground">
                        {entityTypeLabel[log.entity_type] || log.entity_type}
                      </span>
                      {log.details && (
                        <span className="text-muted-foreground mr-2">— {log.details}</span>
                      )}
                      {log.error_message && (
                        <span className="text-destructive mr-2">— {log.error_message}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap" dir="ltr">
                    {format(new Date(log.created_at), "dd/MM HH:mm")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
