import { useState, useEffect, useCallback, useRef } from "react";

type AcceptFn = (file: File) => boolean;

interface Options {
  accept?: AcceptFn;
  disabled?: boolean;
  /**
   * Receive every dropped/pasted file instead of just the first.
   *
   * Most upload surfaces here take one file at a time, so `onFile` stays the
   * default. Set this where a batch is the point — dropping a whole email's
   * attachments at once — and `onFile` is not called.
   */
  onFiles?: (files: File[]) => void;
}

/**
 * Adds drag-and-drop + Ctrl+V paste support to any file upload area.
 * Returns isDragging state and dropProps to spread on the drop target element.
 * The paste listener is global (document-level) but ignores events fired
 * while the user is typing in an input or textarea.
 */
export function useFileDropPaste(onFile: (file: File) => void, options?: Options) {
  const { accept, disabled = false, onFiles } = options ?? {};
  const [isDragging, setIsDragging] = useState(false);
  const onFileRef = useRef(onFile);
  onFileRef.current = onFile;
  const acceptRef = useRef(accept);
  acceptRef.current = accept;
  const onFilesRef = useRef(onFiles);
  onFilesRef.current = onFiles;

  /** Deliver a batch, or fall back to the single-file callback. */
  const deliver = (files: File[]) => {
    const allowed = acceptRef.current ? files.filter(acceptRef.current) : files;
    if (allowed.length === 0) return;
    if (onFilesRef.current) onFilesRef.current(allowed);
    else onFileRef.current(allowed[0]);
  };
  const deliverRef = useRef(deliver);
  deliverRef.current = deliver;

  useEffect(() => {
    if (disabled) return;
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      const items = Array.from(e.clipboardData?.items ?? []);
      const pasted = items
        .filter((i) => i.kind === "file")
        .map((i) => i.getAsFile())
        .filter((f): f is File => f !== null);
      if (pasted.length === 0) return;
      e.preventDefault();
      deliverRef.current(pasted);
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
    const dropped = Array.from(e.dataTransfer.files ?? []);
    if (dropped.length === 0) return;
    deliverRef.current(dropped);
  }, [disabled]);

  return { isDragging, dropProps: { onDragOver, onDragLeave, onDrop } };
}
