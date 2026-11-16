<script setup>
// Finite, silent opening driven by the copied onetake wordRise timeline.
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { OM, animateMotion, prefersReducedMotion } from '../lib/motion.js'
const props = defineProps({ visible: Boolean })
const emit = defineEmits(['close'])
const letters = ['找', '归', '宿']
const titleStyles = ref(letters.map(() => ({ opacity: 0 })))
const noteStyle = ref({ opacity: 0 })
const sceneStyle = ref({ opacity: 1 })
let cancel = () => {}
let generation = 0
function close() { generation++; cancel(); emit('close') }
watch(() => props.visible, async visible => {
  cancel()
  const id = ++generation
  if (!visible) return
  await nextTick()
  if (id !== generation || !props.visible) return
  if (prefersReducedMotion()) { emit('close'); return }
  sceneStyle.value = { opacity: 1 }
  cancel = animateMotion(3, t => {
    titleStyles.value = letters.map((_, index) => {
      const w = OM.wordRise(t, .17 + index * .16, { zeta: .85, omega: 18, dist: 17, s0: .985, ds: .015 })
      return { opacity: w.op, transform: `translateY(${w.y}px) scale(${w.s})` }
    })
    const note = OM.wordRise(t, .85, { zeta: 1, omega: 13, dist: 8 })
    noteStyle.value = { opacity: note.op, transform: `translateY(${note.y}px)` }
    sceneStyle.value = { opacity: 1 - OM.ease.smooth(OM.clamp((t - 2.5) / .5)) }
  }, () => { if (id === generation) emit('close') })
}, { immediate: true })
onBeforeUnmount(() => { generation++; cancel() })
</script>

<template>
  <div v-if="visible" class="intro-splash" :style="sceneStyle" role="dialog" aria-modal="true" aria-label="找归宿毕业季开场" @keydown.esc="close">
    <div class="intro-art" aria-hidden="true"/>
    <div class="intro-heading"><span class="eyebrow">JIANGXI VOCATIONAL TECHNICAL UNIVERSITY · 2027</span><h1 aria-label="找归宿"><span v-for="(letter, index) in letters" :key="letter" :style="titleStyles[index]" aria-hidden="true">{{ letter }}</span></h1><div class="intro-note" :style="noteStyle"><span class="fine-rule"/>让陪伴过你的，继续被喜欢。<span class="fine-rule"/></div></div>
    <span class="intro-bottom">濂溪校区 · 毕业季闲置集</span><button type="button" class="skip-intro" autofocus @click="close">跳过开场 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M4 12h15m-5-5 5 5-5 5"/></svg></button>
  </div>
</template>

<style scoped>
.intro-splash{position:fixed;inset:0;z-index:500;display:grid;place-items:center;overflow:hidden;background:#fcf8f2;color:#a45769}.intro-art{position:absolute;inset:0;background:linear-gradient(#fcf8f23b,#fcf8f27a),url('/images/garden-painting.jpg') center 48%/cover;opacity:.23;filter:saturate(.65);transform:scale(1.015)}.intro-splash::after{content:'';position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,#fcf8f277,transparent 70%);opacity:.75}.intro-heading{position:relative;z-index:1;text-align:center}.eyebrow{font-family:Georgia,serif;font-size:10px;letter-spacing:3px;color:#8d7f71}.intro-heading h1{font-family:'Songti SC','SimSun',serif;font-size:clamp(70px,8vw,120px);font-weight:400;margin:37px 0 28px;letter-spacing:26px;padding-left:26px;line-height:1.2}.intro-heading h1 span{display:inline-block}.intro-note{display:flex;align-items:center;justify-content:center;gap:19px;color:#8b756d;font-family:'Songti SC','SimSun',serif;font-size:14px;letter-spacing:3px}.fine-rule{height:1px;width:39px;background:#bc9e9c}.intro-bottom{position:absolute;bottom:40px;left:46px;z-index:1;color:#9d8a7d;font-size:11px;letter-spacing:2px}.skip-intro{position:absolute;z-index:2;right:46px;bottom:33px;display:flex;gap:14px;align-items:center;background:#fcf8f299;border:1px solid #c6aa9e66;padding:11px 17px;border-radius:30px;color:#8c706a;font:inherit;font-size:11px;cursor:pointer}.skip-intro:focus-visible{outline:2px solid #a45769;outline-offset:4px}.skip-intro:hover{background:#fcf8f2}
@media(prefers-reduced-motion:reduce){.intro-splash{display:none}}
</style>
