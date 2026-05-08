import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface ComboboxOption {
  value: string;
  label: string;
  /** Optional extra search terms (e.g. SKU, code) so users can filter by them too */
  keywords?: string[];
  /** Optional secondary text shown beside the label (e.g. SKU) */
  hint?: string;
}

interface ComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  /** When true, the user can type a custom value that isn't in the options list */
  allowCustomValue?: boolean;
}

export function Combobox({
  value,
  onValueChange,
  options,
  placeholder = "בחר...",
  searchPlaceholder = "חיפוש...",
  emptyText = "לא נמצאו תוצאות",
  className,
  triggerClassName,
  disabled,
  allowCustomValue,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const selected = options.find(o => o.value === value);
  // If value is set but not in options (custom value), show it as-is
  const displayLabel = selected ? selected.label : (value || placeholder);
  const hasValue = !!selected || !!value;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-between rounded-md border border-input bg-background px-3 py-2 text-sm font-normal ring-offset-background hover:bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            !hasValue && "text-muted-foreground",
            triggerClassName,
            className
          )}
        >
          <span className="truncate text-end flex-1">{displayLabel}</span>
          <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        style={{ width: "var(--radix-popover-trigger-width)" }}
        align="start"
      >
        <Command>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {allowCustomValue && search.trim() ? (
                <button
                  className="w-full text-start px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onValueChange(search.trim());
                    setSearch("");
                    setOpen(false);
                  }}
                >
                  הוסף: &quot;{search.trim()}&quot;
                </button>
              ) : (
                emptyText
              )}
            </CommandEmpty>
            <CommandGroup>
              {options.map(option => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  keywords={option.keywords}
                  onSelect={() => {
                    onValueChange(option.value);
                    setSearch("");
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "ms-2 h-4 w-4 shrink-0",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="flex-1 truncate">{option.label}</span>
                  {option.hint && (
                    <span className="ms-2 text-xs text-muted-foreground" dir="ltr">{option.hint}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
