import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { createApplication, workspaceRoot } from '../server/index.mjs'

const runtimeRoot = join(workspaceRoot, '.runtime')
const temporaryRoot = join(runtimeRoot, 'tmp')
process.env.TEMP = temporaryRoot
process.env.TMP = temporaryRoot
process.env.PWTEST_CACHE_DIR = join(runtimeRoot, 'playwright', 'transform-cache')
await mkdir(temporaryRoot, { recursive: true })
const { chromium } = await import('@playwright/test')
const testsRoot = join(runtimeRoot, 'tests')
await mkdir(testsRoot, { recursive: true })
const folder = await mkdtemp(join(testsRoot, 'production-'))
const app = await createApplication({ mode: 'production', databasePath: join(folder, 'accounts.sqlite') })
let browser
let context
let failure

try {
  await new Promise((done, reject) => {
    app.server.once('error', reject)
    app.server.listen(5174, '127.0.0.1', done)
  })
  browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    downloadsPath: join(runtimeRoot, 'playwright', 'production-downloads'),
    args: ['--disable-breakpad', '--disable-crash-reporter', '--disable-background-mode'],
  })
  context = await browser.newContext({ baseURL: 'http://127.0.0.1:5174', viewport: { width: 1440, height: 1000 }, locale: 'zh-CN', reducedMotion: 'reduce' })
  await context.tracing.start({ screenshots: true, snapshots: true })
  const page = await context.newPage()
  const pageErrors = []
  const externalRequests = []
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('request', request => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:5174/')) externalRequests.push(request.url())
  })
  await page.goto('/')
  await page.getByRole('link', { name: '找归宿首页' }).waitFor()
  await page.getByRole('heading', { level: 1 }).waitFor()
  assert.doesNotMatch(await page.content(), /@vite\/client/)
  await page.screenshot({ path: join(workspaceRoot, 'screenshots', 'production-home.jpg'), type: 'jpeg', quality: 75, animations: 'disabled' })

  await page.goto('/market')
  await page.getByLabel('搜索商品', { exact: true }).waitFor()
  await page.locator('.product-card').first().waitFor()
  await page.screenshot({ path: join(workspaceRoot, 'screenshots', 'production-market.jpg'), type: 'jpeg', quality: 75, animations: 'disabled' })
  const images = await page.evaluate(async () => {
    const urls = ['/images/campus-map.jpg', '/images/garden-painting.jpg', ...Array.from({ length: 24 }, (_, index) => `/images/products/${String(index + 1).padStart(2, '0')}.jpg`)]
    return Promise.all(urls.map(url => new Promise(resolveImage => {
      const image = new Image()
      image.onload = () => resolveImage({ url, ok: image.naturalWidth > 0 })
      image.onerror = () => resolveImage({ url, ok: false })
      image.src = url
    })))
  })
  assert.equal(images.length, 26)
  assert.ok(images.every(image => image.ok), `本地图片必须可以解码：${JSON.stringify(images.filter(image => !image.ok))}`)

  await page.goto('/product/product-01')
  await page.getByRole('heading', { name: '读过的书，还想遇见你', level: 1 }).waitFor()
  await page.goto('/login')
  await page.getByLabel('用户名', { exact: true }).fill('student02')
  await page.getByLabel('密码', { exact: true }).fill('Demo2027!')
  await page.getByRole('button', { name: '登录，继续相遇' }).click()
  await page.waitForURL('**/profile')
  assert.match(await page.getByRole('heading', { level: 1 }).innerText(), /陈知夏/)
  const me = await context.request.get('/api/auth/me')
  assert.equal(me.status(), 200)
  assert.equal((await me.json()).user.id, 'student-2')
  assert.deepEqual(externalRequests, [], '生产页面不应请求外网素材')
  assert.deepEqual(pageErrors, [], '生产页面不应产生未捕获脚本错误')
  await context.tracing.stop()
  console.log('Production smoke PASS: 127.0.0.1:5174; homepage, SPA deep routes, UI login, same-origin API; 26 local images decoded; no external requests/page errors.')
} catch (error) {
  failure = error
  if (context) await context.tracing.stop({ path: join(runtimeRoot, 'playwright', 'production-smoke-failure.zip') }).catch(() => {})
} finally {
  if (browser) await browser.close()
  await app.close()
  if (!folder.startsWith(`${testsRoot}${sep}`)) throw new Error('拒绝清理测试目录外的路径')
  await rm(folder, { recursive: true, force: true })
}
if (failure) throw failure
