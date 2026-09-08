"use client";

import { ArrowDownWideNarrow, FlaskConical, SearchX } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/button";
import { Pager } from "@/components/pager";
import { StatusChecked } from "@/components/status-checked";
import { BlurFade } from "@/components/ui/blur-fade";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { TRACK_ORDER } from "@/lib/categories";
import {
  MODE_ORDER,
  PROOF_RULE,
  RAIL_ORDER,
  VENUE_FACETS,
  fmtInt,
  searchText,
  type VenueKey,
} from "@/lib/format";
import { PAGE_SIZE } from "@/lib/site";
import type { Category, LiteRow, Mode, Rail } from "@/lib/types";
import {
  COMPARE_MAX,
  DEFAULT_SORT,
  SORTS,
  cleanQuery,
  filterKey,
  matchesRow,
  pickLeads,
  RESULTS_ID,
  sortRows,
  tabId,
  writeListParams,
  type ListParams,
  type SortKey,
} from "./filters";
import { CompareDock } from "./compare";
import { ListTable, Row } from "./row";
import { Toolbar } from "./toolbar";

const DEBOUNCE_MS = 150;

/** Counts every control shows, each computed against the filters already applied. */
export interface FacetCounts {
  category: Record<Category, number>;
  categoryTotal: number;
  venue: Record<VenueKey, number>;
  mode: Record<Mode, number>;
  rail: Record<Rail, number>;
  reachable: number;
  /** Rows in the seeded demo lane that the other filters would keep. */
  seeded: number;
}

/**
 * The marketplace list: search-first toolbar, an evidence band of at most three
 * rows, the table, the pager and the compare dock. State starts from the URL
 * (parsed on the server) and is written back with replaceState; no
 * useSearchParams anywhere in this tree. Filtering, ranking and comparison are
 * all local — the whole projection is already on the client.
 */
export function MarketplaceList({
  rows,
  initial,
  status,
  now,
}: {
  rows: LiteRow[];
  initial: ListParams;
  status: { checkedAt: string | null; source: "loop" | "build" };
  now: number;
}) {
  const [input, setInput] = useState(initial.q);
  const [q, setQ] = useState(initial.q);
  const [category, setCategory] = useState<Category | null>(initial.category);
  const [venue, setVenue] = useState<VenueKey | null>(initial.venue);
  const [mode, setMode] = useState<Mode | null>(initial.mode);
  const [rail, setRail] = useState<Rail | null>(initial.rail);
  const [sort, setSort] = useState<SortKey>(initial.sort);
  const [reachable, setReachable] = useState(initial.reachable);
  const [seeded, setSeeded] = useState(initial.seeded);
  const [compare, setCompare] = useState<string[]>(initial.compare);
  // A link that arrives with two or three agents already ticked opens straight
  // into the comparison — the landing's "Compare the top three" is one click,
  // and the reader never has to discover the checkbox first. (Radix's portal
  // only mounts on the client, so an open sheet renders nothing on the server.)
  const [compareOpen, setCompareOpen] = useState(() => initial.compare.length >= 2);
  // The page is bound to the filter set it was chosen under; a new filter set reads as page 1.
  const [pageState, setPageState] = useState({ page: initial.page, key: filterKey(initial) });
  const listRef = useRef<HTMLDivElement>(null);

  // Debounced search: the input is immediate, the query settles 150 ms later.
  useEffect(() => {
    const next = cleanQuery(input);
    const t = setTimeout(() => setQ((prev) => (prev === next ? prev : next)), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [input]);

  const haystacks = useMemo(() => rows.map(searchText), [rows]);

  const params = useMemo(
    () => ({ q, category, venue, mode, rail, reachable, seeded }),
    [q, category, venue, mode, rail, reachable, seeded],
  );

  /** Rows matching everything except one axis — the yield each of that axis's options would give. */
  const pass = useMemo(() => {
    const out: LiteRow[] = [];
    rows.forEach((r, i) => {
      if (matchesRow(r, haystacks[i], params)) out.push(r);
    });
    return out;
  }, [rows, haystacks, params]);

  const counts = useMemo<FacetCounts>(() => {
    const category = Object.fromEntries(TRACK_ORDER.map((k) => [k, 0])) as Record<Category, number>;
    const venueC = Object.fromEntries(VENUE_FACETS.map((f) => [f.key, 0])) as Record<VenueKey, number>;
    const modeC = Object.fromEntries(MODE_ORDER.map((m) => [m, 0])) as Record<Mode, number>;
    const railC = Object.fromEntries(RAIL_ORDER.map((r) => [r, 0])) as Record<Rail, number>;
    let categoryTotal = 0;
    let reachableN = 0;
    let seededN = 0;
    rows.forEach((r, i) => {
      const h = haystacks[i];
      if (matchesRow(r, h, params, "category")) {
        category[r.category] += 1;
        categoryTotal += 1;
      }
      if (matchesRow(r, h, params, "venue")) {
        for (const f of VENUE_FACETS) if (r.venue && f.match.test(r.venue)) venueC[f.key] += 1;
      }
      if (matchesRow(r, h, params, "mode") && r.mode) modeC[r.mode] += 1;
      if (matchesRow(r, h, params, "rail")) for (const x of r.rails) railC[x] += 1;
      if (matchesRow(r, h, { ...params, reachable: true })) reachableN += 1;
      if (matchesRow(r, h, { ...params, seeded: true })) seededN += 1;
    });
    return {
      category,
      categoryTotal,
      venue: venueC,
      mode: modeC,
      rail: railC,
      reachable: reachableN,
      seeded: seededN,
    };
  }, [rows, haystacks, params]);

  const sorted = useMemo(() => sortRows(pass, sort, q), [pass, sort, q]);

  // The band: at most three rows, at most one per operator wallet, always
  // picked by evidence — never by relevance, so a bare name match cannot land
  // in position one and read as a recommendation.
  const band = useMemo(
    () => (sort === DEFAULT_SORT && sorted.length > 3 ? pickLeads(sorted) : { rows: [], displaced: null }),
    [sorted, sort],
  );

  const ordered = useMemo(() => {
    if (!band.rows.length) return sorted;
    const lead = new Set(band.rows.map((r) => r.key));
    return [...band.rows, ...sorted.filter((r) => !lead.has(r.key))];
  }, [sorted, band]);

  const key = filterKey({ q, category, venue, mode, rail, sort, reachable, seeded });
  const pages = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));
  const page = Math.min(pageState.key === key ? pageState.page : 1, pages);
  const pageRows = ordered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const leads = page === 1 ? band.rows.length : 0;

  const chainCount = useMemo(() => rows.filter((r) => r.provenance === "chain").length, [rows]);
  const byKey = useMemo(() => new Map(rows.map((r) => [r.key, r] as const)), [rows]);
  const picked = useMemo(
    () => compare.map((k) => byKey.get(k)).filter((r): r is LiteRow => Boolean(r)),
    [compare, byKey],
  );

  // Mirror the state into the URL so the view — including a comparison — can be shared.
  useEffect(() => {
    const url = new URL(window.location.href);
    writeListParams(url.searchParams, { q, category, venue, mode, rail, sort, reachable, seeded, page, compare });
    const next = `${url.pathname}${url.search}${url.hash}`;
    const cur = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== cur) window.history.replaceState(null, "", next);
  }, [q, category, venue, mode, rail, sort, reachable, seeded, page, compare]);

  const goPage = (p: number) => {
    setPageState({ page: p, key });
    // Smooth is requested here rather than set globally on `html`, which would
    // break the router's scroll reset on every route change.
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    listRef.current?.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" });
  };

  const clear = () => {
    setInput("");
    setQ("");
    setCategory(null);
    setVenue(null);
    setMode(null);
    setRail(null);
    setReachable(false);
  };

  /** Ticking a fourth agent drops the one ticked longest ago — never a dead control. */
  const toggle = useCallback((k: string, on: boolean) => {
    setCompare((prev) => {
      if (!on) return prev.filter((x) => x !== k);
      if (prev.includes(k)) return prev;
      return [...prev, k].slice(-COMPARE_MAX);
    });
  }, []);

  const sortLabel = SORTS.find((s) => s.key === sort)?.label ?? "";
  const start = ordered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(ordered.length, page * PAGE_SIZE);
  const showing =
    ordered.length === 0
      ? "No agents"
      : `Showing ${fmtInt(start)}–${fmtInt(end)} of ${fmtInt(ordered.length)}`;
  const eyebrow =
    leads > 0
      ? q
        ? `Best evidenced of ${fmtInt(ordered.length)} matches`
        : `Top ${fmtInt(leads)} by evidence`
      : `Sorted by ${sortLabel}`;

  return (
    <div className="flex flex-col gap-6">
      <Toolbar
        input={input}
        onInput={setInput}
        total={seeded ? rows.length : chainCount}
        category={category}
        onCategory={setCategory}
        venue={venue}
        onVenue={setVenue}
        mode={mode}
        onMode={setMode}
        rail={rail}
        onRail={setRail}
        counts={counts}
        sort={sort}
        onSort={setSort}
        reachable={reachable}
        onReachable={setReachable}
        seeded={seeded}
        onSeeded={setSeeded}
      />

      {/* Seeded mode replaces the catalogue, and the page heading above still
          counts the chain one, so the swap has to announce itself. Unmissable
          and in plain words: a reader must never have to infer that a number
          on screen is invented. Amber is the demo lane's colour (DESIGN.md §1.4). */}
      {seeded ? (
        <div className="flex gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
          <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium tracking-wider text-warning uppercase">Seeded demonstration lane</p>
            <p className="max-w-3xl text-sm text-muted-foreground">
              These {fmtInt(rows.length - chainCount)} agents are not on BNB Chain and their records are
              invented. They exist because the real catalogue cannot exercise this marketplace: no agent
              registered on BNB Chain publishes a trading record, there has never been a dispute, and every
              agent that can be hired charges the same 0.001&nbsp;U. Each row says on its profile what is
              synthetic about it. Turn this off to go back to the {fmtInt(chainCount)} agents that are real.
            </p>
          </div>
        </div>
      ) : null}

      {/* role=tabpanel, not a bare div: the category triggers point their
          aria-controls here (there is no per-tab TabsContent — every tab
          filters this one list), and a `tab` has to control a `tabpanel`. */}
      <div
        ref={listRef}
        id={RESULTS_ID}
        role="tabpanel"
        aria-labelledby={tabId(category)}
        className="flex flex-col gap-6"
      >
        {/* The order, said out loud. A default sort a reader cannot explain is
            worse than no default: this one names its terms and its exceptions.

            It is a section head (DESIGN.md §6), not a caption: the group name
            at the sub-section role beside an icon tile, with the rule under it
            at secondary size. As a 12px uppercase eyebrow over 12px grey prose
            it was the quietest thing on a page whose whole argument it states,
            and it sat two hairlines away from the toolbar with nothing to say
            which side of the rule it belonged to. */}
        <BlurFade inView offset={24}>
          {/* `lg`, not `sm`: the count and the freshness line together are 370px
              and never shrink, so side by side at 640 they left the ordering
              rule a 200px column reading five words a line. */}
          <div className="flex flex-col gap-4 border-t pt-8 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
            {/* size-9 tile + gap-3 = a 48px text edge, so the count line below
                can pick it up with `pl-12` while the block is stacked. */}
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary"
              >
                <ArrowDownWideNarrow className="size-5 text-muted-foreground" />
              </span>
              <div className="flex flex-col gap-2">
                <h2 className="text-lg font-semibold">{eyebrow}</h2>
                {sort === DEFAULT_SORT ? <p className="max-w-3xl text-sm text-muted-foreground">{PROOF_RULE}</p> : null}
                {leads > 0 && band.displaced ? (
                  <p className="max-w-3xl text-sm text-muted-foreground">
                    {band.displaced.skipped.name} scores as high, but {band.displaced.lead.name} already leads for
                    that operator wallet, one lead per operator.
                  </p>
                ) : null}
              </div>
            </div>
            <span className="flex shrink-0 flex-wrap items-baseline gap-x-3 gap-y-1 pl-12 text-sm text-muted-foreground lg:pt-2 lg:pl-0">
              <span className="tabular-nums">{showing}</span>
              {/* The freshness line sits with the count, not in the toolbar: with
                  it there the sort control wrapped onto a line of its own. */}
              <StatusChecked checkedAt={status.checkedAt} source={status.source} now={now} className="text-xs" />
            </span>
          </div>
        </BlurFade>

        {ordered.length === 0 ? (
          // One of the two places on this page motion is free: nothing else is
          // on screen when it shows, and it does not re-render under a filter
          // the way the table body does. 24px of travel, not 6.
          <BlurFade offset={24}>
            <Empty className="border py-16">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchX aria-hidden />
                </EmptyMedia>
                <EmptyTitle>No agents match</EmptyTitle>
                <EmptyDescription>Try another word, or take the filters off.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" onClick={clear}>
                  Clear filters
                </Button>
              </EmptyContent>
            </Empty>
          </BlurFade>
        ) : (
          <ListTable pick sticky state={{ sort, onSort: setSort }} className="border-b">
            {pageRows.map((r) => (
              <Row
                key={r.key}
                row={r}
                pick={{ checked: compare.includes(r.key), onChange: (on) => toggle(r.key, on) }}
              />
            ))}
          </ListTable>
        )}
      </div>

      {ordered.length > 0 ? <Pager page={page} total={ordered.length} pageSize={PAGE_SIZE} onChange={goPage} /> : null}

      <CompareDock
        rows={picked}
        onRemove={(k) => toggle(k, false)}
        onClear={() => setCompare([])}
        open={compareOpen}
        onOpen={setCompareOpen}
      />
    </div>
  );
}
