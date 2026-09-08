"use client";

import { useReducedMotion, useScroll, useSpring, useTransform, motion } from "motion/react";

/**
 * Reading progress: the plain bar under the site nav that fills as the reader
 * scrolls — Medium's, nothing more. Chapter navigation is the table of
 * contents' job.
 *
 * Scroll-linked, so DESIGN.md §9's guard applies: under reduced motion the
 * spring is dropped and the bar follows the finger directly — tracking scroll
 * is not an animation, but a spring that overshoots is.
 */
export function ReadingProgress() {
  const { scrollYProgress } = useScroll();
  const reduced = useReducedMotion();
  const sprung = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.4 });
  const scaleX = reduced ? scrollYProgress : sprung;

  const bar = useTransform(scaleX, (v) => v);

  return (
    <div className="story-progress" aria-hidden>
      <motion.div className="bar" style={{ scaleX: bar }} />
    </div>
  );
}
