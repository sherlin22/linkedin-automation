/*
 scripts/step6_prepare_message_draft.js
 Usage: node step6_prepare_message_draft.js "<conversationUrl>"
 This opens a LinkedIn conversation, fills the proposal from proposal.txt (replacing {name}), and
 leaves the message in the composer (DO NOT send).
*/
require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const args = process.argv.slice(2);
  if (!args[0]) {
    console.error('Usage: node step6_prepare_message_draft.js "<conversationUrl>"');
    process.exit(1);
  }
  const convoUrl = args[0];
  const storagePath = path.resolve(__dirname, '..', 'data', 'linkedin-storage.json');
  const proposalPath = path.resolve(__dirname, '..', 'proposal.txt');
  const screenshotDraft = path.resolve(process.cwd(), 'draft_message.png');

  if (!fs.existsSync(proposalPath)) {
    console.error('proposal.txt not found at project root. Please ensure it exists and has {name} placeholder.');
    process.exit(1);
  }
  const rawTemplate = fs.readFileSync(proposalPath, 'utf8');

  const context = await chromium.launchPersistentContext('', {
    headless: false,
    storageState: storagePath,
    args: ['--start-maximized'],
    viewport: null,
  });

  try {
    const page = await context.newPage();
    console.log('Navigating to conversation URL (open in LinkedIn messaging)...');
    await page.goto(convoUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);

    // Heuristic to get recipient name: check header or profile link texts
    const name = await page.$$eval('h1,h2,div', els => {
      for (const e of els) {
        const txt = (e.innerText || '').trim();
        // simple name heuristic: capitalized words and length constraint
        if (/^[A-Z][a-z]+( [A-Z][a-z]+){0,2}$/.test(txt) && txt.length < 60) return txt;
      }
      const alt = document.querySelector('a[href*="/in/"]');
      if (alt) return (alt.innerText || '').trim() || null;
      return null;
    }).catch(() => null);

    const finalName = name || 'there';
    const messageToPaste = rawTemplate.replace(/\{name\}/g, finalName);

    // Try several composer selectors robustly
    const selectors = [
      'div.msg-form__contenteditable[contenteditable="true"]',
      'div.msg-form__contenteditable.t-14.t-black--light.t-normal.flex-grow-1.full-height.notranslate',
      'div[contenteditable="true"]',
      'textarea.msg-form__textarea'
    ];


    let composer = null;
    for (const sel of selectors) {
      composer = await page.$(sel);
      if (composer) {
        console.log('Composer found via selector:', sel);
        break;
      }
    }

    if (!composer) {
      console.error('Could not find composer element on this conversation page. Saving screenshot for inspection.');
      await page.screenshot({ path: screenshotDraft, fullPage: true });
      console.log('Saved screenshot to', screenshotDraft);
      process.exit(1);
    }

    // Focus and type message (mimic human typing)
    await composer.focus();
    await page.keyboard.type(messageToPaste, { delay: 15 });

    // Save screenshot of draft (do NOT send)
    await page.screenshot({ path: screenshotDraft, fullPage: true });
    console.log('Draft pasted into the composer. Screenshot saved to', screenshotDraft);
    console.log('DO NOT press send — review the message in the browser and send manually when ready.');

  } catch (err) {
    console.error('Error preparing draft:', err);
  } finally {
    console.log('\nScript finished. Leave the browser open to review and send manually.');
  }
})();
