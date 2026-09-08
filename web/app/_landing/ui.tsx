// Shared page primitives for the landing, hiring, payments and not-found pages
// Server components; the only client children
// are Avatar (image fallback), CountUp (inside Stat) and the stock Separator.
//
// Every primitive comes from components/ui as generated: Card for panels, Item
// for list rows, Separator for rules, Badge behind components/tag. Nothing here
// sets a size that is not on the the design system / §5 scales.
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { Container } from "@/components/container";
import { EvidenceWord } from "@/components/evidence-word";
import { SelfHireNote } from "@/components/self-hire-note";
import { Stat } from "@/components/stat";
import { StatusWord } from "@/components/status-word";
import { CategoryTag, ChainTag } from "@/components/tag";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { DASH, agentHref, firstSentence, fmtInt, jobsTitle, selfHireSentence, soldNote } from "@/lib/format";
import type { ProbeResult, ShelfRow } from "@/lib/types";
import { cn } from "@/lib/utils";

export { Container };

/** optional eyebrow · h1 · lead · optional actions row. */
export function PageHead({
  eyebrow,
  title,
  line,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  line?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {eyebrow ? (
        <span className={EYEBROW}>{eyebrow}</span>
      ) : null}
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
      {line ? <p className="max-w-2xl text-lg text-muted-foreground">{line}</p> : null}
      {actions ? <div className="flex flex-wrap gap-3 pt-2">{actions}</div> : null}
    </div>
  );
}

/**
 * h2 + description on the left, a secondary line
 * (`aside`) or a ghost action on the right. Content follows at `mt-6`.
 */
export function SectionHead({
  title,
  description,
  aside,
  action,
  size = "h2",
}: {
  title: string;
  description?: ReactNode;
  aside?: ReactNode;
  action?: ReactNode;
  size?: "h2" | "title";
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div className="flex flex-col gap-1">
        <h2 className={size === "h2" ? "text-2xl font-semibold tracking-tight" : "text-lg font-semibold"}>
          {title}
        </h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {aside ? <span className="text-sm text-muted-foreground sm:text-right">{aside}</span> : null}
      {action ?? null}
    </div>
  );
}

/** Closing rule under a list whose rows open with one. */
export function ListEnd() {
  return <Separator />;
}

/** for the pages that set it on a `<th>` or `<dt>`. */
export const EYEBROW = "text-xs font-medium tracking-wider text-muted-foreground uppercase";

/** A step number in a small tile — the one place a number is a badge. */
export function StepNumber({ n }: { n: number }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-muted-foreground tabular-nums">
      {n}
    </span>
  );
}

/**
 * Hiring rail card on the stock Card, one grid
 * row per region — header, blurb, steps, note — placed on the parent's subgrid
 * from `md`, so three cards in a row start their step
 * lists on the same line whatever the blurb length.
 */
export function RailCard({
  name,
  proto,
  blurb,
  steps,
  note,
  icon,
}: {
  name: string;
  proto: string;
  blurb: string;
  steps: readonly string[];
  note: string;
  icon?: ReactNode;
}) {
  return (
    <Card className="md:row-span-4 md:grid md:grid-rows-subgrid">
      <CardHeader>
        {icon ? (
          <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-secondary [&_svg]:size-5">
            {icon}
          </div>
        ) : null}
        <CardTitle className="text-lg">{name}</CardTitle>
        <CardDescription>{proto}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{blurb}</p>
      </CardContent>
      <CardContent>
        <ol className="flex flex-col gap-3">
          {steps.map((s, i) => (
            <li key={s} className="flex items-start gap-3 text-sm">
              <StepNumber n={i + 1} />
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </CardContent>
      <CardFooter className="self-end">
        <p className="text-xs text-muted-foreground">{note}</p>
      </CardFooter>
    </Card>
  );
}

/**
 * Numbered step in a list: number tile · title / detail · right-hand data, on
 * the stock Item. Opens with its own rule, so a list of them needs only a
 * closing <ListEnd />.
 */
export function StepRow({
  n,
  title,
  detail,
  right,
}: {
  n: number;
  title: string;
  detail: ReactNode;
  right?: ReactNode;
}) {
  return (
    <>
      <Separator />
      <Item className="px-0">
        <ItemMedia>
          <StepNumber n={n} />
        </ItemMedia>
        <ItemContent>
          <ItemTitle className="text-base">{title}</ItemTitle>
          <ItemDescription className="line-clamp-none max-w-2xl text-pretty">{detail}</ItemDescription>
        </ItemContent>
        {right !== undefined ? (
          <ItemActions className="basis-full pl-10 font-mono text-sm whitespace-nowrap tabular-nums sm:basis-auto sm:pl-0">
            {right}
          </ItemActions>
        ) : null}
      </Item>
    </>
  );
}

/**
 * Flat list row linking to a profile (the /payments list): avatar 40, name +
 * chain, first sentence; category, status, jobs and evidence to the right from
 * `md`, folded under the name below it. The whole row is one link, on the
 * stock Item (`asChild`), which gives it the hover ground for free.
 */
/**
 * One agent as a list row. `evidence` and `jobs` are opt-outs for a list that is
 * already grouped by them: /payments splits into evidence bands, and inside a
 * band both cells are the band header repeated on every row — 43 rows of the
 * same word and 39 of the same dash. Dropping the evidence cell hands its 144px
 * to the description, the one cell on the row that differs. The jobs cell keeps
 * its width when it is dropped, so the columns do not step sideways where one
 * band ends and the next begins.
 */
export function AgentRow({
  row,
  probe,
  evidence = true,
  jobs: showJobs = true,
}: {
  row: ShelfRow;
  probe: ProbeResult;
  evidence?: boolean;
  jobs?: boolean;
}) {
  const c = row.commerce;
  const settled = c && c.completed > 0;
  const jobs = settled ? fmtInt(c.completed) : DASH;
  // One owner for the disclosure: this surface
  // used to key the sentence off `commerceSelfHire` alone, which is false for
  // the one agent that has both an own-wallet job and a third-party buyer.
  const note = soldNote(row);
  const sentence = selfHireSentence(row);
  const title = (settled && sentence) || jobsTitle(Boolean(settled));
  return (
    <>
      <Separator />
      <Item asChild className="px-0">
        <Link href={agentHref(row)}>
          <ItemMedia>
            <Avatar image={row.image} owner={row.owner} id={row.id} size={40} />
          </ItemMedia>
          <ItemContent>
            <ItemTitle className="text-base">
              {row.name}
              <ChainTag chain={row.chain} />
            </ItemTitle>
            {/* The budget is the width the cell actually has: a longer string
                gets a CSS ellipsis instead, and CSS cuts mid-word. Two lines,
                not one, so the narrow widths where the budget no longer fits on
                one line wrap at a space instead of being cut at a letter. */}
            <ItemDescription className="line-clamp-2 text-pretty">
              {firstSentence(row.description, evidence ? 60 : 78)}
            </ItemDescription>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 lg:hidden">
              <CategoryTag category={row.category} />
              <StatusWord probe={probe} />
              {evidence ? <EvidenceWord tier={row.tier} /> : null}
              {showJobs ? (
                <span className="text-sm tabular-nums">
                  <span className="text-muted-foreground">Jobs settled </span>
                  <span title={title}>{jobs}</span>
                </span>
              ) : null}
              {settled && sentence ? <SelfHireNote className="basis-full">{sentence}</SelfHireNote> : null}
            </div>
          </ItemContent>
          <ItemActions className="hidden lg:flex lg:gap-4">
            <span className="w-44 shrink-0">
              <CategoryTag category={row.category} />
            </span>
            <span className="w-36 shrink-0">
              <StatusWord probe={probe} />
            </span>
            <span className="flex w-20 shrink-0 flex-col items-end font-mono text-base tabular-nums">
              {showJobs ? <span title={title}>{jobs}</span> : null}
              {/* Three words in an 80px column; the sentence rides in the title
                  where it is true. */}
              {showJobs && note ? (
                <span className="font-sans text-xs whitespace-nowrap text-muted-foreground" title={note.title}>
                  {note.short}
                </span>
              ) : null}
            </span>
            {evidence ? (
              <span className="w-36 shrink-0">
                <EvidenceWord tier={row.tier} />
              </span>
            ) : null}
            <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
          </ItemActions>
        </Link>
      </Item>
    </>
  );
}

/**
 * The curation funnel: six stat cells on one
 * equal-column grid, from every id registered on BNB
 * Chain down to the ones a stranger has actually paid for. Every value is a
 * number, so every one counts up (`Stat`); provenance rides the cell's `title`.
 */
export function FunnelStrip({
  cells,
}: {
  cells: Array<{ label: string; value: number; title?: string; caption?: ReactNode }>;
}) {
  return (
    <div className="grid grid-cols-2 gap-6 border-y py-8 sm:grid-cols-3 lg:grid-cols-6">
      {cells.map((c) => (
        <div key={c.label} title={c.title}>
          <Stat label={c.label} value={c.value} caption={c.caption} />
        </div>
      ))}
    </div>
  );
}

/**
 * A "How hiring works" card on the stock Card:
 * icon tile + step eyebrow and title, one-sentence claim, one real artefact
 * (`vignette`, a mono code block on a secondary ground), then bound counts in
 * the footer. Each card is a subgrid of its parent's rows, so three siblings keep their claims, artefacts and footers on the same
 * lines whatever the length of the claim.
 */
export function HiringCard({
  n,
  title,
  claim,
  icon,
  vignette,
  facts,
}: {
  n: number;
  title: string;
  claim: string;
  /** CreditCard, KeyRound, PackageCheck. */
  icon: ReactNode;
  vignette: ReactNode;
  facts: Array<{ label: string; value: ReactNode; title?: string }>;
}) {
  return (
    <Card className="md:grid md:grid-rows-subgrid md:row-span-4">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-secondary [&_svg]:size-5">{icon}</div>
          <span className={EYEBROW}>Step {n}</span>
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{claim}</p>
      </CardContent>
      <CardContent>
        <div className="rounded-lg border bg-secondary p-4 font-mono text-xs leading-relaxed">{vignette}</div>
      </CardContent>
      <CardFooter>
        <dl className="w-full divide-y">
          {facts.map((f) => (
            <div key={f.label} className="flex items-baseline justify-between gap-3 py-2 text-sm">
              <dt className="text-muted-foreground">{f.label}</dt>
              <dd className="text-right font-mono tabular-nums" title={f.title}>
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
      </CardFooter>
    </Card>
  );
}
