"use client";

import { useReducedMotion } from "motion/react";
import { BorderBeam } from "@/components/ui/border-beam";

/**
 * The page's one border beam (DESIGN.md §9), absent for a visitor who asked for
 * reduced motion.
 *
 * `MotionConfig reducedMotion="user"` in components/providers.tsx stops
 * transform and layout animations, which is what the motion docs promise — but
 * the beam animates `offsetDistance`, so the setting leaves it looping forever.
 * A permanent loop is precisely what the setting is asking us to stop, so the
 * beam is not rendered at all rather than merely slowed.
 */
export function Beam(props: React.ComponentProps<typeof BorderBeam>) {
  const reduced = useReducedMotion();
  if (reduced) return null;
  return <BorderBeam {...props} />;
}
