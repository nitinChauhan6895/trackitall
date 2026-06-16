import { notFound } from "next/navigation";
import { getCircuit } from "@/lib/data";
import CircuitBuilder from "../CircuitBuilder";

export default async function EditCircuitPage({
  params,
}: {
  params: { id: string };
}) {
  const circuit = await getCircuit(params.id);
  if (!circuit) notFound();
  return <CircuitBuilder initial={circuit} />;
}
