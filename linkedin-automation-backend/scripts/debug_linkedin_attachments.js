// DEBUG SCRIPT: Understand LinkedIn attachment DOM structure
// Run: node scripts/debug_linkedin_attachments.js --name="Candidate Name"

const { chromium } = require('playwright');
const minimist = require('minimist');

const args = minimist(process.argv.slice(2), {
  string: ["auth", "name"],
  default: {
    auth: "auth_state.json",
    name: ""
  }
});

(async () => {
  console.log('\n🔍 LINKEDIN ATTACHMENT DOM DEBUG');
  console.log('='.repeat(60));
  
  if (!args.name) {
    console.log('❌ Usage: node scripts/debug_linkedin_attachments.js --name="Candidate Name"');
    process.exit(1);
  }
  
  console.log(`🎯 Testing conversation: "${args.name}"\n`);
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 100 
  });
  
  const context = await browser.newContext({
    storageState: args.auth,
    acceptDownloads: true
  });
  
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  
  try {
    console.log('📱 Opening LinkedIn Messaging...');
    await page.goto("https://www.linkedin.com/messaging/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    
    if (/\/login|checkpoint/.test(page.url())) {
      console.log('❌ Not logged in!');
      process.exit(1);
    }
    
    // Find the conversation
    console.log('🔍 Finding conversation...');
    const threads = await page.$$('li.msg-conversation-listitem');
    
    let foundThread = null;
    for (const thread of threads) {
      const nameEl = await thread.$('h3.msg-conversation-listitem__participant-names, .msg-conversation-listitem__participant-names');
      if (nameEl) {
        const name = await nameEl.innerText();
        console.log(`   Found: "${name}"`);
        if (name.includes(args.name.split(' ')[0])) { // Match first name
          foundThread = thread;
          console.log(`   ✅ Matched!\n`);
          break;
        }
      }
    }
    
    if (!foundThread) {
      console.log(`\n❌ Conversation not found. Listing all conversations:\n`);
      for (const thread of threads.slice(0, 10)) {
        const nameEl = await thread.$('h3.msg-conversation-listitem__participant-names, .msg-conversation-listitem__participant-names');
        if (nameEl) {
          const name = await nameEl.innerText();
          console.log(`   - "${name}"`);
        }
      }
      await browser.close();
      process.exit(1);
    }
    
    // Open the conversation
    console.log('📂 Opening conversation...');
    await foundThread.click();
    await page.waitForTimeout(3000);
    
    // Scroll to load all messages
    console.log('📜 Loading all messages...');
    await page.evaluate(async () => {
      const list = document.querySelector('.msg-s-message-list__list');
      if (list) {
        list.scrollTop = 0;
        await new Promise(r => setTimeout(r, 500));
        for (let i = 0; i < 10; i++) {
          list.scrollTop = list.scrollHeight;
          await new Promise(r => setTimeout(r, 500));
        }
      }
    });
    await page.waitForTimeout(2000);
    
    // Deep DOM analysis
    console.log('\n📊 DEEP DOM ANALYSIS');
    console.log('-'.repeat(60));
    
    const analysis = await page.evaluate(() => {
      const results = {
        timestamp: new Date().toISOString(),
        messageList: null,
        events: [],
        attachments: [],
        buttons: [],
        allElements: []
      };
      
      // Check if message list exists
      results.messageList = {
        exists: !!document.querySelector('.msg-s-message-list__list'),
        classes: document.querySelector('.msg-s-message-list__list')?.className || 'N/A',
        innerHTML: document.querySelector('.msg-s-message-list__list')?.innerHTML?.substring(0, 500) || 'N/A'
      };
      
      // Get ALL event items (messages)
      const eventItems = document.querySelectorAll('.msg-s-event-listitem, [class*="msg-s-event"]');
      results.events = Array.from(eventItems).slice(-5).map((el, i) => ({
        index: eventItems.length - 5 + i,
        html: el.outerHTML.substring(0, 800),
        text: el.innerText?.substring(0, 200) || '',
        classes: el.className
      }));
      
      // Look for ANY attachment-related elements
      const attachmentSelectors = [
        '.msg-s-event-listitem__download-attachment-button',
        '.msg-s-event-listitem__attachment',
        '[class*="attachment"]',
        '[class*="download"]',
        '.ui-attachment',
        '[data-test*="attachment"]',
        '[aria-label*="attachment"]'
      ];
      
      attachmentSelectors.forEach(sel => {
        const els = document.querySelectorAll(sel);
        if (els.length > 0) {
          results.allElements.push({
            selector: sel,
            count: els.length,
            sampleHTML: els[0]?.outerHTML?.substring(0, 300) || 'N/A'
          });
        }
      });
      
      // Look for PDF/document patterns in entire page
      const pageText = document.body.innerText;
      const pdfPattern = /[A-Za-z0-9\s\-_.]+\.(pdf|doc|docx|jpg|png)/gi;
      const matches = pageText.match(pdfPattern) || [];
      results.pdfFiles = [...new Set(matches)].slice(0, 10);
      
      // File size patterns
      const sizePattern = /\d+\s*(KB|MB|GB|B)/gi;
      const sizes = pageText.match(sizePattern) || [];
      results.fileSizes = [...new Set(sizes)].slice(0, 10);
      
      // All buttons in message area
      const allBtns = document.querySelectorAll('button');
      results.allButtons = Array.from(allBtns).map((btn, i) => ({
        index: i,
        aria: btn.getAttribute('aria-label') || '',
        text: btn.innerText?.substring(0, 30) || '',
        classes: btn.className
      })).filter(b => 
        b.aria.includes('download') || 
        b.aria.includes('attachment') ||
        b.text.includes('Download') ||
        b.text.includes('View') ||
        b.classes.includes('attachment')
      );
      
      return results;
    });
    
    console.log('\n1️⃣ MESSAGE LIST STATUS:');
    console.log(`   Exists: ${analysis.messageList.exists}`);
    console.log(`   Classes: ${analysis.messageList.classes}`);
    
    console.log('\n2️⃣ ATTACHMENT-RELATED ELEMENTS:');
    if (analysis.allElements.length === 0) {
      console.log('   ❌ No attachment elements found!');
    } else {
      analysis.allElements.forEach(el => {
        console.log(`   ✓ ${el.selector}: ${el.count} element(s)`);
        console.log(`     Sample: ${el.sampleHTML.substring(0, 100)}...`);
      });
    }
    
    console.log('\n3️⃣ PDF/DOC FILES MENTIONED IN PAGE:');
    if (analysis.pdfFiles.length === 0) {
      console.log('   ❌ No PDF/Doc files detected');
    } else {
      console.log(`   Found: ${analysis.pdfFiles.join(', ')}`);
    }
    
    console.log('\n4️⃣ FILE SIZES:');
    if (analysis.fileSizes.length === 0) {
      console.log('   No file sizes found');
    } else {
      console.log(`   Sizes: ${analysis.fileSizes.join(', ')}`);
    }
    
    console.log('\n5️⃣ RELEVANT BUTTONS:');
    if (analysis.allButtons.length === 0) {
      console.log('   No download/attachment buttons found');
    } else {
      analysis.allButtons.forEach((btn, i) => {
        console.log(`   [${i+1}] aria="${btn.aria}" text="${btn.text}" classes="${btn.classes}"`);
      });
    }
    
    console.log('\n6️⃣ LAST 5 MESSAGE EVENTS:');
    analysis.events.forEach((ev, i) => {
      console.log(`\n   Event ${ev.index}:`);
      console.log(`   Classes: ${ev.classes}`);
      console.log(`   Text: ${ev.text.substring(0, 100)}...`);
      console.log(`   HTML: ${ev.html.substring(0, 150)}...`);
    });
    
    // Save detailed report
    const fs = require('fs');
    const reportPath = `debug_attachments_${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(analysis, null, 2));
    console.log(`\n📄 Full report saved: ${reportPath}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('\n💡 INTERPRETATION:');
    console.log('   - If no attachment elements: Candidate mentioned resume in text but didn\'t attach');
    console.log('   - If attachment elements exist but not detected: LinkedIn UI changed, need new selectors');
    console.log('   - If PDFs mentioned but no buttons: File preview shown, need to click to download');
    
    await browser.close();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await browser.close();
    process.exit(1);
  }
})();

