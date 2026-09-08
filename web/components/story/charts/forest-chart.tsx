"use client";

import { motion } from "motion/react";
import { MIXTURE, PER_CELL_ROWS } from "@/app/report/figures.generated";
import { useScrollyStep } from "../scrolly";
import { EASE, fmt0, fmt1, linear, symlog } from "./scale";

/*
 * Figure 3: the median paired gap per cell with 50% and 95% bootstrap
 * intervals, largest first, the pooled estimate below a rule. Steps:
 *   −1 / 0  all sixteen
 *    1      the wick that recovers — the largest effects and the least certain
 *    2      the cells where a person has time — worth nothing
 *    3      night against day, on the same shock
 *    4      the pooled confirmatory estimate
 */

const cells = PER_CELL_ROWS.filter((r) => r.kind === "cell");
const pooled = PER_CELL_ROWS.find((r) => r.kind === "pooled");
const W = 720;
const GUTTER = 210;
const R = 70;
const ROW = 22;
const T = 34;
const B = 40;
const H = T + cells.length * ROW + 18 + ROW + B;
const s = symlog(MIXTURE.symlogConstant);
const xmax = Math.max(...PER_CELL_ROWS.map((r) => r.hi95));
const xmin = Math.min(0, ...PER_CELL_ROWS.map((r) => r.lo95));
const x = linear(s(xmin) - 0.05, s(xmax) + 0.15, GUTTER, W - R);
const TICKS = [0, 10, 100, 1000, 5000];
const CLOCK_WORD: Readonly<Record<string, string>> = { work: "09:30", night: "01:00" };

function label(r: (typeof cells)[number]): string {
  return `${r.shock} · ${CLOCK_WORD[r.clock ?? ""] ?? r.clock} · ${r.books} book${r.books === 1 ? "" : "s"}`;
}

export function ForestChart({ step: given }: { step?: number }) {
  const ctx = useScrollyStep();
  const step = given ?? ctx;
  const lit = (r: (typeof cells)[number]) => {
    if (step === 1) return r.shock === "wick-1block";
    if (step === 2) return (r.shock === "grind" || r.shock === "crash") && r.clock === "work";
    if (step === 3) return r.shock === "grind" || r.shock === "crash";
    if (step === 4) return false;
    return true;
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria()} style={{ fontFamily: "var(--fig-font-sans)" }}>
      <text x={GUTTER} y={T - 16} fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
        median gap, bps of opening equity · thick 50% · thin 95%
      </text>
      {TICKS.map((t) => (
        <g key={t}>
          <line x1={x(s(t))} x2={x(s(t))} y1={T - 4} y2={H - B + 4} stroke={t === 0 ? "var(--fig-null)" : "var(--fig-grid)"} strokeWidth={t === 0 ? 1.5 : 1} />
          <text x={x(s(t))} y={H - 14} textAnchor="middle" fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
            {fmt0(t)}
          </text>
        </g>
      ))}
      {cells.map((r, i) => {
        const cy = T + i * ROW + ROW / 2;
        const on = lit(r);
        const reachesZero = r.lo95 <= 0;
        return (
          <motion.g key={r.cell} initial={false} animate={{ opacity: on ? 1 : 0.22 }} transition={EASE}>
            <text x={GUTTER - 12} y={cy + 4} textAnchor="end" fontSize={12.5} fill="var(--fig-ink)" fontFamily="var(--fig-font-mono)">
              {label(r)}
            </text>
            <line x1={x(s(r.lo95))} x2={x(s(r.hi95))} y1={cy} y2={cy} stroke="var(--chart-1)" strokeWidth={1.2} strokeDasharray={reachesZero ? "2 3" : undefined} />
            {r.lo50 !== null && r.hi50 !== null ? <line x1={x(s(r.lo50))} x2={x(s(r.hi50))} y1={cy} y2={cy} stroke="var(--chart-1)" strokeWidth={4} /> : null}
            <circle cx={x(s(r.d))} cy={cy} r={4} fill="var(--fig-ink)" stroke="var(--fig-ground)" strokeWidth={1.5} />
            <text x={x(s(Math.max(r.hi95, r.d))) + 8} y={cy + 4} fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
              {fmt1(r.d)}
            </text>
          </motion.g>
        );
      })}
      <line x1={GUTTER} x2={W - R} y1={T + cells.length * ROW + 9} y2={T + cells.length * ROW + 9} stroke="var(--border)" />
      {pooled ? (
        <motion.g initial={false} animate={{ opacity: step === 4 || step <= 0 ? 1 : 0.35 }} transition={EASE}>
          {(() => {
            const cy = T + cells.length * ROW + 18 + ROW / 2;
            return (
              <>
                <text x={GUTTER - 12} y={cy + 4} textAnchor="end" fontSize={12.5} fill="var(--fig-ink)" fontFamily="var(--fig-font-mono)">
                  pooled, C1 · {fmt0(pooled.n)} paths
                </text>
                <line x1={x(s(pooled.lo95))} x2={x(s(pooled.hi95))} y1={cy} y2={cy} stroke="var(--fig-ink)" strokeWidth={1.5} />
                <polygon points={`${x(s(pooled.d))},${cy - 6} ${x(s(pooled.d)) + 6},${cy} ${x(s(pooled.d))},${cy + 6} ${x(s(pooled.d)) - 6},${cy}`} fill="var(--fig-ground)" stroke="var(--fig-ink)" strokeWidth={1.5} />
                <text x={x(s(pooled.hi95)) + 8} y={cy + 4} fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
                  {fmt1(pooled.d)}
                </text>
              </>
            );
          })()}
        </motion.g>
      ) : null}
    </svg>
  );
}

function aria(): string {
  return `Forest plot of the median paired gap per cell, largest first, with intervals. ${cells
    .map((r) => `${label(r)}: ${fmt1(r.d)} bps, 95% ${fmt1(r.lo95)} to ${fmt1(r.hi95)}`)
    .join(". ")}. Pooled: ${pooled ? `${fmt1(pooled.d)} bps` : ""}.`;
}
