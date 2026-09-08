"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * A number that counts up once when it scrolls into view, built
 * on motion's `animate` + `useInView`. It server-renders the *final* value, so
 * a crawler or a no-JS visitor sees the real figure — the reason Magic UI's
 * NumberTicker, which renders 0 until hydration, is not used on a site whose
 * whole pitch is on-chain numbers. Static under prefers-reduced-motion.
 */
export function CountUp({
  value,
  decimals = 0,
  grouping = true,
  duration = 1.2,
  className,
}: {
  value: number;
  decimals?: number;
  grouping?: boolean;
  /** seconds */
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduced = useReducedMotion();
  const finite = Number.isFinite(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || !inView || reduced || !finite) return;
    const fmt = new Intl.NumberFormat("en-US", {
      useGrouping: grouping,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    const controls = animate(0, value, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => {
        el.textContent = fmt.format(v);
      },
    });
    return () => controls.stop();
  }, [inView, reduced, finite, value, decimals, grouping, duration]);

  const text = finite
    ? new Intl.NumberFormat("en-US", {
        useGrouping: grouping,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value)
    : "–";

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {text}
    </span>
  );
}
