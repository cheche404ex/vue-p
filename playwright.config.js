import { defineConfig } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = dirname(fileURLToPath(import.meta.url))
const workspaceRoot = resolve(appRoot, '..')
const runtimeRoot = resolve(workspaceRoot, '.runtime')
const temporaryRoot = resolve(runtimeRoot, 'tmp')
for (const folder of [temporaryRoot, resolve(runtimeRoot, 'playwright'), resolve(workspaceRoot, 'screenshots')]) mkdirSync(folder, { recursive: true })
process.env.TEMP = temporaryRoot
process.env.TMP = temporaryRoot
process.env.NPM_CONFIG_CACHE = resolve(runtimeRoot, 'npm-cache')
process.env.NPM_CONFIG_LOGS_DIR = resolve(runtimeRoot, 'npm-logs')
process.env.NODE_COMPILE_CACHE = resolve(runtimeRoot, 'node-compile-cache')
process.env.PLAYWRIGHT_BROWSERS_PATH = resolve(runtimeRoot, 'browsers')
process.env.PWTEST_CACHE_DIR = resolve(runtimeRoot, 'playwright', 'transform-cache')
process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = '1'

export default defineConfig({
  testDir: './tests',
  testMatch: 'e2e.spec.js',
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: resolve(runtimeRoot, 'playwright', 'test-results'),
  reporter: [
    ['list'],
    ['html', { outputFolder: resolve(runtimeRoot, 'playwright', 'report'), open: 'never' }],
    ['json', { outputFile: resolve(runtimeRoot, 'playwright', 'results.json') }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    reducedMotion: 'reduce',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'off',
    video: 'off',
    launchOptions: {
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      args: ['--disable-breakpad', '--disable-crash-reporter', '--disable-background-mode'],
      downloadsPath: resolve(runtimeRoot, 'playwright', 'downloads'),
    },
  },
  webServer: {
    command: 'node server/index.mjs',
    cwd: appRoot,
    url: 'http://127.0.0.1:5173/api/auth/me',
    reuseExistingServer: true,
    timeout: 30_000,
    env: {
      TEMP: temporaryRoot,
      TMP: temporaryRoot,
      NPM_CONFIG_CACHE: process.env.NPM_CONFIG_CACHE,
      NPM_CONFIG_LOGS_DIR: process.env.NPM_CONFIG_LOGS_DIR,
      NODE_COMPILE_CACHE: process.env.NODE_COMPILE_CACHE,
      PORT: '5173',
    },
  },
})
