"use client";

import { useEffect, useState } from "react";
import { statusChecked } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * `Status checked N min ago` — the fixed status-freshness line:
 * marketplace toolbar, profile facts strip. Renders with the server's clock
 * first so SSR and the first client paint agree, then re-reads the clock every
 * 30 s while the value comes from the probe loop. Build-time results carry a
 * date and never tick.
 */
export function StatusChecked({
  checkedAt,
  source,
  now: serverNow,
  className,
}: {
  checkedAt: string | null;
  source: "loop" | "build";
  /** Server clock at render time; keeps SSR and hydration text identical. */
  now: number;
  className?: string;
}) {
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    if (source !== "loop") return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [source]);

  return (
    <span className={cn(className)} suppressHydrationWarning>
      {statusChecked(checkedAt, source, now)}
    </span>
  );
}
