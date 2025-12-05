// scripts/diagnose_attachments.js
// Diagnostic script to find where resume attachments are in LinkedIn
const playwright = require('playwright');
const fs = require('fs');

(async () => {
  console.log('🔍 LINKEDIN ATTACHMENT DIAGNOSTIC TOOL\n');
  console.log('='.repeat(60));
  console.log('This will help us find where resume attachments are hiding\n');
  
  const browser = await playwright.chromium.launch({ 
    headless: false,
    slowMo: 300
  });
  
  const context = await browser.newContext({
    storageState: 'auth_state.json'
  });

  const page = await context.newPage();

  try {
    console.log('📱 Opening LinkedIn Messaging...');
    await page.goto("https://www.linkedin.com/messaging/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    
    console.log('📊 Looking for conversations...\n');
    const threads = await page.$$('li.msg-conversation-listitem');
    console.log(`Found ${threads.length} conversations\n`);
    
    // Process first 3 conversations
    for (let i = 0; i < Math.min(3, threads.length); i++) {
      const thread = threads[i];
      
      const name = await thread.evaluate(e => {
        const sels = ['h3.msg-conversation-listitem__participant-names', 'h3 span'];
        for (const s of sels) {
          const n = e.querySelector(s);
          if (n) return (n.innerText || '').trim();
        }
        return null;
      });
      
      if (!name) continue;
      
      console.log('━'.repeat(60));
      console.log(`🔍 ANALYZING: ${name}`);
      console.log('━'.repeat(60));
      
      // Click to open conversation
      await thread.click();
      await page.waitForTimeout(3000);
      
      // Scroll messages
      console.log('   📜 Scrolling messages...');
      await page.evaluate(async () => {
        const list = document.querySelector('.msg-s-message-list__list');
        if (list) {
          list.scrollTop = 0;
          await new Promise(r => setTimeout(r, 500));
          for (let i = 0; i < 5; i++) {
            list.scrollTop = list.scrollHeight;
            await new Promise(r => setTimeout(r, 500));
          }
        }
      });
      await page.waitForTimeout(2000);
      
      // COMPREHENSIVE ATTACHMENT SEARCH
      const analysis = await page.evaluate(() => {
        const results = {
          buttons: [],
          links: [],
          fileElements: [],
          textMatches: [],
          dataAttributes: [],
          ariaLabels: []
        };
        
        // 1. Find ALL buttons
        const allButtons = document.querySelectorAll('button');
        allButtons.forEach((btn, idx) => {
          const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();
          const ariaLabel = btn.getAttribute('aria-label') || '';
          const isVisible = btn.offsetParent !== null;
          
          if ((text.includes('download') || 
               text.includes('.pdf') ||
               ariaLabel.toLowerCase().includes('download')) && isVisible) {
            results.buttons.push({
              index: idx,
              text: text.substring(0, 100),
              ariaLabel: ariaLabel.substring(0, 100),
              className: btn.className,
              visible: isVisible
            });
          }
        });
        
        // 2. Find ALL links
        const allLinks = document.querySelectorAll('a');
        allLinks.forEach((link, idx) => {
          const href = link.href || '';
          const text = (link.innerText || '').trim().toLowerCase();
          const isVisible = link.offsetParent !== null;
          
          if ((href.includes('.pdf') || 
               href.includes('download') ||
               text.includes('download') ||
               text.includes('.pdf')) && isVisible) {
            results.links.push({
              index: idx,
              href: href.substring(0, 100),
              text: text.substring(0, 100),
              className: link.className,
              visible: isVisible
            });
          }
        });
        
        // 3. Find file-related elements
        const fileKeywords = ['attachment', 'file', 'document', 'resume', 'cv'];
        const allElements = document.querySelectorAll('[class*="msg-s-event"]');
        allElements.forEach((el, idx) => {
          const className = el.className || '';
          const text = (el.innerText || el.textContent || '').trim();
          
          if (fileKeywords.some(keyword => className.toLowerCase().includes(keyword))) {
            results.fileElements.push({
              index: idx,
              className: className,
              text: text.substring(0, 200),
              hasButton: !!el.querySelector('button'),
              hasLink: !!el.querySelector('a')
            });
          }
        });
        
        // 4. Find data attributes
        const elementsWithData = document.querySelectorAll('[data-test-file-download-button], [data-file], [data-attachment]');
        elementsWithData.forEach((el, idx) => {
          const visible = el.offsetParent !== null;
          results.dataAttributes.push({
            index: idx,
            dataTest: el.getAttribute('data-test-file-download-button'),
            dataFile: el.getAttribute('data-file'),
            dataAttachment: el.getAttribute('data-attachment'),
            tagName: el.tagName,
            visible: visible
          });
        });
        
        // 5. Search aria-labels
        const elementsWithAria = document.querySelectorAll('[aria-label*="download" i], [aria-label*="Download" i], [aria-label*="file" i]');
        elementsWithAria.forEach((el, idx) => {
          results.ariaLabels.push({
            index: idx,
            ariaLabel: el.getAttribute('aria-label'),
            tagName: el.tagName,
            visible: el.offsetParent !== null
          });
        });
        
        // 6. Look for PDF/resume text
        const allText = document.body.innerText || '';
        const pdfMatches = allText.match(/\b\w+\.pdf\b/gi) || [];
        const resumeMatches = allText.match(/resume|cv|curriculum vitae/gi) || [];
        
        results.textMatches = {
          pdfFiles: [...new Set(pdfMatches)].slice(0, 10),
          resumeKeywords: resumeMatches.length
        };
        
        return results;
      });
      
      // Print results
      console.log('\n   📊 RESULTS:');
      console.log(`   • Buttons with "download": ${analysis.buttons.length}`);
      if (analysis.buttons.length > 0) {
        analysis.buttons.forEach((btn, idx) => {
          console.log(`     [${idx+1}] Text: "${btn.text}"`);
          console.log(`         Aria: "${btn.ariaLabel}"`);
          console.log(`         Class: ${btn.className.substring(0, 50)}`);
        });
      }
      
      console.log(`\n   • Links with "download": ${analysis.links.length}`);
      if (analysis.links.length > 0) {
        analysis.links.forEach((link, idx) => {
          console.log(`     [${idx+1}] Text: "${link.text}"`);
          console.log(`         Href: ${link.href}`);
        });
      }
      
      console.log(`\n   • File-related elements: ${analysis.fileElements.length}`);
      if (analysis.fileElements.length > 0) {
        analysis.fileElements.forEach((el, idx) => {
          console.log(`     [${idx+1}] Class: ${el.className.substring(0, 50)}`);
          console.log(`         Text: ${el.text.substring(0, 100)}`);
          console.log(`         Has button: ${el.hasButton}, Has link: ${el.hasLink}`);
        });
      }
      
      console.log(`\n   • Data attributes: ${analysis.dataAttributes.length}`);
      if (analysis.dataAttributes.length > 0) {
        analysis.dataAttributes.forEach((el, idx) => {
          console.log(`     [${idx+1}] ${el.tagName}`);
          console.log(`         data-test: ${el.dataTest}`);
          console.log(`         Visible: ${el.visible}`);
        });
      }
      
      console.log(`\n   • Aria labels: ${analysis.ariaLabels.length}`);
      if (analysis.ariaLabels.length > 0) {
        analysis.ariaLabels.forEach((el, idx) => {
          console.log(`     [${idx+1}] ${el.tagName}: ${el.ariaLabel}`);
        });
      }
      
      console.log(`\n   • Text matches:`);
      console.log(`     PDF files: ${analysis.textMatches.pdfFiles.join(', ')}`);
      console.log(`     Resume keywords: ${analysis.textMatches.resumeKeywords} occurrences`);
      
      // Take screenshot
      const screenshotPath = `diagnostic_${name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`\n   📸 Screenshot saved: ${screenshotPath}`);
      
      console.log('\n');
    }
    
    console.log('='.repeat(60));
    console.log('✅ DIAGNOSTIC COMPLETE');
    console.log('='.repeat(60));
    console.log('\n📋 Next steps:');
    console.log('1. Review the output above');
    console.log('2. Check the screenshots');
    console.log('3. Look for conversations that DO have resume attachments');
    console.log('4. Share the output with me to fix the detection logic\n');
    
    console.log('Press Ctrl+C to close...');
    await page.waitForTimeout(60000); // Wait 1 minute before closing
    
  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await browser.close();
  }
})();