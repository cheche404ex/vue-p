import { randomBytes, randomUUID, scrypt, scryptSync, timingSafeEqual, createHash } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { promisify } from 'node:util'

const deriveKey = promisify(scrypt)
const COOKIE_NAME = 'zgs_session'
const SESSION_MS = 7 * 24 * 60 * 60 * 1000
const MAX_BODY_BYTES = 16 * 1024

export const COLLEGES = ['信息工程学院', '建筑工程学院', '经济管理学院', '财会金融学院']
export const DEMO_ACCOUNTS = [
  { id: 'student-1', username: 'student01', displayName: '林小满', college: COLLEGES[0], role: 'student', password: 'Demo2027!' },
  { id: 'student-2', username: 'student02', displayName: '陈知夏', college: COLLEGES[1], role: 'student', password: 'Demo2027!' },
  { id: 'student-3', username: 'student03', displayName: '许星野', college: COLLEGES[2], role: 'student', password: 'Demo2027!' },
  { id: 'student-4', username: 'student04', displayName: '周予安', college: COLLEGES[3], role: 'student', password: 'Demo2027!' },
  { id: 'admin-1', username: 'admin', displayName: '归宿管理员', college: COLLEGES[0], role: 'admin', password: 'Admin2027!' },
]

class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function publicUser(row) {
  if (!row) return null
  const { id, username, displayName, college, role, status, createdAt } = row
  return { id, username, displayName, college, role, status, createdAt }
}

function sendJson(response, status, payload, headers = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  })
  response.end(JSON.stringify(payload))
}

async function readJson(request) {
  if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] ?? '')) {
    throw new ApiError(415, '请使用 JSON 格式提交信息')
  }
  const chunks = []
  let size = 0
  if (Number(request.headers['content-length']) > MAX_BODY_BYTES) {
    request.resume()
    throw new ApiError(413, '提交的信息过长')
  }
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) {
      request.resume()
      throw new ApiError(413, '提交的信息过长')
    }
    chunks.push(chunk)
  }
  let value
  try {
    value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new ApiError(400, '提交的信息格式不正确')
  }
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new ApiError(400, '请提交有效的信息')
  return value
}

function validateProfile(input) {
  const displayName = typeof input.displayName === 'string' ? input.displayName.trim() : ''
  if (displayName.length < 1 || displayName.length > 20) throw new ApiError(400, '昵称需为 1—20 个字符')
  if (!COLLEGES.includes(input.college)) throw new ApiError(400, '请选择正确的学院')
  return { displayName, college: input.college }
}

function normalizeUsername(input) {
  return typeof input === 'string' ? input.trim().toLowerCase() : ''
}

function tokenDigest(token) {
  return createHash('sha256').update(token).digest('hex')
}

function readToken(request) {
  const cookie = (request.headers.cookie ?? '').split(';').map((item) => item.trim()).find((item) => item.startsWith(`${COOKIE_NAME}=`))
  const token = cookie?.slice(COOKIE_NAME.length + 1) ?? ''
  return /^[a-f0-9]{64}$/.test(token) ? token : null
}

function sessionCookie(token, maxAge) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`
}

export function createAccountService({ databasePath, clock = Date.now, sessionDurationMs = SESSION_MS }) {
  mkdirSync(dirname(databasePath), { recursive: true })
  const database = new DatabaseSync(databasePath)
  database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA temp_store = MEMORY;
    PRAGMA busy_timeout = 3000;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      displayName TEXT NOT NULL,
      college TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('student', 'admin')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'disabled')),
      createdAt TEXT NOT NULL,
      passwordSalt TEXT NOT NULL,
      passwordHash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      tokenHash TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expiresAt INTEGER NOT NULL,
      createdAt INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(userId);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expiresAt);
  `)

  const findUser = database.prepare('SELECT * FROM users WHERE id = ?')
  const findUsername = database.prepare('SELECT * FROM users WHERE username = ?')
  const insertUser = database.prepare('INSERT INTO users (id, username, displayName, college, role, status, createdAt, passwordSalt, passwordHash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  database.exec('BEGIN')
  try {
    for (const seed of DEMO_ACCOUNTS) {
      if (findUser.get(seed.id) || findUsername.get(seed.username)) continue
      const salt = randomBytes(16).toString('hex')
      insertUser.run(seed.id, seed.username, seed.displayName, seed.college, seed.role, 'active', new Date(clock()).toISOString(), salt, scryptSync(seed.password, salt, 64).toString('hex'))
    }
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    database.close()
    throw error
  }

  function currentUser(request) {
    const token = readToken(request)
    if (!token) return null
    const row = database.prepare('SELECT users.* FROM sessions JOIN users ON users.id = sessions.userId WHERE sessions.tokenHash = ? AND sessions.expiresAt > ? AND users.status = ?').get(tokenDigest(token), clock(), 'active')
    return publicUser(row)
  }

  function requireUser(request, adminOnly = false) {
    const user = currentUser(request)
    if (!user) throw new ApiError(401, '请先登录，或重新登录已失效的账号')
    if (adminOnly && user.role !== 'admin') throw new ApiError(403, '此操作需要管理员权限')
    return user
  }

  function createSession(userId) {
    database.prepare('DELETE FROM sessions WHERE expiresAt <= ?').run(clock())
    const token = randomBytes(32).toString('hex')
    database.prepare('INSERT INTO sessions (tokenHash, userId, expiresAt, createdAt) VALUES (?, ?, ?, ?)').run(tokenDigest(token), userId, clock() + sessionDurationMs, clock())
    return sessionCookie(token, Math.floor(sessionDurationMs / 1000))
  }

  async function handle(request, response, { allowedOrigins }) {
    let url
    try {
      url = new URL(request.url, 'http://127.0.0.1')
    } catch {
      sendJson(response, 400, { error: '请求地址不正确' })
      return
    }
    try {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
        if (!request.headers.origin || !allowedOrigins.includes(request.headers.origin)) throw new ApiError(403, '请求来源不正确，请从本站页面操作')
      }
      if (url.pathname === '/api/auth/me' && request.method === 'GET') {
        const user = currentUser(request)
        sendJson(response, 200, { user }, !user && readToken(request) ? { 'Set-Cookie': sessionCookie('', 0) } : {})
        return
      }
      if (url.pathname === '/api/auth/register' && request.method === 'POST') {
        const body = await readJson(request)
        const username = normalizeUsername(body.username)
        if (!/^[a-z0-9_]{3,24}$/.test(username)) throw new ApiError(400, '账号需为 3—24 位字母、数字或下划线')
        if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) throw new ApiError(400, '密码需为 8—128 个字符')
        const profile = validateProfile(body)
        if (findUsername.get(username)) throw new ApiError(409, '这个账号已被使用，换一个试试')
        const salt = randomBytes(16).toString('hex')
        const hash = (await deriveKey(body.password, salt, 64)).toString('hex')
        const id = `student-${randomUUID()}`
        try {
          insertUser.run(id, username, profile.displayName, profile.college, 'student', 'active', new Date(clock()).toISOString(), salt, hash)
        } catch (error) {
          if (findUsername.get(username)) throw new ApiError(409, '这个账号已被使用，换一个试试')
          throw error
        }
        sendJson(response, 201, { user: publicUser(findUser.get(id)) }, { 'Set-Cookie': createSession(id) })
        return
      }
      if (url.pathname === '/api/auth/login' && request.method === 'POST') {
        const body = await readJson(request)
        const row = findUsername.get(normalizeUsername(body.username))
        if (!row || typeof body.password !== 'string' || body.password.length > 128) throw new ApiError(401, '账号或密码不正确')
        const hash = await deriveKey(body.password, row.passwordSalt, 64)
        if (!timingSafeEqual(hash, Buffer.from(row.passwordHash, 'hex'))) throw new ApiError(401, '账号或密码不正确')
        if (row.status !== 'active') throw new ApiError(403, '账号已被停用，请联系管理员')
        sendJson(response, 200, { user: publicUser(row) }, { 'Set-Cookie': createSession(row.id) })
        return
      }
      if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
        const token = readToken(request)
        if (token) database.prepare('DELETE FROM sessions WHERE tokenHash = ?').run(tokenDigest(token))
        sendJson(response, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0) })
        return
      }
      if (url.pathname === '/api/auth/profile' && request.method === 'PATCH') {
        const user = requireUser(request)
        const profile = validateProfile(await readJson(request))
        database.prepare('UPDATE users SET displayName = ?, college = ? WHERE id = ?').run(profile.displayName, profile.college, user.id)
        sendJson(response, 200, { user: publicUser(findUser.get(user.id)) })
        return
      }
      if (url.pathname === '/api/admin/users' && request.method === 'GET') {
        requireUser(request, true)
        const status = url.searchParams.get('status') ?? ''
        if (status && !['active', 'disabled'].includes(status)) throw new ApiError(400, '用户状态不正确')
        const query = (url.searchParams.get('q') ?? '').trim().toLowerCase()
        const users = database.prepare('SELECT * FROM users ORDER BY createdAt DESC, username ASC').all()
          .filter((user) => !status || user.status === status)
          .filter((user) => !query || `${user.username} ${user.displayName} ${user.college}`.toLowerCase().includes(query))
          .map(publicUser)
        sendJson(response, 200, { users })
        return
      }
      const statusMatch = /^\/api\/admin\/users\/([^/]+)\/status$/.exec(url.pathname)
      if (statusMatch && request.method === 'PATCH') {
        const admin = requireUser(request, true)
        let targetId
        try { targetId = decodeURIComponent(statusMatch[1]) } catch { throw new ApiError(400, '用户标识不正确') }
        const body = await readJson(request)
        if (!['active', 'disabled'].includes(body.status)) throw new ApiError(400, '用户状态不正确')
        if (!findUser.get(targetId)) throw new ApiError(404, '没有找到这个用户')
        if (admin.id === targetId && body.status === 'disabled') throw new ApiError(400, '不能停用当前管理员账号')
        database.exec('BEGIN')
        try {
          database.prepare('UPDATE users SET status = ? WHERE id = ?').run(body.status, targetId)
          if (body.status === 'disabled') database.prepare('DELETE FROM sessions WHERE userId = ?').run(targetId)
          database.exec('COMMIT')
        } catch (error) {
          database.exec('ROLLBACK')
          throw error
        }
        sendJson(response, 200, { user: publicUser(findUser.get(targetId)) })
        return
      }
      throw new ApiError(404, '没有找到这个接口')
    } catch (error) {
      if (!(error instanceof ApiError)) console.error('[accounts]', error)
      sendJson(response, error instanceof ApiError ? error.status : 500, { error: error instanceof ApiError ? error.message : '操作暂时没有完成，请稍后重试' })
    }
  }

  return { handle, close: () => database.close() }
}
