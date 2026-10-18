export function LoadingDots() {
  return <span className="loading-dots" aria-hidden="true"><i /><i /><i /></span>;
}

export function Skeleton({ label = "Loading", cards = 0, media = false }: { label?: string; cards?: number; media?: boolean }) {
  return <div className={cards ? "skeleton-grid" : "skeleton-block"} role="status" aria-label={label} aria-busy="true">
    <span className="sr-only">{label}</span>
    {Array.from({ length: cards || 1 }, (_, i) => <div className={cards ? "skeleton-card" : "skeleton-content"} key={i} aria-hidden="true">
      {(media || cards > 0) && <div className="shimmer skeleton-picture" />}
      <div className="shimmer skeleton-line" /><div className="shimmer skeleton-line short" />
    </div>)}
  </div>;
}
