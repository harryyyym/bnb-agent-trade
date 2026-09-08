import { evidenceClass, evidenceWord } from "@/lib/format";
import type { Tier } from "@/lib/types";
import { cn } from "@/lib/utils";

/** `SETTLED ON CHAIN` → `Settled on chain`. The Tier type keeps the on-chain spelling. */
export function tierLabel(tier: Tier): string {
  return tier.charAt(0) + tier.slice(1).toLowerCase();
}

/**
 * DESIGN.md §7 evidence word: sentence case at `text-xs`, grey ramp only,
 * never coloured. Server component; the provenance is the `title` attribute.
 * As with `StatusWord` there is no `hint` prop: wrap the word in `<Hint>` at a
 * client call site instead of importing the tooltip into every route.
 */
export function EvidenceWord({ tier, className }: { tier: Tier; className?: string }) {
  const e = evidenceWord(tier);
  return (
    <span className={cn("text-xs whitespace-nowrap", evidenceClass(e.tone), className)} title={e.title}>
      {tierLabel(e.word)}
    </span>
  );
}
