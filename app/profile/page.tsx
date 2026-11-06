import { getBadgeData, getProfile } from "@/lib/data";
import { evaluateBadges } from "@/lib/badges";
import ProfileScreen, { type ProfileSummary } from "@/components/ProfileScreen";

export default async function ProfilePage() {
  const [profile, summary] = await Promise.all([getProfile(), loadSummary()]);
  return <ProfileScreen profile={profile} summary={summary} />;
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
