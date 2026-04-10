// scripts/step8_followup_message_loop.js - FIXED MAX PARAMETER
const fs = require("fs");
const path = require("path");
const minimist = require("minimist");
const playwright = require("playwright");
const { updateMetric } = require('./helpers/metrics-handler');
const { isValidCandidateName } = require('./helpers/validation-helpers');

const args = minimist(process.argv.slice(2), {
  string: ["auth", "state", "followups", "browser", "profile", "slowMo"],
  boolean: ["headful", "confirm", "reset"],
  default: {
    auth: "auth_state.json",
    state: "proposals_state.json",
    followups: "state_followups.json",
    browser: "chromium",
    headful: true,
    confirm: false,
    reset: false,
    slowMo: "0",
    max: 15
  }
});

args.max = Number(args.max) || 15;

const FOLLOWUP_MSG = `Hi, Pls share your Resume to proceed further discussion.`;

 async function sendFollowupWebhook(clientName, email, threadId) {
  try {
    console.log(`📡 Sending followup webhook for: ${clientName}`);
    
    const payload = {
      clientName: clientName || 'Unknown',
      email: email || 'N/A',
      message: 'Follow-up: Resume request sent',
      threadId: threadId || `thread-${Date.now()}`,
      status: 'success',
      timestamp: new Date().toISOString()
    };

    const response = await fetch('http://localhost:3000/api/automation/followup-sent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log(`   ✅ Webhook sent for ${clientName}`);
      return true;
    } else {
      console.log(`   ⚠️  Webhook failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log('⚠️  Webhook error:', error.message);
    return false;
  }
}

// --- Load state files ---
function loadJson(file, fallback) {
  try {
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      console.log(`✓ Loaded ${file}`);
      return data;
    }
  } catch (e) {
    console.warn("Failed to load", file, e.message);
  }
  return fallback;
}

const proposalsState = loadJson(args.state, { processed: [], submittedNames: [] });
let followups = loadJson(args.followups, { sent: [], skipped_has_resume: [], skipped_no_proposal: [] });

if (!Array.isArray(followups.sent)) followups.sent = [];
if (!Array.isArray(followups.skipped_has_resume)) followups.skipped_has_resume = [];
if (!Array.isArray(followups.skipped_no_proposal)) followups.skipped_no_proposal = [];

const namesAlreadyContacted = new Set(followups.sent);
const namesWithResume = new Set(followups.skipped_has_resume);
const namesSkippedNoProposal = new Set(followups.skipped_no_proposal);

console.log(`\n📊 LOADED STATE:`);
console.log(`   ✓ Already contacted: ${namesAlreadyContacted.size}`);
console.log(`   ✓ Already have resume: ${namesWithResume.size}`);
console.log(`   ✓ No proposal found: ${namesSkippedNoProposal.size}`);

if (args.reset) {
  console.log('\n⚠️  RESET FLAG DETECTED - Clearing all followup state');
  followups = { sent: [], skipped_has_resume: [], skipped_no_proposal: [] };
  namesAlreadyContacted.clear();
  namesWithResume.clear();
  namesSkippedNoProposal.clear();
  safeSave(args.followups, followups);
}

const proposalRecipients = new Set(
  (proposalsState.submittedNames || [])
    .filter(isValidCandidateName)
);

console.log(`\n📋 PROPOSAL RECIPIENTS: ${proposalRecipients.size} unique names`);

function log(...a) {
  console.log(...a);
}

async function safeSave(file, obj) {
  try {
    fs.writeFileSync(file, JSON.stringify(obj, null, 2), "utf8");
  } catch (e) {
    log("Failed to save state", e.message);
  }
}

async function debugAllConversationNames(page) {
  const allNames = await page.evaluate(() => {
    const threads = Array.from(document.querySelectorAll('li.msg-conversation-listitem, li[class*="msg-conversation"]'));
    return threads.map(thread => {
      const selectors = [
        'h3.msg-conversation-listitem__participant-names',
        '.msg-conversation-listitem__participant-names',
        'h3 span',
        'h4 span',
        '[class*="participant-name"]'
      ];
      
      for (const sel of selectors) {
        const nameEl = thread.querySelector(sel);
        if (nameEl) {
          const text = (nameEl.innerText || nameEl.textContent || '').trim();
          if (text && text.length > 2 && text.length < 100) {
            return text;
          }
        }
      }
      return null;
    }).filter(Boolean);
  });
  
  return allNames;
}

async function hasResumeAttachment(page, conversationElement, recipientName) {
  try {
    await conversationElement.click();
    await page.waitForTimeout(3000);

    const result = await page.evaluate((recipientName) => {
      const messages = [];
      
      const allElements = document.querySelectorAll(
        '.msg-s-event-listitem, .msg-s-message-list__event, [data-event-urn]'
      );
      
      allElements.forEach(el => {
        const text = (el.innerText || el.textContent || '').trim();
        if (text && text.length > 5) {
          const isSent = text.includes('You:') || 
                        text.includes('Via Services Page') ||
                        text.includes('Deepa Rajan');
          
          const isReceived = !isSent;
          
          messages.push({
            text: text,
            isSent: isSent,
            isReceived: isReceived
          });
        }
      });
      
      let resumeReceived = false;
      
      messages.forEach(msg => {
        if (msg.isReceived) {
          const text = msg.text.toLowerCase();
          
          const hasFileExt = /\.(pdf|doc|docx)/i.test(text);
          const hasFileSize = /\d+\s*(kb|mb|bytes)/i.test(text);
          const hasDownload = /download/i.test(text);
          const hasResume = /resume|cv|curriculum/i.test(text);
          const hasAttached = /attach|send|file|document/i.test(text);
          
          if ((hasFileExt && hasFileSize) || 
              (hasResume && (hasFileExt || hasDownload)) ||
              (hasAttached && hasFileExt)) {
            resumeReceived = true;
          }
        }
      });
      
      return { resumeReceived };
    }, recipientName);

    return result.resumeReceived;
    
  } catch (e) {
    log("   ⚠️ Error checking for resume:", e.message);
    return false;
  }
}

async function hasProposalMessage(page, conversationElement, recipientName) {
  try {
    await conversationElement.click();
    await page.waitForTimeout(4000);

    const result = await page.evaluate((recipientName) => {
      const messageSelectors = [
        '.msg-s-event-listitem',
        '.msg-s-message-list__event',
        '[data-event-urn]',
        '.msg-s-message-group',
        '.msg-s-event-listitem--message'
      ];

      const messages = [];
      
      for (const selector of messageSelectors) {
        const elements = Array.from(document.querySelectorAll(selector));
        elements.forEach(el => {
          const text = (el.innerText || el.textContent || '').trim();
          if (text && text.length > 5) {
            const isSent = text.includes('You:') || 
                          text.includes('Via Services Page') ||
                          text.includes('Deepa Rajan') ||
                          el.classList.contains('msg-s-event-listitem--message');
            
            const isReceived = !isSent;

            messages.push({
              text: text,
              isSent: isSent,
              isReceived: isReceived
            });
          }
        });
      }

      let proposalFound = false;
      let followUpAlreadySent = false;

      messages.forEach(msg => {
        if (msg.isSent) {
          const text = msg.text.toLowerCase();
          
          if (text.includes('please take a look at my proposal') && 
              text.includes('interested in working with me')) {
            proposalFound = true;
          }
          
          if (text.includes('pls share your resume') || 
              text.includes('share your resume') ||
              text.includes('hi, pls share') ||
              text.includes('share a confirmation')) {
            followUpAlreadySent = true;
          }
        }
      });

      return {
        hasProposal: proposalFound,
        followUpAlreadySent,
        totalMessages: messages.length
      };
    }, recipientName);

    log(`   Messages: ${result.totalMessages} total`);

    if (!result.hasProposal) {
      log(`   ⏭️  No proposal found`);
      return false;
    }

    if (result.followUpAlreadySent) {
      log(`   ⏭️  Follow-up ALREADY sent`);
      return false;
    }

    log(`   ✅ Found proposal - eligible for follow-up`);
    return true;
    
  } catch (e) {
    log("   Error checking messages:", e.message);
    return false;
  }
}

async function getConversationName(conversationElement) {
  try {
    return await conversationElement.evaluate(el => {
      const selectors = [
        'h3.msg-conversation-listitem__participant-names',
        '.msg-conversation-listitem__participant-names',
        'h3 span',
        'h4 span',
        '[class*="participant-name"]',
        '.msg-conversation-listitem__participant-names span'
      ];
      
      for (const sel of selectors) {
        const nameEl = el.querySelector(sel);
        if (nameEl) {
          const text = (nameEl.innerText || nameEl.textContent || '').trim();
          if (text && text.length > 2 && text.length < 100) {
            return text;
          }
        }
      }
      return null;
    });
  } catch (e) {
    return null;
  }
}

async function sendFollowUp(page, message) {
  try {
    const inputSelectors = [
      'div[role="textbox"][contenteditable="true"]',
      '.msg-form__contenteditable',
      '[class*="msg-form__contenteditable"]',
      'div.msg-form__msg-content-container div[contenteditable="true"]',
      '.msg-form__msg-content-container--scrollable div[contenteditable="true"]'
    ];

    let input = null;
    for (const sel of inputSelectors) {
      input = await page.$(sel);
      if (input) {
        const isVisible = await input.isVisible().catch(() => false);
        if (isVisible) break;
        input = null;
      }
    }

    if (!input) {
      log("⚠️ Could not find message input box");
      return false;
    }

    await input.click();
    await page.waitForTimeout(1000);
    
    await input.evaluate(el => {
      el.focus();
      el.innerHTML = '';
      el.innerText = '';
      el.textContent = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await page.waitForTimeout(500);
    await input.type(message, { delay: 50 });
    await page.waitForTimeout(1500);

    const sendButtonSelectors = [
      'button.msg-form__send-button:not([disabled])',
      'button[data-test-msg-send-button]:not([disabled])',
      'button[type="submit"]:not([disabled])',
      '.msg-form__send-button',
      'button[aria-label*="Send"]',
      'button[aria-label*="send"]'
    ];

    let sendButton = null;
    let attempts = 0;
    const maxAttempts = 15;

    while (!sendButton && attempts < maxAttempts) {
      for (const sel of sendButtonSelectors) {
        const btn = await page.$(sel);
        if (btn) {
          const isEnabled = await btn.evaluate(button => {
            const disabled = button.disabled || 
                           button.getAttribute('disabled') !== null ||
                           button.getAttribute('aria-disabled') === 'true';
            
            const style = window.getComputedStyle(button);
            const visible = style.display !== 'none' && 
                           style.visibility !== 'hidden' &&
                           style.opacity !== '0';
            
            const rect = button.getBoundingClientRect();
            const hasSize = rect.width > 0 && rect.height > 0;
            
            return !disabled && visible && hasSize;
          });
          
          if (isEnabled) {
            sendButton = btn;
            log(`   ✓ Found enabled send button`);
            break;
          }
        }
      }
      
      if (!sendButton) {
        await page.waitForTimeout(500);
        attempts++;
      }
    }

    if (sendButton) {
      await sendButton.click();
      await page.waitForTimeout(2000);
      
      const messageSent = await input.evaluate(el => {
        const content = el.innerText || el.textContent || el.innerHTML || '';
        return content.trim().length === 0;
      });

      if (messageSent) {
        log(`   ✅ Message sent successfully via send button`);
        return true;
      }
    }

    log("   Attempting Enter key fallback...");
    await input.focus();
    await page.waitForTimeout(300);
    
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("Enter");
      await page.waitForTimeout(500);
    }
    
    await page.waitForTimeout(2000);

    const inputCleared = await input.evaluate(el => {
      const content = el.innerText || el.textContent || el.innerHTML || '';
      return content.trim().length === 0;
    });

    if (inputCleared) {
      log(`   ✅ Message sent successfully via Enter key`);
      return true;
    } else {
      log(`   ❌ Message may not have sent`);
      return false;
    }
    
  } catch (e) {
    log("Error sending message:", e.message);
    return false;
  }
}

async function verifyMessageSent(page, expectedMessage) {
  try {
    await page.waitForTimeout(3000);
    
    const messageFound = await page.evaluate((expectedMsg) => {
      const sentMessageSelectors = [
        '.msg-s-event-listitem--message',
        '[data-event-urn]',
        '.msg-s-message-list__event'
      ];
      
      for (const selector of sentMessageSelectors) {
        const elements = Array.from(document.querySelectorAll(selector));
        for (const el of elements) {
          const text = (el.innerText || el.textContent || '').trim();
          
          if (text.includes('Maximize compose field') || 
              text.includes('Write message') ||
              text.length < 5) {
            continue;
          }
          
          const isSent = text.includes('You:') || 
                        text.includes('Via Services Page') ||
                        el.classList.contains('msg-s-event-listitem--message');
          
          if (isSent && text.includes(expectedMsg)) {
            return text;
          }
        }
      }
      
      return null;
    }, expectedMessage);

    if (messageFound) {
      log(`   ✅ Verified: Message in conversation`);
      return true;
    } else {
      const inputCleared = await page.evaluate(() => {
        const input = document.querySelector('[contenteditable="true"]');
        if (!input) return false;
        const content = input.innerText || input.textContent || '';
        return content.trim().length === 0;
      });
      
      if (inputCleared) {
        log(`   ✅ Verified: Input cleared - message sent`);
        return true;
      } else {
        log(`   ⚠️ Cannot verify message sent`);
        return false;
      }
    }
  } catch (e) {
    log(`   ⚠️ Could not verify message: ${e.message}`);
    return false;
  }
}

// --- MAIN ---
(async () => {
  const browserType = args.browser === "firefox" ? "firefox" :
                      args.browser === "webkit" ? "webkit" : "chromium";
  const lib = playwright[browserType];

  let context;
  if (args.profile) {
    context = await lib.launchPersistentContext(args.profile, {
      headless: !args.headful,
      slowMo: Number(args.slowMo)
    });
  } else {
    const browser = await lib.launch({
      headless: !args.headful,
      slowMo: Number(args.slowMo)
    });
    const ctxOpts = args.auth && fs.existsSync(args.auth)
      ? { storageState: args.auth }
      : {};
    context = await browser.newContext(ctxOpts);
  }

  const page = await context.newPage();
  page.setDefaultTimeout(60000);

  // Declare newFollowups at outer scope so it's accessible in catch block
  let newFollowups = 0;

  // Helper function for navigation with retries
  async function navigateWithRetry(url, options = {}, maxRetries = 3) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        log(`\n🔗 Attempt ${attempt}/${maxRetries}: Opening LinkedIn Messaging...`);
        await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 60000,
          ...options 
        });
        await page.waitForTimeout(5000);
        return true;
      } catch (e) {
        lastError = e;
        log(`⚠️  Navigation attempt ${attempt} failed: ${e.message}`);
        if (attempt < maxRetries) {
          log(`   Retrying in ${attempt * 10} seconds...`);
          await page.waitForTimeout(attempt * 10000);
        }
      }
    }
    throw lastError;
  }

  try {
    await navigateWithRetry("https://www.linkedin.com/messaging/");

    if (/\/login|checkpoint/.test(page.url())) {
      log("❌ Not logged in. Please sign in and retry.");
      await context.close();
      process.exit(1);
    }

    const threadsSelector = 'li.msg-conversation-listitem, li[class*="msg-conversation"]';
    await page.waitForSelector(threadsSelector, { timeout: 10000 });

    const conversationList = await page.$('.msg-conversations-container__conversations-list, [class*="conversations-list"]');
    if (conversationList) {
      for (let i = 0; i < 3; i++) {
        await conversationList.evaluate(el => el.scrollBy(0, el.scrollHeight));
        await page.waitForTimeout(1500);
      }
    }

    const threads = await page.$$(threadsSelector);
    log(`\n📱 Found ${threads.length} conversation threads\n`);

    // ✅ FIX: Process in NATURAL order (don't reverse)
    // This way older conversations (which need follow-ups) are checked first

    for (let threadIndex = 0; threadIndex < threads.length; threadIndex++) {
      // ✅ Check if we've hit the max BEFORE processing
      if (newFollowups >= args.max) {
        log(`\n⚠️ Reached max limit (${args.max}) for this run.`);
        break;
      }

      const thread = threads[threadIndex];
      
      const name = await getConversationName(thread);
      if (!name) {
        continue;
      }

      log(`🔍 [${threadIndex + 1}/${threads.length}] Checking: ${name}`);
      if (!isValidCandidateName(name)) {
        log(`   ⚠️  Invalid name: "${name}" - skipping thread`);
        continue; // Skip this thread entirely
      }

      // ✅ CRITICAL FIX: Check already contacted FIRST and skip immediately
      if (namesAlreadyContacted.has(name)) {
        log(`   ⏭️  Already followed up - SKIPPING`);
        continue;
      }

      // Check if in proposal recipients
      const isProposalRecipient = Array.from(proposalRecipients).some(proposalName => {
        const nameLower = name.toLowerCase();
        const proposalLower = proposalName.toLowerCase();
        
        if (name === proposalName) return true;
        if (nameLower.includes(proposalLower)) return true;
        if (proposalLower.includes(nameLower)) return true;
        
        const nameParts = nameLower.split(' ').filter(part => part.length > 2);
        const proposalParts = proposalLower.split(' ').filter(part => part.length > 2);
        
        const sharedParts = nameParts.filter(part => 
          proposalParts.some(proposalPart => 
            part.includes(proposalPart) || proposalPart.includes(part)
          )
        );
        
        return sharedParts.length >= 1;
      });
      
      if (!isProposalRecipient) {
        log(`   ⏭️  Not in proposal recipients`);
        continue;
      }

      if (namesWithResume.has(name)) {
        log(`   ⏭️  Already has resume - SKIPPING`);
        continue;
      }

      log(`   📋 Checking for resume attachment...`);
      const hasResume = await hasResumeAttachment(page, thread, name);
      
      if (hasResume) {
        log(`   ✅ Resume already received - NO follow-up needed`);
        namesWithResume.add(name);
        followups.skipped_has_resume.push(name);
        safeSave(args.followups, followups);
        continue;
      }

      log(`   📋 Checking for proposal message...`);
      const hasProposal = await hasProposalMessage(page, thread, name);

      if (!hasProposal) {
        log(`   ⏭️  No eligible proposal found`);
        namesSkippedNoProposal.add(name);
        followups.skipped_no_proposal.push(name);
        safeSave(args.followups, followups);
        continue;
      }

      log(`   ✓ Eligible for follow-up`);

      if (args.confirm) {
        await page.waitForTimeout(1000 + Math.floor(Math.random() * 1000));
        
        const sent = await sendFollowUp(page, FOLLOWUP_MSG);
        if (sent) {
          const verified = await verifyMessageSent(page, FOLLOWUP_MSG);
          
          if (verified) {
            log(`   ✅ Follow-up sent and verified: ${name}`);
          } else {
            log(`   ⚠️ Follow-up may not have sent: ${name}`);
          }
          
          
          // ✅ NOW send webhooks - name is already validated
          try {
            await fetch('http://localhost:3000/api/automation/followup-sent', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                clientName: name,  // Safe - already validated
                threadId: thread.getAttribute('data-urn') || null
              })
            }).catch(err => console.warn('⚠️  Webhook failed:', err.message));
          } catch (e) {
            console.warn('⚠️  Could not send webhook');
          }
          
          newFollowups++;

          // Update metrics
          const currentHour = new Date().getHours();
          let slot = 'slot1';
          if (currentHour >= 14 && currentHour < 18) {
            slot = 'slot2';
          } else if (currentHour >= 18) {
            slot = 'slot3';
          }
          updateMetric(slot, 'followups', 1);
          log(`📊 Metrics: Updated ${slot} followups count`);

          // ✅ NEW: Send individual webhook with client details
          const threadId = await thread.evaluate(e => e.getAttribute('data-urn') || e.id || `thread-${Date.now()}`);
          await sendFollowupWebhook(name, 'automation@linkedin.local', threadId);
          namesAlreadyContacted.add(name);
          followups.sent.push(name);
          safeSave(args.followups, followups);
        } else {
          log(`   ❌ Failed to send message to: ${name}`);
        }
      }

      const delay = 3000 + Math.floor(Math.random() * 4000);
      await page.waitForTimeout(delay);
    }

    log(`\n${"=".repeat(60)}`);
    log(`🏁 STEP 8 COMPLETE`);
    log(`${"=".repeat(60)}`);
    log(`📊 Statistics:`);
    log(`   • Total threads checked: ${threads.length}`);
    log(`   • Valid proposal recipients: ${proposalRecipients.size}`);
    log(`   • New follow-ups sent: ${args.confirm ? newFollowups : 0} (max was ${args.max})`);
    log(`   • Total ever contacted: ${followups.sent.length}`);
    
    if (!args.confirm) {
      log(`\n⚠️  This was a DRY RUN. Use --confirm=true to actually send messages.`);
    }

  await safeSave(args.followups, followups);
  await context.close();
  process.exit(0);

  } catch (e) {
    console.error("Error:", e);
    await context.close();
    console.log(`\n✅ Step 8 Complete - ${newFollowups} follow-ups sent`);

    process.exit(1);
  }
})();