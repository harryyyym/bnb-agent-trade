"use client";

import scrollama from "scrollama";
import { type ReactNode, createContext, useContext, useEffect, useRef, useState } from "react";

const StepContext = createContext(-1);

/** The active step of the enclosing Scrolly; −1 outside one, before the first step, and on the server. */
export function useScrollyStep(): number {
  return useContext(StepContext);
}

/**
 * One sticky graphic, many text steps (scrollama's canonical layout). Each step
 * that crosses the middle of the viewport becomes `active` and the graphic is
 * re-rendered with that index. The first step is active from the start, as in
 * scrollama's own examples, so nothing is dimmed before the reader has moved;
 * a chart outside any Scrolly reads −1 and draws its neutral, complete view.
 *
 * Offsets are fractions on wide screens and pixels on narrow ones — scrollama's
 * own advice, since a mobile URL bar resizes `vh` mid-scroll.
 */
export function Scrolly({
  steps,
  graphic,
  side = "right",
  label,
}: {
  steps: ReadonlyArray<ReactNode>;
  /** The sticky graphic; the chart inside it reads the active step with `useScrollyStep()`. */
  graphic: ReactNode;
  side?: "left" | "right";
  label?: string;
}) {
  const [active, setActive] = useState(0);
  const stepsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = stepsRef.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>(".scrolly-step"));
    const scroller = scrollama();
    const narrow = window.matchMedia("(max-width: 1023px)").matches;
    scroller
      .setup({
        step: els,
        // scrollama accepts "Npx" strings; its typings only name the fractions.
        offset: (narrow ? "220px" : 0.5) as unknown as 0.5,
        order: true,
      })
      .onStepEnter(({ index }) => setActive(index));
    const onResize = () => scroller.resize();
    window.addEventListener("resize", onResize);
    const fontsReady = document.fonts?.ready;
    void fontsReady?.then(() => scroller.resize());
    return () => {
      window.removeEventListener("resize", onResize);
      scroller.destroy();
    };
  }, [steps.length]);

  return (
    <section className="scrolly" data-side={side} aria-label={label}>
      <div className="scrolly-graphic">
        <StepContext value={active}>{graphic}</StepContext>
      </div>
      <div className="scrolly-steps" ref={stepsRef}>
        {steps.map((s, i) => (
          <div key={i} className="scrolly-step" data-step={i} data-active={active === i ? "true" : "false"}>
            <div>
              {s}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
