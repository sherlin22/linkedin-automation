// check_composer.js
const { chromium } = require('playwright');
const fs = require('fs');

(async()=>{
  const profile = '/tmp/chrome-profile-copy'; // use same profile you used
  const exe = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const threadUrl = (JSON.parse(fs.readFileSync('../data/requests_log.json','utf8'))[0] || {}).threadUrl;
  if (!threadUrl) { console.error('No threadUrl found in requests_log.json'); process.exit(1); }

  const ctx = await chromium.launchPersistentContext(profile, {
    headless: false,
    executablePath: exe,
    args: ['--start-maximized'],
    viewport: null
  });

  const page = await ctx.newPage();
  await page.goto(threadUrl, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(()=>null);
  await page.waitForTimeout(1200);

  // primary selector used in your script
  const sel = 'div.msg-form__contenteditable[contenteditable="true"][role="textbox"], div.msg-form__contenteditable[contenteditable="true"]';
  const el = await page.$(sel);
  if (!el) {
    console.log('Composer selector not found on page.');
    await page.screenshot({ path: 'composer_not_found_snapshot.png', fullPage:true });
    console.log('Saved composer_not_found_snapshot.png');
    process.exit(0);
  }

  const innerText = await el.evaluate(e => e.innerText).catch(()=>null);
  const innerHTML = await el.evaluate(e => e.innerHTML).catch(()=>null);
  console.log('---- composer innerText ----');
  console.log(innerText);
  console.log('---- composer innerHTML (first 400 chars) ----');
  console.log((innerHTML||'').slice(0,400));
  await page.screenshot({ path: 'composer_check_snapshot.png', fullPage:true });
  console.log('Saved composer_check_snapshot.png');
  process.exit(0);
})();
