import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
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
}: InlineEditFieldProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value ?? ""));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

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

  return (
    <div
      className={cn("space-y-1 cursor-pointer group", className)}
      onDoubleClick={() => { setEditValue(String(value ?? "")); setEditing(true); }}
      title="לחץ פעמיים לעריכה"
    >
      {label && <p className="text-xs text-muted-foreground">{label}</p>}
      <p className="text-sm font-medium text-foreground group-hover:bg-muted/50 group-hover:rounded px-1 -mx-1 transition-colors">
        {displayValue ?? value ?? "—"}
      </p>
    </div>
  );
}
