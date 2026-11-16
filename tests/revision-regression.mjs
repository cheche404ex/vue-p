import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { createApplication, workspaceRoot } from '../server/index.mjs'
import { LOCATIONS } from '../src/data/seed.js'

const runtimeRoot = join(workspaceRoot, '.runtime')
const temporaryRoot = join(runtimeRoot, 'tmp')
const testsRoot = join(runtimeRoot, 'tests')
const screenshotsRoot = join(workspaceRoot, 'screenshots')
for (const folder of [temporaryRoot, testsRoot, screenshotsRoot]) await mkdir(folder, { recursive: true })
process.env.TEMP = temporaryRoot
process.env.TMP = temporaryRoot
process.env.PWTEST_CACHE_DIR = join(runtimeRoot, 'playwright', 'transform-cache')
process.env.NODE_COMPILE_CACHE = join(runtimeRoot, 'node-compile-cache')
const { chromium, expect } = await import('@playwright/test')
const folder = await mkdtemp(join(testsRoot, 'revision-'))
const app = await createApplication({ mode: 'production', databasePath: join(folder, 'accounts.sqlite') })
let browser, context, page, failure
const pageErrors = []
const checks = []

async function login(username) {
  await page.goto('/login')
  await page.getByLabel('用户名', { exact: true }).fill(username)
  await page.getByLabel('密码', { exact: true }).fill(username === 'admin' ? 'Admin2027!' : 'Demo2027!')
  await page.getByRole('button', { name: '登录，继续相遇', exact: true }).click()
  await expect(page).toHaveURL(username === 'admin' ? /\/admin$/ : /\/profile$/)
}

async function logout() {
  await page.goto('/profile')
  await page.getByRole('button', { name: '退出登录', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
}

async function picture(name, locator = page) {
  await locator.screenshot({ path: join(screenshotsRoot, `revision-${name}.jpg`), type: 'jpeg', quality: 73, animations: 'disabled' })
}

async function checkMap(width) {
  await page.setViewportSize({ width, height: 1000 })
  await page.goto('/publish')
  await page.getByRole('button', { name: '在地图上选', exact: true }).click()
  const map = page.locator('.campus-layout.compact')
  await map.waitFor()
  await map.locator('.map-image-layer > img').evaluate(image => image.decode())
  await page.evaluate(() => {
    window.__revisionPublishSubmits = 0
    document.querySelector('.publish-form').addEventListener('submit', () => window.__revisionPublishSubmits++)
  })
  const metrics = await map.evaluate((element, locations) => {
    const canvas = element.querySelector('.map-canvas')
    const image = canvas.querySelector('img')
    const canvasRect = canvas.getBoundingClientRect(), imageRect = image.getBoundingClientRect()
    const markers = locations.map(location => {
      const button = [...canvas.querySelectorAll('.map-point')].find(item => item.getAttribute('aria-label') === `选择${location.name}`)
      const rect = button.querySelector('svg').getBoundingClientRect()
      return {
        name: location.name,
        xError: Math.abs(rect.x + rect.width / 2 - (imageRect.x + imageRect.width * location.x)),
        yError: Math.abs(rect.y + rect.height / 2 - (imageRect.y + imageRect.height * location.y)),
        type: button.getAttribute('type'),
      }
    })
    return {
      width: imageRect.width, height: imageRect.height,
      expectedHeight: imageRect.width * image.naturalHeight / image.naturalWidth,
      clipping: Math.max(0, imageRect.bottom - canvasRect.bottom),
      markers,
    }
  }, LOCATIONS)
  assert.ok(Math.abs(metrics.height - metrics.expectedHeight) <= 2, `地图应保持原图比例：${JSON.stringify(metrics)}`)
  assert.ok(metrics.clipping <= 2, `地图不应被容器裁切：${JSON.stringify(metrics)}`)
  for (const marker of metrics.markers) {
    assert.equal(marker.type, 'button', `${marker.name}不应提交发布表单`)
    assert.ok(marker.xError <= 2 && marker.yError <= 2, `${width}px 地图热点应与原图一致：${JSON.stringify(marker)}`)
  }
  const pin = map.getByRole('button', { name: '选择实训楼', exact: true })
  const relativePinPosition = () => pin.evaluate(button => {
    const icon = button.querySelector('svg').getBoundingClientRect()
    const image = button.parentElement.querySelector('img').getBoundingClientRect()
    return { x: icon.x - image.x, y: icon.y - image.y }
  })
  const before = await relativePinPosition()
  await pin.click()
  await expect(pin).toHaveClass(/selected/)
  const after = await relativePinPosition()
  assert.ok(Math.abs(before.x - after.x) <= 1 && Math.abs(before.y - after.y) <= 1, `选中热点显示标签后，图钉中心不能移动：${JSON.stringify({ before, after })}`)
  await page.locator('#item-location').selectOption('gate')
  await expect(map.getByRole('button', { name: '选择大门口', exact: true })).toHaveClass(/selected/)
  await page.locator('#item-location').selectOption('tianming')
  await expect(pin).toHaveClass(/selected/)
  await expect(page.locator('#item-location option:checked')).toHaveText('实训楼')
  assert.equal(await page.evaluate(() => window.__revisionPublishSubmits), 0, '地图选择不能提交发布表单')
  await expect(page).toHaveURL(/\/publish$/)
  await map.scrollIntoViewIfNeeded()
  await picture(`publish-map-${width}`, map)
  checks.push({ name: `publish-map-${width}`, ...metrics })
}

async function buyAndPay({ complete = false } = {}) {
  await page.goto('/product/product-01')
  await expect(page.getByRole('button', { name: '加入购物车', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: '加入购物车', exact: true }).click()
  await page.goto('/cart')
  await page.getByLabel('在哪里见面').selectOption('tianming')
  await page.getByRole('button', { name: '下一步，生成订单', exact: true }).click()
  await expect(page).toHaveURL(/\/orders$/)
  const order = page.locator('.order-card').filter({ hasText: '读过的书，还想遇见你' }).first()
  await expect(order.locator('.order-status')).toHaveText('待模拟付款')
  await order.getByRole('button', { name: '模拟付款', exact: true }).click()
  const modal = page.getByRole('dialog', { name: '确认订单操作', exact: true })
  await modal.getByRole('button', { name: '确认模拟付款', exact: true }).click()
  await expect(order.locator('.order-status')).toHaveText('待面交')
  if (complete) {
    await order.getByRole('button', { name: '确认已完成面交', exact: true }).click()
    await modal.getByRole('button', { name: '已验货，确认完成', exact: true }).click()
    await expect(order.locator('.order-status')).toHaveText('已完成')
  }
}

async function resetAsAdmin(expectedStatus, expectsCancellation) {
  await logout()
  await login('admin')
  await page.getByRole('button', { name: '商品管理', exact: true }).click()
  await page.getByLabel('搜索管理商品', { exact: true }).fill('读过的书，还想遇见你')
  const row = page.getByRole('row').filter({ hasText: '读过的书，还想遇见你' })
  await expect(row.locator('.tag')).toHaveText(expectedStatus)
  await row.getByRole('button', { name: '重置为在售（演示）', exact: true }).click()
  const modal = page.getByRole('dialog', { name: '重置商品演示状态', exact: true })
  if (expectsCancellation) await expect(modal).toContainText('将取消 1 笔关联的未完成模拟订单')
  await expect(modal).toContainText('已完成订单的历史记录会保留')
  await modal.getByRole('button', { name: '确认重置为在售', exact: true }).click()
  await expect(row.locator('.tag')).toHaveText('正在转让')
  await page.reload()
  await page.getByRole('button', { name: '商品管理', exact: true }).click()
  await page.getByLabel('搜索管理商品', { exact: true }).fill('读过的书，还想遇见你')
  await expect(row.locator('.tag')).toHaveText('正在转让')
  await picture(expectsCancellation ? 'admin-reset-paid' : 'admin-reset-completed')
  await logout()
  await login('student02')
}

try {
  await new Promise((done, reject) => {
    app.server.once('error', reject)
    app.server.listen(0, '127.0.0.1', done)
  })
  const baseURL = `http://127.0.0.1:${app.server.address().port}`
  browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    downloadsPath: join(folder, 'downloads'),
    args: [`--disk-cache-dir=${join(folder, 'chrome-cache')}`, '--disable-breakpad', '--disable-crash-reporter', '--disable-background-mode'],
  })
  context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', locale: 'zh-CN' })
  await context.tracing.start({ screenshots: true, snapshots: true })
  page = await context.newPage()
  page.on('pageerror', error => pageErrors.push(error.message))
  await login('student02')
  await checkMap(1280)
  await checkMap(1440)
  await buyAndPay()
  await resetAsAdmin('已被预订', true)
  await page.goto('/orders')
  await expect(page.locator('.order-card').filter({ hasText: '读过的书，还想遇见你' }).first().locator('.order-status')).toHaveText('已取消')
  checks.push({ name: 'paid-reset-cancels-order-and-releases-product', pass: true })
  await buyAndPay({ complete: true })
  await resetAsAdmin('已找到归宿', false)
  await page.goto('/orders')
  const history = page.locator('.order-card').filter({ hasText: '读过的书，还想遇见你' })
  await expect(history).toHaveCount(2)
  await expect(history.first().locator('.order-status')).toHaveText('已完成')
  await expect(history.last().locator('.order-status')).toHaveText('已取消')
  await buyAndPay()
  checks.push({ name: 'completed-reset-preserves-history-and-allows-repurchase', pass: true })
  await picture('repurchase-after-reset')
  assert.deepEqual(pageErrors, [], '修复流程不得产生未捕获页面错误')
  await context.tracing.stop()
  await writeFile(join(runtimeRoot, 'revision-regression-results.json'), JSON.stringify({ pass: true, observedAt: new Date().toISOString(), baseURL, checks, pageErrors }, null, 2))
  console.log(JSON.stringify({ pass: true, checks: checks.map(check => check.name), pageErrors }))
} catch (error) {
  failure = error
  if (page) await picture('failure').catch(() => {})
  if (context) await context.tracing.stop({ path: join(runtimeRoot, 'playwright', 'revision-regression-failure.zip') }).catch(() => {})
  await writeFile(join(runtimeRoot, 'revision-regression-results.json'), JSON.stringify({ pass: false, observedAt: new Date().toISOString(), error: error.stack, checks, pageErrors }, null, 2))
} finally {
  if (browser) await browser.close()
  await app.close()
  if (!folder.startsWith(`${testsRoot}${sep}`)) throw new Error('拒绝清理项目测试目录外的路径')
  await rm(folder, { recursive: true, force: true })
}
if (failure) throw failure
