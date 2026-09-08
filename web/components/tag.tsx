import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABEL } from "@/lib/categories";
import { chainLabel, railLabel } from "@/lib/format";
import type { Category, Rail } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "./category-icon";
import { Logo } from "./logo";

/**
 * DESIGN.md §7 tags, all on the stock shadcn Badge: `secondary` for tags and
 * chips, `outline` for facets like the chain. Sentence case, never brand.
 */

/** Category tag: lucide icon + label. */
export function CategoryTag({ category, className }: { category: Category; className?: string }) {
  return (
    <Badge variant="secondary" className={cn("gap-1.5", className)}>
      <CategoryIcon category={category} size={14} />
      {CATEGORY_LABEL[category]}
    </Badge>
  );
}

/**
 * The demo-lane marker. Every seeded row carries one, on the row and on the
 * profile; amber is reserved for it (DESIGN.md §1.4) so it cannot be mistaken
 * for the evidence tiers. See agents/shelf/seeded.ts for what "seeded" means.
 */
export function SeededTag({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("border-warning/40 bg-warning/10 text-warning", className)}
      title="Seeded agent, the record below is synthetic, not read from BNB Chain"
    >
      Seeded
    </Badge>
  );
}

/** Generic chip (rails, small facts). */
export function Chip({
  children,
  icon,
  title,
  className,
}: {
  children: ReactNode;
  icon?: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <Badge variant="secondary" title={title} className={cn("gap-1.5", className)}>
      {icon}
      {children}
    </Badge>
  );
}

/** Hiring rail as a chip: BNB Chain mark + "ERC-8183 escrow" / "x402 pay per call". */
export function RailChip({ rail, className }: { rail: Rail; className?: string }) {
  return (
    <Chip icon={<Logo name="bnbchain" size={14} />} className={className}>
      {railLabel(rail)}
    </Chip>
  );
}

/**
 * `Mainnet` / `Testnet` as an outline badge. The chain id rides in the
 * `title`; inside a client subtree wrap it in `<Hint>` instead.
 */
export function ChainTag({ chain, className }: { chain: number; className?: string }) {
  return (
    <Badge variant="outline" className={cn("text-muted-foreground", className)} title={chainTitle(chain)}>
      {chain === 56 ? "Mainnet" : chain === 97 ? "Testnet" : chainLabel(chain)}
    </Badge>
  );
}

/** The provenance string a ChainTag carries — pass it to `<Hint content={…}>`. */
export function chainTitle(chain: number): string {
  return `chain ${chain}, ${chainLabel(chain)}`;
}
