import { getMeasurements } from "@/lib/data";
import MeasurementsManager from "./MeasurementsManager";

export default async function MeasurementsPage() {
  const entries = await getMeasurements();
  return <MeasurementsManager initial={entries} />;
}
