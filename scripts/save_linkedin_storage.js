/**
 * save_linkedin_storage.js
 * - Launches a non-headless browser
 * - Lets you sign in interactively
 * - Press ENTER in terminal after you've signed in to save storageState
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'],  });
  const context = await browser.newContext();
  const page = await context.newPage();
  console.log('Opening https://www.linkedin.com. Please sign in manually in the opened browser window.');
  await page.goto('https://www.linkedin.com/', { waitUntil: 'domcontentloaded' });

  // Wait for you to finish login
  console.log('When you finish signing in, press ENTER in this terminal to save storage state.');
  process.stdin.setRawMode(false);
  await new Promise(resolve => process.stdin.once('data', resolve));

  const storagePath = path.resolve(__dirname, '..', 'data', 'linkedin-storage.json');
  await context.storageState({ path: storagePath });
  console.log('Saved storage state to', storagePath);
  await browser.close();
  process.exit(0);
})();
