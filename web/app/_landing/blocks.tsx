// The DESIGN.md §6 visual blocks shared by the pages: the logo strip under the
// hero, the mockup frame (table slices, the captured 402, the quote terminal),
// the flow strip, the timeline, and the settled-job list on stock Items. Server
// components, safe to import from a client island; Beam is the one client
// child.
import { ArrowRight, ChevronDown, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { CountUp } from "@/components/count-up";
import { StatusWord } from "@/components/status-word";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { ExtLink } from "@/components/ext-link";
import { Logo, type LogoName } from "@/components/logo";
import { ChainTag } from "@/components/tag";
import { Beam } from "@/components/beam";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";
import { BlurFade } from "@/components/ui/blur-fade";
import { Marquee } from "@/components/ui/marquee";
import {
  DASH,
  agentHref,
  ago,
  canHire,
  explorerBase,
  firstSentence,
  fmtInt,
  fmtUAmount,
  hireHref,
  jobsTitle,
  metaLine,
  short,
  soldNote,
} from "@/lib/format";
import type { LiteRow, SettledJob } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EYEBROW } from "./ui";

/** The six sources the site reads from — its honest imagery (docs/marketplace/design.md §4). */
const SOURCES: ReadonlyArray<{ name: LogoName; label: string }> = [
  { name: "bnbchain", label: "BNB Chain" },
  { name: "bscscan", label: "BscScan" },
  { name: "pancakeswap", label: "PancakeSwap" },
  { name: "aave", label: "Aave" },
  { name: "venus", label: "Venus" },
  { name: "termix", label: "TermiX" },
];

/**
 * DESIGN.md §6 logo strip, as a Marquee: the official marks with their names,
 * the one loop the motion rules allow, paused under the pointer.
 */
export function LogoStrip() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
      <span className={cn("shrink-0", EYEBROW)}>Reads from</span>
      {/* `data-logo-strip` is the hook the reduced-motion block in globals.css
          uses: parked inside its own edge mask the strip clips, so under
          `reduce` the mask comes off, the repeats collapse to one and it wraps
          into a static row (DESIGN.md §9). */}
      <Marquee
        pauseOnHover
        data-logo-strip
        className="min-w-0 flex-1 mask-x-from-70% mask-x-to-100% [--duration:40s] [--gap:2rem]"
      >
        {SOURCES.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Logo name={s.name} size={20} />
            {s.label}
          </span>
        ))}
      </Marquee>
    </div>
  );
}

/**
 * DESIGN.md §6 mockup frame: a real component presented as a product shot —
 * a chrome bar with three dots and a title, then the live content. `beam` adds
 * the page's one BorderBeam, slow and brand-coloured at low opacity.
 */
export function MockupFrame({
  title,
  beam = false,
  className,
  children,
}: {
  title?: ReactNode;
  beam?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    // `shadow-2xl`, the one place a shadow is larger than `shadow-sm`: a mockup
    // is presented as an object over a backdrop, not as a card on the page
    // (DESIGN.md §3). Call sites do not pass a shadow.
    <div className={cn("relative overflow-hidden rounded-xl border bg-card shadow-2xl", className)}>
      <div className="flex items-center gap-1.5 border-b px-4 py-2.5">
        <span aria-hidden className="size-2.5 rounded-full bg-muted-foreground/30" />
        <span aria-hidden className="size-2.5 rounded-full bg-muted-foreground/30" />
        <span aria-hidden className="size-2.5 rounded-full bg-muted-foreground/30" />
        {title ? <span className="ml-2 min-w-0 truncate text-xs text-muted-foreground">{title}</span> : null}
      </div>
      {children}
      {beam ? <Beam colorFrom="var(--primary)" colorTo="transparent" className="opacity-70" duration={12} /> : null}
    </div>
  );
}

/**
 * One settled ERC-8183 job on a stock Item: id (with its BscScan link) · agent
 * · budget in U with the BNB Chain mark · when · chain; the self-hire caption
 * where it applies (docs/marketplace/design.md §5).
 */
function SettlementItem({ job, contract }: { job: SettledJob; contract: string | null }) {
  const base = explorerBase(job.chain);
  const href = job.tx ? `${base}/tx/${job.tx}` : contract ? `${base}/address/${contract}` : null;
  const budget = job.budgetU ? fmtUAmount(Number(job.budgetU)) : DASH;
  return (
    <Item className="px-0">
      <ItemMedia className="w-24 justify-start font-mono text-sm tabular-nums">
        {href ? (
          <ExtLink href={href} className="text-foreground">
            {`job ${job.jobId}`}
          </ExtLink>
        ) : (
          `job ${job.jobId}`
        )}
      </ItemMedia>
      <ItemContent>
        <ItemTitle className="text-base">
          {job.agent ? (
            <Link href={agentHref(job.agent)} className="transition-colors hover:underline hover:underline-offset-4">
              {job.agent.name}
            </Link>
          ) : (
            <ExtLink href={`${base}/address/${job.provider}`} className="font-mono text-sm text-foreground">
              {short(job.provider)}
            </ExtLink>
          )}
        </ItemTitle>
      </ItemContent>
      <ItemActions className="gap-4 font-mono text-sm tabular-nums">
        <span className="inline-flex items-center gap-1.5">
          <Logo name="bnbchain" size={16} />
          {budget}
        </span>
        <span className="text-muted-foreground">{job.completedAt ? ago(job.completedAt) : DASH}</span>
        <ChainTag chain={job.chain} />
      </ItemActions>
    </Item>
  );
}

/** The latest settled jobs, one Item each, on a stock ItemGroup with rules between. */
export function Settlements({
  jobs,
  contractOf,
}: {
  jobs: SettledJob[];
  contractOf: (chain: number) => string | null;
}) {
  return (
    <ItemGroup className="border-y">
      {jobs.map((j, i) => (
        <Fragment key={`${j.chain}:${j.jobId}`}>
          {i > 0 ? <ItemSeparator /> : null}
          <SettlementItem job={j} contract={contractOf(j.chain)} />
        </Fragment>
      ))}
    </ItemGroup>
  );
}

const FLOW: Record<3 | 4, { grid: string; arrow: string }> = {
  3: { grid: "md:grid-cols-3", arrow: "md:flex" },
  4: { grid: "sm:grid-cols-2 lg:grid-cols-4", arrow: "lg:flex" },
};

/**
 * DESIGN.md §6 flow strip: three or four steps side by side, each an icon tile
 * + title + one line, an ArrowRight between the columns once they sit in one
 * row (from `md` for three, `lg` for four).
 */
export function FlowStrip({
  steps,
  columns = 3,
}: {
  steps: Array<{ icon: LucideIcon; title: string; line: string }>;
  columns?: 3 | 4;
}) {
  const f = FLOW[columns];
  return (
    <ol className={cn("grid gap-4 md:gap-6", f.grid)}>
      {steps.map((s, i) => {
        const Icon = s.icon;
        return (
          <li key={s.title} className="flex items-start gap-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <Icon aria-hidden className="size-5" />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-base font-medium">{s.title}</span>
              <span className="text-sm text-muted-foreground">{s.line}</span>
            </div>
            {i < steps.length - 1 ? (
              <span className={cn("ml-auto hidden h-9 shrink-0 items-center", f.arrow)}>
                <ArrowRight aria-hidden className="size-4 text-muted-foreground" />
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export interface TimelineEvent {
  icon: LucideIcon;
  title: ReactNode;
  caption?: ReactNode;
  /** Short mono data on the right: an id, a hash, an address. */
  data?: ReactNode;
  /** Long mono data under the caption: a list of job ids. */
  below?: ReactNode;
  /** A BscScan / endpoint link on the right, under the data. */
  link?: { label: string; href: string };
  /** Anything else on the right, already styled — a state word with its link. */
  right?: ReactNode;
  /** A positive on-chain fact (a settled job) lights its node green. */
  tone?: "success";
  /** The event has not happened yet (no jobs, no feedback): a muted node and title. */
  muted?: boolean;
}

/**
 * DESIGN.md §6 timeline: a vertical rail, one icon node per event, title and
 * caption on the left, the mono data and the link on the right (under the
 * caption on a phone). The rail runs node to node, so the last event ends the
 * sequence rather than trailing into its own caption.
 */
export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="flex flex-col gap-6">
      {events.map((e, i) => {
        const Icon = e.icon;
        const hasRight = Boolean(e.right || e.data || e.link);
        return (
          <li key={i} className="relative flex gap-4">
            {i < events.length - 1 ? <span aria-hidden className="absolute top-8 -bottom-6 left-4 w-px bg-border" /> : null}
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full border bg-card",
                e.tone === "success" ? "text-success" : "text-muted-foreground",
              )}
            >
              <Icon aria-hidden className="size-4" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="flex min-w-0 flex-col gap-1">
                <p className={cn("text-sm font-medium [overflow-wrap:anywhere]", e.muted && "text-muted-foreground")}>
                  {e.title}
                </p>
                {e.caption ? <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{e.caption}</p> : null}
                {e.below ? (
                  <p className="font-mono text-sm text-muted-foreground tabular-nums [overflow-wrap:anywhere]">{e.below}</p>
                ) : null}
              </div>
              {hasRight ? (
                <div className="flex min-w-0 flex-col gap-1 sm:max-w-xs sm:shrink-0 sm:items-end sm:text-right">
                  {e.right ? <span className="font-mono text-sm whitespace-nowrap tabular-nums">{e.right}</span> : null}
                  {e.data ? (
                    <span className="font-mono text-sm text-muted-foreground tabular-nums [overflow-wrap:anywhere]">{e.data}</span>
                  ) : null}
                  {e.link ? (
                    <ExtLink href={e.link.href} className="text-sm whitespace-nowrap text-muted-foreground">
                      {e.link.label}
                    </ExtLink>
                  ) : null}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * DESIGN.md §6 card grid, the landing's Featured cards — the marketplace
 * pattern every app directory converges on (Zendesk, Intercom, Miro, Patreon,
 * Webflow all ship it): icon, name, one line, and **one figure a stranger can
 * check**, under a heading that says what got the item in.
 *
 * Here that figure is the evidence: how many jobs the agent has sold and
 * whether its endpoint answers. Both are the same fields the marketplace table
 * sorts on, so the section cannot drift from the catalogue behind it, and the
 * self-hire disclosure travels with the number exactly as it does in a row
 * (docs/marketplace/design.md §5).
 *
 * The card is a link, so its whole surface is the target; the action reads as a
 * button but is `aria-hidden` with no tab stop, because the card itself is
 * already the one focusable thing — the same rule the table row follows.
 */
export function FeaturedCard({ row }: { row: LiteRow }) {
  const settled = Boolean(row.commerce && row.commerce.completed > 0);
  const sold = settled && row.commerce ? fmtInt(row.commerce.completed) : DASH;
  const note = soldNote(row);
  const hire = canHire(row);
  const action = hire ? { text: "Hire", href: hireHref(row) } : { text: "Open", href: agentHref(row) };
  return (
    <Card className="group/card min-w-0 gap-4 transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-foreground/20 lg:row-span-4 lg:grid lg:grid-rows-subgrid">
      <CardHeader className="gap-3">
        {/* `min-w-0` at every level down to the truncating text: a grid item
            and a flex item both default to `min-width: auto`, so without it the
            longest agent name sets the card's width and the page scrolled
            sideways at `md`, where three cards share 704px. */}
        <div className="flex min-w-0 items-center gap-3">
          <Avatar image={row.image} owner={row.owner} id={row.id} size={40} />
          <div className="flex min-w-0 flex-col gap-1">
            {/* Wraps rather than truncates: the name is the one thing on the
                card that cannot be shortened, and the subgrid gives all three
                cards the taller title row when one of them needs it. */}
            <CardTitle className="min-w-0 text-base text-pretty">
              <Link href={agentHref(row)} className="after:absolute after:inset-0">
                {row.name}
              </Link>
            </CardTitle>
            {/* Budgeted, not truncated: three cards share 704px at `md`, where
                the full line does not fit and CSS would cut a fact in half. */}
            <span className="truncate text-xs text-muted-foreground">{metaLine(row, 34)}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* The budget is what fits two lines at the widest card and three at
            the narrowest, so the clamp is a safety net rather than the thing
            that does the cutting — CSS cuts mid-word, `firstSentence` does not.
            The subgrid keeps the three cards level whichever it is. */}
        <CardDescription className="line-clamp-3 text-pretty">
          {firstSentence(row.descriptionShort, 84)}
        </CardDescription>
      </CardContent>
      <CardContent>
        {/* `items-start`, not `items-end`: the self-hire disclosure adds a line
            to the left column on the rows that carry it, and bottom alignment
            pushed the neighbouring label down on exactly those cards. */}
        <dl className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-t pt-4">
          <div className="flex flex-col gap-1">
            <dt className={EYEBROW}>Sold</dt>
            <dd className="font-mono text-base tabular-nums" title={jobsTitle(settled)}>
              {sold}
            </dd>
            {/* No `whitespace-nowrap` here, unlike the 128px table column: two
                nowrap columns side by side set the card's min-content width and
                pushed the page sideways at `md`. */}
            {note ? (
              <dd className="text-xs text-muted-foreground" title={note.title}>
                {note.short}
              </dd>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-1">
            <dt className={EYEBROW}>Response</dt>
            <dd>
              <StatusWord probe={row.probe} />
            </dd>
          </div>
        </dl>
      </CardContent>
      <CardFooter className="mt-auto">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="group/action w-full"
          tabIndex={-1}
          aria-hidden
        >
          <span>
            {action.text}
            <ArrowRight aria-hidden className="transition-transform group-hover/card:translate-x-0.5" />
          </span>
        </Button>
      </CardFooter>
    </Card>
  );
}


/** The one thing at the bottom of the first screen: a hint that there is more. */
export function ScrollCue({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
      <span className={EYEBROW}>{label}</span>
      <ChevronDown aria-hidden className="animate-cue size-4" />
    </div>
  );
}

/**
 * DESIGN.md §6 stat band: the curation funnel as the section's whole screen.
 * Six figures at display size with the drop between them spelled out, because
 * the drop is the argument: the registry total against the listed total is the
 * one number pair that says what this site does. Every figure here, the section
 * heading above it, and the percentages between the steps are all read from the
 * data — the heading in particular, because a literal there drifts away from the
 * cell beneath it as ids are registered, and did.
 */
export function FunnelBand({
  cells,
}: {
  cells: Array<{ label: string; value: number; caption?: string; title?: string }>;
}) {
  return (
    <dl className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
      {cells.map((c, i) => {
        const prev = i > 0 ? cells[i - 1].value : null;
        const drop = prev && prev > 0 ? 1 - c.value / prev : null;
        // Stepped per cell (DESIGN.md §9): six figures arriving one after
        // another read as a sequence, which is what a funnel is.
        return (
          <BlurFade key={c.label} inView delay={i * 0.06} offset={16} blur="8px" className="flex flex-col gap-2">
            <dt className={EYEBROW}>{c.label}</dt>
            {/* The provenance rides on the figure it describes. */}
            <dd className="text-4xl font-semibold tracking-tight tabular-nums md:text-5xl" title={c.title}>
              <CountUp value={c.value} />
            </dd>
            <dd className="text-sm text-muted-foreground">
              {c.caption ??
                (drop !== null
                  ? `${drop >= 0.999 ? "−99.9" : `−${(drop * 100).toFixed(drop > 0.99 ? 1 : 0)}`}% from the step before`
                  : "every id on both registries")}
            </dd>
          </BlurFade>
        );
      })}
    </dl>
  );
}
