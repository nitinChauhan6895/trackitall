import { getPrSources } from "@/lib/data";
import PrCorner from "./PrCorner";

export default async function PrsPage() {
  const sources = await getPrSources();
  return <PrCorner initialSources={sources} />;
}
