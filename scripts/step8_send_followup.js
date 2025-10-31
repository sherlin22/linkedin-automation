/**
 * scripts/step8_send_followup.js
 *
 * Usage:
 *   node step8_send_followup.js "<threadUrl>" [--send] [--dry-run]
 *   node step8_send_followup.js <logIndex> [--send] [--dry-run]
 *
 * Behavior:
 *  - If given a numeric logIndex, it will read data/requests_log.json[logIndex] to get threadUrl.
 *  - It will open the conversation, find the composer, paste the follow-up text, save screenshot.
 *  - By default it only drafts (does NOT press send). Use --send to attempt sending (risky).
 *  - Updates the log entry with followupDraftPath and status 'followup_drafted' (or 'followup_sent').
 */
require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const FOLLOWUP_TEXT = 'Pls share your Resume to proceed with further discussion.';
const LOG_PATH = path.resolve(__dirname, '..', 'data', 'requests_log.json');

function ensureLog() {
  if (!fs.existsSync(path.dirname(LOG_PATH))) fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  if (!fs.existsSync(LOG_PATH)) fs.writeFileSync(LOG_PATH, '[]', 'utf8');
}
function readLog(){ ensureLog(); return JSON.parse(fs.readFileSync(LOG_PATH,'utf8')||'[]'); }
function writeLog(arr){ fs.writeFileSync(LOG_PATH, JSON.stringify(arr, null, 2),'utf8'); }

(async () => {
  const argv = process.argv.slice(2);
  if (!argv[0]) {
    console.error('Usage: node step8_send_followup.js "<threadUrl|logIndex>" [--send] [--dry-run]');
    process.exit(1);
  }

  const target = argv[0];
  const doSend = argv.includes('--send');
  const dryRun = argv.includes('--dry-run');

  let threadUrl = null;
  let logIndex = null;
  if (/^\d+$/.test(target)) {
    logIndex = parseInt(target, 10);
    const logs = readLog();
    if (!logs[logIndex]) {
      console.error('No log entry at index', logIndex);
      process.exit(1);
    }
    threadUrl = logs[logIndex].threadUrl;
  } else {
    threadUrl = target;
  }

  if (!threadUrl || !threadUrl.startsWith('http')) {
    console.error('Invalid thread URL:', threadUrl);
    process.exit(1);
  }

  const storagePath = path.resolve(__dirname, '..', 'data', 'linkedin-storage.json');
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    storageState: storagePath,
    args: ['--start-maximized'],
    viewport: null,
  });

  try {
    const page = await context.newPage();
    console.log('Navigating to conversation URL:', threadUrl);
    await page.goto(threadUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1500);

    // Try known selectors
    const selectors = [
      'div.msg-form__contenteditable[contenteditable="true"]',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]',
      'textarea.msg-form__textarea'
    ];

    let composer = null;
    let matchedSelector = null;
    for (const sel of selectors) {
      try {
        await page.waitForSelector(sel, { timeout: 5000 });
        composer = await page.$(sel);
        if (composer) { matchedSelector = sel; break; }
      } catch(e){}
    }

    if (!composer) {
      console.error('Could not find composer. Saving screenshot for inspection.');
      const fallbackShot = path.resolve(process.cwd(), 'followup_failed_snapshot.png');
      await page.screenshot({ path: fallbackShot, fullPage: true });
      console.log('Saved', fallbackShot);
      process.exit(1);
    }

    // Set follow-up text atomically
    const sanitized = FOLLOWUP_TEXT.trim();
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
      ['input','change','blur'].forEach(ev => el.dispatchEvent(new Event(ev, { bubbles: true, cancelable: true })));
      return true;
    }, { sel: matchedSelector, text: sanitized });

    await page.waitForTimeout(400);

    const stamp = new Date().toISOString().replace(/[:.]/g,'-');
    const screenshotPath = path.resolve(process.cwd(), `followup_draft_${stamp}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    console.log('Follow-up drafted. Screenshot saved to', screenshotPath);

    // If user asked to actually send, attempt to send (risky)
    if (doSend) {
      console.log('Attempting to send (you enabled --send). This may send a real message.');
      // Try pressing Enter in the composer to send
      try {
        await composer.focus();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(800);
        console.log('Send attempt made (check conversation).');
      } catch (e) {
        console.error('Send attempt failed:', e.message);
      }
    } else {
      console.log('Not sending. To send automatically use --send (use with caution).');
    }

    // Update the log if this thread is present
    const logs = readLog();
    let updated = false;
    for (let i=0;i<logs.length;i++){
      if (logs[i].threadUrl && logs[i].threadUrl.replace(/\/+$/,'') === threadUrl.replace(/\/+$/,'')) {
        logs[i].followupDraftPath = screenshotPath;
        logs[i].followupDraftedAt = new Date().toISOString();
        logs[i].status = doSend ? 'followup_sent' : 'followup_drafted';
        if (doSend) logs[i].followupSentAt = new Date().toISOString();
        updated = true;
        writeLog(logs);
        console.log('Updated log entry index', i);
        break;
      }
    }
    if (!updated && typeof logIndex === 'number') {
      const logs2 = readLog();
      logs2[logIndex] = logs2[logIndex] || {};
      logs2[logIndex].threadUrl = threadUrl;
      logs2[logIndex].followupDraftPath = screenshotPath;
      logs2[logIndex].followupDraftedAt = new Date().toISOString();
      logs2[logIndex].status = doSend ? 'followup_sent' : 'followup_drafted';
      if (doSend) logs2[logIndex].followupSentAt = new Date().toISOString();
      writeLog(logs2);
      console.log('Updated (or created) log entry at index', logIndex);
      updated = true;
    }

    if (!updated) {
      // append a new log entry so action is recorded
      const logs3 = readLog();
      logs3.push({
        threadUrl,
        name: 'unknown',
        timestamp: new Date().toISOString(),
        status: doSend ? 'followup_sent' : 'followup_drafted',
        followupDraftPath: screenshotPath,
        followupDraftedAt: new Date().toISOString()
      });
      writeLog(logs3);
      console.log('Appended new log entry for thread (no existing log matched).');
    }

  } catch (err) {
    console.error('Error in step8_send_followup:', err);
  } finally {
    console.log('Done.');
    // keep browser open for inspection
  }
})();
