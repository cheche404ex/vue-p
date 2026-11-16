import { CATEGORIES, COLLEGES, LOCATIONS } from '../data/seed.js'

export function requireUser(userId) {
  if (!userId || typeof userId !== 'string') throw new Error('请先登录后再操作。')
}

export function requireActiveUser(state, userId) {
  requireUser(userId)
  if (state.profiles[userId]?.status === 'disabled') throw new Error('账号已停用，请联系管理员。')
}

function findProduct(state, productId) {
  const product = state.products.find(item => item.id === productId)
  if (!product) throw new Error('这件物品已不存在。')
  return product
}

function orderOf(state, orderId) {
  const order = state.orders.find(item => item.id === orderId)
  if (!order) throw new Error('订单不存在。')
  return order
}

function profileName(state, userId) {
  return state.profiles[userId]?.displayName || '校园同学'
}

export function hasActiveOrder(state, productId) {
  return state.orders.some(order => ['unpaid', 'paid'].includes(order.status) && order.productIds.includes(productId))
}

export function createOrdersInState(state, userId, productIds, { locationId, note = '' } = {}) {
  requireActiveUser(state, userId)
  if (!LOCATIONS.some(location => location.id === locationId)) throw new Error('请选择地图中的交接地点。')
  const ids = [...new Set(productIds)]
  if (!ids.length) throw new Error('请先选择需要购买的商品。')
  const products = ids.map(id => {
    const product = findProduct(state, id)
    if (product.sellerId === userId) throw new Error('不能购买自己发布的商品。')
    if (state.profiles[product.sellerId]?.status === 'disabled') throw new Error('卖家账号已停用，暂时无法购买这件物品。')
    if (product.status !== 'available' || hasActiveOrder(state, id)) throw new Error(`“${product.title}”已被预约或暂不可购买。`)
    return product
  })
  const bySeller = Map.groupBy(products, product => product.sellerId)
  const createdAt = new Date().toISOString()
  const orders = Array.from(bySeller, ([sellerId, items]) => ({
    id: `order-${crypto.randomUUID()}`, buyerId: userId, sellerId,
    buyerName: profileName(state, userId), sellerName: profileName(state, sellerId),
    productIds: items.map(item => item.id),
    items: items.map(item => ({ id: item.id, title: item.title, price: item.price, images: item.images.slice(0, 1), sellerId: item.sellerId })),
    amount: Math.round(items.reduce((sum, item) => sum + item.price, 0) * 100) / 100,
    locationId, note: String(note).trim().slice(0, 300), status: 'unpaid',
    createdAt, paidAt: null, completedAt: null,
  }))
  products.forEach(product => { product.status = 'reserved' })
  state.orders.unshift(...orders)
  state.carts[userId] = (state.carts[userId] || []).filter(id => !ids.includes(id))
  return orders.map(order => order.id)
}

export function transitionOrderInState(state, userId, orderId, action) {
  requireActiveUser(state, userId)
  const order = orderOf(state, orderId)
  if (action === 'pay') {
    if (order.buyerId !== userId) throw new Error('只有买家可以进行模拟付款。')
    if (order.status !== 'unpaid') throw new Error('当前订单无法付款，请刷新订单状态。')
    if (state.profiles[order.sellerId]?.status === 'disabled') throw new Error('卖家账号已停用，请取消此订单。')
    for (const id of order.productIds) {
      if (findProduct(state, id).status !== 'reserved') throw new Error('订单商品状态异常，请先取消订单。')
    }
    order.status = 'paid'
    order.paidAt = new Date().toISOString()
  } else if (action === 'cancel') {
    if (![order.buyerId, order.sellerId].includes(userId)) throw new Error('不能操作其他同学的订单。')
    if (!['unpaid', 'paid'].includes(order.status)) throw new Error('当前订单无法取消。')
    order.status = 'cancelled'
    order.cancelledAt = new Date().toISOString()
    order.productIds.forEach(id => { findProduct(state, id).status = 'available' })
  } else if (action === 'complete') {
    if (order.buyerId !== userId) throw new Error('请由买家确认已完成面交。')
    if (order.status !== 'paid') throw new Error('请先完成模拟付款，再确认面交。')
    order.status = 'completed'
    order.completedAt = new Date().toISOString()
    order.productIds.forEach(id => { findProduct(state, id).status = 'sold' })
  } else throw new Error('不支持的订单操作。')
  return order.id
}

export function saveProductInState(state, userId, input, id) {
  requireActiveUser(state, userId)
  const existing = id ? findProduct(state, id) : null
  if (existing && existing.sellerId !== userId) throw new Error('只能编辑自己发布的商品。')
  if (existing && (hasActiveOrder(state, existing.id) || ['reserved', 'sold'].includes(existing.status))) {
    throw new Error('已预约或已售商品不能编辑，请先处理订单。')
  }
  const title = String(input.title || '').trim()
  const description = String(input.description || '').trim()
  if (title.length < 2 || title.length > 60) throw new Error('商品标题请填写 2–60 个字。')
  if (description.length < 5 || description.length > 2000) throw new Error('商品描述请填写 5–2000 个字。')
  if (!CATEGORIES.some(category => category.id === input.category)) throw new Error('请选择商品分类。')
  if (!LOCATIONS.some(location => location.id === input.locationId)) throw new Error('请选择交接地点。')
  const price = Math.round(Number(input.price) * 100) / 100
  if (!Number.isFinite(price) || price <= 0 || price > 99999) throw new Error('价格需大于 0 且不超过 99999 元。')
  const originalPrice = input.originalPrice === '' || input.originalPrice == null ? price : Math.round(Number(input.originalPrice) * 100) / 100
  if (!Number.isFinite(originalPrice) || originalPrice < price) throw new Error('原价不能低于转让价。')
  if (!['全新', '几乎全新', '轻微使用', '正常使用'].includes(input.condition)) throw new Error('请选择物品成色。')
  if (!Array.isArray(input.images) || !input.images.length || input.images.length > 5) throw new Error('请上传 1–5 张商品图片。')
  input.images.forEach(image => {
    if (image instanceof Blob) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type)) throw new Error('图片仅支持 JPG、PNG、WebP 格式。')
      if (image.size === 0 || image.size > 8 * 1024 * 1024) throw new Error('每张图片需大于 0 字节且控制在 8MB 以内。')
    } else if (typeof image !== 'string' || !image.startsWith('/images/products/')) {
      throw new Error('请重新选择有效的商品图片。')
    }
  })
  const profile = state.profiles[userId]
  const college = profile?.college || input.college || COLLEGES[0]
  if (!COLLEGES.includes(college)) throw new Error('请选择所属学院。')
  const product = {
    id: existing?.id || `product-${crypto.randomUUID()}`,
    title, description, story: String(input.story || '').trim().slice(0, 500),
    category: input.category, price, originalPrice, condition: input.condition,
    college, sellerId: userId, sellerName: profileName(state, userId),
    locationId: input.locationId, images: input.images,
    status: existing?.status || 'available',
    createdAt: existing?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(),
    tags: Array.isArray(input.tags) ? input.tags.map(String).slice(0, 3) : ['毕业转让', '校内面交'],
  }
  if (existing) state.products.splice(state.products.indexOf(existing), 1, product)
  else state.products.unshift(product)
  return product.id
}

export function removeProductInState(state, userId, productId) {
  requireUser(userId)
  const product = findProduct(state, productId)
  if (product.sellerId !== userId) throw new Error('只能删除自己发布的商品。')
  if (hasActiveOrder(state, productId) || ['reserved', 'sold'].includes(product.status)) throw new Error('存在订单或已售商品不能删除。')
  state.products = state.products.filter(item => item.id !== productId)
  for (const ids of Object.values(state.carts)) { const index = ids.indexOf(productId); if (index !== -1) ids.splice(index, 1) }
}

export function setProductStatusInState(state, productId, status) {
  const product = findProduct(state, productId)
  if (!['available', 'offline'].includes(status)) throw new Error('商品只能下架或恢复上架。')
  if (hasActiveOrder(state, productId) || ['reserved', 'sold'].includes(product.status)) throw new Error('有进行中订单或已售商品无法调整上架状态。')
  if (status === 'available' && product.status !== 'offline') throw new Error('只有已下架商品可以恢复。')
  product.status = status
  return productId
}

// Classroom-only administrative reset. Cancelling the whole seller order keeps
// its item reservations consistent; completed order snapshots remain history.
export function resetProductForDemoInState(state, productId) {
  const product = findProduct(state, productId)
  if (!['reserved', 'sold'].includes(product.status)) throw new Error('只有已预订或已售商品需要演示重置。')
  const activeOrders = state.orders.filter(order =>
    ['unpaid', 'paid'].includes(order.status) && order.productIds.includes(productId))
  const releasedIds = new Set([productId])
  for (const order of activeOrders) {
    order.productIds.forEach(id => releasedIds.add(id))
    transitionOrderInState(state, order.buyerId, order.id, 'cancel')
    order.cancelReason = '管理员为课堂演示重置商品'
  }
  product.status = 'available'
  return { productId, cancelledOrderCount: activeOrders.length, releasedProductCount: releasedIds.size }
}
