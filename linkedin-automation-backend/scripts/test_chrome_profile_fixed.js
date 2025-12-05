const { chromium } = require('playwright');

(async () => {
  // explicit absolute paths (avoid process.env.HOME)
  const userDataDir = '/Users/rashmisherlin/Library/Application Support/Google/Chrome/Default';
  const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

  console.log('Launching Chrome from:', executablePath);
  console.log('Using profile directory:', userDataDir);

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath,
    args: ['--start-maximized'],
    viewport: null,
  });

  const page = await context.newPage();
  await page.goto('https://www.linkedin.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  console.log('Title:', await page.title());
  console.log('URL:', page.url());
})();
