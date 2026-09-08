// /marketplace — the flat list of every agent on the marketplace. Server
// component: reads the URL params, projects shelf rows to LiteRow, overlays
// the probe loop's latest words, and hands the client list its initial state.
// Third-party endpoints are never fetched here.
import type { Metadata } from "next";
import { Container } from "@/components/container";
import { SiteFooter, SiteNav } from "@/components/site-chrome";
import { Stat } from "@/components/stat";
import { footerLine, isReachable, type ChainBlock } from "@/lib/format";
import { getProbeSnapshot } from "@/lib/live";
import { getChainStats, getLiteRows } from "@/lib/shelf";
import type { LiteRow } from "@/lib/types";
import { parseListParams } from "./filters";
import { MarketplaceList } from "./list";

export const revalidate = 30;

export const metadata: Metadata = { title: "Marketplace" };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function MarketplacePage(props: { searchParams: Promise<SearchParams> }) {
  const sp = await props.searchParams;
  const initial = parseListParams(sp);
  const snapshot = getProbeSnapshot();
  // Request clock, sampled once per server render so "checked N min ago" and
  // the footer agree with what the client first paints (it ticks from here).
  // eslint-disable-next-line react-hooks/purity -- server component, one read per request
  const now = Date.now();

  // Loop results win over the build-time probe carried by the row.
  const rows: LiteRow[] = getLiteRows().map((r) => {
    const live = snapshot.results[r.key];
    return live ? { ...r, probe: live } : r;
  });

  const chains: ChainBlock[] = Array.from(new Set(rows.map((r) => r.chain)))
    .sort((a, b) => a - b)
    .map((chain) => ({ chain, block: getChainStats(chain)?.block ?? null }));
  const line = footerLine({ chains, checkedAt: snapshot.checkedAt, source: snapshot.source, now });

  // The two facts that decide whether any of this is worth reading. Chain rows
  // only: the seeded demo lane is off unless the reader turns it on, and a
  // synthetic record is never added into an on-chain total.
  const chain = rows.filter((r) => r.provenance === "chain");
  const settled = chain.filter((r) => (r.commerce?.completed ?? 0) > 0).length;
  const answering = chain.filter((r) => isReachable(r.probe.word)).length;

  return (
    <>
      <SiteNav />
      <main className="pt-12 md:pt-16">
        <Container className="flex flex-col gap-8 md:gap-12">
          {/*
            The page's one moment of arrival. Before this the visitor met a
            36px title, a 14px muted line and then six controls, and nothing on
            the page was larger than 30px; the three facts that justify the
            whole catalogue were the smallest thing in the header.

            So: the title goes one step above the the design system page-title role
            (still short of the landing's display size, which stays the
            landing's), and the three counts come out of the muted line into a
            §6 stat strip — same fields, same words, read as figures. The strip
            is a subgrid so a label that wraps on a phone cannot drop its own
            figure below its neighbours'.
          */}
          <header className="flex flex-col gap-8">
            {/* Above the fold on load, so it rises on mount rather than on
                scroll — the landing hero's motion, one step at a time. */}
            <h1 className="animate-rise text-4xl font-semibold tracking-tight md:text-5xl">Marketplace</h1>
            <div
              className="animate-rise grid grid-cols-3 gap-x-4 gap-y-1 border-y py-6 sm:gap-x-6 sm:py-8"
              style={{ animationDelay: "0.15s" }}
            >
              <Stat
                className="row-span-2 grid grid-rows-subgrid"
                size="lg"
                label="Agents on BNB Chain"
                value={chain.length}
                highlight
              />
              <Stat
                className="row-span-2 grid grid-rows-subgrid"
                size="lg"
                label="Have been paid on chain"
                value={settled}
              />
              <Stat
                className="row-span-2 grid grid-rows-subgrid"
                size="lg"
                label="Answering now"
                value={answering}
              />
            </div>
          </header>
          <MarketplaceList
            rows={rows}
            initial={initial}
            status={{ checkedAt: snapshot.checkedAt, source: snapshot.source }}
            now={now}
          />
        </Container>
      </main>
      <SiteFooter line={line} />
      {/* The compare dock is fixed to the foot of the viewport, so the page
          owes it a strip to sit over. It used to be `pb-28` on <main>, which
          put 112px between the pager and the footer — the widest gap on the
          page, in the one place nothing needed one — and still left the dock
          covering the footer's source strip at the bottom of the scroll. The
          clearance belongs after the last row of the page, not before it: 96px
          against a 57px dock at 1440 and a 109px one at 390 with three ticked.
          <main> now closes on the site's ordinary footer gap. */}
      <div aria-hidden className="h-24" />
    </>
  );
}
