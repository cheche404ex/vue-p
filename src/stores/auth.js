import { defineStore } from 'pinia'
import { ref } from 'vue'

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`/api${path}`, {
      credentials: 'same-origin',
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    })
  } catch {
    throw new Error('暂时无法连接账号服务，请确认本地服务已启动。')
  }
  let data
  try { data = await response.json() } catch { throw new Error('账号服务返回异常，请稍后重试。') }
  if (!response.ok) throw new Error(data.error || '操作失败，请稍后重试。')
  return data
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const ready = ref(false)
  const loading = ref(false)
  let initializing

  async function refresh() {
    const data = await request('/auth/me')
    user.value = data.user
    ready.value = true
    return user.value
  }

  function init() {
    if (!initializing) initializing = refresh().catch(error => { initializing = null; throw error })
    return initializing
  }

  async function authenticate(action, values) {
    loading.value = true
    try {
      const data = await request(`/auth/${action}`, { method: 'POST', body: JSON.stringify(values) })
      user.value = data.user
      ready.value = true
      return user.value
    } finally { loading.value = false }
  }

  async function logout() {
    await request('/auth/logout', { method: 'POST', body: '{}' })
    user.value = null
  }

  async function updateProfile(values) {
    const data = await request('/auth/profile', { method: 'PATCH', body: JSON.stringify(values) })
    user.value = data.user
    return user.value
  }

  async function fetchUsers({ q = '', status = '' } = {}) {
    const query = new URLSearchParams({ q, status })
    return (await request(`/admin/users?${query}`)).users
  }

  async function setUserStatus(id, status) {
    return (await request(`/admin/users/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })).user
  }

  return {
    user, ready, loading, init, refresh,
    login: values => authenticate('login', values),
    register: values => authenticate('register', values),
    logout, updateProfile, fetchUsers, setUserStatus,
  }
})
