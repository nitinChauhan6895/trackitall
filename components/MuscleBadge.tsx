"use client";

import { useEffect, useRef, useState } from "react";
import MuscleIcon, { MUSCLE_TONE } from "@/components/MuscleIcon";
import type { MuscleGroup } from "@/lib/types";

// Colored circular muscle-group badge.
//
// Renders /public/icons/muscles/{group}.png directly (server-rendered, so the
// browser loads it immediately with no swap-in flash). If the file is missing
// or fails to load, it falls back to the built-in tinted line icon.
export default function MuscleBadge({
  group,
  className,
}: {
  group: MuscleGroup;
  className?: string;
}) {
  const src = `/icons/muscles/${group}.png`;
  const ref = useRef<HTMLImageElement>(null);
  const [errored, setErrored] = useState(false);
  const tone = MUSCLE_TONE[group];

  // Catch a load failure that fired before hydration attached onError.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setErrored(true);
  }, [src]);

  if (errored) {
    return (
      <span
        aria-hidden
        className={`flex shrink-0 items-center justify-center rounded-full ${className ?? ""}`}
        style={{ backgroundColor: `${tone}22`, color: tone }}
      >
        <span className="h-3/5 w-3/5">
          <MuscleIcon group={group} />
        </span>
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt=""
      aria-hidden
      onError={() => setErrored(true)}
      className={`shrink-0 rounded-full object-cover ${className ?? ""}`}
    />
  );
}
