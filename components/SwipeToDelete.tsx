"use client";

import { useRef, useState } from "react";

const THRESHOLD = 72; // px to commit a delete
const ANIM = 200; // ms collapse animation

/**
 * Generic swipe-to-delete row. Swipe the foreground left past the threshold to
 * delete; a "Delete" background is revealed underneath. `children` is a render
 * function that receives `requestDelete` so the row can also expose a tap target
 * (e.g. an ✕ button) that triggers the same animated removal.
 */
export default function SwipeToDelete({
  onDelete,
  children,
  label = "Delete",
}: {
  onDelete: () => void | Promise<void>;
  children: (requestDelete: () => void) => React.ReactNode;
  label?: string;
}) {
  const [dx, setDx] = useState(0);
  const [removing, setRemoving] = useState(false);
  const [maxH, setMaxH] = useState<number | undefined>(undefined);
  const outer = useRef<HTMLDivElement>(null);
  const startX = useRef<number | null>(null);
  const dragging = useRef(false);

  function requestDelete() {
    if (removing) return;
    const h = outer.current?.offsetHeight ?? 0;
    setMaxH(h);
    setDx(-9999);
    requestAnimationFrame(() => setRemoving(true));
    window.setTimeout(() => {
      void onDelete();
    }, ANIM);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (removing) return;
    startX.current = e.clientX;
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current || startX.current === null) return;
    setDx(Math.min(0, e.clientX - startX.current));
  }
  function onPointerUp() {
    if (!dragging.current) return;
    dragging.current = false;
    if (dx <= -THRESHOLD) requestDelete();
    else setDx(0);
  }

  return (
    <div
      ref={outer}
      className="relative overflow-hidden rounded-xl"
      style={{
        maxHeight: removing ? 0 : maxH,
        opacity: removing ? 0 : 1,
        transition: `max-height ${ANIM}ms ease, opacity ${ANIM}ms ease`,
      }}
    >
      <div className="absolute inset-0 flex items-center justify-end bg-orange pr-4 text-sm font-semibold text-white">
        {label}
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative touch-pan-y select-none"
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging.current ? "none" : "transform 180ms ease",
        }}
      >
        {children(requestDelete)}
      </div>
    </div>
  );
}
