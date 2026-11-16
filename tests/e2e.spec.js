import { test, expect } from '@playwright/test'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const uploadPhoto = resolve(workspaceRoot, 'secondhand/public/images/products/01.jpg')
let pageErrors

test.beforeEach(async ({ page }) => {
  pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
})

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus && !page.isClosed()) {
    const file = resolve(workspaceRoot, 'screenshots', `e2e-failure-${testInfo.testId.replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg`)
    await page.screenshot({ path: file, type: 'jpeg', quality: 75, animations: 'disabled' }).catch(() => {})
    await testInfo.attach('失败页面', { path: file, contentType: 'image/jpeg' }).catch(() => {})
  }
  expect(pageErrors, '页面不应产生未捕获的 JavaScript 错误').toEqual([])
})

async function screenshot(page, name) {
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: resolve(workspaceRoot, 'screenshots', `e2e-${name}.jpg`), type: 'jpeg', quality: 75, animations: 'disabled' })
}

async function login(page, username = 'student02', password = 'Demo2027!') {
  await page.goto('/login')
  await page.getByLabel('用户名', { exact: true }).fill(username)
  await page.getByLabel('密码', { exact: true }).fill(password)
  await page.getByRole('button', { name: '登录，继续相遇' }).click()
  await expect(page).toHaveURL(username === 'admin' ? /\/admin$/ : /\/profile$/)
}

async function logout(page) {
  await page.goto('/profile')
  await page.getByRole('button', { name: '退出登录', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('link', { name: '登录 / 注册', exact: true })).toBeVisible()
}

async function register(page, displayName = '验收新同学') {
  const username = `e2e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  const password = 'Testing2027!'
  await page.goto('/register')
  await page.getByLabel('用户名', { exact: true }).fill(username)
  await page.getByLabel('你的昵称', { exact: true }).fill(displayName)
  await page.getByRole('combobox', { name: '所在学院', exact: true }).selectOption({ label: '经济管理学院' })
  await page.getByLabel('密码', { exact: true }).fill(password)
  await page.getByLabel('确认密码', { exact: true }).fill(password)
  await page.getByRole('button', { name: '注册，加入找归宿' }).click()
  await expect(page).toHaveURL(/\/profile$/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(displayName)
  return { username, password, displayName }
}

async function addProductToCart(page, id, title) {
  await page.goto(`/product/${id}`)
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
  await page.getByRole('button', { name: '加入购物车', exact: true }).click()
  await expect(page.getByRole('button', { name: '已加入 · 查看购物车' })).toBeVisible()
}

async function checkout(page) {
  await page.goto('/cart')
  await page.getByLabel('在哪里见面').selectOption('tianming')
  await page.getByLabel('给卖家留句话').fill('课堂验收：下课后在实训楼面交。')
  await page.getByRole('button', { name: '下一步，生成订单' }).click()
  await expect(page).toHaveURL(/\/orders$/)
}

test('首页与校园地图可展示，桌面页面无横向溢出', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: '找归宿首页' })).toBeVisible()
  await expect(page.locator('main')).toBeVisible()
  await expect(page.locator('.product-card').first()).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await screenshot(page, 'home')
  await page.getByRole('button', { name: /^校园地图/ }).click()
  const map = page.getByRole('dialog', { name: '校园交接地图' })
  await expect(map.getByRole('img', { name: '江西职业技术大学濂溪校区手绘地图' })).toBeVisible()
  await map.getByRole('button', { name: '选择图书馆', exact: true }).click()
  await expect(map.getByRole('button', { name: '选择图书馆', exact: true })).toHaveClass(/selected/)
  await screenshot(page, 'campus-map')
  await map.getByRole('button', { name: '关闭地图' }).click()
  await expect(map).not.toBeVisible()
})

test('学生搜索筛选并收藏商品，刷新后收藏仍存在', async ({ page }) => {
  await login(page)
  await page.goto('/market')
  await page.getByRole('button', { name: /^数码电子/ }).click()
  await page.getByLabel('搜索商品', { exact: true }).fill('耳机')
  await page.getByLabel('来自哪个学院').selectOption({ label: '信息工程学院' })
  await page.getByLabel('物品成色').selectOption({ label: '几乎全新' })
  await page.getByRole('radio', { name: '¥50 — ¥200', exact: true }).check()
  await page.getByLabel('商品排序').selectOption('price-up')
  await expect(page.locator('.product-card')).toHaveCount(1)
  const item = page.locator('.product-card').first()
  await expect(item.getByRole('link', { name: '一副耳机，一整个安静下午', exact: true }).last()).toBeVisible()
  await item.getByRole('button', { name: '收藏这件闲置' }).click()
  await expect(item.getByRole('button', { name: '取消收藏' })).toHaveAttribute('aria-pressed', 'true')
  await screenshot(page, 'market-filtered')
  await page.goto('/favorites')
  await expect(page.locator('.product-card')).toHaveCount(1)
  await page.reload()
  await expect(page.locator('.product-card')).toHaveCount(1)
  await expect(page.locator('.product-card').first()).toContainText('一副耳机，一整个安静下午')
  await expect(page.getByRole('button', { name: '取消收藏' })).toHaveAttribute('aria-pressed', 'true')
})

test('购物车生成订单、模拟付款、完成面交，并验证取消释放库存', async ({ page }) => {
  await login(page)
  const firstTitle = '读过的书，还想遇见你'
  await addProductToCart(page, 'product-01', firstTitle)
  await checkout(page)
  const completed = page.locator('.order-card').filter({ hasText: firstTitle })
  await expect(completed.locator('.order-status')).toHaveText('待模拟付款')
  await completed.getByRole('button', { name: '模拟付款', exact: true }).click()
  const modal = page.getByRole('dialog', { name: '确认订单操作' })
  await expect(modal).toContainText('不会产生任何真实扣款')
  await modal.getByRole('button', { name: '确认模拟付款' }).click()
  await expect(completed.locator('.order-status')).toHaveText('待面交')
  await completed.getByRole('button', { name: '确认已完成面交' }).click()
  await modal.getByRole('button', { name: '已验货，确认完成' }).click()
  await expect(completed.locator('.order-status')).toHaveText('已完成')
  await screenshot(page, 'order-completed')
  await page.goto('/product/product-01')
  await expect(page.getByText('这件好物已经找到新归宿啦。', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '加入购物车', exact: true })).toBeDisabled()

  const secondTitle = '专业阅读与商业思维书'
  await addProductToCart(page, 'product-02', secondTitle)
  await checkout(page)
  const cancelled = page.locator('.order-card').filter({ hasText: secondTitle })
  await cancelled.getByRole('button', { name: '取消订单', exact: true }).click()
  await modal.getByRole('button', { name: '确认取消订单' }).click()
  await expect(cancelled.locator('.order-status')).toHaveText('已取消')
  await page.goto('/product/product-02')
  await expect(page.getByRole('button', { name: '加入购物车', exact: true })).toBeEnabled()
  await page.reload()
  await expect(page.getByRole('button', { name: '加入购物车', exact: true })).toBeEnabled()
})

test('两个学生通过真实界面互发消息，切换账号后能读到回复', async ({ page }) => {
  const question = `验收消息 ${Date.now()}：明天下课后能在图书馆见吗？`
  const answer = `验收回复 ${Date.now()}：可以，图书馆门口见。`
  await login(page, 'student02')
  await page.goto('/product/product-01')
  await page.getByRole('button', { name: /和卖家聊聊/ }).click()
  await expect(page).toHaveURL(/\/messages\?/)
  await page.getByLabel('聊天消息').fill(question)
  await page.getByRole('button', { name: '发送', exact: true }).click()
  await expect(page.locator('.chat-messages').getByText(question, { exact: true })).toBeVisible()
  await logout(page)
  await login(page, 'student01')
  await page.goto('/messages')
  await expect(page.locator('.chat-messages').getByText(question, { exact: true })).toBeVisible()
  await page.getByLabel('聊天消息').fill(answer)
  await page.getByRole('button', { name: '发送', exact: true }).click()
  await expect(page.locator('.chat-messages').getByText(answer, { exact: true })).toBeVisible()
  await logout(page)
  await login(page, 'student02')
  await page.goto('/messages')
  await expect(page.locator('.chat-messages').getByText(answer, { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.locator('.chat-messages').getByText(answer, { exact: true })).toBeVisible()
  await screenshot(page, 'messages')
})

test('新账号注册后真实选图发布，照片刷新保留，可编辑并删除', async ({ page }) => {
  await register(page, '验收上传同学')
  const title = `验收实拍书籍 ${Date.now()}`
  await page.goto('/publish')
  await page.getByLabel('选择商品照片', { exact: true }).setInputFiles(uploadPhoto)
  await expect(page.getByRole('img', { name: '商品照片 1', exact: true })).toBeVisible()
  await page.getByLabel(/商品标题/).fill(title)
  await page.getByLabel('好物分类').selectOption('books')
  await page.getByRole('combobox', { name: '物品成色', exact: true }).selectOption('几乎全新')
  await page.getByLabel(/转让价/).fill('25')
  await page.getByLabel(/原价/).fill('50')
  await page.getByLabel(/详细描述/).fill('这是一张真实选择的本地商品照片，商品保存后刷新验证图片仍然存在。')
  await page.getByLabel(/想对下一位主人说的话/).fill('愿这份喜欢继续留在校园里。')
  await page.getByRole('combobox', { name: '交接地点', exact: true }).selectOption('library')
  await screenshot(page, 'publish-real-upload')
  await page.getByRole('button', { name: '发布，给它找归宿' }).click()
  await expect(page).toHaveURL(/\/product\/product-/)
  const productPath = new URL(page.url()).pathname
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  const image = page.locator('.detail-main-image img')
  await expect.poll(() => image.evaluate(element => element.complete && element.naturalWidth > 0)).toBe(true)
  expect(await image.getAttribute('src')).toMatch(/^blob:/)
  await screenshot(page, 'uploaded-product')
  await page.getByRole('link', { name: '编辑我的闲置' }).click()
  const edited = `${title} 修改版`
  await page.getByLabel(/商品标题/).fill(edited)
  await page.getByRole('button', { name: '保存修改', exact: true }).click()
  await expect(page.getByRole('heading', { name: edited, exact: true })).toBeVisible()
  await page.goto('/profile')
  const row = page.locator('.profile-product').filter({ hasText: edited })
  await row.getByRole('button', { name: '删除闲置' }).click()
  await page.getByRole('button', { name: '确认删除', exact: true }).click()
  await expect(row).toHaveCount(0)
  await page.goto(productPath)
  await expect(page.getByRole('heading', { name: '这件物品已经离开了市集' })).toBeVisible()
})

test('管理员下架恢复商品，并停用新建普通账号使其无法登录', async ({ page }) => {
  const disposable = await register(page, '验收停用同学')
  await logout(page)
  await login(page, 'admin', 'Admin2027!')
  await screenshot(page, 'admin-overview')
  await page.getByRole('button', { name: '商品管理', exact: true }).click()
  await page.getByLabel('搜索管理商品', { exact: true }).fill('读过的书，还想遇见你')
  const product = page.getByRole('row').filter({ hasText: '读过的书，还想遇见你' })
  await product.getByRole('button', { name: '下架', exact: true }).click()
  await expect(product).toContainText('已下架')
  await page.goto('/product/product-01')
  await expect(page.getByText('这件商品暂时下架，无法购买。', { exact: true })).toBeVisible()
  await page.goto('/admin')
  await page.getByRole('button', { name: '商品管理', exact: true }).click()
  await page.getByLabel('搜索管理商品', { exact: true }).fill('读过的书，还想遇见你')
  await product.getByRole('button', { name: '恢复上架', exact: true }).click()
  await expect(product).toContainText('正在转让')
  await page.getByRole('button', { name: '用户管理', exact: true }).click()
  await page.getByLabel('搜索用户', { exact: true }).fill(disposable.username)
  const user = page.getByRole('row').filter({ hasText: disposable.username })
  await user.getByRole('button', { name: '停用', exact: true }).click()
  await page.getByRole('button', { name: '确认停用', exact: true }).click()
  await expect(user).toContainText('已停用')
  await screenshot(page, 'admin-user-disabled')
  await logout(page)
  await page.goto('/login')
  await page.getByLabel('用户名', { exact: true }).fill(disposable.username)
  await page.getByLabel('密码', { exact: true }).fill(disposable.password)
  await page.getByRole('button', { name: '登录，继续相遇' }).click()
  await expect(page.getByRole('alert')).toContainText('账号已被停用')
  await expect(page).toHaveURL(/\/login$/)
})

test.describe('正常动效', () => {
  test.use({ reducedMotion: 'no-preference' })
  test('毕业开场首次自动结束，能重播与跳过且无脚本错误', async ({ page }) => {
    await page.goto('/')
    const intro = page.getByRole('dialog', { name: '找归宿毕业季开场' })
    await expect(intro).toBeVisible()
    await expect(intro).not.toBeVisible({ timeout: 6_000 })
    await page.getByRole('button', { name: '重看我们的夏天', exact: true }).click()
    await expect(intro).toBeVisible()
    await intro.getByRole('button', { name: '跳过开场' }).click()
    await expect(intro).not.toBeVisible()
    await page.getByRole('button', { name: '重看我们的夏天', exact: true }).click()
    await expect(intro).toBeVisible()
    await expect(intro).not.toBeVisible({ timeout: 6_000 })
  })
})
