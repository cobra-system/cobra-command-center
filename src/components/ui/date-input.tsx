import { useState, useRef, useEffect } from "react";
import { format, parse, isValid } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface DateInputProps {
  value?: Date;
  onChange: (date?: Date) => void;
  placeholder?: string;
  className?: string;
  clearable?: boolean;
}

// Try to parse a date string typed by the user.
// Supports: DD/MM/YYYY, DD/MM/YY, DD.MM.YYYY, DD.MM.YY, YYYY-MM-DD, DD-MM-YYYY
function parseUserDate(str: string): Date | undefined {
  const s = str.trim();
  if (!s) return undefined;

  const formats = [
    "dd/MM/yyyy",
    "d/M/yyyy",
    "dd/MM/yy",
    "d/M/yy",
    "dd.MM.yyyy",
    "d.M.yyyy",
    "dd.MM.yy",
    "d.M.yy",
    "dd-MM-yyyy",
    "d-M-yyyy",
    "yyyy-MM-dd",
  ];

  for (const fmt of formats) {
    const d = parse(s, fmt, new Date());
    if (isValid(d) && d.getFullYear() > 1900) return d;
  }
  return undefined;
}

export function DateInput({ value, onChange, placeholder = "DD/MM/YYYY", className, clearable = false }: DateInputProps) {
  const [text, setText] = useState(value ? format(value, "dd/MM/yyyy") : "");
  const [calOpen, setCalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync text when value changes externally
  useEffect(() => {
    const formatted = value ? format(value, "dd/MM/yyyy") : "";
    setText(prev => (prev !== formatted ? formatted : prev));
  }, [value]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);
    const parsed = parseUserDate(raw);
    if (parsed) {
      onChange(parsed);
    } else if (!raw.trim()) {
      onChange(undefined);
    }
  };

  const handleCalSelect = (d?: Date) => {
    if (d) {
      setText(format(d, "dd/MM/yyyy"));
      onChange(d);
    }
    setCalOpen(false);
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Input
        ref={inputRef}
        value={text}
        onChange={handleTextChange}
        placeholder={placeholder}
        className="flex-1 text-right"
        dir="ltr"
      />
      {clearable && value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => { setText(""); onChange(undefined); }}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
      <Popover open={calOpen} onOpenChange={setCalOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0">
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={value}
            onSelect={handleCalSelect}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
