import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({channel:'msedge'});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[]; page.on('pageerror',error=>errors.push(error.message));
await page.goto('http://localhost:4173'); await page.evaluate(()=>document.fonts.ready);
await page.screenshot({path:'artifacts/desktop.png',fullPage:true});
for(const [from,to] of [['e2','e4'],['e7','e5'],['g1','f3'],['b8','c6'],['f1','c4']]) {
  await page.locator(`[data-square="${from}"]`).click();
  await page.locator(`[data-square="${to}"]`).click();
}
await page.screenshot({path:'artifacts/opening.png',fullPage:true});
await page.setViewportSize({width:390,height:844});
await page.screenshot({path:'artifacts/mobile.png',fullPage:true});
console.log(JSON.stringify({errors,screenshots:['desktop','opening','mobile']}));
await browser.close();
