import { useState, useMemo } from "react";
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
  const { goals, addGoal, updateGoal, deleteGoal, tasks, updateTask } = useData();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  // Milestones that exist in tasks but have no matching DB goal
  const orphanMilestones = useMemo(() => {
    const goalNames = new Set(goals.map(g => g.name));
    const seen = new Set<string>();
    const result: string[] = [];
    for (const t of tasks) {
      if (t.milestone && !goalNames.has(t.milestone) && !seen.has(t.milestone)) {
        seen.add(t.milestone);
        result.push(t.milestone);
      }
    }
    return result;
  }, [goals, tasks]);

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

  const handleDelete = async (goal: Goal) => {
    await deleteGoal(goal.id);
    // Clear milestone on all tasks that referenced this goal
    const affected = tasks.filter(t => t.milestone === goal.name);
    await Promise.all(affected.map(t => updateTask(t.id, { milestone: null })));
  };

  const handleStartEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const handleSaveEdit = async (goal: Goal) => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== goal.name) {
      await updateGoal(goal.id, { name: trimmed });
      // Update all tasks that had the old milestone name
      const affected = tasks.filter(t => t.milestone === goal.name);
      await Promise.all(affected.map(t => updateTask(t.id, { milestone: trimmed })));
    }
    setEditingId(null);
  };

  const handleColorChange = async (goalId: string, color: string) => {
    await updateGoal(goalId, { color });
  };

  // Orphan milestone: promote to DB goal by assigning a color
  const handleOrphanColorPick = async (name: string, color: string) => {
    await addGoal({ name, color, sort_order: goals.length });
  };

  const handleOrphanSaveEdit = async (oldName: string) => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== oldName) {
      // Rename milestone across all tasks
      const affected = tasks.filter(t => t.milestone === oldName);
      await Promise.all(affected.map(t => updateTask(t.id, { milestone: trimmed })));
    }
    setEditingId(null);
  };

  const handleOrphanDelete = async (name: string) => {
    const affected = tasks.filter(t => t.milestone === name);
    await Promise.all(affected.map(t => updateTask(t.id, { milestone: null })));
  };

  const totalCount = goals.length + orphanMilestones.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>ניהול מטרות-על</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {/* DB goals */}
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
                  onClick={() => handleStartEdit(goal.id, goal.name)}
                >
                  {goal.name}
                </span>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-red-600 flex-shrink-0"
                onClick={() => handleDelete(goal)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}

          {/* Orphan milestones (exist in tasks but not in DB goals) */}
          {orphanMilestones.map((name) => (
            <div
              key={`orphan-${name}`}
              className="flex items-center gap-2 p-2 rounded-lg border border-dashed bg-muted/10"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />

              {/* Color picker – clicking promotes orphan to DB goal */}
              <div className="flex gap-1 flex-shrink-0 items-center">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    title="בחר צבע כדי לשמור כמטרה"
                    className="w-5 h-5 rounded-full border-2 border-transparent transition-transform hover:scale-110 opacity-60 hover:opacity-100"
                    style={{ backgroundColor: c }}
                    onClick={() => handleOrphanColorPick(name, c)}
                  />
                ))}
              </div>

              {/* Name */}
              {editingId === `orphan-${name}` ? (
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => handleOrphanSaveEdit(name)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleOrphanSaveEdit(name);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="h-7 text-sm flex-1"
                  autoFocus
                />
              ) : (
                <span
                  className="text-sm font-medium flex-1 cursor-pointer hover:underline truncate text-muted-foreground"
                  onClick={() => handleStartEdit(`orphan-${name}`, name)}
                >
                  {name}
                </span>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-red-600 flex-shrink-0"
                onClick={() => handleOrphanDelete(name)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}

          {totalCount === 0 && (
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
