"use client";

import { forwardRef, useId, useState } from "react";
import FieldError from "./FieldError";

export const INPUT_CLASS =
  "h-[52px] w-full rounded-2xl border bg-surface-2 px-4 text-base text-ink outline-none placeholder:text-subtle focus:border-green";

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  /** Right side of the label row, e.g. a "Forgot?" link. */
  aside?: React.ReactNode;
  /** Error styling without a message of its own (the form message explains). */
  invalid?: boolean;
};

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, aside, invalid, id, className, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errId = `${inputId}-error`;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className="text-xs font-semibold tracking-[0.08em] text-muted">
          {label.toUpperCase()}
        </label>
        {aside}
      </div>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error || invalid ? true : undefined}
        aria-describedby={error ? errId : undefined}
        className={[INPUT_CLASS, error || invalid ? "border-gold/40" : "border-white/[0.06]", className ?? ""].join(" ")}
        {...rest}
      />
      {error && <FieldError id={errId}>{error}</FieldError>}
    </div>
  );
});

type PasswordFieldProps = Omit<FieldProps, "type"> & { showCapsHint?: boolean };

/** Password input with Show/Hide and a Caps Lock hint. */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  { label, error, aside, invalid, id, showCapsHint = true, onKeyDown, onKeyUp, onBlur, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errId = `${inputId}-error`;
  const capsId = `${inputId}-caps`;
  const [shown, setShown] = useState(false);
  const [caps, setCaps] = useState(false);

  const detectCaps = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (typeof e.getModifierState === "function") setCaps(e.getModifierState("CapsLock"));
  };

  const describedBy = [error ? errId : "", caps && showCapsHint ? capsId : ""].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className="text-xs font-semibold tracking-[0.08em] text-muted">
          {label.toUpperCase()}
        </label>
        {aside}
      </div>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={shown ? "text" : "password"}
          aria-invalid={error || invalid ? true : undefined}
          aria-describedby={describedBy}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={[INPUT_CLASS, "pr-[72px]", error || invalid ? "border-gold/40" : "border-white/[0.06]"].join(" ")}
          onKeyDown={(e) => {
            detectCaps(e);
            onKeyDown?.(e);
          }}
          onKeyUp={(e) => {
            detectCaps(e);
            onKeyUp?.(e);
          }}
          onBlur={(e) => {
            setCaps(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-controls={inputId}
          aria-label={shown ? "Hide password" : "Show password"}
          className="absolute right-1 top-1/2 flex h-11 min-w-[60px] -translate-y-1/2 items-center justify-center rounded-xl px-3 text-sm font-semibold text-green active:opacity-70"
        >
          {shown ? "Hide" : "Show"}
        </button>
      </div>
      {caps && showCapsHint && (
        <p id={capsId} className="text-[13px] text-muted">
          Caps Lock is on
        </p>
      )}
      {error && <FieldError id={errId}>{error}</FieldError>}
    </div>
  );
});
