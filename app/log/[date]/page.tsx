import { notFound } from "next/navigation";
import { getCircuits } from "@/lib/data";
import LogWizard from "./LogWizard";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function LogPage({ params }: { params: { date: string } }) {
  if (!DATE_RE.test(params.date)) notFound();
  const circuits = await getCircuits();
  return <LogWizard date={params.date} circuits={circuits} />;
}
