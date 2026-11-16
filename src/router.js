import {createRouter,createWebHistory} from 'vue-router'
import {useAuthStore} from './stores/auth'
const routes=[
 {path:'/',component:()=>import('./views/HomeView.vue')},{path:'/market',component:()=>import('./views/MarketView.vue')},{path:'/product/:id',component:()=>import('./views/ProductView.vue')},
 {path:'/publish/:id?',component:()=>import('./views/PublishView.vue'),meta:{auth:true}},{path:'/cart',component:()=>import('./views/CartView.vue'),meta:{auth:true}},{path:'/orders',component:()=>import('./views/OrdersView.vue'),meta:{auth:true}},{path:'/favorites',component:()=>import('./views/FavoritesView.vue'),meta:{auth:true}},{path:'/messages',component:()=>import('./views/MessagesView.vue'),meta:{auth:true}},{path:'/profile',component:()=>import('./views/ProfileView.vue'),meta:{auth:true}},
 {path:'/login',component:()=>import('./views/AuthView.vue')},{path:'/register',component:()=>import('./views/AuthView.vue')},{path:'/admin',component:()=>import('./views/AdminView.vue'),meta:{auth:true,admin:true}},{path:'/:pathMatch(.*)*',component:()=>import('./views/NotFoundView.vue')}
]
const router=createRouter({history:createWebHistory(),routes,scrollBehavior(to,from,saved){return saved||{top:0}}})
router.beforeEach(async to=>{const auth=useAuthStore();if(!auth.ready)await auth.init();else if(to.meta.auth)await auth.refresh();if(to.meta.auth&&!auth.user)return {path:'/login',query:{redirect:to.fullPath}};if(to.meta.admin&&auth.user?.role!=='admin')return '/';})
export default router
