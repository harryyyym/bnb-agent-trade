/* Tiny scale helpers shared by the story charts. No d3: the charts are a few
   dozen marks each and the arithmetic is one line. */

/* Rounded to a hundredth of a pixel: the server and the browser can disagree in
   the last binary digit of a float, and React treats that as a hydration mismatch. */
export const linear = (d0: number, d1: number, r0: number, r1: number) => (v: number) =>
  Math.round((r0 + ((v - d0) / (d1 - d0)) * (r1 - r0)) * 100) / 100;

/** Symmetric log, the study's own transform for gaps: linear inside ±c, log beyond. */
export const symlog = (c: number) => (v: number) => Math.sign(v) * Math.log10(1 + Math.abs(v) / c);

export const fmt1 = (x: number) => x.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const fmt0 = (x: number) => x.toLocaleString("en-US", { maximumFractionDigits: 0 });
export const fmt2 = (x: number) => x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const pct0 = (x: number) => `${Math.round(x * 100)}%`;
export const pct1 = (x: number) => `${fmt1(x * 100)}%`;
export const signed1 = (x: number) => (x > 0 ? "+" : x < 0 ? "−" : "") + fmt1(Math.abs(x));

/** The arm palette, fixed and never cycled: A amber, every human blue, passive pink. */
export const ARM_COLOR: Readonly<Record<string, string>> = {
  A: "var(--chart-1)",
  H1: "var(--chart-2)",
  H2: "var(--chart-2)",
  H3: "var(--chart-2)",
  P: "var(--chart-3)",
};

export const EASE = { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const };
