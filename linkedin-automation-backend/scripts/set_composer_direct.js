// set_composer_direct.js
const { chromium } = require('playwright');
const fs = require('fs');

(async()=>{
  const profile = '/tmp/chrome-profile-copy';
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

  const sel = 'div.msg-form__contenteditable[contenteditable="true"][role="textbox"], div.msg-form__contenteditable[contenteditable="true"]';
  const ok = await page.$(sel);
  if (!ok) {
    console.error('Composer selector not found; saved fullpage screenshot');
    await page.screenshot({ path: 'setcomposer_fail.png', fullPage:true });
    process.exit(1);
  }

  const text = 'Pls share your Resume to proceed with further discussion.';
  await page.evaluate(({sel,text})=>{
    const el = document.querySelector(sel);
    if (!el) return false;
    // put text inside paragraph so LinkedIn sees it as a block
    el.innerHTML = '';
    const p = document.createElement('p');
    p.appendChild(document.createTextNode(text));
    el.appendChild(p);
    // dispatch events linkedin listens for
    ['input','keydown','keyup','keyup','change','blur'].forEach(ev=>{
      el.dispatchEvent(new Event(ev, { bubbles:true, cancelable:true }));
    });
    return true;
  }, { sel, text });

  await page.waitForTimeout(800);
  await page.screenshot({ path: 'set_composer_result.png', fullPage:true });
  console.log('Saved set_composer_result.png — open it to verify the drafted text is visible.');
  process.exit(0);
})();
