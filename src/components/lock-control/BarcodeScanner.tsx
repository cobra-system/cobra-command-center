import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { X, Camera, AlertCircle, Keyboard, Flashlight, FlashlightOff } from "lucide-react";

interface BarcodeScannerProps {
  open: boolean;
  title: string;
  hint?: string;
  onScan: (value: string) => void;
  onClose: () => void;
  onManualEntry?: (value: string) => void;
}

const SCANNER_REGION_ID = "lock-control-scanner-region";
const SCAN_DEBOUNCE_MS = 1500;

interface TorchCapabilities {
  torch?: boolean;
}

interface TorchConstraint {
  torch: boolean;
}

export function BarcodeScanner({ open, title, hint, onScan, onClose, onManualEntry }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastValueRef = useRef<{ value: string; at: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  useEffect(() => {
    if (!open) return;

    lastValueRef.current = null;
    setError(null);
    setShowManual(false);
    setManualValue("");
    setTorchOn(false);
    setTorchSupported(false);

    let cancelled = false;
    setStarting(true);

    const start = async () => {
      try {
        const instance = new Html5Qrcode(SCANNER_REGION_ID, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
          ],
          verbose: false,
        });
        scannerRef.current = instance;

        await instance.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
          (decodedText) => {
            const value = decodedText.trim();
            const now = Date.now();
            const last = lastValueRef.current;
            if (last && last.value === value && now - last.at < SCAN_DEBOUNCE_MS) return;
            lastValueRef.current = { value, at: now };
            onScan(value);
          },
          () => {
            // ignore per-frame decode failures
          }
        );

        if (cancelled) {
          await instance.stop().catch(() => {});
          return;
        }

        // Probe torch support on the active video track (best-effort).
        try {
          const videoEl = document.querySelector<HTMLVideoElement>(`#${SCANNER_REGION_ID} video`);
          const track = videoEl?.srcObject instanceof MediaStream ? videoEl.srcObject.getVideoTracks()[0] : null;
          const caps = track?.getCapabilities?.() as TorchCapabilities | undefined;
          if (caps?.torch) setTorchSupported(true);
        } catch {
          // ignore
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(
          message.toLowerCase().includes("permission") || message.toLowerCase().includes("notallowed")
            ? "אין הרשאת מצלמה. אפשר/י גישה לדפדפן או הזן/י את הקוד ידנית."
            : "לא ניתן להפעיל מצלמה. נסה/י דפדפן עדכני או הזן/י את הקוד ידנית."
        );
      } finally {
        if (!cancelled) setStarting(false);
      }
    };

    start();

    return () => {
      cancelled = true;
      const instance = scannerRef.current;
      scannerRef.current = null;
      if (instance) {
        instance
          .stop()
          .catch(() => {})
          .finally(() => instance.clear().catch(() => {}));
      }
    };
  }, [open, onScan]);

  const toggleTorch = async () => {
    try {
      const videoEl = document.querySelector<HTMLVideoElement>(`#${SCANNER_REGION_ID} video`);
      const track = videoEl?.srcObject instanceof MediaStream ? videoEl.srcObject.getVideoTracks()[0] : null;
      if (!track) return;
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next } as TorchConstraint] } as MediaTrackConstraints);
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  };

  if (!open) return null;

  const handleManualSubmit = () => {
    const trimmed = manualValue.trim();
    if (!trimmed) return;
    if (onManualEntry) onManualEntry(trimmed);
    else onScan(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-card rounded-2xl overflow-hidden shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{title}</span>
          </div>
          <div className="flex items-center gap-1">
            {torchSupported && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`p-1.5 rounded-md transition-colors ${
                  torchOn
                    ? "bg-warning/20 text-warning"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
                title={torchOn ? "כיבוי פנס" : "הפעלת פנס"}
                aria-label={torchOn ? "כיבוי פנס" : "הפעלת פנס"}
              >
                {torchOn ? <Flashlight className="h-4 w-4" /> : <FlashlightOff className="h-4 w-4" />}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-muted/60"
              aria-label="סגור"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative bg-black">
          <div id={SCANNER_REGION_ID} className="w-full aspect-square" />
          {starting && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-sm">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent me-2" />
              מפעיל מצלמה...
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 text-white text-sm p-4 text-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
              {error}
            </div>
          )}
        </div>

        <div className="p-4 space-y-3">
          {hint && <p className="text-xs text-muted-foreground text-center">{hint}</p>}

          {!showManual ? (
            <button
              type="button"
              onClick={() => setShowManual(true)}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <Keyboard className="h-4 w-4" />
              הזנה ידנית של קוד
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                autoFocus
                type="text"
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleManualSubmit();
                }}
                placeholder="לדוגמה: COBRA-TLV-LOCK-01"
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button
                type="button"
                onClick={handleManualSubmit}
                disabled={!manualValue.trim()}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
              >
                אישור
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
