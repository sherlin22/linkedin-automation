/**
 * Robust version: step8_send_followup_profilecopy_smart2.js
 * Usage: node step8_send_followup_profilecopy_smart2.js <logIndex|threadUrl>
 *
 * Tries longer waits, retries, and writes a diagnostics JSON with all [contenteditable|role=textbox]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FOLLOWUP_TEXT = 'Pls share your Resume to proceed with further discussion.';
const userDataDir = '/tmp/chrome-profile-copy';
const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function visibleRect(r){ return r && r.width>4 && r.height>4; }

(async ()=>{
  const args = process.argv.slice(2);
  if (!args[0]) { console.error('Usage: node step8_send_followup_profilecopy_smart2.js <logIndex|threadUrl>'); process.exit(1); }
  let threadUrl = args[0];

  // numeric index support (0 -> most recent)
  if (/^\d+$/.test(threadUrl)) {
    try {
      const p = path.resolve(__dirname, '..', 'data', 'requests_log.json');
      const raw = fs.existsSync(p) ? fs.readFileSync(p,'utf8') : '[]';
      const logs = JSON.parse(raw||'[]');
      const idx = parseInt(threadUrl,10);
      if (idx===0 && logs.length>0) threadUrl = logs[logs.length-1].threadUrl;
      else if (logs[idx] && logs[idx].threadUrl) threadUrl = logs[idx].threadUrl;
    } catch(e){ /* ignore and use literal */ }
  }

  const ctx = await chromium.launchPersistentContext(userDataDir, {
    headless:false, executablePath, args:['--start-maximized'], viewport:null
  });

  try {
    const page = await ctx.newPage();
    console.log('Opening thread:', threadUrl);
    await page.goto(threadUrl, { waitUntil:'domcontentloaded', timeout: 90000 });

    // aggressive wait + scroll to trigger lazy-load UI
    for (let i=0;i<6;i++){
      await page.waitForTimeout(800);
      await page.evaluate(()=>window.scrollBy(0,150));
    }
    await page.waitForTimeout(600);

    // Wait for any contenteditable or role=textbox to appear
    let found = null;
    const maxAttempts = 8;
    for (let attempt=1; attempt<=maxAttempts; attempt++){
      console.log(`Attempt ${attempt}/${maxAttempts} - scanning for composer elements...`);
      // gather candidate elements
      const els = await page.$$('[contenteditable="true"], [role="textbox"], [contenteditable]');
      const diag = [];
      for (const el of els){
        const rect = await el.evaluate(e=>{ const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; }).catch(()=>null);
        const text = await el.evaluate(e=> (e.innerText||e.value||'').slice(0,200)).catch(()=>'');
        const tag = await el.evaluate(e=>e.tagName).catch(()=>null);
        const cls = await el.evaluate(e=>e.className).catch(()=>'');
        diag.push({tag, cls: typeof cls==='string'?cls.split(/\s+/).slice(0,6):cls, rect, sample:text.slice(0,120)});
        if (visibleRect(rect)) {
          found = true;
          break;
        }
      }
      // save diagnostics for this attempt
      const stamp = new Date().toISOString().replace(/[:.]/g,'-');
      const diagPath = path.resolve(process.cwd(), `composer_diag_${stamp}_attempt${attempt}.json`);
      fs.writeFileSync(diagPath, JSON.stringify({ timestamp: new Date().toISOString(), attempt, items:diag }, null, 2));
      console.log('Wrote diagnostics to', diagPath);
      if (found) break;
      // attempt to click the message-open UI in case composer is hidden
      const openButtons = [
        'button[aria-label*="Message"]',
        'button:has-text("Message")',
        '.msg-overlay-bubble-header__compose-button', // linkedin compose
        '.msg-overlay-bubble-header button',
        'button[title="Compose"]'
      ];
      for (const sel of openButtons){
        try {
          const b = await page.$(sel);
          if (b) { console.log('Clicking potential open button:', sel); await b.click().catch(()=>null); await page.waitForTimeout(700); }
        } catch(e){}
      }
      await page.waitForTimeout(800);
    }

    // final scan to pick a visible element
    const els2 = await page.$$('[contenteditable="true"], [role="textbox"], [contenteditable]');
    let usedSelector = null;
    for (const el of els2){
      const rect = await el.evaluate(e=>{ const r=e.getBoundingClientRect(); return {width:r.width,height:r.height,x:r.x,y:r.y}; }).catch(()=>null);
      if (visibleRect(rect)){
        // build a simple selector: id if present, else first class, else tag
        const id = await el.evaluate(e=>e.id).catch(()=>null);
        const cls = await el.evaluate(e=>e.className).catch(()=>'');
        if (id) usedSelector = '#'+id;
        else if (cls && typeof cls==='string') usedSelector = (await el.evaluate(e=>e.tagName)).toLowerCase() + '.' + cls.split(/\s+/)[0];
        else usedSelector = (await el.evaluate(e=>e.tagName)).toLowerCase();
        break;
      }
    }

    if (!usedSelector) {
      const snap = path.resolve(process.cwd(),'followup_selector_not_found_profilecopy.png');
      await page.screenshot({ path: snap, fullPage:true });
      console.error('Could not find visible composer. Saved screenshot + diagnostics. Screenshot:', snap);
      process.exit(1);
    }

    console.log('Using detected selector:', usedSelector);
    await page.evaluate(({sel,text})=>{
      const el=document.querySelector(sel) || document.querySelector('[contenteditable="true"]') || document.querySelector('[role="textbox"]');
      if (!el) return false;
      el.focus();
      if (el.getAttribute && el.getAttribute('contenteditable')==='true'){
        while (el.firstChild) el.removeChild(el.firstChild);
        const p=document.createElement('p'); p.appendChild(document.createTextNode(text)); el.appendChild(p);
      } else if (el.tagName && (el.tagName.toLowerCase()==='textarea' || el.tagName.toLowerCase()==='input')){
        el.value=text;
      } else { el.innerText=text; }
      ['input','change','blur'].forEach(ev=>el.dispatchEvent(new Event(ev,{bubbles:true,cancelable:true})));
      return true;
    }, { sel: usedSelector, text: FOLLOWUP_TEXT });

    const shot = path.resolve(process.cwd(),'followup_test_profilecopy_smart2.png');
    await page.screenshot({ path: shot, fullPage:true });
    console.log('Drafted follow-up. Screenshot saved to', shot);

  } catch (err){
    console.error('Error:', err);
  } finally {
    console.log('Done — browser left open for inspection.');
  }
})();
