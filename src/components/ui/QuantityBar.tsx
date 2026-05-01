import { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface QuantityBarProps {
  value: number;
  min?: number;
  max?: number;
  label?: string;
  onMinChange?: (v: number) => void;
  onMaxChange?: (v: number) => void;
  readOnly?: boolean;
  className?: string;
}

function getFillColor(value: number, min: number, max: number): string {
  if (value === 0 || (min > 0 && value < min * 0.5)) return "hsl(var(--destructive))";
  if (min > 0 && value < min) return "hsl(var(--warning))";
  if (max > 0 && value > max) return "hsl(var(--primary))";
  return "hsl(var(--success))";
}

function getStatusInfo(value: number, min: number, max: number) {
  if (value === 0) return { label: "ריק", bg: "bg-destructive/15", fg: "text-destructive" };
  if (min > 0 && value < min * 0.5) return { label: "קריטי", bg: "bg-destructive/15", fg: "text-destructive" };
  if (min > 0 && value < min) return { label: "נמוך", bg: "bg-warning/15", fg: "text-warning" };
  if (max > 0 && value > max) return { label: "עודף", bg: "bg-primary/15", fg: "text-primary" };
  return { label: "תקין", bg: "bg-success/15", fg: "text-success" };
}

const MAX_THRESHOLD = 3000;

export function QuantityBar({
  value,
  min = 0,
  max = 0,
  label,
  onMinChange,
  onMaxChange,
  readOnly = false,
  className,
}: QuantityBarProps) {
  const [localMin, setLocalMin] = useState(Math.min(MAX_THRESHOLD, Math.max(0, min)));
  const [localMax, setLocalMax] = useState(Math.min(MAX_THRESHOLD, Math.max(0, max)));

  useEffect(() => { setLocalMin(Math.min(MAX_THRESHOLD, Math.max(0, min))); }, [min]);
  useEffect(() => { setLocalMax(Math.min(MAX_THRESHOLD, Math.max(0, max))); }, [max]);

  const hasMin = localMin > 0;
  const hasMax = localMax > 0;

  // Display range extends 20% past the highest value so markers aren't at the edge
  const displayMax = Math.max(value, hasMax ? localMax : 0, hasMin ? localMin : 0, 1) * 1.2;

  const fillPct = Math.min((value / displayMax) * 100, 100);
  const minPct = hasMin ? Math.min((localMin / displayMax) * 100, 98) : 0;
  const maxPct = hasMax ? Math.min((localMax / displayMax) * 100, 98) : 0;

  const fillColor = getFillColor(value, localMin, localMax);
  const status = getStatusInfo(value, localMin, localMax);

  // Slider range scales with current data but is hard-capped so users
  // cannot drag in absurd values (a previous bug allowed trillions).
  const sliderMax = Math.min(MAX_THRESHOLD, Math.max(value * 3, localMax * 2, localMin * 3, 100));

  const title = `מלאי: ${value}${hasMin ? ` | מינ׳: ${localMin}` : ""}${hasMax ? ` | מקס׳: ${localMax}` : ""}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn("w-full flex items-center gap-0.5 group focus:outline-none", className)}
          title={title}
          onClick={e => e.stopPropagation()}
        >
          {/* Battery body */}
          <div className="relative flex-1 h-4 rounded-md border border-border/70 bg-muted overflow-hidden group-hover:border-border transition-colors">
            {/* Fill */}
            <div
              className="absolute inset-y-0 left-0 rounded-md transition-all duration-500 ease-out"
              style={{ width: `${fillPct}%`, backgroundColor: fillColor, opacity: 0.82 }}
            />
            {/* Min threshold marker */}
            {hasMin && (
              <div
                className="absolute inset-y-0 w-[2px] z-10"
                style={{ left: `${minPct}%`, backgroundColor: "hsl(var(--warning))" }}
              />
            )}
            {/* Max threshold marker */}
            {hasMax && maxPct !== minPct && (
              <div
                className="absolute inset-y-0 w-[2px] z-10"
                style={{ left: `${maxPct}%`, backgroundColor: "hsl(var(--warning))" }}
              />
            )}
          </div>
          {/* Battery terminal nub */}
          <div className="h-2.5 w-1 rounded-r-sm bg-border shrink-0 group-hover:bg-border/80 transition-colors" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-72 max-w-[calc(100vw-1rem)]" align="center" dir="rtl" sideOffset={8}>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{label ?? "מלאי"}</span>
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", status.bg, status.fg)}>
              {status.label}
            </span>
          </div>

          {/* Current value display */}
          <div className="text-center py-3 bg-muted/50 rounded-lg">
            <div className="text-4xl font-bold tabular-nums leading-none" style={{ color: fillColor }}>
              {value}
            </div>
            <div className="text-xs text-muted-foreground mt-1.5">יחידות במלאי</div>
          </div>

          {/* Larger visual bar */}
          <div className="flex items-center gap-0.5">
            <div className="relative flex-1 h-6 rounded-md border border-border/70 bg-muted overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-md transition-all duration-300"
                style={{ width: `${fillPct}%`, backgroundColor: fillColor, opacity: 0.75 }}
              />
              {hasMin && (
                <div
                  className="absolute inset-y-0 w-[2px] z-10"
                  style={{ left: `${minPct}%`, backgroundColor: "hsl(var(--warning))" }}
                />
              )}
              {hasMax && maxPct !== minPct && (
                <div
                  className="absolute inset-y-0 w-[2px] z-10"
                  style={{ left: `${maxPct}%`, backgroundColor: "hsl(var(--warning))" }}
                />
              )}
            </div>
            <div className="h-4 w-1 rounded-r-sm bg-border shrink-0" />
          </div>

          {/* Legend */}
          {(hasMin || hasMax) && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div
                className="h-3 w-0.5 rounded-full shrink-0"
                style={{ backgroundColor: "hsl(var(--warning))" }}
              />
              <span>קו כתום = סף מינ׳ / מקס׳</span>
            </div>
          )}

          {/* Min / Max controls */}
          <div className="space-y-3 pt-2 border-t">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div
                    className="h-3 w-0.5 rounded-full shrink-0"
                    style={{ backgroundColor: "hsl(var(--warning))" }}
                  />
                  <span className="text-xs text-muted-foreground">מינימום (נקודת הזמנה)</span>
                </div>
                <span className="text-sm font-bold tabular-nums">{localMin}</span>
              </div>
              {!readOnly && (
                <div dir="ltr">
                  <Slider
                    value={[localMin]}
                    min={0}
                    max={sliderMax}
                    step={1}
                    onValueChange={([v]) => setLocalMin(v)}
                    onValueCommit={([v]) => onMinChange?.(v)}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div
                    className="h-3 w-0.5 rounded-full shrink-0"
                    style={{ backgroundColor: "hsl(var(--warning))" }}
                  />
                  <span className="text-xs text-muted-foreground">מקסימום (יעד מלאי)</span>
                </div>
                <span className="text-sm font-bold tabular-nums">{localMax}</span>
              </div>
              {!readOnly && (
                <div dir="ltr">
                  <Slider
                    value={[localMax]}
                    min={0}
                    max={sliderMax}
                    step={1}
                    onValueChange={([v]) => setLocalMax(v)}
                    onValueCommit={([v]) => onMaxChange?.(v)}
                  />
                </div>
              )}
            </div>
          </div>

          {!readOnly && (
            <p className="text-xs text-muted-foreground text-center">גרור לשינוי הסף</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
