import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";

type EditableType = "text" | "number" | "date";

interface Props {
  value: string | number | null | undefined;
  type?: EditableType;
  onCommit: (newValue: string | number | null) => Promise<void> | void;
  display?: (v: string | number | null | undefined) => React.ReactNode;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  align?: "start" | "end";
}

export function InlineEditCell({
  value,
  type = "text",
  onCommit,
  display,
  className,
  disabled,
  placeholder,
  align = "start",
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [editing]);

  const startEdit = () => {
    if (disabled) return;
    setDraft(value === null || value === undefined ? "" : String(value));
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setDraft("");
  };

  const commit = async () => {
    let next: string | number | null = draft.trim() === "" ? null : draft;
    if (type === "number" && next !== null) {
      const n = Number(next);
      if (Number.isNaN(n)) {
        cancel();
        return;
      }
      next = n;
    }
    const same = (next === null && (value === null || value === undefined)) ||
      (typeof value === "number" && typeof next === "number" && value === next) ||
      (typeof value === "string" && typeof next === "string" && value === next);
    if (same) {
      cancel();
      return;
    }
    setSaving(true);
    try {
      await onCommit(next);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  if (editing) {
    return (
      <Input
        ref={inputRef}
        type={type === "number" ? "number" : type}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={onKey}
        placeholder={placeholder}
        disabled={saving}
        className="h-7 text-xs px-1.5 w-full"
      />
    );
  }

  const rendered = display ? display(value) : (value ?? "—");
  return (
    <button
      type="button"
      onClick={startEdit}
      disabled={disabled}
      className={`text-${align === "end" ? "left" : "right"} w-full px-1.5 py-1 rounded hover:bg-accent/40 transition-colors min-h-[28px] ${
        disabled ? "cursor-default" : "cursor-text"
      } ${className ?? ""}`}
      title={disabled ? undefined : "לחץ לעריכה"}
    >
      {rendered}
    </button>
  );
}
