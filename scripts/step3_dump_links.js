// scripts/step3_dump_links.js
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
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    // Save full page HTML for offline inspection
    const html = await page.content();
    fs.writeFileSync(outHtml, html);
    console.log('Saved full page HTML to', outHtml);

    // Extract anchors and buttons with text + href (if any)
    const elements = await page.$$eval('a, button', els =>
      els.map(e => {
        const href = e.href || e.getAttribute && e.getAttribute('href') || null;
        const text = (e.innerText || '').trim().replace(/\s+/g, ' ');
        const aria = e.getAttribute ? e.getAttribute('aria-label') : null;
        return { text, href, aria };
      }).filter(x => x.text || x.href)
    );

    // Save to JSON for easy review
    fs.writeFileSync(outJson, JSON.stringify(elements, null, 2));
    console.log('Saved anchor/button dump to', outJson);

    // Print a short sample of links that look relevant (keywords)
    const keywords = ['service', 'marketplace', 'services', 'angebote', 'servizi', 'servicio', 'trabajos'];
    const lower = elements.map(e => ({ ...e, textLower: (e.text || '').toLowerCase() }));
    const matches = lower.filter(e => keywords.some(k => e.textLower.includes(k) || (e.href || '').toLowerCase().includes(k)));
    if (matches.length) {
      console.log('Possible service/marketplace-related elements (sample):');
      matches.slice(0, 20).forEach((m, i) => console.log(`${i+1}. text="${m.text}" href=${m.href}`));
    } else {
      console.log('No obvious service/marketplace links found in the page dump.');
    }

    // Minimal login detection heuristics
    const loggedIn = await page.$eval('body', () => document.body.innerText.length > 2000).catch(() => false);
    // Try to detect profile area
    const meEl = await page.$('img.global-nav__me-photo, img[alt*="Profile photo"], a[href*="/in/"]');
    if (meEl) {
      console.log('Potential profile element found — you are likely logged in.');
    } else {
      console.log('No clear profile avatar detected on the feed. You might be logged out or LinkedIn rendered a limited view.');
    }

    console.log('\nDebug files written. Inspect debug_fullpage.html (screenshot-like) and debug_links.json for link text/hrefs.');
    console.log('If you want, open debug_links.json and search for keywords: service, marketplace, services, service requests, or translations.');

  } catch (err) {
    console.error('Error in step3:', err);
  } finally {
    console.log('\nStep3 finished. Keep the browser open to inspect manually, then reply "done" when ready (or paste the top 20 entries of debug_links.json here).');
  }
})();
