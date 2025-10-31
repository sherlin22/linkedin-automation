/**
 * step8_send_followup_test.js
 * Usage:
 *   node step8_send_followup_test.js <logIndex|threadUrl> "<composerSelector>"
 *
 * This is a temporary dry-run script. It will:
 *  - open the thread using existing storageState
 *  - use the provided CSS selector to locate the composer
 *  - paste the follow-up text and save a screenshot (does NOT send)
 */
require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const FOLLOWUP_TEXT = 'Pls share your Resume to proceed with further discussion.';
const storagePath = path.resolve(__dirname, '..', 'data', 'linkedin-storage.json');

(async () => {
  const args = process.argv.slice(2);
  if (!args[0] || !args[1]) {
    console.error('Usage: node step8_send_followup_test.js <logIndex|threadUrl> "<composerSelector>"');
    process.exit(1);
  }
  const target = args[0];
  const selector = args[1];
  // Resolve threadUrl from log if numeric index
  let threadUrl = target;
  try {
    if (/^\d+$/.test(target)) {
      const logPath = path.resolve(__dirname, '..', 'data', 'requests_log.json');
      const logs = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath,'utf8')||'[]') : [];
      const idx = parseInt(target,10);
      if (!logs[idx] || !logs[idx].threadUrl) {
        console.error('No log entry at index', idx);
        process.exit(1);
      }
      threadUrl = logs[idx].threadUrl;
    }
  } catch (e) {
    console.error('Error reading log:', e);
    process.exit(1);
  }

  if (!threadUrl || !threadUrl.startsWith('http')) {
    console.error('Invalid thread URL:', threadUrl);
    process.exit(1);
  }

  const context = await chromium.launchPersistentContext('', {
    headless: false,
    storageState: storagePath,
    args: ['--start-maximized'],
    viewport: null,
  });

  try {
    const page = await context.newPage();
    console.log('Opening thread:', threadUrl);
    await page.goto(threadUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1500);

    console.log('Using composer selector:', selector);
    const ok = await page.$(selector);
    if (!ok) {
      console.error('Selector not found on the page. Saving snapshot for debugging.');
      const snap = path.resolve(process.cwd(), 'followup_selector_not_found.png');
      await page.screenshot({ path: snap, fullPage: true });
      console.log('Saved', snap);
      process.exit(1);
    }

    // Atomically set composer content
    await page.evaluate(({ sel, text }) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      el.focus();
      if (el.getAttribute && el.getAttribute('contenteditable') === 'true') {
        while (el.firstChild) el.removeChild(el.firstChild);
        const p = document.createElement('p');
        p.appendChild(document.createTextNode(text));
        el.appendChild(p);
      } else if (el.tagName.toLowerCase()==='textarea' || el.tagName.toLowerCase()==='input') {
        el.value = text;
      } else {
        el.innerText = text;
      }
      ['input','change','blur'].forEach(ev => el.dispatchEvent(new Event(ev,{bubbles:true,cancelable:true})));
      return true;
    }, { sel: selector, text: FOLLOWUP_TEXT });

    await page.waitForTimeout(400);
    const stamp = new Date().toISOString().replace(/[:.]/g,'-');
    const screenshotPath = path.resolve(process.cwd(), `followup_test_${stamp}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log('Drafted follow-up. Screenshot saved to', screenshotPath);
    console.log('Dry-run complete (did NOT send).');
  } catch (err) {
    console.error('Error in test:', err);
  } finally {
    // keep browser open for you to inspect
    console.log('Done.');
  }
})();
