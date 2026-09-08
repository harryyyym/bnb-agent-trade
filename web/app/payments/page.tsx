// /payments — x402 pay per call. The captured 402 exchange is the page's anchor:
// it and the receipt it produced are one mockup frame across the fold, at the
// container's full width. Then the four steps on a surface, the tokens as cards,
// and every agent that takes x402 as one list, broken into its evidence bands
// under a display-size count.
import { ArrowLeftRight, Coins, PenLine, Receipt, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { HeroBackdrop } from "@/components/hero-rays";
import { CountUp } from "@/components/count-up";
import { tierLabel } from "@/components/evidence-word";
import { ExtLink } from "@/components/ext-link";
import { Logo } from "@/components/logo";
import { SiteFooter, SiteNav } from "@/components/site-chrome";
import { ChainTag, Chip } from "@/components/tag";
import { BlurFade } from "@/components/ui/blur-fade";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { chainLabel, evidenceWord, fmtInt, links, rowKey, short } from "@/lib/format";
import { probeFor } from "@/lib/live";
import type { ShelfRow, Tier } from "@/lib/types";
import { commerceChainsLabel, getPricedRow, getX402Rows, siteFooterLine } from "../_landing/data";
import { FlowStrip, MockupFrame } from "../_landing/blocks";
import { AgentRow, Container, EYEBROW, ListEnd, PageHead, SectionHead } from "../_landing/ui";

export const revalidate = 30;

export const metadata: Metadata = {
  title: "Payments",
  description:
    "Agents sell results over plain HTTP. The endpoint answers 402 with a price; you pay on BNB Chain; the settlement transaction is the receipt.",
};

// ---------------------------------------------------------------- pieces

/** One block of the captured exchange: the request or response, as it happened. */
function Exchange({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-1 px-6 py-6 md:px-8">{children}</div>;
}

/** One receipt field: label left, mono value right, an optional caption under the value. */
function ReceiptRow({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-3 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 flex-col items-end gap-1 text-right font-mono tabular-nums [overflow-wrap:anywhere]">
        {children}
        {note ? <span className="font-sans text-xs text-muted-foreground">{note}</span> : null}
      </dd>
    </div>
  );
}

/**
 * The x402 list, split where the evidence band changes. The order is the shelf's
 * own rank order and is never re-sorted — the walk only marks where a band
 * starts, which is how DESIGN.md §6 says a band is marked: a group header above
 * the rows and nothing different inside them.
 */
function bandsOf(rows: readonly ShelfRow[]): Array<{ tier: Tier; rows: ShelfRow[] }> {
  const out: Array<{ tier: Tier; rows: ShelfRow[] }> = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    if (last && last.tier === r.tier) last.rows.push(r);
    else out.push({ tier: r.tier, rows: [r] });
  }
  return out;
}

// ---------------------------------------------------------------- page

export default function PaymentsPage() {
  const priced = getPricedRow();
  const rows = getX402Rows();
  const l = priced ? links(priced.row) : null;
  const bands = bandsOf(rows);

  return (
    <>
      <SiteNav />
      {/*
        One idea per screen (DESIGN.md §6 section rhythm). The fold belongs to the
        artefact — a real HTTP 402 exchange and the receipt it produced — rather
        than to a band of four icon tiles; the steps that explain it follow.
      */}
      <main className="space-y-32 md:space-y-48">
        <section className="relative overflow-hidden pt-20 md:pt-28">
          <HeroBackdrop />
          <Container className="relative flex flex-col gap-12 md:gap-16">
            {/* Not BlurFade: the header plays before any scroll, so it rises on
                mount with 28px of travel (DESIGN.md §9). */}
            <div className="animate-rise" style={{ animationDelay: "0.05s" }}>
              <PageHead
                eyebrow="x402 pay per call"
                title="Payments"
                line="Agents sell results over plain HTTP. The endpoint answers 402 with a price; you pay on BNB Chain; the settlement transaction is the receipt."
              />
            </div>

            {priced && l ? (
              <div className="flex flex-col gap-8">
                <div className="animate-rise" style={{ animationDelay: "0.3s" }}>
                  <SectionHead
                    title="One paid call, captured"
                    description={priced.price.source}
                    aside={
                      <span className="inline-flex items-center gap-2">
                        <Avatar image={priced.row.image} owner={priced.row.owner} id={priced.row.id} size={32} />
                        {priced.row.name}
                        <ChainTag chain={priced.row.chain} />
                      </span>
                    }
                  />
                </div>
                {/* DESIGN.md §6 mockup frame, the fold's one large surface: the
                    exchange and the receipt it produced are a single product
                    shot at the container's full width, cropped by the fold, and
                    carry this page's one border beam. It rises on mount rather
                    than riding `HeroShowcase` — a scroll-linked `useTransform`
                    is stopped by none of the four reduced-motion mechanisms in
                    DESIGN.md §9, and left this frame tilted 22° at 45% opacity
                    for a visitor who asked for less motion (measured). */}
                <div className="animate-rise" style={{ animationDelay: "0.5s" }}>
                  <MockupFrame
                    beam
                    title={`${priced.row.name}, ${priced.price.rail}`}
                    className=""
                  >
                    <div className="grid lg:grid-cols-5">
                      <div className="divide-y font-mono text-xs leading-relaxed [overflow-wrap:anywhere] lg:col-span-3 lg:border-r">
                        <Exchange>
                          <p className="text-muted-foreground">GET /report</p>
                        </Exchange>
                        <Exchange>
                          <p className="text-destructive">402 Payment Required</p>
                          <p className="text-muted-foreground">
                            WWW-Authenticate: Payment {priced.price.amount} {priced.price.symbol} {priced.price.unit},{" "}
                            {priced.price.rail}
                          </p>
                        </Exchange>
                        <Exchange>
                          <p className="text-muted-foreground">GET /report</p>
                          <p className="text-muted-foreground">
                            client signs a Permit2 credential for {priced.price.amount} {priced.price.symbol}
                          </p>
                        </Exchange>
                        <Exchange>
                          <p className="text-success">200 OK + Payment-Receipt</p>
                          {priced.settlementTx ? (
                            <p>
                              <ExtLink href={l.tx(priced.settlementTx)} className="text-foreground">
                                settlement {short(priced.settlementTx)}
                              </ExtLink>
                            </p>
                          ) : null}
                        </Exchange>
                      </div>

                      <div className="flex flex-col gap-4 border-t px-6 py-6 lg:col-span-2 lg:border-t-0 lg:px-8">
                        <h3 className="text-lg font-semibold">Receipt</h3>
                        <dl className="divide-y">
                          <ReceiptRow label="Method">{priced.price.rail}</ReceiptRow>
                          <ReceiptRow label="Amount">
                            <span className="inline-flex items-center gap-2">
                              {/usdt/i.test(priced.price.symbol) ? <Logo name="usdt" size={16} round /> : null}
                              {priced.price.amount} {priced.price.symbol}
                            </span>
                          </ReceiptRow>
                          <ReceiptRow label="Recipient" note="the agent’s wallet">
                            <ExtLink href={l.address(priced.row.wallet)} className="text-foreground">
                              {short(priced.row.wallet)}
                            </ExtLink>
                          </ReceiptRow>
                          <ReceiptRow label="Chain">
                            {chainLabel(priced.row.chain)}, {priced.row.chain}
                          </ReceiptRow>
                          {priced.settlementTx ? (
                            <ReceiptRow label="Reference" note="the settlement transaction">
                              <ExtLink href={l.tx(priced.settlementTx)} className="text-foreground">
                                {short(priced.settlementTx)}
                              </ExtLink>
                            </ReceiptRow>
                          ) : null}
                        </dl>
                      </div>
                    </div>
                  </MockupFrame>
                </div>
              </div>
            ) : null}
          </Container>
        </section>

        <section>
          <Container>
            <BlurFade inView offset={24}>
              <SectionHead title="How a paid call works" />
              {/* The four steps on a surface: at 1152px a bare four-column strip
                  of 36px tiles reads as a hairline band, not as a step. */}
              <div className="mt-12 rounded-xl border bg-card px-6 py-8 shadow-sm md:px-8 md:py-10">
                <FlowStrip
                  columns={4}
                  steps={[
                    {
                      icon: ShieldAlert,
                      title: "Call the endpoint",
                      line: "It replies 402 Payment Required with the price, the token and the recipient wallet.",
                    },
                    {
                      icon: PenLine,
                      title: "Sign the payment",
                      line: "A Permit2 credential for exactly that amount, no approval transaction, no API key, no card.",
                    },
                    {
                      icon: ArrowLeftRight,
                      title: "The agent settles it",
                      line: "Your payment lands on BNB Chain from the credential; the result comes back with a receipt.",
                    },
                    {
                      icon: Receipt,
                      title: "Keep the receipt",
                      line: "It names the settlement transaction, so the invoice and the proof are the same thing.",
                    },
                  ]}
                />
              </div>
            </BlurFade>
          </Container>
        </section>

        <section>
          <Container>
            <BlurFade inView offset={24}>
              <SectionHead title="Tokens" />
              {/* One card per token, so the three chips are three objects on the
                  page instead of three lines of a paragraph. */}
              <div className="mt-12 grid gap-4 md:grid-cols-3 md:gap-6">
                <Card className="gap-4 md:row-span-2 md:grid md:grid-rows-subgrid">
                  <CardHeader>
                    <Chip icon={<Logo name="usdt" size={14} round />}>USDT</Chip>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Per-call payments over x402. Testnet agents quote TEST_USDT.
                    </p>
                  </CardContent>
                </Card>
                <Card className="gap-4 md:row-span-2 md:grid md:grid-rows-subgrid">
                  <CardHeader>
                    <Chip icon={<Coins className="size-3.5" />}>U</Chip>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {`The AgenticCommerce escrow token on ${commerceChainsLabel()}. Jobs are funded and paid out in U.`}
                    </p>
                  </CardContent>
                </Card>
                <Card className="gap-4 md:row-span-2 md:grid md:grid-rows-subgrid">
                  <CardHeader>
                    <Chip icon={<Logo name="bnb" size={14} round />}>BNB</Chip>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">Gas for every transaction on BNB Smart Chain.</p>
                  </CardContent>
                </Card>
              </div>
              <p className="mt-6 max-w-3xl text-xs text-muted-foreground">
                Scheme: x402 exact + Permit2 via @bnb-chain/mpp, b402-compatible, self-hosted settlement on BSC
                testnet. No payment processor or facilitator sits in the flow.
              </p>
            </BlurFade>
          </Container>
        </section>

        {rows.length > 0 ? (
          <section>
            <Container>
              <BlurFade inView offset={24}>
                <SectionHead
                  title="Agents that take x402"
                  aside={
                    // The count was a 14px line beside the heading; it is the
                    // one figure this section has, so it counts up at stat size
                    // (DESIGN.md §4 stat, §9 CountUp).
                    <span className="flex flex-col gap-1 sm:items-end">
                      <span className="text-3xl font-semibold tracking-tight text-foreground tabular-nums md:text-4xl">
                        <CountUp value={rows.length} />
                      </span>
                      <span>on this marketplace declare a paid endpoint</span>
                    </span>
                  }
                />
                {/* Column headers, then the rows in shelf order with a band
                    header wherever the evidence word changes: 54 identical rows
                    down 3,000px were the longest run on the site. */}
                <div className="mt-12">
                  {bands.map((band, i) => {
                    // Every row in a band shares its evidence word, and the jobs
                    // figure only exists where the band is the settled one — so
                    // the band header carries both, once, and the rows carry
                    // only what differs between them.
                    const settled = band.rows.some((r) => (r.commerce?.completed ?? 0) > 0);
                    return (
                      <div key={`${band.tier}-${i}`}>
                        {/* The band name sits in the Agent column's place and
                            the rest of the line labels that band's columns, from
                            `lg` where AgentRow switches to its column layout.
                            Widths match AgentRow's columns exactly. */}
                        <div className="flex items-end gap-4 pt-8 pb-3">
                          <span aria-hidden className="hidden w-10 shrink-0 lg:block" />
                          <h3
                            className={`flex flex-1 items-baseline gap-2 ${EYEBROW}`}
                            title={evidenceWord(band.tier).title}
                          >
                            {tierLabel(band.tier)}
                            <span className="font-mono tabular-nums">{fmtInt(band.rows.length)}</span>
                          </h3>
                          <span className={`hidden w-44 shrink-0 lg:block ${EYEBROW}`}>Category</span>
                          <span className={`hidden w-36 shrink-0 lg:block ${EYEBROW}`}>Response</span>
                          {/* The span is always there, labelled only where the
                              band has the figure: dropping it outright moved
                              Category and Response 96px right at the band
                              boundary while the rows below stayed put. */}
                          <span className={`hidden w-20 shrink-0 text-right lg:block ${EYEBROW}`}>
                            {settled ? "Jobs" : null}
                          </span>
                          <span aria-hidden className="hidden w-4 shrink-0 lg:block" />
                        </div>
                        {band.rows.map((r) => (
                          <AgentRow key={rowKey(r)} row={r} probe={probeFor(r)} evidence={false} jobs={settled} />
                        ))}
                      </div>
                    );
                  })}
                  <ListEnd />
                </div>
              </BlurFade>
            </Container>
          </section>
        ) : null}
      </main>
      <SiteFooter line={siteFooterLine()} />
    </>
  );
}
