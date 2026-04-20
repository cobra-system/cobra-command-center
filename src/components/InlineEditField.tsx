import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, RefreshCw } from "lucide-react";
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
  /** Tooltip text shown on hover of an info icon next to the label */
  tooltip?: string;
  /** If true, marks the field as auto-computed (implies disabled) */
  isComputed?: boolean;
  /** Optional function to generate navigation links for multiSelect items */
  getItemLink?: (item: string) => string;
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
  tooltip,
  isComputed = false,
  getItemLink,
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

  const labelEl = label ? (
    <p className={cn("text-xs flex items-center gap-1", isComputed ? "text-muted-foreground/70" : "text-muted-foreground")}>
      {isComputed && <RefreshCw className="h-3 w-3 shrink-0" />}
      {label}
      {tooltip && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 shrink-0 cursor-help opacity-50 hover:opacity-100 transition-opacity" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[220px] text-xs text-right leading-relaxed">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </p>
  ) : null;

  if (disabled) {
    return (
      <div className={cn("space-y-1", className)}>
        {labelEl}
        <p className={cn("text-sm font-medium", isComputed ? "text-foreground/70" : "text-foreground")}>
          {displayValue ?? value ?? "—"}
        </p>
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
          {labelEl}
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
          {labelEl}
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
          {items.map(item => {
            const href = getItemLink?.(item);
            return href ? (
              <Link
                key={item}
                to={href}
                onClick={e => e.stopPropagation()}
                className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-semibold hover:bg-primary/20 hover:text-primary transition-colors"
              >
                {item}
              </Link>
            ) : (
              <Badge key={item} variant="secondary" className="text-xs">{item}</Badge>
            );
          })}
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
      {labelEl}
      <div className={cn("text-sm font-medium text-foreground group-hover:bg-muted/50 group-hover:rounded px-1 -mx-1 transition-colors", type === "textarea" && "whitespace-pre-wrap")}>
        {renderDisplay()}
      </div>
    </div>
  );
}
