// Supabase's REST API returns at most 1000 rows per request (its "max rows"
// setting), no matter what .limit() says. A query over a user's whole workout
// history would therefore silently stop at 1000 exercises: Stats, Goals,
// badges and the Coach would quietly start undercounting. This runs a query
// in pages until it runs dry.
//
// The query MUST have a stable, unique order (end with .order("id")), or rows
// that tie on the earlier sort keys can be skipped or repeated at page edges.

const PAGE = 1000;

type PageResult<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PageResult<T>,
): Promise<{ data: T[]; error: unknown }> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) return { data: out, error };
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return { data: out, error: null };
}
