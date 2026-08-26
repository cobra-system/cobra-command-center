import { forwardRef, useCallback, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface TableScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Space (px) to leave between the bottom of the scroll box and the bottom of the viewport. */
  bottomGap?: number;
  /** Never shrink the scroll box below this height (px). */
  minHeight?: number;
}

/**
 * Scroll box for wide tables.
 *
 * A plain `overflow-x-auto` wrapper grows as tall as its table, which pushes the
 * horizontal scrollbar hundreds of pixels below the fold — you have to scroll to
 * the last row before you can pan the columns. This caps the box at the space
 * left in the viewport, so the horizontal scrollbar (and a `sticky` thead) stay
 * on screen while the rows scroll inside.
 *
 * The cap is measured in document space, so it does not drift as the page scrolls.
 */
export const TableScrollArea = forwardRef<HTMLDivElement, TableScrollAreaProps>(
  ({ bottomGap = 24, minHeight = 260, className, style, children, ...props }, forwardedRef) => {
    const innerRef = useRef<HTMLDivElement | null>(null);
    const [maxHeight, setMaxHeight] = useState<number | null>(null);

    const setRefs = useCallback(
      (node: HTMLDivElement | null) => {
        innerRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef],
    );

    useLayoutEffect(() => {
      const el = innerRef.current;
      if (!el) return;

      const measure = () => {
        // Hidden (e.g. inside an inactive tab or the mobile breakpoint) — nothing to measure.
        if (el.offsetParent === null && getComputedStyle(el).position !== "fixed") return;
        const docTop = el.getBoundingClientRect().top + window.scrollY;
        const available = Math.round(window.innerHeight - docTop - bottomGap);
        setMaxHeight(prev => {
          const next = Math.max(minHeight, available);
          return prev !== null && Math.abs(prev - next) <= 1 ? prev : next;
        });
      };

      measure();

      let frame = 0;
      const scheduleMeasure = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(measure);
      };

      window.addEventListener("resize", scheduleMeasure);
      // Content above the table (banners, filter chips) can appear/disappear and
      // shift our top edge — watch the document for those layout changes.
      const observer =
        typeof ResizeObserver !== "undefined" ? new ResizeObserver(scheduleMeasure) : null;
      observer?.observe(document.documentElement);

      return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener("resize", scheduleMeasure);
        observer?.disconnect();
      };
    }, [bottomGap, minHeight]);

    return (
      <div
        ref={setRefs}
        className={cn("overflow-auto overscroll-x-contain", className)}
        style={maxHeight !== null ? { maxHeight, ...style } : style}
        {...props}
      >
        {children}
      </div>
    );
  },
);

TableScrollArea.displayName = "TableScrollArea";
