import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { createApplication, workspaceRoot } from './index.mjs'

const testsRoot = join(workspaceRoot, '.runtime', 'tests')

async function fixture(t, options = {}) {
  await mkdir(testsRoot, { recursive: true })
  const folder = await mkdtemp(join(testsRoot, 'accounts-'))
  const databasePath = join(folder, 'accounts.sqlite')
  const app = await createApplication({ mode: 'api', databasePath, ...options })
  await new Promise((resolveListen) => app.server.listen(0, '127.0.0.1', resolveListen))
  const origin = `http://127.0.0.1:${app.server.address().port}`
  t.after(async () => {
    await app.close()
    await rm(folder, { recursive: true, force: true })
  })
  async function request(path, { method = 'GET', body, cookie, origin: requestOrigin = origin, rawBody, headers = {} } = {}) {
    const response = await fetch(`${origin}${path}`, {
      method,
      headers: {
        ...(method !== 'GET' && method !== 'HEAD' ? { Origin: requestOrigin, 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
    })
    const text = await response.text()
    let data
    try { data = JSON.parse(text) } catch { data = text }
    return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers }
  }
  async function login(username = 'student01', password = 'Demo2027!') {
    const result = await request('/api/auth/login', { method: 'POST', body: { username, password } })
    assert.equal(result.status, 200)
    return result
  }
  return { app, folder, databasePath, origin, request, login }
}

test('账号注册、会话、资料与权限', async (t) => {
  const { request, login, databasePath } = await fixture(t)
  let registeredCookie
  let registeredId

  await t.test('预置账号与未登录状态', async () => {
    assert.deepEqual((await request('/api/auth/me')).data, { user: null })
    const student = await login()
    assert.deepEqual(Object.keys(student.data.user).sort(), ['college', 'createdAt', 'displayName', 'id', 'role', 'status', 'username'])
    assert.equal(student.data.user.id, 'student-1')
    assert.equal(student.data.user.displayName, '林小满')
    assert.equal(student.data.user.role, 'student')
    assert.match(student.headers.get('set-cookie'), /HttpOnly/)
    assert.match(student.headers.get('set-cookie'), /SameSite=Lax/)
    assert.match(student.headers.get('set-cookie'), /Max-Age=604800/)
    assert.equal((await request('/api/auth/me', { cookie: student.cookie })).data.user.id, 'student-1')
    assert.equal((await request('/api/auth/login', { method: 'POST', body: { username: 'student01', password: 'wrongpassword' } })).status, 401)
    assert.equal((await request('/api/admin/users', { cookie: student.cookie })).status, 403)
    assert.equal((await request('/api/admin/users')).status, 401)
  })

  await t.test('注册与资料验证，不能注入管理员角色', async () => {
    const body = { username: 'New_2027', password: 'Testing2027!', displayName: '夏日同学', college: '建筑工程学院', role: 'admin' }
    const invalid = await request('/api/auth/register', { method: 'POST', body: { ...body, college: '不存在学院' } })
    assert.equal(invalid.status, 400)
    assert.equal((await request('/api/auth/register', { method: 'POST', body: { ...body, username: 'a!' } })).status, 400)
    assert.equal((await request('/api/auth/register', { method: 'POST', body: { ...body, password: 'short' } })).status, 400)
    const created = await request('/api/auth/register', { method: 'POST', body })
    assert.equal(created.status, 201)
    assert.equal(created.data.user.username, 'new_2027')
    assert.equal(created.data.user.role, 'student')
    registeredCookie = created.cookie
    registeredId = created.data.user.id
    assert.equal((await request('/api/auth/register', { method: 'POST', body })).status, 409)
    const updated = await request('/api/auth/profile', { method: 'PATCH', cookie: registeredCookie, body: { displayName: '归宿新同学', college: '财会金融学院', role: 'admin' } })
    assert.equal(updated.status, 200)
    assert.equal(updated.data.user.displayName, '归宿新同学')
    assert.equal(updated.data.user.college, '财会金融学院')
    assert.equal(updated.data.user.role, 'student')
    assert.equal((await request('/api/auth/profile', { method: 'PATCH', cookie: registeredCookie, body: { displayName: '', college: '信息工程学院' } })).status, 400)
  })

  await t.test('管理员查询、停用会话、重新启用与自我停用保护', async () => {
    const admin = await login('admin', 'Admin2027!')
    const queried = await request('/api/admin/users?q=归宿新', { cookie: admin.cookie })
    assert.equal(queried.status, 200)
    assert.equal(queried.data.users.length, 1)
    assert.equal(queried.data.users[0].id, registeredId)
    assert.equal((await request('/api/admin/users?status=bogus', { cookie: admin.cookie })).status, 400)
    const disabled = await request(`/api/admin/users/${registeredId}/status`, { method: 'PATCH', cookie: admin.cookie, body: { status: 'disabled' } })
    assert.equal(disabled.status, 200)
    assert.equal(disabled.data.user.status, 'disabled')
    assert.deepEqual((await request('/api/auth/me', { cookie: registeredCookie })).data, { user: null })
    assert.equal((await request('/api/auth/profile', { method: 'PATCH', cookie: registeredCookie, body: { displayName: '失效会话', college: '信息工程学院' } })).status, 401)
    assert.equal((await request('/api/auth/login', { method: 'POST', body: { username: 'new_2027', password: 'Testing2027!' } })).status, 403)
    const filtered = await request('/api/admin/users?status=disabled', { cookie: admin.cookie })
    assert.equal(filtered.data.users.length, 1)
    assert.equal((await request('/api/admin/users/admin-1/status', { method: 'PATCH', cookie: admin.cookie, body: { status: 'disabled' } })).status, 400)
    assert.equal((await request(`/api/admin/users/${registeredId}/status`, { method: 'PATCH', cookie: admin.cookie, body: { status: 'active' } })).status, 200)
    registeredCookie = (await login('new_2027', 'Testing2027!')).cookie
  })

  await t.test('拒绝跨站请求、无来源写操作与无效 JSON', async () => {
    assert.equal((await request('/api/auth/logout', { method: 'POST', cookie: registeredCookie, origin: 'https://other.example' })).status, 403)
    assert.equal((await request('/api/auth/logout', { method: 'POST', cookie: registeredCookie, origin: '' })).status, 403)
    assert.equal((await request('/api/auth/login', { method: 'POST', rawBody: '{' })).status, 400)
    assert.equal((await request('/api/auth/login', { method: 'POST', body: { password: 'x'.repeat(17000) } })).status, 413)
    assert.equal((await request('/api/auth/login', { method: 'POST', rawBody: 'username=admin', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })).status, 415)
    assert.equal((await request('/api/auth/me', { cookie: registeredCookie })).data.user.id, registeredId)
  })

  await t.test('数据库只存密码哈希与令牌摘要，退出后会话失效', async () => {
    const database = new DatabaseSync(databasePath)
    try {
      const stored = database.prepare('SELECT passwordSalt, passwordHash FROM users WHERE id = ?').get(registeredId)
      assert.equal(stored.passwordSalt.length, 32)
      assert.equal(stored.passwordHash.length, 128)
      assert.notEqual(stored.passwordHash, 'Testing2027!')
      const sessionRows = database.prepare('SELECT tokenHash FROM sessions WHERE userId = ?').all(registeredId)
      const rawToken = registeredCookie.split('=')[1]
      assert.ok(sessionRows.length > 0)
      assert.ok(sessionRows.every((row) => row.tokenHash !== rawToken))
    } finally { database.close() }
    const logout = await request('/api/auth/logout', { method: 'POST', cookie: registeredCookie })
    assert.equal(logout.status, 200)
    assert.match(logout.headers.get('set-cookie'), /Max-Age=0/)
    assert.deepEqual((await request('/api/auth/me', { cookie: registeredCookie })).data, { user: null })
  })
})

test('账号与登录会话可跨服务重启保留，过期会话失效', async (t) => {
  const original = await fixture(t)
  const signedIn = await original.login()
  await original.app.close()
  const app = await createApplication({ mode: 'api', databasePath: original.databasePath })
  await new Promise((resolveListen) => app.server.listen(0, '127.0.0.1', resolveListen))
  try {
    const origin = `http://127.0.0.1:${app.server.address().port}`
    const response = await fetch(`${origin}/api/auth/me`, { headers: { Cookie: signedIn.cookie } })
    assert.equal((await response.json()).user.id, 'student-1')
    const database = new DatabaseSync(original.databasePath)
    database.prepare('UPDATE sessions SET expiresAt = 0').run()
    database.close()
    const expired = await fetch(`${origin}/api/auth/me`, { headers: { Cookie: signedIn.cookie } })
    assert.deepEqual(await expired.json(), { user: null })
  } finally { await app.close() }
})

test('生产模式提供页面、SPA 回退、静态资源与同源账号接口', async (t) => {
  await mkdir(testsRoot, { recursive: true })
  const distRoot = await mkdtemp(join(testsRoot, 'dist-'))
  await mkdir(join(distRoot, 'assets'))
  await writeFile(join(distRoot, 'index.html'), '<html><title>找归宿</title></html>', 'utf8')
  await writeFile(join(distRoot, 'assets', 'app.js'), 'console.log("2027")', 'utf8')
  t.after(() => rm(distRoot, { recursive: true, force: true }))
  const { origin, request } = await fixture(t, { mode: 'production', distRoot })
  assert.equal((await request('/')).status, 200)
  assert.equal((await request('/market')).data, await readFile(join(distRoot, 'index.html'), 'utf8'))
  const asset = await fetch(`${origin}/assets/app.js`)
  assert.match(asset.headers.get('content-type'), /javascript/)
  assert.match(asset.headers.get('cache-control'), /immutable/)
  assert.equal((await request('/assets/missing.png')).status, 404)
  assert.equal((await request('/api/auth/me')).data.user, null)
  assert.equal((await request('/', { method: 'POST', body: {} })).status, 405)
})
