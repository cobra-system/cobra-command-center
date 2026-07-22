import { useState, useEffect, useCallback, useRef } from "react";

type AcceptFn = (file: File) => boolean;

interface Options {
  accept?: AcceptFn;
  disabled?: boolean;
}

/**
 * Adds drag-and-drop + Ctrl+V paste support to any file upload area.
 * Returns isDragging state and dropProps to spread on the drop target element.
 * The paste listener is global (document-level) but ignores events fired
 * while the user is typing in an input or textarea.
 */
export function useFileDropPaste(onFile: (file: File) => void, options?: Options) {
  const { accept, disabled = false } = options ?? {};
  const [isDragging, setIsDragging] = useState(false);
  const onFileRef = useRef(onFile);
  onFileRef.current = onFile;
  const acceptRef = useRef(accept);
  acceptRef.current = accept;

  useEffect(() => {
    if (disabled) return;
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      const items = Array.from(e.clipboardData?.items ?? []);
      const fileItem = items.find((i) => i.kind === "file");
      if (!fileItem) return;
      const file = fileItem.getAsFile();
      if (!file) return;
      if (acceptRef.current && !acceptRef.current(file)) return;
      e.preventDefault();
      onFileRef.current(file);
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [disabled]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (acceptRef.current && !acceptRef.current(file)) return;
    onFileRef.current(file);
  }, [disabled]);

  return { isDragging, dropProps: { onDragOver, onDragLeave, onDrop } };
}
