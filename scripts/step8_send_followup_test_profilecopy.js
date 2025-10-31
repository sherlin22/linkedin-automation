/**
 * step8_send_followup_test_profilecopy.js
 * Usage:
 *   node step8_send_followup_test_profilecopy.js <logIndex|threadUrl> "<composerSelector>"
 *
 * Opens the thread using the copied Chrome profile (/tmp/chrome-profile-copy)
 * and inserts the follow-up message text (dry-run only — does NOT send).
 */
require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const FOLLOWUP_TEXT = 'Pls share your Resume to proceed with further discussion.';

// Use the safe copied Chrome profile
const userDataDir = '/tmp/chrome-profile-copy';
const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  const args = process.argv.slice(2);
  if (!args[0] || !args[1]) {
    console.error('Usage: node step8_send_followup_test_profilecopy.js <logIndex|threadUrl> "<composerSelector>"');
    process.exit(1);
  }

  let threadUrl = args[0];
  const selector = args[1];

  try {
    if (/^\d+$/.test(threadUrl)) {
      const logPath = path.resolve(__dirname, '..', 'data', 'requests_log.json');
      if (fs.existsSync(logPath)) {
        const logs = JSON.parse(fs.readFileSync(logPath, 'utf8') || '[]');
        const idx = parseInt(threadUrl, 10);
        if (logs[idx] && logs[idx].threadUrl) threadUrl = logs[idx].threadUrl;
        else throw new Error('Invalid log index');
      }
    }
  } catch (e) {
    console.error('Error reading log file:', e.message);
    process.exit(1);
  }

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath,
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
      console.error('Selector not found. Saving snapshot for debugging.');
      const snap = path.resolve(process.cwd(), 'followup_selector_not_found_profilecopy.png');
      await page.screenshot({ path: snap, fullPage: true });
      console.log('Saved', snap);
      process.exit(1);
    }

    // Type message into the composer
    await page.evaluate(({ sel, text }) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      el.focus();
      if (el.getAttribute && el.getAttribute('contenteditable') === 'true') {
        while (el.firstChild) el.removeChild(el.firstChild);
        const p = document.createElement('p');
        p.appendChild(document.createTextNode(text));
        el.appendChild(p);
      } else if (el.tagName.toLowerCase() === 'textarea' || el.tagName.toLowerCase() === 'input') {
        el.value = text;
      } else {
        el.innerText = text;
      }
      ['input', 'change', 'blur'].forEach(ev => el.dispatchEvent(new Event(ev, { bubbles: true, cancelable: true })));
      return true;
    }, { sel: selector, text: FOLLOWUP_TEXT });

    await page.waitForTimeout(500);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = path.resolve(process.cwd(), `followup_test_profilecopy_${stamp}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log('✅ Drafted follow-up. Screenshot saved to', screenshotPath);
    console.log('Dry-run complete (did NOT send).');
  } catch (err) {
    console.error('Error in test:', err);
  } finally {
    console.log('Done. Browser left open for you to inspect.');
  }
})();
