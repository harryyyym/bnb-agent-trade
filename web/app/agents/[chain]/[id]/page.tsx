// Agent profile — one agent (docs/marketplace/design.md §6). Server component;
// every number binds to the shelf row, shelf-stats or the probe snapshot;
// missing renders "—". Nothing here touches the network: third-party endpoints
// are read only by the probe loop and by the quote / x402 route handlers on
// explicit user action.
//
// No generateStaticParams on purpose: `next build` must never render these
// pages (hundreds of third-party rows). The first request renders, then the
// path is cached for `revalidate` seconds. Not force-dynamic — that would
// discard the revalidate window.
//
// Layout (DESIGN.md §5 section rhythm, §6 layout patterns). Three bands, 128px
// apart and 192px from `md`:
//
//   1. Identity and the facts band — the page's own first screen: the masked
//      grid and the brand glow behind a breadcrumb, an 80px avatar, the name at
//      display size, the badge row, one line and the actions, each rising on
//      mount 0.1s apart; then the four cells docs/marketplace/design.md §3
//      fixes, the two figures at the landing funnel's display size, counting up.
//   2. The reading column beside the Hire card, on a 3:2 grid so the card is a
//      450px panel rather than the 350px ribbon `lg:grid-cols-3` gave it, and
//      sticky from `lg` so the page's one action stays on screen instead of
//      leaving half a column empty beside the track record. In the column:
//      About, Endpoints as a code block, and **Track record** inside a
//      MockupFrame carrying the page's one BorderBeam — the section is the
//      anchor, because it is the only block whose content is read from the
//      contracts, so it gets the product shot.
//   3. On-chain details — twelve facts as two ruled columns rather than one
//      twelve-row table, which halves the height and reads as a spec sheet.
//
// Stock shadcn throughout; the timeline, the mockup frame, the code block and
// the step tile are DESIGN.md patterns composed here.
import {
  Activity,
  Coins,
  FileCheck,
  Fingerprint,
  FlaskConical,
  Handshake,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { HeroBackdrop } from "@/components/hero-rays";
import { Button } from "@/components/button";
import { CountUp } from "@/components/count-up";
import { tierLabel } from "@/components/evidence-word";
import { ExtLink } from "@/components/ext-link";
import { Logo } from "@/components/logo";
import { SiteFooter, SiteNav } from "@/components/site-chrome";
import { StatusChecked } from "@/components/status-checked";
import { StatusWord } from "@/components/status-word";
import { CategoryTag, ChainTag, RailChip, SeededTag } from "@/components/tag";
import { Badge } from "@/components/ui/badge";
import { BlurFade } from "@/components/ui/blur-fade";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CATEGORY_LABEL, CATEGORY_SLUG } from "@/lib/categories";
import {
  DASH,
  IDENTITY_REGISTRY,
  chainLabel,
  evidenceClass,
  evidenceWord,
  firstSentence,
  fmtDate,
  fmtDateTime,
  fmtInt,
  fmtUAmount,
  footerLine,
  hireSteps,
  isReachable,
  jobsTitle,
  links,
  parseAgentParams,
  railsOf,
  relTime,
  short,
  shortDescription,
  selfHireSentence,
} from "@/lib/format";
import { getProbeSnapshot, probeFor } from "@/lib/live";
import { getChainStats, getRow } from "@/lib/shelf";
import { DEMO_LAB_URL, demoLabHref, REPORT_URL } from "@/lib/site";
import type { ShelfRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MockupFrame, Timeline, type TimelineEvent } from "@/app/_landing/blocks";
import { Container, SectionHead, EYEBROW, StepNumber } from "@/app/_landing/ui";
import { QuotePanel } from "./quote-panel";

export const revalidate = 30;

type Props = { params: Promise<{ chain: string; id: string }> };

function load(chain: string, id: string): ShelfRow | null {
  const p = parseAgentParams(chain, id);
  return (p && getRow(p.chain, p.id)) || null;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { chain, id } = await props.params;
  const row = load(chain, id);
  if (!row) return { title: "Agent not found" };
  return { title: row.name, description: firstSentence(row.description, 160) };
}

// ---------------------------------------------------------------- pieces

// One step above the §4 page-title role and one below the landing's display:
// this page is one agent, and the name is the only thing on it that is the
// subject rather than a fact about the subject. `overflow-wrap` because the
// registry holds 33-character single-token names.
// The header rises on mount rather than on scroll, one element at a time — the
// landing hero's `animate-rise`, 28px of travel and a 10px blur (DESIGN.md §9),
// because this block is above the fold and BlurFade's inView never fires for it.
const HEADER_STEPS = ["0.05s", "0.15s", "0.25s", "0.35s", "0.45s", "0.6s"] as const;
/** The facts band closes the sequence, after the last header element. */
const BAND_STEP = "0.75s";

/** Which node an operator's evidence entry gets, by what its label says it is. */
function evidenceIcon(label: string): LucideIcon {
  const l = label.toLowerCase();
  if (/\bjob\b|settled|escrow|x402|\bpaid\b|pay-per|payment/.test(l)) return Coins;
  if (/verified|contract|source/.test(l)) return FileCheck;
  if (/drill|exercis|test/.test(l)) return FlaskConical;
  if (/mint|position|stake|transfer/.test(l)) return Coins;
  return FileCheck;
}

type DetailRow = { label: string; value: ReactNode; title?: string };

/**
 * Half of the On-chain details sheet: a ruled definition list, label left and
 * mono value right. Two of these side by side put twelve facts in six rows,
 * and keep the reading order down each column rather than across the pair.
 */
function DetailList({ rows }: { rows: DetailRow[] }) {
  return (
    <dl className="flex min-w-0 flex-col">
      {rows.map((r) => (
        <div
          key={r.label}
          className="flex flex-col gap-1 border-b py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
        >
          <dt className="shrink-0 text-sm text-muted-foreground">{r.label}</dt>
          <dd className="min-w-0 font-mono text-sm tabular-nums [overflow-wrap:anywhere] sm:text-right" title={r.title}>
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Definition rows for a small set of facts: label left, mono value right. */
function FactList({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="divide-y border-y">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-6 py-3 text-sm">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="text-right font-mono tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * One cell of the facts band (docs/marketplace/design.md §3). A figure takes
 * the display size the landing's funnel uses and counts up; a word — the status
 * and the evidence tier — stays at the size its own component reads at, because
 * the label is what carries the hierarchy (DESIGN.md §6 stat strip) and
 * `No public endpoint` at 48px would not fit a quarter of the container.
 */
function Fact({
  label,
  value,
  caption,
  title,
  word = false,
}: {
  label: string;
  value: ReactNode;
  caption?: ReactNode;
  title?: string;
  word?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2" title={title}>
      <dt className={EYEBROW}>{label}</dt>
      <dd className={word ? "text-lg font-medium md:text-xl" : "text-4xl font-semibold tracking-tight tabular-nums md:text-5xl"}>
        {value}
      </dd>
      {caption ? <dd className="text-sm text-muted-foreground">{caption}</dd> : null}
    </div>
  );
}

function metadataWords(scheme: string): string {
  if (scheme === "data") return "on chain, as a data: URI";
  if (scheme === "http") return "off chain, fetched over http";
  if (scheme === "ipfs") return "off chain, fetched from IPFS";
  return scheme || DASH;
}

const CATEGORY_SOURCE_TITLE = {
  declared: "declared, stated by the operator",
  curated: "curated, assigned by the published keyword rule",
  override: "override, set by hand, with a reason in the curation log",
} as const;

// ---------------------------------------------------------------- seeded profile

function pct(n: number): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
}

/**
 * The profile of a seeded row (agents/shelf/seeded.ts). A separate component
 * rather than conditionals threaded through AgentPage, for two reasons: the
 * real profile is built entirely out of chain links and facts a seeded row does
 * not have, and getting a conditional wrong there would put a dead BscScan link
 * or a false tier on one of the real agents.
 *
 * The rule this component exists to keep: the disclosure comes before the first
 * number, and nothing on the page links to a chain.
 */
function SeededProfile({ row, line }: { row: ShelfRow; line: string }) {
  const cm = row.commerce;
  const rec = row.record;
  return (
    <>
      <SiteNav />
      <main className="space-y-32 md:space-y-48">
        <section className="relative overflow-hidden pt-12 md:pt-16">
          <HeroBackdrop />
          <Container className="relative flex flex-col gap-12 md:gap-16">
            <div className="flex flex-col gap-6">
              <div className="animate-rise" style={{ animationDelay: HEADER_STEPS[0] }}>
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link href="/marketplace">Marketplace</Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link href="/marketplace?seeded=1">Seeded lane</Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{row.name}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>

              <div className="animate-rise" style={{ animationDelay: HEADER_STEPS[1] }}>
                <Avatar image={null} owner={row.name} id={row.id} size={80} />
              </div>
              <h1 className="animate-rise text-3xl font-semibold tracking-tight [overflow-wrap:anywhere] md:text-4xl" style={{ animationDelay: HEADER_STEPS[2] }}>
                {row.name}
              </h1>
              <div
                // No wrap: the metric-matched fallback face corrects heights, not
                // advance widths, so when Geist lands a row at a wrap boundary
                // re-flowed from two lines to one and everything below it jumped
                // 42px (CLS 0.29). A row that cannot wrap cannot shift.
                className="animate-rise flex flex-nowrap items-center gap-2 overflow-x-auto [scrollbar-width:none]"
                style={{ animationDelay: HEADER_STEPS[3] }}
              >
                <CategoryTag category={row.category} />
                <SeededTag />
              </div>
              <p
                className="animate-rise max-w-3xl text-lg text-muted-foreground [overflow-wrap:anywhere]"
                style={{ animationDelay: HEADER_STEPS[4] }}
              >
                {firstSentence(row.description, 140)}
              </p>
            </div>

            {/* Before any number on the page. Amber is the seeded lane's colour (DESIGN.md §1.4). */}
            <div
              className="animate-rise flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning/10 p-6 md:p-8"
              style={{ animationDelay: HEADER_STEPS[5] }}
            >
              <p className="flex items-center gap-2 text-xs font-medium tracking-wider text-warning uppercase">
                <FlaskConical aria-hidden className="size-4" />
                Seeded agent, not registered on any chain
              </p>
              <p className="max-w-3xl text-base">{row.seededNote}</p>
              {row.demonstrates ? (
                <p className="max-w-3xl text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Why it is here: </span>
                  {row.demonstrates}
                </p>
              ) : null}
            </div>
          </Container>
        </section>

        <section>
          <Container>
            <div className="grid gap-12 lg:grid-cols-5 lg:gap-12">
              <div className="flex min-w-0 flex-col gap-24 md:gap-32 lg:col-span-3">
                <BlurFade inView direction="up" offset={24} className="flex flex-col gap-6">
                  <SectionHead title="About" description="What this agent says it does" />
                  <p className="max-w-3xl text-base leading-relaxed [overflow-wrap:anywhere]">{row.description}</p>
                </BlurFade>

                {rec ? (
                  <BlurFade inView direction="up" offset={24} delay={0.05} className="flex flex-col gap-6">
                    <SectionHead
                      title="Record"
                      description="Synthetic. Shown in the shape the TermiX brief asks for: win rate, the window, and the risk taken to get there."
                    />
                    <FactList
                      rows={[
                        [
                          "window",
                          `${fmtDate(new Date(rec.window.from).getTime())} to ${fmtDate(new Date(rec.window.to).getTime())} · ${rec.window.days} days`,
                        ],
                        ["trades", fmtInt(rec.trades)],
                        ["win rate", `${rec.winRatePct.toFixed(0)}%`],
                        ["return", pct(rec.returnPct)],
                        ["max drawdown", `${rec.maxDrawdownPct.toFixed(1)}%`],
                        ["recovery", rec.recoveryDays === null ? DASH : `${rec.recoveryDays} days`],
                        [`benchmark, ${rec.benchmark.name}`, pct(rec.benchmark.returnPct)],
                      ]}
                    />
                    <p className="max-w-3xl text-sm text-muted-foreground">{rec.basis}</p>
                    <ul className="flex max-w-3xl flex-col gap-2">
                      {rec.notes.map((n) => (
                        <li key={n} className="text-sm text-muted-foreground">
                          {n}
                        </li>
                      ))}
                    </ul>
                  </BlurFade>
                ) : null}

                {row.dispute ? (
                  <BlurFade inView direction="up" offset={24} delay={0.1} className="flex flex-col gap-6">
                    <SectionHead
                      title="Disputes"
                      description="Synthetic. There has never been a dispute on ERC-8183 on BNB Chain."
                    />
                    <FactList
                      rows={[
                        ["jobs", fmtInt(row.dispute.jobs)],
                        ["disputed", fmtInt(row.dispute.disputed)],
                        ["resolved against the agent", fmtInt(row.dispute.resolvedAgainstAgent)],
                      ]}
                    />
                    <p className="max-w-3xl text-sm text-muted-foreground">{row.dispute.note}</p>
                  </BlurFade>
                ) : null}
              </div>

              <aside className="lg:sticky lg:top-24 lg:col-span-2 lg:self-start">
                <BlurFade inView direction="up" offset={24} delay={0.1}>
                  <Card className="shadow-sm">
                    <CardHeader className="gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-secondary">
                        <FlaskConical aria-hidden className="size-5 text-warning" />
                      </div>
                      <CardTitle className="text-lg">Seeded figures</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-6">
                      <FactList
                        rows={[
                          ["jobs settled", fmtInt(cm?.completed ?? 0)],
                          ["distinct buyers", fmtInt(cm?.clients ?? 0)],
                          ...(row.price
                            ? ([
                                ["price", `${row.price.amount} ${row.price.symbol} ${row.price.unit}`],
                              ] as Array<[string, ReactNode]>)
                            : []),
                          ["responds in", row.probe.latencyMs ? `${row.probe.latencyMs} ms` : DASH],
                        ]}
                      />
                      <p className="text-sm text-muted-foreground">
                        There is nothing to hire here and no chain record to check. Every figure on this page was
                        written by us.
                      </p>
                      <Button href="/marketplace" variant="default" size="lg" className="w-full">
                        Back to the real catalogue
                      </Button>
                    </CardContent>
                  </Card>
                </BlurFade>
              </aside>
            </div>
          </Container>
        </section>
      </main>
      <SiteFooter line={line} />
    </>
  );
}

// ---------------------------------------------------------------- page

export default async function AgentPage(props: Props) {
  const { chain, id } = await props.params;
  const row = load(chain, id);
  if (!row) notFound();

  // A seeded row has no owner, no wallet and no chain links, so it gets its own
  // page rather than a chain profile with every field blanked out.
  if (row.provenance === "demo") {
    const snap = getProbeSnapshot();
    // eslint-disable-next-line react-hooks/purity -- server component, one read per request
    const t = Date.now();
    return (
      <SeededProfile
        row={row}
        line={footerLine({ chains: [], checkedAt: snap.checkedAt, source: snap.source, now: t })}
      />
    );
  }

  // Server component, rendered once per request: one clock read keeps every
  // relative time on the page (facts strip, track record, footer) consistent.
  // eslint-disable-next-line react-hooks/purity -- not a re-rendering client component
  const now = Date.now();
  const snapshot = getProbeSnapshot();
  const probe = probeFor(row);
  const reachable = isReachable(probe.word);
  const evidence = evidenceWord(row.tier);
  const L = links(row);
  const rails = railsOf(row);
  const steps = hireSteps(row);
  const stats = getChainStats(row.chain);
  const team = row.team;
  const cm = row.commerce;
  const completed = cm?.completed ?? 0;
  const buyers = completed && cm ? cm.completedClients.length : 0;
  const skills = row.doc?.skills ?? [];
  const label = CATEGORY_LABEL[row.category];
  const sameWallet = !row.wallet || row.wallet.toLowerCase() === row.owner.toLowerCase();

  // Our own rows without an app link fall back to the settled-job evidence entry.
  const jobEvidence = team?.evidence.find((e) => /\bjob\s+\d+/i.test(e.label));
  const jobNo = jobEvidence?.label.match(/\bjob\s+(\d+)/i)?.[1];
  const settlementCovered =
    !team?.settlementTx || team.evidence.some((e) => e.url.toLowerCase().includes(team.settlementTx!.toLowerCase()));

  // The quote control below can produce a signed ERC-8183 quote or read 402
  // terms on demand, which is the one thing on this page that is actually
  // hiring. When it is there it is the page's primary and the header scrolls to
  // it; the marketplace's `Hire` is bound to exactly this condition, so the
  // word never lands somewhere that cannot do it.
  const canQuote = reachable && (rails.includes("erc8183") || rails.includes("x402"));
  // A runnable demo outranks a quote: a loop the reader runs in their own
  // wallet is what comes back; a signed quote is a promise of one.
  const demoHref = team?.demo && DEMO_LAB_URL ? demoLabHref(team.demo.path) : null;
  const headerPrimary = demoHref
    ? { text: "Run the live demo", href: demoHref }
    : canQuote
      ? { text: rails.includes("erc8183") ? "Request a quote" : "Check the price", href: "#hire" }
      : team?.app
        ? { text: "Open the dApp", href: team.app }
        : reachable && L.endpoint
          ? { text: "Open endpoint", href: L.endpoint }
          : jobEvidence && jobNo
            ? { text: `Job ${jobNo} on BscScan`, href: jobEvidence.url }
            : { text: "Registry record on BscScan", href: L.bscscan };
  const sidePrimary = team?.app
    ? { text: "Open the dApp", href: team.app }
    : reachable && L.endpoint
      ? { text: "Open endpoint", href: L.endpoint }
      : jobEvidence && jobNo
        ? { text: `Job ${jobNo} on BscScan`, href: jobEvidence.url }
        : { text: "Registry record on BscScan", href: L.bscscan };

  const endpointLine =
    probe.word === "no-public"
      ? rails.includes("erc8183")
        ? "not probed, hired through ERC-8183"
        : "not probed, no public endpoint"
      : null;

  const probeDetail =
    probe.word === "no-public"
      ? "not probed, no public endpoint"
      : [
          probe.code ? String(probe.code) : DASH,
          probe.latencyMs !== null && probe.latencyMs !== undefined ? `${fmtInt(probe.latencyMs)} ms` : DASH,
          probe.path ? `via ${probe.path}` : null,
          fmtDateTime(probe.checkedAt),
        ]
          .filter(Boolean)
          .join(", ");

  const price = team?.price ? `${team.price.amount} ${team.price.symbol} ${team.price.unit}` : DASH;
  const priceCaption = team?.price
    ? team.price.source
    : canQuote
      ? "not declared on chain, ask the agent for a signed quote below"
      : "not declared on chain";

  // The track record, top to bottom: settled jobs, the operator's evidence,
  // an x402 settlement not already among it, the endpoint, feedback, the
  // registry record. Every entry is a chain fact with its BscScan link.
  const events: TimelineEvent[] = [];
  if (completed && cm) {
    // A few ids sit on the right; a long list (thirty settled jobs) goes under
    // the caption, where it can wrap.
    const ids =
      cm.completedJobIds.length > 0
        ? `${cm.completedJobIds.length === 1 ? "job id" : "job ids"} ${cm.completedJobIds.join(", ")}`
        : undefined;
    const few = cm.completedJobIds.length <= 4;
    // Reads the buyers, not the flag: one listed agent has both an own-wallet
    // job and a real third-party buyer (docs/marketplace/design.md §5).
    const selfHire = selfHireSentence(row);
    events.push({
      icon: Coins,
      tone: "success",
      title: `${fmtInt(completed)} ${completed === 1 ? "job" : "jobs"} settled through ERC-8183 escrow`,
      caption: `${fmtUAmount(cm.completedVolumeU)} paid, ${fmtInt(cm.completedClients.length)} distinct ${
        cm.completedClients.length === 1 ? "buyer" : "buyers"
      }, last on ${fmtDate(cm.lastCompletedAt)}${selfHire ? `, ${selfHire}` : ""}`,
      data: few ? ids : undefined,
      below: few ? undefined : ids,
      link: { label: "BscScan", href: L.address(row.wallet || row.owner) },
    });
  } else {
    events.push({ icon: Coins, muted: true, title: "No settled jobs on the ERC-8183 commerce contract yet" });
  }
  for (const e of team?.evidence ?? []) {
    events.push({ icon: evidenceIcon(e.label), title: e.label, data: e.mono, link: { label: "BscScan", href: e.url } });
  }
  if (team?.settlementTx && !settlementCovered) {
    events.push({
      icon: Coins,
      title: `A paid call settled over x402 on ${chainLabel(row.chain)}`,
      data: short(team.settlementTx),
      link: { label: "BscScan", href: L.tx(team.settlementTx) },
    });
  }
  if (probe.word === "no-public") {
    events.push({
      icon: Activity,
      muted: true,
      title: "No public endpoint",
      caption: rails.includes("erc8183") ? "Hired through ERC-8183 only" : undefined,
    });
  } else {
    events.push({
      icon: Activity,
      title: (
        <span className="inline-flex flex-wrap items-center gap-2">
          Endpoint
          <StatusWord probe={probe} />
        </span>
      ),
      caption: snapshot.source === "loop" ? relTime(snapshot.checkedAt, now) : `checked ${fmtDateTime(probe.checkedAt)}`,
      link: reachable && L.endpoint ? { label: "Endpoint", href: L.endpoint } : undefined,
    });
  }
  if (row.reputation && row.reputation.count > 0) {
    events.push({
      icon: MessageSquare,
      title: `${fmtInt(row.reputation.count)} feedback ${row.reputation.count === 1 ? "entry" : "entries"} from ${fmtInt(
        row.reputation.clients,
      )} ${row.reputation.clients === 1 ? "client" : "clients"} on the ERC-8004 Reputation Registry`,
      link: stats?.reputation?.contract ? { label: "BscScan", href: L.address(stats.reputation.contract) } : undefined,
    });
  } else {
    events.push({ icon: MessageSquare, muted: true, title: "No feedback on the ERC-8004 Reputation Registry yet" });
  }
  events.push({
    icon: Fingerprint,
    title: `Registered on ERC-8004 as #${row.id}`,
    data: `owner ${short(row.owner)}`,
    link: { label: "BscScan", href: L.bscscan },
  });

  // Twelve facts, split down the middle rather than stacked: the pair of ruled
  // columns is half the height of the twelve-row table it replaces, and reads
  // as the spec sheet it is.
  const details: DetailRow[] = [
    { label: "Registry", value: <ExtLink href={L.registry}>{short(IDENTITY_REGISTRY[row.chain])}</ExtLink> },
    { label: "Token id", value: `#${row.id}` },
    {
      label: "Chain",
      value: `${chainLabel(row.chain)} (${row.chain})`,
      title: stats ? `read from ${chainLabel(row.chain)} ${row.chain} at block ${fmtInt(stats.block)}` : undefined,
    },
    { label: "Owner", value: <ExtLink href={L.owner}>{short(row.owner)}</ExtLink> },
    {
      label: "Agent wallet",
      value: sameWallet ? "same as owner" : <ExtLink href={L.wallet ?? L.address(row.wallet)}>{short(row.wallet)}</ExtLink>,
    },
    {
      label: "Endpoint host",
      value: `${row.endpointHost || DASH}${row.endpointTransient ? ", transient host" : ""}`,
      title: row.endpointTransient ? "tunnel hostname, may change between deployments" : undefined,
    },
    {
      label: "Category",
      value: `${label}, ${row.categorySource}`,
      title: CATEGORY_SOURCE_TITLE[row.categorySource],
    },
    {
      label: "Declared category",
      value: row.declaredCategory || DASH,
      title: "stated by the operator in its registration",
    },
    {
      label: "Declared trust",
      // The operator's own strings, verbatim and in the data role: one of them
      // is `CANNED_REFERENCE`, and set in prose ("declares ERC-8183,
      // CANNED_REFERENCE") it read as this site's constant leaking, not as a
      // value quoted from a registration.
      value:
        row.supportedTrust.length > 0 ? (
          <span className="font-mono text-sm">{row.supportedTrust.join(" · ")}</span>
        ) : (
          DASH
        ),
      title: "stated by the operator in its registration",
    },
    { label: "Metadata", value: metadataWords(row.metadataScheme) },
    {
      label: "Name",
      // Where the name came from, and the registered string where the listing
      // re-cased a slug into words (lib/format.ts `displayName`).
      value: (
        <>
          {row.nameSource === "agent-card" ? `from the agent card at ${row.endpointHost || DASH}` : "registered on chain"}
          {row.rawName ? (
            <>
              {" as "}
              <span className="font-mono text-sm">{row.rawName}</span>
            </>
          ) : null}
        </>
      ),
    },
    { label: "Probe", value: probeDetail },
  ];
  const half = Math.ceil(details.length / 2);

  return (
    <>
      <SiteNav />
      <main className="space-y-32 md:space-y-48">
        {/* 1 + 2 — identity and the facts band, over the masked grid and the
            brand glow. The two together are the page's first screen: who this
            is, and the four figures a buyer decides on. */}
        <section className="relative overflow-hidden pt-12 md:pt-16">
          <HeroBackdrop />
          <Container className="relative flex flex-col gap-12 md:gap-16">
            <div className="flex flex-col gap-6">
              <div className="animate-rise" style={{ animationDelay: HEADER_STEPS[0] }}>
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link href="/marketplace">Marketplace</Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link href={`/marketplace?category=${CATEGORY_SLUG[row.category]}`}>{label}</Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{row.name}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>

              {/* The avatar takes its own line rather than sitting beside the
                  name: at display size a 50-character name next to an 80px tile
                  wrapped to three lines inside the container, and the tile is
                  the one image the page has. */}
              <div className="animate-rise" style={{ animationDelay: HEADER_STEPS[1] }}>
                <Avatar image={row.image} owner={row.owner} id={row.id} size={80} />
              </div>
              <h1 className="animate-rise text-3xl font-semibold tracking-tight [overflow-wrap:anywhere] md:text-4xl" style={{ animationDelay: HEADER_STEPS[2] }}>
                {row.name}
              </h1>
              <div
                // No wrap: the metric-matched fallback face corrects heights, not
                // advance widths, so when Geist lands a row at a wrap boundary
                // re-flowed from two lines to one and everything below it jumped
                // 42px (CLS 0.29). A row that cannot wrap cannot shift.
                className="animate-rise flex flex-nowrap items-center gap-2 overflow-x-auto [scrollbar-width:none]"
                style={{ animationDelay: HEADER_STEPS[3] }}
              >
                <CategoryTag category={row.category} />
                <ChainTag chain={row.chain} />
                {row.operator === "team" ? <Badge variant="outline">Built here</Badge> : null}
                {demoHref ? (
                  <Badge variant="outline">
                    <FlaskConical aria-hidden />
                    Live demo
                  </Badge>
                ) : null}
              </div>
              <p
                className="animate-rise max-w-3xl text-lg text-muted-foreground [overflow-wrap:anywhere]"
                style={{ animationDelay: HEADER_STEPS[4] }}
              >
                {firstSentence(row.description, 140)}
              </p>
              {/* The one brand button on this page is in the Hire card, which is
                  where hiring happens (DESIGN.md §7, one `default` per view).
                  The header's lead action is the filled secondary, so the row
                  still has a first among four. */}
              <div className="animate-rise flex flex-wrap gap-3" style={{ animationDelay: HEADER_STEPS[5] }}>
                <Button href={headerPrimary.href} variant="secondary" size="lg">
                  {headerPrimary.text}
                </Button>
                {demoHref && canQuote ? (
                  <Button href="#hire" variant="outline" size="lg">
                    {rails.includes("erc8183") ? "Request a quote" : "Check the price"}
                  </Button>
                ) : null}
                {headerPrimary.href !== L.bscscan ? (
                  <Button href={L.bscscan} variant="outline" size="lg" icon={<Logo name="bscscan" size={16} />}>
                    BscScan
                  </Button>
                ) : null}
                <Button href={L.registry} variant="outline" size="lg">
                  Registry
                </Button>
              </div>
            </div>

            {/* Facts band (docs/marketplace/design.md §3): four cells, one grid,
                the figures at the display size the landing's funnel uses. */}
            <dl
              className="animate-rise grid grid-cols-2 gap-x-8 gap-y-12 rounded-xl border bg-card p-6 shadow-sm md:p-8 lg:grid-cols-4"
              style={{ animationDelay: BAND_STEP }}
            >
              <Fact
                label="Jobs settled"
                value={completed ? <CountUp value={completed} /> : DASH}
                caption={completed ? "on ERC-8183" : "none on file"}
                title={jobsTitle(completed > 0)}
              />
              <Fact
                label="Distinct buyers"
                value={buyers ? <CountUp value={buyers} /> : DASH}
                caption={selfHireSentence(row) ?? (completed ? "settled on chain" : "none on file")}
              />
              <Fact
                label="Status"
                word
                value={<StatusWord probe={probe} className="text-lg font-medium whitespace-normal md:text-xl" />}
                caption={endpointLine ?? <StatusChecked checkedAt={snapshot.checkedAt} source={snapshot.source} now={now} />}
              />
              <Fact
                label="Evidence"
                word
                value={
                  <span className={evidenceClass(evidence.tone)} title={evidence.title}>
                    {tierLabel(row.tier)}
                  </span>
                }
                caption="derived from chain and probe"
              />
            </dl>
          </Container>
        </section>

        {/* 2 — the reading column beside the one card that can hire it. A 3:2
            grid, so the card is a panel rather than the ribbon a third of the
            container gave it; 128 / 192px between the sections inside it, the
            same rhythm the page's own bands keep. */}
        <section>
          <Container>
            <div className="grid gap-12 lg:grid-cols-5 lg:gap-12">
              <div className="flex min-w-0 flex-col gap-24 md:gap-32 lg:col-span-3">
                {/* About — the one place prose may run long: the description as registered. */}
                <BlurFade inView direction="up" offset={24} className="flex flex-col gap-6">
                  <SectionHead title="About" />
                  <div className="flex flex-col gap-2">
                    <p className="max-w-3xl text-base leading-relaxed whitespace-pre-line [overflow-wrap:anywhere]">
                      {row.description}
                    </p>
                    <p className="text-xs text-muted-foreground">Description as registered on chain by the operator.</p>
                  </div>
                  {skills.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      <h3 className="text-lg font-semibold">
                        Capabilities <span className="text-sm font-normal text-muted-foreground">from its agent card</span>
                      </h3>
                      <div className="flex flex-wrap items-center gap-2">
                        {skills.slice(0, 12).map((s, i) => (
                          <Badge
                            key={`${s.name}-${i}`}
                            variant="secondary"
                            className="max-w-full"
                            title={s.description ? shortDescription(s.description, 160) : undefined}
                          >
                            <span className="min-w-0 truncate">{s.name}</span>
                          </Badge>
                        ))}
                        {skills.length > 12 ? (
                          <span className="text-xs text-muted-foreground">{fmtInt(skills.length - 12)} more in its agent card</span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </BlurFade>

                {row.services.length > 0 ? (
                  <BlurFade inView direction="up" offset={24} delay={0.05} className="flex flex-col gap-6">
                    <SectionHead title="Endpoints" description="From its registration" />
                    {/* DESIGN.md §6 code block: these are URLs, so they are set
                        as one, rather than as a hairline list of grey text. */}
                    <dl className="flex flex-col gap-3 rounded-lg border bg-secondary p-4 font-mono text-xs leading-relaxed">
                      {row.services.slice(0, 6).map((s, i) => {
                        const http = /^https?:\/\//i.test(s.endpoint);
                        return (
                          <div
                            key={`${s.name}-${i}`}
                            className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
                          >
                            <dt className="shrink-0 text-muted-foreground [overflow-wrap:anywhere]">{s.name}</dt>
                            <dd className="min-w-0 [overflow-wrap:anywhere] sm:text-right">
                              {http ? (
                                <ExtLink href={s.endpoint} className="text-foreground">
                                  {s.endpoint}
                                </ExtLink>
                              ) : (
                                s.endpoint.replace(/^onchain:/, "on-chain call, ")
                              )}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  </BlurFade>
                ) : null}

                {/* The anchor. The one block on the page whose content is read
                    from the contracts, so it gets the product shot: a mockup
                    frame carrying the page's one beam (DESIGN.md §6, §9). */}
                <BlurFade inView direction="up" offset={24} delay={0.05} className="flex flex-col gap-6">
                  <SectionHead
                    title="Track record"
                    description="What this agent has actually done on BNB Chain, read from the contracts."
                  />
                  <MockupFrame beam title={`${chainLabel(row.chain)} · ERC-8004 #${row.id}`}>
                    <div className="p-4 md:p-6">
                      <Timeline events={events} />
                    </div>
                  </MockupFrame>
                </BlurFade>
              </div>

              {/* Hire (docs/marketplace/design.md §6): rails, the two chain links, the
                  steps, price and custody, the demo lab, then the quote control —
                  the card's one primary, and the page's. A plain stack: nothing
                  here has a fixed height, so no block can run into the next.
                  Sticky from `lg`: the reading column is three sections long and
                  the card is one screen, so pinning it is what keeps the page's
                  one action on screen instead of leaving 500px of empty column
                  beside the track record. */}
              <aside className="lg:sticky lg:top-24 lg:col-span-2 lg:self-start">
                <BlurFade inView direction="up" offset={24} delay={0.1}>
                  <Card id="hire" className="gap-6 shadow-sm">
                    <CardHeader className="gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-secondary">
                        <Handshake aria-hidden className="size-5" />
                      </div>
                      <CardTitle className="text-lg">Hire</CardTitle>
                      <div className="flex flex-wrap gap-2">
                        {rails.length > 0 ? (
                          rails.map((r) => <RailChip key={r} rail={r} />)
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {reachable ? "Hiring rail not declared, use the endpoint" : "Hiring rail not declared"}
                          </span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-6">
                      <div className="flex flex-col gap-2">
                        <Button
                          href={sidePrimary.href}
                          variant={canQuote ? "outline" : "default"}
                          size="lg"
                          className="w-full"
                        >
                          {sidePrimary.text}
                        </Button>
                        {sidePrimary.href !== L.bscscan ? (
                          <Button href={L.bscscan} variant="outline" size="lg" className="w-full" icon={<Logo name="bscscan" size={16} />}>
                            View on BscScan
                          </Button>
                        ) : null}
                      </div>

                      <ol className="flex flex-col gap-3">
                        {steps.map((s, i) => (
                          <li key={s} className="flex items-start gap-3 text-sm">
                            <StepNumber n={i + 1} />
                            <span>{s}</span>
                          </li>
                        ))}
                      </ol>

                      <dl className="divide-y border-t">
                        <div className="flex flex-col gap-1 py-3">
                          <dt className={EYEBROW}>Price</dt>
                          <dd className="flex items-center gap-2 font-mono text-base tabular-nums">
                            {team?.price && /usdt/i.test(team.price.symbol) ? <Logo name="usdt" size={16} round /> : null}
                            {price}
                          </dd>
                          <dd className="text-xs text-muted-foreground">{priceCaption}</dd>
                        </div>
                        <div className="flex flex-col gap-1 py-3">
                          <dt className={EYEBROW}>Custody</dt>
                          <dd className="text-sm">{team?.custody ?? "Not declared by the operator."}</dd>
                        </div>
                      </dl>

                      {/* The strongest thing this page can offer: a loop the reader runs
                          themselves. The last line is the lab's isolation, as a promise. */}
                      {demoHref && team?.demo ? (
                        <div className="flex flex-col gap-3 rounded-lg bg-secondary p-4">
                          <p className={cn("flex items-center gap-2", EYEBROW)}>
                            <FlaskConical aria-hidden className="size-4" />
                            Try it before you hire it
                          </p>
                          <p className="text-sm">
                            Run the whole loop on BSC testnet in your own wallet: mint, supply, borrow, turn on
                            protection, then crash the price on your own position and watch the contract repay. You
                            keep the transaction hashes.
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Testnet only. We fund the gas. Nothing you do touches another visitor’s position.
                          </p>
                          <Button href={demoHref} variant="outline" size="lg" className="w-full">
                            Open the Demo Lab
                          </Button>
                        </div>
                      ) : null}

                      {canQuote ? <QuotePanel chain={row.chain} id={row.id} rails={rails} /> : null}

                      {row.operator !== "team" ? (
                        <p className="text-sm text-muted-foreground">
                          Listed from the public ERC-8004 registry. Not affiliated with this site.{" "}
                          <ExtLink href={REPORT_URL} className="text-foreground">
                            Report a listing
                          </ExtLink>
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                </BlurFade>
              </aside>
            </div>
          </Container>
        </section>

        {/* 3 — the spec sheet, full width: twelve facts as two ruled columns
            rather than one twelve-row table. */}
        <section>
          <Container>
            <BlurFade inView direction="up" offset={24} className="flex flex-col gap-6">
              <SectionHead title="On-chain details" description="Every field this listing was built from." />
              <div className="grid border-t lg:grid-cols-2 lg:gap-x-16 xl:gap-x-24">
                <DetailList rows={details.slice(0, half)} />
                <DetailList rows={details.slice(half)} />
              </div>
            </BlurFade>
          </Container>
        </section>
      </main>
      <SiteFooter
        line={footerLine({
          chain: row.chain,
          block: stats?.block,
          checkedAt: snapshot.checkedAt,
          source: snapshot.source,
          now,
        })}
      />
    </>
  );
}
