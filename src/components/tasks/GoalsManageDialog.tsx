import { useState } from "react";
import { useData, type Goal } from "@/contexts/AppContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { GOAL_PALETTE } from "./goalColors";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const PRESET_COLORS = GOAL_PALETTE.map(p => p.bg);

export default function GoalsManageDialog({ open, onOpenChange }: Props) {
  const { goals, addGoal, updateGoal, deleteGoal } = useData();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await addGoal({
      name: newName.trim(),
      color: newColor,
      sort_order: goals.length,
    });
    setNewName("");
    setNewColor(PRESET_COLORS[(goals.length + 1) % PRESET_COLORS.length]);
  };

  const handleDelete = async (id: string) => {
    await deleteGoal(id);
  };

  const handleStartEdit = (goal: Goal) => {
    setEditingId(goal.id);
    setEditName(goal.name);
  };

  const handleSaveEdit = async (goal: Goal) => {
    if (editName.trim() && editName.trim() !== goal.name) {
      await updateGoal(goal.id, { name: editName.trim() });
    }
    setEditingId(null);
  };

  const handleColorChange = async (goalId: string, color: string) => {
    await updateGoal(goalId, { color });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>ניהול מטרות-על</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {/* Existing goals */}
          {goals.map((goal) => (
            <div
              key={goal.id}
              className="flex items-center gap-2 p-2 rounded-lg border bg-muted/20"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />

              {/* Color picker */}
              <div className="flex gap-1 flex-shrink-0">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: goal.color === c ? "#000" : "transparent",
                    }}
                    onClick={() => handleColorChange(goal.id, c)}
                  />
                ))}
              </div>

              {/* Name */}
              {editingId === goal.id ? (
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => handleSaveEdit(goal)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveEdit(goal);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="h-7 text-sm flex-1"
                  autoFocus
                />
              ) : (
                <span
                  className="text-sm font-medium flex-1 cursor-pointer hover:underline truncate"
                  onClick={() => handleStartEdit(goal)}
                >
                  {goal.name}
                </span>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-red-600 flex-shrink-0"
                onClick={() => handleDelete(goal.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}

          {goals.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              אין מטרות-על. הוסף מטרה ראשונה למטה.
            </p>
          )}

          {/* Add new goal */}
          <div className="border-t pt-3">
            <Label className="text-xs font-medium text-muted-foreground mb-2 block">הוסף מטרה חדשה</Label>
            <div className="flex items-center gap-2">
              {/* Color preview */}
              <div
                className="w-6 h-6 rounded-full flex-shrink-0 border"
                style={{ backgroundColor: newColor }}
              />
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="שם המטרה..."
                className="h-8 text-sm flex-1"
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              />
              <Button size="sm" onClick={handleAdd} disabled={!newName.trim()}>
                <Plus className="h-4 w-4 ml-1" />
                הוסף
              </Button>
            </div>
            {/* Color selection for new goal */}
            <div className="flex gap-1.5 mt-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: newColor === c ? "#000" : "transparent",
                  }}
                  onClick={() => setNewColor(c)}
                />
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
