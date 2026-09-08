"use client";

// In-site quote request — the last region of the profile's Hire card. Rendered
// by the page only when the endpoint passed its last probe and the row declares
// a rail. Calls our route handlers, which hold the allowlist and the cooldown;
// responses are shown as text only. Nothing is signed or paid.
//
// the design system / §7: stock Field + Input and the card's one default Button; the
// result in a mockup frame (terminal chrome, mono lines, one green or red line
// where the status is the point); the raw body behind a stock Collapsible.
// Failures are surfaced twice: the red line stays in the frame, the sonner
// toast catches the case where the sidebar has scrolled away. The Toaster is
// mounted here rather than in the root layout: this is the only component on
// the site that raises a toast.
import { cn } from "@/lib/utils";
import { EYEBROW } from "@/app/_landing/ui";
import { ChevronDown, Coins, FileSignature } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/button";
import { Hint } from "@/components/hint";
import { Logo } from "@/components/logo";
import { MockupFrame } from "@/app/_landing/blocks";
import { Button as UIButton } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { DASH, ago, fmtDateTime, short } from "@/lib/format";
import { QUOTE_DEFAULT_TASK, QUOTE_TASK_MAX } from "@/lib/site";
import type { QuoteResult, Rail, X402Result } from "@/lib/types";

const RAW_CAP = 2000;

type Fetch<T> = { state: "idle" } | { state: "busy" } | { state: "done"; result: T; at: number };

/** Response body as text for the raw view; never rendered as HTML. */
function rawText(raw: unknown): string {
  try {
    const s = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);
    if (s === undefined) return DASH;
    return s.length > RAW_CAP ? `${s.slice(0, RAW_CAP)}\n… (${s.length - RAW_CAP} more characters)` : s;
  } catch {
    return DASH;
  }
}

async function call<T extends { ok: boolean }>(url: string, init?: RequestInit): Promise<T | { ok: false; reason: string }> {
  try {
    const res = await fetch(url, { ...init, cache: "no-store" });
    const body = (await res.json()) as T;
    if (body && typeof body === "object" && "ok" in body) return body;
    return { ok: false, reason: "The request failed" };
  } catch {
    return { ok: false, reason: "The request failed" };
  }
}

/** The one failure sentence: the red line in the frame and the toast. */
function failureText(reason: string, status?: number): string {
  return status ? `${reason} (${status})` : reason;
}

/** Host of the endpoint that answered, for the frame's title; the noun when it does not parse. */
function hostOf(url: string | undefined, fallback: string): string {
  if (!url) return fallback;
  try {
    return new URL(url).host || fallback;
  } catch {
    return fallback;
  }
}

/** Path of the endpoint that answered, for the request line. */
function pathOf(url: string | undefined): string {
  if (!url) return "/";
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}` || "/";
  } catch {
    return "/";
  }
}

type Tone = "muted" | "foreground" | "success" | "destructive";

const TONE: Record<Tone, string> = {
  muted: "text-muted-foreground",
  foreground: "text-foreground",
  success: "text-success",
  destructive: "text-destructive",
};

/**
 * the design system around a terminal: a chrome bar with three dots and
 * the host that answered, then the exchange as mono lines and the terms as
 * key / value rows. Inside the card it sits on the page ground, so it reads as
 * a screen rather than a second card.
 */
function Terminal({
  title,
  lines,
  rows,
}: {
  title: string;
  lines: Array<{ text: ReactNode; tone: Tone }>;
  rows?: Array<[string, ReactNode]>;
}) {
  return (
    <MockupFrame
      className="rounded-lg bg-background shadow-none"
      title={<span className="font-mono">{title}</span>}
    >
      <div className="flex flex-col gap-3 p-4 font-mono text-xs leading-relaxed [overflow-wrap:anywhere]">
        <div className="flex flex-col gap-1">
          {lines.map((l, i) => (
            <p key={i} className={TONE[l.tone]}>
              {l.text}
            </p>
          ))}
        </div>
        {rows && rows.length > 0 ? (
          <dl className="grid grid-cols-4 gap-x-3 gap-y-1">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="col-span-3">{v ?? DASH}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </MockupFrame>
  );
}

/** The raw body, behind a stock Collapsible whose chevron turns when it is open. */
function RawToggle({ raw }: { raw: unknown }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="flex flex-col gap-2">
      <CollapsibleTrigger asChild>
        <UIButton variant="ghost" size="sm" className="group/raw w-fit text-muted-foreground">
          {open ? "Hide raw response" : "Raw response"}
          <ChevronDown aria-hidden className="transition-transform group-data-[state=open]/raw:rotate-180" />
        </UIButton>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="max-h-64 overflow-auto rounded-lg bg-secondary p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground [overflow-wrap:anywhere]">
          {rawText(raw)}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Provenance line. This is a client subtree, so the exact fetch time recorded
 * by our route handler goes in a tooltip rather than a `title`.
 */
function Fetched({ at, fetchedAt, noun }: { at: number; fetchedAt: string; noun: string }) {
  return (
    <p className="text-xs text-muted-foreground">
      Fetched from the agent&apos;s endpoint{" "}
      <Hint content={`fetched, ${fmtDateTime(fetchedAt)}`}>
        <span>{ago(at)}</span>
      </Hint>{" "}
      · {noun}
    </p>
  );
}

/** the design system eyebrow, with the §8 icon that names what the block reads. */
function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className={cn("flex items-center gap-1.5", EYEBROW)}>
      {children}
    </span>
  );
}

function QuoteBlock({ chain, id }: { chain: number; id: number }) {
  const [task, setTask] = useState(QUOTE_DEFAULT_TASK);
  const [sent, setSent] = useState(QUOTE_DEFAULT_TASK);
  const [q, setQ] = useState<Fetch<QuoteResult>>({ state: "idle" });
  const inflight = useRef(false);
  const taskId = useId();

  const run = async () => {
    if (inflight.current) return;
    inflight.current = true;
    const text = task.trim() || QUOTE_DEFAULT_TASK;
    setSent(text);
    setQ({ state: "busy" });
    const result: QuoteResult = await call<QuoteResult>(`/api/agents/${chain}/${id}/quote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task: text }),
    });
    setQ({ state: "done", result, at: Date.now() });
    inflight.current = false;
    if (!result.ok) toast(failureText(result.reason, result.status));
  };

  const request = { tone: "muted" as const, text: `A2A message/send, ${sent}` };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Eyebrow>
          <FileSignature aria-hidden className="size-3.5" />
          Quote
        </Eyebrow>
        <p className="text-sm text-muted-foreground">Ask the agent for a signed ERC-8183 quote. No wallet needed; nothing moves.</p>
      </div>
      <Field>
        <FieldLabel htmlFor={taskId}>Task to quote</FieldLabel>
        <Input
          id={taskId}
          type="text"
          value={task}
          maxLength={QUOTE_TASK_MAX}
          onChange={(e) => setTask(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void run();
          }}
        />
      </Field>
      {/* The page's primary action: this is the control that actually hires, and
          the marketplace's `Hire` and the profile header both land on it. No
          `disabled` on a public page: the in-flight flag guards
          the second click and the label says what is happening. */}
      <Button onClick={run} variant="default" size="lg" className="w-full">
        {q.state === "busy" ? "Requesting…" : "Request a quote"}
      </Button>
      {q.state === "done" ? (
        q.result.ok ? (
          <>
            <Terminal
              title={hostOf(q.result.endpoint, "ERC-8183 quote")}
              lines={[
                request,
                {
                  tone: "success",
                  text: q.result.summary.provider ? `signed quote from ${short(q.result.summary.provider)}` : "signed quote",
                },
              ]}
              rows={[
                ["price", q.result.summary.price],
                ["token", q.result.summary.token],
                ["expires", q.result.summary.expiresAt],
                ["provider", q.result.summary.provider ? short(q.result.summary.provider) : undefined],
                ["signature", q.result.summary.signature ? short(q.result.summary.signature) : undefined],
              ]}
            />
            <Fetched at={q.at} fetchedAt={q.result.fetchedAt} noun="a quote, not a commitment" />
            <RawToggle raw={q.result.raw} />
          </>
        ) : (
          <Terminal
            title="ERC-8183 quote"
            lines={[request, { tone: "destructive", text: failureText(q.result.reason, q.result.status) }]}
          />
        )
      ) : null}
    </div>
  );
}

function X402Block({ chain, id, primary }: { chain: number; id: number; primary?: boolean }) {
  const [x, setX] = useState<Fetch<X402Result>>({ state: "idle" });
  const inflight = useRef(false);

  const run = async () => {
    if (inflight.current) return;
    inflight.current = true;
    setX({ state: "busy" });
    const result: X402Result = await call<X402Result>(`/api/agents/${chain}/${id}/x402`);
    setX({ state: "done", result, at: Date.now() });
    inflight.current = false;
    if (!result.ok) toast(failureText(result.reason, result.status));
  };

  const terms = x.state === "done" && x.result.ok ? x.result.terms : null;
  const usdt = terms?.asset ? /usdt/i.test(terms.asset) : false;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Eyebrow>
          <Coins aria-hidden className="size-3.5" />
          x402 terms
        </Eyebrow>
        <p className="text-sm text-muted-foreground">Read the price the endpoint answers 402 with. No payment is made.</p>
      </div>
      <Button onClick={run} variant={primary ? "default" : "outline"} size="lg" className="w-full">
        {x.state === "busy" ? "Checking…" : "Check price"}
      </Button>
      {x.state === "done" ? (
        x.result.ok && terms ? (
          <>
            <Terminal
              title={hostOf(x.result.endpoint, "x402 terms")}
              lines={[
                { tone: "muted", text: `GET ${pathOf(x.result.endpoint)}` },
                { tone: "destructive", text: "402 Payment Required" },
              ]}
              rows={[
                [
                  "amount",
                  terms.amount ? (
                    <span className="inline-flex items-center gap-2">
                      {usdt ? <Logo name="usdt" size={16} round /> : null}
                      {terms.amount}
                      {terms.asset ? ` ${terms.asset}` : ""}
                    </span>
                  ) : undefined,
                ],
                ["network", terms.network],
                ["pay to", terms.payTo ? short(terms.payTo) : undefined],
                ["scheme", terms.scheme],
                ["for", terms.description],
              ]}
            />
            <Fetched at={x.at} fetchedAt={x.result.fetchedAt} noun="a price, not a commitment" />
            <RawToggle raw={x.result.raw} />
          </>
        ) : !x.result.ok ? (
          <Terminal
            title="x402 terms"
            lines={[
              { tone: "muted", text: "GET /" },
              { tone: "destructive", text: failureText(x.result.reason, x.result.status) },
            ]}
          />
        ) : null
      ) : null}
    </div>
  );
}

/**
 * The quote control of the Hire card: the escrow quote when the agent takes
 * escrow, the 402 price check when it takes x402, both when it declares both.
 * Only one primary in the card — the escrow quote when there is one.
 */
export function QuotePanel({ chain, id, rails }: { chain: number; id: number; rails: Rail[] }) {
  const blocks: ReactNode[] = [];
  if (rails.includes("erc8183")) blocks.push(<QuoteBlock key="erc8183" chain={chain} id={id} />);
  if (rails.includes("x402"))
    blocks.push(<X402Block key="x402" chain={chain} id={id} primary={!rails.includes("erc8183")} />);
  if (blocks.length === 0) return null;
  return (
    <>
      <div className="flex flex-col gap-6 border-t pt-4">{blocks}</div>
      <Toaster position="bottom-right" />
    </>
  );
}
