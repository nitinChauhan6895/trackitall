"use client";

import { useRef, useState } from "react";

export type ScanResult = {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
};

// Parse OCR text from a nutrition panel. Assist-only + best-effort: returns
// whatever it can confidently find; the caller drops the user into an editable
// form with these pre-filled.
function parseLabel(text: string): ScanResult {
  const t = text.replace(/,/g, ".");
  const num = (re: RegExp): number | undefined => {
    const m = t.match(re);
    if (!m) return undefined;
    const v = Number(m[1]);
    return Number.isFinite(v) ? v : undefined;
  };
  return {
    calories:
      num(/(?:energy|calories|kcal|cal)[^\d]{0,18}(\d{1,4}(?:\.\d+)?)/i),
    protein: num(/protein[^\d]{0,18}(\d{1,3}(?:\.\d+)?)/i),
    carbs: num(/(?:carbohydrate|carbs?)[^\d]{0,18}(\d{1,3}(?:\.\d+)?)/i),
    fat: num(/(?:total\s*fat|fat)[^\d]{0,18}(\d{1,3}(?:\.\d+)?)/i),
    fiber: num(/(?:dietary\s*fibre|dietary\s*fiber|fibre|fiber)[^\d]{0,18}(\d{1,3}(?:\.\d+)?)/i),
  };
}

export default function LabelScanner({
  onScanned,
}: {
  onScanned: (r: ScanResult) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "reading" | "error">("idle");
  const [progress, setProgress] = useState(0);

  async function handleFile(file: File) {
    setStatus("loading");
    setProgress(0);
    try {
      // Lazily load Tesseract only now, so it never affects normal app load.
      const { default: Tesseract } = await import("tesseract.js");
      setStatus("reading");
      const { data } = await Tesseract.recognize(file, "eng", {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") setProgress(Math.round(m.progress * 100));
        },
      });
      const parsed = parseLabel(data.text ?? "");
      onScanned(parsed);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={status === "loading" || status === "reading"}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-green/50 bg-green-tint px-4 py-3 text-sm font-semibold text-green active:opacity-80 disabled:opacity-60"
      >
        {status === "loading"
          ? "Loading scanner…"
          : status === "reading"
            ? `Reading label… ${progress}%`
            : "📷 Scan label"}
      </button>
      {status === "error" && (
        <p className="mt-1.5 text-xs text-orange">
          Couldn&apos;t read the label — enter the values manually below.
        </p>
      )}
      <p className="mt-1.5 text-xs text-muted">
        Scanning pre-fills the fields — always check and correct the numbers before saving.
      </p>
    </div>
  );
}
