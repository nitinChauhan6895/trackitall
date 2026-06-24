import { getCoachProfile, getSuggestedFocus } from "@/lib/data";
import { toDateKey } from "@/lib/date";
import CoachClient from "./CoachClient";

export default async function CoachPage() {
  const [profile, focus] = await Promise.all([
    getCoachProfile(),
    getSuggestedFocus(),
  ]);

  return (
    <CoachClient
      profile={profile}
      focus={focus}
      today={toDateKey(new Date())}
    />
  );
}
