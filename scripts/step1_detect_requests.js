// scripts/step1_detect_requests.js
require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  // Path to the saved LinkedIn storage (cookies/session)
  const storagePath = path.resolve(__dirname, '..', 'data', 'linkedin-storage.json');

  console.log('Launching Chromium with stored LinkedIn session:', storagePath);

  const browserContext = await chromium.launchPersistentContext('', {
    headless: false, // interactive so you can watch the browser (set true later for headless runs)
    storageState: storagePath,
    args: ['--start-maximized'],
    viewport: null,
  });

  try {
    const page = await browserContext.newPage();

    // 1) Go to the LinkedIn Services Requests page
    const requestsUrl = 'https://www.linkedin.com/services/requests/';
    console.log(`Navigating to ${requestsUrl} ...`);
    await page.goto(requestsUrl, { waitUntil: 'networkidle' });

    // 2) Wait a bit for dynamic content to render
    await page.waitForTimeout(2500);

    // 3) Optionally take a screenshot for debugging (saved in project root)
    const screenshotPath = path.resolve(process.cwd(), 'services_requests_page.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log('Saved screenshot to', screenshotPath);

    // 4) Try to find any "Submit proposal" buttons and also attempt to extract requester names
    const submitButtons = await page.$$eval('button, a', els =>
      els.filter(e => (e.innerText || '').toLowerCase().includes('submit proposal')).map(e => e.innerText.trim())
    );

    // 5) Try extracting candidate names from common patterns inside request cards
    const candidateNames = await page.$$eval('div', divs => {
      const results = [];
      divs.forEach(div => {
        try {
          const txt = div.innerText || '';
          const lines = txt.split('\n').map(l => l.trim()).filter(Boolean);
          for (const line of lines.slice(0, 6)) {
            if (/^[A-Z][a-z]+( [A-Z][a-z]+){0,2}$/.test(line) && line.length < 40) {
              if (!results.includes(line)) results.push(line);
            }
          }
        } catch (err) { }
      });
      return results.slice(0, 20);
    });

    console.log('Found submit-proposal-like buttons:', submitButtons.length);
    submitButtons.forEach((t, i) => console.log(`  [btn ${i + 1}] ${t}`));

    if (candidateNames.length) {
      console.log('Candidate names heuristically detected (first up to 20):');
      candidateNames.forEach((n, i) => console.log(`  [${i + 1}] ${n}`));
    } else {
      console.log('No candidate names detected with the current heuristic. That is OK — we will refine selectors in the next step.');
    }

    console.log('\nIf you expected "Submit proposal" buttons but found none, check the page manually in the opened browser window to see the layout or if LinkedIn redirected to another page (e.g., login).');

  } catch (err) {
    console.error('Error during Step 1:', err);
  } finally {
    console.log('\nStep 1 script finished. Please inspect the opened browser window if needed.');
    console.log('When you are ready, return here and say "done" to close the browser and move to Step 2.');
  }
})();
