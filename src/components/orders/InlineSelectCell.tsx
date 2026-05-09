import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Option {
  value: string;
  label: string;
  className?: string;
}

interface Props {
  value: string | null | undefined;
  options: Option[];
  onCommit: (newValue: string) => Promise<void> | void;
  display: (v: string | null | undefined) => React.ReactNode;
  disabled?: boolean;
}

export function InlineSelectCell({ value, options, onCommit, display, disabled }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleChange = async (next: string) => {
    if (next === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onCommit(next);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  if (editing && !disabled) {
    return (
      <Select value={value ?? undefined} onValueChange={handleChange} open={true} onOpenChange={(o) => { if (!o) setEditing(false); }}>
        <SelectTrigger className="h-7 text-xs px-1.5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <button
      type="button"
      onClick={() => !disabled && setEditing(true)}
      disabled={disabled || saving}
      className={`px-1.5 py-1 rounded hover:bg-accent/40 transition-colors min-h-[28px] text-right w-full ${
        disabled ? "cursor-default" : "cursor-pointer"
      }`}
      title={disabled ? undefined : "לחץ לעריכה"}
    >
      {display(value)}
    </button>
  );
}
