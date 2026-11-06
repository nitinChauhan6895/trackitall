import ForgotForm from "./ForgotForm";

export const metadata = { title: "Reset password · TrackItAll" };

export default function ForgotPage({ searchParams }: { searchParams: { email?: string } }) {
  return <ForgotForm initialEmail={(searchParams.email ?? "").trim()} />;
}
