"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef, type ReactNode } from "react";

/**
 * The hero's visual anchor. Measured against the reference sites, a premium landing fills its first screen with one large surface
 * — Achilles, the closest of the three to this product, uses its own UI. So
 * does this: the frame below holds the real marketplace table, cropped by the
 * fold so the page reads as having somewhere to go.
 *
 * It is scroll-linked, which is the one motion on the page a visitor cannot
 * miss: the surface starts pushed back and slightly tilted and comes upright as
 * the hero leaves. `useScroll` drives it, so it tracks the finger rather than
 * playing on a timer.
 *
 * **This is the fifth reduced-motion mechanism, and it is the one that bites.**
 * A `useTransform` bound to `style` is not an animation: `MotionConfig
 * reducedMotion="user"` governs animations, the `@media` block governs CSS
 * keyframes, and neither reaches a motion value. Left alone, a visitor who had
 * asked for reduced motion met the surface tilted 22 degrees at 45% opacity and
 * it stayed that way until they scrolled — the setting made the page worse, not
 * calmer. So under `reduce` the children render unwrapped, upright and opaque,
 * with no perspective context and no motion value at all.
 */
export function HeroShowcase({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 88%", "start 18%"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [22, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.9, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [0.45, 1]);

  // `useReducedMotion` is null on the server and the real value at hydration,
  // so the wrapper element is kept in both branches; only the transform goes.
  // Swapping the element itself would be a structural hydration mismatch.
  return (
    <div ref={ref} className={reduced ? undefined : "[perspective:1800px]"}>
      {reduced ? (
        <div>{children}</div>
      ) : (
        <motion.div style={{ rotateX, scale, opacity, transformOrigin: "50% 0%" }} className="will-change-transform">
          {children}
        </motion.div>
      )}
    </div>
  );
}
