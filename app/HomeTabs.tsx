"use client";

import { useState } from "react";

export default function HomeTabs({
  mySpace,
  community,
}: {
  mySpace: React.ReactNode;
  community: React.ReactNode;
}) {
  const [tab, setTab] = useState<"my" | "community">("my");

  return (
    <>
      <div className="mt-3 flex rounded-2xl bg-beige p-1">
        <TabButton active={tab === "my"} onClick={() => setTab("my")}>
          MySpace
        </TabButton>
        <TabButton
          active={tab === "community"}
          onClick={() => setTab("community")}
        >
          Community
        </TabButton>
      </div>

      {tab === "my" ? mySpace : community}
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex-1 rounded-xl px-4 py-2.5 text-base font-semibold transition",
        active ? "bg-surface text-green shadow-sm" : "text-muted",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
