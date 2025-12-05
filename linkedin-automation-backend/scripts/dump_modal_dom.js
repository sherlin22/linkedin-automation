// scripts/dump_modal_dom.js
// Purpose: click a provider request, open "Submit proposal", and dump the DOM + frames for inspection.
//
// Usage:
// node scripts/dump_modal_dom.js --state=state.json --page="https://www.linkedin.com/service-marketplace/provider/requests/" --candidateIndex=0 --headful=true --slowMo=150
//
// Output files (in cwd):
// - dump_before_modal.png
// - dump_modal.png
// - dump_page.html
// - frame_<n>_<host>.html  (for every frame found)
// - dump_editable_candidates.json

const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const { chromium, webkit, firefox } = require('playwright');

const args = minimist(process.argv.slice(2), {
  string: ['state', 'page', 'profile', 'browser', 'slowMo'],
  boolean: ['headful'],
  default: {
    state: 'state.json',
    page: 'https://www.linkedin.com/service-marketplace/provider/requests/',
    headful: true,
    browser: 'chromium',
    candidateIndex: '0',
    slowMo: '0'
  }
});

const statePath = args.state;
const startPage = args.page;
const profile = args.profile;
const headful = !!args.headful;
const browserName = args.browser || 'chromium';
const slowMo = Number(args.slowMo || 0);
const candidateIndex = Number(args.candidateIndex || 0);

function sanitize(s) {
  return (s || 'unknown').replace(/[:\/?#@!&=;%\s]/g, '_').slice(0,120);
}

async function launch() {
  const lib = browserName === 'webkit' ? webkit : browserName === 'firefox' ? firefox : chromium;
  if (profile) {
    fs.mkdirSync(profile, { recursive: true });
    return await lib.launchPersistentContext(profile, { headless: !headful, slowMo });
  } else {
    const browser = await lib.launch({ headless: !headful, slowMo });
    const opts = statePath && fs.existsSync(statePath) ? { storageState: statePath } : {};
    return await browser.newContext(opts);
  }
}

(async ()=>{
  let context;
  try {
    context = await launch();
    const pages = context.pages();
    const page = pages.length ? pages[0] : await context.newPage();
    page.setDefaultTimeout(60000);

    console.log('Opening', startPage);
    await page.goto(startPage, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);

    // take a before screenshot / html
    await page.screenshot({ path: 'dump_before_modal.png', fullPage: true }).catch(()=>{});
    fs.writeFileSync('dump_page.html', await page.content());

    // try clicking a candidate
    const itemSelectors = [
      'div.service-request-card',
      'div.provider-request-card',
      '.requests-list-item',
      'ul > li',
      'div[role="list"] > div',
      'section'
    ];
    let items = [];
    for (const sel of itemSelectors) {
      items = await page.$$(sel);
      if (items && items.length) break;
    }
    if (!items || items.length === 0) {
      console.warn('No items found using primary selectors, trying broader search for clickable blocks...');
      items = await page.$$('div, li, section');
    }
    if (!items || items.length === 0) {
      console.error('No items found at all. Saved page snapshot.');
      console.log('Files: dump_before_modal.png, dump_page.html');
      if (!headful) await context.close();
      process.exit(1);
    }

    const idx = Math.max(0, Math.min(candidateIndex, items.length - 1));
    console.log('Clicking request item index', idx, 'of', items.length);
    try {
      await items[idx].scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      await items[idx].click({ force: true, timeout: 4000 });
    } catch(e) {
      // fallback evaluate-click
      await page.evaluate(({i})=>{
        const sel = 'div.service-request-card, div.provider-request-card, .requests-list-item, ul > li, div[role="list"] > div, section';
        const all = Array.from(document.querySelectorAll(sel));
        if (all[i]) { all[i].scrollIntoView(); try{ all[i].click(); }catch(e){} }
      }, { i: idx });
    }
    await page.waitForTimeout(900);

    // try to click the Submit proposal CTA
    const ctaCandidates = await page.$$('button:has-text("Submit proposal"), a:has-text("Submit proposal"), button:has-text("Send proposal"), a:has-text("Send proposal")');
    if (ctaCandidates && ctaCandidates.length) {
      console.log('Clicking CTA via candidate element.');
      try { await ctaCandidates[0].scrollIntoViewIfNeeded(); await page.waitForTimeout(120); await ctaCandidates[0].click({ force: true }); } catch(e){ try { await page.evaluate(el => el.click && el.click(), ctaCandidates[0]); } catch(e){} }
    } else {
      console.log('No explicit CTA element found; will attempt to open by clicking the candidate again to reveal details.');
      await items[idx].click({ force: true }).catch(()=>{});
    }

    // wait for modal to appear
    await page.waitForTimeout(1400);

    // take modal snapshot
    await page.screenshot({ path: 'dump_modal.png', fullPage: true }).catch(()=>{});
    fs.writeFileSync('dump_modal.html', await page.content());

    // enumerate frames and dump their HTML
    const frames = page.frames();
    console.log('Found', frames.length, 'frames. Dumping frame HTML (this may create multiple files).');
    const editableCandidates = [];

    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      const url = f.url();
      const host = sanitize(url.split('/')[2] || url);
      const fname = `frame_${i}_${host}.html`;
      try {
        const content = await f.content();
        fs.writeFileSync(fname, content);
        console.log('Wrote', fname, 'for frame url:', url);
      } catch(e) {
        console.warn('Could not get content for frame', i, e && e.message);
      }

      // search this frame for editable nodes
      try {
        const handles = await f.$$('[contenteditable="true"], textarea, input[type="text"], input[role="combobox"]');
        for (let j=0;j<handles.length;j++){
          try{
            const outer = await f.evaluate(el => el.outerHTML ? el.outerHTML.slice(0,800) : '', handles[j]).catch(()=>'<outer-html-failed>');
            const txt = await f.evaluate(el => (el.value !== undefined ? el.value : (el.innerText || el.textContent || '')), handles[j]).catch(()=>'');
            const box = await handles[j].boundingBox().catch(()=>null);
            editableCandidates.push({
              frameIndex: i,
              frameUrl: url,
              selectorPreview: outer.slice(0,240),
              valuePreview: (''+txt).slice(0,240),
              boundingBox: box
            });
          } catch(e){}
        }
      } catch(e){}
    }

    // also search main page for editable nodes (redundant but helpful)
    try {
      const mainCandidates = await page.$$('[contenteditable="true"], textarea, input[type="text"], input[role="combobox"]');
      for (let j=0;j<mainCandidates.length;j++){
        try {
          const outer = await page.evaluate(el => el.outerHTML ? el.outerHTML.slice(0,800) : '', mainCandidates[j]).catch(()=>'<outer-html-failed>');
          const txt = await page.evaluate(el => (el.value !== undefined ? el.value : (el.innerText || el.textContent || '')), mainCandidates[j]).catch(()=>'');
          const box = await mainCandidates[j].boundingBox().catch(()=>null);
          editableCandidates.push({
            frameIndex: -1,
            frameUrl: page.url(),
            selectorPreview: outer.slice(0,240),
            valuePreview: (''+txt).slice(0,240),
            boundingBox: box
          });
        } catch(e){}
      }
    } catch(e){}

    fs.writeFileSync('dump_editable_candidates.json', JSON.stringify(editableCandidates, null, 2));
    console.log('Wrote dump_editable_candidates.json with', editableCandidates.length, 'candidates.');

    console.log('\nFiles written (open these in Preview/Browser):');
    const outFiles = ['dump_before_modal.png','dump_modal.png','dump_page.html','dump_modal.html','dump_editable_candidates.json'];
    outFiles.forEach(f => { if (fs.existsSync(f)) console.log(' -', f); });

    const frameFiles = fs.readdirSync('.').filter(n => n.startsWith('frame_') && n.endsWith('.html'));
    frameFiles.forEach(f => console.log(' -', f));

    console.log('\nNow open dump_modal.png and the frame_*.html files and dump_editable_candidates.json and paste any interesting candidate outerHTML and valuePreview here. That will let me craft the exact selector and fill method.');

    if (!headful) await context.close();
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err && (err.stack || err));
    try { if (context) await context.close(); } catch(_) {}
    process.exit(2);
  }
})();
