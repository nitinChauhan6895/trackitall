"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// One-shot confirmations after an auth redirect, e.g. /?toast=verified.
// The param is removed straight away so a refresh doesn't show it again.
const MESSAGES: Record<string, string> = {
  verified: "Email verified. Welcome to TrackItAll.",
  password: "Password updated.",
  email: "Email address confirmed.",
};

export default function FlashToast() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const key = params.get("toast");
    if (!key) return;
    const msg = MESSAGES[key];
    const rest = new URLSearchParams(params.toString());
    rest.delete("toast");
    const qs = rest.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    if (!msg) return;
    setText(msg);
    const t = setTimeout(() => setText(null), 4000);
    return () => clearTimeout(t);
  }, [params, pathname, router]);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[max(env(safe-area-inset-top),12px)]">
      {text && (
        <p className="elevation-3 flex items-center gap-2.5 rounded-full bg-[#262626] px-[18px] py-3 text-sm font-semibold text-ink">
          <span aria-hidden className="h-2 w-2 rounded-full bg-green" />
          {text}
        </p>
      )}
    </div>
  );
}
