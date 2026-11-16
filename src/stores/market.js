import { defineStore } from 'pinia'
import { onScopeDispose, ref } from 'vue'
import { initialMarketData } from '../data/seed.js'
import { readMarketState, updateMarketState } from '../lib/db.js'
import {
  requireUser, requireActiveUser, createOrdersInState, transitionOrderInState,
  saveProductInState, removeProductInState, setProductStatusInState, resetProductForDemoInState,
} from './market-model.js'

export const useMarketStore = defineStore('market', () => {
  const products = ref([])
  const orders = ref([])
  const messages = ref([])
  const favorites = ref({})
  const carts = ref({})
  const profiles = ref({})
  const ready = ref(false)
  const syncError = ref('')
  const objectURLs = new Map()
  const originalBlobs = new Map()
  const sourceId = crypto.randomUUID()
  let initializing
  const channel = typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('zhaoguisu-market-updates') : null

  function renderImage(image, key) {
    if (!(image instanceof Blob)) return image
    if (objectURLs.has(key)) return objectURLs.get(key)
    const url = URL.createObjectURL(image)
    objectURLs.set(key, url)
    originalBlobs.set(url, image)
    return url
  }

  function applyState(state) {
    products.value = state.products.map(product => ({
      ...product,
      images: product.images.map((image, index) => renderImage(image, `${product.id}:${product.updatedAt || product.createdAt}:${index}`)),
    }))
    orders.value = state.orders.map(order => ({
      ...order,
      items: order.items.map(item => ({
        ...item,
        images: (item.images || []).map((image, index) => renderImage(image, `${order.id}:${item.id}:${index}`)),
      })),
    }))
    messages.value = state.messages
    favorites.value = state.favorites
    carts.value = state.carts
    profiles.value = state.profiles
    ready.value = true
    syncError.value = ''
  }

  async function reload() { applyState(await readMarketState(initialMarketData)) }

  function init() {
    if (!initializing) initializing = reload().catch(error => { initializing = null; throw error })
    return initializing
  }

  async function write(mutate) {
    const { state, result } = await updateMarketState(initialMarketData, mutate)
    applyState(state)
    channel?.postMessage({ sourceId, at: Date.now() })
    return result
  }

  if (channel) channel.onmessage = async event => {
    if (event.data?.sourceId === sourceId) return
    try { await reload() } catch (error) { syncError.value = error.message }
  }

  onScopeDispose(() => {
    channel?.close()
    objectURLs.forEach(url => URL.revokeObjectURL(url))
    objectURLs.clear()
    originalBlobs.clear()
  })

  const product = id => products.value.find(item => item.id === id)
  const userFavorites = userId => (favorites.value[userId] || []).map(product).filter(Boolean)
  const userCart = userId => (carts.value[userId] || []).map(product).filter(Boolean)
  const userOrders = userId => orders.value.filter(order => order.buyerId === userId || order.sellerId === userId)
  const thread = (userId, partnerId, productId) => messages.value.filter(message =>
    message.productId === productId && ((message.senderId === userId && message.receiverId === partnerId)
      || (message.senderId === partnerId && message.receiverId === userId)))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const unreadCount = userId => messages.value.filter(message => message.receiverId === userId && !message.read).length

  function conversations(userId) {
    const groups = new Map()
    messages.value.filter(message => message.senderId === userId || message.receiverId === userId).forEach(message => {
      const partnerId = message.senderId === userId ? message.receiverId : message.senderId
      const key = `${partnerId}:${message.productId}`
      let group = groups.get(key)
      if (!group) {
        group = { partnerId, partnerName: profiles.value[partnerId]?.displayName || '校园同学', productId: message.productId, lastMessage: '', updatedAt: '', unread: 0 }
        groups.set(key, group)
      }
      if (message.createdAt >= group.updatedAt) { group.lastMessage = message.text; group.updatedAt = message.createdAt }
      if (message.receiverId === userId && !message.read) group.unread++
    })
    return [...groups.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async function toggleFavorite(userId, productId) {
    requireUser(userId)
    return write(state => {
      if (!state.products.some(item => item.id === productId)) throw new Error('商品已不存在。')
      const list = state.favorites[userId] ||= []
      const index = list.indexOf(productId)
      if (index === -1) list.unshift(productId)
      else list.splice(index, 1)
      return index === -1
    })
  }

  async function addToCart(userId, productId) {
    requireUser(userId)
    return write(state => {
      requireActiveUser(state, userId)
      const item = state.products.find(candidate => candidate.id === productId)
      if (!item) throw new Error('商品已不存在。')
      if (item.sellerId === userId) throw new Error('不能购买自己发布的商品。')
      if (state.profiles[item.sellerId]?.status === 'disabled') throw new Error('卖家账号已停用，暂时无法购买这件物品。')
      if (item.status !== 'available') throw new Error('这件物品已被预约或暂不可购买。')
      const list = state.carts[userId] ||= []
      if (!list.includes(productId)) list.push(productId)
      return productId
    })
  }

  async function removeFromCart(userId, productId) {
    requireUser(userId)
    return write(state => { state.carts[userId] = (state.carts[userId] || []).filter(id => id !== productId) })
  }

  async function createOrders(userId, productIds, options) {
    const ids = await write(state => createOrdersInState(state, userId, productIds, options))
    return orders.value.filter(order => ids.includes(order.id))
  }

  async function transitionOrder(userId, orderId, action) {
    await write(state => transitionOrderInState(state, userId, orderId, action))
    return orders.value.find(order => order.id === orderId)
  }

  async function saveProduct(userId, input, id) {
    const images = (input.images || []).map(image => originalBlobs.get(image) || image)
    // Copy fields out of Vue proxies before structured cloning into IndexedDB.
    const values = {
      title: input.title, description: input.description, story: input.story,
      category: input.category, price: input.price, originalPrice: input.originalPrice,
      condition: input.condition, locationId: input.locationId, college: input.college,
      tags: input.tags ? Array.from(input.tags) : undefined, images,
    }
    const productId = await write(state => saveProductInState(state, userId, values, id))
    return product(productId)
  }

  async function removeProduct(userId, productId) {
    return write(state => removeProductInState(state, userId, productId))
  }

  async function setProductStatus(productId, status) {
    return write(state => setProductStatusInState(state, productId, status))
  }

  async function resetProductForDemo(productId) {
    return write(state => resetProductForDemoInState(state, productId))
  }

  async function setProfile(user) {
    if (!user) return
    const profile = {
      id: user.id, username: user.username, displayName: user.displayName,
      college: user.college, role: user.role, status: user.status,
    }
    const current = profiles.value[user.id]
    if (current && Object.keys(profile).every(key => current[key] === profile[key])) return
    return write(state => {
      state.profiles[user.id] = profile
      state.products.filter(item => item.sellerId === user.id).forEach(item => {
        item.sellerName = profile.displayName
        if (profile.college) item.college = profile.college
      })
    })
  }

  async function sendMessage(user, partnerId, productId, text) {
    requireUser(user?.id)
    if (user.id === partnerId) throw new Error('不能给自己发送消息。')
    const content = String(text || '').trim()
    if (!content || content.length > 2000) throw new Error('消息请填写 1–2000 个字。')
    const sender = { id: user.id, username: user.username, displayName: user.displayName, college: user.college, role: user.role, status: user.status }
    return write(state => {
      requireActiveUser(state, sender.id)
      if (!state.products.some(item => item.id === productId)) throw new Error('商品已不存在，无法发起新的消息。')
      if (!state.profiles[partnerId]) throw new Error('对方账号信息暂不可用。')
      if (state.profiles[partnerId].status === 'disabled') throw new Error('对方账号已停用，暂时无法发送消息。')
      state.profiles[sender.id] = sender
      const message = { id: `message-${crypto.randomUUID()}`, senderId: sender.id, receiverId: partnerId, productId, text: content, createdAt: new Date().toISOString(), read: false }
      state.messages.push(message)
      return message.id
    })
  }

  async function markRead(userId, partnerId, productId) {
    requireUser(userId)
    if (!messages.value.some(message => message.receiverId === userId && message.senderId === partnerId && message.productId === productId && !message.read)) return
    return write(state => {
      state.messages.filter(message => message.receiverId === userId && message.senderId === partnerId && message.productId === productId)
        .forEach(message => { message.read = true })
    })
  }

  return {
    products, orders, messages, favorites, carts, profiles, ready, syncError,
    init, reload, product, userFavorites, userCart, userOrders, conversations, thread, unreadCount,
    toggleFavorite, addToCart, removeFromCart, createOrders,
    payOrder: (userId, orderId) => transitionOrder(userId, orderId, 'pay'),
    cancelOrder: (userId, orderId) => transitionOrder(userId, orderId, 'cancel'),
    completeOrder: (userId, orderId) => transitionOrder(userId, orderId, 'complete'),
    saveProduct, removeProduct, setProductStatus, resetProductForDemo, setProfile, sendMessage, markRead,
  }
})
