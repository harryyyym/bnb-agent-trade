"use client";

// The landing's one control: a visitor says what they need in their own words
// and the fold answers with what the shelf holds for that kind of work, before
// the page shows a single row. It replaces the framed marketplace shot that
// used to sit here, because a reader can use this one.
//
// Matching is `matchIntent` (lib/intents.ts): keyword scoring over the four
// official categories, so the same question always reaches the same answer and
// the whole vocabulary is one readable file. Every figure arrives from the
// server as props; nothing here computes one, and no model writes any of it.
//
// Primitives are stock: InputGroup with its addons, Button, Badge. Type roles
// are the design system's, written at the call site.
import { ArrowRight, CornerDownLeft, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CategoryIcon } from "@/components/category-icon";
import { Button } from "@/components/button";
import { Button as UIButton } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import type { Ask, AskDenominator, AskRow } from "@/lib/ask";
import { CATEGORY_SLUG } from "@/lib/categories";
import { agentHref, fmtInt, fmtUAmount } from "@/lib/format";
import { matchIntent } from "@/lib/intents";
import { EYEBROW } from "./ui";

/** The placeholder cycles, so the box teaches what it can be asked. */
const ROTATE_MS = 4200;

function rowsHref(ask: Ask): string {
  return `/marketplace?category=${CATEGORY_SLUG[ask.category]}`;
}

/** An agent named inside an answer: the link, then the facts the sentence uses. */
function Named({ row, tail }: { row: AskRow; tail: string }) {
  return (
    <>
      <Link href={agentHref(row)} className="font-medium underline underline-offset-4 hover:text-primary">
        {row.name}
      </Link>
      {tail}
    </>
  );
}

/** One fact of the answer: an eyebrow label and the sentence under it. */
function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-t py-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-6">
      <span className={EYEBROW}>{label}</span>
      <p className="text-base">{children}</p>
    </div>
  );
}

function Answer({ ask, denominator }: { ask: Ask; denominator: AskDenominator }) {
  const { top, live } = ask;
  return (
    <div className="mt-8">
      <Line label="Of everything listed">
        <span className="text-muted-foreground">
          {fmtInt(denominator.registered)} registered identities on chains 56 and 97, {fmtInt(denominator.eligible)}{" "}
          past the published rules, {fmtInt(denominator.shelved)} on the shelf.
        </span>
      </Line>

      <Line label="This kind of work">
        <span className="font-medium">{ask.category}</span>
        <span className="text-muted-foreground">
          {" "}
          holds {fmtInt(ask.shelved)} agents. {fmtInt(ask.settled)} have settled a paid job on chain,{" "}
          {fmtInt(ask.outsidePaid)} of those were paid by a buyer other than the operator, and {fmtInt(ask.answering)}{" "}
          answer their endpoint right now.
        </span>
      </Line>

      {top ? (
        <Line label="Most settled">
          <Named
            row={top}
            tail={`, ${fmtInt(top.jobs)} ${top.jobs === 1 ? "job" : "jobs"}${
              top.volumeU !== null ? `, ${fmtUAmount(top.volumeU)}` : ""
            }`}
          />
          <span className="text-muted-foreground">
            {top.outside > 0
              ? `, ${fmtInt(top.outside)} of its buyers ${top.outside === 1 ? "was" : "were"} not the operator`
              : ", every buyer so far is the operator's own wallet"}
            {top.answers ? ". Its endpoint answered the last probe." : ". Its endpoint did not answer the last probe."}
          </span>
        </Line>
      ) : (
        <Line label="Most settled">
          <span className="text-muted-foreground">
            Nothing here has been paid on chain yet, so the ranking rests on whether an endpoint answers.
          </span>
        </Line>
      )}

      {live ? (
        <Line label="Settled and answering">
          <Named row={live} tail={`, ${fmtInt(live.jobs)} ${live.jobs === 1 ? "job" : "jobs"}`} />
          <span className="text-muted-foreground">
            {live.selfHire
              ? ", though every buyer so far is the operator's own wallet, so it shows the flow works rather than that anyone bought it."
              : `, paid by ${fmtInt(live.outside)} ${live.outside === 1 ? "buyer" : "buyers"} other than the operator.`}
          </span>
        </Line>
      ) : null}

      {ask.answeringUnpaid > 0 ? (
        <Line label="The rest">
          <span className="text-muted-foreground">
            {fmtInt(ask.answeringUnpaid)} more answer and have never been paid on chain. That is not a mark against what
            they can do; the chain carries no record of anyone buying it yet.
          </span>
        </Line>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t pt-4">
        <Button href={rowsHref(ask)} variant="default" size="sm">
          See all {fmtInt(ask.shelved)} rows
        </Button>
        <span className="text-xs text-muted-foreground">
          Every figure read from the shelf at build time
          {ask.seeded > 0
            ? `. The ${fmtInt(ask.seeded)} seeded demo ${ask.seeded === 1 ? "row" : "rows"} here ${
                ask.seeded === 1 ? "is" : "are"
              } in no count above.`
            : "."}
        </span>
      </div>
    </div>
  );
}

export function AskFold({ asks, denominator }: { asks: Ask[]; denominator: AskDenominator }) {
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

  const ask = (next: Ask) => {
    setQuestion(next.example);
    setAsked(next);
  };

  return (
    <div className="rounded-xl border bg-card p-6 md:p-8">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (match) setAsked(match);
        }}
      >
        <label htmlFor="ask" className={EYEBROW}>
          What do you need done?
        </label>
        {/* `h-14` and `text-lg`: this is the page's primary control, and the
            stock 36px group reads as a filter next to a 60px headline. */}
        <InputGroup className="mt-3 h-14 rounded-lg">
          <InputGroupAddon>
            <Search aria-hidden className="size-5" />
          </InputGroupAddon>
          <InputGroupInput
            id="ask"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              // Tab takes the offered example, the way a shell completion does.
              if (e.key === "Tab" && !question) {
                e.preventDefault();
                setQuestion(example);
              }
            }}
            placeholder={example}
            className="text-lg md:text-lg"
            autoComplete="off"
          />
          <InputGroupAddon align="inline-end">
            {!question ? <Kbd className="hidden sm:inline-flex">Tab</Kbd> : null}
            <UIButton type="submit" size="icon" aria-label="Ask" disabled={!match}>
              <CornerDownLeft aria-hidden />
            </UIButton>
          </InputGroupAddon>
        </InputGroup>
      </form>

      {/* The four jobs the shelf is organised around, with what each holds. They
          stand in for a product shot: structure and real figures before a word
          is typed, and one click reaches the same answer as the box. */}
      <div className="mt-4 flex flex-wrap gap-2">
        {asks.map((a) => (
          <UIButton
            key={a.key}
            type="button"
            variant={asked?.key === a.key ? "secondary" : "outline"}
            size="sm"
            onClick={() => ask(a)}
          >
            <CategoryIcon category={a.category} size={16} />
            {a.title}
            <span className="font-mono tabular-nums text-muted-foreground">{fmtInt(a.shelved)}</span>
          </UIButton>
        ))}
      </div>

      {asked ? (
        <Answer ask={asked} denominator={denominator} />
      ) : (
        <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          Ask in plain words, or pick a job. The answer is what the shelf holds for it: how many have been paid on
          chain, by whom, and which endpoints answer.
          <Link href="/marketplace" className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary">
            Browse every agent
            <ArrowRight aria-hidden className="size-4" />
          </Link>
          <Link href="/hiring" className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary">
            How hiring works
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </p>
      )}
    </div>
  );
}
