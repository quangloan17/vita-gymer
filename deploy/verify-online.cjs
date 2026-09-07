const {chromium}=require('../node_modules/playwright');
(async()=>{
const base=process.env.VITA_TEST_URL||'http://100.88.123.53:8765';
const browser=await chromium.launch();
const page=await browser.newPage();
const failures=[];page.on('pageerror',e=>failures.push(e.message));
await page.goto(base+'/login/',{waitUntil:'networkidle',timeout:30000});
await page.locator('[name=username]').fill('quang');
await page.locator('[name=password]').fill(process.env.VITA_ACCOUNT_PASSWORD);
await page.getByRole('button',{name:'Đăng nhập →'}).click();
await page.locator('.score-card').waitFor({timeout:20000});
const result=await page.evaluate(async()=>({secure:window.isSecureContext,api:(await fetch('/api/dashboard/today/')).status,styles:document.styleSheets.length}));
if(await page.locator('#sheet').isVisible())await page.locator('[data-action=close]').click();
await page.locator('.coach-banner [data-action=coach]').click();
await page.locator('[data-section=food]').click();
await page.locator('.coach-content').waitFor();
const coaching=await page.evaluate(()=>fetch('/api/dashboard/today/').then(r=>r.json()).then(d=>({actions:d.coaching.actions.length,mealOptions:d.coaching.nutrition.options.length})));
result.coaching=coaching;
await page.locator('[data-action=close]').click();
const journey=await page.evaluate(()=>fetch('/api/dashboard/today/').then(r=>r.json()).then(d=>({step:d.journey.step,started:d.journey.started})));
await page.locator('.journey-banner').waitFor();
if(!journey.started){
 await page.locator('.journey-banner [data-action=journey-setup]').click();
 result.setupTitle=await page.locator('#sheet-title').textContent();
 await page.locator('[data-action=close]').click();
}
result.journey=journey;
if(process.env.VITA_VERIFY_WRITE==='1'){
 if(await page.locator('#sheet').isVisible())await page.locator('[data-action=close]').click();
 const before=await page.evaluate(()=>fetch('/api/dashboard/today/').then(r=>r.json()));
 await page.locator('[data-action=quick-water]').click();
 await page.locator('#toast [data-action=undo]').waitFor({timeout:15000});
 await page.locator('#toast [data-action=undo]').click();
 await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('Đã hoàn tác'));
 const after=await page.evaluate(()=>fetch('/api/dashboard/today/').then(r=>r.json()));
 if(after.today.water!==before.today.water)throw new Error('Water undo verification failed');
 result.writeAndUndo='passed';
}
console.log(JSON.stringify({login:'passed',...result,jsErrors:failures}));
await browser.close();
})().catch(e=>{console.error(e.message);process.exit(1)});
