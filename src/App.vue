<script setup>
import {computed,onMounted,onUnmounted,ref,watch} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import {useAuthStore} from './stores/auth'
import {useMarketStore} from './stores/market'
import {ui,dismiss} from './lib/ui'
import Icon from './components/Icon.vue'
import ToastStack from './components/ToastStack.vue'
import IntroSplash from './components/IntroSplash.vue'
import CampusMap from './components/CampusMap.vue'
const auth=useAuthStore(),market=useMarketStore(),route=useRoute(),router=useRouter()
const loading=ref(true),error=ref(''),intro=ref(false),search=ref('')
const cartCount=computed(()=>auth.user?market.userCart(auth.user.id).length:0)
const unread=computed(()=>auth.user?market.unreadCount(auth.user.id):0)
function closeIntro(){intro.value=false;sessionStorage.setItem('guishu-intro-seen','1')}
function replay(){intro.value=true}
function searchNow(){router.push({path:'/market',query:search.value?{q:search.value}:{}})}
function reload(){window.location.reload()}
async function refresh(){try{await auth.refresh();if(auth.user)await market.setProfile(auth.user);else if(route.meta.auth)router.replace({path:'/login',query:{redirect:route.fullPath}})}catch{}}
onMounted(async()=>{try{await Promise.all([market.init(),auth.init()]);if(auth.user)await market.setProfile(auth.user);intro.value=!sessionStorage.getItem('guishu-intro-seen')&&!matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){error.value=e.message}finally{loading.value=false}window.addEventListener('focus',refresh)})
onUnmounted(()=>window.removeEventListener('focus',refresh))
watch(()=>auth.user?.id,()=>{if(auth.user)market.setProfile(auth.user)})
watch(()=>ui.mapOpen,v=>{document.body.style.overflow=v?'hidden':''})
</script>
<template>
 <div class="announcement"><div class="page-width"><span><Icon name="leaf" :size="13"/>旧物有归宿，青春不散场。</span><span>江西职业技术大学 · 濂溪校区 <i/> 2027 毕业季特别企划</span><span>只在校园里，遇见刚刚好。</span></div></div>
 <header class="site-header"><div class="page-width header-inner"><RouterLink to="/" class="brand" aria-label="找归宿首页"><span class="brand-mark"><Icon name="home" :size="32"/><span>♡</span></span><span class="brand-word">找归宿<small>ZHAO GUI SU</small></span></RouterLink><nav class="main-nav"><RouterLink to="/" :class="{active:route.path==='/'}">首页</RouterLink><RouterLink to="/market" :class="{active:route.path.startsWith('/market')||route.path.startsWith('/product')}">逛市集</RouterLink><button @click="ui.mapOpen=true">校园地图<span class="tiny-new">LIANXI</span></button></nav><form class="header-search" @submit.prevent="searchNow"><Icon name="search" :size="17"/><input v-model="search" aria-label="搜索闲置" placeholder="寻一件心动的闲置…"/><kbd>↵</kbd></form><div class="header-actions"><RouterLink to="/favorites" class="icon-button" title="我的收藏" aria-label="我的收藏"><Icon name="heart"/></RouterLink><RouterLink to="/cart" class="icon-button" title="购物车" aria-label="购物车"><Icon name="cart"/><b v-if="cartCount">{{cartCount}}</b></RouterLink><RouterLink to="/messages" class="icon-button" title="消息" aria-label="消息"><Icon name="message"/><b v-if="unread">{{unread}}</b></RouterLink><RouterLink v-if="auth.user" to="/profile" class="header-user" :title="auth.user.displayName"><span class="avatar small">{{auth.user.displayName?.slice(-2)}}</span></RouterLink><RouterLink v-else to="/login" class="login-link">登录 / 注册</RouterLink><RouterLink to="/publish" class="button primary publish-header"><Icon name="plus" :size="17"/>发布闲置</RouterLink></div></div></header>
 <div v-if="loading" class="page-loading"><span class="loading-flower">✳</span><p>正在为美好寻找归宿…</p></div>
 <div v-else-if="error" class="page-width empty-state"><Icon name="info" :size="40"/><h2>暂时没能打开市集</h2><p>{{error}}</p><button class="button primary" @click="reload">重新加载</button></div>
 <main v-else><RouterView v-if="!route.meta.auth||auth.user" v-slot="{Component}"><Transition name="page" mode="out-in"><component :is="Component" :key="route.path" @replay-intro="replay"/></Transition></RouterView></main>
 <footer class="site-footer"><div class="page-width footer-main"><div><RouterLink to="/" class="footer-brand">找归宿<span>让每一份喜欢，都有下一站。</span></RouterLink><p>从一个人的校园回忆，到另一个人的生活日常。<br>在濂溪，把美好轻轻传下去。</p></div><div class="footer-links"><div><h4>在这里逛逛</h4><RouterLink to="/market">校园闲置市集</RouterLink><RouterLink to="/publish">为旧物找归宿</RouterLink><button @click="ui.mapOpen=true">校内交接地图</button></div><div><h4>关于这个夏天</h4><RouterLink to="/orders">我的校园订单</RouterLink><button @click="replay">重看毕业季开场</button><RouterLink v-if="auth.user?.role==='admin'" to="/admin">市集管理后台</RouterLink><RouterLink v-else to="/login">账号与个人中心</RouterLink></div></div><div class="footer-note"><Icon name="leaf" :size="34"/><span>GOOD THINGS<br>DESERVE ANOTHER CHAPTER.</span><small>旧物循环 · 校园面交 · 温柔相遇</small></div></div><div class="page-width footer-bottom"><span>© 2027 找归宿 · 江西职业技术大学濂溪校区</span><span>个人课堂展示作品 · 所有支付均为模拟</span><span>MADE WITH A LITTLE LOVE <span class="pink">♡</span></span></div></footer>
 <Teleport to="body"><ToastStack :items="ui.toasts" @dismiss="dismiss"/><IntroSplash :visible="intro" @close="closeIntro"/><div v-if="ui.mapOpen" class="modal-overlay" @click.self="ui.mapOpen=false" @keydown.esc="ui.mapOpen=false"><section class="modal map-modal" role="dialog" aria-modal="true" aria-label="校园交接地图"><button class="modal-close icon-button" @click="ui.mapOpen=false" aria-label="关闭地图"><Icon name="close"/></button><CampusMap :model-value="ui.mapLocation"/></section></div></Teleport>
</template>
