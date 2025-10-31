/**
 * step7_send_proposal_live.js
 *
 * Sends a long, personalized proposal message.
 * Automatically inserts recipient name from requests_log.json (safe fallback logic).
 *
 * Usage (dry-run):
 *   node step7_send_proposal_live.js --index=0 --delay=8 --profile="/tmp/chrome-profile-copy"
 * Usage (send):
 *   node step7_send_proposal_live.js --index=0 --confirm --delay=12 --profile="/tmp/chrome-profile-copy"
 */

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const argv = require("minimist")(process.argv.slice(2));

const CONFIRM = !!argv.confirm;
const CLOSE_AT_END = !!argv.close;
const DELAY = parseFloat(argv.delay || "20");
const INDEX = argv.index !== undefined ? parseInt(argv.index, 10) : null;
const PROFILE = argv.profile || "/tmp/chrome-profile-copy";
const EXECUTABLE = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const LOG_PATH = path.resolve(__dirname, "..", "data", "requests_log.json");

const COMPOSER_SELECTOR = 'div.msg-form__contenteditable';
const RETRY_COUNT = 12;
const RETRY_INTERVAL_MS = 1200;

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
function nowISO(){ return new Date().toISOString(); }
function randInt(min, max){ return Math.floor(Math.random()*(max-min+1))+min; }

////////////////////////////////////////////////////////////////////////////////
// --- Helper functions for typing, pasting, and sending -----------------------
////////////////////////////////////////////////////////////////////////////////

async function tryNativeType(page, selector, text) {
  try {
    await page.waitForSelector(selector, { timeout: 8000 });
    const el = await page.$(selector);
    if (!el) return false;
    await el.click().catch(() => null);
    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.down(modifier);
    await page.keyboard.press("KeyA");
    await page.keyboard.up(modifier);
    await page.keyboard.press("Backspace");
    for (const ch of text) {
      await page.keyboard.type(ch, { delay: randInt(40, 120) });
      if (Math.random() < 0.03) await page.waitForTimeout(randInt(10, 60));
    }
    await page.keyboard.press("Space");
    await page.keyboard.press("Backspace");
    await page.waitForTimeout(350);
    return true;
  } catch (e) { return false; }
}

async function setComposerTextAndDispatchEvents(page, selector, text) {
  try {
    await page.waitForSelector(selector, { timeout: 6000 });
    await page.evaluate((sel, msg) => {
      const el = document.querySelector(sel);
      if (!el) return;
      el.innerText = msg;
      ["input", "change", "keyup", "keydown", "blur"].forEach(ev => {
        el.dispatchEvent(new Event(ev, { bubbles: true }));
      });
    }, selector, text);
    await page.waitForTimeout(300);
    return true;
  } catch (e) { return false; }
}

async function composeWithRetries(page, selector, text) {
  if (await tryNativeType(page, selector, text)) return true;
  if (await setComposerTextAndDispatchEvents(page, selector, text)) return true;
  return false;
}

async function tryDismissOverlays(page) {
  const DISMISS_SELECTORS = [
    'button[aria-label="Accept"]', 'button:has-text("Accept")', 'button:has-text("I agree")',
    'button:has-text("Got it")', 'button:has-text("Agree")', '.cookie-consent-accept',
    '.artdeco-dismiss', 'button:has-text("Close")', '.close-button'
  ];
  for (const sel of DISMISS_SELECTORS) {
    try {
      const btns = await page.$$(sel);
      for (const b of btns) {
        const visible = await b.isVisible();
        if (visible) {
          await b.click().catch(() => null);
          await page.waitForTimeout(400);
        }
      }
    } catch (e) {}
  }
}

////////////////////////////////////////////////////////////////////////////////
// --- Main process ------------------------------------------------------------
////////////////////////////////////////////////////////////////////////////////

(async () => {
  console.log("STEP7 start — CONFIRM=", CONFIRM, " INDEX=", INDEX, " DELAY=", DELAY);

  if (!fs.existsSync(LOG_PATH)) {
    console.error("❌ requests_log.json not found at", LOG_PATH);
    process.exit(1);
  }

  const logs = JSON.parse(fs.readFileSync(LOG_PATH, "utf8") || "[]");
  if (!logs[INDEX]) {
    console.error("❌ No log entry at index", INDEX);
    process.exit(1);
  }

  const item = logs[INDEX];
  const threadUrl = item.threadUrl || item.linkedinUrl || item.ThreadURL;
  if (!threadUrl) {
    console.error("❌ Thread URL missing for index", INDEX);
    process.exit(1);
  }

  // ✅ Robust name fallback logic
  const clientName =
    (item.name && item.name.trim()) ||
    (item.firstName && item.firstName.trim()) ||
    (item.fullName && item.fullName.trim()) ||
    (item.email && item.email.split("@")[0].replace(/[._0-9]+/g, " ")
      .split(" ").map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" ")) ||
    "there";

  if (!item.name) {
    console.log(`⚠️  Name missing for index ${INDEX}, using fallback: "${clientName}"`);
  }

  const context = await chromium.launchPersistentContext(PROFILE, {
    headless: false,
    executablePath: EXECUTABLE,
    args: ["--start-maximized"],
    viewport: null,
  });

  const page = await context.newPage();
  console.log("Navigating to thread...");
  await page.goto(threadUrl, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => null);
  await page.waitForTimeout(1000);
  await tryDismissOverlays(page);
  // ----------------- Robust thread guard + "Submit Proposal" click -----------------
async function ensureCorrectThreadAndOpenProposal(page, targetThreadUrl) {
  // 1) Ensure current URL matches target (use startsWith to allow canonical variations)
  let current = (page.url && page.url()) || '';
  if (!current.startsWith(targetThreadUrl)) {
    console.log('URL mismatch or user clicked elsewhere — re-navigating to target thread:', targetThreadUrl);
    await page.goto(targetThreadUrl, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(()=>null);
    await page.waitForTimeout(900);
    await page.evaluate(()=>window.scrollBy(0,120)).catch(()=>null);
    await page.waitForTimeout(700);
  } else {
    console.log('Already on target thread URL.');
  }

  // 2) Try to click any "Submit Proposal" / "Send proposal" UI in the thread if present.
  const proposalBtnSelectors = [
    'button:has-text("Submit proposal")',
    'button:has-text("Submit Proposal")',
    'button:has-text("Send proposal")',
    'button:has-text("Send Proposal")',
    'a:has-text("Submit proposal")',
    'a:has-text("Send proposal")',
    'button[aria-label*="proposal"]',
    'button:has-text("Proposal")'
  ];

  for (const s of proposalBtnSelectors) {
    try {
      const el = await page.$(s);
      if (el) {
        const visible = await el.evaluate(n => {
          const r = n.getBoundingClientRect();
          return r.width > 6 && r.height > 6 && window.getComputedStyle(n).visibility !== 'hidden';
        }).catch(()=>false);
        if (visible) {
          console.log('Clicking proposal button:', s);
          await el.click().catch(()=>null);
          // wait for UI to open the right composer (modal or pane)
          await page.waitForTimeout(900);
          break;
        }
      }
    } catch (e) {}
  }

  // 3) Final guard: bring page to front and re-check URL
  try { await page.bringToFront(); } catch(e){}
  await page.waitForTimeout(220);
  current = page.url();
  console.log('Final URL before composing:', current);
  if (!current.startsWith(targetThreadUrl)) {
    console.log('Warning: final URL does not match targetThreadUrl. Re-opening target thread and continuing.');
    await page.goto(targetThreadUrl, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(()=>null);
    await page.waitForTimeout(700);
  }
}
// ----------------- end helper -----------------

// Call the helper (place this line immediately after tryDismissOverlays)
await ensureCorrectThreadAndOpenProposal(page, threadUrl);


  // Find composer
  let composer = null;
  for (let attempt = 1; attempt <= RETRY_COUNT; attempt++) {
    composer = await page.$(COMPOSER_SELECTOR);
    if (composer) break;
    console.log(`Composer attempt ${attempt}/${RETRY_COUNT} ...`);
    await page.waitForTimeout(RETRY_INTERVAL_MS);
  }

  if (!composer) {
    console.error("❌ Composer not found.");
    await page.screenshot({ path: `step7_failed_${Date.now()}.png`, fullPage: true });
    process.exit(1);
  }

  console.log("✅ Composer found.");

  // Compose personalized message
  let message = `Hello ${clientName}, 

Greetings!!! 

Are you tired of your resume getting lost in the shuffle? 

Did you know that 85% of resumes are rejected by Applicant Tracking Systems (ATS)? 

As a seasoned career coach with 15+ years of experience, I help ambitious professionals like you craft ATS-friendly resumes and LinkedIn profiles that showcase your strengths and achievements. 

Whether you're a C-level executive, leadership aspirant, or mid-career professional, my expert services will help you: 

• Stand out in a competitive job market 
• Increase your visibility to recruiters and hiring managers 
• Boost your confidence and career growth 

Ready to transform your career? 

Let's get started! 

Share your resume and contact details, and I'll be in touch to discuss how my personalized services can help you achieve your career goals. 

Services Offered: 
• Resume Writing 
• LinkedIn Profile Optimization 
• Career Coaching 
• Interview Preparation 

Looking forward to empowering your career success! 

Cheers, 
Deepa Rajan 
Ph: 9036846673 
Write to: deeparajan890@gmail.com
`;

  if (item.ProposalPath) {
    message += `\n\nProposal Link: ${item.ProposalPath}`;
  }

  console.log("✍️ Composing personalized proposal for:", clientName);
  await composeWithRetries(page, COMPOSER_SELECTOR, message);

  const beforeShot = path.resolve(process.cwd(), `step7_before_${INDEX}_${Date.now()}.png`);
  await page.screenshot({ path: beforeShot, fullPage: true });
  console.log("📸 Saved beforeShot ->", beforeShot);

  if (CONFIRM) {
    console.log("Attempting to send...");
    const sendButton = await page.$('button[aria-label="Send"], button:has-text("Send")');
    if (sendButton) {
      await sendButton.click().catch(() => null);
      await page.waitForTimeout(1500);
      const afterShot = path.resolve(process.cwd(), `step7_after_${INDEX}_${Date.now()}.png`);
      await page.screenshot({ path: afterShot, fullPage: true });
      console.log("✅ Sent and logged for index", INDEX);
      logs[INDEX].status = "sent";
      logs[INDEX].sentAt = nowISO();
      fs.writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2), "utf8");
    } else {
      console.error("❌ Send button not found.");
      await page.screenshot({ path: `step7_send_failed_${Date.now()}.png`, fullPage: true });
    }
  } else {
    console.log("🧪 Dry-run complete (no send).");
  }

  console.log("Done. Browser left open for inspection.");
})();