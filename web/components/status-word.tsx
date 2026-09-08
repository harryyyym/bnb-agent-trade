import { statusDot, statusWord, toneClass } from "@/lib/format";
import type { ProbeResult, ShelfProbe } from "@/lib/types";
import { cn } from "@/lib/utils";

const DOT: Record<ReturnType<typeof statusDot>, string> = {
  "green-solid": "bg-success",
  "green-ring": "border-2 border-success",
  "muted-ring": "border-2 border-muted-foreground",
  "red-solid": "bg-destructive",
};

function sentence(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * an 8px dot and a sentence-case word at `text-sm`.
 * `live` (a request-time read of one of the featured agents' health endpoints) is a filled
 * green dot, `responds` a green ring, `gated` and `no public endpoint` a grey
 * ring, `unreachable` solid red. Only the dot carries hue; the word keeps its
 * grey-ramp tone.
 *
 * Server component, and it stays one: the provenance is the `title` attribute,
 * so every route that shows a status word ships no JavaScript for it. A client
 * subtree that wants the tooltip wraps the word at the call site:
 * `<Hint content={…}><StatusWord …/></Hint>`.
 */
export function StatusWord({
  probe,
  live,
  dot = true,
  className,
}: {
  probe: ShelfProbe | ProbeResult;
  live?: boolean;
  /** The dot. Off where the word sits inside a cell that already shows one. */
  dot?: boolean;
  className?: string;
}) {
  const s = statusWord(probe, live);
  const kind = statusDot(live ? "live" : probe.word);
  return (
    <span
      className={cn("inline-flex items-center gap-2 text-sm whitespace-nowrap", toneClass(s.tone), className)}
      title={s.title}
    >
      {dot ? (
        <span aria-hidden className="relative flex size-2 shrink-0">
          {/*
            Only `live` breathes. It is the one status read at
            request time against a featured agent's health endpoint, so it is the one word
            on the page that is true *now* rather than at the last five-minute
            sweep — the ring says so without a second label. `responds` is a
            ring already and stays still, or the difference would be lost.
          */}
          {kind === "green-solid" ? (
            <span className="absolute inset-0 animate-live-ping rounded-full bg-success" />
          ) : null}
          <span className={cn("relative size-2 rounded-full", DOT[kind])} />
        </span>
      ) : null}
      {sentence(s.word)}
    </span>
  );
}
