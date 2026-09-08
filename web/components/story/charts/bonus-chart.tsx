"use client";

import { motion } from "motion/react";
import { BONUS, BONUS_ROWS, MIXTURE } from "@/app/report/figures.generated";
import { useScrollyStep } from "../scrolly";
import { EASE, fmt0, fmt1, fmt2, linear, symlog } from "./scale";

/*
 * Figure 4: the effect at the venue's own liquidation bonus and again at
 * double, one line per cell on the symmetric-log scale. Steps:
 *   −1 / 0  every cell
 *    1      the pooled line, against the dashed "if doubling doubled it"
 *    2      the steepest cell — the price keeps falling after the seizure
 *    3      the flattest — the wick that recovers, where the largest effects live
 *    4      the cells with no effect at either bonus
 */

const rows = BONUS_ROWS.filter((r) => r.kind === "cell");
const W = 720;
const H = 340;
const L = 90;
const R = 200;
const T = 36;
const B = 40;
const s = symlog(MIXTURE.symlogConstant);
const ymax = Math.max(...BONUS_ROWS.map((r) => Math.max(r.alt, r.base)), BONUS.pooledBaseBps * 2);
const y = linear(s(0) - 0.05, s(ymax) + 0.1, H - B, T);
const x0 = L + 40;
const x1 = W - R - 40;
const TICKS = [0, 10, 100, 1000, 5000];

export function BonusChart({ step: given }: { step?: number }) {
  const ctx = useScrollyStep();
  const step = given ?? ctx;
  const lit = (r: (typeof rows)[number]) => {
    if (step === 1) return false;
    if (step === 2) return r.cell === BONUS.steepest.cell;
    if (step === 3) return r.shock === "wick-1block";
    if (step === 4) return r.ratio === null || r.base < 0.1;
    return true;
  };
  const pooledOn = step === 1 || step <= 0;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria()} style={{ fontFamily: "var(--fig-font-sans)" }}>
      <text x={L} y={T - 16} fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
        median gap, bps of opening equity, symmetric-log
      </text>
      {TICKS.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(s(t))} y2={y(s(t))} stroke={t === 0 ? "var(--fig-null)" : "var(--fig-grid)"} />
          <text x={L - 10} y={y(s(t)) + 4} textAnchor="end" fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
            {fmt0(t)}
          </text>
        </g>
      ))}
      {[
        [x0, BONUS.baselineBps],
        [x1, BONUS.alternativeBps],
      ].map(([xx, b]) => (
        <text key={b} x={xx} y={H - 14} textAnchor="middle" fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
          bonus {fmt0(b)} bps
        </text>
      ))}
      {rows.map((r) => {
        const on = lit(r);
        return (
          <motion.g key={r.cell} initial={false} animate={{ opacity: on ? 1 : 0.18 }} transition={EASE}>
            <line x1={x0} x2={x1} y1={y(s(r.base))} y2={y(s(r.alt))} stroke="var(--chart-1)" strokeWidth={on && step > 1 ? 2.5 : 1.5} />
            <circle cx={x0} cy={y(s(r.base))} r={3.5} fill="var(--chart-1)" />
            <circle cx={x1} cy={y(s(r.alt))} r={3.5} fill="var(--chart-1)" />
            {on && step > 1 ? (
              <text x={x1 + 10} y={y(s(r.alt)) + 4} fontSize={12.5} fill="var(--fig-ink)" fontFamily="var(--fig-font-mono)">
                {r.cell} · {r.ratio === null ? "no effect" : `×${fmt2(r.ratio)}`}
              </text>
            ) : null}
          </motion.g>
        );
      })}
      {/* pooled */}
      <motion.g initial={false} animate={{ opacity: pooledOn ? 1 : 0.15 }} transition={EASE}>
        <line x1={x0} x2={x1} y1={y(s(BONUS.pooledBaseBps))} y2={y(s(BONUS.pooledBaseBps * 2))} stroke="var(--fig-muted)" strokeDasharray="3 4" strokeWidth={1.5} />
        <line x1={x0} x2={x1} y1={y(s(BONUS.pooledBaseBps))} y2={y(s(BONUS.pooledAltBps))} stroke="var(--fig-ink)" strokeWidth={3} />
        <circle cx={x0} cy={y(s(BONUS.pooledBaseBps))} r={5} fill="var(--fig-ink)" />
        <circle cx={x1} cy={y(s(BONUS.pooledAltBps))} r={5} fill="var(--fig-ink)" />
        <text x={x1 + 10} y={y(s(BONUS.pooledAltBps)) + 4} fontSize={12.5} fill="var(--fig-ink)" fontFamily="var(--fig-font-mono)">
          pooled · ×{fmt2(BONUS.pooledRatio)}
        </text>
        <text x={x1 + 10} y={y(s(BONUS.pooledBaseBps * 2)) + 4} fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
          if doubling doubled it
        </text>
        <text x={x0 - 10} y={y(s(BONUS.pooledBaseBps)) + 4} textAnchor="end" fontSize={12.5} fill="var(--fig-ink)" fontFamily="var(--fig-font-mono)">
          {fmt1(BONUS.pooledBaseBps)}
        </text>
      </motion.g>
    </svg>
  );
}

function aria(): string {
  return `Slope chart of the median paired gap at a ${fmt0(BONUS.baselineBps)} and a ${fmt0(BONUS.alternativeBps)} bps liquidation bonus, one line per cell. Pooled ×${fmt2(BONUS.pooledRatio)}; steepest ${BONUS.steepest.cell} ×${fmt2(BONUS.steepest.ratio)}; flattest ${BONUS.flattest.cell} ×${fmt2(BONUS.flattest.ratio)}; ${fmt0(BONUS.nCellsUnderTenthBp)} cells move less than a tenth of a basis point.`;
}
