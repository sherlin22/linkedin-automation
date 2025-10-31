/**
 * step8_send_followup_live_profilecopy.js
 *
 * Usage (dry-run, safe):
 *   node step8_send_followup_live_profilecopy.js --limit=3
 *
 * Usage (actually clicks Send):
 *   node step8_send_followup_live_profilecopy.js --limit=3 --confirm
 *
 * Options:
 *   --index=N        send only the entry at index N from ../data/requests_log.json
 *   --limit=N        maximum number of messages to send (default: 10)
 *   --delay=S        seconds to wait between sends (default: 20)
 *   --confirm        actually click the Send button (omit for dry-run)
 *   --profile=PATH   override profile path (default: /tmp/chrome-profile-copy)
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const argv = require('minimist')(process.argv.slice(2));
const CONFIRM = !!argv.confirm;
const LIMIT = parseInt(argv.limit || '10', 10);
const DELAY = parseFloat(argv.delay || '20');
const INDEX = argv.index !== undefined ? parseInt(argv.index, 10) : null;
const PROFILE = argv.profile || '/tmp/chrome-profile-copy';
const EXECUTABLE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const LOG_PATH = path.resolve(__dirname, '..', 'data', 'requests_log.json');

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
function nowISO(){ return new Date().toISOString(); }

(async ()=>{
  if (!fs.existsSync(LOG_PATH)) {
    console.error('requests_log.json not found at', LOG_PATH);
    process.exit(1);
  }

  const raw = fs.readFileSync(LOG_PATH, 'utf8') || '[]';
  let logs = JSON.parse(raw);

  // choose entries
  let entries = [];
  if (INDEX !== null && !isNaN(INDEX)) {
    if (!logs[INDEX]) {
      console.error('No log entry at index', INDEX);
      process.exit(1);
    }
    entries = [{ idx: INDEX, item: logs[INDEX] }];
  } else {
    // pick entries that are not sent and optionally status matches 'drafted' or 'queued'
    for (let i=0;i<logs.length;i++){
      const it = logs[i];
      if (!it) continue;
      if (it.status && it.status === 'sent') continue;
      entries.push({ idx: i, item: it });
      if (entries.length >= LIMIT) break;
    }
  }

  if (entries.length === 0) {
    console.log('No pending entries to send (check requests_log.json statuses).');
    process.exit(0);
  }

  console.log('Entries selected for processing:', entries.map(e=>e.idx));

  // create browser/context
  const context = await chromium.launchPersistentContext(PROFILE, {
    headless: false,
    executablePath: EXECUTABLE,
    args: ['--start-maximized'],
    viewport: null,
  });

  try {
    for (let eIdx = 0; eIdx < entries.length; eIdx++) {
      const { idx, item } = entries[eIdx];
      const threadUrl = item.threadUrl;
      if (!threadUrl || !threadUrl.startsWith('http')) {
        console.warn(`#${idx} missing or invalid threadUrl, skipping.`);
        logs[idx].status = 'invalid_threadUrl';
        logs[idx].updatedAt = nowISO();
        fs.writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2), 'utf8');
        continue;
      }

      console.log(`\n[${eIdx+1}/${entries.length}] Processing log index ${idx} -> ${threadUrl}`);
      const page = await context.newPage();
      try {
        await page.goto(threadUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(1200);

        // Try to detect composer element
        const composerSelectors = [
          'div[contenteditable="true"][role="textbox"]',
          'div.msg-form__contenteditable',
          'div[role="textbox"]',
          'div[contenteditable="true"]',
          'textarea',
        ];

        let composer = null;
        for (const sel of composerSelectors) {
          const el = await page.$(sel);
          if (el) {
            // ensure visible
            const rect = await el.evaluate(e=>{ const r=e.getBoundingClientRect(); return {w:r.width,h:r.height}; }).catch(()=>null);
            if (rect && rect.w>4 && rect.h>4) {
              composer = { sel, handle: el };
              break;
            }
          }
        }

        if (!composer) {
          // scan for any visible contenteditable/role elements
          const handles = await page.$$('[contenteditable="true"], [role="textbox"], [contenteditable]');
          for (const h of handles) {
            const rect = await h.evaluate(e=>{ const r=e.getBoundingClientRect(); return {w:r.width,h:r.height}; }).catch(()=>null);
            if (rect && rect.w>4 && rect.h>4) {
              // try to build a selector
              const id = await h.evaluate(e=>e.id).catch(()=>null);
              const cls = await h.evaluate(e=>e.className).catch(()=>'');
              const tag = await h.evaluate(e=>e.tagName).catch(()=>null);
              const sel = id ? '#'+id : (cls && typeof cls==='string' ? `${tag.toLowerCase()}.${cls.split(/\s+/)[0]}` : tag.toLowerCase());
              composer = { sel, handle: h };
              break;
            }
          }
        }

        if (!composer) {
          console.error('Composer not found on page; saving screenshot and marking as failed.');
          const snap = path.resolve(process.cwd(), `send_failed_${idx}_${Date.now()}.png`);
          await page.screenshot({ path: snap, fullPage: true });
          logs[idx].status = 'composer_not_found';
          logs[idx].updatedAt = nowISO();
          logs[idx].debugScreenshot = snap;
          fs.writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2), 'utf8');
          await page.close();
          continue;
        }

        console.log('Composer selector:', composer.sel);

        // insert message (use evaluate to be atomic)
        const TEXT = item.followupText || 'Pls share your Resume to proceed with further discussion.';
        await page.evaluate(({sel, text})=>{
          const el = document.querySelector(sel) || document.querySelector('[contenteditable="true"]') || document.querySelector('[role="textbox"]');
          if(!el) return false;
          el.focus();
          if (el.getAttribute && el.getAttribute('contenteditable')==='true') {
            while(el.firstChild) el.removeChild(el.firstChild);
            const p=document.createElement('p'); p.appendChild(document.createTextNode(text)); el.appendChild(p);
          } else if (el.tagName && (el.tagName.toLowerCase()==='textarea' || el.tagName.toLowerCase()==='input')) {
            el.value = text;
          } else {
            el.innerText = text;
          }
          ['input','change','blur'].forEach(ev => el.dispatchEvent(new Event(ev,{bubbles:true,cancelable:true})));
          return true;
        }, { sel: composer.sel, text: TEXT });

        await page.waitForTimeout(500);

        const beforeShot = path.resolve(process.cwd(), `send_before_${idx}_${Date.now()}.png`);
        await page.screenshot({ path: beforeShot, fullPage:true });

        if (CONFIRM) {
          // try to click a visible "Send" button
          // selectors attempted in order
          const sendSelectors = [
            'button:has-text("Send")',
            'button[aria-label="Send"]',
            'button[aria-label*="Send"]',
            'button[type="submit"]',
            'button span:has-text("Send")'
          ];

          let sent = false;
          for (const s of sendSelectors) {
            try {
              const button = await page.$(s);
              if (button) {
                // ensure visible / enabled
                const rect = await button.evaluate(b=>{ const r=b.getBoundingClientRect(); return {w:r.width,h:r.height,disabled:b.disabled}; }).catch(()=>null);
                if (rect && rect.w>4 && !rect.disabled) {
                  console.log('Clicking send via selector', s);
                  await button.click();
                  sent = true;
                  break;
                }
              }
            } catch (err) {
              // try next selector
            }
          }

          if (!sent) {
            // final fallback: pressing Enter in composer
            console.log('Send button not found, trying Enter key in composer');
            try {
              await page.keyboard.press('Enter');
              sent = true;
            } catch(e){}
          }

          if (sent) {
            await page.waitForTimeout(1500);
            const afterShot = path.resolve(process.cwd(), `send_after_${idx}_${Date.now()}.png`);
            await page.screenshot({ path: afterShot, fullPage:true });

            logs[idx].status = 'sent';
            logs[idx].sentAt = nowISO();
            logs[idx].debugBefore = beforeShot;
            logs[idx].debugAfter = afterShot;
            logs[idx].updatedAt = nowISO();
            fs.writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2), 'utf8');
            console.log(`✔ Message sent for index ${idx}.`);
          } else {
            console.error('Failed to send (no suitable method). Saving debug and skipping.');
            const failShot = path.resolve(process.cwd(), `send_failed_no_method_${idx}_${Date.now()}.png`);
            await page.screenshot({ path: failShot, fullPage:true });
            logs[idx].status = 'send_failed_no_method';
            logs[idx].debugScreenshot = failShot;
            logs[idx].updatedAt = nowISO();
            fs.writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2), 'utf8');
          }

        } else {
          console.log('Dry-run mode. Not clicking Send. Preview screenshot saved to', beforeShot);
          logs[idx].status = 'drafted';
          logs[idx].debugBefore = beforeShot;
          logs[idx].updatedAt = nowISO();
          fs.writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2), 'utf8');
        }

      } catch (err) {
        console.error('Error while processing entry', idx, err && err.message);
        logs[idx].status = 'error';
        logs[idx].error = (err && err.message) || String(err);
        logs[idx].updatedAt = nowISO();
        fs.writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2), 'utf8');
      } finally {
        try { await page.close(); } catch(e){}
      }

      // delay between messages
      if (eIdx < entries.length - 1) {
        console.log(`Waiting ${DELAY} seconds before next message...`);
        await sleep(DELAY * 1000);
      }
    } // end for entries

  } catch (err) {
    console.error('Fatal error:', err);
  } finally {
    console.log('Finished processing. Context left open for inspection; close when done.');
  }

})();
