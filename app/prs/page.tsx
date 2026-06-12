import { getAllPrs } from "@/lib/data";
import PrManager from "./PrManager";

export default async function PrsPage() {
  const prs = await getAllPrs();
  return <PrManager initialPrs={prs} />;
}
