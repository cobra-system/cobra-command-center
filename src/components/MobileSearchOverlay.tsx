import { X } from "lucide-react";
import GlobalSearch from "@/components/GlobalSearch";

interface MobileSearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileSearchOverlay({ isOpen, onClose }: MobileSearchOverlayProps) {
  return (
    <div
      className={`
        fixed inset-0 z-[60] bg-background flex flex-col lg:hidden
        transition-all duration-200 ease-out
        ${isOpen ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"}
      `}
    >
      <div className="h-14 flex items-center justify-between px-4 border-b border-border/50 shrink-0">
        <span className="text-sm font-semibold text-foreground">חיפוש</span>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted/60 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="pt-3">
        <GlobalSearch autoFocus={isOpen} onNavigate={onClose} />
      </div>
    </div>
  );
}
