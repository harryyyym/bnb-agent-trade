"use client";

import { motion } from "motion/react";
import { useScrollyStep } from "../scrolly";
import { HIRES } from "@/app/brief/evidence.generated";
import { EASE, linear } from "./scale";

/*
 * The six hires on one frame. x is delivery time (funded → submitted, block
 * timestamps); y is the age of the data inside the deliverable. One change a
 * step:
 *   −1 / 0   every job as a dot on the x-axis, delivered ones at their seconds,
 *            the two that never arrived parked in the right-hand column
 *    1       the four delivered dots are lit; the stranded two dim
 *    2       the dots rise to the age of their data — the y-axis appears
 *    3       the two stranded jobs are lit, with the escrow they hold
 */

const W = 720;
const H = 340;
const L = 64;
const R = 190;
const T = 36;
const B = 44;

const delivered = HIRES.filter((h) => h.delivered);
const stranded = HIRES.filter((h) => !h.delivered);
const xMax = Math.max(45, Math.ceil(Math.max(...delivered.map((h) => h.deliverySeconds ?? 0)) / 5) * 5);
const yMax = Math.ceil(Math.max(...delivered.map((h) => h.stalenessDays ?? 0)) / 10) * 10;
const x = linear(0, xMax, L, W - R - 24);
const y = linear(0, yMax, H - B, T);

export function HiresChart({ step: given, delivered: deliveredOnly = false }: { step?: number; delivered?: boolean }) {
  const ctx = useScrollyStep();
  const step = deliveredOnly ? Math.min(given ?? ctx, 1) : given ?? ctx;
  const risen = step >= 2;
  const litDelivered = step === 1 || step === 2 || step < 0 || step === 0;
  const litStranded = step === 3 || step <= 0;
  return (
    <svg
      viewBox={deliveredOnly ? `0 ${H - B - 130} ${W - R + 24} ${B + 130}` : `0 0 ${W} ${H}`}
      role="img"
      aria-label={aria()}
      style={{ fontFamily: "var(--fig-font-sans)" }}
    >
      {/* x axis */}
      {Array.from({ length: xMax / 5 + 1 }, (_, i) => i * 5).map((s) => (
        <g key={s}>
          <line x1={x(s)} x2={x(s)} y1={T} y2={H - B + 4} stroke="var(--fig-grid)" />
          <text x={x(s)} y={H - 14} textAnchor="middle" fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
            {s}s
          </text>
        </g>
      ))}
      <text x={L} y={H - 0} fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
        seconds from funded to submitted, chain 97 block timestamps
      </text>
      <line x1={L} x2={W - R - 24} y1={H - B} y2={H - B} stroke="var(--fig-null)" />

      {/* y axis, only once the dots have risen */}
      <motion.g initial={false} animate={{ opacity: risen ? 1 : 0 }} transition={EASE}>
        {Array.from({ length: yMax / 10 + 1 }, (_, i) => i * 10).map((d) => (
          <g key={d}>
            <line x1={L - 4} x2={W - R - 24} y1={y(d)} y2={y(d)} stroke="var(--fig-grid)" />
            <text x={L - 10} y={y(d) + 4} textAnchor="end" fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
              {d}d
            </text>
          </g>
        ))}
        <text x={L} y={T - 14} fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
          age of the data inside the deliverable, days
        </text>
      </motion.g>

      {/* the stranded column */}
      {deliveredOnly ? null : (
        <>
          <line x1={W - R} x2={W - R} y1={T} y2={H - B + 4} stroke="var(--fig-grid)" strokeDasharray="3 4" />
          <text x={W - R + 12} y={T - 14} fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
            never submitted
          </text>
        </>
      )}

      {delivered.map((h) => {
        const cx = x(h.deliverySeconds ?? 0);
        const cy = risen ? y(h.stalenessDays ?? 0) : H - B;
        // two jobs landed within a few seconds of each other: the earlier one
        // labels to the left, the later to the right, so the names never collide
        const near = delivered.find((o) => o !== h && Math.abs((o.deliverySeconds ?? 0) - (h.deliverySeconds ?? 0)) <= 4);
        const side = !near ? "middle" : (h.deliverySeconds ?? 0) <= (near.deliverySeconds ?? 0) ? "end" : "start";
        const lx = side === "end" ? cx - 12 : side === "start" ? cx + 12 : cx;
        return (
          <motion.g key={h.job} initial={false} animate={{ opacity: litDelivered ? 1 : 0.25 }} transition={EASE}>
            <motion.circle cx={cx} r={7} fill="var(--success)" stroke="var(--fig-ground)" strokeWidth={2} initial={false} animate={{ cy }} transition={EASE} />
            {/* flat on the axis the pairs are two seconds apart, so their names
                stack — one line up, the second two lines up — and only once the
                dots have risen do they sit beside their dot */}
            <motion.text
              textAnchor={risen ? side : "middle"}
              fontSize={14}
              fill="var(--fig-ink)"
              initial={false}
              animate={{ x: risen ? lx : cx, y: risen ? cy + 5 : side === "start" ? cy - 34 : cy - 14 }}
              transition={EASE}
            >
              {h.agent.replace("Canned ", "")}
              {deliveredOnly ? `, ${h.deliverySeconds} s` : ""}
            </motion.text>
            <motion.text
              x={lx}
              textAnchor={side}
              fontSize={12.5}
              fill="var(--fig-muted)"
              fontFamily="var(--fig-font-mono)"
              initial={false}
              animate={{ y: cy + 22, opacity: risen ? 1 : 0 }}
              transition={EASE}
            >
              {deliveredOnly ? `${h.deliverySeconds} s` : `${h.stalenessDays?.toFixed(1)} d · ${h.deliverySeconds} s`}
            </motion.text>
          </motion.g>
        );
      })}

      {(deliveredOnly ? [] : stranded).map((h, i) => {
        const cx = W - R + 24;
        const cy = H - B - 40 - i * 90;
        return (
          <motion.g key={h.job} initial={false} animate={{ opacity: litStranded ? 1 : 0.25 }} transition={EASE}>
            <circle cx={cx} cy={cy} r={7} fill="none" stroke="var(--destructive)" strokeWidth={2} />
            <text x={cx + 14} y={cy - 4} fontSize={12.5} fill="var(--fig-ink)">
              {h.agent.replace("Canned ", "").replace(" Monitor", "")}
            </text>
            <text x={cx + 14} y={cy + 12} fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
              {h.priceU} U stranded
            </text>
          </motion.g>
        );
      })}
    </svg>
  );
}

function aria(): string {
  return `Scatter of the six hires. ${delivered
    .map((h) => `${h.agent}: delivered in ${h.deliverySeconds} seconds with data ${h.stalenessDays} days old`)
    .join(". ")}. ${stranded.map((h) => `${h.agent}: funded ${h.priceU} U and never submitted`).join(". ")}.`;
}
