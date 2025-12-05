// scripts/test_linkedin_session.js
// Usage: node test_linkedin_session.js --profile="/tmp/chrome-profile-copy"

const { chromium } = require('playwright');
const argv = require('minimist')(process.argv.slice(2));
const PROFILE = argv.profile || '/tmp/chrome-profile-copy';
const EXEC = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  console.log('Using profile:', PROFILE);
  const context = await chromium.launchPersistentContext(PROFILE, {
    headless: false,
    executablePath: EXEC,
    args: ['--start-maximized'],
    viewport: null,
  });

  try {
    const page = await context.newPage();
    console.log('Opening linkedin.com ...');
    await page.goto('https://www.linkedin.com/', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(()=>null);
    await page.waitForTimeout(1500);

    const url = page.url();
    const title = await page.title().catch(()=>'<no title>');
    // grab a tiny visible text snippet to detect "Sign in" or "Me"
    const snippet = await page.evaluate(() => {
      try {
        const main = document.querySelector('main') || document.body;
        return (main.innerText || '').slice(0, 300).replace(/\s+/g,' ');
      } catch(e) { return ''; }
    }).catch(()=>'');

    console.log('Final URL:', url);
    console.log('Title:', title);
    console.log('Page snippet (first 300 chars):', snippet);

    const looksLoggedOut = url.includes('/uas/login') || /sign in/i.test(snippet) || /welcome to linkedin/i.test(snippet);
    if (looksLoggedOut) {
      console.log('=> Looks like NOT logged in (redirected to login or sign-in UI).');
    } else {
      console.log('=> Looks like logged in — Playwright can use this profile session.');
    }

    console.log('You can close the browser window now (or press Enter to auto-close).');
    // keep the browser open for inspection — wait for Enter
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', async () => {
      try { await context.close(); } catch(e){}
      process.exit(0);
    });
  } catch (err) {
    console.error('Error during test:', err && err.message || err);
    try { await context.close(); } catch(e){}
    process.exit(1);
  }
})();
