"use client";

// The landing's one control: a visitor says what they need in their own words
// and the fold answers with what the shelf holds for that kind of work. It
// replaces the framed marketplace shot that used to sit here, because a reader
// can use this one.
//
// The field is the shape a visitor already knows from an assistant, taken from
// the pattern rather than invented: a box about two thirds of the column, a
// large radius, a foot row carrying what it reads and a round send control, and
// the jobs as pills underneath. The answer is four figures and the three
// best-evidenced rows, drawn with the marketplace's own Row, so it carries
// identicons, proof badges and status words rather than another paragraph.
//
// Matching is `matchIntent` (lib/intents.ts): keyword scoring over the four
// official categories, so the same question always reaches the same answer and
// the whole vocabulary is one readable file. Every figure arrives from the
// server as props; nothing here computes one, and no model writes any of it.
import { ArrowUp, Layers } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ListTable, Row } from "@/app/marketplace/row";
import { Button } from "@/components/button";
import { CategoryIcon } from "@/components/category-icon";
import { Stat } from "@/components/stat";
import { Button as UIButton } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupTextarea } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import type { Ask, AskDenominator } from "@/lib/ask";
import { CATEGORY_SLUG } from "@/lib/categories";
import { fmtInt } from "@/lib/format";
import { matchIntent } from "@/lib/intents";

/** The placeholder cycles, so the box teaches what it can be asked. */
const ROTATE_MS = 4200;

function Answer({ ask, denominator }: { ask: Ask; denominator: AskDenominator }) {
  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-y py-5 sm:grid-cols-4">
        <Stat label="On the shelf" value={ask.shelved} highlight />
        <Stat label="Paid on chain" value={ask.settled} />
        <Stat label="Paid by a third party" value={ask.outsidePaid} />
        <Stat label="Answering now" value={ask.answering} />
      </div>

      <ListTable inset>
        {ask.rows.map((r) => (
          <Row key={r.key} row={r} />
        ))}
      </ListTable>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Button href={`/marketplace?category=${CATEGORY_SLUG[ask.category]}`} variant="default" size="sm">
          All {fmtInt(ask.shelved)} in {ask.category}
        </Button>
        <span className="text-xs text-muted-foreground">
          {fmtInt(denominator.registered)} registered, {fmtInt(denominator.eligible)} eligible,{" "}
          {fmtInt(denominator.shelved)} shelved
          {ask.seeded > 0 ? `. ${fmtInt(ask.seeded)} seeded demo in no count above.` : "."}
        </span>
      </div>
    </div>
  );
}

export function AskFold({ asks, denominator }: { asks: Ask[]; denominator: AskDenominator }) {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<Ask | null>(null);
  const [rotation, setRotation] = useState(0);
  const box = useRef<HTMLTextAreaElement>(null);

  const match = useMemo(() => matchIntent(asks, question), [asks, question]);
  const example = asks[rotation % asks.length]?.example ?? "";

  // The placeholder cycles only while the field is empty: a visitor who is
  // typing should not have text moving underneath them.
  useEffect(() => {
    if (question) return;
    const t = window.setInterval(() => setRotation((r) => r + 1), ROTATE_MS);
    return () => window.clearInterval(t);
  }, [question]);

  const send = () => {
    if (match) setAsked(match);
  };

  // A chip fills the field and hands the question to the send control rather
  // than answering behind the reader's back: the three parts are one action,
  // and the button is what performs it.
  const take = (next: Ask) => {
    setQuestion(next.example);
    setAsked(null);
    box.current?.focus();
  };

  return (
    <div>
      {/* Sized and shaped the way an assistant's prompt box is: not the full
          column but about two thirds of it, a large radius, body-size text, a
          foot row inside the field, and the jobs as pills underneath rather
          than crowded into the foot. Checked against Gemini, Copilot, Manus,
          Mistral and Langdock on Mobbin. */}
      <div className="max-w-4xl">
        <InputGroup className="rounded-2xl shadow-sm">
          <InputGroupTextarea
            ref={box}
            aria-label="What do you need done?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              // Tab takes the offered example, the way a shell completion does.
              if (e.key === "Tab" && !question) {
                e.preventDefault();
                setQuestion(example);
                return;
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={example}
            rows={3}
            className="min-h-32 text-lg md:text-lg"
          />
          <InputGroupAddon align="block-end">
            {/* What the box reads, in the slot an assistant gives its model
                picker. Not a control: there is one corpus and it is named. */}
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Layers aria-hidden className="size-4" />
              Reads {fmtInt(denominator.shelved)} agents on the shelf
            </span>
            <div className="ml-auto flex items-center gap-2">
              {!question ? <Kbd className="hidden sm:inline-flex">Tab</Kbd> : null}
              <UIButton
                type="button"
                size="icon"
                aria-label="Ask"
                disabled={!match}
                onClick={send}
                className="size-10 rounded-full"
              >
                <ArrowUp aria-hidden className="size-5" />
              </UIButton>
            </div>
          </InputGroupAddon>
        </InputGroup>

        <div className="mt-3 flex flex-wrap gap-2">
          {asks.map((a) => (
            <UIButton
              key={a.key}
              type="button"
              variant={match?.key === a.key ? "secondary" : "outline"}
              size="sm"
              aria-pressed={match?.key === a.key}
              className="rounded-full"
              onClick={() => take(a)}
            >
              <CategoryIcon category={a.category} size={16} />
              {a.title}
              <span className="font-mono tabular-nums text-muted-foreground">{fmtInt(a.shelved)}</span>
            </UIButton>
          ))}
        </div>
      </div>

      {asked ? <Answer ask={asked} denominator={denominator} /> : null}
    </div>
  );
}
