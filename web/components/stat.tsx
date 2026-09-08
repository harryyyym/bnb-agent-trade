import { EYEBROW } from "@/app/_landing/ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CountUp } from "./count-up";

/**
 * DESIGN.md §6 stat cell: eyebrow label over a big tabular figure over a
 * caption. Three steps: `default` for a strip of six, `lg` where a page leads
 * with three, `display` where the figure is the section (the profile's facts
 * panel, the landing's funnel). Numbers count up once (`CountUp`); strings render as-is; any other
 * node (a `StatusWord`, an evidence word on the profile facts strip) sits on
 * the value line as given. `highlight` is the one brand-coloured figure a page
 * is allowed (DESIGN.md §1.3). `title` carries the cell's provenance.
 */
export function Stat({
  label,
  value,
  caption,
  highlight = false,
  size = "default",
  title,
  className,
}: {
  label: string;
  /** A number counts up, a string renders as-is, any other node renders as given. */
  value: ReactNode;
  caption?: ReactNode;
  highlight?: boolean;
  size?: "default" | "lg" | "display";
  /** Provenance tooltip on the whole cell. */
  title?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)} title={title}>
      <span className={EYEBROW}>{label}</span>
      <span
        className={cn(
          "font-semibold tracking-tight tabular-nums",
          size === "display" ? "text-4xl md:text-5xl" : size === "lg" ? "text-3xl md:text-4xl" : "text-3xl",
          highlight ? "text-primary" : "text-foreground",
        )}
      >
        {typeof value === "number" ? <CountUp value={value} /> : value}
      </span>
      {caption ? <span className="text-xs text-muted-foreground">{caption}</span> : null}
    </div>
  );
}
