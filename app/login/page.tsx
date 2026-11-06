import { safeNext } from "@/lib/auth/next";
import LoginForm from "./LoginForm";

export const metadata = { title: "Log in · TrackItAll" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; email?: string };
}) {
  return <LoginForm next={safeNext(searchParams.next)} initialEmail={searchParams.email ?? ""} />;
}
