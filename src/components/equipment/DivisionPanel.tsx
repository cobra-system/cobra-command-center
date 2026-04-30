import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import {
  Package,
  PackageX,
  TrendingDown,
  Users,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────

interface DivisionContact {
  id: string;
  division: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
}

interface InstallerStat {
  id: string;
  division: string;
  status: string;
}

interface PickupStat {
  installer_id: string;
  pickup_date: string;
  equipment_pickup_items: { quantity: number }[];
}

interface ReturnStat {
  installer_id: string;
  return_date: string;
  equipment_return_items: { quantity: number }[];
}

interface Props {
  division: string | null;
  onClose: () => void;
  installers: InstallerStat[];
  pickups: PickupStat[];
  returns: ReturnStat[];
}

const ROLES = ["מנהל", "רכז", "טכנאי", "תמיכה", "אחר"];

const DIVISION_COLOR: Record<string, string> = {
  AWACS: "bg-blue-100 text-blue-700 border-blue-200",
  כפתור: "bg-amber-100 text-amber-700 border-amber-200",
  DOORE: "bg-green-100 text-green-700 border-green-200",
};

// ─── Blank contact form ────────────────────────────────────────────────────

const blankForm = () => ({
  name: "",
  role: "אחר",
  phone: "",
  email: "",
  notes: "",
});

// ─── Component ─────────────────────────────────────────────────────────────

export function DivisionPanel({ division, onClose, installers, pickups, returns }: Props) {
  const [contacts, setContacts] = useState<DivisionContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(blankForm());
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(blankForm());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    if (!division) return;
    setLoadingContacts(true);
    const { data, error } = await supabase
      .from("division_contacts")
      .select("*")
      .eq("division", division)
      .order("created_at");
    if (error) toast.error("שגיאה בטעינת אנשי קשר");
    else setContacts((data ?? []) as DivisionContact[]);
    setLoadingContacts(false);
  }, [division]);

  useEffect(() => {
    if (division) {
      fetchContacts();
      setShowAddForm(false);
      setForm(blankForm());
      setEditingId(null);
    }
  }, [division, fetchContacts]);

  // ── Stats ──
  const divInstallers = installers.filter((i) => i.division === division);
  const divInstallerIds = new Set(divInstallers.map((i) => i.id));
  const activeCount = divInstallers.filter((i) => i.status === "פעיל").length;

  const totalTaken = pickups
    .filter((p) => divInstallerIds.has(p.installer_id))
    .reduce((sum, p) => sum + p.equipment_pickup_items.reduce((s, i) => s + i.quantity, 0), 0);

  const totalReturned = returns
    .filter((r) => divInstallerIds.has(r.installer_id))
    .reduce((sum, r) => sum + r.equipment_return_items.reduce((s, i) => s + i.quantity, 0), 0);

  const returnPct = totalTaken > 0 ? Math.round((totalReturned / totalTaken) * 100) : 0;

  // ── Add contact ──
  const handleAdd = async () => {
    if (!form.name.trim()) {
      toast.error("יש להזין שם");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("division_contacts").insert({
      division,
      name: form.name.trim(),
      role: form.role || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error("שגיאה בהוספת איש קשר");
    } else {
      toast.success("איש קשר נוסף");
      setForm(blankForm());
      setShowAddForm(false);
      fetchContacts();
    }
  };

  // ── Edit contact ──
  const startEdit = (c: DivisionContact) => {
    setEditingId(c.id);
    setEditForm({
      name: c.name,
      role: c.role ?? "אחר",
      phone: c.phone ?? "",
      email: c.email ?? "",
      notes: c.notes ?? "",
    });
  };

  const handleEditSave = async (id: string) => {
    if (!editForm.name.trim()) {
      toast.error("יש להזין שם");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("division_contacts")
      .update({
        name: editForm.name.trim(),
        role: editForm.role || null,
        phone: editForm.phone.trim() || null,
        email: editForm.email.trim() || null,
        notes: editForm.notes.trim() || null,
      })
      .eq("id", id);
    setSaving(false);
    if (error) {
      toast.error("שגיאה בעדכון");
    } else {
      toast.success("עודכן בהצלחה");
      setEditingId(null);
      fetchContacts();
    }
  };

  // ── Delete contact ──
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from("division_contacts").delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      toast.error("שגיאה במחיקה");
    } else {
      toast.success("נמחק");
      fetchContacts();
    }
  };

  const colorClass = DIVISION_COLOR[division ?? ""] ?? "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <Sheet open={!!division} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="left" className="w-full sm:max-w-lg overflow-y-auto p-0">
        <div className="p-5 space-y-5">
          {/* Header */}
          <SheetHeader className="text-start">
            <SheetTitle className="flex items-center gap-2 text-lg">
              <Badge className={`text-sm px-3 py-1 border ${colorClass}`}>
                {division}
              </Badge>
              <span className="text-muted-foreground font-normal text-sm">פאנל חטיבה</span>
            </SheetTitle>
          </SheetHeader>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                label: "מתקינים פעילים",
                value: activeCount,
                icon: Users,
                color: "text-blue-600",
                bg: "bg-blue-50",
              },
              {
                label: "פריטים שיצאו",
                value: totalTaken,
                icon: Package,
                color: "text-indigo-600",
                bg: "bg-indigo-50",
              },
              {
                label: "פריטים שחזרו",
                value: totalReturned,
                icon: PackageX,
                color: "text-orange-600",
                bg: "bg-orange-50",
              },
              {
                label: "אחוז החזרה",
                value: `${returnPct}%`,
                icon: TrendingDown,
                color:
                  returnPct <= 5
                    ? "text-green-600"
                    : returnPct <= 15
                    ? "text-yellow-600"
                    : "text-red-600",
                bg:
                  returnPct <= 5
                    ? "bg-green-50"
                    : returnPct <= 15
                    ? "bg-yellow-50"
                    : "bg-red-50",
              },
            ].map((kpi) => (
              <Card key={kpi.label} className="border">
                <CardContent className="p-3">
                  <div className={`inline-flex p-1.5 rounded-md ${kpi.bg} mb-1.5`}>
                    <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight">{kpi.label}</p>
                  <p className={`text-xl font-bold mt-0.5 ${kpi.color}`}>{kpi.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Contacts section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">אנשי קשר</h3>
              {!showAddForm && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setShowAddForm(true)}
                >
                  <Plus className="h-3 w-3 ms-1" />
                  הוסף
                </Button>
              )}
            </div>

            {/* Add form */}
            {showAddForm && (
              <div className="border rounded-md p-3 space-y-2 bg-muted/20">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">שם *</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="שם מלא"
                      className="h-7 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">תפקיד</Label>
                    <Select
                      value={form.role}
                      onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}
                    >
                      <SelectTrigger className="h-7 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">טלפון</Label>
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="05X-XXXXXXX"
                      className="h-7 text-sm"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">אימייל</Label>
                    <Input
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="email@..."
                      className="h-7 text-sm"
                      dir="ltr"
                    />
                  </div>
                </div>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="הערות..."
                  className="h-7 text-sm"
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => {
                      setShowAddForm(false);
                      setForm(blankForm());
                    }}
                    disabled={saving}
                  >
                    ביטול
                  </Button>
                  <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={saving}>
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "שמור"}
                  </Button>
                </div>
              </div>
            )}

            {/* Contacts list */}
            {loadingContacts ? (
              <p className="text-sm text-muted-foreground text-center py-4">טוען...</p>
            ) : contacts.length === 0 ? (
              <div className="text-center py-6 border rounded-md text-sm text-muted-foreground">
                אין אנשי קשר עדיין
              </div>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>שם</TableHead>
                      <TableHead>תפקיד</TableHead>
                      <TableHead>טלפון</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((c) =>
                      editingId === c.id ? (
                        // Edit row
                        <TableRow key={c.id} className="bg-muted/20">
                          <TableCell className="p-1.5">
                            <Input
                              value={editForm.name}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, name: e.target.value }))
                              }
                              className="h-7 text-sm"
                            />
                          </TableCell>
                          <TableCell className="p-1.5">
                            <Select
                              value={editForm.role}
                              onValueChange={(v) => setEditForm((f) => ({ ...f, role: v }))}
                            >
                              <SelectTrigger className="h-7 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLES.map((r) => (
                                  <SelectItem key={r} value={r}>
                                    {r}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-1.5">
                            <Input
                              value={editForm.phone}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, phone: e.target.value }))
                              }
                              className="h-7 text-sm"
                              dir="ltr"
                            />
                          </TableCell>
                          <TableCell className="p-1.5">
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-green-600"
                                onClick={() => handleEditSave(c.id)}
                                disabled={saving}
                              >
                                {saving ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="h-3.5 w-3.5" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => setEditingId(null)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        // View row
                        <TableRow key={c.id}>
                          <TableCell className="font-medium text-sm py-2">
                            <div>{c.name}</div>
                            {c.email && (
                              <div className="text-[11px] text-muted-foreground" dir="ltr">
                                {c.email}
                              </div>
                            )}
                            {c.notes && (
                              <div className="text-[11px] text-muted-foreground">{c.notes}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm py-2">
                            {c.role && (
                              <Badge variant="secondary" className="text-xs">
                                {c.role}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm py-2" dir="ltr">
                            {c.phone ?? "—"}
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => startEdit(c)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => handleDelete(c.id)}
                                disabled={deletingId === c.id}
                              >
                                {deletingId === c.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
