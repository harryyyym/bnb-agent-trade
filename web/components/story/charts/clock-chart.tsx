"use client";

import { motion } from "motion/react";
import { useScrollyStep } from "../scrolly";
import { CLOCK, CLOCK_ROWS } from "@/app/report/figures.generated";
import { ARM_COLOR, EASE, linear, pct1, signed1 } from "./scale";

/*
 * Figure: book-level survival per arm at each clock, with Wilson intervals.
 * One chart, five steps, one change per step:
 *   −1 neutral   both clocks, every arm at full ink
 *    0           only the 09:30 bars — the day everyone has a chance
 *    1           the 01:00 bars arrive beside them
 *    2           the two scheduled humans are lit, dashed rule from day to night
 *    3           the two always-on arms are lit — they did not move
 *    4           passive is lit — the floor
 * The axes never move between steps.
 */

const ARMS = ["A", "H1", "H2", "H3", "P"] as const;
const SHORT: Readonly<Record<string, string>> = {
  A: "agent, always on",
  H1: "person, always on",
  H2: "person, realistic",
  H3: "person, asleep 23–07",
  P: "nobody acts",
};

const W = 720;
const GUTTER = 168;
const RIGHT = 150;
const ROW = 58;
const TOP = 28;
const AXIS = 30;
const H = TOP + ARMS.length * ROW + AXIS;
const x = linear(0, 1, GUTTER, W - RIGHT);

function row(arm: string, clock: "work" | "night") {
  const r = CLOCK_ROWS.find((c) => c.arm === arm && c.clock === clock);
  if (!r) throw new Error(`no clock row ${arm}/${clock}`);
  return r;
}

export function ClockChart({ step: given }: { step?: number }) {
  const ctx = useScrollyStep();
  const step = given ?? ctx;
  const lit = (arm: string) => {
    if (step === 2) return arm === "H2" || arm === "H3";
    if (step === 3) return arm === "A" || arm === "H1";
    if (step === 4) return arm === "P";
    return true;
  };
  const nightOn = step !== 0;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel()} style={{ fontFamily: "var(--fig-font-sans)" }}>
      {/* axis */}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={TOP - 6} y2={H - AXIS + 4} stroke="var(--fig-grid)" />
          <text x={x(t)} y={H - 8} textAnchor="middle" fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
            {Math.round(t * 100)}%
          </text>
        </g>
      ))}
      <text x={GUTTER} y={14} fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
        positions kept, of 100
      </text>

      {ARMS.map((arm, i) => {
        const y0 = TOP + i * ROW;
        const w = row(arm, "work");
        const n = row(arm, "night");
        const on = lit(arm);
        const ink = on ? 1 : 0.22;
        const color = ARM_COLOR[arm];
        const bars: Array<{ r: typeof w; y: number; clock: "work" | "night" }> = [
          { r: w, y: y0 + 8, clock: "work" },
          { r: n, y: y0 + 26, clock: "night" },
        ];
        return (
          <g key={arm}>
            <motion.text
              x={GUTTER - 14}
              y={y0 + 22}
              textAnchor="end"
              fontSize={14}
              fill="var(--fig-ink)"
              animate={{ opacity: ink }}
              transition={EASE}
            >
              {SHORT[arm]}
            </motion.text>
            <motion.text
              x={GUTTER - 14}
              y={y0 + 38}
              textAnchor="end"
              fontSize={12.5}
              fill="var(--fig-muted)"
              fontFamily="var(--fig-font-mono)"
              animate={{ opacity: ink }}
              transition={EASE}
            >
              {arm}
            </motion.text>
            {bars.map(({ r, y, clock }) => {
              const visible = clock === "work" || nightOn;
              const op = visible ? ink : 0;
              return (
                <g key={clock}>
                  <rect x={x(0)} y={y} width={x(1) - x(0)} height={12} fill="var(--fig-rail)" />
                  <motion.rect
                    x={x(0)}
                    y={y}
                    height={12}
                    fill={color}
                    initial={false}
                    animate={{ width: visible ? x(r.survival) - x(0) : 0, opacity: clock === "work" ? op * 0.55 : op }}
                    transition={EASE}
                  />
                  <motion.g initial={false} animate={{ opacity: op }} transition={EASE}>
                    <line x1={x(r.loPct / 100)} x2={x(r.hiPct / 100)} y1={y + 6} y2={y + 6} stroke="var(--fig-ink)" strokeWidth={1.2} />
                    <line x1={x(r.loPct / 100)} x2={x(r.loPct / 100)} y1={y + 2} y2={y + 10} stroke="var(--fig-ink)" strokeWidth={1.2} />
                    <line x1={x(r.hiPct / 100)} x2={x(r.hiPct / 100)} y1={y + 2} y2={y + 10} stroke="var(--fig-ink)" strokeWidth={1.2} />
                    <text
                      x={x(Math.max(r.survival, r.hiPct / 100)) + 8}
                      y={y + 10}
                      fontSize={12.5}
                      fill="var(--fig-muted)"
                      fontFamily="var(--fig-font-mono)"
                    >
                      {pct1(r.survival)}
                      {i === 0 ? (clock === "work" ? " · 09:30" : " · 01:00") : ""}
                    </text>
                  </motion.g>
                </g>
              );
            })}
            {/* the dashed rule from the day level into the night row, on the two arms that move */}
            {!n.changeSpansZero && n.changePp !== null ? (
              <motion.g initial={false} animate={{ opacity: step === 2 ? 1 : nightOn && on ? 0.5 : 0 }} transition={EASE}>
                <line x1={x(w.survival)} x2={x(w.survival)} y1={y0 + 20} y2={y0 + 38} stroke="var(--fig-ink)" strokeDasharray="2 3" />
                <text x={x(w.survival) + 6} y={y0 + 50} fontSize={12.5} fill="var(--fig-ink)" fontFamily="var(--fig-font-mono)">
                  {signed1(n.changePp)} pts overnight
                </text>
              </motion.g>
            ) : null}
            {/* the “inside the noise” note on the arms that did not move */}
            {n.changeSpansZero && n.changePp !== null ? (
              <motion.text
                x={x(w.survival) + 6}
                y={y0 + 50}
                fontSize={12.5}
                fill="var(--fig-muted)"
                fontFamily="var(--fig-font-mono)"
                initial={false}
                animate={{ opacity: step === 3 && (arm === "A" || arm === "H1") ? 1 : step === 4 && arm === "P" ? 1 : 0 }}
                transition={EASE}
              >
                {signed1(n.changePp)} pts, covers zero
              </motion.text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

function ariaLabel(): string {
  return `Grouped horizontal bars of book-level survival for five arms at a 09:30 and a 01:00 shock, each with a ${Math.round(
    CLOCK.uncertainty.level * 100,
  )}% interval. ${CLOCK.arms
    .map((a) => `${a.label}: ${pct1(a.work)} at 09:30, ${pct1(a.night)} at 01:00, change ${signed1(a.changePp)} points${a.changeSpansZero ? " (interval covers zero)" : ""}`)
    .join(". ")}.`;
}
