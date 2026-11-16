<script setup>
import {computed} from 'vue'
import {useRouter} from 'vue-router'
import {useAuthStore} from '../stores/auth'
import {useMarketStore} from '../stores/market'
import {LOCATIONS} from '../data/seed'
import {action,money} from '../lib/ui'
import TiltCard from './TiltCard.vue'
import LikeButton from './LikeButton.vue'
import Icon from './Icon.vue'
const props=defineProps({product:Object})
const router=useRouter(),auth=useAuthStore(),market=useMarketStore()
const liked=computed(()=>auth.user&&market.userFavorites(auth.user.id).some(x=>x.id===props.product.id))
const place=computed(()=>LOCATIONS.find(x=>x.id===props.product.locationId)?.name||'校园面交')
function favorite(){if(!auth.user)return router.push({path:'/login',query:{redirect:router.currentRoute.value.fullPath}});action(()=>market.toggleFavorite(auth.user.id,props.product.id))}
</script>
<template><article class="product-card"><TiltCard><RouterLink :to="`/product/${product.id}`" class="product-image"><img :src="product.images?.[0]" :alt="product.title" loading="lazy"/><span class="condition-label">{{product.condition}}</span><span v-if="product.status!=='available'" class="stock-label">{{({reserved:'已被预订',sold:'已找到归宿',offline:'暂时下架'})[product.status]}}</span></RouterLink></TiltCard><div class="product-body"><div class="product-topline"><span class="product-college">{{product.college}}</span><LikeButton :model-value="!!liked" @update:model-value="favorite"/></div><RouterLink :to="`/product/${product.id}`" class="product-title">{{product.title}}</RouterLink><div class="product-price"><span><small>¥</small>{{money(product.price)}}</span><del>¥{{money(product.originalPrice)}}</del></div><div class="product-bottom"><span><span class="avatar-dot">{{product.sellerName?.slice(-2)}}</span>{{product.sellerName}}</span><span><Icon name="pin" :size="13"/>{{place}}</span></div></div></article></template>
