// scripts/find_service_requests_page.js
// Visit the LinkedIn service-provider requests / service-marketplace provider requests page
// and extract candidate thread URLs or submit-proposal links.
// Usage:
//   node scripts/find_service_requests_page.js --state=state.json --out=data/requests_list.json --headful=true

const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const { chromium, webkit, firefox } = require('playwright');

const args = minimist(process.argv.slice(2), {
  string: ['state', 'profile', 'out', 'url'],
  boolean: ['headful'],
  default: {
    state: 'state.json',
    out: 'data/requests_list.json',
    headful: true,
    url: 'https://www.linkedin.com/service-marketplace/provider/requests/'
  }
});

const statePath = args.state;
const profile = args.profile;
const outPath = args.out;
const headful = !!args.headful;
const startUrl = args.url;

async function launch() {
  // use chromium by default
  try {
    const { chromium } = require('playwright');
    if (profile) {
      fs.mkdirSync(profile, { recursive: true });
      return await chromium.launchPersistentContext(profile, { headless: !headful });
    } else {
      const browser = await chromium.launch({ headless: !headful });
      const opts = statePath && fs.existsSync(statePath) ? { storageState: statePath } : {};
      return await browser.newContext(opts);
    }
  } catch (e) {
    console.error('Launch failed', e);
    throw e;
  }
}

(async () => {
  let context;
  try {
    context = await launch();
    const page = await context.newPage();
    page.setDefaultTimeout(30000);

    // Candidate URLs to try (your /service-marketplace/provider/requests/ is included)
    const candidates = [
      startUrl,
      'https://www.linkedin.com/service-marketplace/provider/requests/',
      'https://www.linkedin.com/service-marketplace/provider/requests/?',
      'https://www.linkedin.com/service-marketplace/requests/',
      'https://www.linkedin.com/services/requests/',
      'https://www.linkedin.com/services/'
    ];

    let finalUrl = null;
    for (const u of candidates) {
      try {
        console.log('Trying', u);
        await page.goto(u, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1200);
        const cur = page.url();
        console.log(' -> landed on', cur);
        // if we land on a login or anti-bot page, continue trying other URLs
        if (cur.includes('/uas/login') || cur.includes('/login') || cur.includes('protechts') || cur.includes('recaptcha') || cur.includes('Page not found')) {
          // keep trying
          console.log('  (looks like login/interstitial or not-found; continuing)');
          continue;
        }
        finalUrl = cur;
        break;
      } catch (e) {
        console.warn('visit failed for', u, e && e.message);
      }
    }

    if (!finalUrl) {
      console.warn('Could not find a healthy requests page; saving debug and exiting.');
      const snap = 'services_requests_page_failed.png';
      await page.screenshot({ path: snap, fullPage: true });
      const html = await page.content();
      fs.writeFileSync('services_requests_page_failed.html', html);
      console.log('Saved debug files:', snap, 'services_requests_page_failed.html');
      await context.close();
      process.exit(0);
    }

    console.log('Using discovered page:', finalUrl);
    // wait more for dynamic content
    await page.waitForTimeout(1500);

    // Save an initial screenshot for inspection
    const screenshot = 'services_requests_page.png';
    await page.screenshot({ path: screenshot, fullPage: true });
    console.log('Saved screenshot:', screenshot);

    // Heuristic extraction strategy:
    // 1) find anchors that link to messaging threads (href contains 'messaging/thread')
    // 2) find buttons or anchors with text like "Submit proposal", "Send proposal", or "Submit a proposal"
    // 3) find card anchors that look like request items (data-urn, data-id, etc.)
    const anchors = await page.$$eval('a', as => as.map(a => ({ href: a.href || '', text: (a.innerText||'').trim() })));
    const results = [];

    // 1: messaging thread anchors
    for (const a of anchors) {
      if (!a.href) continue;
      if (a.href.includes('/messaging/thread/')) {
        results.push({ href: a.href, text: a.text || 'messaging thread link' });
      }
    }

    // 2: find buttons / anchors with "submit proposal" phrases (case-insensitive)
    const phrases = ['submit proposal', 'send proposal', 'submit a proposal', 'submit proposal →', 'send a proposal', 'send proposal →'];
    for (const a of anchors) {
      const low = (a.text||'').toLowerCase();
      for (const p of phrases) {
        if (low.includes(p)) {
          // normalize href if relative
          let href = a.href || '';
          if (href && href.startsWith('/')) href = 'https://www.linkedin.com' + href;
          results.push({ href: href || null, text: a.text });
        }
      }
    }

    // 3: find request item cards that may contain a link (cards often have data-entity-urn or data-urn attributes)
    const cardLinks = await page.$$eval('[data-urn], [data-entity-urn], .request-card, .service-request-card, .requests-list-item, .provider-request-card', nodes => {
      return nodes.map(n => {
        // try to find anchors inside card
        const a = n.querySelector && (n.querySelector('a') || n.closest && n.closest('a'));
        const href = a ? (a.href || a.getAttribute('href') || '') : '';
        const text = n.innerText ? n.innerText.trim().slice(0,300) : '';
        return { href, text };
      });
    }).catch(()=>[]);

    for (const c of cardLinks) {
      if (!c.href && c.text && c.text.toLowerCase().includes('submit proposal')) {
        results.push({ href: null, text: c.text });
      } else if (c.href && c.href.includes('/messaging/thread/')) {
        results.push({ href: c.href, text: c.text });
      } else if (c.href) {
        // include it as a candidate (may be a proposal form link)
        results.push({ href: c.href, text: c.text });
      }
    }

    // dedupe (by href + text)
    const uniq = [];
    const seen = new Set();
    for (const r of results) {
      const key = (r.href || '') + '|' + (r.text||'');
      if (!seen.has(key)) { seen.add(key); uniq.push(r); }
    }

    // if nothing found, save full page HTML as debug
    if (uniq.length === 0) {
      const html = await page.content();
      fs.writeFileSync('services_requests_page_debug.html', html);
      const snap2 = 'services_requests_page_debug.png';
      await page.screenshot({ path: snap2, fullPage: true });
      console.log('No candidates found. Saved debug HTML and screenshot:', 'services_requests_page_debug.html', snap2);
      await context.close();
      process.exit(0);
    }

    // normalize relative hrefs and keep only non-empty hrefs when possible
    const normalized = uniq.map(r => {
      let href = r.href || '';
      if (href && href.startsWith('/')) href = 'https://www.linkedin.com' + href;
      return { href: href || null, text: r.text || '' };
    });

    // prefer messaging URLs first
    normalized.sort((a,b) => {
      const aMsg = a.href && a.href.includes('/messaging/thread/') ? 0 : 1;
      const bMsg = b.href && b.href.includes('/messaging/thread/') ? 0 : 1;
      return aMsg - bMsg;
    });

    // Save to outPath
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(normalized, null, 2));
    console.log('Saved', normalized.length, 'candidates to', outPath);
    console.log('Examples:', normalized.slice(0,5));

    await context.close();
    process.exit(0);
  } catch (e) {
    console.error('Error while extracting requests:', e && e.stack || e);
    try { if (context) await context.close(); } catch(_) {}
    process.exit(1);
  }
})();
