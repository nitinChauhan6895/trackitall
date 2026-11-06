import VerifyEmailForm from "./VerifyEmailForm";

export const metadata = { title: "Check your inbox · TrackItAll" };

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { email?: string; resend?: string };
}) {
  return (
    <VerifyEmailForm
      initialEmail={(searchParams.email ?? "").trim()}
      // Arriving from a failed log-in nothing was just sent, so Resend is live.
      justSent={searchParams.resend !== "1"}
    />
  );
}
