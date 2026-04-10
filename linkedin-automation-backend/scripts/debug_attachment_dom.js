// DEBUG: Check exact DOM structure for attachments
// Run: node scripts/debug_attachment_dom.js --name="Akash" 

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
  console.log('\n🔍 DEBUG: LinkedIn Attachment DOM Detection');
  console.log('='.repeat(60));
  
  if (!args.name) {
    console.log('❌ Usage: node scripts/debug_attachment_dom.js --name="Akash"');
    process.exit(1);
  }
  
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
    
    // Find conversation containing the name
    console.log(`🔍 Looking for conversation with "${args.name}"...`);
    const threads = await page.$$('li.msg-conversation-listitem');
    
    let foundThread = null;
    for (const thread of threads) {
      const nameEl = await thread.$('h3.msg-conversation-listitem__participant-names, .msg-conversation-listitem__participant-names');
      if (nameEl) {
        const name = await nameEl.innerText();
        if (name.toLowerCase().includes(args.name.toLowerCase())) {
          foundThread = thread;
          console.log(`✅ Found: "${name}"`);
          break;
        }
      }
    }
    
    if (!foundThread) {
      console.log(`❌ Could not find conversation with "${args.name}"`);
      await browser.close();
      process.exit(1);
    }
    
    // Open conversation
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
    
    // DETAILED ATTACHMENT CHECK
    console.log('\n📊 ATTACHMENT DETECTION CHECK');
    console.log('-'.repeat(60));
    
    const results = await page.evaluate(async () => {
      const report = {
        timestamp: new Date().toISOString(),
        checks: []
      };
      
      // CHECK 1: Find all msg-s-event-listitem elements
      const events = document.querySelectorAll('.msg-s-event-listitem');
      report.checks.push({
        name: 'msg-s-event-listitem elements',
        found: events.length,
        html: events[0]?.outerHTML?.substring(0, 500) || 'None'
      });
      
      // CHECK 2: Find attachment buttons by class
      const attachmentBtns = document.querySelectorAll('.msg-s-event-listitem__download-attachment-button');
      report.checks.push({
        name: 'msg-s-event-listitem__download-attachment-button',
        found: attachmentBtns.length,
        sampleHTML: attachmentBtns[0]?.outerHTML?.substring(0, 500) || 'None'
      });
      
      // CHECK 3: Find ui-attachment elements
      const uiAttachments = document.querySelectorAll('.ui-attachment');
      report.checks.push({
        name: 'ui-attachment elements',
        found: uiAttachments.length,
        sampleHTML: uiAttachments[0]?.outerHTML?.substring(0, 500) || 'None'
      });
      
      // CHECK 4: Find filename elements
      const filenames = document.querySelectorAll('.ui-attachment__filename');
      const filenameTexts = Array.from(filenames).map(el => el.innerText.trim());
      report.checks.push({
        name: 'ui-attachment__filename',
        found: filenames.length,
        texts: filenameTexts.slice(0, 5)
      });
      
      // CHECK 5: Find filesize elements
      const filesizes = document.querySelectorAll('.ui-attachment__filesize');
      const filesizeTexts = Array.from(filesizes).map(el => el.innerText.trim());
      report.checks.push({
        name: 'ui-attachment__filesize',
        found: filesizes.length,
        texts: filesizeTexts.slice(0, 5)
      });
      
      // CHECK 6: Check if elements are visible
      const visibilityCheck = await page.evaluate(() => {
        const btns = document.querySelectorAll('.msg-s-event-listitem__download-attachment-button');
        const visible = [];
        btns.forEach((btn, i) => {
          const rect = btn.getBoundingClientRect();
          visible.push({
            index: i,
            visible: rect.width > 0 && rect.height > 0,
            offsetParent: btn.offsetParent !== null,
            display: window.getComputedStyle(btn).display,
            visibility: window.getComputedStyle(btn).visibility
          });
        });
        return visible;
      });
      report.checks.push({
        name: 'Button visibility check',
        results: visibilityCheck
      });
      
      // CHECK 7: Look for PDF in entire page text
      const pageText = document.body.innerText;
      const pdfMatches = pageText.match(/[A-Za-z0-9\s\-_]+\.pdf/gi) || [];
      report.checks.push({
        name: 'PDF filenames in page text',
        found: pdfMatches.length,
        filenames: [...new Set(pdfMatches)].slice(0, 5)
      });
      
      // CHECK 8: Look for "Download" text buttons
      const downloadBtns = [];
      document.querySelectorAll('button').forEach((btn, i) => {
        const text = btn.innerText || '';
        if (text.includes('Download')) {
          downloadBtns.push({
            index: i,
            text: text.substring(0, 50),
            classes: btn.className
          });
        }
      });
      report.checks.push({
        name: 'Buttons with "Download" text',
        found: downloadBtns.length,
        samples: downloadBtns.slice(0, 3)
      });
      
      return report;
    });
    
    // Print results
    results.checks.forEach(check => {
      console.log(`\n📌 ${check.name}:`);
      console.log(`   Found: ${check.found}`);
      
      if (check.texts && check.texts.length > 0) {
        console.log(`   Values: ${check.texts.join(', ')}`);
      }
      if (check.filenames && check.filenames.length > 0) {
        console.log(`   Files: ${check.filenames.join(', ')}`);
      }
      if (check.samples && check.samples.length > 0) {
        console.log(`   Samples: ${JSON.stringify(check.samples.slice(0, 2))}`);
      }
      if (check.results && check.results.length > 0) {
        console.log(`   Visibility: ${JSON.stringify(check.results[0])}`);
      }
    });
    
    // Final verdict
    console.log('\n' + '='.repeat(60));
    console.log('\n🔍 VERDICT:');
    
    const btnCount = results.checks.find(c => c.name.includes('download-attachment-button'))?.found || 0;
    const filenameCount = results.checks.find(c => c.name.includes('filename'))?.found || 0;
    
    if (btnCount > 0 && filenameCount > 0) {
      console.log('✅ ATTACHMENTS SHOULD BE DETECTABLE!');
      console.log(`   Found ${btnCount} buttons and ${filenameCount} filenames`);
      console.log('\n💡 If STEP9 is not detecting them, check:');
      console.log('   - Are elements being filtered by offsetParent === null?');
      console.log('   - Is there a timing issue with page.waitForTimeout?');
    } else if (filenameCount > 0 && btnCount === 0) {
      console.log('⚠️  Filenames found but buttons NOT found!');
      console.log('   This means LinkedIn might be using a different UI structure.');
      console.log('\n💡 Need to update selectors - look for alternative button patterns.');
    } else {
      console.log('❌ NO ATTACHMENTS FOUND in this conversation.');
      console.log('   Either the conversation has no attachments,');
      console.log('   or LinkedIn is using a completely different DOM structure.');
    }
    
    // Save full report
    const fs = require('fs');
    const fsPath = require('path');
    const reportPath = fsPath.join(process.cwd(), 'debug_attachment_dom.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n📄 Full report saved: ${reportPath}`);
    
    await browser.close();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await browser.close();
    process.exit(1);
  }
})();

