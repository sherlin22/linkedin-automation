/**
 * save_linkedin_storage_chrome.js
 * Launch the real Google Chrome binary, sign in interactively (Google SSO allowed),
 * then press ENTER in terminal to save storage state to ../data/linkedin-storage.json
 */
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  // macOS default Chrome path - update if your Chrome is elsewhere
  const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const storagePath = path.resolve(__dirname, '..', 'data', 'linkedin-storage.json');

  const browser = await chromium.launch({
    headless: false,
    executablePath,
    args: ['--start-maximized']
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  console.log('Opened real Chrome. Please sign in to LinkedIn (you can use Google SSO here).');
  await page.goto('https://www.linkedin.com/', { waitUntil: 'domcontentloaded' });

  console.log('When you finish signing in and see your feed/profile, press ENTER in this terminal to save storage.');
  process.stdin.setRawMode(false);
  await new Promise(resolve => process.stdin.once('data', resolve));

  await context.storageState({ path: storagePath });
  console.log('Saved storage state to', storagePath);
  await browser.close();
  process.exit(0);
})();
