// scripts/step4_inspect_service_page.js
require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const servicePage = 'https://www.linkedin.com/services/page/6284463341660aa168';
  const storagePath = path.resolve(__dirname, '..', 'data', 'linkedin-storage.json');
  const screenshotPath = path.resolve(process.cwd(), 'service_page_inspect.png');

  console.log('Launching Chromium with storage:', storagePath);
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    storageState: storagePath,
    args: ['--start-maximized'],
    viewport: null,
  });

  try {
    const page = await context.newPage();

    console.log(`Navigating to Services page: ${servicePage}`);
    await page.goto(servicePage, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);

    // Save screenshot so you can visually inspect
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log('Saved screenshot to', screenshotPath);

    // Find elements that likely represent requests or submit buttons
    const keywords = ['request', 'requests', 'submit proposal', 'submit a proposal', 'proposal', 'show all services', 'manage requests', 'view requests'];
    const found = await page.$$eval('a, button, div, span', (els, keys) => {
      const out = [];
      els.forEach(e => {
        try {
          const text = (e.innerText || '').trim().replace(/\s+/g, ' ');
          const href = e.href || (e.getAttribute && e.getAttribute('href')) || null;
          const aria = e.getAttribute ? e.getAttribute('aria-label') : null;
          const low = text.toLowerCase();
          for (const k of keys) {
            if (low.includes(k) || (href && href.toLowerCase().includes(k))) {
              out.push({ tag: e.tagName, text: text.slice(0, 250), href, aria });
              break;
            }
          }
        } catch (err) {}
      });
      // dedupe by href+text
      const uniq = [];
      const seen = new Set();
      out.forEach(o => {
        const key = (o.href || '') + '||' + o.text;
        if (!seen.has(key)) { seen.add(key); uniq.push(o); }
      });
      return uniq.slice(0, 50);
    }, keywords);

    if (found.length === 0) {
      console.log('No obvious request/proposal elements found with current keyword heuristics.');
    } else {
      console.log('Found potential elements (first up to 50):');
      found.forEach((f, i) => console.log(`${i+1}. <${f.tag}> text="${f.text}" href=${f.href} aria=${f.aria}`));
    }

    // Also try the generic /services/requests/ URL as a safe check
    const tryRequests = 'https://www.linkedin.com/services/requests/';
    console.log(`Attempting a safe direct check of ${tryRequests} (won't send anything)`);
    await page.goto(tryRequests, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => {
      console.log('Direct navigation to /services/requests/ failed or redirected:', e.message || e);
    });
    await page.waitForTimeout(1500);
    const requestsScreenshot = path.resolve(process.cwd(), 'service_requests_check.png');
    await page.screenshot({ path: requestsScreenshot, fullPage: true });
    console.log('Saved service requests check screenshot to', requestsScreenshot);

    // Scan requests page quickly for submit/proposal keywords
    const requestHits = await page.$$eval('a, button, div, span', (els) => {
      const hits = [];
      els.forEach(e=> {
        const text = (e.innerText || '').trim().replace(/\s+/g,' ');
        if (/submit proposal|proposal|submit a proposal|accept|decline|request/i.test(text)) {
          hits.push({ tag: e.tagName, text: text.slice(0,200) });
        }
      });
      return hits.slice(0,50);
    });
    console.log('Request-page keyword hits (sample):', requestHits.length);
    requestHits.slice(0,20).forEach((h,i)=>console.log(`  [${i+1}] <${h.tag}> "${h.text}"`));

    console.log('\nStep 4 finished. Inspect the screenshots and the list above.');
    console.log('If you see a "Submit proposal" button in the browser or in the screenshot, tell me which line number from the printed list matches it (e.g., "found item 3").');
    console.log('When ready, reply "done" and paste the terminal output (the found list).');

  } catch (err) {
    console.error('Error in Step 4:', err);
  } finally {
    // Keep browser open so you can inspect. We'll close after you say "done".
  }
})();