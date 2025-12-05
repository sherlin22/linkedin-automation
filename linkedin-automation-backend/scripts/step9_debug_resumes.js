const fs = require("fs");
const path = require("path");
const minimist = require("minimist");
const playwright = require("playwright");

require('dotenv').config();

const args = minimist(process.argv.slice(2), {
  string: ["auth", "browser", "slowMo"],
  boolean: ["headful"],
  default: {
    auth: "auth_state.json",
    browser: "chromium",
    headful: true,
    slowMo: "150"
  }
});

function log(...a) { console.log(...a); }

// Enhanced attachment detection
async function debugFindAttachments(page, conversationName, thread) {
  log(`\n🔍 DEBUGGING: ${conversationName}`);
  
  try {
    // Click the conversation using the thread element
    await thread.click();
    await page.waitForTimeout(4000);
    
    // Multiple scrolling strategies to load all messages
    log(`   📜 Scrolling to load all messages...`);
    
    // Try multiple scroll strategies
    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => {
        const messageList = document.querySelector('.msg-s-message-list__list, .msg-s-message-list-content, [class*="message-list"]');
        if (messageList) {
          messageList.scrollTop = messageList.scrollHeight;
        } else {
          // Fallback to window scrolling
          window.scrollTo(0, document.body.scrollHeight);
        }
      });
      await page.waitForTimeout(1000);
    }
    
    // Wait for any lazy loading
    await page.waitForTimeout(3000);
    
    // Take screenshot for debugging
    const safeName = conversationName.replace(/[^a-zA-Z0-9]/g, '_');
    await page.screenshot({ path: `debug_${safeName}.png`, fullPage: true });
    log(`   📸 Screenshot saved: debug_${safeName}.png`);
    
    // Enhanced detection with multiple strategies
    const attachments = await page.evaluate(() => {
      console.log('🔍 DEBUG: Starting comprehensive attachment scan...');
      
      // Get all visible text content first
      const allText = document.body.innerText;
      console.log('Page text sample:', allText.substring(0, 500));
      
      const allElements = Array.from(document.querySelectorAll('*'));
      const potentialAttachments = [];
      
      // Strategy 1: Look for file-related text anywhere on page
      const fileKeywords = ['pdf', 'doc', 'docx', 'download', 'attachment', 'file', 'resume', 'cv', 'document'];
      
      fileKeywords.forEach(keyword => {
        const elementsWithKeyword = allElements.filter(el => {
          const text = (el.innerText || el.textContent || '').toLowerCase();
          return text.includes(keyword) && text.length < 1000;
        });
        
        elementsWithKeyword.forEach(el => {
          const text = (el.innerText || el.textContent || '').trim();
          if (text && !potentialAttachments.some(att => att.text === text)) {
            potentialAttachments.push({
              type: 'keyword_' + keyword,
              text: text,
              element: el
            });
          }
        });
      });
      
      // Strategy 2: Look for specific LinkedIn attachment elements
      const linkedInSelectors = [
        '.msg-s-event-listitem__attachment',
        '.msg-s-message-list__attachment',
        '[data-test-file-attachment]',
        '.file-attachment',
        '.attachment-item',
        'button[aria-label*="download"]',
        'button[aria-label*="file"]',
        'a[href*=".pdf"]',
        'a[href*=".doc"]',
        'a[href*=".docx"]'
      ];
      
      linkedInSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          const text = (el.innerText || el.textContent || '').trim();
          if (text && !potentialAttachments.some(att => att.text === text)) {
            potentialAttachments.push({
              type: 'selector_' + selector,
              text: text,
              element: el
            });
          }
        });
      });
      
      // Strategy 3: Look for buttons and links with file patterns
      const interactiveElements = allElements.filter(el => {
        const tag = el.tagName.toLowerCase();
        const isInteractive = tag === 'button' || tag === 'a' || el.getAttribute('role') === 'button';
        if (!isInteractive) return false;
        
        const text = (el.innerText || el.textContent || '').toLowerCase();
        const hasFile = /\.(pdf|doc|docx)/i.test(text);
        const hasDownload = text.includes('download');
        const hasFileWords = text.includes('file') || text.includes('attachment');
        
        return hasFile || hasDownload || hasFileWords;
      });
      
      interactiveElements.forEach(el => {
        const text = (el.innerText || el.textContent || '').trim();
        if (text && !potentialAttachments.some(att => att.text === text)) {
          potentialAttachments.push({
            type: 'interactive',
            text: text,
            element: el
          });
        }
      });
      
      console.log(`🔍 DEBUG: Found ${potentialAttachments.length} potential attachments`);
      potentialAttachments.forEach((finding, index) => {
        console.log(`   [${index}] ${finding.type}: "${finding.text}"`);
      });
      
      return potentialAttachments;
    });
    
    if (attachments.length > 0) {
      log(`   ✅ FOUND ${attachments.length} POTENTIAL ATTACHMENTS:`);
      attachments.forEach((att, idx) => {
        log(`      [${idx}] ${att.type}: ${att.text.substring(0, 100)}`);
      });
      
      // Try to click the first promising attachment
      const promisingAttachment = attachments.find(att => 
        att.text.toLowerCase().includes('.pdf') || 
        att.text.toLowerCase().includes('.doc') ||
        att.text.toLowerCase().includes('download')
      );
      
      if (promisingAttachment) {
        log(`   🖱️  Testing click on promising attachment: ${promisingAttachment.text.substring(0, 50)}...`);
        try {
          await promisingAttachment.element.scrollIntoViewIfNeeded();
          await page.waitForTimeout(1000);
          await promisingAttachment.element.click();
          await page.waitForTimeout(3000);
          
          // Check what happened after click
          const currentUrl = page.url();
          if (currentUrl.includes('.pdf') || currentUrl.includes('.doc')) {
            log(`   📥 Download page opened: ${currentUrl}`);
          } else {
            log(`   ℹ️  Click resulted in: ${currentUrl}`);
          }
        } catch (e) {
          log(`   ⚠️  Click failed: ${e.message}`);
        }
      }
    } else {
      log(`   ❌ NO ATTACHMENTS FOUND`);
      
      // Debug: Show what's actually in the conversation
      const conversationContent = await page.evaluate(() => {
        // Get all message bubbles
        const messages = Array.from(document.querySelectorAll('.msg-s-event-listitem, [class*="message"], [class*="msg"]'));
        const messageData = messages.map(msg => {
          const text = (msg.innerText || msg.textContent || '').trim();
          const html = msg.outerHTML.substring(0, 200); // First 200 chars of HTML
          return { text, html };
        }).filter(data => data.text.length > 0);
        
        return messageData.slice(0, 15); // First 15 messages
      });
      
      log(`   📝 Conversation content (first 15 messages):`);
      conversationContent.forEach((data, idx) => {
        log(`      [${idx}] Text: ${data.text.substring(0, 100)}...`);
        if (data.text.toLowerCase().includes('file') || data.text.toLowerCase().includes('attach')) {
          log(`          ⚠️  Contains file/attachment keywords!`);
        }
      });
    }
    
    return attachments.length > 0;
    
  } catch (error) {
    log(`   ❌ Error debugging conversation: ${error.message}`);
    return false;
  }
}

// Get conversation name from thread element
async function getConversationName(thread) {
  try {
    return await thread.evaluate(el => {
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
      return 'Unknown';
    });
  } catch (e) {
    return 'Unknown';
  }
}

// Main execution
(async () => {
  const browser = await playwright.chromium.launch({ 
    headless: !args.headful, 
    slowMo: Number(args.slowMo) 
  });
  
  const context = await browser.newContext({
    storageState: args.auth,
    acceptDownloads: true
  });

  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  page.on('console', msg => {
    if (msg.type() === 'log') log(`   [PAGE]: ${msg.text()}`);
  });

  try {
    log('📱 Opening LinkedIn Messaging...');
    await page.goto("https://www.linkedin.com/messaging/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);

    if (/\/login|checkpoint/.test(page.url())) {
      log("❌ Not logged in.");
      await browser.close();
      process.exit(1);
    }

    // Wait for conversations to load
    await page.waitForSelector('li.msg-conversation-listitem', { timeout: 10000 });
    const threads = await page.$$('li.msg-conversation-listitem');
    
    log(`📊 Found ${threads.length} conversations`);
    
    // Debug first 3 conversations
    const debugCount = Math.min(3, threads.length);
    for (let i = 0; i < debugCount; i++) {
      const thread = threads[i];
      const name = await getConversationName(thread);
      
      log(`\n${'='.repeat(60)}`);
      log(`DEBUGGING CONVERSATION ${i + 1}/${debugCount}: ${name}`);
      
      await debugFindAttachments(page, name, thread);
      
      // Go back to conversation list
      await page.goto("https://www.linkedin.com/messaging/", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);
      
      // Re-fetch threads (page might have changed)
      await page.waitForSelector('li.msg-conversation-listitem', { timeout: 10000 });
      threads = await page.$$('li.msg-conversation-listitem');
    }

    await browser.close();
    log(`\n✨ Debug complete! Check the screenshots and logs above.`);

  } catch (e) {
    console.error("❌ Error:", e);
    await browser.close();
    process.exit(1);
  }
})();