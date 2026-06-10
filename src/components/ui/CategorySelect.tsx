import { useState, useRef } from "react";
import { Check, ChevronsUpDown, Plus, Pencil, Trash2, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useCategoryManager } from "@/hooks/useCategoryManager";

interface CategorySelectProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

export function CategorySelect({ value, onValueChange, className }: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const { allCategories, custom, addCategory, removeCategory, renameCategory } = useCategoryManager();

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const ok = await addCategory(trimmed);
    if (ok) {
      onValueChange(trimmed);
      setNewName("");
      setAdding(false);
    }
  };

  const handleRename = async () => {
    if (!editingName) return;
    const ok = await renameCategory(editingName, editValue);
    if (ok) {
      if (value === editingName) onValueChange(editValue.trim());
      setEditingName(null);
      setEditValue("");
    }
  };

  const startEdit = (cat: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingName(cat);
    setEditValue(cat);
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  const startAdding = () => {
    setAdding(true);
    setTimeout(() => addInputRef.current?.focus(), 0);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn(
            "h-10 w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate text-end flex-1">{value || "בחר קטגוריה"}</span>
          <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="p-1 w-56"
        dir="rtl"
        style={{ width: "var(--radix-popover-trigger-width)" }}
      >
        <div className="flex items-center gap-1 px-1 pb-1 border-b mb-1">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש..."
            className="h-6 text-xs border-0 p-0 focus-visible:ring-0 bg-transparent"
            autoFocus
          />
        </div>
        <div className="max-h-56 overflow-y-auto space-y-0.5">
          {allCategories.filter(cat => !search.trim() || cat.toLowerCase().includes(search.toLowerCase())).map(cat => {
            const isCustom = custom.includes(cat);
            const isEditing = editingName === cat;
            return (
              <div key={cat} className="group flex items-center gap-1 rounded">
                {isEditing ? (
                  <div className="flex flex-1 gap-1 px-1 py-0.5">
                    <Input
                      ref={editInputRef}
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") handleRename();
                        if (e.key === "Escape") { setEditingName(null); setEditValue(""); }
                      }}
                      className="h-6 text-xs flex-1"
                    />
                    <button
                      className="text-xs text-primary hover:text-primary/80 px-1"
                      onClick={handleRename}
                    >
                      שמור
                    </button>
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground px-1"
                      onClick={() => { setEditingName(null); setEditValue(""); }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      className={cn(
                        "flex-1 text-right text-sm px-2 py-1.5 rounded hover:bg-accent flex items-center gap-1.5",
                        value === cat && "text-primary font-medium"
                      )}
                      onClick={() => { onValueChange(cat); setSearch(""); setOpen(false); }}
                    >
                      <Check className={cn("h-3 w-3 shrink-0", value === cat ? "opacity-100" : "opacity-0")} />
                      {cat}
                    </button>
                    {isCustom && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          className="p-1 hover:text-primary"
                          title="שנה שם"
                          onClick={e => startEdit(cat, e)}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          className="p-1 hover:text-destructive"
                          title="מחק קטגוריה"
                          onClick={e => { e.stopPropagation(); void removeCategory(cat); if (value === cat) onValueChange(""); }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t mt-1 pt-1">
          {adding ? (
            <div className="flex gap-1 px-1">
              <Input
                ref={addInputRef}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") handleAdd();
                  if (e.key === "Escape") { setAdding(false); setNewName(""); }
                }}
                placeholder="שם קטגוריה חדשה"
                className="h-7 text-xs flex-1"
              />
              <Button size="sm" className="h-7 px-2 text-xs" onClick={handleAdd}>הוסף</Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-1"
                onClick={() => { setAdding(false); setNewName(""); }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <button
              className="w-full text-right text-sm px-2 py-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded flex items-center gap-1.5"
              onClick={startAdding}
            >
              <Plus className="h-3.5 w-3.5" />
              הוסף קטגוריה
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
