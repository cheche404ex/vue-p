// Adapter for the unchanged, locally copied onetake IIFE. Source: docs/sources.md.
import '../vendor/onetake-motion.js'

export const OM = globalThis.OM
export const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Runs a finite onetake timeline; absolute t and duration are seconds. */
export function animateMotion(duration, frame, complete = () => {}) {
  let raf = 0
  let stopped = false
  if (prefersReducedMotion()) {
    frame(duration)
    complete()
    return () => {}
  }
  const start = performance.now()
  frame(0)
  const tick = now => {
    if (stopped) return
    const t = Math.min(duration, (now - start) / 1000)
    frame(t)
    if (t < duration) raf = requestAnimationFrame(tick)
    else complete()
  }
  raf = requestAnimationFrame(tick)
  return () => { stopped = true; cancelAnimationFrame(raf) }
}
