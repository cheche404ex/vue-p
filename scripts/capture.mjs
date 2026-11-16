import {chromium} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
const output=resolve(root,'screenshots')
await mkdir(output,{recursive:true})
process.env.TEMP=resolve(root,'.runtime/tmp');process.env.TMP=process.env.TEMP
const context=await chromium.launchPersistentContext(resolve(root,'.runtime/visual-browser'),{executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true,viewport:{width:1440,height:1050},deviceScaleFactor:1,locale:'zh-CN',reducedMotion:'reduce',args:[`--disk-cache-dir=${resolve(root,'.runtime/visual-cache')}`,'--disable-breakpad','--disable-crash-reporter','--disable-background-mode']})
const page=await context.newPage(),errors=[]
page.on('pageerror',e=>errors.push(e.message))
for(const [name,path] of [['home','/'],['market','/market'],['detail','/product/product-09'],['login','/login']]){
 await page.goto(`http://127.0.0.1:5173${path}`,{waitUntil:'networkidle'})
 await page.waitForSelector('main h1')
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))})
 await page.screenshot({path:resolve(output,`${name}-1440.jpg`),type:'jpeg',quality:78})
 if(name==='home')await page.screenshot({path:resolve(output,'home-full.jpg'),type:'jpeg',quality:75,fullPage:true})
 console.log(JSON.stringify({page:name,brokenImages:await page.locator('img').evaluateAll(imgs=>imgs.filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)}))
}
for(const width of [1280,1920]){await page.setViewportSize({width,height:1000});await page.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});await page.screenshot({path:resolve(output,`home-${width}.jpg`),type:'jpeg',quality:73});console.log(JSON.stringify({width,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)}))}
console.log(JSON.stringify({pageErrors:errors}))
await context.close()
