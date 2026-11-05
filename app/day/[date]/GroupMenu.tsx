"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteGroup, shareWorkout } from "@/app/actions";
import { type MuscleGroup } from "@/lib/types";
import SharePicker from "@/components/SharePicker";

export default function GroupMenu({
  date,
  group,
  groupLabel,
  onDeleteGroup,
}: {
  date: string;
  group: MuscleGroup;
  groupLabel: string;
  onDeleteGroup: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`${groupLabel} options`}
        className="flex h-11 w-11 items-center justify-center rounded-full text-muted active:bg-white/10"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-3 top-14 z-50 w-40 overflow-hidden elevation-3 rounded-2xl bg-surface-2 py-1">
            <MenuItem
              label="Edit"
              onClick={() => {
                setOpen(false);
                router.push(`/log/${date}`);
              }}
            />
            <MenuItem
              label="Delete"
              danger
              onClick={() => {
                setOpen(false);
                startTransition(() => {
                  onDeleteGroup();
                });
              }}
            />
            <MenuItem
              label="Share"
              onClick={() => {
                setOpen(false);
                setShareOpen(true);
              }}
            />
          </div>
        </>
      )}

      {shareOpen && (
        <ShareModal
          date={date}
          group={group}
          groupLabel={groupLabel}
          onClose={() => setShareOpen(false)}
        />
      )}
    </>
  );
}

function MenuItem({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "block w-full px-4 py-2.5 text-left text-sm font-medium active:bg-white/10",
        danger ? "text-gold" : "text-ink",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function ShareModal({
  date,
  group,
  groupLabel,
  onClose,
}: {
  date: string;
  group: MuscleGroup;
  groupLabel: string;
  onClose: () => void;
}) {
  return (
    <SharePicker
      title={`Share ${groupLabel}`}
      subtitle="They can accept it into their day."
      onShare={(toUserId) => shareWorkout({ toUserId, date, group })}
      onClose={onClose}
    />
  );
}
