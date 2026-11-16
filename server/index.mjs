import { createServer } from 'node:http'
import { createReadStream, existsSync, mkdirSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawn } from 'node:child_process'
import { createAccountService } from './accounts.mjs'

export const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const workspaceRoot = resolve(frontendRoot, '..')

const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp4': 'video/mp4',
}

export function configureRuntime() {
  const paths = {
    TEMP: join(workspaceRoot, '.runtime', 'tmp'),
    TMP: join(workspaceRoot, '.runtime', 'tmp'),
    SQLITE_TMPDIR: join(workspaceRoot, '.runtime', 'tmp'),
    NPM_CONFIG_CACHE: join(workspaceRoot, '.runtime', 'npm-cache'),
    NPM_CONFIG_LOGS_DIR: join(workspaceRoot, '.runtime', 'npm-logs'),
  }
  for (const [name, value] of Object.entries(paths)) {
    mkdirSync(value, { recursive: true })
    process.env[name] = value
  }
}

async function serveProduction(request, response, distRoot) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' })
    response.end('Method Not Allowed')
    return
  }
  let pathname
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname)
  } catch {
    response.writeHead(400)
    response.end('Bad Request')
    return
  }
  if (pathname.includes('\0')) {
    response.writeHead(400)
    response.end('Bad Request')
    return
  }
  let filePath = resolve(distRoot, `.${pathname}`)
  const inside = relative(distRoot, filePath)
  if (inside.startsWith('..') || isAbsolute(inside)) {
    response.writeHead(403)
    response.end('Forbidden')
    return
  }
  let fileStat = await stat(filePath).catch(() => null)
  if (fileStat?.isDirectory()) {
    filePath = join(filePath, 'index.html')
    fileStat = await stat(filePath).catch(() => null)
  }
  if (!fileStat?.isFile() && !extname(pathname)) {
    filePath = join(distRoot, 'index.html')
    fileStat = await stat(filePath).catch(() => null)
  }
  if (!fileStat?.isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('页面或资源不存在；请先运行 build.cmd')
    return
  }
  response.writeHead(200, {
    'Content-Type': mimeTypes[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': fileStat.size,
    'Cache-Control': relative(distRoot, filePath).startsWith(`assets${sep}`) && extname(filePath) !== '.html' ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  })
  if (request.method === 'HEAD') response.end()
  else createReadStream(filePath).on('error', () => response.destroy()).pipe(response)
}

export async function createApplication({ mode = 'development', databasePath = join(workspaceRoot, '.runtime', 'data', 'accounts.sqlite'), distRoot = join(frontendRoot, 'dist') } = {}) {
  configureRuntime()
  const accounts = createAccountService({ databasePath })
  let vite
  let closed = false
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://127.0.0.1').pathname
      if (pathname === '/api' || pathname.startsWith('/api/')) {
        const address = server.address()
        const port = typeof address === 'object' && address ? address.port : 5173
        await accounts.handle(request, response, { allowedOrigins: [`http://127.0.0.1:${port}`, `http://localhost:${port}`] })
        return
      }
      if (mode === 'production') await serveProduction(request, response, distRoot)
      else if (vite) vite.middlewares(request, response)
      else {
        response.writeHead(404)
        response.end('Not Found')
      }
    } catch (error) {
      console.error('[server]', error)
      if (!response.headersSent) response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('服务暂时不可用')
    }
  })

  try {
    if (mode === 'development') {
      const { createServer: createViteServer } = await import('vite')
      vite = await createViteServer({
        root: frontendRoot,
        cacheDir: join(workspaceRoot, '.runtime', 'vite-cache'),
        server: { middlewareMode: true, hmr: { server } },
        appType: 'spa',
      })
    }
  } catch (error) {
    accounts.close()
    throw error
  }

  return {
    server,
    async close() {
      if (closed) return
      closed = true
      if (vite) await vite.close()
      if (server.listening) await new Promise((resolveClose, reject) => {
        server.close((error) => error ? reject(error) : resolveClose())
        server.closeAllConnections()
      })
      accounts.close()
    },
  }
}

function launchChrome(url) {
  const candidates = [
    process.env.PROGRAMFILES && join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env['PROGRAMFILES(X86)'] && join(process.env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ].filter(Boolean)
  const chromePath = candidates.find(existsSync)
  if (!chromePath) {
    console.log(`未找到已安装的 Chrome。服务已经启动，可手动打开 ${url}。普通浏览器的缓存可能写入 C 盘。`)
    return
  }
  const profile = join(workspaceRoot, '.runtime', 'browser')
  const cache = join(workspaceRoot, '.runtime', 'chrome-cache')
  mkdirSync(profile, { recursive: true })
  mkdirSync(cache, { recursive: true })
  const browser = spawn(chromePath, [
    `--user-data-dir=${profile}`, `--disk-cache-dir=${cache}`,
    '--no-first-run', '--no-default-browser-check', '--disable-background-mode', '--disable-breakpad', '--disable-crash-reporter',
    '--new-window', url,
  ], { detached: true, stdio: 'ignore', windowsHide: false })
  browser.once('error', (error) => console.error(`Chrome 启动失败：${error.message}；可手动打开 ${url}`))
  browser.unref()
}

export async function main() {
  const mode = process.argv.includes('--production') ? 'production' : 'development'
  const port = Number(process.env.PORT ?? 5173)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT 必须是 1—65535 之间的端口号')
  if (mode === 'production' && !existsSync(join(frontendRoot, 'dist', 'index.html'))) throw new Error('尚未构建网页，请先在项目根目录运行 build.cmd')
  const app = await createApplication({ mode })
  try {
    await new Promise((resolveListen, reject) => {
      app.server.once('error', reject)
      app.server.listen(port, '127.0.0.1', resolveListen)
    })
  } catch (error) {
    await app.close()
    if (error.code === 'EADDRINUSE') throw new Error(`端口 ${port} 已被占用，请关闭已有服务或设置 PORT`)
    throw error
  }
  const url = `http://127.0.0.1:${port}`
  console.log(`\n找归宿 · 2027 毕业季\n${mode === 'production' ? '课堂演示' : '开发预览'}：${url}\n按 Ctrl+C 停止服务。数据库与缓存位于 ${join(workspaceRoot, '.runtime')}\n`)
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
    await app.close()
    process.exit(0)
  })
  if (process.argv.includes('--open-browser')) launchChrome(url)
  return app
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(`启动失败：${error.message}`)
    process.exitCode = 1
  })
}
