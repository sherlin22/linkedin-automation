// scripts/list_cta_candidates.js
// Finds and prints candidate CTA text/outerHTML across main page + frames.
// Usage:
// node scripts/list_cta_candidates.js --state=state.json --page="https://www.linkedin.com/service-marketplace/provider/requests/" --headful=true

const fs = require('fs');
const minimist = require('minimist');
const playwright = require('playwright');

const args = minimist(process.argv.slice(2), {
  string: ['state', 'page', 'browser', 'profile', 'slowMo'],
  boolean: ['headful'],
  default: {
    state: 'state.json',
    page: 'https://www.linkedin.com/service-marketplace/provider/requests/',
    headful: true,
    browser: 'chromium',
    slowMo: '0'
  }
});

(async () => {
  const browserName = args.browser === 'firefox' ? 'firefox' : args.browser === 'webkit' ? 'webkit' : 'chromium';
  const lib = playwright[browserName];
  console.log('Using browser:', browserName);

  let context;
  try {
    if (args.profile) {
      context = await lib.launchPersistentContext(args.profile, { headless: !args.headful, slowMo: Number(args.slowMo) });
    } else {
      const browser = await lib.launch({ headless: !args.headful, slowMo: Number(args.slowMo) });
      const ctxOptions = args.state && fs.existsSync(args.state) ? { storageState: args.state } : {};
      context = await browser.newContext(ctxOptions);
    }

    const page = (context.pages().length ? context.pages()[0] : await context.newPage());
    page.setDefaultTimeout(30000);

    console.log('Opening page:', args.page);
    await page.goto(args.page, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);

    // Click a request card lightly (optional) so detail pane opens. If you have many cards this will click the first.
    try {
      const card = await page.$$('ul li, div.service-request-card, div.provider-request-card');
      if (card && card.length) {
        console.log('Clicking first request card (to open detail pane)');
        await card[0].click({ force: true }).catch(()=>{});
        await page.waitForTimeout(700);
      }
    } catch(e){}

    const out = [];
    async function collectFromFrame(f) {
      const url = f.url();
      const buttons = await f.$$eval('button, a, div', els =>
        els.slice(0,200).map(e => {
          const txt = (e.innerText || '').trim().replace(/\s+/g, ' ').slice(0,200);
          const outer = (e.outerHTML || '').slice(0,1200);
          return { text: txt, outerHTML: outer };
        })
      ).catch(()=>[]);
      return { url, buttons };
    }

    const frames = page.frames();
    for (const f of frames) {
      const data = await collectFromFrame(f);
      out.push(data);
    }

    // Also collect from main page (duplicate of frame but keep)
    const pageData = await collectFromFrame(page.mainFrame());
    out.unshift(pageData);

    // Write pretty file
    const ts = Date.now();
    const fn = `cta_candidates_${ts}.json`;
    fs.writeFileSync(fn, JSON.stringify(out, null, 2));
    console.log('Wrote candidate data to', fn);
    console.log('Top hits (containing "submit" or "proposal" case-insensitive):');

    // print lines with submit/proposal or buttons with text length < 80
    for (const f of out) {
      for (const b of f.buttons) {
        const text = (b.text || '').toLowerCase();
        if (text.includes('submit') || text.includes('proposal') || (b.text && b.text.length < 80 && b.text.length > 0 && /[A-Za-z]/.test(b.text))) {
          console.log('--- frame:', f.url);
          console.log('text:', b.text);
          console.log('outerHTML snippet:', b.outerHTML.slice(0,800));
        }
      }
    }

    console.log('\nIf nothing obvious shows up, open the JSON file in your editor/Preview and paste the nearest outerHTML for the CTA. That will let me craft the exact selector.');
    if (!args.headful) await context.close();
    process.exit(0);

  } catch (err) {
    console.error('ERROR:', err && err.stack);
    process.exit(2);
  }
})();
