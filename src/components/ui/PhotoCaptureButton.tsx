import { useRef, useState } from "react";
import { Camera, ImageIcon, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PhotoCaptureButtonProps {
  imageUrl?: string | null;
  /** Storage path inside the product-images bucket, e.g. "products/uuid" or "components/uuid" */
  storagePath: string;
  onSave: (url: string) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export function PhotoCaptureButton({ imageUrl, storagePath, onSave, disabled, className }: PhotoCaptureButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${storagePath}/photo_${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("product-images")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage
        .from("product-images")
        .getPublicUrl(path);
      await onSave(publicUrl);
      toast.success("תמונה נשמרה");
    } catch {
      toast.error("שגיאה בהעלאת תמונה");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    await uploadFile(file);
  };

  const handleReplaceChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setViewOpen(false);
    await uploadFile(file);
  };

  if (imageUrl) {
    return (
      <>
        <button
          onClick={() => setViewOpen(true)}
          className={cn(
            "relative h-7 w-7 rounded overflow-hidden border border-border hover:opacity-80 transition-opacity shrink-0",
            className
          )}
          title="הצג תמונה"
          type="button"
        >
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
            <ImageIcon className="h-3 w-3 text-white" />
          </span>
        </button>

        {viewOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setViewOpen(false)}
          >
            <div
              className="bg-card rounded-xl overflow-hidden shadow-xl max-w-sm w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-3 border-b">
                <span className="text-sm font-medium">תמונה</span>
                <button type="button" onClick={() => setViewOpen(false)}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <img src={imageUrl} alt="" className="w-full object-contain max-h-80" />
              {!disabled && (
                <div className="p-3 border-t">
                  <label className="cursor-pointer w-full">
                    <input
                      ref={replaceInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handleReplaceChange}
                      disabled={uploading}
                    />
                    <span className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors w-full">
                      {uploading ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                      {uploading ? "שומר..." : "צלם חדשה"}
                    </span>
                  </label>
                </div>
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <label
      className={cn(
        "cursor-pointer shrink-0",
        (disabled || uploading) && "opacity-50 pointer-events-none",
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || uploading}
      />
      <span
        className="inline-flex items-center justify-center h-7 w-7 rounded border border-dashed border-muted-foreground/30 hover:border-primary/60 hover:bg-primary/5 transition-colors"
        title="צלם תמונה"
      >
        {uploading ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        ) : (
          <Camera className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </span>
    </label>
  );
}
