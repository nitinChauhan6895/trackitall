"use client";

import { forwardRef, useState } from "react";
import { cleanCode } from "@/lib/auth/validation";

/**
 * Six digit boxes backed by ONE real input, so iOS "From Messages/Mail"
 * autofill (autocomplete=one-time-code) and paste fill every box at once.
 * Calls onComplete when the sixth digit lands.
 */
const CodeInput = forwardRef<
  HTMLInputElement,
  {
    value: string;
    onChange: (v: string) => void;
    onComplete?: (v: string) => void;
    error?: boolean;
    disabled?: boolean;
    label?: string;
  }
>(function CodeInput({ value, onChange, onComplete, error, disabled, label = "6-digit code" }, ref) {
  const [focused, setFocused] = useState(false);
  const digits = value.split("");

  return (
    <div className="relative">
      <input
        ref={ref}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        value={value}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const next = cleanCode(e.target.value);
          onChange(next);
          if (next.length === 6 && next !== value) onComplete?.(next);
        }}
        className="absolute inset-0 z-10 h-full w-full cursor-text bg-transparent text-transparent caret-transparent opacity-0 outline-none"
      />
      <div aria-hidden className="grid grid-cols-6 gap-2">
        {Array.from({ length: 6 }, (_, i) => {
          const active = focused && (i === value.length || (value.length === 6 && i === 5));
          return (
            <span
              key={i}
              className={[
                "flex h-14 items-center justify-center rounded-[14px] border bg-surface-2 font-display text-[26px] font-semibold text-ink",
                active ? "border-green" : error ? "border-gold/40" : "border-white/[0.06]",
              ].join(" ")}
            >
              {digits[i] ?? ""}
            </span>
          );
        })}
      </div>
    </div>
  );
});

export default CodeInput;
