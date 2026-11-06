import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import { parseFlow, type AuthFlow } from "@/lib/auth/errors";

export const metadata = { title: "Link expired · TrackItAll" };

const ACTIONS: Record<AuthFlow, { body: string; label: string; href: string }> = {
  email: {
    body: "Verification links work once and expire after an hour. Get a new code to finish setting up your account.",
    label: "Send a new code",
    href: "/verify-email?resend=1",
  },
  signup: {
    body: "Verification links work once and expire after an hour. Get a new code to finish setting up your account.",
    label: "Send a new code",
    href: "/verify-email?resend=1",
  },
  magiclink: {
    body: "Sign-in links work once and expire after an hour. Log in again to get a new one.",
    label: "Back to log in",
    href: "/login",
  },
  recovery: {
    body: "Reset links work once and expire after an hour. Request a new one to choose your password.",
    label: "Send a new reset link",
    href: "/forgot",
  },
  email_change: {
    body: "Email-change links work once and expire after an hour. You can send a new one from your profile.",
    label: "Back to profile",
    href: "/profile",
  },
  oauth: {
    body: "We couldn't finish signing you in. Please try again.",
    label: "Back to log in",
    href: "/login",
  },
};

export default function AuthErrorPage({ searchParams }: { searchParams: { reason?: string; flow?: string } }) {
  const flow = parseFlow(searchParams.flow);
  const expired = searchParams.reason === "expired";
  const action = ACTIONS[flow];
  return (
    <AuthShell
      line1={expired ? "This link has" : "This link"}
      line2={expired ? "expired." : "didn't work."}
      subtitle={expired ? action.body : `It may have been used already or copied incompletely. ${action.body}`}
      footer={
        action.href !== "/login" ? (
          <Link href="/login" className="inline-flex min-h-11 items-center text-[15px] font-semibold text-green active:opacity-70">
            Back to log in
          </Link>
        ) : null
      }
    >
      <Link
        href={action.href}
        className="flex h-[52px] w-full items-center justify-center rounded-full bg-green text-base font-semibold text-ink-inverse active:scale-[0.98] motion-reduce:active:scale-100"
      >
        {action.label}
      </Link>
    </AuthShell>
  );
}
