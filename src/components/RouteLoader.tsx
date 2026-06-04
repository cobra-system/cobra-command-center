/**
 * RouteLoader — Suspense fallback for lazy-loaded route content.
 * Rendered inside the layout shell so the sidebar/header stay put while a
 * page chunk loads. Keep this lightweight: it appears on first visit to
 * each lazy route.
 */
export function RouteLoader() {
  return (
    <div className="flex items-center justify-center py-24" role="status" aria-label="טוען עמוד">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin h-8 w-8 border-[3px] border-primary border-t-transparent rounded-full" />
        <span className="text-xs text-muted-foreground">טוען…</span>
      </div>
    </div>
  );
}

export default RouteLoader;
