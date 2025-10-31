const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

(async () => {
  // explicit path to the Chromium executable that Playwright downloaded
  const executablePath = '/Users/rashmisherlin/Library/Caches/ms-playwright/chromium-1194/chrome-mac/Chromium.app/Contents/MacOS/Chromium';

  console.log('Launching Chromium from:', executablePath);
  const browser = await chromium.launch({ headless: false, executablePath });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Opening LinkedIn login page...');
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });

  console.log('Please log into LinkedIn in the opened browser window.');
  console.log('After you finish logging in and have access to your LinkedIn feed, come back here and press Enter to save storage state.');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((resolve) => {
    rl.question('Press Enter after you finish logging in (do NOT close the browser) → ', () => {
      rl.close();
      resolve();
    });
  });

  const outPath = path.join(__dirname, 'data', 'linkedin-storage.json');
  await context.storageState({ path: outPath });
  console.log('Saved LinkedIn storage state to:', outPath);

  await browser.close();
  process.exit(0);
})();
