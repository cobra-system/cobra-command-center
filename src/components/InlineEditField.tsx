import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface InlineEditFieldProps {
  value: string | number | null | undefined;
  onSave: (newValue: string) => void;
  label?: string;
  displayValue?: string | React.ReactNode;
  type?: "text" | "number";
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  /** If provided, shows a Select dropdown instead of free text input */
  options?: { value: string; label: string }[];
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
}: InlineEditFieldProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value ?? ""));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current && !options) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing, options]);

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

  if (editing) {
    // Select dropdown mode
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
              if (!open) {
                setEditing(false);
              }
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

  // Display mode - handle links in displayValue by wrapping with stopPropagation
  const handleDoubleClick = (e: React.MouseEvent) => {
    // Don't enter edit mode if clicking a link
    const target = e.target as HTMLElement;
    if (target.tagName === "A" || target.closest("a")) {
      return;
    }
    setEditValue(String(value ?? ""));
    setEditing(true);
  };

  return (
    <div
      className={cn("space-y-1 cursor-pointer group", className)}
      onDoubleClick={handleDoubleClick}
      title="לחץ פעמיים לעריכה"
    >
      {label && <p className="text-xs text-muted-foreground">{label}</p>}
      <p className="text-sm font-medium text-foreground group-hover:bg-muted/50 group-hover:rounded px-1 -mx-1 transition-colors">
        {displayValue ?? value ?? "—"}
      </p>
    </div>
  );
}
