/*
 scripts/step6_prepare_message_draft_v2.js
 Improved draft preparer: waits for composer selectors, sets composer content atomically, types proposal, saves screenshot.
 Usage:
   node step6_prepare_message_draft_v2.js "<conversationUrl>"
*/
require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const args = process.argv.slice(2);
  if (!args[0]) {
    console.error('Usage: node step6_prepare_message_draft_v2.js "<conversationUrl>"');
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
    args: ['--start-maximized', '--disable-dev-shm-usage'],
    viewport: null,
  });

  try {
    const page = await context.newPage();
    console.log('Navigating to conversation URL (open in LinkedIn messaging)...');
    await page.goto(convoUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // allow extra time for LinkedIn client JS to attach interactive UI
    await page.waitForTimeout(2000);

         // ---------------- Improved name detection with blacklist + override ----------------
    // Usage: node step6_prepare_message_draft_v2.js "<conversationUrl>" "<optionalNameOverride>"
    const providedName = args[1] || null; // optional second CLI arg to override detected name

    // small helper to test whether a candidate looks like a real person name
    function looksLikePersonName(s) {
      if (!s) return false;
      s = s.trim();
      // blacklist obvious site labels or very short tokens
      const blacklist = ['sign in', 'sign in with', 'join now', 'home', 'language', 'privacy policy', 'user agreement', 'cookie policy', 'go to your feed', 'messaging', 'notifications', 'jobs', 'my network'];
      const low = s.toLowerCase();
      if (blacklist.some(b => low.includes(b))) return false;
      // require at least one alphabetic character and at least 2 letters
      if (!/[A-Za-z]/.test(s) || s.length < 2) return false;
      // accept "First Last" or single capitalized first name; avoid long UI strings by limiting words
      const words = s.split(/\s+/).filter(Boolean);
      if (words.length > 3) return false;
      // require the first word to look like a capitalized name or all-caps initials
      if (!/^[A-Z][a-z'-]{1,40}$/.test(words[0]) && !/^[A-Z]{2,}$/.test(words[0])) return false;
      return true;
    }

    let name = null;
    if (providedName && providedName.trim().length) {
      name = providedName.trim();
      console.log('Using provided name override:', name);
    } else {
      name = await page.evaluate(() => {
        const norm = t => (t || '').replace(/\s+/g, ' ').trim();
        // collect candidate texts from common places
        const candidates = [];

        // header-like elements
        ['.msg-thread__participant-names', '.msg-conversation-header__name', '.msg-thread__name', 'header h1', 'h1', 'h2'].forEach(sel => {
          const el = document.querySelector(sel);
          if (el) candidates.push(norm(el.innerText));
        });

        // message author/name elements
        ['.msg-s-message-group__name', '.msg-s-message-group__member', '.msg-s-message__sender', '.msg-s-message-list__event .msg-s-event-listitem__actor'].forEach(sel => {
          const el = document.querySelector(sel);
          if (el) candidates.push(norm(el.innerText));
        });

        // profile link text
        const profileLink = document.querySelector('a[href*="/in/"]');
        if (profileLink && profileLink.innerText) candidates.push(norm(profileLink.innerText));

        // first message snippet — may contain "Hi Name"
        const firstMsg = document.querySelector('.msg-s-message-list__event, .msg-s-message-group, .msg-s-message__content');
        if (firstMsg && firstMsg.innerText) {
          const m = norm(firstMsg.innerText);
          // try to extract name from greeting "Hi John," etc.
          const g = m.match(/^(hi|hello|hey|dear)\s+([A-Z][a-z]{1,40})/i);
          if (g && g[2]) candidates.push(g[2]);
          else candidates.push(m.split('\n')[0]);
        }

        return candidates.filter(Boolean).slice(0,8);
      });

      // filter candidates in Node context using same heuristics (safer)
      if (Array.isArray(name)) {
        const list = name; // from page.evaluate
        let picked = null;
        for (const c of list) {
          if (looksLikePersonName(c)) { picked = c; break; }
        }
        name = picked || null;
      } else {
        name = null;
      }

      if (name) {
        name = name.split(' ').slice(0,2).join(' ');
        console.log('Detected name from page:', name);
      } else {
        console.log('Could not detect name from page, falling back to "there".');
      }
    }

    const finalName = (name && name.length) ? name : 'there';
    const messageToPaste = rawTemplate.replace(/\{name\}/g, finalName);
    // -------------------------------------------------------------------------------------
    // selectors to try (first is the one we saw in DevTools)
    const selectors = [
      'div.msg-form__contenteditable[contenteditable="true"]',
      'div.msg-form__contenteditable.t-14.t-black--light.t-normal.flex-grow-1.full-height.notranslate',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]',
      'textarea.msg-form__textarea'
    ];

    let matchedSelector = null;
    let composer = null;

    for (const sel of selectors) {
      try {
        console.log(`Checking selector: ${sel}`);
        // wait up to 8s for this selector to appear
        await page.waitForSelector(sel, { timeout: 8000 });
        composer = await page.$(sel);
        if (composer) {
          matchedSelector = sel;
          console.log('Matched selector:', sel);
          break;
        }
      } catch (e) {
        // not found — continue
      }
    }

    // If not matched yet, try a final 10s global wait for any contenteditable
    if (!composer) {
      console.log('No selector matched yet — waiting up to 10s for any contenteditable...');
      try {
        await page.waitForSelector('div[contenteditable="true"]', { timeout: 10000 });
        composer = await page.$('div[contenteditable="true"]');
        if (composer) matchedSelector = 'div[contenteditable="true"]';
      } catch (e) {
        // still not found
      }
    }

    if (!composer) {
      console.error('Could not find composer element on this conversation page after waiting. Saving screenshot for inspection.');
      await page.screenshot({ path: screenshotDraft, fullPage: true });
      console.log('Saved screenshot to', screenshotDraft);
      process.exit(1);
    }

    // --- Atomically set composer content to avoid typing race conditions ---
    await page.waitForTimeout(250); // slight pause to allow UI to stabilize

    const sanitized = messageToPaste
      // collapse more than 2 consecutive blank lines down to 2
      .replace(/\n{3,}/g, '\n\n')
      // trim leading/trailing whitespace
      .trim();

    // Pass a single object argument to page.evaluate to avoid Playwright "Too many arguments" error.
    await page.evaluate(({ sel, text }) => {
      const el = document.querySelector(sel);
      if (!el) return false;

      el.focus();

      // If element is a contenteditable div, set its innerText
      if (el.getAttribute && el.getAttribute('contenteditable') === 'true') {
        // remove child nodes then set plain text with <br> for newlines
        while (el.firstChild) el.removeChild(el.firstChild);
        const p = document.createElement('p');
        const lines = text.split(/\n/);
        lines.forEach((line, idx) => {
          p.appendChild(document.createTextNode(line));
          if (idx !== lines.length - 1) p.appendChild(document.createElement('br'));
        });
        el.appendChild(p);
      } else if (el.tagName.toLowerCase() === 'textarea' || el.tagName.toLowerCase() === 'input') {
        el.value = text;
      } else {
        el.innerText = text;
      }

      // Dispatch input and change events so LinkedIn's JS picks up the update
      ['input', 'change', 'blur'].forEach(ev => {
        const event = new Event(ev, { bubbles: true, cancelable: true });
        el.dispatchEvent(event);
      });

      return true;
    }, { sel: matchedSelector, text: sanitized });

    // tiny pause so LinkedIn registers the change
    await page.waitForTimeout(400);

    // Save screenshot of draft (do NOT send)
    await page.screenshot({ path: screenshotDraft, fullPage: true });
    console.log('Composer found via selector:', matchedSelector);
    console.log('Draft pasted into the composer. Screenshot saved to', screenshotDraft);
    // log the drafted proposal
    require('child_process').execSync(`node "${path.join(__dirname,'step7_log_request.js')}" append '${JSON.stringify({
      threadUrl: convoUrl,
      name: finalName,
      timestamp: new Date().toISOString(),
      status: 'drafted',
      proposalPath: screenshotDraft
    })}'`);
    console.log('DO NOT press send — review the message in the browser and send manually when ready.');

  } catch (err) {
    console.error('Error preparing draft (v2):', err);
  } finally {
    console.log('\nScript finished. Leave the browser open to review and send manually.');
  }
})();
