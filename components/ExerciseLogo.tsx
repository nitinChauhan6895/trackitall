"use client";

import { useState } from "react";
import { logoSrc } from "@/lib/exerciseLogos";

// Renders the mapped exercise logo image; falls back to an emoji if the file
// isn't present yet (so the UI stays intact before the assets are added).
export default function ExerciseLogo({
  name,
  fallback,
  className,
}: {
  name: string;
  fallback: string;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <span aria-hidden className={`flex items-center justify-center ${className ?? ""}`}>
        {fallback}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={logoSrc(name)}
      alt=""
      aria-hidden
      onError={() => setErrored(true)}
      className={`object-contain ${className ?? ""}`}
    />
  );
}
