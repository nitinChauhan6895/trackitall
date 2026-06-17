import Community from "../Community";

export default function CommunityPage() {
  return (
    <main className="flex flex-1 flex-col px-4 pb-28 safe-top">
      <header className="pb-1 pt-5">
        <h1 className="text-2xl font-bold tracking-tight">Community</h1>
        <p className="mt-0.5 text-sm text-muted">
          See how you stack up against friends and family.
        </p>
      </header>
      <Community />
    </main>
  );
}
