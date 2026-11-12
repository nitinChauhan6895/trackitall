"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// One-shot confirmations after an auth redirect, e.g. /?toast=verified.
// The param is removed straight away so a refresh doesn't show it again.
const MESSAGES: Record<string, string> = {
  verified: "Email verified. Welcome to TrackItAll.",
  password: "Password updated.",
  email: "Email address updated.",
  "email-pending": "Confirmed. Now confirm the email sent to your other address.",
};

export default function FlashToast() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [text, setText] = useState<string | null>(null);
  const [tone, setTone] = useState<"ok" | "error">("ok");

  // In-app messages (lib/optimistic.ts showToast), e.g. a save that failed.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const onToast = (e: Event) => {
      const { text: msg, tone: kind } = (e as CustomEvent<{ text: string; tone: "ok" | "error" }>).detail;
      setTone(kind);
      setText(msg);
      clearTimeout(t);
      t = setTimeout(() => setText(null), 4000);
    };
    window.addEventListener("app-toast", onToast);
    return () => {
      window.removeEventListener("app-toast", onToast);
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    const key = params.get("toast");
    if (!key) return;
    const msg = MESSAGES[key];
    const rest = new URLSearchParams(params.toString());
    rest.delete("toast");
    const qs = rest.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    if (!msg) return;
    setTone("ok");
    setText(msg);
    const t = setTimeout(() => setText(null), 4000);
    return () => clearTimeout(t);
  }, [params, pathname, router]);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[max(env(safe-area-inset-top),12px)]">
      {text && (
        <p className="elevation-3 flex items-center gap-2.5 rounded-full bg-[#262626] px-[18px] py-3 text-sm font-semibold text-ink">
          <span aria-hidden className={`h-2 w-2 rounded-full ${tone === "error" ? "bg-gold" : "bg-green"}`} />
          {text}
        </p>
      )}
    </div>
  );
}
