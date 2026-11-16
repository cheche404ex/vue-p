<script setup>
// Vue adaptation of Bencho Tilt, preserving its normalized-pointer spring and geometry.
import { computed, onBeforeUnmount, ref } from 'vue'
import { prefersReducedMotion } from '../lib/motion.js'

const props = defineProps({ tilt: { type: Number, default: 3 } })
const frame = ref(null)
const position = ref({ x: 0, y: 0, light: 0 })
let target = { x: 0, y: 0, light: 0 }
let velocity = { x: 0, y: 0, light: 0 }
let raf = 0
let last = 0
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
// Bencho's tune=50 spring, normalized to sixtieths of a second.
const stiffness = .16
const decay = .62 + .5 * .2
function tick(now) {
  const dt = last ? clamp((now - last) / 16.67, 0, 2.5) : 1
  last = now
  const next = { ...position.value }
  let moving = false
  for (const key of ['x', 'y', 'light']) {
    velocity[key] += (target[key] - next[key]) * stiffness * dt
    velocity[key] *= decay ** dt
    next[key] += velocity[key] * dt
    if (Math.abs(target[key] - next[key]) < .002 && Math.abs(velocity[key]) < .002) {
      next[key] = target[key]
      velocity[key] = 0
    } else moving = true
  }
  position.value = next
  raf = moving ? requestAnimationFrame(tick) : 0
  if (!moving) last = 0
}
function aim(next) {
  target = next
  if (prefersReducedMotion()) { position.value = next; return }
  if (!raf) raf = requestAnimationFrame(tick)
}
function move(event) {
  const bounds = frame.value?.getBoundingClientRect()
  if (!bounds) return
  aim({ x: clamp((event.clientX - bounds.left) / bounds.width * 2 - 1, -1, 1), y: clamp((event.clientY - bounds.top) / bounds.height * 2 - 1, -1, 1), light: 1 })
}
function leave() { aim({ x: 0, y: 0, light: 0 }) }
const cardStyle = computed(() => {
  const p = position.value
  const tilt = prefersReducedMotion() ? 0 : clamp(props.tilt, 0, 6)
  return {
    transform: `translateZ(${-2 * p.light}px) rotateX(${-p.y * tilt}deg) rotateY(${p.x * tilt}deg)`,
    '--pointer-x': `${(p.x + 1) * 50}%`, '--pointer-y': `${(p.y + 1) * 50}%`, '--light': p.light,
  }
})
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <div ref="frame" class="tilt-frame" @pointermove="move" @pointerleave="leave" @pointercancel="leave">
    <div class="tilt-surface" :style="cardStyle"><slot /><span class="tilt-sheen" aria-hidden="true" /></div>
  </div>
</template>

<style scoped>
.tilt-frame{perspective:1000px;min-width:0;isolation:isolate}
.tilt-surface{position:relative;border-radius:inherit;transform-style:preserve-3d;will-change:transform}
.tilt-sheen{position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:calc(var(--light)*.25);background:radial-gradient(45% 35% at var(--pointer-x) var(--pointer-y),#77445218,transparent),radial-gradient(55% 45% at calc(100% - var(--pointer-x)) calc(100% - var(--pointer-y)),#fff6,transparent)}
@media(prefers-reduced-motion:reduce){.tilt-surface{transform:none!important;will-change:auto}.tilt-sheen{display:none}}
</style>
