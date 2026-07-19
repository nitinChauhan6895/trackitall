// Locale-INDEPENDENT date formatting.
//
// toLocaleDateString() resolves differently on the server and on the device
// ("Aug 13, 2026" vs "13 Aug 2026"), so using it inside a client component
// produces a hydration mismatch. It matters more than usual here: the service
// worker serves one cached HTML shell to many different clients.

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "2026-08-13" -> "13 Aug 2026". */
export function formatShortDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}
