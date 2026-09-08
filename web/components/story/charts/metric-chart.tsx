"use client";

import { motion } from "motion/react";
import { METRIC, METRIC_ROWS, MIXTURE } from "@/app/report/figures.generated";
import { useScrollyStep } from "../scrolly";
import { EASE, fmt0, fmt1, linear, symlog } from "./scale";

/*
 * Figure 5: survival advantage against the equity gap, one mark per cell per
 * comparison arm. Hollow is H1, the attentive human; filled is H2. Steps:
 *   −1 / 0  every plotted mark
 *    1      the attentive human: on the money null with survival above it
 *    2      the realistic human: the two cells that reorder
 *    3      the one cell where the agent is behind on survival — inside the noise
 */

const marks = METRIC_ROWS.filter((r) => r.plotted && r.kind === "cell");
const W = 720;
const H = 360;
const L = 64;
const R = 30;
const T = 40;
const B = 46;
const s = symlog(MIXTURE.symlogConstant);
const xs = marks.map((m) => s(m.gapBps));
const x = linear(Math.min(0, ...xs) - 0.15, Math.max(...xs) + 0.2, L, W - R);
const ys = marks.map((m) => m.advantagePp);
const y = linear(Math.min(-5, ...ys) - 4, Math.max(...ys) + 8, H - B, T);
const XT = [0, 10, 100, 1000, 5000];

export function MetricChart({ step: given }: { step?: number }) {
  const ctx = useScrollyStep();
  const step = given ?? ctx;
  const lit = (m: (typeof marks)[number]) => {
    if (step === 1) return m.arm === "H1";
    if (step === 2) return m.arm === "H2" && (m.cell === METRIC.nonMonotone.mostSurvival.cell || m.cell === METRIC.nonMonotone.mostEquity.cell);
    if (step === 3) return m.arm === "H1" && m.cell === METRIC.tiedInEquity.behind.cell;
    return true;
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria()} style={{ fontFamily: "var(--fig-font-sans)" }}>
      <text x={L} y={T - 18} fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
        ↑ agent&rsquo;s survival advantage, positions per hundred · → median equity gap, bps (symmetric-log)
      </text>
      {XT.map((t) => (
        <g key={t}>
          <line x1={x(s(t))} x2={x(s(t))} y1={T} y2={H - B + 4} stroke={t === 0 ? "var(--fig-null)" : "var(--fig-grid)"} strokeWidth={t === 0 ? 1.5 : 1} />
          <text x={x(s(t))} y={H - 14} textAnchor="middle" fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
            {fmt0(t)}
          </text>
        </g>
      ))}
      {[0, 25, 50, 75].map((t) => (
        <g key={t}>
          <line x1={L - 4} x2={W - R} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--fig-null)" : "var(--fig-grid)"} strokeWidth={t === 0 ? 1.5 : 1} />
          <text x={L - 10} y={y(t) + 4} textAnchor="end" fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
            {t}
          </text>
        </g>
      ))}
      {marks.map((m) => {
        const on = lit(m);
        const hollow = m.arm === "H1";
        return (
          <motion.g key={`${m.cell}-${m.arm}`} initial={false} animate={{ opacity: on ? 1 : 0.18 }} transition={EASE}>
            <circle
              cx={x(s(m.gapBps))}
              cy={y(m.advantagePp)}
              r={on && step > 0 ? 7 : 5.5}
              fill={hollow ? "var(--fig-ground)" : "var(--chart-2)"}
              stroke="var(--chart-2)"
              strokeWidth={hollow ? 2 : 1}
            />
            {on && step > 0 && (step !== 1 || m.advantagePp > 20) ? (
              <text x={x(s(m.gapBps)) + 11} y={y(m.advantagePp) + 4} fontSize={12.5} fill="var(--fig-ink)" fontFamily="var(--fig-font-mono)">
                {m.cell} · {fmt1(m.advantagePp)} pts · {fmt1(m.gapBps)} bps
              </text>
            ) : null}
          </motion.g>
        );
      })}
      {/* pooled diamonds */}
      {METRIC.pooled
        .filter((p) => p.arm === "H1" || p.arm === "H2")
        .map((p) => (
          <motion.g key={p.arm} initial={false} animate={{ opacity: step <= 0 ? 1 : 0.3 }} transition={EASE}>
            <polygon
              points={`${x(s(p.gapBps))},${y(p.advantagePp) - 7} ${x(s(p.gapBps)) + 7},${y(p.advantagePp)} ${x(s(p.gapBps))},${y(p.advantagePp) + 7} ${x(s(p.gapBps)) - 7},${y(p.advantagePp)}`}
              fill="var(--fig-ground)"
              stroke="var(--fig-ink)"
              strokeWidth={1.5}
            />
            <text x={x(s(p.gapBps)) + 11} y={y(p.advantagePp) + 4} fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
              pooled vs {p.arm}
            </text>
          </motion.g>
        ))}
      <g fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
        <circle cx={W - R - 220} cy={T + 2} r={5} fill="var(--fig-ground)" stroke="var(--chart-2)" strokeWidth={2} />
        <text x={W - R - 210} y={T + 6}>H1 · attentive</text>
        <circle cx={W - R - 100} cy={T + 2} r={5} fill="var(--chart-2)" />
        <text x={W - R - 90} y={T + 6}>H2 · realistic</text>
      </g>
    </svg>
  );
}

function aria(): string {
  return `Scatter of the agent's book-survival advantage against the median paired equity gap, one mark per cell per arm. Pooled: ${METRIC.pooled
    .map((p) => `against ${p.arm}, ${fmt1(p.advantagePp)} points of survival and ${fmt1(p.gapBps)} bps`)
    .join("; ")}.`;
}
