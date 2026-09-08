"use client";

import { motion } from "motion/react";
import { BOOKS, BOOKS_ROWS } from "@/app/report/figures.generated";
import { useScrollyStep } from "../scrolly";
import { ARM_COLOR, EASE, fmt1, linear, pct0 } from "./scale";

/*
 * Figure 6: survival at one book against three, per shock and pooled, for the
 * agent, the attentive human and the realistic human. The wedge between A and
 * H1 is the figure's subject. Steps:
 *   −1 / 0  every panel
 *    1      the pooled panel — the wedge at one book is inside the noise, at three it is not
 *    2      the two wicks, which carry all of it
 *    3      grind and crash, where both arms keep everything: an identity, not a null
 */

const panels = [...new Set(BOOKS_ROWS.map((r) => r.shock))];
const W = 720;
const H = 300;
const L = 44;
const R = 16;
const T = 44;
const B = 40;
const GAP = 18;
const PW = (W - L - R - GAP * (panels.length - 1)) / panels.length;
const y = linear(0, 1, H - B, T);

function at(shock: string, arm: string, books: number): number {
  const r = BOOKS_ROWS.find((b) => b.shock === shock && b.arm === arm && b.books === books);
  if (!r) throw new Error(`no books row ${shock}/${arm}/${books}`);
  return r.survival;
}

export function BooksChart({ step: given }: { step?: number }) {
  const ctx = useScrollyStep();
  const step = given ?? ctx;
  const lit = (shock: string) => {
    if (step === 1) return shock === "all";
    if (step === 2) return (BOOKS.carriedBy as ReadonlyArray<string>).includes(shock);
    if (step === 3) return (BOOKS.flatShocks as ReadonlyArray<string>).includes(shock);
    return true;
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria()} style={{ fontFamily: "var(--fig-font-sans)" }}>
      <text x={L} y={T - 26} fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
        positions kept, one book → three books · shaded: agent minus attentive person
      </text>
      {[0, 0.5, 1].map((t) => (
        <text key={t} x={L - 8} y={y(t) + 4} textAnchor="end" fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
          {pct0(t)}
        </text>
      ))}
      {panels.map((shock, i) => {
        const px = L + i * (PW + GAP);
        const x1 = px + 22;
        const x3 = px + PW - 22;
        const on = lit(shock);
        const a1 = at(shock, "A", 1), a3 = at(shock, "A", 3);
        const h1 = at(shock, "H1", 1), h3 = at(shock, "H1", 3);
        return (
          <motion.g key={shock} initial={false} animate={{ opacity: on ? 1 : 0.2 }} transition={EASE}>
            {[0, 0.5, 1].map((t) => (
              <line key={t} x1={px} x2={px + PW} y1={y(t)} y2={y(t)} stroke="var(--fig-grid)" />
            ))}
            <text x={px + PW / 2} y={T - 8} textAnchor="middle" fontSize={14} fill="var(--fig-ink)" fontFamily="var(--fig-font-mono)">
              {shock === "all" ? "all four shocks" : shock}
            </text>
            <polygon points={`${x1},${y(a1)} ${x3},${y(a3)} ${x3},${y(h3)} ${x1},${y(h1)}`} fill="var(--chart-1)" opacity={0.18} />
            {(["H2", "H1", "A"] as const).map((arm) => {
              const v1 = at(shock, arm, 1), v3 = at(shock, arm, 3);
              return (
                <g key={arm}>
                  <line x1={x1} x2={x3} y1={y(v1)} y2={y(v3)} stroke={ARM_COLOR[arm]} strokeWidth={arm === "H2" ? 1.5 : 2.5} strokeDasharray={arm === "H2" ? "3 3" : undefined} />
                  <circle cx={x1} cy={y(v1)} r={3.5} fill={ARM_COLOR[arm]} />
                  <circle cx={x3} cy={y(v3)} r={3.5} fill={ARM_COLOR[arm]} />
                </g>
              );
            })}
            <text x={x1} y={H - 14} textAnchor="middle" fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
              1
            </text>
            <text x={x3} y={H - 14} textAnchor="middle" fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
              3
            </text>
            {on && step > 0 ? (
              <text x={px + PW / 2} y={H - 0} textAnchor="middle" fontSize={12.5} fill="var(--fig-ink)" fontFamily="var(--fig-font-mono)">
                {fmt1((a1 - h1) * 100)} → {fmt1((a3 - h3) * 100)} pts
              </text>
            ) : null}
          </motion.g>
        );
      })}
      <g fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
        {[
          ["A", "agent"],
          ["H1", "attentive person"],
          ["H2", "realistic person"],
        ].map(([arm, label], i) => (
          <g key={arm} transform={`translate(${W - R - 330 + i * 120}, ${T - 30})`}>
            <line x1={0} x2={14} y1={0} y2={0} stroke={ARM_COLOR[arm]} strokeWidth={2.5} strokeDasharray={arm === "H2" ? "3 3" : undefined} />
            <text x={20} y={4}>{label}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

function aria(): string {
  return `Small multiples of survival at one book against three, per shock and pooled, for the agent, the attentive human and the realistic human. Pooled, the agent's lead over the attentive human goes from ${fmt1(BOOKS.advantageOverH1.onePp)} points (interval ${fmt1(BOOKS.advantageOverH1.oneLoPp)} to ${fmt1(BOOKS.advantageOverH1.oneHiPp)}, covers zero) to ${fmt1(BOOKS.advantageOverH1.threePp)} points. Carried by ${BOOKS.carriedBy.join(" and ")}; flat on ${BOOKS.flatShocks.join(" and ")}.`;
}
