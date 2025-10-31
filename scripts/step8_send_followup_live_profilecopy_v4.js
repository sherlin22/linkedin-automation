/**
 * v4 — keep the thread tab visible after send to avoid about:blank "jump"
 * Usage:
 *   dry-run: node step8_send_followup_live_profilecopy_v4.js --index=0 --delay=8
 *   send:    node step8_send_followup_live_profilecopy_v4.js --index=0 --confirm --delay=12
 * Optional: --close to explicitly close the tab at the end (default: keep open)
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const argv = require('minimist')(process.argv.slice(2));

const CONFIRM = !!argv.confirm;
const CLOSE_AT_END = !!argv.close; // if you want to close the tab and risk about:blank, pass --close
const DELAY = parseFloat(argv.delay || '20');
const INDEX = argv.index !== undefined ? parseInt(argv.index, 10) : null;
const PROFILE = argv.profile || '/tmp/chrome-profile-copy';
const EXECUTABLE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const LOG_PATH = path.resolve(__dirname, '..', 'data', 'requests_log.json');

const COMPOSER_SELECTOR = 'div.msg-form__contenteditable';
const RETRY_COUNT = 10;
const RETRY_INTERVAL_MS = 1200;

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
function nowISO(){ return new Date().toISOString(); }

(async ()=>{
  console.log('V4 start — CONFIRM=', CONFIRM, ' INDEX=', INDEX, ' DELAY=', DELAY, ' CLOSE_AT_END=', CLOSE_AT_END);

  if (!fs.existsSync(LOG_PATH)) {
    console.error('requests_log.json not found at', LOG_PATH);
    process.exit(1);
  }
  let logs = JSON.parse(fs.readFileSync(LOG_PATH,'utf8')||'[]');

  // choose entries
  let entries=[];
  if (INDEX !== null && !isNaN(INDEX)) {
    if (!logs[INDEX]) { console.error('No log entry at index', INDEX); process.exit(1); }
    entries=[{ idx: INDEX, item: logs[INDEX] }];
  } else {
    for (let i=0;i<logs.length;i++){
      if (logs[i] && logs[i].status !== 'sent') entries.push({ idx:i, item: logs[i] });
      if (entries.length >= 10) break;
    }
  }
  if (entries.length===0) { console.log('No entries to process.'); process.exit(0); }
  console.log('Will process indices:', entries.map(e=>e.idx));

  const context = await chromium.launchPersistentContext(PROFILE, {
    headless:false, executablePath: EXECUTABLE, args:['--start-maximized'], viewport:null
  });

  try {
    for (let i=0;i<entries.length;i++){
      const { idx, item } = entries[i];
      const threadUrl = item.threadUrl;
      console.log(`\n[${i+1}/${entries.length}] index=${idx} url=${threadUrl}`);

      if (!threadUrl || !threadUrl.startsWith('http')) {
        console.warn('Invalid threadUrl for index', idx);
        logs[idx].status='invalid_threadUrl'; logs[idx].updatedAt = nowISO();
        fs.writeFileSync(LOG_PATH, JSON.stringify(logs,null,2),'utf8'); continue;
      }

      const page = await context.newPage();
      try {
        await page.goto(threadUrl, { waitUntil:'domcontentloaded', timeout:90000 }).catch(()=>null);
        await page.waitForTimeout(800);
        await page.evaluate(()=>window.scrollBy(0,150)).catch(()=>null);
        await page.waitForTimeout(600);

        // wait/retry for composer
        let composerHandle=null;
        for (let attempt=1; attempt<=RETRY_COUNT; attempt++){
          console.log(`Composer attempt ${attempt}/${RETRY_COUNT} ...`);
          const h = await page.$(COMPOSER_SELECTOR);
          if (h) {
            const rect = await h.evaluate(e=>{ const r=e.getBoundingClientRect(); return {w:Math.round(r.width), h:Math.round(r.height)}; }).catch(()=>null);
            if (rect && rect.w > 8 && rect.h > 8) { composerHandle = h; console.log('Composer visible', rect); break; }
          }
          // try reveal clicks if needed
          const revealBtns = ['.msg-overlay-bubble-header__compose-button', 'button[aria-label*="Message"]', 'button:has-text("Message")'];
          for (const sel of revealBtns) {
            try { const b = await page.$(sel); if (b) { console.log('Clicking reveal button', sel); await b.click().catch(()=>null); } } catch(e){}
          }
          await page.waitForTimeout(RETRY_INTERVAL_MS);
        }

        if (!composerHandle) {
          const snap = path.resolve(process.cwd(), `send_failed_${idx}_${Date.now()}.png`);
          await page.screenshot({ path: snap, fullPage:true });
          console.error('Composer not found after retries; saved', snap);
          logs[idx].status='composer_not_found'; logs[idx].debugScreenshot=snap; logs[idx].updatedAt=nowISO();
          fs.writeFileSync(LOG_PATH, JSON.stringify(logs,null,2),'utf8');
          continue;
        }

        // ensure tab visible
        await page.bringToFront();

        // insert text
        const TEXT = item.followupText || 'Pls share your Resume to proceed with further discussion.';
        await page.evaluate(({sel,text})=>{
          const el=document.querySelector(sel);
          if (!el) return false;
          el.focus();
          if (el.getAttribute && el.getAttribute('contenteditable')==='true'){
            while(el.firstChild) el.removeChild(el.firstChild);
            const p=document.createElement('p'); p.appendChild(document.createTextNode(text)); el.appendChild(p);
          } else if (el.tagName && (el.tagName.toLowerCase()==='textarea' || el.tagName.toLowerCase()==='input')) {
            el.value=text;
          } else el.innerText=text;
          ['input','change','blur'].forEach(ev=>el.dispatchEvent(new Event(ev,{bubbles:true,cancelable:true})));
          return true;
        }, { sel: COMPOSER_SELECTOR, text: TEXT });

        await page.waitForTimeout(700);
        const beforeShot = path.resolve(process.cwd(), `send_before_${idx}_${Date.now()}.png`);
        await page.screenshot({ path: beforeShot, fullPage:true });
        console.log('Saved beforeShot ->', beforeShot);

        if (CONFIRM) {
          // bring to front again (just before clicking)
          await page.bringToFront();
          let sent=false;
          const sendSelectors = ['button:has-text("Send")', 'button[aria-label="Send"]', 'button[type="submit"]'];
          for (const s of sendSelectors){
            const b = await page.$(s);
            if (b) {
              const rect = await b.evaluate(n=>{ const r=n.getBoundingClientRect(); return {w:r.width,h:r.height,disabled:n.disabled}; }).catch(()=>null);
              if (rect && rect.w>6 && !rect.disabled) {
                console.log('Clicking send via', s);
                await b.click().catch(()=>null);
                sent=true; break;
              }
            }
          }
          if (!sent) { console.log('Send button not found — fallback Enter'); try { await page.keyboard.press('Enter'); sent=true; } catch(e){} }

          await page.waitForTimeout(1500);
          // after sending, bring the page to front to ensure it stays visible
          await page.bringToFront();
          const afterShot = path.resolve(process.cwd(), `send_after_${idx}_${Date.now()}.png`);
          await page.screenshot({ path: afterShot, fullPage:true });

          if (sent) {
            logs[idx].status='sent'; logs[idx].sentAt=nowISO(); logs[idx].debugBefore=beforeShot; logs[idx].debugAfter=afterShot; logs[idx].updatedAt=nowISO();
            fs.writeFileSync(LOG_PATH, JSON.stringify(logs,null,2),'utf8');
            console.log('✔ Sent and logged for index', idx);
          } else {
            logs[idx].status='send_failed_no_method'; logs[idx].debugScreenshot=afterShot; logs[idx].updatedAt=nowISO();
            fs.writeFileSync(LOG_PATH, JSON.stringify(logs,null,2),'utf8');
            console.error('Failed to send for index', idx);
          }
        } else {
          logs[idx].status='drafted'; logs[idx].debugBefore=beforeShot; logs[idx].updatedAt=nowISO();
          fs.writeFileSync(LOG_PATH, JSON.stringify(logs,null,2),'utf8');
          console.log('Dry-run: drafted and logged for index', idx);
        }

        // keep thread visible for inspection
        console.log('Keeping the thread tab visible for inspection (will not close unless you pass --close).');
        if (CLOSE_AT_END) {
          await page.waitForTimeout(3000);
          try { await page.close(); } catch(e){ console.log('page.close failed:', e.message); }
        } else {
          // give a short pause and leave tab open
          await page.waitForTimeout(1000);
        }

      } catch(err) {
        console.error('Processing error for index', idx, err && err.message);
        logs[idx].status='error'; logs[idx].error=(err && err.message)||String(err); logs[idx].updatedAt=nowISO();
        fs.writeFileSync(LOG_PATH, JSON.stringify(logs,null,2),'utf8');
        try { await page.close(); } catch(e){}
      }

      if (i < entries.length-1) { console.log(`Waiting ${DELAY}s before next message...`); await sleep(DELAY*1000); }
    } // for entries
  } catch(e) { console.error('Fatal:', e && e.message); }
  finally { console.log('Done. Browser left open for inspection. Close when finished.'); }
})();
