"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchCircuits, qk } from "@/lib/browserData";
import { useRouteDate } from "@/lib/useRouteDate";
import QuickLogger from "./QuickLogger";
import LogLoading from "./loading";

// Client shell so ANY /log/<date> works offline from one cached shell — see
// app/day/[date]/page.tsx for the reasoning.
//
// Everything needed to add an exercise is bundled in the JS (the exercise
// library is a local preset), so this screen works with no Supabase data at
// all. Circuits are the one server-backed extra and degrade to an empty list
// when they haven't been cached.
export default function LogPage() {
  const date = useRouteDate();
  const { data: circuits = [] } = useQuery({
    queryKey: qk.circuits(),
    queryFn: fetchCircuits,
    retry: false,
  });

  if (!date) return <LogLoading />;
  return <QuickLogger date={date} circuits={circuits} />;
}
