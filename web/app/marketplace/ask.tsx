"use client";

// The ask box: a visitor says what they need in their own words, and the page
// answers with what the shelf holds for that kind of work before it shows a
// single row.
//
// The matching is `matchIntent` (lib/intents.ts): keyword scoring over the four
// official categories, so the same question always reaches the same answer and
// the whole vocabulary is readable in one file. The answer's numbers arrive
// from the server as props; this component chooses which set to render and
// never computes a figure of its own.
import { ArrowRight, CornerDownLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CATEGORY_SLUG } from "@/lib/categories";
import { agentHref, fmtInt, fmtUAmount } from "@/lib/format";
import { matchIntent } from "@/lib/intents";
import { RESULTS_ID } from "./filters";
import type { Ask, AskDenominator, AskRow } from "@/lib/ask";
import { cn } from "@/lib/utils";

/** Rotating placeholder, so the box teaches what it can be asked. */
const ROTATE_MS = 4200;

function rowsHref(ask: Ask): string {
  return `/marketplace?category=${CATEGORY_SLUG[ask.category]}#${RESULTS_ID}`;
}

/** One named agent inside an answer: the link, then the facts the sentence uses. */
function Named({ row, suffix }: { row: AskRow; suffix: string }) {
  return (
    <>
      <Link href={agentHref(row)} className="font-medium underline underline-offset-4 hover:text-primary">
        {row.name}
      </Link>
      {suffix}
    </>
  );
}

function Answer({ ask, denominator }: { ask: Ask; denominator: AskDenominator }) {
  const { top, live } = ask;
  return (
    <div className="flex flex-col gap-4 border-t pt-6 text-base leading-relaxed">
      <p>
        <span className="text-muted-foreground">Of </span>
        {fmtInt(denominator.registered)}
        <span className="text-muted-foreground"> registered identities on chains 56 and 97, </span>
        {fmtInt(denominator.eligible)}
        <span className="text-muted-foreground"> passed the published rules and </span>
        {fmtInt(denominator.shelved)}
        <span className="text-muted-foreground"> are on the shelf.</span>
      </p>

      <p>
        <span className="text-muted-foreground">That work is </span>
        <span className="font-medium">{ask.category}</span>
        <span className="text-muted-foreground">, a category holding </span>
        {fmtInt(ask.shelved)}
        <span className="text-muted-foreground"> agents. </span>
        <span className="font-medium">{fmtInt(ask.settled)}</span>
        <span className="text-muted-foreground"> have settled a paid job on chain, </span>
        <span className="font-medium">{fmtInt(ask.outsidePaid)}</span>
        <span className="text-muted-foreground"> of those were paid by a buyer other than the operator, and </span>
        <span className="font-medium">{fmtInt(ask.answering)}</span>
        <span className="text-muted-foreground"> answer their endpoint right now.</span>
      </p>

      {top ? (
        <p>
          <span className="text-muted-foreground">Most settled: </span>
          <Named
            row={top}
            suffix={`, ${fmtInt(top.jobs)} ${top.jobs === 1 ? "job" : "jobs"}${
              top.volumeU !== null ? `, ${fmtUAmount(top.volumeU)}` : ""
            }`}
          />
          <span className="text-muted-foreground">
            {top.outside > 0
              ? `, ${fmtInt(top.outside)} of its buyers ${top.outside === 1 ? "was" : "were"} not the operator`
              : ", every buyer so far is the operator's own wallet"}
          </span>
          <span className="text-muted-foreground">
            {top.answers ? ". Its endpoint answered the last probe." : ". Its endpoint did not answer the last probe."}
          </span>
        </p>
      ) : (
        <p className="text-muted-foreground">
          Nothing in this category has been paid on chain yet, so the ranking rests on whether an endpoint answers.
        </p>
      )}

      {live ? (
        <p>
          <span className="text-muted-foreground">Settled and answering: </span>
          <Named row={live} suffix={`, ${fmtInt(live.jobs)} ${live.jobs === 1 ? "job" : "jobs"}`} />
          <span className="text-muted-foreground">
            {live.selfHire
              ? ", though every buyer so far is the operator's own wallet, so it shows the flow works rather than that anyone bought it"
              : `, paid by ${fmtInt(live.outside)} ${live.outside === 1 ? "buyer" : "buyers"} other than the operator`}
          </span>
          <span className="text-muted-foreground">.</span>
        </p>
      ) : null}

      {ask.answeringUnpaid > 0 ? (
        <p className="text-muted-foreground">
          The other {fmtInt(ask.answeringUnpaid)} that answer have never been paid on chain. That is not a mark against
          what they can do; the chain simply carries no record of anyone buying it yet.
        </p>
      ) : null}

      <p className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1 text-sm">
        <Link href={rowsHref(ask)} className="inline-flex items-center gap-1.5 font-medium hover:text-primary">
          See all {fmtInt(ask.shelved)} rows
          <ArrowRight aria-hidden className="size-4" />
        </Link>
        <span className="text-muted-foreground">
          Every figure is read from the shelf at build time
          {ask.seeded > 0
            ? `, and the ${fmtInt(ask.seeded)} seeded demo ${ask.seeded === 1 ? "row" : "rows"} in this category ${ask.seeded === 1 ? "is" : "are"} not in any count`
            : ""}
          .
        </span>
      </p>
    </div>
  );
}

export function AskBox({ asks, denominator }: { asks: Ask[]; denominator: AskDenominator }) {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<Ask | null>(null);
  const [rotation, setRotation] = useState(0);

  const match = useMemo(() => matchIntent(asks, question), [asks, question]);
  const example = asks[rotation % asks.length]?.example ?? "";

  // The placeholder cycles only while the field is empty: a visitor who is
  // typing should not have text moving underneath them.
  useEffect(() => {
    if (question) return;
    const t = window.setInterval(() => setRotation((r) => r + 1), ROTATE_MS);
    return () => window.clearInterval(t);
  }, [question]);

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (match) setAsked(match);
        }}
        className="flex flex-col gap-3"
      >
        <div className="relative">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              // Tab takes the offered example, the way a shell completion does.
              if (e.key === "Tab" && !question) {
                e.preventDefault();
                setQuestion(example);
              }
            }}
            aria-label="What do you need done?"
            placeholder={example}
            className={cn(
              "h-14 w-full rounded-lg border border-input bg-transparent pr-14 pl-4 text-base",
              "outline-none transition-[color,box-shadow] placeholder:text-muted-foreground",
              "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
            )}
          />
          {!question ? (
            <kbd className="pointer-events-none absolute top-1/2 right-16 hidden -translate-y-1/2 rounded border px-1.5 py-0.5 font-mono text-xs text-muted-foreground sm:block">
              Tab
            </kbd>
          ) : null}
          <Button
            type="submit"
            size="icon"
            aria-label="Ask"
            disabled={!match}
            className="absolute top-1/2 right-2 size-10 -translate-y-1/2"
          >
            <CornerDownLeft aria-hidden />
          </Button>
        </div>

        {match && (!asked || asked.key !== match.key) ? (
          <button
            type="submit"
            className="flex items-center gap-4 rounded-lg border px-4 py-3 text-left transition-colors hover:bg-accent"
          >
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">{match.title}</span>
              <span className="text-sm text-muted-foreground">{match.sub}</span>
            </span>
            <span className="ml-auto shrink-0 text-sm text-muted-foreground">
              {fmtInt(match.shelved)} on the shelf
            </span>
          </button>
        ) : null}
      </form>

      {asked ? <Answer ask={asked} denominator={denominator} /> : null}
    </div>
  );
}
