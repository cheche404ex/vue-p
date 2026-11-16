<script setup>
import {computed} from 'vue'
import {useAuthStore} from '../stores/auth'
import {useMarketStore} from '../stores/market'
import ProductCard from '../components/ProductCard.vue'
import Icon from '../components/Icon.vue'
const auth=useAuthStore(),market=useMarketStore(),items=computed(()=>market.userFavorites(auth.user.id))
</script>
<template><div class="page-width inner-page"><div class="page-title"><span class="eyebrow">A LITTLE COLLECTION OF JOY</span><h1>这些喜欢，先替你收好。</h1><p>共 {{items.length}} 件收藏。心动的时刻，值得被记住。</p></div><div v-if="items.length" class="product-grid"><ProductCard v-for="product in items" :key="product.id" :product="product"/></div><div v-else class="panel empty-state"><Icon name="heart" :size="48"/><h2>把喜欢，轻轻放在这里</h2><p>逛市集时点一下爱心，就能收藏心动的闲置。</p><RouterLink to="/market" class="button primary">去寻找小小欢喜<Icon name="arrow" :size="17"/></RouterLink></div></div></template>
