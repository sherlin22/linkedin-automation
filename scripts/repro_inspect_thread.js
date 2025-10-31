// repro_inspect_thread.js
// Usage:
// node repro_inspect_thread.js --url="<THREAD_URL>" --profile="/tmp/chrome-profile-copy"
const fs = require('fs');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));
const { chromium } = require('playwright');

const THREAD_URL = argv.url || argv.u || '';
const PROFILE = argv.profile || '/tmp/chrome-profile-copy';
const EXECUTABLE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

if (!THREAD_URL) {
  console.error('Usage: node repro_inspect_thread.js --url="<THREAD_URL>" --profile="/tmp/chrome-profile-copy"');
  process.exit(1);
}

(async () => {
  console.log('Starting repro inspector for:', THREAD_URL);
  const context = await chromium.launchPersistentContext(PROFILE, {
    headless: false,
    executablePath: EXECUTABLE,
    args: ['--start-maximized'],
    viewport: null,
  });

  try {
    const page = await context.newPage();
    await page.goto(THREAD_URL, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(()=>null);
    await page.waitForTimeout(1200);

    // Take screenshot
    const ts = Date.now();
    const shot = path.resolve(process.cwd(), `repro_fullpage_${ts}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    console.log('Saved screenshot ->', shot);

    // Dump main frame HTML
    const mainHTML = await page.content();
    const mainDump = path.resolve(process.cwd(), `repro_mainframe_${ts}.html`);
    fs.writeFileSync(mainDump, mainHTML, 'utf8');
    console.log('Saved main frame HTML ->', mainDump);

    // Examine all frames and dump their HTML + list of contenteditable nodes per frame
    const frames = page.frames();
    console.log('Frames found:', frames.length);
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      const name = f.name() || `frame-${i}`;
      try {
        const html = await f.content();
        const fname = path.resolve(process.cwd(), `repro_frame_${i}_${ts}.html`);
        fs.writeFileSync(fname, html, 'utf8');
        console.log(`Saved frame[${i}] (${name}) HTML ->`, fname);
      } catch (e) {
        console.log(`Could not dump frame[${i}] (${name}):`, e && e.message);
      }

      // list contenteditable elements in this frame
      try {
        const nodes = await f.evaluate(() => {
          const arr = [];
          const all = Array.from(document.querySelectorAll('[contenteditable]'));
          all.forEach((el, idx) => {
            const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: 0, height: 0 };
            arr.push({
              index: idx,
              tag: el.tagName,
              outerHTML: (el.outerHTML || '').slice(0, 800),
              contenteditable: el.getAttribute('contenteditable'),
              role: el.getAttribute && el.getAttribute('role'),
              ariaLabel: el.getAttribute && el.getAttribute('aria-label'),
              className: el.className || null,
              textSnippet: (el.innerText || '').slice(0, 200),
              rect: { w: Math.round(rect.width), h: Math.round(rect.height), x: Math.round(rect.x), y: Math.round(rect.y) }
            });
          });
          // Also detect potential message composer candidates by common classes or attributes
          const candidates = [];
          const selectors = ['.msg-form__contenteditable', '.msg-form__contenteditable[role="textbox"]', 'textarea', 'input', 'div[role="textbox"]'];
          selectors.forEach(s => {
            const el = document.querySelector(s);
            if (el) {
              const r = el.getBoundingClientRect();
              candidates.push({ selector: s, found: true, rect: { w: Math.round(r.width), h: Math.round(r.height) } , className: el.className || ''});
            } else candidates.push({ selector: s, found: false });
          });
          return { contentEditables: arr, candidates };
        });
        const jsonPath = path.resolve(process.cwd(), `repro_frame_${i}_contenteditable_${ts}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify(nodes, null, 2), 'utf8');
        console.log(`Saved frame[${i}] contenteditable list ->`, jsonPath);
      } catch (e) {
        console.log(`Could not list contenteditable in frame[${i}]:`, e && e.message);
      }
    }

    console.log('\n--- DONE ---\nOpen the generated files (repro_fullpage_*.png and repro_frame_*_contenteditable_*.json) and paste the JSON or a short excerpt here. That will tell me which selector to use or whether the composer lives inside a frame.');
  } catch (e) {
    console.error('Error in repro script:', e && e.message);
  } finally {
    console.log('Leaving browser open for manual inspection. Close when done.');
  }
})();