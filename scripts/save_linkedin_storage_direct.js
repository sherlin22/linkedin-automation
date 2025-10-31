/**
 * save_linkedin_storage_direct.js
 * Launch Playwright Chromium, sign in using LinkedIn email + password manually,
 * press ENTER in terminal to save storage state to ../data/linkedin-storage.json
 */
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const storagePath = path.resolve(__dirname, '..', 'data', 'linkedin-storage.json');
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext();
  const page = await context.newPage();
  console.log('Opened Chromium. Please sign in on https://www.linkedin.com using your LinkedIn email + password (avoid Google SSO).');
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });

  console.log('After signing in and confirming you can see your feed/profile, return to this terminal and press ENTER to save storage.');
  process.stdin.setRawMode(false);
  await new Promise(resolve => process.stdin.once('data', resolve));

  await context.storageState({ path: storagePath });
  console.log('Saved storage state to', storagePath);
  await browser.close();
  process.exit(0);
})();
