const fs = require("fs");
const path = require("path");
const minimist = require("minimist");
const playwright = require("playwright");

const args = minimist(process.argv.slice(2), {
  string: ["auth", "browser", "slowMo"],
  boolean: ["headful"],
  default: {
    auth: "auth_state.json",
    browser: "chromium",
    headful: true,
    slowMo: "100",
    max: 50
  }
});

args.max = Number(args.max) || 50;

function log(...a) { console.log(...a); }

async function getConversationName(conversationElement) {
  try {
    return await conversationElement.evaluate(el => {
      const selectors = [
        'h3.msg-conversation-listitem__participant-names',
        '.msg-conversation-listitem__participant-names',
        'h3 span',
        'h4 span'
      ];
      
      for (const sel of selectors) {
        const nameEl = el.querySelector(sel);
        if (nameEl) {
          const text = (nameEl.innerText || nameEl.textContent || '').trim();
          if (text && text.length > 2) return text;
        }
      }
      return null;
    });
  } catch (e) {
    return null;
  }
}

// Scan for conversations that have attachment indicators
async function scanForAttachmentConversations(page) {
  return await page.evaluate(() => {
    console.log('🔍 Scanning ALL conversations for attachment indicators...');
    
    const conversationsWithAttachments = [];
    const allConversations = Array.from(document.querySelectorAll('li.msg-conversation-listitem'));
    
    allConversations.forEach((conv, index) => {
      const conversationInfo = {
        index: index,
        hasAttachment: false,
        attachmentIndicators: [],
        previewText: '',
        name: ''
      };
      
      // Get conversation name
      const nameSelectors = [
        'h3.msg-conversation-listitem__participant-names',
        '.msg-conversation-listitem__participant-names',
        'h3 span',
        'h4 span'
      ];
      
      for (const sel of nameSelectors) {
        const nameEl = conv.querySelector(sel);
        if (nameEl) {
          conversationInfo.name = (nameEl.innerText || nameEl.textContent || '').trim();
          break;
        }
      }
      
      // Look for attachment indicators in the conversation preview
      const previewSelectors = [
        '.msg-conversation-listitem__participant-msg',
        '.msg-conversation-listitem__message-snippet',
        '[class*="message-preview"]',
        '[class*="snippet"]'
      ];
      
      let previewText = '';
      for (const sel of previewSelectors) {
        const previewEl = conv.querySelector(sel);
        if (previewEl) {
          previewText = (previewEl.innerText || previewEl.textContent || '').toLowerCase();
          conversationInfo.previewText = previewText;
          break;
        }
      }
      
      // Check for attachment indicators
      const attachmentKeywords = [
        'sent an attachment',
        'attached',
        '.pdf',
        'resume',
        'cv',
        'document',
        'file',
        'download'
      ];
      
      attachmentKeywords.forEach(keyword => {
        if (previewText.includes(keyword)) {
          conversationInfo.hasAttachment = true;
          conversationInfo.attachmentIndicators.push(keyword);
        }
      });
      
      // Also check for paperclip icons or download icons
      const iconSelectors = [
        '[data-test-icon*="paperclip"]',
        '[class*="paperclip"]',
        '[class*="attachment"]',
        'svg[class*="attachment"]'
      ];
      
      iconSelectors.forEach(selector => {
        if (conv.querySelector(selector)) {
          conversationInfo.hasAttachment = true;
          conversationInfo.attachmentIndicators.push('attachment_icon');
        }
      });
      
      if (conversationInfo.hasAttachment) {
        conversationsWithAttachments.push(conversationInfo);
      }
    });
    
    console.log('📊 Scan complete. Found', conversationsWithAttachments.length, 'conversations with attachment indicators');
    return conversationsWithAttachments;
  });
}

// Main execution
(async () => {
  log('🚀 ATTACHMENT SCANNER: Finding conversations with resumes');
  log('========================================================');
  
  const browser = await playwright.chromium.launch({ 
    headless: !args.headful, 
    slowMo: Number(args.slowMo) 
  });
  
  const context = await browser.newContext({
    storageState: args.auth
  });

  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  try {
    log('📱 Opening LinkedIn Messaging...');
    await page.goto("https://www.linkedin.com/messaging/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);

    if (/\/login|checkpoint/.test(page.url())) {
      log("❌ Not logged in");
      await browser.close();
      process.exit(1);
    }

    // Wait for conversations to load
    await page.waitForSelector('li.msg-conversation-listitem', { timeout: 10000 });
    
    // Scroll to load more conversations
    log('📜 Loading all conversations...');
    const conversationList = await page.$('.msg-conversations-container__conversations-list');
    if (conversationList) {
      for (let i = 0; i < 5; i++) {
        await conversationList.evaluate(el => el.scrollBy(0, el.scrollHeight));
        await page.waitForTimeout(1000);
      }
    }
    
    await page.waitForTimeout(2000);

    // Scan for attachments
    log('🔍 Scanning conversations for attachment indicators...');
    const attachmentConversations = await scanForAttachmentConversations(page);
    
    log(`\n${"=".repeat(60)}`);
    log(`📊 SCAN RESULTS:`);
    log(`   • Total conversations scanned: ${await page.$$eval('li.msg-conversation-listitem', els => els.length)}`);
    log(`   • Conversations with attachment indicators: ${attachmentConversations.length}`);
    
    if (attachmentConversations.length > 0) {
      log(`\n🎯 CONVERSATIONS WITH ATTACHMENTS:`);
      attachmentConversations.forEach((conv, index) => {
        log(`\n   [${index + 1}] ${conv.name}`);
        log(`      📎 Indicators: ${conv.attachmentIndicators.join(', ')}`);
        log(`      📝 Preview: ${conv.previewText.substring(0, 100)}...`);
      });
      
      log(`\n💡 COMMANDS TO DOWNLOAD:`);
      log(`   node scripts/step9_fixed_resume_download.js --headful --confirm=true --max=${attachmentConversations.length}`);
      log(`\n🎯 TARGET THESE SPECIFIC CONVERSATIONS:`);
      attachmentConversations.forEach((conv, index) => {
        log(`   ${index + 1}. ${conv.name}`);
      });
    } else {
      log(`\n⚠️  No conversations with attachment indicators found.`);
      log(`   • Clients may not have sent resumes yet`);
      log(`   • Or resumes might be in archived conversations`);
      log(`   • Or attachment detection needs adjustment`);
    }

    await browser.close();

  } catch (e) {
    console.error("❌ Error:", e);
    await browser.close();
    process.exit(1);
  }
})();
