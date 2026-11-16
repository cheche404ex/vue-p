export const MARKET_DB_NAME = 'zhaoguisu-market-v1'
const STORE_NAME = 'state'
const STATE_KEY = 'market'
let connectionPromise

function storageError(error) {
  if (error?.name === 'QuotaExceededError') return new Error('本地存储空间不足，请减少图片数量或大小后重试。')
  return error instanceof Error ? error : new Error('无法保存本地数据，请检查浏览器存储权限。')
}

export function openMarketDatabase() {
  if (!globalThis.indexedDB) return Promise.reject(new Error('当前浏览器无法使用本地数据库，请使用 Chrome 正常窗口打开。'))
  if (!connectionPromise) {
    connectionPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(MARKET_DB_NAME, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
      request.onerror = () => { connectionPromise = null; reject(storageError(request.error)) }
      request.onblocked = () => { connectionPromise = null; reject(new Error('数据库被旧页面占用，请关闭其他旧版页面后重试。')) }
      request.onsuccess = () => {
        const db = request.result
        db.onversionchange = () => { db.close(); connectionPromise = null }
        resolve(db)
      }
    })
  }
  return connectionPromise
}

// A single readwrite transaction serializes stock checks and reservations across
// tabs. Mutators are deliberately synchronous so IndexedDB cannot auto-commit
// between the read and the write.
export async function updateMarketState(seedFactory, mutate) {
  const db = await openMarketDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(STATE_KEY)
    let state
    let result
    let failure
    request.onsuccess = () => {
      try {
        state = request.result || seedFactory()
        result = mutate ? mutate(state) : undefined
        if (result && typeof result.then === 'function') throw new Error('本地事务不能包含异步操作。')
        store.put(state, STATE_KEY)
      } catch (error) {
        failure = error
        transaction.abort()
      }
    }
    transaction.oncomplete = () => resolve({ state, result })
    transaction.onabort = () => reject(storageError(failure || transaction.error))
    transaction.onerror = () => { /* onabort reports a single useful error. */ }
  })
}

export async function readMarketState(seedFactory) {
  const db = await openMarketDatabase()
  const state = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).get(STATE_KEY)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(storageError(request.error))
  })
  return state || (await updateMarketState(seedFactory)).state
}

export async function closeMarketDatabase() {
  if (connectionPromise) (await connectionPromise).close()
  connectionPromise = null
}
