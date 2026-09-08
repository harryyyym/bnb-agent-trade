"use client";

import { AnimatePresence, motion } from "motion/react";
import { useScrollyStep } from "../scrolly";
import { CYCLES, ECON, POSITIONS } from "@/app/brief/evidence.generated";
import { fmt2, linear } from "./scale";

/*
 * The nine-day range record, four views that share one frame:
 *   −1 / 0   the window: six positions along nine days, every second in range,
 *            the 5.7-day stretch with no operator transaction shaded
 *    1       the five completed cycles: income against gas and impermanent loss,
 *            net against holding — all five below zero
 *    2       the breakeven: income scales with capital, gas does not; they cross
 *            at the artefact's own breakeven, and the position sat left of it
 *    3       the window's end: agent net against holding the entry basket
 */

const W = 720;
const H = 330;
const L = 56;
const R = 24;
const T = 34;
const B = 56;

const t0 = Date.parse(ECON.windowStartIso);
const t1 = Date.parse(ECON.windowEndIso);
const xt = linear(t0, t1, L, W - R);
const DAY = 86_400_000;

const money = (v: number) => `$${fmt2(v)}`;

function Window() {
  const gap0 = Date.parse(ECON.observabilityGapFromIso);
  const gap1 = Date.parse(ECON.observabilityGapToIso);
  const rowY = (i: number) => T + 40 + i * 34;
  // A position's close is the next mint; the last stays open to the window's end.
  const spans = POSITIONS.map((p, i) => {
    const c = CYCLES.find((cy) => cy.tokenId === p.tokenId);
    const open = c ? Date.parse(c.mintIso) : Date.parse(CYCLES[CYCLES.length - 1].closeIso);
    const close = c ? Date.parse(c.closeIso) : t1;
    return { ...p, i, open, close };
  });
  return (
    <g>
      {Array.from({ length: Math.ceil(ECON.windowDays) + 1 }, (_, d) => t0 + d * DAY)
        .filter((t) => t <= t1)
        .map((t, d) => (
          <g key={t}>
            <line x1={xt(t)} x2={xt(t)} y1={T} y2={H - B + 4} stroke="var(--fig-grid)" />
            <text x={xt(t)} y={H - 12} textAnchor="middle" fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
              {d === 0 ? "day 0" : `${d}`}
            </text>
          </g>
        ))}
      <rect x={xt(gap0)} y={T} width={xt(gap1) - xt(gap0)} height={H - T - B} fill="var(--fig-rail)" />
      <text x={(xt(gap0) + xt(gap1)) / 2} y={T + 16} textAnchor="middle" fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
        {((gap1 - gap0) / DAY).toFixed(1)} days with no operator transaction
      </text>
      {spans.map((p) => (
        <g key={p.tokenId}>
          <rect x={xt(p.open)} y={rowY(p.i)} width={Math.max(3, xt(p.close) - xt(p.open))} height={14} fill="var(--chart-1)" rx={2} />
          <text x={L - 8} y={rowY(p.i) + 11} textAnchor="end" fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
            #{p.i + 1}
          </text>
        </g>
      ))}
      <text x={W - R} y={T - 12} textAnchor="end" fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
        {POSITIONS.length} positions · {POSITIONS.reduce((s, p) => s + p.rangeExits, 0)} range exits
      </text>
    </g>
  );
}

function Cycles() {
  const n = CYCLES.length;
  const band = (W - L - R) / n;
  const lo = Math.min(...CYCLES.map((c) => Math.min(c.netVsHoldingUsd, c.impermanentLossUsd, -c.gasUsd)));
  const hi = Math.max(...CYCLES.map((c) => c.swapFeesUsd + c.cakeUsd));
  const y = linear(lo * 1.15, hi * 1.6, H - B, T);
  const zero = y(0);
  const bar = (x: number, v: number, w: number, fill: string, op = 1) => (
    <rect x={x} y={Math.min(zero, y(v))} width={w} height={Math.abs(y(v) - zero)} fill={fill} opacity={op} />
  );
  return (
    <g>
      <line x1={L} x2={W - R} y1={zero} y2={zero} stroke="var(--fig-null)" />
      <text x={L} y={T - 12} fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
        per completed cycle, USD at the block it happened
      </text>
      {CYCLES.map((c, i) => {
        const x0 = L + i * band + 12;
        const w = (band - 24) / 4;
        return (
          <g key={c.cycle}>
            {bar(x0, c.swapFeesUsd + c.cakeUsd, w, "var(--chart-1)")}
            {bar(x0 + w + 2, -c.gasUsd, w, "var(--fig-muted)")}
            {bar(x0 + 2 * (w + 2), c.impermanentLossUsd, w, "var(--chart-3)", 0.8)}
            {bar(x0 + 3 * (w + 2), c.netVsHoldingUsd, w, "var(--fig-ink)")}
            <text x={x0 + 3 * (w + 2) + w / 2} y={y(c.netVsHoldingUsd) + 14} textAnchor="middle" fontSize={12.5} fill="var(--fig-ink)" fontFamily="var(--fig-font-mono)">
              {money(c.netVsHoldingUsd)}
            </text>
            <text x={L + i * band + band / 2} y={H - 26} textAnchor="middle" fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
              cycle {c.cycle} · {(c.heldSeconds / 3600).toFixed(0)} h
            </text>
          </g>
        );
      })}
      <g fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
        {[
          ["fees + CAKE", "var(--chart-1)"],
          ["gas", "var(--fig-muted)"],
          ["impermanent loss", "var(--chart-3)"],
          ["net vs holding", "var(--fig-ink)"],
        ].map(([label, fill], i) => (
          <g key={label} transform={`translate(${L + i * 150}, ${H - 4})`}>
            <rect x={0} y={-9} width={9} height={9} fill={fill} />
            <text x={14} y={0}>{label}</text>
          </g>
        ))}
      </g>
    </g>
  );
}

function Breakeven() {
  const capMax = 120;
  const xc = linear(0, capMax, L, W - R);
  const incomeAt = (cap: number) => (cap * ECON.grossYieldPct) / 100;
  const yMax = Math.max(incomeAt(capMax), ECON.gasUsd) * 1.25;
  const y = linear(0, yMax, H - B, T);
  return (
    <g>
      {[0, 25, 50, 75, 100].map((c) => (
        <g key={c}>
          <line x1={xc(c)} x2={xc(c)} y1={T} y2={H - B + 4} stroke="var(--fig-grid)" />
          <text x={xc(c)} y={H - 12} textAnchor="middle" fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
            ${c}
          </text>
        </g>
      ))}
      <text x={L} y={T - 12} fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
        over the same nine days, USD · capital deployed on the x-axis
      </text>
      <line x1={xc(0)} x2={xc(capMax)} y1={y(ECON.gasUsd)} y2={y(ECON.gasUsd)} stroke="var(--fig-muted)" strokeWidth={2} />
      <text x={xc(capMax)} y={y(ECON.gasUsd) - 8} textAnchor="end" fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
        gas, {ECON.transactions} transactions · {money(ECON.gasUsd)} at any size
      </text>
      <line x1={xc(0)} x2={xc(capMax)} y1={y(0)} y2={y(incomeAt(capMax))} stroke="var(--chart-1)" strokeWidth={2} />
      <text x={xc(capMax)} y={y(incomeAt(capMax)) - 8} textAnchor="end" fontSize={12.5} fill="var(--chart-1)" fontFamily="var(--fig-font-mono)">
        fee + CAKE income at the measured {ECON.grossYieldPct.toFixed(2)}% of notional
      </text>
      <line x1={xc(ECON.breakevenUsd)} x2={xc(ECON.breakevenUsd)} y1={y(ECON.gasUsd)} y2={H - B} stroke="var(--fig-ink)" strokeDasharray="2 3" />
      <circle cx={xc(ECON.breakevenUsd)} cy={y(ECON.gasUsd)} r={5} fill="var(--fig-ink)" stroke="var(--fig-ground)" strokeWidth={2} />
      <text x={xc(ECON.breakevenUsd) + 8} y={y(ECON.gasUsd) + 22} fontSize={14} fill="var(--fig-ink)">
        breakeven ≈ ${Math.round(ECON.breakevenUsd)}
      </text>
      <circle cx={xc(ECON.entryUsd)} cy={y(incomeAt(ECON.entryUsd))} r={6} fill="var(--chart-1)" stroke="var(--fig-ground)" strokeWidth={2} />
      <text x={xc(ECON.entryUsd) - 8} y={y(incomeAt(ECON.entryUsd)) - 10} textAnchor="end" fontSize={14} fill="var(--fig-ink)">
        run at ${fmt2(ECON.entryUsd)}
      </text>
    </g>
  );
}

function Net() {
  const rows = [
    { label: "hold the entry basket, untouched", v: ECON.holdEntryBasketUsd, fill: "var(--fig-muted)" },
    { label: "the agent, after fees, CAKE and gas", v: ECON.agentNetUsd, fill: "var(--chart-1)" },
  ];
  const lo = Math.min(...rows.map((r) => r.v)) - 3;
  const hi = Math.max(...rows.map((r) => r.v)) + 1;
  const x = linear(lo, hi, L + 260, W - R);
  return (
    <g>
      <text x={L} y={T - 12} fontSize={12.5} fill="var(--fig-muted)" fontFamily="var(--fig-font-mono)">
        value at the window&rsquo;s end, USD at that block
      </text>
      {rows.map((r, i) => {
        const y = T + 60 + i * 70;
        return (
          <g key={r.label}>
            <text x={L} y={y + 14} fontSize={14} fill="var(--fig-ink)">
              {r.label}
            </text>
            <rect x={L + 260} y={y} width={W - R - L - 260} height={20} fill="var(--fig-rail)" />
            <rect x={L + 260} y={y} width={x(r.v) - (L + 260)} height={20} fill={r.fill} />
            <text x={x(r.v) + 8} y={y + 14} fontSize={14} fill="var(--fig-ink)" fontFamily="var(--fig-font-mono)">
              {money(r.v)}
            </text>
          </g>
        );
      })}
      <text x={L} y={T + 60 + 2 * 70 + 10} fontSize={14} fill="var(--fig-muted)">
        {ECON.netVsHoldPct.toFixed(2)}% against holding, the number the artefact says must not be dressed up
      </text>
    </g>
  );
}

export function RangeChart({ step: given, windowOnly = false }: { step?: number; windowOnly?: boolean }) {
  const ctx = useScrollyStep();
  const step = given ?? ctx;
  const view = windowOnly ? "window" : step <= 0 ? "window" : step === 1 ? "cycles" : step === 2 ? "breakeven" : "net";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria()} style={{ fontFamily: "var(--fig-font-sans)" }}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.g key={view} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          {view === "window" ? <Window /> : view === "cycles" ? <Cycles /> : view === "breakeven" ? <Breakeven /> : <Net />}
        </motion.g>
      </AnimatePresence>
    </svg>
  );
}

function aria(): string {
  return `The nine-day range record: ${POSITIONS.length} positions with no range exit; ${CYCLES.length} completed cycles, ${CYCLES.filter((c) => c.beatHolding).length} of which beat holding; income ${money(ECON.incomeUsd)} against gas ${money(ECON.gasUsd)}, breakeven about $${Math.round(ECON.breakevenUsd)} of capital against $${fmt2(ECON.entryUsd)} deployed; agent net ${money(ECON.agentNetUsd)} against ${money(ECON.holdEntryBasketUsd)} for holding.`;
}
