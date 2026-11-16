<script setup>
// Bencho Like: Bloom keyframes and seven-spoke geometry, adapted to Vue/store state.
import { ref } from 'vue'
const props = defineProps({ modelValue: Boolean, count: { type: Number, default: undefined } })
const emit = defineEmits(['update:modelValue'])
const beat = ref(0)
const colors = ['#efbdc5', '#c7a6bc', '#a4b49b', '#e2c3a9', '#a45769', '#cbbec9', '#dca3b0']
function toggle() { if (!props.modelValue) beat.value++; emit('update:modelValue', !props.modelValue) }
</script>

<template>
  <button type="button" class="like-button" :class="{ liked: modelValue }" :aria-pressed="modelValue" :aria-label="modelValue ? '取消收藏' : '收藏这件闲置'" :title="modelValue ? '取消收藏' : '收藏'" @click.stop="toggle">
    <span class="like-heart">
      <svg :key="`${modelValue}-${beat}`" class="heart-glyph" :class="{ active: modelValue }" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" :fill="modelValue ? 'currentColor' : 'none'" /></svg>
      <span v-if="modelValue && beat" :key="beat" class="like-burst" aria-hidden="true"><span class="bloom" /><span v-for="n in 7" :key="n" class="spoke" :style="{ '--angle': `${(n - 1) * 360 / 7 - 90}deg`, '--color': colors[n - 1] }"><i /><i /></span></span>
    </span>
    <Transition v-if="count !== undefined" name="count-roll" mode="out-in"><span :key="count" class="like-count">{{ count }}</span></Transition>
  </button>
</template>

<style scoped>
.like-button{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:36px;height:36px;padding:0 9px;border:1px solid #a4576920;border-radius:50px;background:#fcf8f2ed;color:#8a7273;cursor:pointer;font:inherit;font-size:12px;transition:background .2s,color .2s,scale .22s cubic-bezier(.22,1,.36,1)}
.like-button:hover,.like-button.liked{color:#a45769;background:#fff4f4}.like-button:active{scale:.96}.like-button:focus-visible{outline:2px solid #a45769;outline-offset:3px}
.like-heart{position:relative;display:grid;place-items:center;width:19px;height:19px}.heart-glyph{position:relative;z-index:1}.heart-glyph.active{animation:heart-land 760ms cubic-bezier(.3,1.6,.4,1) both}.like-burst{position:absolute;left:50%;top:50%;pointer-events:none}.bloom{position:absolute;left:-17px;top:-17px;width:34px;height:34px;box-sizing:border-box;border:17px solid #efbdc5;border-radius:50%;animation:bloom .56s cubic-bezier(.25,.8,.35,1) both}.spoke{position:absolute;left:0;top:0;rotate:var(--angle)}.spoke i{position:absolute;width:4px;height:4px;margin:-2px;border-radius:50%;background:var(--color);animation:dot .62s cubic-bezier(.2,.8,.3,1) .2s both}.spoke i:first-child{--side:-3px;--far:0px}.spoke i:last-child{--side:3px;--far:-5px;width:3px;height:3px}.like-count{font-variant-numeric:tabular-nums}.count-roll-enter-active,.count-roll-leave-active{transition:transform .21s cubic-bezier(.22,1,.36,1),opacity .21s}.count-roll-enter-from{transform:translateY(60%);opacity:0}.count-roll-leave-to{transform:translateY(-60%);opacity:0}
@keyframes heart-land{0%,28%{scale:.4}62%{scale:1.2}100%{scale:1}}
@keyframes bloom{0%{scale:.15;border-width:17px}40%{scale:1;border-width:17px}75%{border-width:2px;opacity:1}100%{scale:1.12;border-width:0;opacity:0}}
@keyframes dot{0%{translate:10px var(--side);scale:1;opacity:0}12%{opacity:1}100%{translate:calc(22px + var(--far)) calc(var(--side)*1.6);scale:0;opacity:1}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}.like-burst{display:none}}
</style>
