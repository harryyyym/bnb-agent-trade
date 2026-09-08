"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/**
 * Client providers mounted once in app/layout.tsx.
 *
 * `MotionConfig reducedMotion="user"` snaps the **positional** properties of
 * motion *components* — the transform set plus width/height/top/left/right/
 * bottom — so BlurFade's `y` offset stops. It does not reach opacity, `filter`,
 * `offsetDistance`, a CSS keyframe, or an imperative `animate()` call, which is
 * why three other mechanisms exist: the `@media` block in globals.css, the
 * `useReducedMotion()` guard in components/beam.tsx, and the one in
 * components/count-up.tsx. the design system table; do not delete any of
 * them on the assumption that this line covers them.
 *
 * Nothing else is mounted globally: the sonner Toaster lives in the one
 * component that raises a toast.
 */
export function Providers({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
