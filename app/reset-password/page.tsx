import { redirect } from "next/navigation";
import { recoveryState } from "@/lib/auth/session";
import ResetPasswordForm from "./ResetPasswordForm";

export const metadata = { title: "Choose a new password · TrackItAll" };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const state = await recoveryState();
  if (state === "none") redirect("/auth/error?reason=expired&flow=recovery");
  // Signed in normally: changing the password needs the current one.
  if (state === "normal") redirect("/profile?view=password");
  return <ResetPasswordForm />;
}
