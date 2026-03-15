import { useState, useEffect, useCallback } from "react";
import { useAuth, useData, roleLabel, type Role, type RoleDefinition } from "@/contexts/AppContext";
import { useOutlook } from "@/contexts/OutlookContext";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Lock, Users, Mail, CheckCircle, LogOut, Plus, Pencil, Trash2, User, Settings,
  Tag, Server, RefreshCw, XCircle, AlertTriangle, Package, Truck, Warehouse,
  Clock, Loader2, Plug,
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

export default function SettingsPage() {
  const { currentUser } = useAuth();
  const { profiles, updateProfile, createEmployee, refreshProfiles, roleDefinitions, addRoleDefinition, updateRoleDefinition, deleteRoleDefinition } = useData();
  const { isConnected, accountName, login, logout: outlookLogout, loading: outlookLoading } = useOutlook();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Employee form
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [empName, setEmpName] = useState("");
  const [empRole, setEmpRole] = useState<Role>("DRIVER");
  const [empPin, setEmpPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Manager profile edit
  const [managerEditOpen, setManagerEditOpen] = useState(false);
  const [managerName, setManagerName] = useState(currentUser?.name || "");
  const [savingManager, setSavingManager] = useState(false);

  // Role definitions management
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleName, setRoleName] = useState("");
  const [roleSubmitting, setRoleSubmitting] = useState(false);
  const [roleDeleteConfirm, setRoleDeleteConfirm] = useState<string | null>(null);

  // SAP integration state
  const [sapTesting, setSapTesting] = useState(false);
  const [sapConnectionStatus, setSapConnectionStatus] = useState<"unknown" | "connected" | "error">("unknown");
  const [sapConnectionMessage, setSapConnectionMessage] = useState("");
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [sapLogsOpen, setSapLogsOpen] = useState(false);

  const isManager = currentUser?.role === "MANAGER";
  const employees = profiles.filter(p => p.role !== "MANAGER");
  const managerProfile = profiles.find(p => p.role === "MANAGER");

  const dynamicRoleLabel: Record<string, string> = { MANAGER: "מנהל" };
  roleDefinitions.forEach(rd => {
    if (rd.system_key) dynamicRoleLabel[rd.system_key] = rd.name;
  });
  const getRoleLabel = (role: string) => dynamicRoleLabel[role] || roleLabel[role] || role;

  const employeeRoleOptions: Array<{ value: Role; label: string }> = ["WAREHOUSE_MANAGER", "LOGISTICS", "DRIVER"].map((systemRole) => ({
    value: systemRole,
    label: getRoleLabel(systemRole),
  }));

  // SAP helpers
  const callSapProxy = async (action: string, body?: any) => {
    const sess = await supabase.auth.getSession();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/sap-proxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${sess.data.session?.access_token}`,
      },
      body: JSON.stringify({ action, ...body }),
    });
    return res.json();
  };

  const fetchSapLogs = useCallback(async () => {
    const { data } = await supabase
      .from("sap_sync_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setSyncLogs(data as SyncLogEntry[]);
  }, []);

  useEffect(() => { fetchSapLogs(); }, [fetchSapLogs]);

  const logSync = async (entityType: string, status: string, details?: string, errorMessage?: string) => {
    await supabase.from("sap_sync_log").insert({
      entity_type: entityType,
      direction: "pull",
      status,
      details,
      error_message: errorMessage,
    } as any);
    await fetchSapLogs();
  };

  const handleTestConnection = async () => {
    setSapTesting(true);
    try {
      const result = await callSapProxy("test");
      if (result.success) {
        setSapConnectionStatus("connected");
        setSapConnectionMessage(result.message);
        toast.success("חיבור ל-SAP B1 הצליח!");
      } else {
        setSapConnectionStatus("error");
        setSapConnectionMessage(result.message || result.error);
        toast.error("חיבור ל-SAP B1 נכשל");
      }
    } catch (e: any) {
      setSapConnectionStatus("error");
      setSapConnectionMessage(e.message);
      toast.error("שגיאה בבדיקת חיבור");
    }
    setSapTesting(false);
  };

  const handleSyncItems = async () => {
    setSyncing(prev => ({ ...prev, items: true }));
    try {
      const result = await callSapProxy("sync-items");
      if (result.error) throw new Error(result.error);
      const items = result.value || [];
      let synced = 0;
      for (const item of items) {
        const { data: existing } = await supabase.from("products").select("id").eq("sap_code", item.ItemCode).maybeSingle();
        if (existing) {
          await supabase.from("products").update({ stock_qty: item.QuantityOnStock || 0, purchase_price: item.AvgStdPrice || null } as any).eq("id", existing.id);
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
        const { data: existing } = await supabase.from("suppliers").select("id").eq("sap_code", bp.CardCode).maybeSingle();
        if (existing) {
          await supabase.from("suppliers").update({ email: bp.EmailAddress || null, phone: bp.Phone1 || null } as any).eq("id", existing.id);
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
        const { data: existing } = await supabase.from("distribution_centers").select("id").eq("sap_code", wh.WarehouseCode).maybeSingle();
        if (existing) {
          await supabase.from("distribution_centers").update({ city: wh.City || null, address: wh.Street || null } as any).eq("id", existing.id);
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

  const entityTypeLabel: Record<string, string> = { products: "מוצרים", suppliers: "ספקים", warehouses: "מחסנים", orders: "הזמנות" };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.error("הסיסמה חייבת להכיל לפחות 6 תווים"); return; }
    if (newPassword !== confirmPassword) { toast.error("הסיסמאות אינן תואמות"); return; }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) { toast.error(error.message); } else { toast.success("הסיסמה שונתה בהצלחה"); setNewPassword(""); setConfirmPassword(""); }
  };

  const resetEmpForm = () => { setEmpName(""); setEmpRole("DRIVER"); setEmpPin(""); setEditingId(null); };

  const handleEmpSubmit = async () => {
    if (!empName.trim() || (!editingId && empPin.length !== 4)) return;
    setSubmitting(true);
    if (editingId) {
      try {
        const sess = await supabase.auth.getSession();
        const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-employee`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${sess.data.session?.access_token}`,
          },
          body: JSON.stringify({ action: "update", employee_id: editingId, name: empName.trim(), role: empRole, pin: empPin.length === 4 ? empPin : undefined }),
        });
        const result = await res.json();
        if (!res.ok) toast.error(result.error || "שגיאה בעדכון");
        else { toast.success("העובד עודכן"); await refreshProfiles(); }
      } catch { toast.error("שגיאה בחיבור לשרת"); }
    } else {
      const error = await createEmployee({ name: empName.trim(), role: empRole, pin: empPin });
      if (error) toast.error(error);
      else toast.success(`${empName} נוסף בהצלחה`);
    }
    setSubmitting(false);
    resetEmpForm();
    setEmployeeOpen(false);
  };

  const handleEmpEdit = (profile: { id: string; name: string; role: Role }) => {
    setEditingId(profile.id);
    setEmpName(profile.name);
    setEmpRole(profile.role);
    setEmpPin("");
    setEmployeeOpen(true);
  };

  const handleEmpDelete = async (id: string) => {
    setSubmitting(true);
    try {
      const sess = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-employee`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${sess.data.session?.access_token}`,
        },
        body: JSON.stringify({ action: "delete", employee_id: id }),
      });
      const result = await res.json();
      if (!res.ok) toast.error(result.error || "שגיאה במחיקה");
      else { toast.success("העובד נמחק"); await refreshProfiles(); }
    } catch { toast.error("שגיאה בחיבור לשרת"); }
    setSubmitting(false);
    setDeleteConfirm(null);
  };

  const handleSaveManagerName = async () => {
    if (!managerProfile || !managerName.trim()) return;
    setSavingManager(true);
    await updateProfile(managerProfile.id, { name: managerName.trim() });
    setSavingManager(false);
    setManagerEditOpen(false);
    toast.success("הפרופיל עודכן");
  };

  const resetRoleForm = () => { setRoleName(""); setEditingRoleId(null); };

  const handleRoleSubmit = async () => {
    if (!roleName.trim()) return;
    setRoleSubmitting(true);
    try {
      if (editingRoleId) {
        await updateRoleDefinition(editingRoleId, roleName.trim());
        toast.success("התפקיד עודכן");
      } else {
        await addRoleDefinition(roleName.trim());
        toast.success("תפקיד חדש נוסף");
      }
    } catch { toast.error("שגיאה בשמירה"); }
    setRoleSubmitting(false);
    resetRoleForm();
    setRoleDialogOpen(false);
  };

  const handleRoleEdit = (rd: RoleDefinition) => {
    setEditingRoleId(rd.id);
    setRoleName(rd.name);
    setRoleDialogOpen(true);
  };

  const handleRoleDelete = async (id: string) => {
    setRoleSubmitting(true);
    try {
      await deleteRoleDefinition(id);
      toast.success("התפקיד נמחק");
    } catch { toast.error("שגיאה במחיקה"); }
    setRoleSubmitting(false);
    setRoleDeleteConfirm(null);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">הגדרות</h1>
      </div>

      {/* Manager Profile */}
      {managerProfile && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-lg"><User className="h-5 w-5" />פרופיל מנהל</div>
              <Button variant="outline" size="sm" onClick={() => { setManagerName(managerProfile.name); setManagerEditOpen(true); }}>
                <Pencil className="h-3.5 w-3.5 ml-1" />עריכה
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-muted-foreground mb-1">שם</p><p className="text-sm font-medium text-foreground">{managerProfile.name}</p></div>
              <div><p className="text-xs text-muted-foreground mb-1">תפקיד</p><p className="text-sm font-medium text-foreground">{getRoleLabel(managerProfile.role)}</p></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Role Definitions Management */}
      {isManager && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-lg"><Tag className="h-5 w-5" />ניהול תפקידים</div>
              <Dialog open={roleDialogOpen} onOpenChange={(v) => { setRoleDialogOpen(v); if (!v) resetRoleForm(); }}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 ml-1" />תפקיד חדש</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader><DialogTitle>{editingRoleId ? "עריכת תפקיד" : "הוספת תפקיד חדש"}</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2"><Label>שם התפקיד *</Label><Input value={roleName} onChange={e => setRoleName(e.target.value)} placeholder="לדוגמה: קניין, טכנאי..." /></div>
                    <Button onClick={handleRoleSubmit} disabled={!roleName.trim() || roleSubmitting} className="w-full">
                      {roleSubmitting ? "שומר..." : editingRoleId ? "עדכן" : "הוסף תפקיד"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {roleDefinitions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">אין תפקידים מוגדרים</p>
              ) : roleDefinitions.map(rd => (
                <div key={rd.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">{rd.name}</span>
                    {rd.system_key && <span className="text-xs text-muted-foreground">(מערכת)</span>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleRoleEdit(rd)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {roleDeleteConfirm === rd.id ? (
                      <div className="flex items-center gap-1">
                        <Button variant="destructive" size="sm" onClick={() => handleRoleDelete(rd.id)} disabled={roleSubmitting}>
                          {roleSubmitting ? "מוחק..." : "אישור"}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setRoleDeleteConfirm(null)}>ביטול</Button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setRoleDeleteConfirm(rd.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Integrations Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Plug className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">אינטגרציות</h2>
        </div>

        {/* Outlook */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Mail className="h-5 w-5" />Outlook</CardTitle>
          </CardHeader>
          <CardContent>
            {outlookLoading ? (
              <p className="text-sm text-muted-foreground">טוען...</p>
            ) : isConnected ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-success" />
                  <div>
                    <p className="text-sm font-medium text-foreground">מחובר ל-Outlook</p>
                    <p className="text-xs text-muted-foreground">{accountName}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={outlookLogout}><LogOut className="h-4 w-4 ml-1" />נתק</Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">חבר את חשבון ה-Outlook שלך כדי לצפות במיילים מספקים.</p>
                <Button onClick={login}><Mail className="h-4 w-4 ml-1" />התחבר ל-Outlook</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* SAP B1 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-base"><Server className="h-5 w-5" />SAP Business One</div>
              <div className="flex items-center gap-2">
                {sapConnectionStatus === "unknown" && <Badge variant="secondary" className="gap-1"><AlertTriangle className="h-3 w-3" />לא נבדק</Badge>}
                {sapConnectionStatus === "connected" && <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-700"><CheckCircle className="h-3 w-3" />מחובר</Badge>}
                {sapConnectionStatus === "error" && <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />שגיאה</Badge>}
                <Button onClick={handleTestConnection} disabled={sapTesting} size="sm" variant="outline">
                  {sapTesting ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <RefreshCw className="h-4 w-4 ml-1" />}
                  {sapTesting ? "בודק..." : "בדוק חיבור"}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {sapConnectionMessage && (
              <p className="text-xs text-muted-foreground">{sapConnectionMessage}</p>
            )}

            {/* Sync buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Button variant="outline" className="h-auto py-3 flex flex-col items-center gap-1.5" onClick={handleSyncItems} disabled={syncing.items}>
                {syncing.items ? <Loader2 className="h-5 w-5 animate-spin" /> : <Package className="h-5 w-5" />}
                <span className="text-sm">סנכרון מוצרים</span>
                <span className="text-xs text-muted-foreground">Items ← SAP</span>
              </Button>
              <Button variant="outline" className="h-auto py-3 flex flex-col items-center gap-1.5" onClick={handleSyncSuppliers} disabled={syncing.suppliers}>
                {syncing.suppliers ? <Loader2 className="h-5 w-5 animate-spin" /> : <Truck className="h-5 w-5" />}
                <span className="text-sm">סנכרון ספקים</span>
                <span className="text-xs text-muted-foreground">BusinessPartners ← SAP</span>
              </Button>
              <Button variant="outline" className="h-auto py-3 flex flex-col items-center gap-1.5" onClick={handleSyncWarehouses} disabled={syncing.warehouses}>
                {syncing.warehouses ? <Loader2 className="h-5 w-5 animate-spin" /> : <Warehouse className="h-5 w-5" />}
                <span className="text-sm">סנכרון מחסנים</span>
                <span className="text-xs text-muted-foreground">Warehouses ← SAP</span>
              </Button>
            </div>

            {/* Sync log toggle */}
            <div>
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" onClick={() => { setSapLogsOpen(v => !v); fetchSapLogs(); }}>
                <Clock className="h-3.5 w-3.5" />
                {sapLogsOpen ? "הסתר לוג סנכרונים" : "הצג לוג סנכרונים"}
              </Button>
              {sapLogsOpen && (
                <div className="mt-3 space-y-1.5 max-h-[280px] overflow-y-auto">
                  {syncLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">אין סנכרונים עדיין</p>
                  ) : syncLogs.map(log => (
                    <div key={log.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30 text-sm">
                      <div className="flex items-center gap-2">
                        {log.status === "success"
                          ? <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                          : <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                        <div>
                          <span className="font-medium text-foreground">{entityTypeLabel[log.entity_type] || log.entity_type}</span>
                          {log.details && <span className="text-muted-foreground mr-2">— {log.details}</span>}
                          {log.error_message && <span className="text-destructive mr-2">— {log.error_message}</span>}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap" dir="ltr">
                        {format(new Date(log.created_at), "dd/MM HH:mm")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              ה-credentials של SAP מוגדרים כ-secrets בצד השרת. לעדכון, פנה למנהל המערכת.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Lock className="h-5 w-5" />שינוי סיסמה</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 max-w-md">
          <div className="space-y-2"><Label>סיסמה חדשה</Label><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="לפחות 6 תווים" /></div>
          <div className="space-y-2"><Label>אימות סיסמה</Label><Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="הזן שוב" /></div>
          <Button onClick={handleChangePassword} disabled={changingPassword || !newPassword || !confirmPassword}>{changingPassword ? "משנה..." : "שנה סיסמה"}</Button>
        </CardContent>
      </Card>

      {/* Team Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-lg"><Users className="h-5 w-5" />ניהול צוות</div>
            {isManager && (
              <Dialog open={employeeOpen} onOpenChange={(v) => { setEmployeeOpen(v); if (!v) resetEmpForm(); }}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 ml-1" />עובד חדש</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader><DialogTitle>{editingId ? "עריכת עובד" : "הוספת עובד חדש"}</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2"><Label>שם *</Label><Input value={empName} onChange={e => setEmpName(e.target.value)} placeholder="שם העובד" /></div>
                    <div className="space-y-2">
                      <Label>תפקיד</Label>
                      <Select value={empRole} onValueChange={v => setEmpRole(v as Role)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {employeeRoleOptions.length > 0 ? employeeRoleOptions.map(r => (
                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                          )) : (
                            <>
                              <SelectItem value="WAREHOUSE_MANAGER">מנהל מחסן</SelectItem>
                              <SelectItem value="LOGISTICS">לוגיסטיקה</SelectItem>
                              <SelectItem value="DRIVER">נהג</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{editingId ? "קוד PIN חדש (אופציונלי)" : "קוד PIN (4 ספרות) *"}</Label>
                      <Input value={empPin} onChange={e => setEmpPin(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1234" dir="ltr" maxLength={4} />
                    </div>
                    <Button onClick={handleEmpSubmit} disabled={!empName.trim() || (!editingId && empPin.length !== 4) || submitting} className="w-full">
                      {submitting ? "שומר..." : editingId ? "עדכן עובד" : "הוסף עובד"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-right p-3 font-semibold text-foreground">שם</th>
                <th className="text-right p-3 font-semibold text-foreground">תפקיד</th>
                <th className="text-right p-3 font-semibold text-foreground">PIN</th>
                {isManager && <th className="text-right p-3 font-semibold text-foreground">פעולות</th>}
              </tr></thead>
              <tbody className="divide-y">
                {employees.length === 0 ? (
                  <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">אין עובדים</td></tr>
                ) : employees.map(u => (
                  <tr key={u.id}>
                    <td className="p-3 font-medium text-foreground">{u.name}</td>
                    <td className="p-3 text-muted-foreground">{getRoleLabel(u.role)}</td>
                    <td className="p-3 font-mono text-muted-foreground" dir="ltr">{isManager ? (u.pin || "—") : "••••"}</td>
                    {isManager && (
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEmpEdit(u)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {deleteConfirm === u.id ? (
                            <div className="flex items-center gap-1">
                              <Button variant="destructive" size="sm" onClick={() => handleEmpDelete(u.id)} disabled={submitting}>
                                {submitting ? "מוחק..." : "אישור"}
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(null)}>ביטול</Button>
                            </div>
                          ) : (
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(u.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Manager Edit Dialog */}
      <Dialog open={managerEditOpen} onOpenChange={setManagerEditOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>עריכת פרופיל מנהל</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2"><Label>שם</Label><Input value={managerName} onChange={e => setManagerName(e.target.value)} /></div>
            <Button onClick={handleSaveManagerName} disabled={savingManager || !managerName.trim()} className="w-full">
              {savingManager ? "שומר..." : "שמור"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
