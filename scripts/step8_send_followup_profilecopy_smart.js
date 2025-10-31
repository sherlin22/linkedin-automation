/**
 * step8_send_followup_profilecopy_smart.js
 * Usage:
 *  node step8_send_followup_profilecopy_smart.js <logIndex|threadUrl>
 *
 * Behavior:
 * - Uses the copied profile at /tmp/chrome-profile-copy
 * - Tries many selectors and heuristics to find the LinkedIn composer
 * - Inserts FOLLOWUP_TEXT (dry-run) and saves a screenshot
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const FOLLOWUP_TEXT = 'Pls share your Resume to proceed with further discussion.';
const userDataDir = '/tmp/chrome-profile-copy';
const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function isVisibleSyncRect(rect) {
  return rect && rect.width > 1 && rect.height > 1;
}

(async () => {
  const args = process.argv.slice(2);
  if (!args[0]) {
    console.error('Usage: node step8_send_followup_profilecopy_smart.js <logIndex|threadUrl>');
    process.exit(1);
  }
  let threadUrl = args[0];
  // support numeric log index (optional)
  if (/^\\d+$/.test(threadUrl)) {
    try {
      const logPath = path.resolve(__dirname, '..', 'data', 'requests_log.json');
      if (fs.existsSync(logPath)) {
        const logs = JSON.parse(fs.readFileSync(logPath, 'utf8') || '[]');
        const idx = parseInt(threadUrl, 10);
        if (logs[idx] && logs[idx].threadUrl) threadUrl = logs[idx].threadUrl;
      }
    } catch (e) {
      // ignore, use provided threadUrl
    }
  }

  const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath,
    args: ['--start-maximized'],
    viewport: null,
  });

  try {
    const page = await browser.newPage();
    console.log('Opening thread:', threadUrl);
    await page.goto(threadUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1500);

    // Candidate selectors (ordered)
    const candidateSelectors = [
      'div[contenteditable="true"][role="textbox"]',
      'div.msg-form__contenteditable',
      'div.msg-form__contenteditable[contenteditable="true"]',
      'div[role="textbox"]',
      'div[contenteditable="true"]',
      'div.msg-form__msg-content-container div[contenteditable]',
      'div.msg-form__message-texteditor div[contenteditable]',
      'textarea', 'input[role="textbox"]', 'div.composer',
      '#msg-form-ember', // fallback to id prefix (rare)
    ];

    console.log('Trying candidate selectors...');
    let usedSelector = null;
    for (const sel of candidateSelectors) {
      try {
        const el = await page.$(sel);
        if (!el) { console.log('MISS', sel); continue; }
        // check visible
        const rect = await el.evaluate(e => {
          const r = e.getBoundingClientRect();
          return { width: r.width, height: r.height };
        }).catch(()=>null);
        if (isVisibleSyncRect(rect)) {
          usedSelector = sel;
          console.log('FOUND (visible):', sel);
          break;
        } else {
          console.log('FOUND but not visible:', sel);
        }
      } catch (e) {
        console.log('ERR checking', sel, e.message);
      }
    }

    // If still not found, search any contenteditable/role elements and pick the visible one
    if (!usedSelector) {
      console.log('No candidate selector matched visible composer. Scanning all contenteditable/role=textbox elements...');
      const elHandles = await page.$$('[contenteditable="true"], [role="textbox"], [contenteditable]');
      for (const el of elHandles) {
        const rect = await el.evaluate(e => {
          const r = e.getBoundingClientRect();
          return { width: r.width, height: r.height };
        }).catch(()=>null);
        if (isVisibleSyncRect(rect)) {
          // attempt to get a short path to return as selector
          usedSelector = await el.evaluate(e => {
            let s = '';
            if (e.id) return '#' + e.id;
            if (e.className) s = '.' + e.className.toString().split(/\\s+/).join('.');
            return (e.tagName || 'div') + s;
          }).catch(()=>null) || 'contenteditable element';
          console.log('Selected visible element via scan: ', usedSelector);
          break;
        }
      }
    }

    // If still nothing visible, try to click "Write a message" or message-open buttons
    if (!usedSelector) {
      console.log('No visible contenteditable found. Trying to open composer by clicking likely buttons...');
      const openSelectors = [
        'button[aria-label*="Message"]',
        'button:has-text("Message")',
        'button:has-text("Write")',
        'button:has-text("Reply")',
        'a:has-text("Message")',
        '.message-anywhere-button'
      ];
      for (const os of openSelectors) {
        try {
          const b = await page.$(os);
          if (b) {
            console.log('Clicking potential open button:', os);
            await b.click().catch(()=>null);
            await page.waitForTimeout(800);
          }
        } catch(e){/* ignore */}
      }
      // re-scan for contenteditable
      const elHandles2 = await page.$$('[contenteditable="true"], [role="textbox"], [contenteditable]');
      for (const el of elHandles2) {
        const rect = await el.evaluate(e => {
          const r = e.getBoundingClientRect();
          return { width: r.width, height: r.height };
        }).catch(()=>null);
        if (isVisibleSyncRect(rect)) {
          usedSelector = await el.evaluate(e => {
            if (e.id) return '#' + e.id;
            if (e.className) return e.tagName + '.' + e.className.toString().split(/\\s+/).join('.');
            return 'contenteditable element';
          }).catch(()=>null);
          console.log('After clicking open button, found:', usedSelector);
          break;
        }
      }
    }

    if (!usedSelector) {
      console.error('❌ Could not find a visible composer element on the page.');
      const snap = path.resolve(process.cwd(), 'followup_selector_not_found_profilecopy.png');
      await page.screenshot({ path: snap, fullPage: true });
      console.log('Saved debug screenshot to', snap);
      process.exit(1);
    }

    // Now insert text into the found element using evaluate
    console.log('Inserting text into:', usedSelector);
    await page.evaluate(({ sel, text }) => {
      const el = (sel.startsWith('#')||sel.startsWith('.')||sel.includes(' ')) ? document.querySelector(sel) : (document.querySelector(sel) || document.querySelector('[contenteditable="true"]'));
      if (!el) return false;
      el.focus();
      if (el.getAttribute && el.getAttribute('contenteditable') === 'true') {
        while (el.firstChild) el.removeChild(el.firstChild);
        const p = document.createElement('p');
        p.appendChild(document.createTextNode(text));
        el.appendChild(p);
      } else if (el.tagName && (el.tagName.toLowerCase()==='textarea' || el.tagName.toLowerCase()==='input')) {
        el.value = text;
      } else {
        el.innerText = text;
      }
      ['input','change','blur'].forEach(ev => el.dispatchEvent(new Event(ev,{bubbles:true,cancelable:true})));
      return true;
    }, { sel: usedSelector, text: FOLLOWUP_TEXT });

    await page.waitForTimeout(600);
    const screenshot = path.resolve(process.cwd(), 'followup_test_profilecopy_smart.png');
    await page.screenshot({ path: screenshot, fullPage: true });
    console.log('✅ Drafted follow-up (dry-run). Screenshot saved to', screenshot);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    console.log('Done. Browser left open for inspection.');
  }
})();
