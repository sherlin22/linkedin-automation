// scripts/step7_debug_fill.js
// Debugging helper: locate composer candidates and try several fill strategies,
// printing read-back values so we can tune final automation.
//
// Usage:
// node scripts/step7_debug_fill.js --state=state.json --page="https://www.linkedin.com/service-marketplace/provider/requests/" --candidateIndex=0 --headful=true --slowMo=150

const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const { chromium, webkit, firefox } = require('playwright');

const args = minimist(process.argv.slice(2), {
  string: ['state','profile','page','browser','slowMo'],
  boolean: ['headful'],
  default: { state: 'state.json', page: 'https://www.linkedin.com/service-marketplace/provider/requests/', headful: true, browser: 'chromium', candidateIndex: '0', slowMo: '0' }
});

const statePath = args.state;
const profile = args.profile;
const startPage = args.page;
const headful = !!args.headful;
const candidateIndex = Number(args.candidateIndex || 0);
const browserName = args.browser || 'chromium';
const slowMo = Number(args.slowMo || 0);

function launch() {
  const lib = browserName === 'webkit' ? webkit : browserName === 'firefox' ? firefox : chromium;
  if (profile) {
    return lib.launchPersistentContext(profile, { headless: !headful, slowMo, ignoreDefaultArgs: ['--enable-automation'] });
  } else {
    return lib.launch({ headless: !headful, slowMo }).then(browser => {
      const opts = statePath && fs.existsSync(statePath) ? { storageState: statePath } : {};
      return browser.newContext(opts);
    });
  }
}

async function saveDebug(page, tag) {
  const pfx = `debug_fill_${tag}_${Date.now()}`;
  try {
    await page.screenshot({ path: `${pfx}.png`, fullPage: true });
    fs.writeFileSync(`${pfx}.html`, await page.content());
    console.log('Saved debug files:', `${pfx}.png`, `${pfx}.html`);
  } catch(e){ console.warn('saveDebug failed', e && e.message); }
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

    // Click candidate item (best-effort like your script)
    const items = await page.$$('div.service-request-card, div.provider-request-card, .requests-list-item, ul > li, div[role="list"] > div, section');
    if (!items || items.length === 0) {
      console.error('No items found on provider page — saving debug and exiting.');
      await saveDebug(page, 'no_items');
      await context.close();
      process.exit(1);
    }
    const idx = Math.max(0, Math.min(candidateIndex, items.length-1));
    console.log('Clicking request item index', idx, 'of', items.length);
    try { await items[idx].scrollIntoViewIfNeeded(); await page.waitForTimeout(200); await items[idx].click({ force: true }); } catch(e) {
      await page.evaluate(({i}) => {
        const sel = 'div.service-request-card, div.provider-request-card, .requests-list-item, ul > li, div[role="list"] > div, section';
        const all = Array.from(document.querySelectorAll(sel));
        if (all[i]) { all[i].scrollIntoView(); try{ all[i].click(); }catch(e){} }
      }, { i: idx });
    }
    await page.waitForTimeout(700);

    // save snapshot after click
    await saveDebug(page, 'after_item_click');

    // find composer candidates across frames
    const selectors = [
      '[contenteditable="true"][role="textbox"]',
      'div.msg-form__contenteditable',
      'div[aria-label*="Write a message"]',
      'textarea',
      'input[type="text"]',
      '.proposal-form textarea',
      '.provider-proposal-form [contenteditable="true"]'
    ];

    const frames = [page.mainFrame(), ...page.frames().filter(f => f !== page.mainFrame())];
    let candidates = [];
    for (const f of frames) {
      for (const sel of selectors) {
        try {
          const els = await f.$$(sel);
          for (const el of els) {
            try {
              const box = await el.boundingBox().catch(()=>null);
              const outer = (await f.evaluate(e => e.outerHTML ? e.outerHTML.slice(0,900) : '', el).catch(()=>'')) || '';
              const tag = await f.evaluate(e => e.tagName && e.tagName.toLowerCase(), el).catch(()=>null);
              const isEditable = await f.evaluate(e => !!e.isContentEditable, el).catch(()=>false);
              const val = await f.evaluate(e => (e.value !== undefined ? e.value : (e.innerText !== undefined ? e.innerText : '')), el).catch(()=>'');
              candidates.push({ frame: f, handle: el, selector: sel, tag, box, outer: outer.slice(0,400), current: (''+val).slice(0,300) });
            } catch(e){}
          }
        } catch(e){}
      }
    }

    if (candidates.length === 0) {
      console.error('No composer candidates found; saving debug.');
      await saveDebug(page, 'no_composer_candidates');
      await context.close();
      process.exit(1);
    }

    console.log('Found', candidates.length, 'composer candidate(s). Printing summary:');
    for (let i=0;i<candidates.length;i++) {
      const c = candidates[i];
      console.log(`\n[CAND ${i}] selector=${c.selector} tag=${c.tag} box=${c.box?JSON.stringify(c.box):'null'}`);
      console.log(' current (preview):', JSON.stringify(c.current));
      console.log(' outerHTML preview:', c.outer.slice(0,360).replace(/\n/g,''));
    }

    // pick the top scored candidate (largest bbox area) for fill attempts
    candidates.sort((a,b) => ((b.box?.width||0)*(b.box?.height||0)) - ((a.box?.width||0)*(a.box?.height||0)));
    const pick = candidates[0];
    console.log('\n--> Using candidate 0 for fill attempts (largest area). selector:', pick.selector, 'tag:', pick.tag);

    const message = `Hello ${'there'},

(automated debug test) This is a short fill test to see if Playwright can set text into this node.`;

    // attempt 1: DOM assignment + dispatch events
    try {
      console.log('Attempt 1: DOM assignment + input/change dispatch...');
      await pick.frame.evaluate((el, txt) => {
        try {
          if (el.isContentEditable) {
            el.focus();
            el.innerHTML = '';
            el.appendChild(document.createTextNode(txt));
          } else if (el.tagName && el.tagName.toLowerCase() === 'textarea') {
            el.value = txt;
          } else if (el.tagName && el.tagName.toLowerCase() === 'input') {
            el.value = txt;
          } else {
            el.innerText = txt;
          }
          el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: txt.slice(-1) }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } catch(e) {}
      }, pick.handle, message);
      await page.waitForTimeout(300);
      const r1 = await pick.frame.evaluate(e => e.isContentEditable ? (e.innerText||'') : (e.value||e.innerText||''), pick.handle);
      console.log('Read-back after attempt1 (len):', (r1||'').length, ' preview:', (''+r1).slice(0,200).replace(/\n/g,' '));
    } catch(e){ console.warn('Attempt1 error', e && e.message); }

    // attempt 2: dispatch beforeinput + input events (some React setups watch beforeinput)
    try {
      console.log('Attempt 2: dispatch beforeinput + input events...');
      await pick.frame.evaluate((el, txt) => {
        try {
          el.focus && el.focus();
          const before = new InputEvent('beforeinput', { bubbles:true, cancelable:true, data: txt });
          el.dispatchEvent(before);
          el.value = txt;
          const inputEv = new InputEvent('input', { bubbles:true, cancelable:true, data: txt });
          el.dispatchEvent(inputEv);
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } catch(e){}
      }, pick.handle, message);
      await page.waitForTimeout(300);
      const r2 = await pick.frame.evaluate(e => e.isContentEditable ? (e.innerText||'') : (e.value||e.innerText||''), pick.handle);
      console.log('Read-back after attempt2 (len):', (r2||'').length, ' preview:', (''+r2).slice(0,200).replace(/\n/g,' '));
    } catch(e){ console.warn('Attempt2 error', e && e.message); }

    // attempt 3: keyboard typing small tail to trigger React
    try {
      console.log('Attempt 3: keyboard typing to composer (short tail)...');
      await pick.handle.focus();
      await pick.frame.keyboard.type(' [pwtest]', { delay: 25 });
      await page.waitForTimeout(300);
      const r3 = await pick.frame.evaluate(e => e.isContentEditable ? (e.innerText||'') : (e.value||e.innerText||''), pick.handle);
      console.log('Read-back after attempt3 (len):', (r3||'').length, ' preview:', (''+r3).slice(0,200).replace(/\n/g,' '));
    } catch(e){ console.warn('Attempt3 error', e && e.message); }

    // save after attempts
    await saveDebug(page, 'after_attempts');

    console.log('\nDone. Inspect the saved debug files (before/after) and share the most recent filenames and the printed read-back values above.');
    console.log('If any attempt produced a non-empty read-back, tell me which attempt number and the read-back preview; I will then update the final script to use that method.');

    // keep browser open for headful inspection; close for headless
    if (!headful) await context.close();
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err && (err.stack || err));
    try { if (context) await context.close(); } catch(_) {}
    process.exit(2);
  }
})();
