/**
 * step8_send_followup_live_profilecopy_v5.js
 *
 * v5 — reliability upgrades (corrected single-file version)
 *
 * Usage (dry-run):
 *   node step8_send_followup_live_profilecopy_v5.js --index=0 --delay=8 --profile="/tmp/chrome-profile-copy"
 * Usage (send):
 *   node step8_send_followup_live_profilecopy_v5.js --index=0 --confirm --delay=12 --profile="/tmp/chrome-profile-copy"
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const argv = require('minimist')(process.argv.slice(2));

const CONFIRM = !!argv.confirm;
const CLOSE_AT_END = !!argv.close;
const DELAY = parseFloat(argv.delay || '20');
const INDEX = argv.index !== undefined ? parseInt(argv.index, 10) : null;
const PROFILE = argv.profile || '/tmp/chrome-profile-copy';
const EXECUTABLE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const LOG_PATH = path.resolve(__dirname, '..', 'data', 'requests_log.json');

// Primary composer selector used across script (adjust if LinkedIn changes DOM)
const COMPOSER_SELECTOR = 'div.msg-form__contenteditable';
const RETRY_COUNT = 12;
const RETRY_INTERVAL_MS = 1200;

// selectors to click/dismiss overlays
const DISMISS_SELECTORS = [
  'button[aria-label="Accept"]',
  'button:has-text("Accept")',
  'button:has-text("I agree")',
  'button:has-text("Got it")',
  'button:has-text("Agree")',
  '.cookie-consent-accept',
  '.artdeco-dismiss',
  'button[title*="Accept"]',
  'button[title*="Agree"]',
  'button:has-text("Close")',
  '.close-button',
  '.onboarding-disclaimer__button'
];

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
function nowISO(){ return new Date().toISOString(); }
function randInt(min, max){ return Math.floor(Math.random()*(max-min+1))+min; }

////////////////////////////////////////////////////////////////////////////////
// --- Enhanced input helpers (typing + event-dispatch + clipboard fallback) ---
////////////////////////////////////////////////////////////////////////////////

async function tryNativeType(page, selector, text) {
  try {
    await page.waitForSelector(selector, { timeout: 8000 });
    const el = await page.$(selector);
    if (!el) return false;

    try { await el.focus(); } catch (e) {
      try { await el.click({ timeout: 1000 }); } catch(e){}
    }

    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.down(modifier).catch(()=>null);
    await page.keyboard.press('KeyA').catch(()=>null);
    await page.keyboard.up(modifier).catch(()=>null);
    await page.keyboard.press('Backspace').catch(()=>null);

    for (const ch of text) {
      await page.keyboard.type(ch, { delay: randInt(40, 120) });
      if (Math.random() < 0.04) await page.waitForTimeout(randInt(10, 60));
    }

    await page.keyboard.press('Space').catch(()=>null);
    await page.keyboard.press('Backspace').catch(()=>null);
    await page.waitForTimeout(350);
    return true;
  } catch (e) {
    return false;
  }
}

async function setComposerTextAndDispatchEvents(page, selector, text) {
  try {
    await page.waitForSelector(selector, { timeout: 6000 });
    await page.evaluate((sel, msg) => {
      const el = document.querySelector(sel);
      if (!el) return;

      try {
        if (el.getAttribute && el.getAttribute('contenteditable') === 'true') {
          while (el.firstChild) el.removeChild(el.firstChild);
          const p = document.createElement('p');
          p.appendChild(document.createTextNode(msg));
          el.appendChild(p);
        } else if (el.tagName && (el.tagName.toLowerCase() === 'textarea' || el.tagName.toLowerCase() === 'input')) {
          el.value = msg;
        } else {
          el.innerText = msg;
        }
      } catch (err) {
        try { el.innerText = msg; } catch(e){}
      }

      const fire = (type, detail = {}) => {
        let ev;
        try {
          if (type.startsWith('composition')) ev = new CompositionEvent(type, { bubbles: true, cancelable: true, data: detail.data || null });
          else if (type === 'input') ev = new InputEvent('input', { bubbles: true, cancelable: true, data: detail.data || null, inputType: 'insertText' });
          else if (type.startsWith('key')) ev = new KeyboardEvent(type, { bubbles: true, cancelable: true, key: detail.key || '' });
          else ev = new Event(type, { bubbles: true, cancelable: true });
        } catch (e) {
          ev = document.createEvent('Event'); ev.initEvent(type, true, true);
        }
        el.dispatchEvent(ev);
      };

      fire('compositionstart', { data: '' });
      fire('compositionupdate', { data: msg.slice(0, Math.min(10, msg.length)) });
      fire('compositionend', { data: msg });

      fire('input', { data: msg });
      fire('keyup', { key: 'a' });
      fire('keydown', { key: 'a' });
      fire('change');
      fire('blur');
    }, selector, text);

    await page.waitForTimeout(300);
    return true;
  } catch (e) {
    return false;
  }
}

async function pasteMessageFallback(page, selector, text) {
  try {
    await page.waitForSelector(selector, { timeout: 6000 });
    const clipboardOK = await page.evaluate(async (msg) => {
      try {
        await navigator.clipboard.writeText(msg);
        return true;
      } catch (e) {
        return false;
      }
    }, text).catch(()=>false);

    try { await page.focus(selector); } catch(e) { try { const el = await page.$(selector); if (el) await el.click().catch(()=>null); } catch(e){} }
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    if (clipboardOK) {
      await page.keyboard.down(modifier).catch(()=>null);
      await page.keyboard.press('KeyV').catch(()=>null);
      await page.keyboard.up(modifier).catch(()=>null);
      await page.waitForTimeout(300);
      return true;
    } else {
      const tried = await page.evaluate((sel, msg) => {
        try {
          const el = document.querySelector(sel);
          if (!el) return false;
          el.focus();
          const ok = document.execCommand && document.execCommand('insertText', false, msg);
          return !!ok;
        } catch (e) {
          return false;
        }
      }, selector, text).catch(()=>false);

      if (tried) { await page.waitForTimeout(200); return true; }
      return await setComposerTextAndDispatchEvents(page, selector, text);
    }
  } catch (e) {
    return false;
  }
}

async function isSendButtonEnabled(page) {
  const checks = [
    'button:has-text("Send")',
    'button[aria-label="Send"]',
    'button.msg-form__send-button',
    'button[data-control-name="send_message"]'
  ];
  for (const sel of checks) {
    try {
      const el = await page.$(sel);
      if (!el) continue;
      const info = await el.evaluate(n => {
        const rect = n.getBoundingClientRect();
        return { w: Math.round(rect.width), h: Math.round(rect.height), disabled: !!n.disabled || n.getAttribute('aria-disabled') === 'true', className: n.className || '' };
      });
      if (info && info.w > 6 && !info.disabled) return true;
    } catch(e){}
  }
  return false;
}

async function composeWithRetries(page, selector, text) {
  let ok = await tryNativeType(page, selector, text);
  await page.waitForTimeout(250);
  if (ok) {
    const enabled = await isSendButtonEnabled(page);
    if (enabled) return true;
  }

  ok = await setComposerTextAndDispatchEvents(page, selector, text);
  await page.waitForTimeout(250);
  if (ok) {
    const enabled = await isSendButtonEnabled(page);
    if (enabled) return true;
  }

  ok = await pasteMessageFallback(page, selector, text);
  await page.waitForTimeout(250);
  return true;
}

////////////////////////////////////////////////////////////////////////////////
// --- Overlay dismiss helpers & event instrumentation (debug) -----------
////////////////////////////////////////////////////////////////////////////////

async function tryDismissOverlays(page){
  try {
    for (const sel of DISMISS_SELECTORS) {
      const els = await page.$$(sel).catch(()=>[]);
      if (!els || els.length===0) continue;
      for (const b of els){
        try {
          const visible = await b.evaluate(el => {
            const r = el.getBoundingClientRect();
            return r.width > 6 && r.height > 6 && window.getComputedStyle(el).visibility !== 'hidden';
          }).catch(()=>false);
          if (visible) {
            console.log('Clicking dismiss candidate:', sel);
            await b.click().catch(()=>null);
            await page.waitForTimeout(420);
          }
        } catch(e){}
      }
    }
  } catch(e){
    // safe-ignore overlay dismiss errors
  }
}

async function attachComposerInstrumentation(page) {
  page.on('console', msg => {
    try { console.log('PAGE LOG>', msg.text()); } catch(e){}
  });

  await page.evaluate(() => {
    const sel = 'div.msg-form__contenteditable[contenteditable="true"][role="textbox"]';
    const el = document.querySelector(sel) || document.querySelector('div.msg-form__contenteditable');
    if (!el) return;
    const eventTypes = ['keydown','keyup','keypress','input','compositionstart','compositionupdate','compositionend','change','blur'];
    eventTypes.forEach(t => {
      el.addEventListener(t, (ev) => {
        try {
          console.log(`EVENT_DETECTOR: ${t}`, { key: ev.key || null, data: ev.data || null, type: ev.type });
        } catch(e){}
      }, { capture: true });
    });

    const send = document.querySelector('button[aria-label*="Send"]') || document.querySelector('button.msg-form__send-button') || document.querySelector('button:has-text("Send")');
    if (send) {
      const mo = new MutationObserver(muts => {
        muts.forEach(m => {
          try {
            console.log('SEND_MUTATION', m.type, m.attributeName, send.getAttribute('aria-disabled'), send.disabled, send.className);
          } catch(e){}
        });
      });
      mo.observe(send, { attributes: true, attributeFilter: ['class','disabled','aria-disabled'] });
    }
  }).catch(()=>null);
}

////////////////////////////////////////////////////////////////////////////////
// --- Main process (walk logs, open threads, compose & send) --------------
////////////////////////////////////////////////////////////////////////////////

(async ()=>{
  console.log('V5 start — CONFIRM=', CONFIRM, ' INDEX=', INDEX, ' DELAY=', DELAY, ' PROFILE=', PROFILE);

  if (!fs.existsSync(LOG_PATH)) {
    console.error('requests_log.json not found at', LOG_PATH);
    process.exit(1);
  }
  let logs = JSON.parse(fs.readFileSync(LOG_PATH,'utf8')||'[]');

  // choose entries
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

  const context = await chromium.launchPersistentContext(PROFILE, {
    headless: false,
    executablePath: EXECUTABLE,
    args: ['--start-maximized'],
    viewport: null,
  });

  try {
    for (let eI=0; eI<entries.length; eI++) {
      const { idx, item } = entries[eI];
      const threadUrl = item.threadUrl || item.linkedinUrl || item.ThreadURL;
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
        console.log('Navigating to thread ...');
        await page.goto(threadUrl, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(()=>null);
        await page.waitForTimeout(800);
        await page.evaluate(()=>window.scrollBy(0,150)).catch(()=>null);
        await page.waitForTimeout(600);

        // aggressively try to dismiss overlays before scanning
        await tryDismissOverlays(page);

        // attach instrumentation optionally (uncomment for debug)
        // await attachComposerInstrumentation(page);

        // retry loop waiting for composer
        let composerHandle = null;

        // --------- robust composer detection (try multiple selectors + frames) ----------
        const candidateSelectors = [
          'div.msg-form__contenteditable[contenteditable="true"][role="textbox"]',
          'div.msg-form__contenteditable',
          'div[role="textbox"][contenteditable="true"]',
          'div[role="textbox"]',
          'textarea[name="message"]',
          'textarea',
          'input[role="combobox"]',
          'div[contenteditable="true"]'
        ];

        // Helper: check if element is visible enough
        async function isVisibleEnough(el) {
          try {
            const rect = await el.evaluate(e => {
              const r = e.getBoundingClientRect();
              return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) };
            });
            return rect && rect.w > 8 && rect.h > 8;
          } catch (e) { return false; }
        }

        for (let attempt = 1; attempt <= RETRY_COUNT && !composerHandle; attempt++) {
          console.log(`Composer attempt ${attempt}/${RETRY_COUNT} (multi-selector/frame) ...`);
          await tryDismissOverlays(page);

          // 1) try main frame (page)
          for (const sel of candidateSelectors) {
            try {
              const h = await page.$(sel).catch(()=>null);
              if (h && await isVisibleEnough(h)) {
                composerHandle = h;
                console.log('Composer found in main frame using selector:', sel);
                break;
              }
            } catch (e) {}
          }

          // 2) try child frames
          if (!composerHandle) {
            const frames = page.frames();
            for (const f of frames) {
              if (f === page.mainFrame()) continue;
              for (const sel of candidateSelectors) {
                try {
                  const h = await f.$(sel).catch(()=>null);
                  if (h && await isVisibleEnough(h)) {
                    composerHandle = { frame: f, selector: sel };
                    console.log(`Composer found in frame "${f.name() || 'unnamed'}" using selector:`, sel);
                    break;
                  }
                } catch (e) {}
              }
              if (composerHandle) break;
            }
          }

          // 3) try reveal buttons if not found
          if (!composerHandle) {
            const revealBtns = [
              '.msg-overlay-bubble-header__compose-button',
              'button[aria-label*="Reply"]',
              'button[aria-label*="Message"]',
              'button:has-text("Message")',
              'button:has-text("Reply")',
              '.msg-thread__compose-button'
            ];
            for (const sel of revealBtns) {
              try {
                const b = await page.$(sel);
                if (b) { console.log('Clicking reveal button:', sel); await b.click().catch(()=>null); await page.waitForTimeout(550); }
              } catch(e){}
            }
          }

          await page.waitForTimeout(RETRY_INTERVAL_MS);
        }

        // normalize composerHandle if it was stored as {frame, selector}
        if (composerHandle && composerHandle.frame && composerHandle.selector) {
          try {
            const h = await composerHandle.frame.$(composerHandle.selector);
            if (h) composerHandle = h;
            else composerHandle = null;
          } catch (e) { composerHandle = null; }
        }

        if (!composerHandle) {
          const snap = path.resolve(process.cwd(), `send_failed_${idx}_${Date.now()}.png`);
          await page.screenshot({ path: snap, fullPage: true });
          console.error('Composer not found after retries. Saved', snap);
          logs[idx].status = 'composer_not_found';
          logs[idx].debugScreenshot = snap;
          logs[idx].updatedAt = nowISO();
          fs.writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2), 'utf8');
          try { await page.close(); } catch(e){}
          continue;
        }

        // ensure composer element is focused and cleared, then type human-like
        await page.bringToFront();

        // If composer was inside a frame (we have an ElementHandle, but focusing by selector in page may fail),
        // attempt to operate directly via the handle if possible. We'll try page-level selector first, then handle.
        let composerSelectorToUse = COMPOSER_SELECTOR;
        try {
          const isHandle = typeof composerHandle.evaluate === 'function';
          if (isHandle) {
            // try to focus via handle
            try { await composerHandle.focus(); } catch(e) {}
          } else {
            // fallback: focus by selector
            try { await page.focus(COMPOSER_SELECTOR); } catch(e) {}
          }
        } catch(e){}

        // Clear composer safely (handle possible frame context) - we'll attempt both methods
        try {
          await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) return;
            try {
              if (el.getAttribute && el.getAttribute('contenteditable') === 'true') {
                while (el.firstChild) el.removeChild(el.firstChild);
                const p = document.createElement('p');
                p.appendChild(document.createTextNode(''));
                el.appendChild(p);
              } else if (el.tagName && (el.tagName.toLowerCase() === 'textarea' || el.tagName.toLowerCase() === 'input')) {
                el.value = '';
              } else {
                el.innerText = '';
              }
            } catch (e) {
              try { el.innerText = ''; } catch(e){}
            }
          }, COMPOSER_SELECTOR);
        } catch(e){
          // If page.evaluate clearing failed (e.g., element is inside a different frame), try using the handle directly
          try {
            await composerHandle.evaluate(el => {
              try {
                if (el.getAttribute && el.getAttribute('contenteditable') === 'true') {
                  while (el.firstChild) el.removeChild(el.firstChild);
                  const p = document.createElement('p');
                  p.appendChild(document.createTextNode(''));
                  el.appendChild(p);
                } else if (el.tagName && (el.tagName.toLowerCase() === 'textarea' || el.tagName.toLowerCase() === 'input')) {
                  el.value = '';
                } else {
                  el.innerText = '';
                }
              } catch (e) { try { el.innerText = ''; } catch(e){} }
            });
          } catch(e){}
        }

        // Focus attempts
        try { await page.focus(COMPOSER_SELECTOR); } catch (e) {
          try { if (composerHandle && typeof composerHandle.click === 'function') await composerHandle.click({ timeout: 1000 }).catch(()=>null); } catch(e){}
        }
        await page.waitForTimeout(180);

        const TEXT = item.followupText || item.message || 'Pls share your Resume to proceed with further discussion.';
        console.log('Composing message preview:', TEXT.slice(0,80).replace(/\n/g,' '));

        // Compose into the discovered composer: prefer the exact element handle if possible
        let composeSelector = 'div.msg-form__contenteditable[contenteditable="true"][role="textbox"]';
        try {
          // If composerHandle is an ElementHandle, try using its frame/handle path
          if (composerHandle && composerHandle.evaluate) {
            // Use the handle by executing typing inside its frame
            const parentFrame = composerHandle._context ? composerHandle._context.frame() : null;
            // Fallback to page-level composeWithRetries
            await composeWithRetries(page, composeSelector, TEXT);
          } else {
            await composeWithRetries(page, composeSelector, TEXT);
          }
        } catch(e) {
          // fallback: try a broader selector
          await composeWithRetries(page, 'div[contenteditable="true"]', TEXT);
        }

        await page.waitForTimeout(700);
        const beforeShot = path.resolve(process.cwd(), `send_before_${idx}_${Date.now()}.png`);
        await page.screenshot({ path: beforeShot, fullPage: true });
        console.log('Saved beforeShot ->', beforeShot);

        if (CONFIRM) {
          console.log('Attempting to send...');
          let sent = false;
          const afterAttempts = [];

          async function tryClickSelector(sel, label) {
            try {
              const el = await page.$(sel);
              if (!el) { afterAttempts.push(`${label}: not found`); return false; }
              const rect = await el.evaluate(n => {
                const r = n.getBoundingClientRect();
                return { w: Math.round(r.width), h: Math.round(r.height), disabled: n.disabled || n.getAttribute('aria-disabled') === 'true', className: n.className || '' };
              }).catch(()=>null);
              if (!rect || rect.w <= 6 || rect.disabled) {
                afterAttempts.push(`${label}: found but not clickable/disabled`);
                return false;
              }
              console.log('Clicking send via', label, sel);
              await el.click().catch(()=>null);
              await page.waitForTimeout(900);
              afterAttempts.push(`${label}: clicked`);
              return true;
            } catch (e) {
              afterAttempts.push(`${label}: error ${(e && e.message) || e}`);
              return false;
            }
          }

          const sendCandidates = [
            ['button:has-text("Send")', 'has-text Send'],
            ['button[aria-label="Send"]', 'aria-label Send'],
            ['button[type="submit"]', 'type=submit'],
            ['button[data-control-name="send_message"]', 'data-control send_message (fallback)']
          ];
          for (const [sel, label] of sendCandidates) {
            if (await tryClickSelector(sel, label)) { sent = true; break; }
          }

          if (!sent) {
            try {
              const loc = page.locator('button', { hasText: 'Send' });
              if (await loc.count() > 0) {
                await loc.first().click({ timeout: 1200 }).catch(()=>null);
                await page.waitForTimeout(900);
                sent = true;
                afterAttempts.push('locator: clicked Send');
              } else {
                afterAttempts.push('locator: none found');
              }
            } catch(e) { afterAttempts.push('locator: error '+(e && e.message)); }
          }

          if (!sent) {
            const jsSelectors = [
              'button[aria-label="Send"]',
              'button:has-text("Send")',
              'div[role="button"][aria-label="Send"]',
              '.msg-form__send-button'
            ];
            for (const s of jsSelectors) {
              try {
                const ok = await page.evaluate(sel => {
                  const el = document.querySelector(sel);
                  if (!el) return false;
                  el.click();
                  return true;
                }, s).catch(()=>false);
                afterAttempts.push(`js-click ${s}: ${ok ? 'ok' : 'no element'}`);
                if (ok) { sent = true; await page.waitForTimeout(900); break; }
              } catch(e) { afterAttempts.push(`js-click ${s}: error`); }
            }
          }

          if (!sent) {
            try {
              try { await page.focus(COMPOSER_SELECTOR); } catch(e){}
              if (process.platform === 'darwin') {
                await page.keyboard.down('Meta').catch(()=>null);
                await page.keyboard.press('Enter').catch(()=>null);
                await page.keyboard.up('Meta').catch(()=>null);
              } else {
                await page.keyboard.down('Control').catch(()=>null);
                await page.keyboard.press('Enter').catch(()=>null);
                await page.keyboard.up('Control').catch(()=>null);
              }
              await page.waitForTimeout(700);
              if (!sent) {
                await page.keyboard.press('Enter').catch(()=>null);
                await page.waitForTimeout(700);
              }
              afterAttempts.push('keyboard combos attempted');
            } catch(e) { afterAttempts.push('keyboard combos error '+(e && e.message)); }
          }

          const afterShot = path.resolve(process.cwd(), `send_after_${idx}_${Date.now()}.png`);
          await page.waitForTimeout(800);
          await page.screenshot({ path: afterShot, fullPage: true });

          if (!sent) {
            try {
              const content = await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                if (!el) return null;
                if (el.getAttribute && el.getAttribute('contenteditable') === 'true') return el.innerText || el.textContent || '';
                if (el.tagName && (el.tagName.toLowerCase() === 'textarea' || el.tagName.toLowerCase() === 'input')) return el.value || '';
                return el.innerText || el.textContent || '';
              }, COMPOSER_SELECTOR);
              if (!content || (typeof content === 'string' && content.trim().length === 0)) {
                sent = true;
                afterAttempts.push('verified: composer cleared => assume sent');
              } else {
                afterAttempts.push('verified: composer still has text');
              }
            } catch (e) {
              afterAttempts.push('verify-check error '+(e && e.message));
            }
          }

          if (sent) {
            logs[idx].status = 'sent';
            logs[idx].sentAt = nowISO();
            logs[idx].debugBefore = beforeShot;
            logs[idx].debugAfter = path.resolve(process.cwd(), `send_after_${idx}_${Date.now()}.png`);
            logs[idx].updatedAt = nowISO();
            logs[idx].sendAttemptLog = afterAttempts;
            fs.writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2), 'utf8');
            console.log('✔ Sent and logged for index', idx);
          } else {
            logs[idx].status = 'send_failed_no_method';
            logs[idx].debugScreenshot = path.resolve(process.cwd(), `send_after_${idx}_${Date.now()}.png`);
            logs[idx].updatedAt = nowISO();
            logs[idx].sendAttemptLog = afterAttempts;
            fs.writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2), 'utf8');
            console.error('Failed to send for index', idx, afterAttempts);
          }
        } // end CONFIRM

        console.log('Keeping the thread visible for inspection.');
        if (CLOSE_AT_END) {
          await page.waitForTimeout(3000);
          try { await page.close(); } catch(e){}
        } else {
          await page.waitForTimeout(1000);
        }

      } catch (err) {
        console.error('Error processing index', idx, err && err.message);
        logs[idx].status = 'error';
        logs[idx].error = (err && err.message) || String(err);
        logs[idx].updatedAt = nowISO();
        fs.writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2), 'utf8');
        try { await page.close(); } catch(e){}
      }

      if (eI < entries.length - 1) {
        console.log(`Waiting ${DELAY}s before next message...`);
        await sleep(DELAY * 1000);
      }
    } // entries loop
  } catch(ex) {
    console.error('Fatal:', ex && ex.message);
  } finally {
    console.log('Done. Browser left open for inspection; close when finished.');
  }
})();