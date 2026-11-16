import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const runRoot = path.join(projectRoot, '.runtime', 'tests', 'new-chat')
const temporaryRoot = path.join(runRoot, 'tmp')
const screenshot = path.join(projectRoot, 'screenshots', 'new-chat.jpg')
for (const directory of [temporaryRoot, path.join(runRoot, 'cache'), path.join(runRoot, 'downloads'), path.dirname(screenshot)]) {
  await fs.mkdir(directory, { recursive: true })
}
process.env.TEMP = temporaryRoot
process.env.TMP = temporaryRoot
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(projectRoot, '.runtime', 'playwright')

const { chromium, expect } = await import('@playwright/test')
const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  downloadsPath: path.join(runRoot, 'downloads'),
  args: [`--disk-cache-dir=${path.join(runRoot, 'cache')}`, '--no-first-run', '--no-default-browser-check'],
})
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce',
  locale: 'zh-CN', timezoneId: 'Asia/Shanghai',
})
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
try {
  await page.goto('http://127.0.0.1:5173/login')
  await page.getByLabel('用户名', { exact: true }).fill('student02')
  await page.getByLabel('密码', { exact: true }).fill('Demo2027!')
  await page.getByRole('button', { name: '登录，继续相遇' }).click()
  await page.waitForURL('**/profile')
  await page.goto('http://127.0.0.1:5173/product/product-05')
  await page.getByRole('button', { name: /和卖家聊聊/ }).click()
  await expect(page).toHaveURL(/partner=student-1.*product=product-05/)
  await expect(page.locator('.chat-product')).toHaveAttribute('href', '/product/product-05')
  await expect(page.locator('.chat-starter')).toBeVisible()
  const emptyConversation = page.locator('.conversation-item').filter({ hasText: '向同学打个招呼吧' })
  await expect(emptyConversation).toHaveCount(1)
  await emptyConversation.click()
  await expect(page).toHaveURL(/partner=student-1.*product=product-05/)
  await expect(page.locator('.chat-product')).toHaveAttribute('href', '/product/product-05')
  await expect(page.locator('.chat-starter')).toBeVisible()
  const body = '这副耳机可以在图书馆面交吗？新会话专项验证。'
  await page.getByLabel('聊天消息', { exact: true }).fill(body)
  await page.getByRole('button', { name: '发送', exact: true }).click()
  await expect(page.locator('.message-bubble').filter({ hasText: body })).toHaveCount(1)
  await page.reload()
  await expect(page).toHaveURL(/partner=student-1.*product=product-05/)
  await expect(page.locator('.chat-product')).toHaveAttribute('href', '/product/product-05')
  await expect(page.locator('.message-bubble').filter({ hasText: body })).toBeVisible()
  await expect(page.locator('.conversation-item.active')).toContainText('林小满')
  await page.screenshot({ path: screenshot, type: 'jpeg', quality: 88, fullPage: true })
  assert.deepEqual(errors, [], `Unexpected browser errors: ${errors.join('; ')}`)
  console.log(JSON.stringify({ status: 'passed', account: 'student02', partner: 'student-1', product: 'product-05', pageerrors: errors, screenshot }, null, 2))
} finally {
  await context.close()
  await browser.close()
}
