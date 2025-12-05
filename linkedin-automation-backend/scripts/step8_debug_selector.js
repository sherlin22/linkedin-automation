/**
 * step8_debug_selector.js
 * Usage:
 *  node step8_debug_selector.js <logIndex|threadUrl>
 *
 * Opens the thread using storageState, screenshots the page,
 * dumps a small html file and checks multiple selectors both
 * on the main page and inside any frames.
 */
require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const storagePath = path.resolve(__dirname, '..', 'data', 'linkedin-storage.json');
const OUT_DIR = process.cwd();

(async () => {
  const args = process.argv.slice(2);
  if (!args[0]) {
    console.error('Usage: node step8_debug_selector.js <logIndex|threadUrl>');
    process.exit(1);
  }
  let threadUrl = args[0];
  try {
    if (/^\d+$/.test(args[0])) {
      const logPath = path.resolve(__dirname, '..', 'data', 'requests_log.json');
      const logs = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath,'utf8')||'[]') : [];
      const idx = parseInt(args[0],10);
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

  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    storageState: storagePath,
    args: ['--start-maximized'],
    viewport: null,
  });

  try {
    const page = await browser.newPage();
    console.log('Opening thread:', threadUrl);
    await page.goto(threadUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1200);

    const stamp = new Date().toISOString().replace(/[:.]/g,'-');
    const screenshotPath = path.resolve(OUT_DIR, `followup_selector_debug_${stamp}.png`);
    const htmlPath = path.resolve(OUT_DIR, `followup_selector_debug_${stamp}.html`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    const bodyHtml = await page.$eval('body', el => el.innerHTML).catch(()=>null);
    if (bodyHtml) fs.writeFileSync(htmlPath, '<!-- truncated body -->\n' + bodyHtml.slice(0, 20000), 'utf8');

    console.log('Saved screenshot to', screenshotPath);
    console.log('Saved page html snapshot to', htmlPath);

    // selectors to check
    const selectors = [
      'div[contenteditable="true"][role="textbox"]',
      'div.msg-form__contenteditable',
      'div[role="textbox"]',
      'div[contenteditable="true"]',
      'textarea',
      '#msg-form-ember7816',
      '.msg-form__msg-content-container'
    ];

    async function checkSelectorsOn(fr, label) {
      console.log(`\n--- Checking selectors on ${label} ---`);
      for (const sel of selectors) {
        try {
          const el = await fr.$(sel);
          if (el) {
            const tag = await fr.evaluate(e => e.tagName, el).catch(()=>null);
            const text = await fr.evaluate(e => (e.innerText||e.value||'').slice(0,120), el).catch(()=>'');
            console.log(`FOUND: ${sel}  (tag=${tag}) sampleText="${text.replace(/\n/g,' ')}"`);
          } else {
            console.log(`MISS:  ${sel}`);
          }
        } catch (e) {
          console.log(`ERR checking ${sel}:`, e.message);
        }
      }
    }

    // check main frame
    await checkSelectorsOn(page, 'main page');

    // list frames and check
    const frames = page.frames();
    console.log('\nFrames count:', frames.length);
    for (let i=0;i<frames.length;i++) {
      const f = frames[i];
      console.log(`\nFrame[${i}] url: ${f.url()}`);
      await checkSelectorsOn(f, `frame[${i}]`);
    }

    // Print page url and title
    const curUrl = page.url();
    const title = await page.title();
    console.log('\nPage title:', title);
    console.log('Page url:', curUrl);

    console.log('\nDebug complete. Upload the saved screenshot and html if you want me to inspect.');
  } catch (err) {
    console.error('Error in debug script:', err);
  } finally {
    console.log('Keeping browser open for manual inspection. Close it when done.');
  }
})();
