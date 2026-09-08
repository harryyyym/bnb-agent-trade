// Marketplace list state: URL params ⇄ filters, search matching and ranking,
// the client-side sorts, and the evidence order the whole page is built on.
// Pure — shared by page.tsx (parse), the landing anchor and the client list.
import { CATEGORY_SLUG, categoryFromSlug } from "@/lib/categories";
import {
  answeredLatency,
  isReachable,
  isVenueKey,
  matchesVenue,
  proofOf,
  queryScore,
  type VenueKey,
} from "@/lib/format";
import type { Category, LiteRow, Mode, Rail } from "@/lib/types";

/**
 * Id of the results region the category tabs drive. Radix points a tab's
 * `aria-controls` at its own `TabsContent`; the marketplace has no per-tab
 * panel — every tab filters the same list — so each trigger points here, and
 * the region carries `role="tabpanel"` named by whichever tab is selected.
 */
export const RESULTS_ID = "marketplace-results";

/** Tabs need a string value; the "no category" tab carries this one. */
export const ALL_TAB = "all";

/** Selects need a string value; the "no facet" option carries this one. */
export const ANY_OPTION = "any";

/** At most three agents in one comparison: four columns stop fitting at 1200px. */
export const COMPARE_MAX = 3;

/**
 * Stable id of a category tab, so the results panel can be `aria-labelledby`
 * it. The slug, not the category: `Category` carries spaces ("grid trading"),
 * which an id may not.
 */
export function tabId(category: Category | null): string {
  return `marketplace-tab-${category ? CATEGORY_SLUG[category] : ALL_TAB}`;
}

/**
 * Sorts. The default is `evidence`, whose every term is visible on screen: four
 * of them as columns, and "paid by a third party" as the `3rd` word in the
 * proof cell since BUYERS was dropped. It replaces `rank`, which was the
 * backend array order,
 * was labelled "Track record", and read down page one as 2, 7, 7, 7, 2 … 30,
 * 30: non-monotone in the only number the reader could see, and explained
 * nowhere. Rows arriving with `?sort=rank` land on `evidence`.
 */
export const SORTS = [
  { key: "evidence", label: "Evidence" },
  { key: "jobs", label: "Sold" },
  { key: "fast", label: "Fastest response" },
  { key: "recent", label: "Recently settled" },
  { key: "name", label: "Name" },
] as const;

export type SortKey = (typeof SORTS)[number]["key"];

export const DEFAULT_SORT: SortKey = "evidence";

/** Which sort a sortable column header selects, and which way it reads. */
export const COLUMN_SORT = {
  agent: { key: "name", dir: "asc" },
  proof: { key: "evidence", dir: "desc" },
  jobs: { key: "jobs", dir: "desc" },
  response: { key: "fast", dir: "asc" },
} as const satisfies Record<string, { key: SortKey; dir: "asc" | "desc" }>;

export interface ListParams {
  q: string;
  category: Category | null;
  venue: VenueKey | null;
  mode: Mode | null;
  rail: Rail | null;
  sort: SortKey;
  reachable: boolean;
  /**
   * Show the seeded demo lane (agents/shelf/seeded.ts) *instead of* the
   * chain-sourced one. Off by default, so the marketplace a reader lands on is
   * the real one and seeing synthetic numbers is a deliberate act.
   *
   * It swaps rather than appends because seeded rows may never outrank a chain
   * row (see `sortRows`): appended, all eight landed on page 10 and the control
   * looked broken. Swapping keeps the two sets from ever being ranked against
   * each other while still making the lane one click away.
   */
  seeded: boolean;
  page: number;
  /** Row keys ticked for comparison, in the order they were ticked. */
  compare: string[];
}

export const DEFAULT_PARAMS: ListParams = {
  q: "",
  category: null,
  venue: null,
  mode: null,
  rail: null,
  sort: DEFAULT_SORT,
  reachable: false,
  seeded: false,
  page: 1,
  compare: [],
};

const MAX_QUERY = 120;

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export function isSortKey(v: unknown): v is SortKey {
  return SORTS.some((s) => s.key === v);
}

export function isMode(v: unknown): v is Mode {
  return v === "monitor" || v === "advise" || v === "execute";
}

export function isRail(v: unknown): v is Rail {
  return v === "erc8183" || v === "x402";
}

export function cleanQuery(q: string): string {
  return q.replace(/\s+/g, " ").trim().slice(0, MAX_QUERY);
}

/** `${chain}:${id}` keys, deduped and capped — the shape the `compare` param carries. */
export function cleanCompare(keys: readonly string[]): string[] {
  const out: string[] = [];
  for (const k of keys) {
    if (!/^\d{1,7}:\d{1,12}$/.test(k) || out.includes(k)) continue;
    out.push(k);
    if (out.length === COMPARE_MAX) break;
  }
  return out;
}

/** `?q=&category=&venue=&mode=&rail=&sort=&reachable=1&page=N&compare=a,b` to ListParams. */
export function parseListParams(sp: Record<string, string | string[] | undefined>): ListParams {
  const sort = one(sp.sort);
  const page = Number(one(sp.page));
  const venue = one(sp.venue);
  const mode = one(sp.mode);
  const rail = one(sp.rail);
  return {
    q: cleanQuery(one(sp.q)),
    category: categoryFromSlug(one(sp.category) || null),
    venue: isVenueKey(venue) ? venue : null,
    mode: isMode(mode) ? mode : null,
    rail: isRail(rail) ? rail : null,
    sort: isSortKey(sort) ? sort : DEFAULT_SORT,
    reachable: one(sp.reachable) === "1",
    seeded: one(sp.seeded) === "1",
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    compare: cleanCompare(one(sp.compare).split(",").filter(Boolean)),
  };
}

/** Writes the list params onto `sp` (defaults are removed, unrelated params kept). */
export function writeListParams(sp: URLSearchParams, p: ListParams): void {
  const set = (k: string, v: string | null) => (v ? sp.set(k, v) : sp.delete(k));
  set("q", p.q || null);
  set("category", p.category ? CATEGORY_SLUG[p.category] : null);
  set("venue", p.venue);
  set("mode", p.mode);
  set("rail", p.rail);
  set("sort", p.sort === DEFAULT_SORT ? null : p.sort);
  set("reachable", p.reachable ? "1" : null);
  set("seeded", p.seeded ? "1" : null);
  set("page", p.page > 1 ? String(p.page) : null);
  set("compare", p.compare.length ? p.compare.join(",") : null);
}

export type FilterParams = Pick<
  ListParams,
  "q" | "category" | "venue" | "mode" | "rail" | "sort" | "reachable" | "seeded"
>;

/**
 * Identity of the filter set; the page number is reset whenever it changes.
 * Every facet has to be in here — a reader on page 4 who picks a venue would
 * otherwise stay on page 4 of a one-page result.
 */
export function filterKey(p: FilterParams): string {
  return [
    p.q,
    p.category ?? "",
    p.venue ?? "",
    p.mode ?? "",
    p.rail ?? "",
    p.sort,
    p.reachable ? 1 : 0,
    p.seeded ? 1 : 0,
  ].join(" ");
}

/** Every whitespace-separated token must occur in the (lower-cased) haystack. */
export function matchesQuery(haystack: string, q: string): boolean {
  if (!q) return true;
  const tokens = q.toLowerCase().split(" ").filter(Boolean);
  return tokens.every((t) => haystack.includes(t));
}

export function matchesReachable(row: LiteRow, reachable: boolean): boolean {
  return !reachable || isReachable(row.probe.word);
}

/** Which facet a count is being computed *for*; that facet is left out of the pass. */
export type FacetAxis = "category" | "venue" | "mode" | "rail";

export function matchesRow(
  row: LiteRow,
  haystack: string,
  p: Pick<FilterParams, "q" | "category" | "venue" | "mode" | "rail" | "reachable" | "seeded">,
  except?: FacetAxis,
): boolean {
  // Exactly one lane at a time: seeded rows only when asked for, chain rows only
  // when not. Nothing is ever mixed, so no synthetic number is ever ranked
  // against a real one in the same list.
  if (p.seeded !== (row.provenance === "demo")) return false;
  if (!matchesQuery(haystack, p.q)) return false;
  if (!matchesReachable(row, p.reachable)) return false;
  if (except !== "category" && p.category && row.category !== p.category) return false;
  if (except !== "venue" && p.venue && !matchesVenue(row.venue, p.venue)) return false;
  if (except !== "mode" && p.mode && row.mode !== p.mode) return false;
  if (except !== "rail" && p.rail && !row.rails.includes(p.rail)) return false;
  return true;
}

// ---------------------------------------------------------------- order

const SLOW = Number.MAX_SAFE_INTEGER;

/**
 * The default order, and the one the hero band is picked with. Every term is a
 * column the reader can see: how many of the four proof checks hold, then
 * whether it answers at all (an agent you can hire today outranks an equally
 * evidenced one that is down), then buyers who were not the operator (the `3rd`
 * proof word, which is where that term is visible now), then
 * settled jobs, then response time.
 */
export function evidenceCmp(a: LiteRow, b: LiteRow): number {
  const pa = proofOf(a);
  const pb = proofOf(b);
  return (
    pb.count - pa.count ||
    Number(pb.answers) - Number(pa.answers) ||
    b.commerceOutsideClients - a.commerceOutsideClients ||
    (b.commerce?.completed ?? 0) - (a.commerce?.completed ?? 0) ||
    (answeredLatency(a.probe) ?? SLOW) - (answeredLatency(b.probe) ?? SLOW)
  );
}

/**
 * Client-side sorts. Every one falls back to the evidence order for ties, so a
 * column with no value on 84% of the catalogue still degrades into something
 * ordered rather than into the array as it happened to arrive.
 *
 * Under a query the default sort leads with relevance: `matchesQuery` decides
 * whether a row matches, `queryScore` decides where it lands.
 */
export function sortRows(rows: readonly LiteRow[], sort: SortKey, q = ""): LiteRow[] {
  const out = [...rows];
  // A seeded row never outranks a chain row, whatever the sort: its numbers are
  // synthetic, so it can only ever be shown after the real ones.
  const lane = (a: LiteRow, b: LiteRow) =>
    Number(a.provenance === "demo") - Number(b.provenance === "demo");
  const query = q.toLowerCase();
  const tie = (a: LiteRow, b: LiteRow) => evidenceCmp(a, b) || a.name.localeCompare(b.name, "en", { sensitivity: "base" });
  switch (sort) {
    case "evidence":
      out.sort((a, b) => lane(a, b) || (query ? queryScore(b, query) - queryScore(a, query) : 0) || tie(a, b));
      break;
    case "jobs":
      out.sort((a, b) => lane(a, b) || (b.commerce?.completed ?? 0) - (a.commerce?.completed ?? 0) || tie(a, b));
      break;
    case "fast":
      out.sort((a, b) => lane(a, b) || (answeredLatency(a.probe) ?? SLOW) - (answeredLatency(b.probe) ?? SLOW) || tie(a, b));
      break;
    case "recent":
      out.sort((a, b) => lane(a, b) || (b.commerce?.lastCompletedAt ?? 0) - (a.commerce?.lastCompletedAt ?? 0) || tie(a, b));
      break;
    case "name":
      out.sort((a, b) => lane(a, b) || a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || evidenceCmp(a, b));
      break;
  }
  return out;
}

export interface Leads {
  /** Up to `n` rows, at most one per operator wallet. */
  rows: LiteRow[];
  /**
   * The first row the one-per-operator rule pushed down, and the row that kept
   * its place. Printed verbatim under the band header when it fires — a rule
   * that reorders the shop window has to say so.
   */
  displaced: { skipped: LiteRow; lead: LiteRow } | null;
}

/**
 * The band above the list. Picked by `evidenceCmp` — never by relevance, so a
 * name match with two em dashes cannot land in position one — and capped at one
 * agent per operator wallet: without the cap a single operator leads the whole
 * shop window, and a marketplace whose front row is one vendor is not one.
 */
export function pickLeads(rows: readonly LiteRow[], n = 3): Leads {
  const ranked = [...rows].filter((r) => r.provenance !== "demo").sort(evidenceCmp);
  const taken = new Map<string, LiteRow>();
  const out: LiteRow[] = [];
  let displaced: Leads["displaced"] = null;
  for (const row of ranked) {
    if (out.length >= n) break;
    const owner = row.owner.toLowerCase();
    const lead = taken.get(owner);
    if (lead) {
      if (!displaced) displaced = { skipped: row, lead };
      continue;
    }
    taken.set(owner, row);
    out.push(row);
  }
  return { rows: out, displaced };
}
