import { getBadgeData, getProfile } from "@/lib/data";
import { evaluateBadges } from "@/lib/badges";
import { createClient } from "@/lib/supabase/server";
import ProfileScreen, { type AccountInfo, type ProfileSummary } from "@/components/ProfileScreen";

export default async function ProfilePage({ searchParams }: { searchParams: { view?: string } }) {
  const [profile, summary, account] = await Promise.all([getProfile(), loadSummary(), loadAccount()]);
  return (
    <ProfileScreen
      profile={profile}
      summary={summary}
      account={account}
      initialView={searchParams.view === "password" ? "password" : "menu"}
    />
  );
}

// Workouts, badges and best streak for the identity card. The page still
// renders without them if the badge scan fails.
async function loadSummary(): Promise<ProfileSummary | null> {
  try {
    const { stats, earnedDates } = await getBadgeData();
    const badges = evaluateBadges(stats, earnedDates);
    return {
      workouts: stats.totalWorkouts,
      badgesEarned: badges.filter((b) => b.earned).length,
      badgesTotal: badges.length,
      bestStreak: stats.longestStreak,
    };
  } catch {
    return null;
  }
}

// Email status straight from Supabase Auth (verified, pending change).
async function loadAccount(): Promise<AccountInfo | null> {
  try {
    const {
      data: { user },
    } = await createClient().auth.getUser();
    if (!user) return null;
    return {
      email: user.email ?? null,
      verified: Boolean(user.email_confirmed_at),
      pendingEmail: (user as { new_email?: string }).new_email || null,
    };
  } catch {
    return null;
  }
}
