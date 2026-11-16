<script setup>
import { ref, watch } from 'vue'
import { LOCATIONS } from '../data/seed'
import Icon from './Icon.vue'
const props=defineProps({modelValue:String,compact:Boolean})
const emit=defineEmits(['update:modelValue'])
const current=ref(props.modelValue||'library')
watch(()=>props.modelValue,value=>{if(value)current.value=value})
function select(id){current.value=id;emit('update:modelValue',id)}
</script>
<template>
  <div class="campus-layout" :class="{compact}">
    <div class="map-canvas">
      <!-- The image and its hotspots share one natural-ratio coordinate layer. -->
      <div class="map-image-layer">
        <img src="/images/campus-map.jpg" alt="江西职业技术大学濂溪校区手绘地图" />
        <button
          v-for="location in LOCATIONS"
          :key="location.id"
          type="button"
          class="map-point"
          :class="{selected:current===location.id,'label-left':location.x>.72,'label-above':location.y>.88}"
          :style="{left:`${location.x*100}%`,top:`${location.y*100}%` }"
          @click="select(location.id)"
          :aria-label="`选择${location.name}`"
          :aria-pressed="current===location.id"
        >
          <Icon name="pin" :size="20" />
          <span>{{location.name}}</span>
        </button>
      </div>
    </div>
    <aside class="map-locations">
      <span class="eyebrow">MEET AT LIANXI</span>
      <h3>在校园，安心相见。</h3>
      <p>选一个熟悉的地方，<br>让旧物遇见下一位主人。</p>
      <button v-for="location in LOCATIONS" :key="location.id" type="button" :class="['location-option',{active:current===location.id}]" @click="select(location.id)">
        <Icon name="pin" :size="17" />{{location.name}}<Icon v-if="current===location.id" name="check" :size="16" />
      </button>
      <div class="map-tip"><Icon name="shield" :size="18" /><span>建议白天在公共区域面交<br>当面检查物品，再确认收货。</span></div>
    </aside>
  </div>
</template>

<style scoped>
.map-canvas{overflow:visible}
.map-image-layer{position:relative;width:100%;line-height:0}
.map-image-layer>img{display:block;width:100%;height:auto;max-height:none;border-radius:5px;filter:saturate(.62)}
.map-point{width:28px;height:28px;padding:0;justify-content:center;flex-shrink:0}
.map-point>span{position:absolute;left:calc(100% + 6px);top:50%;transform:translateY(-50%);padding:6px 8px;border:1px solid #e1c3c1;border-radius:4px;background:#fff9ec;color:#9b6871;font-size:10px;line-height:1;pointer-events:none;box-shadow:0 2px 8px #5b423126}
.map-point.label-left>span{left:auto;right:calc(100% + 6px)}
.map-point.label-above>span{left:50%;right:auto;top:auto;bottom:calc(100% + 6px);transform:translateX(-50%)}
.compact .map-canvas{max-height:none}
.compact .map-point>span{font-size:10px}
</style>
