"use client";

import { EYEBROW } from "@/app/_landing/ui";
import { Columns3, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { Container } from "@/components/container";
import { tierLabel } from "@/components/evidence-word";
import { StatusWord } from "@/components/status-word";
import { Badge } from "@/components/ui/badge";
import { BlurFade } from "@/components/ui/blur-fade";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CATEGORY_LABEL } from "@/lib/categories";
import {
  DASH,
  RAIL_LABEL,
  agentHref,
  answeredLatency,
  buyersOf,
  canHire,
  chainLabel,
  firstSentence,
  fmtDate,
  fmtInt,
  fmtUAmount,
  hireHref,
  modeLabel,
  proofOf,
  statusWord,
} from "@/lib/format";
import type { LiteRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { COMPARE_MAX } from "./filters";

/** One comparison row: a label, one cell per agent, and the strings that decide whether they differ. */
interface Fact {
  label: string;
  title?: string;
  cells: ReactNode[];
  keys: string[];
}

function factsFor(rows: LiteRow[]): Fact[] {
  const mono = (v: string) => <span className="font-mono text-sm tabular-nums">{v}</span>;
  const text = (v: string) => <span className="text-sm">{v}</span>;

  const fact = (label: string, f: (r: LiteRow) => { node: ReactNode; key: string }, title?: string): Fact => {
    const made = rows.map(f);
    return { label, title, cells: made.map((m) => m.node), keys: made.map((m) => m.key) };
  };

  return [
    fact("What it does", (r) => {
      const s = firstSentence(r.descriptionShort, 150);
      return { node: text(s), key: s };
    }),
    fact("Allowed to", (r) => ({ node: text(modeLabel(r.mode)), key: modeLabel(r.mode) }), "the agent's declared mode"),
    fact("Venue", (r) => ({ node: text(r.venue ?? DASH), key: r.venue ?? DASH })),
    fact("Category", (r) => ({ node: text(CATEGORY_LABEL[r.category]), key: CATEGORY_LABEL[r.category] })),
    fact("Evidence", (r) => ({ node: text(tierLabel(r.tier)), key: r.tier })),
    fact(
      "Checks passed",
      (r) => {
        const p = proofOf(r);
        return { node: mono(`${p.count}/4`), key: String(p.count) };
      },
      "answers now · has been paid · paid by a third party · payment rail declared",
    ),
    fact("Jobs settled", (r) => {
      const n = r.commerce?.completed ?? 0;
      return { node: mono(n ? fmtInt(n) : DASH), key: String(n) };
    }),
    fact("Buyers", (r) => {
      const n = buyersOf(r);
      return { node: mono(fmtInt(n)), key: String(n ?? DASH) };
    }),
    fact("Third-party buyers", (r) => ({
      node: mono(r.commerce?.completed ? fmtInt(r.commerceOutsideClients) : DASH),
      key: r.commerce?.completed ? String(r.commerceOutsideClients) : DASH,
    })),
    // Keys are what the reader sees, not the raw field: two amounts that render
    // the same must not be marked as a difference, and vice versa.
    fact("Paid out", (r) => {
      const v = r.commerce?.completed ? fmtUAmount(r.commerce.completedVolumeU) : DASH;
      return { node: mono(v), key: v };
    }),
    fact("Last settled", (r) => {
      const t = r.commerce?.lastCompletedAt ?? null;
      const v = t ? fmtDate(t) : DASH;
      return { node: mono(v), key: v };
    }),
    fact("Answers now", (r) => ({ node: <StatusWord probe={r.probe} />, key: statusWord(r.probe).word })),
    fact("Response time", (r) => {
      const l = answeredLatency(r.probe);
      return { node: mono(l === null ? DASH : `${fmtInt(l)} ms`), key: l === null ? DASH : String(l) };
    }),
    fact("Endpoint host", (r) => ({
      node: <span className="font-mono text-sm break-all">{r.endpointHost || DASH}</span>,
      key: r.endpointHost || DASH,
    })),
    fact("Payment rails", (r) => {
      const v = r.rails.length ? r.rails.map((x) => RAIL_LABEL[x]).join(", ") : "none declared";
      return { node: text(v), key: v };
    }),
    fact(
      "Hire from here",
      (r) => {
        const v = canHire(r) ? "Yes, it answers and a rail is declared" : "No, open the profile instead";
        return { node: text(v), key: v };
      },
      "whether the profile can produce a signed quote or read 402 terms on demand",
    ),
    fact("Chain", (r) => ({ node: text(chainLabel(r.chain)), key: String(r.chain) })),
    fact(
      "Record",
      (r) => {
        const v = r.provenance === "demo" ? "Seeded, synthetic, not read from chain" : "Read from BNB Chain";
        return { node: text(v), key: v };
      },
      "where the numbers above come from",
    ),
    fact("Operator", (r) => {
      const v = r.operator === "team" ? "Built by this team" : "Third party";
      return { node: text(v), key: v };
    }),
    fact("Registry id", (r) => ({ node: mono(`#${r.id}`), key: `${r.chain}:${r.id}` })),
  ];
}

function allSame(keys: string[]): boolean {
  return keys.every((k) => k === keys[0]);
}

/**
 * The comparison panel: a stock bottom Sheet with agents as columns and twenty
 * facts as rows on a stock Table.
 *
 * The differencing is the design. Facts that differ sort to the top at full
 * contrast with a brand dot; facts that are identical fall below a labelled
 * rule, dimmed. On this catalogue two plausible candidates can share most of
 * their structured fields, so a panel that only listed them would send the
 * reader away no wiser — the useful sentence is *how few* of them are a real
 * choice, and the panel leads with it.
 */
/*
 * `open` is a prop, and the component stays mounted while it is false.
 *
 * Only the content: the `<Sheet>` Root and the `<SheetTrigger>` both live in
 * CompareDock. Radix restores focus on close to the trigger it holds a ref to,
 * and it can only hold that ref if the trigger is inside the same Root — this
 * used to render its own Root next to a plain button, so closing the panel
 * dropped a keyboard user on <body> at the top of the document.
 */
function ComparePanel({ rows }: { rows: LiteRow[] }) {
  const facts = factsFor(rows);
  const differ = facts.filter((f) => !allSame(f.keys));
  const same = facts.filter((f) => allSame(f.keys));

  return (
    <SheetContent side="bottom" className="max-h-5/6 gap-0 overflow-y-auto shadow-sm">
      <Container className="flex flex-col gap-6 py-2">
        <SheetHeader className="p-0">
          <SheetTitle>Compare</SheetTitle>
          <SheetDescription>
            {`${fmtInt(differ.length)} of ${fmtInt(facts.length)} facts differ`}
            {same.length
              ? ` · ${fmtInt(same.length)} identical ${same.length === 1 ? "fact is" : "facts are"} dimmed below`
              : null}
          </SheetDescription>
        </SheetHeader>

        <Table className="table-fixed">
          {/* Column widths: the one place an arbitrary width is allowed. The
              table scrolls sideways inside its own container when the
              agents do not fit. */}
          <colgroup>
            <col className="w-[160px]" />
            {rows.map((r) => (
              <col key={r.key} className="w-[240px]" />
            ))}
          </colgroup>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn("h-auto px-0 py-3 align-bottom", EYEBROW)}>
                Fact
              </TableHead>
              {rows.map((r) => (
                <TableHead key={r.key} className="h-auto px-3 py-3 align-bottom">
                  <div className="flex items-center gap-3">
                    <Avatar image={r.image} owner={r.owner} id={r.id} size={32} />
                    <Link href={agentHref(r)} className="truncate text-base font-medium">
                      {r.name}
                    </Link>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {differ.map((f) => (
              <FactRow key={f.label} fact={f} differs />
            ))}
            {same.length ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={rows.length + 1} className="px-0 py-4 whitespace-normal">
                  <div className="flex items-center gap-3">
                    <Separator className="flex-1" />
                    <span className="text-xs text-muted-foreground">
                      {`Identical on all ${fmtInt(rows.length)}, nothing to choose between here`}
                    </span>
                    <Separator className="flex-1" />
                  </div>
                </TableCell>
              </TableRow>
            ) : null}
            {same.map((f) => (
              <FactRow key={f.label} fact={f} />
            ))}
            <TableRow className="hover:bg-transparent">
              <TableCell className="px-0 py-4" />
              {rows.map((r) => (
                <TableCell key={r.key} className="px-3 py-4 align-top">
                  {/* The same rule as the list: `Hire` where the profile can
                      quote, `Open` on the grey ramp everywhere else. */}
                  <Button
                    href={canHire(r) ? hireHref(r) : agentHref(r)}
                    variant="outline"
                    size="sm"
                    className={cn(!canHire(r) && "text-muted-foreground")}
                  >
                    {canHire(r) ? "Hire" : "Open"}
                  </Button>
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </Container>
    </SheetContent>
  );
}

function FactRow({ fact, differs }: { fact: Fact; differs?: boolean }) {
  return (
    <TableRow className={cn("hover:bg-transparent", !differs && "text-muted-foreground")}>
      <TableHead scope="row" className="h-auto px-0 py-3 align-top text-sm font-normal whitespace-normal text-muted-foreground">
        <span className="inline-flex items-center gap-2" title={fact.title}>
          <span
            aria-hidden
            className={cn("size-1.5 shrink-0 rounded-full", differs ? "bg-primary" : "invisible")}
          />
          {fact.label}
        </span>
      </TableHead>
      {fact.cells.map((c, i) => (
        <TableCell key={i} className="px-3 py-3 align-top whitespace-normal">
          {c}
        </TableCell>
      ))}
    </TableRow>
  );
}

/**
 * The dock. Permanently at the foot of the marketplace, because it is also how
 * the reader finds out comparison exists: its resting state is not a label, it
 * is the instruction — "Tick up to three rows to put them side by side".
 *
 * The other place on this page motion is free (DESIGN.md §9 forbids it on the
 * table body, which re-renders on every filter; the dock does not). Each
 * ticked agent arrives with its own BlurFade, stepped, and the action cluster
 * re-enters when the second tick turns "Tick one more" into the button — the
 * one moment on the page where an act of the reader's produces a new control,
 * and it used to appear with no transition at all. The dock also lifts off the
 * page ground onto `--card` while it is holding a selection, so a docked
 * comparison is legible from the top of the viewport.
 */
export function CompareDock({
  rows,
  onRemove,
  onClear,
  onOpen,
  open,
}: {
  rows: LiteRow[];
  onRemove: (key: string) => void;
  onClear: () => void;
  onOpen: (v: boolean) => void;
  open: boolean;
}) {
  const picked = rows.length > 0;
  return (
    /* The Root wraps both the dock and the panel: the trigger has to be inside
       it for Radix to hand focus back when the sheet closes. */
    <Sheet open={open} onOpenChange={onOpen}>
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur transition-colors duration-300",
          picked ? "bg-card/90" : "bg-background/80",
        )}
      >
        <Container className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 py-2">
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Columns3 aria-hidden className="size-4 shrink-0" />
            {picked ? "Compare" : `Tick up to ${fmtInt(COMPARE_MAX)} rows to put them side by side`}
          </span>
          {picked ? (
            <>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {rows.map((r, i) => (
                  <BlurFade key={r.key} offset={20} delay={i * 0.05} className="min-w-0">
                    <Badge variant="secondary" className="max-w-56 gap-1 pr-1">
                      <span className="min-w-0 truncate">{r.name}</span>
                      <button
                        type="button"
                        onClick={() => onRemove(r.key)}
                        aria-label={`Remove ${r.name} from the comparison`}
                        className="rounded-full p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <X aria-hidden className="size-3" />
                      </button>
                    </Badge>
                  </BlurFade>
                ))}
              </div>
              {/* Keyed on which of the two shapes it is, so the switch at the
                  second tick remounts the wrapper and the new control enters
                  instead of appearing. */}
              <BlurFade key={rows.length >= 2 ? "go" : "one"} offset={20} className="ml-auto">
                <div className="flex items-center gap-2">
                  {rows.length >= 2 ? (
                    /*
                     * A real SheetTrigger, not a button that flips state. Radix
                     * restores focus on close to the trigger it holds a ref to;
                     * with a plain button there was no ref, so closing the panel
                     * dropped a keyboard user on <body> at the top of the page.
                     */
                    <SheetTrigger asChild>
                      <Button variant="default" size="sm">
                        {`Compare ${fmtInt(rows.length)}`}
                      </Button>
                    </SheetTrigger>
                  ) : (
                    <span className="text-sm text-muted-foreground">Tick one more to compare</span>
                  )}
                  <Button onClick={onClear} variant="ghost" size="sm">
                    Clear
                  </Button>
                </div>
              </BlurFade>
            </>
          ) : null}
        </Container>
      </div>
      {/* Mounted whenever there is something to compare; `open` drives the
          sheet, not the mount, so Radix closes it and hands focus back. */}
      {rows.length >= 2 ? <ComparePanel rows={rows} /> : null}
    </Sheet>
  );
}
