import { notFound } from "next/navigation";
import LogWizard from "./LogWizard";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function LogPage({ params }: { params: { date: string } }) {
  if (!DATE_RE.test(params.date)) notFound();
  return <LogWizard date={params.date} />;
}
