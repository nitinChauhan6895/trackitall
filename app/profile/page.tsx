import { getProfile } from "@/lib/data";
import ProfileScreen from "@/components/ProfileScreen";

export default async function ProfilePage() {
  const profile = await getProfile();
  return <ProfileScreen profile={profile} />;
}
