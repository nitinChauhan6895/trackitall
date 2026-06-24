import { getCoachLibrary, getCoachProfile, getSuggestedFocus } from "@/lib/data";
import { toDateKey } from "@/lib/date";
import CoachClient from "./CoachClient";

export default async function CoachPage() {
  const [profile, focus, library] = await Promise.all([
    getCoachProfile(),
    getSuggestedFocus(),
    getCoachProfile().then((p) => (p ? getCoachLibrary() : [])),
  ]);

  const libraryLite = library.map((e) => ({
    id: e.id,
    name: e.name,
    muscle_group: e.muscle_group,
  }));

  return (
    <CoachClient
      profile={profile}
      focus={focus}
      today={toDateKey(new Date())}
      library={libraryLite}
    />
  );
}
