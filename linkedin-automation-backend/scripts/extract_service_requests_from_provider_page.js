// scripts/extract_service_requests_from_provider_page.js
// Visit the provider requests / service-marketplace page, click each request card,
// open the right-hand detail pane and extract messaging thread hrefs or proposal CTAs.
// Usage:
//   node scripts/extract_service_requests_from_provider_page.js --state=state.json --out=data/requests_list.json --headful=true

const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const { chromium } = require('playwright');

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

function safeWriteJson(p, obj){
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

(async ()=> {
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
    page.setDefaultTimeout(45000);

    console.log('Opening provider requests page:', startUrl);
    await page.goto(startUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Save an overall screenshot for inspection
    const snapMain = 'services_requests_page.png';
    await page.screenshot({ path: snapMain, fullPage: true });
    console.log('Saved screenshot:', snapMain);

    // Heuristic: find the "middle column" where request cards are shown.
    // We'll pick visible candidate elements that look like cards (li, div) inside main layout.
    // First try some likely selectors; fall back to scanning many candidates.
    const candidateSelectors = [
      '.service-request-card',         // possible card class
      '.requests-list-item',           // possible item class
      '.provider-request-card',
      'ul > li',                       // any list items
      'div[role="list"] > div',
      'div[role="list"] li',
      '.ember-view'                    // generic linkedin nodes (last resort)
    ];

    // Find candidate elements in the middle column by filtering visible nodes with meaningful text
    const candidateHandles = await page.$$eval(candidateSelectors.join(','), nodes => {
      return nodes.map((n, i) => {
        // try to get a short snippet so we can inspect later
        const txt = (n.innerText || '').trim().slice(0,300);
        // bounding box info not available in $$eval; caller will click by index
        return { idx: i, snippet: txt, outer: n.outerHTML ? n.outerHTML.slice(0,1000) : '' };
      });
    }).catch(()=>[]);

    // If we found nothing with those selectors, try a wider net: any direct children inside a center column region
    let candidatesCount = candidateHandles.length;
    if (candidatesCount === 0) {
      // wide selection: direct children of main content area
      const wide = await page.$$eval('main, .scaffold-layout__content, .core-rail, .pv-top-card', nodes => {
        // collect their inner children (first 60)
        const out = [];
        for (const n of nodes.slice(0,6)) {
          const children = Array.from(n.querySelectorAll('div, li, section')).slice(0,40);
          for (const c of children) {
            const txt = (c.innerText || '').trim().slice(0,300);
            if (txt.length > 5) out.push({ snippet: txt, outer: c.outerHTML ? c.outerHTML.slice(0,800) : ''});
          }
        }
        return out.slice(0,120);
      }).catch(()=>[]);
      candidatesCount = wide.length;
      if (candidatesCount > 0) {
        // write wide to a debug file for inspection and then we'll click by index in the page
        fs.writeFileSync('provider_page_wide_candidates.json', JSON.stringify(wide, null, 2));
        console.log('Saved wide candidate snapshot provider_page_wide_candidates.json');
      }
    } else {
      // write the candidate list for inspection
      fs.writeFileSync('provider_page_candidates_preview.json', JSON.stringify(candidateHandles.slice(0,50), null, 2));
      console.log('Saved provider_page_candidates_preview.json (preview of found nodes)');
    }

    // We'll now try this alternate robust approach:
    // 1) query for clickable nodes in the middle column by using bounding boxes to exclude left sidebar and right detail panes.
    // Get page layout positions
    const layout = await page.evaluate(() => {
      const rects = { width: window.innerWidth, height: window.innerHeight };
      const left = document.querySelector('aside') || document.querySelector('.pv-profile-section') || document.querySelector('.scaffold-layout__aside');
      const right = document.querySelector('.insights, .pv-entity__actions, .msg-overlay-bubble') || Array.from(document.querySelectorAll('div')).find(d => d.innerText && d.innerText.includes('Project details')) || null;
      return {
        leftRect: left ? left.getBoundingClientRect() : null,
        rightRect: right ? right.getBoundingClientRect() : null,
        viewport: { w: window.innerWidth, h: window.innerHeight }
      };
    });

    // build a list of clickable candidate elements anywhere in the document but filter by visible bounding box
    const clickableCandidates = await page.$$eval('a, button, div', nodes => {
      return nodes.map((n, i) => {
        const txt = (n.innerText || '').trim().slice(0,400);
        const tag = n.tagName.toLowerCase();
        // try to include only nodes with some text content
        return { idx: i, tag, text: txt, hasHref: !!(n.href), role: n.getAttribute && n.getAttribute('role') || '' };
      }).slice(0,400);
    });

    // We'll now iterate over the **visible list of clickable "card-like" nodes** from the middle column by using a safer approach:
    // find nodes that are clickable and have a non-trivial snippet in the central area, by clicking indices from left to right.
    // To avoid blind clicks, we'll collect the candidate element handles using a narrower selector: common list children under the middle region.
    const possibleItemSelector = 'div.service-request-card, div.provider-request-card, .requests-list-item, ul > li, div[role="list"] > div, section';
    const items = await page.$$(possibleItemSelector);
    console.log('Direct item handles found with possible selectors:', items.length);

    // If there are no items by these selectors, try a fallback to the "middle column children": find elements that are roughly centered horizontally.
    let itemHandles = items;
    if (itemHandles.length === 0) {
      // find elements with bounding box center horizontally between 20% and 80% of viewport width
      const allDivs = await page.$$('div, li, section');
      const filtered = [];
      for (const h of allDivs) {
        try {
          const box = await h.boundingBox();
          if (!box) continue;
          const cx = box.x + box.width/2;
          if (cx > (layout.viewport.w * 0.2) && cx < (layout.viewport.w * 0.75) && box.height > 20 && box.width > 40) {
            filtered.push(h);
            if (filtered.length >= 40) break;
          }
        } catch(e){}
      }
      itemHandles = filtered;
      console.log('Fallback centered handles count:', itemHandles.length);
    } else {
      console.log('Using primary selector item handles:', itemHandles.length);
    }

    const found = [];
    // iterate through a small number of items (first 30) to avoid very long runs
    const maxToCheck = Math.min(30, itemHandles.length);
    for (let i=0;i<maxToCheck;i++){
      const h = itemHandles[i];
      try {
        // scroll into view and click to open details
        await h.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        // get a short snippet before click for logging
        const beforeText = await h.innerText().catch(()=>'');
        // click (try safe click)
        try {
          await h.click({ force: true, timeout: 4000 });
        } catch(e) {
          // fallback: click via JS
          await page.evaluate(el=>el.click && el.click(), h).catch(()=>{});
        }
        // wait for right pane to update (we detect change by waiting a short time)
        await page.waitForTimeout(700);
        // capture right-pane HTML and search for messaging thread URL or "Submit proposal" / button
        const rightPaneInfo = await page.evaluate(() => {
          // try to find the right pane: it's usually the last column with project details
          // we search for nodes that include "Project details" text or "Submit proposal" or buttons with that text
          const bodyText = document.body.innerText || '';
          // try to find a node that looks like the right pane by searching for 'Project details' text
          const possible = Array.from(document.querySelectorAll('div, section, aside')).find(n => (n.innerText||'').toLowerCase().includes('project details') || (n.innerText||'').toLowerCase().includes('project details'));
          const pane = possible || document.querySelector('.service-request-details') || document.querySelector('.provider-request-details') || null;
          const paneText = pane ? (pane.innerText || '') : '';
          // find messaging thread links inside the pane
          const links = (pane ? Array.from(pane.querySelectorAll('a')) : Array.from(document.querySelectorAll('a'))).map(a=> ({ href: a.href||'', text: a.innerText||'' }) ).slice(0,200);
          // find button elements with submit/send proposal text
          const buttons = (pane ? Array.from(pane.querySelectorAll('button, a')) : Array.from(document.querySelectorAll('button, a'))).filter(b => {
            const t = (b.innerText||'').toLowerCase();
            return t.includes('submit proposal') || t.includes('send proposal') || t.includes('submit a proposal') || t.includes('proposal');
          }).map(b => ({ text: b.innerText || '', href: b.href || null, tag: b.tagName }));
          return { paneText: paneText.slice(0,800), links: links.slice(0,40), buttons: buttons.slice(0,20), bodyHead: bodyText.slice(0,200) };
        });

        // attempt to find messaging thread link first
        let candidate = null;
        for (const l of rightPaneInfo.links) {
          if (l.href && l.href.includes('/messaging/thread/')) { candidate = { type: 'messaging', href: l.href, snippet: beforeText.slice(0,200) }; break; }
        }
        // otherwise, look for Submit proposal buttons
        if (!candidate && rightPaneInfo.buttons && rightPaneInfo.buttons.length > 0) {
          candidate = { type: 'proposal_cta', href: rightPaneInfo.buttons[0].href || null, text: rightPaneInfo.buttons[0].text, snippet: beforeText.slice(0,200) };
        }

        if (candidate) {
          // save a right-pane screenshot for this item
          const shotName = `request_item_${i}_shot.png`;
          await page.screenshot({ path: shotName, fullPage: false });
          candidate.screenshot = shotName;
          found.push(candidate);
          console.log('Found candidate for item', i, '->', candidate.type, candidate.href || candidate.text);
        } else {
          // log that this card had no obvious CTA; save small snippet
          console.log('Checked item', i, 'no candidate found. snippet:', beforeText.slice(0,120));
        }

        // small delay to let UI settle between clicks
        await page.waitForTimeout(300);
      } catch (e) {
        console.warn('Error checking item', i, e && e.message);
      }
    }

    // dedupe by href/text
    const uniq = [];
    const seen = new Set();
    for (const r of found) {
      const key = (r.href||'') + '|' + (r.text || r.snippet || '');
      if (!seen.has(key)) { seen.add(key); uniq.push(r); }
    }

    safeWriteJson(outPath, uniq);
    console.log('Saved', uniq.length, 'candidates to', outPath);
    if (uniq.length === 0) {
      // save debug HTML too
      const html = await page.content();
      fs.writeFileSync('services_requests_page_debug.html', html);
      console.log('No candidates discovered. Saved debug HTML: services_requests_page_debug.html (open in editor to inspect)');
    } else {
      console.log('Examples:\n', uniq.slice(0,6));
    }

    await context.close();
    process.exit(0);

  } catch (err) {
    console.error('Error:', err && err.stack || err);
    try { if (context) await context.close(); } catch(_) {}
    process.exit(1);
  }
})();
