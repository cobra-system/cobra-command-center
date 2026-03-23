import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useData } from "@/contexts/AppContext";
import type { SelectedParticipant } from "./types";

interface Props {
  value: SelectedParticipant[];
  onChange: (value: SelectedParticipant[]) => void;
}

export default function MeetingParticipantSelector({ value, onChange }: Props) {
  const [open, setOpen] = React.useState(false);
  const { profiles, suppliers } = useData();

  const allContacts: SelectedParticipant[] = suppliers.flatMap(s =>
    (s.contacts || []).map(c => ({
      type: "supplier_contact" as const,
      id: c.id,
      label: `${c.name} (${s.company})`,
    }))
  );

  const options: { group: string; items: SelectedParticipant[] }[] = [
    {
      group: "עובדים",
      items: profiles.map(p => ({ type: "profile" as const, id: p.id, label: p.name })),
    },
    {
      group: "ספקים",
      items: suppliers.map(s => ({ type: "supplier" as const, id: s.id, label: s.company })),
    },
    ...(allContacts.length > 0
      ? [{ group: "אנשי קשר ספק", items: allContacts }]
      : []),
  ];

  const isSelected = (item: SelectedParticipant) =>
    value.some(v => v.type === item.type && v.id === item.id);

  const toggle = (item: SelectedParticipant) => {
    if (isSelected(item)) {
      onChange(value.filter(v => !(v.type === item.type && v.id === item.id)));
    } else {
      onChange([...value, item]);
    }
  };

  const remove = (item: SelectedParticipant) => {
    onChange(value.filter(v => !(v.type === item.type && v.id === item.id)));
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map(p => (
            <Badge
              key={`${p.type}-${p.id}`}
              variant="secondary"
              className="gap-1 pr-1 text-xs"
            >
              {p.label}
              <button
                type="button"
                onClick={() => remove(p)}
                className="rounded-full hover:bg-muted-foreground/20 p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal text-muted-foreground"
          >
            <span>{value.length > 0 ? `${value.length} נבחרו` : "בחר משתתפים..."}</span>
            <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0"
          style={{ width: "var(--radix-popover-trigger-width)" }}
          align="start"
        >
          <Command>
            <CommandInput placeholder="חיפוש..." />
            <CommandList>
              <CommandEmpty>לא נמצאו תוצאות</CommandEmpty>
              {options.map(({ group, items }) =>
                items.length > 0 ? (
                  <CommandGroup key={group} heading={group}>
                    {items.map(item => (
                      <CommandItem
                        key={`${item.type}-${item.id}`}
                        value={item.label}
                        onSelect={() => toggle(item)}
                      >
                        <Check
                          className={cn(
                            "ms-2 h-4 w-4 shrink-0",
                            isSelected(item) ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {item.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
