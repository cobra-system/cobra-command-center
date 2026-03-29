import { useState, useMemo } from "react";
import { useData, type Goal } from "@/contexts/AppContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, GripVertical, ArrowUpCircle } from "lucide-react";
import { GOAL_PALETTE } from "./goalColors";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const PRESET_COLORS = GOAL_PALETTE.map(p => p.bg);

export default function GoalsManageDialog({ open, onOpenChange }: Props) {
  const { goals, tasks, addGoal, updateGoal, deleteGoal, updateTask } = useData();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [promotingOrphan, setPromotingOrphan] = useState<string | null>(null);
  const [orphanEditName, setOrphanEditName] = useState("");
  const [orphanColor, setOrphanColor] = useState(PRESET_COLORS[0]);

  // Compute orphan milestones: milestone strings in tasks not in goals table
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

  // Promote orphan milestone to DB goal (optionally rename)
  const handlePromoteOrphan = async (originalName: string) => {
    const nameToUse = orphanEditName.trim() || originalName;
    await addGoal({ name: nameToUse, color: orphanColor, sort_order: goals.length });
    // If renamed, update all tasks with the old milestone string
    if (nameToUse !== originalName) {
      const affected = tasks.filter(t => t.milestone === originalName);
      await Promise.all(affected.map(t => updateTask(t.id, { milestone: nameToUse })));
    }
    setPromotingOrphan(null);
    setOrphanEditName("");
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

          {/* Orphan milestones: milestone strings from tasks not yet in DB */}
          {orphanMilestones.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-2 font-medium">
                מטרות-על שקיימות במשימות (טרם הוגדרו):
              </p>
              {orphanMilestones.map((name) => (
                <div
                  key={name}
                  className="flex items-center gap-2 p-2 rounded-lg border border-dashed bg-muted/10 mb-2"
                >
                  {promotingOrphan === name ? (
                    <>
                      <div className="flex gap-1 flex-shrink-0">
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c}
                            className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                            style={{
                              backgroundColor: c,
                              borderColor: orphanColor === c ? "#000" : "transparent",
                            }}
                            onClick={() => setOrphanColor(c)}
                          />
                        ))}
                      </div>
                      <Input
                        value={orphanEditName}
                        onChange={(e) => setOrphanEditName(e.target.value)}
                        className="h-7 text-sm flex-1"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handlePromoteOrphan(name);
                          if (e.key === "Escape") { setPromotingOrphan(null); setOrphanEditName(""); }
                        }}
                      />
                      <Button size="sm" className="h-7 text-xs" onClick={() => handlePromoteOrphan(name)}>
                        אשר
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setPromotingOrphan(null); setOrphanEditName(""); }}>
                        ביטול
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-muted-foreground flex-1 truncate">{name}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 flex-shrink-0"
                        onClick={() => {
                          setPromotingOrphan(name);
                          setOrphanEditName(name);
                          setOrphanColor(PRESET_COLORS[goals.length % PRESET_COLORS.length]);
                        }}
                      >
                        <ArrowUpCircle className="h-3.5 w-3.5" />
                        הוסף לDB
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {totalCount === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              אין מטרות-על. הוסף מטרה ראשונה למטה.
            </p>
          )}

          {/* Add new goal */}
          <div className="border-t pt-3">
            <Label className="text-xs font-medium text-muted-foreground mb-2 block">הוסף מטרה חדשה</Label>
            <div className="flex items-center gap-2">
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