// scripts/step11_linkedin_notify.js
// ✅ After detecting email was sent (Step 10), send LinkedIn follow-up message
// Message: "Hi {firstName}, I have shared a detailed mail, pls review and revert back to me to proceed further."

const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const playwright = require('playwright');

require('dotenv').config();

const args = minimist(process.argv.slice(2), {
  string: ['auth', 'mapping', 'browser', 'slowMo'],
  boolean: ['headful', 'confirm'],
  default: {
    auth: 'auth_state.json',
    mapping: 'draft_linkedin_mapping.json',
    browser: 'chromium',
    headless: false,
    headful: true,
    confirm: false,
    slowMo: '150',
    max: 50
  }
});

args.max = Number(args.max) || 50;

// Message template with fallback for firstName
const FOLLOWUP_MESSAGE = (firstName, linkedinName) => {
  const name = firstName || (linkedinName ? linkedinName.split(' ')[0] : 'there');
  return `Hi ${name}, I have shared a detailed mail, pls review and revert back to me to proceed further.`;
};

function loadMapping() {
  const mappingPath = path.join(process.cwd(), args.mapping);
  if (!fs.existsSync(mappingPath)) {
    console.log('❌ Mapping file not found');
    return [];
  }
  try {
    const data = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
    if (!Array.isArray(data)) return [];
    return data;
  } catch (error) {
    console.log('❌ Error reading mapping file:', error.message);
    return [];
  }
}

function saveMapping(mappingData) {
  const mappingPath = path.join(process.cwd(), args.mapping);
  try {
    fs.writeFileSync(mappingPath, JSON.stringify(mappingData, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.log('❌ Error saving mapping file:', error.message);
    return false;
  }
}

async function getConversationName(thread) {
  try {
    return await thread.evaluate(el => {
      const selectors = ['h3.msg-conversation-listitem__participant-names', '.msg-conversation-listitem__participant-names', 'h3 span', 'h4 span'];
      for (const sel of selectors) {
        const nameEl = el.querySelector(sel);
        if (nameEl) {
          const text = (nameEl.innerText || nameEl.textContent || '').trim();
          if (text && text.length > 2 && text.length < 100) return text;
        }
      }
      return null;
    });
  } catch (e) { return null; }
}

function isNameMatch(conversationName, targetName) {
  if (!conversationName || !targetName) return false;
  const convLower = conversationName.toLowerCase().trim();
  const targetLower = targetName.toLowerCase().trim();
  if (convLower === targetLower) return true;
  
  const targetWords = targetLower.split(/\s+/).filter(w => w.length >= 3);
  const convWords = convLower.split(/\s+/).filter(w => w.length >= 3);
  
  if (targetWords.length === 1) return convLower === targetLower;
  
  let matches = 0;
  for (const tWord of targetWords) {
    for (const cWord of convWords) {
      if (cWord === tWord || cWord.startsWith(tWord) || tWord.startsWith(cWord)) { matches++; break; }
    }
  }
  return matches >= targetWords.length;
}

async function searchAndClickConversation(page, searchTerm) {
  console.log(`   🔍 Trying LinkedIn search with: "${searchTerm}"`);
  try {
    await page.goto(`https://www.linkedin.com/messaging/?searchTerm=${encodeURIComponent(searchTerm)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const searchResults = await page.$$('li.msg-conversation-listitem');
    if (searchResults.length > 0) {
      console.log(`   ✅ Found ${searchResults.length} conversation(s) via search`);
      const firstResult = searchResults[0];
      const name = await getConversationName(firstResult);
      console.log(`   👆 Clicking on: "${name}"`);
      await firstResult.click();
      await page.waitForTimeout(4000);
      return true;
    }
    console.log(`   ⚠️ No search results for "${searchTerm}"`);
    return false;
  } catch (e) {
    console.log(`   ❌ Search error: ${e.message}`);
    return false;
  }
}

async function findAndClickConversation(page, searchName) {
  console.log(`   🔍 Looking for conversation: "${searchName}"`);
  let threads = await page.$$('li.msg-conversation-listitem');
  
  for (let i = 0; i < threads.length; i++) {
    const name = await getConversationName(threads[i]);
    if (name && isNameMatch(name, searchName)) {
      console.log(`   ✅ Found in loaded list: "${name}"`);
      await threads[i].click();
      await page.waitForTimeout(4000);
      return true;
    }
  }
  
  console.log(`   🔍 Not found in loaded list, trying search...`);
  let found = await searchAndClickConversation(page, searchName);
  
  if (!found) {
    const nameParts = searchName.split(' ');
    if (nameParts.length > 1) {
      const firstPart = nameParts[0];
      if (firstPart.length > 2) {
        console.log(`   🔍 Trying search with first name: "${firstPart}"`);
        found = await searchAndClickConversation(page, firstPart);
      }
    }
  }
  return found || false;
}

// Using the WORKING sendFollowUp from step8
async function sendMessage(page, message) {
  try {
    const inputSelectors = [
      'div[role="textbox"][contenteditable="true"]',
      '.msg-form__contenteditable',
      '[class*="msg-form__contenteditable"]',
      'div.msg-form__msg-content-container div[contenteditable="true"]'
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
      console.log("   ❌ Input not found");
      return false;
    }

    console.log("   📝 Typing message...");
    await input.click();
    await page.waitForTimeout(1000);
    
    // Clear with dispatchEvent like step8
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

    // Try to find and click the send button like step8
    const sendButtonSelectors = [
      'button.msg-form__send-button:not([disabled])',
      'button[data-test-msg-send-button]:not([disabled])',
      'button[type="submit"]:not([disabled])',
      '.msg-form__send-button',
      'button[aria-label*="Send"]'
    ];

    let sendButton = null;
    let attempts = 0;
    const maxAttempts = 15;

    while (!sendButton && attempts < maxAttempts) {
      for (const sel of sendButtonSelectors) {
        const btn = await page.$(sel);
        if (btn) {
          const isEnabled = await btn.evaluate(button => {
            const disabled = button.disabled || button.getAttribute('disabled') !== null || button.getAttribute('aria-disabled') === 'true';
            const style = window.getComputedStyle(button);
            const visible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
            const rect = button.getBoundingClientRect();
            const hasSize = rect.width > 0 && rect.height > 0;
            return !disabled && visible && hasSize;
          });
          
          if (isEnabled) {
            sendButton = btn;
            console.log("   ✅ Found enabled send button");
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
      console.log("   ✅ Clicking send button...");
      await sendButton.click();
      await page.waitForTimeout(2000);
      
      const messageCleared = await input.evaluate(el => {
        const content = el.innerText || el.textContent || el.innerHTML || '';
        return content.trim().length === 0;
      });
      
      if (messageCleared) {
        console.log("   ✅ Message sent (button click)");
        return true;
      }
    }

    // Fallback to Enter key like step8
    console.log("   📤 Trying Enter key fallback...");
    await input.focus();
    await page.waitForTimeout(300);
    
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("Enter");
      await page.waitForTimeout(500);
    }
    
    await page.waitForTimeout(2000);

    const cleared = await input.evaluate(el => {
      const content = el.innerText || el.textContent || el.innerHTML || '';
      return content.trim().length === 0;
    });
    
    if (cleared) {
      console.log("   ✅ Message sent via Enter key");
      return true;
    }

    console.log("   ❌ Could not send message");
    return false;
    
  } catch (e) {
    console.log("   ❌ Error: " + e.message);
    return false;
  }
}

async function verifyMessageSent(page) {
  try {
    await page.waitForTimeout(2000);
    const isEmpty = await page.evaluate(() => {
      const input = document.querySelector('[contenteditable="true"]');
      if (!input) return true;
      const text = input.innerText || input.textContent || '';
      return text.trim().length === 0;
    });
    return isEmpty;
  } catch (e) { return false; }
}

async function linkedinNotify() {
  console.log('\n💬 STEP 11: LinkedIn Notification');
  console.log('='.repeat(50));
  console.log('Sending follow-up messages on LinkedIn after email is sent...\n');

  const mappingData = loadMapping();
  if (mappingData.length === 0) {
    console.log('📭 No records in mapping file');
    process.exit(0);
  }

  const toNotify = mappingData.filter(r => r.status === 'email_sent');
  
  console.log(`📊 Total records: ${mappingData.length}`);
  console.log(`📧 Records with email sent: ${toNotify.length}\n`);

  if (toNotify.length === 0) {
    console.log('✅ No records to notify');
    process.exit(0);
  }

  const browser = await playwright.chromium.launch({ 
    headless: args.headless,
    slowMo: Number(args.slowMo)
  });

  const context = await browser.newContext({ storageState: args.auth });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  try {
    console.log('📱 Opening LinkedIn Messaging...');
    await page.goto("https://www.linkedin.com/messaging/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);

    if (/\/login|checkpoint/.test(page.url())) {
      console.log("❌ Not logged in");
      await browser.close();
      process.exit(1);
    }

    const initialThreads = await page.$$('li.msg-conversation-listitem');
    console.log(`👥 Found ${initialThreads.length} conversations in initial load\n`);

    let notified = 0;
    let notFound = 0;
    let failed = 0;

    for (let i = 0; i < toNotify.length; i++) {
      if (notified >= args.max) {
        console.log(`\n⚠️  Reached max limit: ${args.max}`);
        break;
      }

      const record = toNotify[i];
      const { linkedinName, firstName } = record;
      
      console.log(`\n🔍 [${i + 1}/${toNotify.length}] Processing: ${linkedinName}`);
      
      const found = await findAndClickConversation(page, linkedinName);
      
      if (!found) {
        console.log(`   ❌ Conversation not found: ${linkedinName}`);
        
        if (i === 0) {
          const debugThreads = await page.$$('li.msg-conversation-listitem');
          console.log(`   📋 Available conversations (sample):`);
          for (let j = 0; j < Math.min(10, debugThreads.length); j++) {
            const name = await getConversationName(debugThreads[j]);
            console.log(`      - "${name}"`);
          }
        }
        
        notFound++;
        record.status = 'notification_failed';
        record.failedAt = new Date().toISOString();
        record.failureReason = 'Conversation not found on LinkedIn';
        saveMapping(mappingData);
        continue;
      }

      const message = FOLLOWUP_MESSAGE(firstName, linkedinName);
      console.log(`   💬 Message: "${message}"`);

      if (!args.confirm) {
        console.log(`   💡 DRY RUN - Would send message`);
        record.status = 'linkedin_notified';
        record.notifiedAt = new Date().toISOString();
        record.dryRun = true;
        notified++;
      } else {
        const sent = await sendMessage(page, message);
        
        if (sent) {
          const verified = await verifyMessageSent(page);
          if (verified) {
            console.log(`   ✅ Message sent successfully`);
            record.status = 'linkedin_notified';
            record.notifiedAt = new Date().toISOString();
            notified++;
          } else {
            console.log(`   ⚠️  Message may not have sent`);
            failed++;
          }
        } else {
          console.log(`   ❌ Failed to send message`);
          failed++;
        }
      }

      saveMapping(mappingData);

      // Stay in conversation to avoid browser crashes
      const delay = 3000 + Math.floor(Math.random() * 2000);
      console.log(`   ⏳ Waiting ${Math.round(delay/1000)}s before next...`);
      await page.waitForTimeout(delay);
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 STEP 11 COMPLETE');
    console.log('='.repeat(50));
    console.log(`   • Total to notify: ${toNotify.length}`);
    console.log(`   • Successfully notified: ${notified}`);
    console.log(`   • Conversations not found: ${notFound}`);
    console.log(`   • Failed to send: ${failed}`);
    
    if (!args.confirm) {
      console.log(`\n💡 This was a DRY RUN`);
      console.log(`   Use --confirm=true to actually send messages`);
    }

    await browser.close();
    process.exit(0);

  } catch (e) {
    console.error("❌ Fatal error:", e);
    try { await browser.close(); } catch (e2) {}
    process.exit(1);
  }
}

linkedinNotify().catch(error => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});

module.exports = { linkedinNotify };

