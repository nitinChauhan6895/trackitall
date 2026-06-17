// Tiny inline line chart. Inherits color via `currentColor` (set text-* on parent).
export function Sparkline({
  values,
  className,
}: {
  values: number[];
  className?: string;
}) {
  if (values.length < 2) {
    return <div className={className} aria-hidden />;
  }
  const w = 100;
  const h = 36;
  const pad = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map((p) => p.join(",")).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  const last = pts[pts.length - 1];

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      <polyline points={area} fill="currentColor" opacity="0.12" stroke="none" />
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill="currentColor" />
    </svg>
  );
}
