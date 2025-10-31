// scripts/step3_interactive_dump_retry.js
// More robust interactive dump for LinkedIn (longer timeout + domcontentloaded)
require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const storagePath = path.resolve(__dirname, '..', 'data', 'linkedin-storage.json');
  const outHtml = path.resolve(process.cwd(), 'debug_fullpage.html');
  const outJson = path.resolve(process.cwd(), 'debug_links.json');

  console.log('Launching Chromium with storage:', storagePath);
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    storageState: storagePath,
    args: ['--start-maximized', '--disable-dev-shm-usage'],
    viewport: null,
  });

  try {
    const page = await context.newPage();

    // Use a higher timeout and domcontentloaded (less strict than networkidle)
    const feedUrl = 'https://www.linkedin.com/feed/';
    console.log(`Navigating to ${feedUrl} (timeout 60s, waiting for domcontentloaded)...`);
    await page.goto(feedUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Give the page a bit of initial time to render
    await page.waitForTimeout(1500);

    console.log('\n--- INTERACT NOW IN THE OPENED BROWSER ---');
    console.log('1) In the Playwright Chromium window, click your profile avatar (top-right) or click "Home".');
    console.log('2) Wait 2-3 seconds for the UI to update.');
    console.log('3) Return here and press ENTER to capture the page.');
    console.log('-------------------------------------------\n');

    // Wait for you to press Enter in the terminal (so you can interact with the page)
    await new Promise(resolve => {
      process.stdin.resume();
      process.stdin.once('data', function () {
        process.stdin.pause();
        resolve();
      });
    });

    // short extra wait to allow UI to finish rendering
    await page.waitForTimeout(2000);

    // Save HTML and JSON dump
    const html = await page.content();
    fs.writeFileSync(outHtml, html);
    console.log('Saved full page HTML to', outHtml);

    const elements = await page.$$eval('a, button', els =>
      els.map(e => {
        const href = e.href || (e.getAttribute && e.getAttribute('href')) || null;
        const text = (e.innerText || '').trim().replace(/\s+/g, ' ');
        const aria = e.getAttribute ? e.getAttribute('aria-label') : null;
        return { text, href, aria };
      }).filter(x => x.text || x.href)
    );

    fs.writeFileSync(outJson, JSON.stringify(elements, null, 2));
    console.log('Saved anchor/button dump to', outJson);

    // Quick scan for service/marketplace keywords
    const keywords = ['service','services','marketplace','freelance','requests'];
    const matches = elements.filter(e => {
      const text = (e.text || '').toLowerCase();
      const href = (e.href || '').toLowerCase();
      return keywords.some(k => (text.includes(k) || href.includes(k)));
    });

    if (matches.length) {
      console.log('Possible service/marketplace-related elements (sample):');
      matches.slice(0,20).forEach((m,i)=> console.log(`${i+1}. text="${m.text}" href=${m.href}`));
    } else {
      console.log('No obvious service/marketplace links found in the captured dump.');
    }

    console.log('\nCapture complete. You can now close the Chromium window.');
  } catch (err) {
    console.error('Error during interactive dump retry:', err);
  } finally {
    console.log('\nInteractive retry finished.');
  }
})();
