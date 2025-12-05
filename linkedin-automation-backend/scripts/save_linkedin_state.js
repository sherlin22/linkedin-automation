// scripts/save_linkedin_state.js
// Run: node scripts/save_linkedin_state.js --out=state.json --slowMo=150 --browser=chromium
const fs = require('fs');
const minimist = require('minimist');
const playwright = require('playwright');

const args = minimist(process.argv.slice(2), { string: ['out','browser','slowMo'], boolean: ['headful'], default: { out: 'state.json', browser: 'chromium', headful: true, slowMo: '50' } });

(async () => {
  const lib = playwright[args.browser === 'firefox' ? 'firefox' : args.browser === 'webkit' ? 'webkit' : 'chromium'];
  console.log('Launching browser (headful) — please sign in to LinkedIn in the opened window.');
  const browser = await lib.launch({ headless: !args.headful, slowMo: Number(args.slowMo) });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });

  console.log('When you finish signing in & any verification in the browser window, come back here and press ENTER to save state to', args.out);
  process.stdin.resume();
  process.stdin.on('data', async () => {
    try {
      await context.storageState({ path: args.out });
      console.log('Saved storageState to', args.out);
    } catch (e) {
      console.error('Failed to save storageState:', e);
    } finally {
      await browser.close();
      process.exit(0);
    }
  });
})();
