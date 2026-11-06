"use client";

import { useEffect, useState } from "react";
import { TextButton } from "./Buttons";

/**
 * "Resend code" with a cooldown ("Resend in 0:42"). The countdown is a
 * courtesy; Supabase's own rate limits are what actually protect the inbox.
 */
export default function ResendButton({
  onResend,
  cooldown = 60,
  startCooling = true,
  label = "Resend code",
}: {
  onResend: () => Promise<boolean>;
  cooldown?: number;
  startCooling?: boolean;
  label?: string;
}) {
  const [left, setLeft] = useState(startCooling ? cooldown : 0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");

  return (
    <TextButton
      disabled={left > 0 || busy}
      onClick={async () => {
        setBusy(true);
        const sent = await onResend();
        setBusy(false);
        if (sent) setLeft(cooldown);
      }}
    >
      {busy ? "Sending…" : left > 0 ? `Resend in ${mm}:${ss}` : label}
    </TextButton>
  );
}
