"use client";

import { motion } from "motion/react";
import { MIXTURE, MIXTURE_BINS } from "@/app/report/figures.generated";
import { useScrollyStep } from "../scrolly";
import { EASE, fmt0, fmt1, linear, symlog } from "./scale";

/*
 * Figure 2: every paired gap, A − H2, as a histogram on the study's own
 * symmetric-log axis. Steps light one cluster at a time:
 *   −1 / 0  the whole distribution
 *    1      the exact ties
 *    2      the near-zero cluster and the empty span above it
 *    3      the material cluster and its own median
 *    4      the pooled confirmatory median, falling between the two populations
 */

const W = 720;
const H = 300;
const L = 44;
const R = 24;
const T = 40;
const B = 44;
const s = symlog(MIXTURE.symlogConstant);
const lo = s(MIXTURE.minGapBps) - 0.1;
const hi = s(MIXTURE.maxGapBps) + 0.1;
const x = linear(lo, hi, L, W - R);
// the two bins that share [0, c) — tie and negligible — stack
const stacks = new Map<string, number>();
const bars = MIXTURE_BINS.map((b) => {
  const key = `${b.lo}-${b.hi}`;
  const base = stacks.get(key) ?? 0;
  stacks.set(key, base + b.n);
  return { ...b, base };
});
const nMax = Math.max(...[...stacks.values()]);
const y = linear(0, nMax, H - B, T);
const CLUSTER_FILL: Readonly<Record<string, string>> = { tie: "var(--fig-muted)", negligible: "var(--chart-2)", material: "var(--chart-1)" };
const TICKS = [-1, 0, 10, 100, 1000, 5000];

export function MixtureChart({ step: given }: { step?: number }) {
  const ctx = useScrollyStep();
  const step = given ?? ctx;
  const lit = (c: string) => (step === 1 ? c === "tie" : step === 2 ? c === "negligible" : step === 3 ? c === "material" : true);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria()} style={{ fontFamily: "var(--fig-font-sans)" }}>
      <text x={L} y={T - 22} fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
        paths per bar · bars equal width on a symmetric-log axis
      </text>
      {TICKS.map((t) => (
        <g key={t}>
          <line x1={x(s(t))} x2={x(s(t))} y1={T} y2={H - B + 4} stroke={t === 0 ? "var(--fig-null)" : "var(--fig-grid)"} />
          <text x={x(s(t))} y={H - 14} textAnchor="middle" fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
            {t === 0 ? "0" : t < 0 ? `−${Math.abs(t)}` : fmt0(t)}
          </text>
        </g>
      ))}
      <text x={W - R} y={H - 0} textAnchor="end" fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
        gap in bps of opening equity, agent minus modelled person
      </text>
      {bars.map((b) => (
        <motion.rect
          key={`${b.lo}-${b.cluster}`}
          x={x(s(b.lo)) + 1}
          width={Math.max(2, x(s(b.hi)) - x(s(b.lo)) - 2)}
          y={y(b.base + b.n)}
          height={y(b.base) - y(b.base + b.n)}
          fill={CLUSTER_FILL[b.cluster]}
          initial={false}
          animate={{ opacity: lit(b.cluster) ? 1 : 0.2 }}
          transition={EASE}
        />
      ))}
      {/* the empty span */}
      <motion.g initial={false} animate={{ opacity: step === 2 ? 1 : 0 }} transition={EASE}>
        <rect x={x(s(MIXTURE.voidLoBps))} y={T} width={x(s(MIXTURE.voidHiBps)) - x(s(MIXTURE.voidLoBps))} height={H - T - B} fill="var(--fig-rail)" />
        <text x={(x(s(MIXTURE.voidLoBps)) + x(s(MIXTURE.voidHiBps))) / 2} y={T + 16} textAnchor="middle" fontSize={12.5} fill="var(--fig-ink)">
          nothing between {fmt1(MIXTURE.voidLoBps)} and {fmt1(MIXTURE.voidHiBps)} bps
        </text>
      </motion.g>
      {/* cluster counts */}
      {[
        ["tie", MIXTURE.tie, "exact ties"],
        ["negligible", MIXTURE.negligible, "under 10 bps"],
        ["material", MIXTURE.material, "protection binds"],
      ].map(([c, n, label], i) => (
        <motion.text
          key={String(c)}
          x={W - R}
          y={T + i * 18}
          textAnchor="end"
          fontSize={14}
          fill={CLUSTER_FILL[String(c)]}
          fontFamily="var(--fig-font-mono)"
          initial={false}
          animate={{ opacity: lit(String(c)) ? 1 : 0.35 }}
          transition={EASE}
        >
          {fmt0(Number(n))} {label}
        </motion.text>
      ))}
      {/* the material median */}
      <motion.g initial={false} animate={{ opacity: step === 3 ? 1 : 0 }} transition={EASE}>
        <line x1={x(s(MIXTURE.materialMedianBps))} x2={x(s(MIXTURE.materialMedianBps))} y1={T + 56} y2={H - B} stroke="var(--chart-1)" strokeWidth={2} />
        <text x={x(s(MIXTURE.materialMedianBps)) + 6} y={T + 70} fontSize={12.5} fill="var(--fig-ink)" fontFamily="var(--fig-font-mono)">
          median where it binds · {fmt1(MIXTURE.materialMedianBps)} bps
        </text>
      </motion.g>
      {/* the pooled median */}
      <motion.g initial={false} animate={{ opacity: step === 4 || step < 0 ? 1 : 0 }} transition={EASE}>
        <line x1={x(s(MIXTURE.pooledMedianBps))} x2={x(s(MIXTURE.pooledMedianBps))} y1={T + 56} y2={H - B} stroke="var(--fig-ink)" strokeDasharray="3 4" strokeWidth={1.5} />
        <text x={x(s(MIXTURE.pooledMedianBps)) - 6} y={T + 70} textAnchor="end" fontSize={12.5} fill="var(--fig-ink)" fontFamily="var(--fig-font-mono)">
          pooled median · {fmt1(MIXTURE.pooledMedianBps)} bps
        </text>
      </motion.g>
    </svg>
  );
}

function aria(): string {
  return `Histogram of all ${fmt0(MIXTURE.nPairs)} paired gaps on a symmetric-log axis: ${fmt0(MIXTURE.tie)} exact ties, ${fmt0(MIXTURE.negligible)} within ${fmt1(MIXTURE.voidLoBps)} bps, nothing until ${fmt1(MIXTURE.voidHiBps)} bps, then ${fmt0(MIXTURE.material)} paths spread to ${fmt0(MIXTURE.maxGapBps)} bps. Pooled median ${fmt1(MIXTURE.pooledMedianBps)} bps; median where protection binds ${fmt1(MIXTURE.materialMedianBps)} bps.`;
}
