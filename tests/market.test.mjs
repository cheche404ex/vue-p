import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { IDBFactory } from 'fake-indexeddb'
import { createPinia, disposePinia } from 'pinia'
import { useMarketStore } from '../src/stores/market.js'
import { closeMarketDatabase, readMarketState } from '../src/lib/db.js'
import { initialMarketData, PROFILES } from '../src/data/seed.js'

const piniaInstances = []
beforeEach(async () => {
  await closeMarketDatabase()
  globalThis.indexedDB = new IDBFactory()
})
afterEach(async () => {
  piniaInstances.splice(0).forEach(disposePinia)
  await closeMarketDatabase()
})

async function market() {
  const pinia = createPinia()
  piniaInstances.push(pinia)
  const store = useMarketStore(pinia)
  await store.init()
  return store
}

test('two concurrent buyers cannot reserve one item; cancellation releases it, payment and completion preserve ownership', async () => {
  const buyerOne = await market()
  const buyerTwo = await market()
  const outcomes = await Promise.allSettled([
    buyerOne.createOrders('student-2', ['product-01'], { locationId: 'library' }),
    buyerTwo.createOrders('student-3', ['product-01'], { locationId: 'library' }),
  ])
  assert.equal(outcomes.filter(outcome => outcome.status === 'fulfilled').length, 1)
  assert.equal(outcomes.filter(outcome => outcome.status === 'rejected').length, 1)
  let persisted = await readMarketState(initialMarketData)
  assert.equal(persisted.orders.length, 1)
  assert.equal(persisted.products[0].status, 'reserved')
  const originalOrder = persisted.orders[0]
  await buyerOne.cancelOrder(originalOrder.buyerId, originalOrder.id)
  assert.equal(buyerOne.product('product-01').status, 'available')
  const [order] = await buyerTwo.createOrders('student-3', ['product-01'], { locationId: 'teaching' })
  await assert.rejects(() => buyerTwo.completeOrder('student-3', order.id), /先完成模拟付款/)
  await assert.rejects(() => buyerTwo.payOrder('student-2', order.id), /只有买家/)
  await buyerTwo.payOrder('student-3', order.id)
  assert.equal(buyerTwo.product('product-01').status, 'reserved')
  await buyerTwo.completeOrder('student-3', order.id)
  persisted = await readMarketState(initialMarketData)
  assert.equal(persisted.products[0].status, 'sold')
  assert.equal(persisted.orders.find(item => item.id === order.id).status, 'completed')
  await assert.rejects(() => buyerOne.createOrders('student-2', ['product-01'], { locationId: 'library' }), /暂不可购买/)
})

test('checkout splits sellers and an invalid multi-item checkout rolls back all inventory changes', async () => {
  const store = await market()
  await store.addToCart('student-1', 'product-07')
  await store.addToCart('student-1', 'product-13')
  const orders = await store.createOrders('student-1', ['product-07', 'product-13'], { locationId: 'gate', note: '下课后见' })
  assert.equal(orders.length, 2)
  assert.deepEqual(new Set(orders.map(order => order.sellerId)), new Set(['student-2', 'student-3']))
  assert.equal(store.userCart('student-1').length, 0)
  assert.ok(orders.every(order => order.items.length === 1 && order.note === '下课后见'))
  await assert.rejects(() => store.createOrders('student-1', ['product-08', 'product-01'], { locationId: 'gate' }), /不能购买自己/)
  await store.reload()
  assert.equal(store.product('product-08').status, 'available')
  assert.equal(store.orders.length, 2)
})

test('favorites, carts, message threads and read markers remain isolated by account after database reload', async () => {
  const store = await market()
  await store.toggleFavorite('student-1', 'product-07')
  await store.toggleFavorite('student-2', 'product-13')
  await store.addToCart('student-1', 'product-07')
  await store.addToCart('student-2', 'product-13')
  const beforeUnread = store.unreadCount('student-2')
  await store.sendMessage(PROFILES[0], 'student-2', 'product-07', '请问可以在教学楼交接吗？')
  assert.equal(store.unreadCount('student-2'), beforeUnread + 1)
  await store.sendMessage(PROFILES[1], 'student-1', 'product-07', '可以的，下课后见。')
  const reloaded = await market()
  assert.deepEqual(reloaded.userFavorites('student-1').map(item => item.id), ['product-07'])
  assert.deepEqual(reloaded.userFavorites('student-2').map(item => item.id), ['product-13'])
  assert.deepEqual(reloaded.userCart('student-1').map(item => item.id), ['product-07'])
  assert.equal(reloaded.userCart('student-3').length, 0)
  assert.equal(reloaded.thread('student-1', 'student-2', 'product-07').length, 2)
  assert.equal(reloaded.thread('student-3', 'student-2', 'product-07').length, 0)
  await reloaded.markRead('student-2', 'student-1', 'product-07')
  assert.equal(reloaded.unreadCount('student-2'), beforeUnread)
  assert.equal(reloaded.conversations('student-1')[0].lastMessage, '可以的，下课后见。')
})

test('published image Blobs survive IndexedDB reload and subsequent editing without persisting temporary URLs', async () => {
  const store = await market()
  const bytes = new Uint8Array([255, 216, 255, 224, 1, 2, 3, 255, 217])
  const image = new Blob([bytes], { type: 'image/jpeg' })
  const newUser = { id: 'new-student', username: 'newuser', displayName: '新同学', college: '信息工程学院', role: 'student', status: 'active' }
  await store.setProfile(newUser)
  const product = await store.saveProduct(newUser.id, {
    title: '毕业带不走的台灯', description: '已经清洁完毕，可以现场通电检查。',
    category: 'living', price: 20, originalPrice: 59, condition: '轻微使用',
    locationId: 'library', images: [image],
  })
  assert.match(product.images[0], /^blob:/)
  let persisted = await readMarketState(initialMarketData)
  let rawImage = persisted.products.find(item => item.id === product.id).images[0]
  assert.ok(rawImage instanceof Blob)
  assert.deepEqual(new Uint8Array(await rawImage.arrayBuffer()), bytes)
  const reloaded = await market()
  const visible = reloaded.product(product.id)
  await reloaded.saveProduct(newUser.id, { ...visible, title: '毕业台灯，附电源线' }, visible.id)
  persisted = await readMarketState(initialMarketData)
  rawImage = persisted.products.find(item => item.id === product.id).images[0]
  assert.ok(rawImage instanceof Blob)
  assert.equal(persisted.products.find(item => item.id === product.id).sellerName, '新同学')
})

test('moderation prevents purchase while offline and cannot break a live reservation', async () => {
  const store = await market()
  await store.setProductStatus('product-07', 'offline')
  await assert.rejects(() => store.addToCart('student-1', 'product-07'), /暂不可购买/)
  await store.setProductStatus('product-07', 'available')
  const [order] = await store.createOrders('student-1', ['product-07'], { locationId: 'library' })
  await assert.rejects(() => store.setProductStatus('product-07', 'offline'), /进行中订单/)
  await assert.rejects(() => store.removeProduct('student-2', 'product-07'), /不能删除/)
  await assert.rejects(() => store.saveProduct('student-2', { ...store.product('product-07'), price: 1 }, 'product-07'), /不能编辑/)
  await store.cancelOrder('student-1', order.id)
  await store.setProductStatus('product-07', 'offline')
  assert.equal(store.product('product-07').status, 'offline')
})

test('administrative demo reset cancels an entire unpaid or paid order and preserves unrelated reservations', async () => {
  const store = await market()
  const [unrelated] = await store.createOrders('student-1', ['product-07'], { locationId: 'library' })
  await store.payOrder('student-1', unrelated.id)
  for (const [ids, paid] of [[['product-01', 'product-02'], false], [['product-03', 'product-04'], true]]) {
    const [order] = await store.createOrders('student-2', ids, { locationId: 'library' })
    if (paid) await store.payOrder('student-2', order.id)
    await assert.rejects(() => store.setProductStatus(ids[0], 'available'), /进行中订单/)
    const result = await store.resetProductForDemo(ids[0])
    assert.deepEqual(result, { productId: ids[0], cancelledOrderCount: 1, releasedProductCount: 2 })
    await store.reload()
    assert.equal(store.orders.find(item => item.id === order.id).status, 'cancelled')
    assert.match(store.orders.find(item => item.id === order.id).cancelReason, /管理员/)
    assert.ok(ids.every(id => store.product(id).status === 'available'))
    assert.equal(store.orders.find(item => item.id === unrelated.id).status, 'paid')
    assert.equal(store.product('product-07').status, 'reserved')
  }
})

test('administrative demo relisting preserves completed history and permits another purchase', async () => {
  const store = await market()
  const [first] = await store.createOrders('student-2', ['product-01'], { locationId: 'library' })
  await store.payOrder('student-2', first.id)
  await store.completeOrder('student-2', first.id)
  const snapshot = JSON.parse(JSON.stringify(store.orders.find(order => order.id === first.id).items))
  const result = await store.resetProductForDemo('product-01')
  assert.deepEqual(result, { productId: 'product-01', cancelledOrderCount: 0, releasedProductCount: 1 })
  assert.equal(store.product('product-01').status, 'available')
  assert.equal(store.orders.find(order => order.id === first.id).status, 'completed')
  assert.deepEqual(store.orders.find(order => order.id === first.id).items, snapshot)
  const [second] = await store.createOrders('student-3', ['product-01'], { locationId: 'gate' })
  await store.payOrder('student-3', second.id)
  await store.completeOrder('student-3', second.id)
  await store.reload()
  assert.equal(store.orders.filter(order => order.status === 'completed' && order.productIds.includes('product-01')).length, 2)
  assert.equal(store.product('product-01').status, 'sold')
})

test('disabled buyers and sellers cannot create or pay for new transactions', async () => {
  const store = await market()
  const [order] = await store.createOrders('student-1', ['product-07'], { locationId: 'library' })
  await store.setProfile({ ...PROFILES[1], status: 'disabled' })
  await assert.rejects(() => store.addToCart('student-1', 'product-08'), /卖家账号已停用/)
  await assert.rejects(() => store.createOrders('student-1', ['product-08'], { locationId: 'library' }), /卖家账号已停用/)
  await assert.rejects(() => store.payOrder('student-1', order.id), /卖家账号已停用/)
  await store.cancelOrder('student-1', order.id)
  await store.setProfile({ ...PROFILES[1], status: 'active' })
  await store.setProfile({ ...PROFILES[0], status: 'disabled' })
  await assert.rejects(() => store.addToCart('student-1', 'product-08'), /账号已停用/)
  await assert.rejects(() => store.createOrders('student-1', ['product-08'], { locationId: 'library' }), /账号已停用/)
})

test('upload storage matches five-image and eight-megabyte UI limits', async () => {
  const store = await market()
  const input = {
    title: '课堂展示图片边界', description: '测试真实本地图片在发布和编辑之间的存储约束。',
    category: 'living', price: 20, originalPrice: 59, condition: '轻微使用', locationId: 'library',
    images: [new Blob([new Uint8Array(6 * 1024 * 1024)], { type: 'image/jpeg' })],
  }
  const saved = await store.saveProduct('student-1', input)
  assert.ok(saved.images[0].startsWith('blob:'))
  await assert.rejects(() => store.saveProduct('student-1', { ...input, images: Array(6).fill('/images/products/01.jpg') }), /1–5/)
  await assert.rejects(() => store.saveProduct('student-1', { ...input, images: [new Blob([new Uint8Array(8 * 1024 * 1024 + 1)], { type: 'image/jpeg' })] }), /8MB/)
})
