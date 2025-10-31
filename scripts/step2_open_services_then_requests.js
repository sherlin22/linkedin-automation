// scripts/step2_open_services_then_requests.js
require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const storagePath = path.resolve(__dirname, '..', 'data', 'linkedin-storage.json');
  console.log('Launching Chromium with stored LinkedIn session:', storagePath);

  const context = await chromium.launchPersistentContext('', {
    headless: false,
    storageState: storagePath,
    args: ['--start-maximized'],
    viewport: null,
  });

  try {
    const page = await context.newPage();

    // 1) Go to feed (good starting point)
    console.log('Navigating to LinkedIn feed...');
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 2) Debug screenshot of feed
    const feedShot = path.resolve(process.cwd(), 'services_from_feed.png');
    await page.screenshot({ path: feedShot, fullPage: true });
    console.log('Saved feed screenshot to', feedShot);

    // 3) Try to locate any link/button that references "Service" (case-insensitive)
    const serviceSelectorCandidates = await page.$$eval('a, button', els =>
      els
        .map(e => ({ text: (e.innerText || '').trim(), role: e.getAttribute && e.getAttribute('role') }))
        .filter(x => x.text && x.text.toLowerCase().includes('service'))
        .slice(0, 10)
    );

    if (serviceSelectorCandidates.length === 0) {
      console.log('No "Service" links/buttons found on the feed page. That suggests your account may not have the Services area visible from feed.');
    } else {
      console.log('Service-ish elements found (sample):', serviceSelectorCandidates.map(x => x.text));
      // Click the first matching element via a robust approach:
      const clickable = await page.$x("//a[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'service')]|//button[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'service')]");
      if (clickable.length > 0) {
        console.log('Clicking the first "Service" element to open services area...');
        await clickable[0].click();
        await page.waitForTimeout(3000);
      } else {
        console.log('Found service-like text but could not locate an element to click via XPath.');
      }
    }

    // 4) Now attempt to go to requests page again (safe retry)
    const requestsUrl = 'https://www.linkedin.com/services/requests/';
    console.log(`Attempting direct navigation to ${requestsUrl} ...`);
    await page.goto(requestsUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 5) Save screenshot after the attempt
    const screenshotPath = path.resolve(process.cwd(), 'services_requests_after_nav.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log('Saved screenshot to', screenshotPath);

    // 6) Attempt to detect submit proposal buttons again
    const submitButtons = await page.$$eval('button, a', els =>
      els.filter(e => (e.innerText || '').toLowerCase().includes('submit proposal')).map(e => e.innerText.trim())
    );

    console.log('Found submit-proposal-like buttons:', submitButtons.length);
    submitButtons.forEach((t, i) => console.log(`  [btn ${i + 1}] ${t}`));

    console.log('\nIf no buttons were found, open the Chromium window and check (1) you are logged in, (2) whether there is a Services or Marketplace link visible, or (3) Services feature is not enabled for this account.');

  } catch (err) {
    console.error('Error in step2 script:', err);
  } finally {
    console.log('\nStep 2 finished. Inspect the opened browser window and the saved screenshots.');
    console.log('When you are ready, reply "done" to close the browser and move to the next step, or paste the terminal output / describe what you see.');
  }
})();