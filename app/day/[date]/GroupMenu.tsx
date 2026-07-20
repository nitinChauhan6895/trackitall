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
        aria-label="Group options"
        className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-muted active:bg-white/10"
      >
        ⋮
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-3 top-12 z-50 w-40 overflow-hidden rounded-xl border border-white/10 bg-surface py-1 shadow-lg">
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
        danger ? "text-orange" : "text-ink",
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
