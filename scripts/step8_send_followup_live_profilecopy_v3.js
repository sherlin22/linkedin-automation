/**
 * step8_send_followup_live_profilecopy_v3.js
 * - Uses the stable selector `div.msg-form__contenteditable`
 * - Retries/waits for the composer to appear (up to RETRY_COUNT attempts)
 * - Dry-run by default (no send) — pass --confirm to actually send
 *
 * Usage:
 *  node step8_send_followup_live_profilecopy_v3.js --index=0 --delay=8
 *  node step8_send_followup_live_profilecopy_v3.js --index=0 --confirm --delay=12
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const argv = require('minimist')(process.argv.slice(2));

const CONFIRM = !!argv.confirm;
const DELAY = parseFloat(argv.delay || '20');
const INDEX = argv.index !== undefined ? parseInt(argv.index, 10) : null;
const PROFILE = argv.profile || '/tmp/chrome-profile-copy';
const EXECUTABLE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const LOG_PATH = path.resolve(__dirname, '..', 'data', 'requests_log.json');

const COMPOSER_SELECTOR = 'div.msg-form__contenteditable'; // diagnostic-proven selector
const RETRY_COUNT = 8;
const RETRY_INTERVAL_MS = 1500;

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
function nowISO(){ return new Date().toISOString(); }

(async ()=>{
  console.log('V3 send script start — CONFIRM=', CONFIRM, ' INDEX=', INDEX, ' DELAY=', DELAY);

  if (!fs.existsSync(LOG_PATH)) {
    console.error('requests_log.json not found at', LOG_PATH);
    process.exit(1);
  }
  let logs = JSON.parse(fs.readFileSync(LOG_PATH,'utf8')||'[]');

  // choose entries (same logic as before)
  let entries = [];
  if (INDEX !== null && !isNaN(INDEX)) {
    if (!logs[INDEX]) { console.error('No log entry at index', INDEX); process.exit(1); }
    entries = [{ idx: INDEX, item: logs[INDEX] }];
  } else {
    for (let i=0;i<logs.length;i++){
      const it = logs[i];
      if (!it) continue;
      if (it.status && it.status === 'sent') continue;
      entries.push({ idx: i, item: it });
      if (entries.length >= 10) break;
    }
  }

  if (entries.length === 0) {
    console.log('No pending entries to send.');
    process.exit(0);
  }

  console.log('Will process indices:', entries.map(e=>e.idx));

  const context = await chromium.launchPersistentContext(PROFILE, {
    headless: false,
    executablePath: EXECUTABLE,
    args: ['--start-maximized'],
    viewport: null,
  });

  try {
    for (let eI=0; eI<entries.length; eI++) {
      const { idx, item } = entries[eI];
      const threadUrl = item.threadUrl;
      console.log(`\n[${eI+1}/${entries.length}] index=${idx} url=${threadUrl}`);

      if (!threadUrl || !threadUrl.startsWith('http')) {
        console.warn('Invalid threadUrl for index', idx);
        logs[idx].status = 'invalid_threadUrl';
        logs[idx].updatedAt = nowISO();
        fs.writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2), 'utf8');
        continue;
      }

      const page = await context.newPage();
      try {
        console.log('Navigating to thread (long timeout) ...');
        await page.goto(threadUrl, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(()=>null);

        // ensure page had time to render and lazy load
        await page.waitForTimeout(800);
        await page.evaluate(()=>window.scrollBy(0,150)).catch(()=>null);
        await page.waitForTimeout(600);

        // retry loop waiting for our diagnostic-proven composer selector
        let composerHandle = null;
        for (let attempt=1; attempt<=RETRY_COUNT; attempt++) {
          console.log(`Composer check attempt ${attempt}/${RETRY_COUNT} ...`);
          const h = await page.$(COMPOSER_SELECTOR);
          if (h) {
            const rect = await h.evaluate(e=>{
              const r = e.getBoundingClientRect();
              return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) };
            }).catch(()=>null);
            if (rect && rect.w > 8 && rect.h > 8) {
              composerHandle = h;
              console.log('Composer visible with rect:', rect);
              break;
            } else {
              console.log('Found element but not visible enough:', rect);
            }
          } else {
            console.log('Composer selector not found on DOM yet.');
          }

          // try to click potential open buttons to reveal composer (if hidden)
          const revealBtns = ['.msg-overlay-bubble-header__compose-button', 'button[aria-label*="Message"]', 'button:has-text("Message")'];
          for (const sel of revealBtns) {
            try {
              const b = await page.$(sel);
              if (b) { console.log('Clicking reveal button:', sel); await b.click().catch(()=>null); }
            } catch(e){}
          }

          await page.waitForTimeout(RETRY_INTERVAL_MS);
        }

        if (!composerHandle) {
          const snap = path.resolve(process.cwd(), `send_failed_${idx}_${Date.now()}.png`);
          await page.screenshot({ path: snap, fullPage: true });
          console.error('Composer not found after retries. Saved', snap);
          logs[idx].status = 'composer_not_found';
          logs[idx].debugScreenshot = snap;
          logs[idx].updatedAt = nowISO();
          fs.writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2), 'utf8');
          // leave page open for inspection
          continue;
        }

        // insert follow-up text atomically
        const TEXT = item.followupText || 'Pls share your Resume to proceed with further discussion.';
        await page.evaluate(({sel, text})=>{
          const el = document.querySelector(sel);
          if (!el) return false;
          el.focus();
          if (el.getAttribute && el.getAttribute('contenteditable') === 'true') {
            while(el.firstChild) el.removeChild(el.firstChild);
            const p = document.createElement('p'); p.appendChild(document.createTextNode(text)); el.appendChild(p);
          } else if (el.tagName && (el.tagName.toLowerCase() === 'textarea' || el.tagName.toLowerCase() === 'input')) {
            el.value = text;
          } else {
            el.innerText = text;
          }
          ['input','change','blur'].forEach(ev => el.dispatchEvent(new Event(ev,{bubbles:true,cancelable:true})));
          return true;
        }, { sel: COMPOSER_SELECTOR, text: TEXT });

        await page.waitForTimeout(600);
        const beforeShot = path.resolve(process.cwd(), `send_before_${idx}_${Date.now()}.png`);
        await page.screenshot({ path: beforeShot, fullPage: true });
        console.log('Saved beforeShot ->', beforeShot);

        if (CONFIRM) {
          console.log('Attempting to send (clicking Send or fallback Enter) ...');
          let sent = false;
          const sendCandidates = ['button:has-text("Send")', 'button[aria-label="Send"]', 'button[type="submit"]'];
          for (const s of sendCandidates) {
            try {
              const b = await page.$(s);
              if (b) {
                const rect = await b.evaluate(n=>{ const r=n.getBoundingClientRect(); return {w:r.width,h:r.height,disabled:n.disabled}; }).catch(()=>null);
                if (rect && rect.w>6 && !rect.disabled) {
                  console.log('Clicking send via', s);
                  await b.click().catch(()=>null);
                  sent = true;
                  break;
                }
              }
            } catch(e){}
          }
          if (!sent) {
            console.log('Send button not found — sending Enter in composer ...');
            try { await page.keyboard.press('Enter'); sent = true; } catch(e){}
          }

          await page.waitForTimeout(1500);
          const afterShot = path.resolve(process.cwd(), `send_after_${idx}_${Date.now()}.png`);
          await page.screenshot({ path: afterShot, fullPage: true });

          if (sent) {
            logs[idx].status = 'sent';
            logs[idx].sentAt = nowISO();
            logs[idx].debugBefore = beforeShot;
            logs[idx].debugAfter = afterShot;
            logs[idx].updatedAt = nowISO();
            fs.writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2), 'utf8');
            console.log('✔ Sent and logged for index', idx);
          } else {
            logs[idx].status = 'send_failed_no_method';
            logs[idx].debugScreenshot = afterShot;
            logs[idx].updatedAt = nowISO();
            fs.writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2), 'utf8');
            console.error('Failed to send for index', idx);
          }
        } else {
          logs[idx].status = 'drafted';
          logs[idx].debugBefore = beforeShot;
          logs[idx].updatedAt = nowISO();
          fs.writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2), 'utf8');
          console.log('Dry-run: drafted and logged for index', idx);
        }

        // give you a moment to inspect before closing tab
        await page.waitForTimeout(3000);
        try { await page.close(); } catch(e){}
      } catch (err) {
        console.error('Error processing index', idx, err && err.message);
        logs[idx].status = 'error';
        logs[idx].error = (err && err.message) || String(err);
        logs[idx].updatedAt = nowISO();
        fs.writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2), 'utf8');
        try { await page.close(); } catch(e){}
      }

      // inter-message delay
      if (eI < entries.length - 1) {
        console.log(`Waiting ${DELAY}s before next message...`);
        await sleep(DELAY * 1000);
      }
    } // entries loop
  } catch(ex) {
    console.error('Fatal:', ex && ex.message);
  } finally {
    console.log('Done. Browser kept open for inspection; close when finished.');
  }
})();
