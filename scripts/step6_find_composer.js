/*
 scripts/step6_find_composer.js
 Usage: node step6_find_composer.js "<conversationUrl>"
 Opens the conversation and prints candidate composer elements' tag, selector hints and outerHTML.
*/
require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const args = process.argv.slice(2);
  if (!args[0]) {
    console.error('Usage: node step6_find_composer.js "<conversationUrl>"');
    process.exit(1);
  }
  const convoUrl = args[0];
  const storagePath = path.resolve(__dirname, '..', 'data', 'linkedin-storage.json');

  const context = await chromium.launchPersistentContext('', {
    headless: false,
    storageState: storagePath,
    args: ['--start-maximized'],
    viewport: null,
  });

  try {
    const page = await context.newPage();
    console.log('Opening conversation URL:', convoUrl);
    await page.goto(convoUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1200);

    // Find elements that look like composers: contenteditable, textarea, input inside message form
    const candidates = await page.$$eval('div[contenteditable], textarea, input, div', els => {
      const out = [];
      els.forEach((e, i) => {
        try {
          const text = (e.innerText || '').trim().slice(0,300);
          const tag = e.tagName;
          const attrs = {};
          for (const a of e.attributes || []) attrs[a.name] = a.value;
          // Build a simple selector hint
          let hint = tag.toLowerCase();
          if (e.className) {
            const cls = (e.className || '').toString().split(/\s+/).slice(0,3).join('.');
            if (cls) hint += '.' + cls;
          }
          if (e.getAttribute && e.getAttribute('contenteditable')) hint += '[contenteditable="true"]';
          out.push({ index: i, tag, hint, attrs, snippet: text });
        } catch (err) {}
      });
      return out;
    });

    // Filter and print likely candidates (contenteditable first)
    console.log('--- Candidate composer elements (top 40) ---');
    let shown = 0;
    for (const c of candidates) {
      if (shown >= 40) break;
      // show only elements that are contenteditable or textarea or have likely classes
      const isLikely = (c.hint.includes('contenteditable') || c.tag.toLowerCase() === 'textarea' || /msg|composer|form|contenteditable/i.test(JSON.stringify(c.attrs)));
      if (!isLikely) continue;
      console.log(`\n[${shown+1}] selector-hint=${c.hint}`);
      console.log('attrs=', JSON.stringify(c.attrs, null, 2));
      console.log('snippet=', JSON.stringify(c.snippet).slice(0,200));
      shown++;
    }

    if (shown === 0) {
      console.log('No obvious composer candidates found. Will print a short sample of generic divs (first 20):');
      candidates.slice(0,20).forEach((c,i)=> {
        console.log(`\n[${i+1}] ${c.hint} attrs=${Object.keys(c.attrs).join(', ')} snippet=${(c.snippet||'').slice(0,80)}`);
      });
    }

    console.log('\nInspector finished. Copy one selector-hint (e.g. div.msg-form__contenteditable[contenteditable="true"]) and paste it here.');
  } catch (err) {
    console.error('Error in composer inspector:', err);
  } finally {
    // leave browser open for you to inspect manually if you want
    console.log('Done.');
  }
})();
