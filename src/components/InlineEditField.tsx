import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineEditFieldProps {
  value: string | number | null | undefined;
  onSave: (newValue: string) => void;
  label?: string;
  displayValue?: string | React.ReactNode;
  type?: "text" | "number" | "textarea";
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  /** If provided, shows a Select dropdown instead of free text input */
  options?: { value: string; label: string }[];
  /** If true, allows selecting multiple values (comma-separated) */
  multiSelect?: boolean;
}

export function InlineEditField({
  value,
  onSave,
  label,
  displayValue,
  type = "text",
  className,
  inputClassName,
  disabled = false,
  options,
  multiSelect = false,
}: InlineEditFieldProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value ?? ""));
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && !options) {
      if (type === "textarea" && textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
      } else if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }
  }, [editing, options, type]);

  const handleSave = () => {
    setEditing(false);
    if (editValue !== String(value ?? "")) {
      onSave(editValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") { setEditValue(String(value ?? "")); setEditing(false); }
  };

  if (disabled) {
    return (
      <div className={cn("space-y-1", className)}>
        {label && <p className="text-xs text-muted-foreground">{label}</p>}
        <p className="text-sm font-medium text-foreground">{displayValue ?? value ?? "—"}</p>
      </div>
    );
  }

  // Multi-select editing mode
  if (editing && multiSelect && options) {
    const currentValues = editValue ? editValue.split(",").map(v => v.trim()).filter(Boolean) : [];
    
    const toggleValue = (val: string) => {
      let newValues: string[];
      if (currentValues.includes(val)) {
        newValues = currentValues.filter(v => v !== val);
      } else {
        newValues = [...currentValues, val];
      }
      const newStr = newValues.join(", ");
      setEditValue(newStr);
      onSave(newStr);
    };

    return (
      <div className={cn("space-y-1", className)}>
        {label && <p className="text-xs text-muted-foreground">{label}</p>}
        <div className="flex flex-wrap gap-1 p-1 border rounded-md bg-background min-h-[28px]">
          {options.map(opt => {
            const selected = currentValues.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggleValue(opt.value)}
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full border transition-colors",
                  selected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <button onClick={() => setEditing(false)} className="text-[10px] text-muted-foreground hover:text-foreground">סגור</button>
      </div>
    );
  }

  if (editing) {
    // Single select dropdown mode
    if (options) {
      return (
        <div className={cn("space-y-1", className)}>
          {label && <p className="text-xs text-muted-foreground">{label}</p>}
          <Select
            value={editValue}
            onValueChange={(v) => {
              setEditValue(v);
              setEditing(false);
              if (v !== String(value ?? "")) {
                onSave(v);
              }
            }}
            open={true}
            onOpenChange={(open) => {
              if (!open) setEditing(false);
            }}
          >
            <SelectTrigger className="h-7 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (type === "textarea") {
      return (
        <div className={cn("space-y-1", className)}>
          {label && <p className="text-xs text-muted-foreground">{label}</p>}
          <Textarea
            ref={textareaRef}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === "Escape") { setEditValue(String(value ?? "")); setEditing(false); }
            }}
            rows={3}
            className={cn("text-sm", inputClassName)}
          />
        </div>
      );
    }

    return (
      <div className={cn("space-y-1", className)}>
        {label && <p className="text-xs text-muted-foreground">{label}</p>}
        <Input
          ref={inputRef}
          type={type}
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={cn("h-7 text-sm", inputClassName)}
        />
      </div>
    );
  }

  // Display mode — single click/tap activates editing
  const handleActivate = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "A" || target.closest("a")) return;
    setEditValue(String(value ?? ""));
    setEditing(true);
  };

  // For multi-select, show badges
  const renderDisplay = () => {
    if (displayValue) return displayValue;
    if (multiSelect && value && String(value).trim()) {
      const items = String(value).split(",").map(v => v.trim()).filter(Boolean);
      return (
        <span className="flex flex-wrap gap-1">
          {items.map(item => (
            <Badge key={item} variant="secondary" className="text-xs">{item}</Badge>
          ))}
        </span>
      );
    }
    return value ?? "—";
  };

  return (
    <div
      className={cn("space-y-1 cursor-pointer group", className)}
      onClick={handleActivate}
      title="לחץ לעריכה"
    >
      {label && <p className="text-xs text-muted-foreground">{label}</p>}
      <div className={cn("text-sm font-medium text-foreground group-hover:bg-muted/50 group-hover:rounded px-1 -mx-1 transition-colors", type === "textarea" && "whitespace-pre-wrap")}>
        {renderDisplay()}
      </div>
    </div>
  );
}
