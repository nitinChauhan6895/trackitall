import { redirect } from "next/navigation";

// Old reset emails pointed here (sometimes with a PKCE ?code=). Hand both
// cases to the new flow.
export default function LegacyResetPage({ searchParams }: { searchParams: { code?: string } }) {
  if (searchParams.code) {
    redirect(`/auth/confirm?code=${encodeURIComponent(searchParams.code)}&type=recovery&next=/reset-password`);
  }
  redirect("/reset-password");
}
