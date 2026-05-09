import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Ship, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { ShipmentGroup } from "@/contexts/types";

import { format } from "date-fns";
interface Props {
  orderId: string;
  currentGroupId?: string | null;
  hasEdit: boolean;
  onUpdated: () => void;
}

export function ShipmentGroupSelector({ orderId, currentGroupId, hasEdit, onUpdated }: Props) {
  const [groups, setGroups] = useState<ShipmentGroup[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("shipment_groups")
      .select("id, name, vessel_name, departure_date")
      .order("departure_date", { ascending: false })
      .then(({ data }) => { if (data) setGroups(data as ShipmentGroup[]); });
  }, []);

  const currentGroup = groups.find(g => g.id === currentGroupId);

  const handleSelect = async (groupId: string | null) => {
    setSaving(true);
    const { error } = await supabase
      .from("orders")
      .update({ shipment_group_id: groupId })
      .eq("id", orderId);
    setSaving(false);
    if (error) { toast.error("שגיאה בעדכון קבוצת משלוח"); return; }
    toast.success(groupId ? "קבוצת משלוח עודכנה" : "קבוצת משלוח הוסרה");
    setOpen(false);
    onUpdated();
  };

  const options = groups.map(g => ({
    value: g.id,
    label: `${g.name}${g.vessel_name ? ` — ${g.vessel_name}` : ""}${g.departure_date ? ` (${new format(Date(g.departure_date), "dd/MM/yyyy")})` : ""}`,
  }));

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-1">
        <Ship className="h-3.5 w-3.5" />
        קבוצת משלוח
      </div>
      {hasEdit ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button className="text-sm font-medium hover:text-primary transition-colors text-right w-full truncate">
              {currentGroup
                ? <span className="text-foreground">{currentGroup.name}{currentGroup.vessel_name ? ` — ${currentGroup.vessel_name}` : ""}</span>
                : <span className="text-muted-foreground italic">ללא קבוצת משלוח</span>}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 max-w-[calc(100vw-1rem)] p-2" align="start">
            <div className="space-y-2">
              <Combobox
                options={options}
                value={currentGroupId || ""}
                onChange={v => handleSelect(v || null)}
                placeholder="חפש קבוצת משלוח..."
              />
              {currentGroupId && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground hover:text-destructive text-xs"
                  onClick={() => handleSelect(null)}
                  disabled={saving}
                >
                  <X className="h-3 w-3 ml-1" />הסר קבוצת משלוח
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        <div className="text-sm font-medium text-foreground">
          {currentGroup
            ? `${currentGroup.name}${currentGroup.vessel_name ? ` — ${currentGroup.vessel_name}` : ""}`
            : <span className="text-muted-foreground">—</span>}
        </div>
      )}
    </div>
  );
}
