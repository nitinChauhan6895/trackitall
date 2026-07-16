import { notFound } from "next/navigation";
import { getDayExercises } from "@/lib/data";
import DayView from "./DayView";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function DayPage({ params }: { params: { date: string } }) {
  if (!DATE_RE.test(params.date)) notFound();
  const exercises = await getDayExercises(params.date);
  return <DayView date={params.date} initialExercises={exercises} />;
}
