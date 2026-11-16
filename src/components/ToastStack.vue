<script setup>
// Bencho ToastStack's front-first placement and hover fan, connected to real messages.
import { ref } from 'vue'
defineProps({ items: { type: Array, default: () => [] } })
const emit = defineEmits(['dismiss'])
const open = ref(false)
const styleFor = index => ({ transform: `translateY(${-index * (open.value ? 77 : 13)}px) scale(${open.value ? 1 : 1 - index * .045})`, zIndex: 4 - index, opacity: open.value || index === 0 ? 1 : 1 - index * .18 })
</script>

<template>
  <div v-if="items.length" class="toast-region" :class="{ open }" :style="{ height: `${74 + (Math.min(items.length, 3) - 1) * (open ? 77 : 13)}px` }" role="region" aria-label="操作提示" @pointerenter="open = true" @pointerleave="open = false" @focusin="open = true" @focusout="open = false">
    <TransitionGroup name="toast">
      <div v-for="(item, index) in items.slice(0, 3)" :key="item.id" class="toast-item" :class="item.kind" :style="styleFor(index)" role="status" aria-live="polite">
        <svg v-if="item.kind === 'error'" class="toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/></svg>
        <svg v-else class="toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m7.5 12 3 3 6-6"/></svg>
        <p>{{ item.message }}</p><button type="button" aria-label="关闭提示" @click="emit('dismiss', item.id)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-region{position:fixed;z-index:300;right:30px;bottom:28px;width:350px;transition:height .35s;pointer-events:auto}.toast-item{position:absolute;bottom:0;left:0;display:flex;align-items:center;gap:12px;box-sizing:border-box;min-height:68px;width:100%;padding:17px 15px 17px 19px;border:1px solid #e4d8cd;border-radius:15px;background:#fcf8f2;color:#5a4a43;box-shadow:0 10px 35px #674a431c;transform-origin:top center;transition:transform .5s cubic-bezier(.2,1.1,.3,1),opacity .3s}.toast-icon{flex:none;color:#829279}.toast-item.error .toast-icon{color:#a45769}.toast-item p{flex:1;margin:0;font-size:13px;line-height:1.7}.toast-item button{display:grid;place-items:center;flex:none;border:0;background:transparent;color:#9f8b84;cursor:pointer;padding:4px;border-radius:5px}.toast-item button:hover{background:#f1e8df}.toast-item button:focus-visible{outline:2px solid #a45769}.toast-enter-from,.toast-leave-to{opacity:0!important;translate:30px 0}.toast-enter-active,.toast-leave-active{transition:opacity .22s,translate .3s}.toast-leave-active{pointer-events:none}
@media(prefers-reduced-motion:reduce){.toast-region,.toast-item,.toast-enter-active,.toast-leave-active{transition:none}}
</style>
