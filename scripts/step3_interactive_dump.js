// scripts/step3_interactive_dump.js
// Interactive dump: opens a Playwright window using saved storage, waits for manual interaction,
// then saves fullpage HTML and anchor/button dump to debug_fullpage.html and debug_links.json.
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
    args: ['--start-maximized'],
    viewport: null,
  });

  try {
    const page = await context.newPage();
    console.log('Navigating to LinkedIn feed (https://www.linkedin.com/feed/) ...');
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle' });

    console.log('\n--- IMPORTANT ---');
    console.log('A Chromium window opened. Please manually interact with it now:');
    console.log('  1) Click your profile avatar (top-right) OR click "Home" / anywhere in header.');
    console.log('  2) Wait until the feed loads and you can see your profile avatar/name.');
    console.log('  3) Return to this terminal and press ENTER to let the script capture the page.');
    console.log('-----------------\n');

    // wait for user to press Enter in the terminal (gives you time to click in the browser)
    await new Promise(resolve => {
      process.stdin.resume();
      process.stdin.once('data', function () {
        process.stdin.pause();
        resolve();
      });
    });

    // small delay to let LinkedIn finish rendering after your click
    await page.waitForTimeout(1500);

    // Save full page HTML for inspection
    const html = await page.content();
    fs.writeFileSync(outHtml, html);
    console.log('Saved full page HTML to', outHtml);

    // Extract anchors and buttons with text + href/aria
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

    // Print sample matches for quick inspection (searching for "service"/"marketplace")
    const keywords = ['service', 'marketplace', 'services', 'freelance'];
    const lower = elements.map(e => ({ ...e, textLower: (e.text || '').toLowerCase() }));
    const matches = lower.filter(e => keywords.some(k => (e.textLower || '').includes(k) || ((e.href || '').toLowerCase().includes(k))));
    if (matches.length) {
      console.log('Possible service/marketplace-related elements (sample):');
      matches.slice(0, 20).forEach((m, i) => console.log(`${i+1}. text="${m.text}" href=${m.href}`));
    } else {
      console.log('No obvious service/marketplace links found in the page dump.');
    }

    console.log('\nDone: files written. You can now close the Chromium window.');
  } catch (err) {
    console.error('Error in interactive dump:', err);
  } finally {
    // keep context open briefly; close after user inspects or script ends
    console.log('\nInteractive dump finished.');
    // we do NOT call context.close() so you can inspect the browser if you wish.
  }
})();
