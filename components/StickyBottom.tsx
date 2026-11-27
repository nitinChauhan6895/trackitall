/**
 * Pins its content to the bottom of the screen, like `position: fixed`, but
 * with `position: sticky`.
 *
 * Why: on iPhone (iOS 26 Safari / home-screen app) fixed elements at the
 * bottom can lose their place, usually after the keyboard closes, and then
 * scroll along with the page (the tab bar ended up in the middle of Home).
 * Sticky elements are laid out with the page itself and don't have that bug.
 *
 * How: a zero-height sticky box at the very end of the scrolling content
 * sticks to the bottom edge; the real content hangs upward from it, so it
 * takes no space and overlaps the page exactly as the fixed version did.
 *
 * Put it as the LAST child of a block that runs to the bottom of the
 * scrolling area (sticky can't move outside its parent's content box, so the
 * parent must not end in padding).
 */
export default function StickyBottom({
  children,
  className = "",
  z = "z-30",
}: {
  children: React.ReactNode;
  /** Classes for the inner, visible layer (padding, layout). */
  className?: string;
  z?: string;
}) {
  return (
    <div className={`pointer-events-none sticky bottom-0 ${z} h-0 w-full shrink-0`}>
      <div className={`absolute inset-x-0 bottom-0 mx-auto w-full max-w-md ${className}`}>{children}</div>
    </div>
  );
}
