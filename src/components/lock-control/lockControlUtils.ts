export type LockStatus = "open" | "closed" | "unknown";
export type ScanAction = "open" | "close";

/**
 * Toggle rule: open → close, closed → open, unknown → close (assume locking).
 * Centralised so the page UI and unit tests stay aligned.
 */
export function nextActionFor(status: LockStatus): ScanAction {
  return status === "open" ? "close" : "open";
}

export function statusAfterAction(action: ScanAction): Exclude<LockStatus, "unknown"> {
  return action === "open" ? "open" : "closed";
}

/** A lock is "stale" if its last scan is older than 18 hours (or never scanned). */
export const STALE_THRESHOLD_MS = 18 * 60 * 60 * 1000;

export function isStale(lastScanAt: string | null, now: number = Date.now()): boolean {
  if (!lastScanAt) return true;
  return now - new Date(lastScanAt).getTime() > STALE_THRESHOLD_MS;
}

let audioCtx: AudioContext | null = null;
function ensureAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  return audioCtx;
}

function beep(frequency: number, durationMs: number): void {
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = frequency;
  gain.gain.value = 0.12;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + durationMs / 1000);
}

export function feedbackSuccess(): void {
  try {
    beep(880, 120);
    setTimeout(() => beep(1320, 120), 130);
  } catch {
    // ignore — audio may be blocked by browser autoplay policy
  }
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    try {
      navigator.vibrate(150);
    } catch {
      // ignore
    }
  }
}

export function feedbackError(): void {
  try {
    beep(220, 250);
  } catch {
    // ignore
  }
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    try {
      navigator.vibrate([80, 60, 80]);
    } catch {
      // ignore
    }
  }
}

export function formatScanTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function downloadCsv(filename: string, rows: string[][]): void {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
  // Prepend BOM so Excel renders Hebrew correctly.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
