import Link from "next/link";
import { getIncomingShares, getProfile } from "@/lib/data";
import Community from "../Community";
import ShareInbox from "@/components/ShareInbox";

export default async function CommunityPage() {
  const [shares, profile] = await Promise.all([getIncomingShares(), getProfile()]);
  const sharing = profile.share_to_community;
  return (
    <main className="flex flex-1 flex-col gap-5 px-4 pb-36 safe-top">
      <header className="flex flex-col gap-1 px-1 pt-5">
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em]">Community</h1>
        <p className="text-sm text-muted">See how you stack up against friends and family.</p>
      </header>

      {/* Sharing status */}
      <section className="elevation-1 flex items-center gap-3.5 rounded-3xl px-[18px] py-4">
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="text-base font-semibold">
            Sharing is <span className={sharing ? "text-green" : "text-muted"}>{sharing ? "on" : "off"}</span>
          </span>
          <span className="text-[13px] text-muted">
            {sharing
              ? "Your stats will appear here when these launch."
              : "Turn it on in Profile to take part when these launch."}
          </span>
        </span>
        <Link href="/profile" className="shrink-0 text-sm font-semibold text-green active:opacity-70">
          Manage
        </Link>
      </section>

      <ShareInbox shares={shares} />
      <Community />
    </main>
  );
}
