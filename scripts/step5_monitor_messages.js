// scripts/step5_monitor_messages.js
// Read-only monitor: finds conversations that look like service requests and logs them locally.
require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const storagePath = path.resolve(__dirname, '..', 'data', 'linkedin-storage.json');
  const outQueue = path.resolve(__dirname, '..', 'data', 'requests_queue.json');
  const screenshotPath = path.resolve(process.cwd(), 'messages_list.png');

  const browserContext = await chromium.launchPersistentContext('', {
    headless: false,
    storageState: storagePath,
    args: ['--start-maximized'],
    viewport: null,
  });

  try {
    const page = await browserContext.newPage();
    console.log('Navigating to LinkedIn messaging...');
    await page.goto('https://www.linkedin.com/messaging/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);

    // Save a screenshot so you can visually inspect
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log('Saved messaging screenshot to', screenshotPath);

    // Collect visible conversation items (this selector is deliberately broad to be robust)
    const convos = await page.$$eval('li, a, div', els => {
      const out = [];
      els.forEach(e => {
        try {
          const text = (e.innerText || '').trim().replace(/\s+/g, ' ');
          const href = e.href || (e.getAttribute && e.getAttribute('href')) || null;
          if (!text) return;
          // heuristics: short text snippets plus name/profile hrefs
          if (text.length > 10 && text.length < 500) {
            out.push({ text: text.slice(0,400), href });
          }
        } catch (err) {}
      });
      return out;
    });

    // Filter heuristics for likely leads / requests
    const keywords = ['service', 'project', 'proposal', 'hire', 'resume', 'interview', 'looking for', 'need', 'available', 'work', 'job', 'interested'];
    const matches = convos.filter(c => {
      const lower = (c.text || '').toLowerCase();
      return keywords.some(k => lower.includes(k));
    });

    // Build simple items using first link pattern or fallback
    const found = matches.map(m => {
      // Try to find a profile link if any in the text (rare); else keep text only
      // We'll ask user to open the conversation next.
      return {
        snippet: m.text,
        href: m.href || null,
        detectedAt: new Date().toISOString()
      };
    });

    // Load existing queue (or create)
    let queue = [];
    try {
      queue = JSON.parse(fs.readFileSync(outQueue, 'utf8'));
      if (!Array.isArray(queue)) queue = [];
    } catch (e) {
      queue = [];
    }

    // Append only new (simple dedupe by snippet)
    let added = 0;
    found.forEach(item => {
      const exists = queue.some(q => q.snippet === item.snippet);
      if (!exists) {
        queue.unshift(item); // newest first
        added++;
      }
    });

    // Save queue file
    fs.writeFileSync(outQueue, JSON.stringify(queue.slice(0, 200), null, 2));
    console.log(`Found ${found.length} probable lead conversations, added ${added} new to data/requests_queue.json (total ${queue.length}).`);

    console.log('Preview (first 5):');
    queue.slice(0,5).forEach((q,i)=> console.log(`${i+1}. ${q.snippet.slice(0,120)}... href=${q.href}`));

    console.log('\nStep complete. Open data/requests_queue.json to review and pick a conversation to draft a proposal for.');
  } catch (err) {
    console.error('Error in monitoring messages:', err);
  } finally {
    // keep browser open for inspection; close manually when done
    console.log('\nScript finished. Close the browser when you are done inspecting.');
  }
})();
