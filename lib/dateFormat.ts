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

/** "2026-08-13" -> "13 Aug". */
export function formatDayMonth(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  if (!m || !d) return key;
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** (2026, 8) -> "August 2026". */
export function formatMonthYear(year: number, month: number): string {
  return `${MONTHS_LONG[month - 1] ?? month} ${year}`;
}

/** "2026-08-13" -> "Thu, 13 Aug". */
export function formatWeekdayDayMonth(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  const dow = new Date(y, m - 1, d).getDay(); // day-of-week is locale-free
  return `${WEEKDAYS_SHORT[dow]}, ${d} ${MONTHS_SHORT[m - 1]}`;
}
