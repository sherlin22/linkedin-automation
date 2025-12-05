const playwright = require('playwright');
(async () => {
  const statePath = 'auth_state.json';
  const browser = await playwright.chromium.launch({ headless: false });
  const context = await browser.newContext(fs.existsSync(statePath) ? { storageState: statePath } : {});
  const page = await context.newPage();
  await page.goto('https://www.linkedin.com/messaging/', { waitUntil: 'domcontentloaded' });
  console.log('Current URL:', page.url());
  await page.waitForTimeout(8000);
  await browser.close();
})();
