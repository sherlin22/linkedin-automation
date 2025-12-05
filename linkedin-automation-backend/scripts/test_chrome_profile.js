const { chromium } = require('playwright');
const path = require('path');

(async () => {
  // change 'Default' to another Profile folder name if needed (e.g. 'Profile 1')
  const userDataDir = path.resolve(process.env.HOME, 'Library/Application Support/Google/Chrome/Default');
  const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

  console.log('Using Chrome profile:', userDataDir);
  console.log('Launching Chrome executable:', executablePath);
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath,
    args: ['--start-maximized'],
    viewport: null,
  });

  try {
    const page = await context.newPage();
    await page.goto('https://www.linkedin.com/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    console.log('Page title:', await page.title());
    console.log('Page url:', page.url());
    const snap = path.resolve(process.cwd(), 'test_chrome_profile.png');
    await page.screenshot({ path: snap, fullPage: true });
    console.log('Saved screenshot to', snap);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    console.log('Left browser open for inspection. Close it when done.');
  }
})();
