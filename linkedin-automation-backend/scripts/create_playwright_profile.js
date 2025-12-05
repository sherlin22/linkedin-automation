const { chromium } = require('playwright');

(async () => {
  const userDataDir = '/tmp/chrome-profile-copy';
  const exe = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  console.log('Launching Playwright Chrome using profile:', userDataDir);
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath: exe,
    args: ['--start-maximized'],
    viewport: null
  });

  const page = await context.newPage();
  const url = 'https://www.linkedin.com/';
  console.log('Opening:', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(()=>null);

  console.log('');
  console.log('➡️  The browser should have opened and navigated to LinkedIn.');
  console.log('   Please sign in manually in that window until you see your LinkedIn feed/messages.');
  console.log('   When done, come back to this terminal and press ENTER to finish and save the profile.');
  process.stdin.setRawMode(false);
  await new Promise(resolve => process.stdin.once('data', resolve));

  console.log('✅ Done. Profile saved at:', userDataDir);
  // keep browser open for inspection; exit the script
  process.exit(0);
})();
