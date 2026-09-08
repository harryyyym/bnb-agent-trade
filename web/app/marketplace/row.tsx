"use client";

import { EYEBROW } from "@/app/_landing/ui";
import { ArrowDown, ArrowRight, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { EvidenceWord } from "@/components/evidence-word";
import { StatusWord } from "@/components/status-word";
import { chainTitle, SeededTag } from "@/components/tag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DASH,
  PROOF_ORDER,
  PROOF_TITLE,
  PROOF_WORD,
  agentHref,
  answeredLatency,
  soldNote,
  canHire,
  fmtInt,
  hireHref,
  jobsTitle,
  metaLine,
  proofOf,
  shortDescription,
} from "@/lib/format";
import type { LiteRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { COLUMN_SORT, type SortKey } from "./filters";

/*
 * The marketplace table (DESIGN.md §6 Table, docs/marketplace/design.md §3).
 *
 * Six columns from `xl`, every one of which varies; the widths live in the
 * <colgroup> below, the one place DESIGN.md §1.2 allows an arbitrary width, and
 * the Agent column takes what is left. Below `xl` the same cells become a
 * 12-column grid — tick and agent on the first line, proof / sold / response /
 * action on the next — so nothing overflows at 390px and no cell has to be a
 * zero-height line break. Every row is the same size, full stop: the band is
 * marked by the group header above the table and by nothing in the rows —
 * the three lead rows used to carry an extra 14px sentence, which made them
 * 24px taller and put a text size on the page that no other row had.
 *
 * The table elements keep explicit ARIA roles because their `display` changes
 * with the breakpoint, and Safari drops table semantics when it does.
 */

/** A body cell: a block in the stacked row below `xl`, a table cell above it. */
const CELL = "block p-0 whitespace-normal xl:table-cell xl:px-2 xl:py-4";

/** Column headers are the eyebrow role (DESIGN.md §4). */
const HEAD = `h-auto px-2 py-3 ${EYEBROW}`;

export type ColumnKey = keyof typeof COLUMN_SORT;

export interface SortState {
  sort: SortKey;
  onSort: (s: SortKey) => void;
}

/** `ANSWERS` becomes `Answers`, `3RD` becomes `3rd`: the proof words keep their names, in sentence case (DESIGN.md §4). */
function sentence(word: string): string {
  return word.charAt(0) + word.slice(1).toLowerCase();
}

function ListColumns({ pick }: { pick?: boolean }) {
  return (
    <colgroup>
      {pick ? <col className="w-[56px]" /> : null}
      <col />
      <col className="w-[216px]" />
      <col className="w-[128px]" />
      <col className="w-[160px]" />
      <col className="w-[112px]" />
    </colgroup>
  );
}

/**
 * A sortable column header: a button carrying `ArrowUpDown` where the column
 * can be sorted and is not, `ArrowUp` / `ArrowDown` in brand where it is — so
 * which columns sort, and which one the table is sorted by, are both readable
 * without opening the select. The `<th>` carries `aria-sort`.
 */
function SortHead({
  col,
  label,
  align,
  state,
}: {
  col: ColumnKey;
  label: string;
  align?: "right";
  state?: SortState;
}) {
  const target = COLUMN_SORT[col];
  const active = state?.sort === target.key;
  const Icon = active ? (target.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <TableHead
      role="columnheader"
      scope="col"
      aria-sort={state ? (active ? (target.dir === "asc" ? "ascending" : "descending") : "none") : undefined}
      className={cn(HEAD, align === "right" && "text-right")}
    >
      {state ? (
        <button
          type="button"
          onClick={() => state.onSort(target.key)}
          // The eyebrow role again: a <button> does not inherit text-transform.
          className={cn(
            "inline-flex items-center gap-1 tracking-wider uppercase transition-colors hover:text-foreground",
            active && "text-foreground",
          )}
        >
          {label}
          <Icon aria-hidden className={cn("size-3.5", active ? "text-primary" : "text-muted-foreground")} />
        </button>
      ) : (
        label
      )}
    </TableHead>
  );
}

/** Column labels above the list: real `<th>` with `aria-sort`, hidden where the row stacks. */
export function ListHeader({ pick, state, sticky }: { pick?: boolean; state?: SortState; sticky?: boolean }) {
  return (
    <TableHeader
      role="rowgroup"
      className={cn("hidden xl:table-header-group", sticky && "xl:sticky xl:top-16 xl:z-10 xl:bg-background")}
    >
      <TableRow role="row" className="hover:bg-transparent">
        {pick ? (
          <TableHead role="columnheader" scope="col" className={HEAD}>
            {/* A 56px column; the word is for assistive tech, as in the stock data table. */}
            <span className="sr-only">Compare</span>
          </TableHead>
        ) : null}
        <SortHead col="agent" label="Agent" state={state} />
        <SortHead col="proof" label="Proof" state={state} />
        <SortHead col="jobs" label="Sold" align="right" state={state} />
        <SortHead col="response" label="Response" align="right" state={state} />
        <TableHead role="columnheader" scope="col" className={HEAD}>
          <span className="sr-only">Action</span>
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}

/**
 * The stock Table with the marketplace's colgroup and header; rows go inside.
 * `inset` pads the first and last column (and the stacked rows) for a table
 * that sits inside a framed panel rather than on the page's own edge.
 */
export function ListTable({
  pick,
  state,
  sticky,
  inset,
  className,
  children,
}: {
  pick?: boolean;
  state?: SortState;
  sticky?: boolean;
  inset?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    // ui/table wraps itself in an `overflow-x-auto` container, which would become
    // the scrollport for the sticky header; the list opts out and lets the page
    // scroll — nothing is wider than the container from `xl`, and the row stacks below it.
    <div className={cn("[&_[data-slot=table-container]]:overflow-visible", className)}>
      <Table
        role="table"
        className={cn(
          "block xl:table xl:table-fixed",
          inset
            ? "[&_tr]:px-4 xl:[&_tr>*:first-child]:pl-4 xl:[&_tr>*:last-child]:pr-4"
            : "xl:[&_tr>*:first-child]:pl-0 xl:[&_tr>*:last-child]:pr-0",
        )}
      >
        <ListColumns pick={pick} />
        <ListHeader pick={pick} state={state} sticky={sticky} />
        <TableBody role="rowgroup" className="block xl:table-row-group">
          {children}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * `Health factor · Venus · Advise, you sign` — only the terms the row has. It
 * replaces the truncated description, which showed 46% of itself, cut
 * mid-word, on every row at every width; the full sentence survives in the
 * band, in the comparison panel and on the profile.
 */
/**
 * The proof cell: the four checks as their own names on outline badges, lit
 * where they hold and dimmed where they do not, with the evidence tier beneath.
 *
 * They are words, not marks, so the column needs no key at the top of the page
 * and no legend anywhere — each cell says what it is claiming. The tier word
 * under them carries the same fact at full contrast, so the dimmed state never
 * has to be read to understand the row.
 */
export function ProofCell({ row }: { row: LiteRow }) {
  const p = proofOf(row);
  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex flex-wrap gap-1">
        {PROOF_ORDER.map((k) => (
          <Badge
            key={k}
            variant="outline"
            title={`${PROOF_TITLE[k]}, ${p[k] ? "yes" : "no"}`}
            /*
             * The unlit state is a change of SHAPE, not of opacity. It used to
             * be `text-muted-foreground/50`, which measured 2.42:1 against the
             * page — a little over half the 4.5:1 it needs, and one of 59
             * contrast failures on this route that all came from opacity
             * modifiers layered on healthy tokens. DESIGN.md §3 says text
             * opacity is not a system; this is what it means in practice. A
             * word that holds is a bordered chip at full contrast; a word that
             * does not is plain muted text with no chip at all, which is
             * legible at 6.34:1 and still unmistakably the other state.
             */
            className={cn(!p[k] && "border-transparent px-0 text-muted-foreground")}
          >
            {sentence(PROOF_WORD[k])}
            {/* The dim state is the whole point of the cell, and dimness is not
                readable aloud: the answer goes into the accessible name too. */}
            <span className="sr-only">{p[k] ? ": yes." : ": no."}</span>
          </Badge>
        ))}
      </div>
      {/* The four words above describe the seeded record and are framed by the
          amber tag and the note on the row. The tier word is different: it names
          the chain, so on a seeded row it is replaced rather than qualified. */}
      {row.provenance === "demo" ? (
        <Badge
          variant="outline"
          className="border-warning/40 text-warning"
          title="Seeded record, nothing here was read from BNB Chain"
        >
          Seeded, not on chain
        </Badge>
      ) : (
        <EvidenceWord tier={row.tier} />
      )}
    </div>
  );
}

/**
 * One row. A `<Link>` cannot wrap a `<tr>`, so the agent name is the row's
 * single tab stop and its accessible name, and the row forwards a click on the
 * rest of itself to the same target — including the pointer gestures a link
 * would answer: cmd / ctrl / shift click and middle click open a new tab. The
 * action button is a real `<Link>`, `aria-hidden` and out of the tab order.
 */
export function Row({
  row,
  pick,
}: {
  row: LiteRow;
  /** A band row: the same size as every other, plus its first sentence. */
  pick?: { checked: boolean; onChange: (next: boolean) => void };
}) {
  const router = useRouter();
  const href = agentHref(row);
  const settled = Boolean(row.commerce && row.commerce.completed > 0);
  const jobs = settled && row.commerce ? fmtInt(row.commerce.completed) : DASH;
  const note = soldNote(row);
  const lat = answeredLatency(row.probe);
  const hire = canHire(row);
  const action = hire ? { text: "Hire", href: hireHref(row) } : { text: "Open", href };

  // A click on one of the row's own controls, or the mouse-up of a drag-selection,
  // is not the row being clicked.
  const fromRowBody = (e: MouseEvent<HTMLTableRowElement>) => {
    if (e.defaultPrevented) return false;
    if ((e.target as HTMLElement).closest("a, button, label, [role='checkbox']")) return false;
    const selection = window.getSelection();
    return !selection || selection.isCollapsed;
  };

  const openRow = (e: MouseEvent<HTMLTableRowElement>) => {
    if (!fromRowBody(e)) return;
    if (e.altKey) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey) {
      e.preventDefault();
      window.open(href, "_blank", "noopener");
      return;
    }
    router.push(href);
  };

  // React's onClick never fires for the middle button; without this the row
  // answers middle-click with the browser's autoscroll instead of a new tab.
  const auxOpenRow = (e: MouseEvent<HTMLTableRowElement>) => {
    if (e.button !== 1 || !fromRowBody(e)) return;
    e.preventDefault();
    window.open(href, "_blank", "noopener");
  };

  return (
    <TableRow
      role="row"
      onClick={openRow}
      onAuxClick={auxOpenRow}
      className="grid cursor-pointer grid-cols-12 items-center gap-x-3 gap-y-3 py-4 xl:table-row"
    >
      {pick ? (
        <TableCell role="cell" className={cn(CELL, "col-span-1")}>
          <Checkbox
            checked={pick.checked}
            onCheckedChange={(v) => pick.onChange(v === true)}
            aria-label={`Compare ${row.name}`}
          />
        </TableCell>
      ) : null}

      <TableCell role="cell" className={cn(CELL, pick ? "col-span-11" : "col-span-12")}>
        <div className="flex min-w-0 items-center gap-3">
          <Avatar image={row.image} owner={row.owner} id={row.id} size={32} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {/* Wraps where the row stacks — on a phone a name on two lines beats
                "Canned Health G…" — and truncates against the column where it is
                a table cell, so every row in the table keeps one height
                (DESIGN.md §6); the full name rides in the title. */}
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 xl:flex-nowrap">
              <Link href={href} title={row.name} className="min-w-0 max-w-full text-base font-medium xl:truncate">
                {row.name}
              </Link>
              {/* Never a chain on a seeded row: it is registered on none, so naming
                  one would be the single most misleading word on the page. */}
              {row.provenance === "demo" ? (
                <Badge variant="outline" className="text-muted-foreground" title="Not registered on any chain">
                  No chain
                </Badge>
              ) : null}
              {row.operator === "team" ? <Badge variant="outline">Built here</Badge> : null}
              {/* The one thing on a row a reader can act on without a wallet or a quote. */}
              {row.hasDemo ? (
                <Badge variant="secondary" title="Run this agent yourself on BSC testnet">
                  Live demo
                </Badge>
              ) : null}
              {row.provenance === "demo" ? <SeededTag /> : null}
            </div>
            {/* Wraps on a phone rather than truncating: CSS cuts a fact in
                half ("· Advise, you "), and a second line of 12px text costs
                less than half a fact. From `xl` the column is wide enough that
                it never wraps. */}
            <div
              className="text-xs text-pretty text-muted-foreground xl:truncate"
              title={row.provenance === "demo" ? undefined : chainTitle(row.chain)}
            >
              {metaLine(row)}
            </div>
            {/* The disclosure travels with the row, as the self-hire note does:
                a seeded row's figures are synthetic and must never be read as a
                record anyone can check. */}
            {row.provenance === "demo" && row.seededNote ? (
              <div className="text-xs text-muted-foreground" title={row.seededNote}>
                {shortDescription(row.seededNote, 108)}
              </div>
            ) : null}
          </div>
        </div>
      </TableCell>

      <TableCell role="cell" className={cn(CELL, "col-span-8 sm:col-span-5")}>
        <ProofCell row={row} />
      </TableCell>

      <TableCell role="cell" className={cn(CELL, "col-span-4 sm:col-span-2 xl:text-right")}>
        <div className="flex items-baseline gap-1.5 xl:justify-end">
          <span className="font-mono text-base tabular-nums" title={jobsTitle(settled)}>
            {jobs}
          </span>
          <span className="text-xs text-muted-foreground xl:hidden">sold</span>
        </div>
        {/* The self-hire disclosure rides with the number at every width, in
            the three-word form the 128px column has room for. Only the
            all-operator shape carries the sentence: on the mixed shape
            SELF_HIRE_NOTE would be false, so `soldNote` withholds it
            (docs/marketplace/design.md §5). `whitespace-nowrap` because the
            landing's framed table leaves the cell 83px at a 640px viewport,
            2px under the text. */}
        {note ? (
          <div className="text-xs whitespace-nowrap text-muted-foreground" title={note.title}>
            {note.short}
          </div>
        ) : null}
      </TableCell>

      <TableCell role="cell" className={cn(CELL, "col-span-8 sm:col-span-3 xl:text-right")}>
        <div className="flex flex-col gap-1 xl:items-end">
          {/* `no public endpoint` is the one word long enough to wrap; it may. */}
          <StatusWord probe={row.probe} className="whitespace-normal xl:text-right" />
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {lat === null ? DASH : `${fmtInt(lat)} ms`}
          </span>
        </div>
      </TableCell>

      <TableCell role="cell" className={cn(CELL, "col-span-4 justify-self-end sm:col-span-2")}>
        {/* A flex box, not `text-align: right`: the button is an inline-flex
            wider than the cell's content box was at 88px, and an overflowing
            inline-flex ignores text-align, so the framed landing tables lost
            their right inset and went ragged. */}
        <div className="flex xl:justify-end">
          {/* Not a brand fill: thirty yellow buttons down a page would spend the one
              highlight DESIGN.md §1.3 reserves. The word carries the difference —
              `Hire` at full contrast, `Open` on the grey ramp. */}
          <Button
            asChild
            variant="outline"
            size="sm"
            className={cn("group/action", !hire && "text-muted-foreground")}
          >
            <Link href={action.href} tabIndex={-1} aria-hidden>
              {action.text}
              <ArrowRight aria-hidden className="transition-transform group-hover/action:translate-x-0.5" />
            </Link>
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
