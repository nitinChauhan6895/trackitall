import { getCircuits } from "@/lib/data";
import CircuitsManager from "./CircuitsManager";

export default async function CircuitsPage() {
  const circuits = await getCircuits();
  return <CircuitsManager circuits={circuits} />;
}
