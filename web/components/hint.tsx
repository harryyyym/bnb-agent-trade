"use client";

import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * DESIGN.md §7 tooltip: the only place for provenance and method
 * (`chain — read from BSC testnet 97 at block N`, `probe — 5 Sep 2026, 175 ms`).
 *
 * Client component. Use it inside a subtree that is already client-side; in a
 * server subtree prefer the `title` attribute (StatusWord / EvidenceWord /
 * ChainTag take the same string) so the page ships no extra JavaScript.
 * `title` is also set here, so the provenance survives without hydration.
 */
export function Hint({
  content,
  side = "top",
  asChild = true,
  children,
}: {
  content: string;
  side?: "top" | "right" | "bottom" | "left";
  /** false wraps the children in a span trigger instead of merging onto them. */
  asChild?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild={asChild} title={content}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side}>{content}</TooltipContent>
    </Tooltip>
  );
}
