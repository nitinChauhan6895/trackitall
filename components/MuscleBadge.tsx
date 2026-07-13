"use client";

import { useEffect, useState } from "react";
import MuscleIcon, { MUSCLE_TONE } from "@/components/MuscleIcon";
import type { MuscleGroup } from "@/lib/types";

// Colored circular muscle-group badge.
//
// Renders /public/icons/muscles/{group}.png when that asset exists; otherwise
// falls back to the built-in tinted line icon. We probe the image with a JS
// preload and only swap it in on success, so a missing file never flashes a
// broken-image glyph (and there's no SSR onError race).
export default function MuscleBadge({
  group,
  className,
}: {
  group: MuscleGroup;
  className?: string;
}) {
  const src = `/icons/muscles/${group}.png`;
  const [ready, setReady] = useState(false);
  const tone = MUSCLE_TONE[group];

  useEffect(() => {
    let alive = true;
    const img = new window.Image();
    img.onload = () => alive && setReady(true);
    img.onerror = () => alive && setReady(false);
    img.src = src;
    return () => {
      alive = false;
    };
  }, [src]);

  if (ready) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt=""
        aria-hidden
        className={`shrink-0 rounded-full object-cover ${className ?? ""}`}
      />
    );
  }

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
