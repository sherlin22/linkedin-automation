/**
 * step8_debug_selector_profile.js
 * Usage: node step8_debug_selector_profile.js <logIndex|threadUrl>
 *
 * Launches Playwright with your real Chrome profile (Default) and runs selector checks.
 * If you pass a numeric index, it will attempt to read data/requests_log.json safely.
 */
require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const userDataDir = path.resolve(process.env.HOME, 'Library/Application Support/Google/Chrome/Default');
const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  const args = process.argv.slice(2);
  if (!args[0]) {
    console.error('Usage: node step8_debug_selector_profile.js <logIndex|threadUrl>');
    process.exit(1);
  }

  let threadUrl = args[0];

  // If a numeric index was supplied, try to resolve threadUrl from data/requests_log.json
  if (/^\d+$/.test(threadUrl)) {
    try {
      const logPath = path.resolve(__dirname, '..', 'data', 'requests_log.json');
      if (fs.existsSync(logPath)) {
        const raw = fs.readFileSync(logPath, 'utf8') || '[]';
        const logs = JSON.parse(raw);
        const idx = parseInt(threadUrl, 10);
        if (logs[idx] && logs[idx].threadUrl) {
          threadUrl = logs[idx].threadUrl;
        } else {
          console.error('No valid log entry at index', idx, '; please supply a full thread URL instead.');
          process.exit(1);
        }
      } else {
        console.error('requests_log.json not found at', logPath, '; please supply a full thread URL instead.');
        process.exit(1);
      }
    } catch (err) {
      console.error('Error reading requests_log.json:', err.message);
      process.exit(1);
    }
  }

  if (!threadUrl || !threadUrl.startsWith('http')) {
    console.error('Invalid thread URL:', threadUrl);
    process.exit(1);
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
    await page.waitForTimeout(1200);

    const stamp = new Date().toISOString().replace(/[:.]/g,'-');
    const screenshotPath = path.resolve(process.cwd(), `followup_selector_debug_profile_${stamp}.png`);
    const htmlPath = path.resolve(process.cwd(), `followup_selector_debug_profile_${stamp}.html`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    const bodyHtml = await page.$eval('body', el => el.innerHTML).catch(()=>null);
    if (bodyHtml) fs.writeFileSync(htmlPath, '<!-- truncated body -->\n' + bodyHtml.slice(0, 20000), 'utf8');

    console.log('Saved screenshot to', screenshotPath);
    console.log('Saved page html snapshot to', htmlPath);

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

    await checkSelectorsOn(page, 'main page');
    const frames = page.frames();
    console.log('\nFrames count:', frames.length);
    for (let i=0;i<frames.length;i++) {
      const f = frames[i];
      console.log(`\nFrame[${i}] url: ${f.url()}`);
      await checkSelectorsOn(f, `frame[${i}]`);
    }

    const curUrl = page.url();
    const title = await page.title();
    console.log('\nPage title:', title);
    console.log('Page url:', curUrl);

    console.log('\nDebug complete. Inspect the screenshot/html for next steps.');
  } catch (err) {
    console.error('Error in debug script:', err);
  } finally {
    console.log('Keeping browser open for manual inspection. Close it when done.');
  }
})();
