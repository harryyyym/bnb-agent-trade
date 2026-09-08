"use client";

import { useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";

/**
 * The hero's light source (DESIGN.md §6, §9): React Bits' `LightRays`, vendored
 * in `components/vendor/light-rays.jsx`, driven to one hue on a near-black
 * ground. It replaces the breathing `hero-glow` rather than stacking on it —
 * three light sources behind 60px type is busier, not more premium.
 *
 * Four things here are load-bearing and none of them is obvious.
 *
 * 1. **`saturation={0}` is what makes the light yellow.** The shader hard-codes
 *    a vertical ramp before it applies our colour: `fragColor.x *= 0.1 + b*0.8`,
 *    `.y *= 0.3 + b*0.6`, `.z *= 0.5 + b*0.5`, where `b` is 1 at the top of the
 *    canvas and 0 at the bottom. At the bottom the per-channel multipliers are
 *    1:3:5, so BNB yellow arrives on screen as olive-green across the lower half
 *    of the hero — exactly the band the tilted table frame occupies. Setting
 *    `saturation` to 0 collapses the ramp to luminance *before* the multiply, so
 *    every lit pixel is one hue at varying intensity. A saturation of zero to
 *    obtain a saturated brand colour reads like a mistake; it is not.
 *
 * 2. **Every prop is a literal.** The component's effect lists all of them in
 *    its dependency array, so a prop whose identity changes tears down the
 *    WebGL context and builds a new one. Drive `raysColor` from a theme object
 *    or `opacity` from `useScroll` and the hero recreates a context on every
 *    render until the browser starts evicting them and the background goes
 *    blank. It would work in dev and fail on a visitor's machine.
 *
 * 3. **Reduced motion is not covered by any of the five mechanisms in
 *    DESIGN.md §9.** This is a requestAnimationFrame loop writing a GL uniform:
 *    `MotionConfig` governs motion components, the `@media` block governs CSS
 *    keyframes, and neither reaches it. So it takes the "not rendered at all"
 *    row, like `components/beam.tsx` — and leaves a static gradient behind, so
 *    a visitor who asked for less motion still gets a hero with a light source
 *    rather than a hero with nothing.
 *
 * 4. **`ssr: false`** sidesteps the hydration trap that guard would otherwise
 *    create: `useReducedMotion()` is null on the server and real on the client,
 *    but with nothing rendered on the server either way there is nothing to
 *    diverge from. It also keeps `ogl` out of the server bundle.
 *
 * The component brings its own IntersectionObserver at threshold 0.1 and calls
 * `WEBGL_lose_context.loseContext()` on cleanup, so scrolling past the hero
 * releases the GPU. That is why it won over the alternatives.
 */
const LightRays = dynamic(() => import("./vendor/light-rays.jsx"), { ssr: false });

/**
 * DESIGN.md §6 hero backdrop: one light source and nothing else. There used to
 * be a masked GridPattern under the rays; with the rays in place it was a
 * second texture behind 60px type, and the mockup frame below brings its own
 * lines.
 *
 * Defined here, in a client module, rather than in app/_landing/blocks.tsx:
 * a server component whose only child is this `ssr:false` dynamic import
 * minified to an `undefined` element type in the production prerender of
 * /payments — dev and `next build --debug-prerender` both rendered it. Pages
 * import it from here directly, the way they import Avatar and CountUp.
 */
export function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <HeroRays />
    </div>
  );
}

export function HeroRays() {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div aria-hidden className="hero-glow pointer-events-none absolute inset-x-0 top-0 h-3/4" />;
  }

  // Measured on the built page rather than reasoned about: at full strength the
  // shaft peaks at rgb(48,40,12) over the #0b0e11 ground — warm, with no green
  // or blue cast, which is the check that `saturation={0}` worked. The headline
  // band is unchanged at rgb(134,134,133), so 60px white type keeps its full
  // contrast. `opacity-90` is headroom for a brighter display, not a correction;
  // at `opacity-40` the light was not visible at all.
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 opacity-90">
      <LightRays
        className="absolute inset-0 h-full w-full"
        raysOrigin="top-center"
        raysColor="#f0b90b"
        saturation={0}
        raysSpeed={0.55}
        lightSpread={0.7}
        rayLength={1.4}
        fadeDistance={1.1}
        // The light leans a little toward the pointer (the shader mixes the ray
        // direction 6% toward it, smoothed), and breathes: `pulsating` is
        // 0.8 + 0.2·sin(t·speed·3), about a four-second cycle at this speed —
        // the breath the `hero-glow` used to have, now on the one light source.
        followMouse={true}
        mouseInfluence={0.06}
        pulsating={true}
        noiseAmount={0}
        distortion={0}
        lightMode={false}
      />
    </div>
  );
}
