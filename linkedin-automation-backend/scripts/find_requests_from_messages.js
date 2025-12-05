// scripts/find_requests_from_messages.js
// Scans LinkedIn Messaging left column for "Via Services" items and writes data/requests_list.json
const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const { chromium } = require('playwright');

const args = minimist(process.argv.slice(2), {
  string: ['state', 'profile', 'out'],
  boolean: ['headful'],
  default: { state: 'state.json', out: 'data/requests_list.json', headful: true }
});

const statePath = args.state;
const profile = args.profile;
const outPath = args.out;
const headful = !!args.headful;

(async () => {
  let context;
  try {
    if (profile) {
      fs.mkdirSync(profile, { recursive: true });
      context = await chromium.launchPersistentContext(profile, { headless: !headful });
    } else {
      const browser = await chromium.launch({ headless: !headful });
      const opts = statePath && fs.existsSync(statePath) ? { storageState: statePath } : {};
      context = await browser.newContext(opts);
    }
    const page = await context.newPage();
    page.setDefaultTimeout(30000);

    console.log('Opening messaging feed...');
    await page.goto('https://www.linkedin.com/messaging/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Wait for the left conversations list container
    await page.waitForSelector('div.msg-conversations-container, ul.msg-conversations-container__conversations-list', { timeout: 10000 }).catch(()=>{});

    // Scroll left list to reveal lazy-loaded items
    const leftList = await page.$('div.msg-conversations-container, ul.msg-conversations-container__conversations-list');
    if (leftList) {
      await leftList.evaluate(async el => {
        for (let i=0;i<10;i++){
          el.scrollBy(0, 700);
          await new Promise(r=>setTimeout(r, 300));
        }
      }).catch(()=>{});
    }

    // Extract items
    const items = await page.$$eval(
      'a.msg-conversations-container__conversation-card, a.msg-conversation-listitem__link, li.msg-conversations-container__conversations-list-item a, div.msg-conversation-listitem',
      nodes => nodes.map(n => {
        const a = (n.tagName && n.tagName.toLowerCase() === 'a') ? n : (n.querySelector && n.querySelector('a'));
        const href = a ? (a.href || a.getAttribute('href') || '') : '';
        const text = (n.innerText || '').trim();
        return { href, text };
      })
    );

    const candidates = [];
    for (const it of items) {
      const txt = (it.text || '').toLowerCase();
      // Heuristic: LinkedIn shows "Via Services" in English; also catch 'service' substring to be tolerant to locales
      if (txt.includes('via services') || txt.includes('via service') || txt.includes('service') || txt.includes('services')) {
        let href = it.href || '';
        if (href && href.startsWith('/')) href = 'https://www.linkedin.com' + href;
        if (href && href.includes('messaging/thread')) {
          candidates.push({ href, text: it.text });
        }
      }
    }

    // Deduplicate
    const uniq = [];
    const seen = new Set();
    for (const c of candidates) {
      if (!seen.has(c.href)) { seen.add(c.href); uniq.push(c); }
    }

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(uniq, null, 2));
    console.log('Saved', uniq.length, 'request candidates to', outPath);
    if (uniq.length === 0) {
      const snap = 'messages_list_debug.png';
      await page.screenshot({ path: snap, fullPage: true });
      console.log('No candidates found. Saved screenshot', snap);
    } else {
      console.log('Example:', uniq.slice(0,3));
    }

    await context.close();
  } catch (e) {
    console.error('Error:', e && e.message);
    try { await context.close(); } catch(_) {}
    process.exit(1);
  }
})();