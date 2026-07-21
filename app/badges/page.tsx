import { redirect } from "next/navigation";

// Badges moved inside Goals; keep the old path working for anything that
// bookmarked it or has it cached in a service-worker shell.
export default function BadgesPage() {
  redirect("/goals");
}
