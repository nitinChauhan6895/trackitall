"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Cloudflare Turnstile, only when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set. Its
// token goes to Supabase as options.captchaToken; with CAPTCHA enabled in the
// dashboard, Supabase rejects sign-up, sign-in, code and reset requests
// without one. Tokens are single-use, so callers reset() after each request.

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        scriptPromise = null;
        reject(new Error("turnstile"));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

export function useTurnstile() {
  const [token, setToken] = useState<string | null>(null);
  const idRef = useRef<string | null>(null);

  const reset = useCallback(() => {
    setToken(null);
    if (idRef.current && window.turnstile) window.turnstile.reset(idRef.current);
  }, []);

  return {
    enabled: SITE_KEY !== "",
    /** Undefined when Turnstile is off, so it's simply left out of the request. */
    token: SITE_KEY ? (token ?? undefined) : undefined,
    ready: !SITE_KEY || token !== null,
    reset,
    widget: SITE_KEY ? <TurnstileWidget onToken={setToken} idRef={idRef} /> : null,
  };
}

function TurnstileWidget({
  onToken,
  idRef,
}: {
  onToken: (t: string | null) => void;
  idRef: React.MutableRefObject<string | null>;
}) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !el.current || !window.turnstile) return;
        idRef.current = window.turnstile.render(el.current, {
          sitekey: SITE_KEY,
          theme: "dark",
          size: "flexible",
          callback: (t: string) => onToken(t),
          "expired-callback": () => onToken(null),
          "error-callback": () => onToken(null),
        });
      })
      .catch(() => onToken(null));
    return () => {
      cancelled = true;
      if (idRef.current && window.turnstile) window.turnstile.remove(idRef.current);
      idRef.current = null;
    };
  }, [onToken, idRef]);

  return <div ref={el} className="min-h-[65px]" />;
}
