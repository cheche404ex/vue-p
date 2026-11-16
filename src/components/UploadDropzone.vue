<script setup>
// Bencho UploadDropzone's gulp/refusal feedback, now driven by actual image files.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { prefersReducedMotion } from '../lib/motion.js'
const props = defineProps({ modelValue: { type: Array, default: () => [] } })
const emit = defineEmits(['update:modelValue', 'error'])
const input = ref(null)
const zone = ref(null)
const dragging = ref(false)
const busy = ref(false)
const gulp = ref(false)
const objectUrls = new Map()
let gulpTimer
let dragDepth = 0
const remaining = computed(() => Math.max(0, 5 - props.modelValue.length))
function imageSource(image) {
  if (typeof image === 'string') return image
  if (image instanceof Blob) {
    if (!objectUrls.has(image)) objectUrls.set(image, URL.createObjectURL(image))
    return objectUrls.get(image)
  }
  return image?.url || image?.src || ''
}
watch(() => props.modelValue, images => {
  for (const [image, url] of objectUrls) if (!images.includes(image)) { URL.revokeObjectURL(url); objectUrls.delete(image) }
})
function fail(message) {
  emit('error', message)
  if (!prefersReducedMotion()) zone.value?.animate([0, -7, 6, -4, 2, 0].map(x => ({ transform: `translateX(${x}px)` })), { duration: 420 })
}
async function addFiles(list) {
  if (busy.value) return
  const files = Array.from(list || [])
  if (!files.length) return
  if (!remaining.value) { fail('最多上传 5 张照片，请先删除一张。'); return }
  busy.value = true
  const accepted = []
  try {
    for (const file of files.slice(0, remaining.value)) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { fail('请选择 JPG、PNG 或 WebP 格式的真实图片。'); continue }
      if (file.size === 0 || file.size > 8 * 1024 * 1024) { fail('每张照片需大于 0 字节且不超过 8 MB。'); continue }
      const header = new Uint8Array(await file.slice(0, 12).arrayBuffer())
      const jpeg = header[0] === 255 && header[1] === 216 && header[2] === 255
      const png = header[0] === 137 && header[1] === 80 && header[2] === 78 && header[3] === 71
      const webp = String.fromCharCode(...header.slice(0, 4)) === 'RIFF' && String.fromCharCode(...header.slice(8, 12)) === 'WEBP'
      if (!jpeg && !png && !webp) { fail('这份文件无法识别为图片，请换一张照片。'); continue }
      // Decode locally before accepting, rather than trusting a filename or fake progress.
      try { const bitmap = await createImageBitmap(file); bitmap.close() } catch { fail('照片读取失败，请重新选择有效图片。'); continue }
      accepted.push(file)
    }
    if (files.length > remaining.value) fail('最多上传 5 张照片，超出的照片未添加。')
    if (accepted.length) {
      emit('update:modelValue', [...props.modelValue, ...accepted])
      gulp.value = true
      clearTimeout(gulpTimer)
      gulpTimer = setTimeout(() => { gulp.value = false }, 650)
    }
  } catch { fail('照片读取失败，请重新选择。') }
  finally { busy.value = false; if (input.value) input.value.value = '' }
}
function drop(event) { dragDepth = 0; dragging.value = false; addFiles(event.dataTransfer?.files) }
function enter() { dragDepth++; dragging.value = true }
function leave() { dragDepth--; if (dragDepth <= 0) { dragging.value = false; dragDepth = 0 } }
function remove(index) { emit('update:modelValue', props.modelValue.filter((_, i) => i !== index)) }
onBeforeUnmount(() => { clearTimeout(gulpTimer); for (const url of objectUrls.values()) URL.revokeObjectURL(url) })
</script>

<template>
  <section class="upload-section" @dragenter.prevent="enter" @dragover.prevent @dragleave.prevent="leave" @drop.prevent="drop">
    <input ref="input" class="file-input" type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label="选择商品照片" @change="addFiles($event.target.files)" />
    <button ref="zone" class="upload-zone" :class="{ dragging, gulp }" type="button" :disabled="busy || !remaining" @click="input?.click()">
      <span class="upload-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M12 16V4m-4 4 4-4 4 4M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></svg></span>
      <strong>{{ busy ? '正在读取照片…' : dragging ? '松开，留下物品最好的样子' : remaining ? '拖入照片，或点击上传' : '已添加 5 张照片' }}</strong>
      <span>JPG / PNG / WebP · 每张不超过 8 MB · 最多 5 张</span>
    </button>
    <div v-if="modelValue.length" class="image-previews">
      <div v-for="(image, index) in modelValue" :key="index" class="image-preview"><img :src="imageSource(image)" :alt="`商品照片 ${index + 1}`"/><span v-if="index === 0" class="cover-label">封面</span><button type="button" :aria-label="`删除第 ${index + 1} 张照片`" @click="remove(index)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>
    </div>
    <p class="upload-caption">第一张会成为封面；清晰的实拍，更容易为它找到新主人。</p>
  </section>
</template>

<style scoped>
.upload-section{min-width:0}.file-input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}.upload-zone{box-sizing:border-box;width:100%;min-height:172px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;border:1px dashed #cdaab1;border-radius:14px;background:#fcf8f2;color:#8c7470;font:inherit;cursor:pointer;transition:background .25s,transform .38s cubic-bezier(.3,1.36,.4,1),border-color .25s}.upload-zone strong{font-size:14px;font-weight:500;color:#a45769}.upload-zone>span:last-child{font-size:11px;letter-spacing:.5px}.upload-icon{color:#a45769;transition:transform .35s}.upload-zone.dragging{transform:scale(1.015);border-color:#a45769;background:#faeceb}.dragging .upload-icon{transform:translateY(-5px)}.upload-zone:focus-visible{outline:2px solid #a45769;outline-offset:4px}.upload-zone:disabled{cursor:default;opacity:.65}.upload-zone.gulp{animation:gulp .6s cubic-bezier(.3,1.36,.4,1)}.image-previews{display:flex;flex-wrap:wrap;gap:12px;margin-top:15px}.image-preview{position:relative;width:94px;height:94px;border:1px solid #ebddd3;border-radius:10px;background:#f4eee5}.image-preview img{width:100%;height:100%;object-fit:cover;border-radius:9px}.image-preview button{position:absolute;right:-6px;top:-6px;width:23px;height:23px;display:grid;place-items:center;border:1px solid #e1c6c8;border-radius:50%;background:#fcf8f2;color:#a45769;cursor:pointer}.cover-label{position:absolute;left:5px;bottom:5px;padding:3px 5px;border-radius:4px;background:#fcf8f2ec;color:#8e6570;font-size:9px}.upload-caption{font-size:11px;color:#9b8981;margin:12px 0 0;line-height:1.7}
@keyframes gulp{0%,100%{transform:scale(1)}30%{transform:scale(.985)}65%{transform:scale(1.012)}}
@media(prefers-reduced-motion:reduce){.upload-zone,.upload-icon{transition:none;animation:none!important;transform:none!important}}
</style>
