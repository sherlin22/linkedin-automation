// Download a single resume from LinkedIn
// Run: node scripts/download_single_resume.js --name="Akash" 

const { chromium } = require('playwright');
const minimist = require('minimist');
const fs = require('fs');
const path = require('path');

const args = minimist(process.argv.slice(2), {
  string: ["auth", "name"],
  default: {
    auth: "auth_state.json",
    name: ""
  }
});

(async () => {
  console.log('\n📥 DOWNLOAD RESUME SCRIPT');
  console.log('='.repeat(60));
  
  if (!args.name) {
    console.log('❌ Usage: node scripts/download_single_resume.js --name="Akash"');
    process.exit(1);
  }
  
  console.log(`🎯 Looking for: "${args.name}"\n`);
  
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
    
    // Find conversation
    console.log('🔍 Finding conversation...');
    const threads = await page.$$('li.msg-conversation-listitem');
    
    let foundThread = null;
    let foundName = '';
    
    for (const thread of threads) {
      const nameEl = await thread.$('h3.msg-conversation-listitem__participant-names, .msg-conversation-listitem__participant-names');
      if (nameEl) {
        const name = await nameEl.innerText();
        if (name.toLowerCase().includes(args.name.toLowerCase())) {
          foundThread = thread;
          foundName = name;
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
    console.log('📜 Loading messages...');
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
    
    // Check for attachments
    console.log('\n🔍 Checking for attachments...\n');
    
    const attachments = await page.evaluate(() => {
      const results = [];
      
      // Find all attachment buttons
      const buttons = document.querySelectorAll('.msg-s-event-listitem__download-attachment-button');
      
      buttons.forEach((btn, i) => {
        // Get filename
        const filenameEl = btn.querySelector('.ui-attachment__filename');
        const filename = filenameEl ? filenameEl.innerText.trim() : `Attachment_${i + 1}`;
        
        // Get filesize
        const filesizeEl = btn.querySelector('.ui-attachment__filesize');
        const filesize = filesizeEl ? filesizeEl.innerText.trim() : '';
        
        // Check visibility
        const isVisible = btn.offsetParent !== null && btn.getBoundingClientRect().width > 0;
        
        results.push({
          index: i,
          filename: filename,
          filesize: filesize,
          isVisible: isVisible,
          button: btn
        });
      });
      
      return results;
    });
    
    console.log(`Found ${attachments.length} attachment(s):`);
    
    if (attachments.length === 0) {
      console.log('❌ No attachments found!');
      
      // Check if PDF is mentioned in text but no button
      const pageText = document.body.innerText;
      const pdfMatches = pageText.match(/[A-Za-z0-9\s\-_]+\.pdf/gi) || [];
      console.log(`\nPDF mentions in text: ${pdfMatches.join(', ')}`);
      
      await browser.close();
      process.exit(1);
    }
    
    // Download each attachment
    for (const att of attachments) {
      console.log(`\n📄 [${att.index + 1}] ${att.filename} (${att.filesize})`);
      console.log(`   Visible: ${att.isVisible}`);
      
      if (!att.isVisible) {
        console.log('   ⚠️  Button not visible - skipping');
        continue;
      }
      
      // Setup download
      const downloadDir = path.join(process.cwd(), 'downloads', 'resumes');
      if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir, { recursive: true });
      }
      
      console.log(`   📁 Download directory: ${downloadDir}`);
      
      // Wait for download
      const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
      
      // Click the button
      console.log('   👆 Clicking download button...');
      await att.button.click();
      
      // Wait for download
      console.log('   ⏳ Waiting for download...');
      const download = await downloadPromise.catch(err => {
        console.log(`   ❌ Download failed: ${err.message}`);
        return null;
      });
      
      if (download) {
        // Create safe filename
        const safeName = foundName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
        const ts = Date.now();
        const ext = path.extname(download.suggestedFilename()) || '.pdf';
        const saveName = `resume_${safeName}_${ts}${ext}`;
        const savePath = path.join(downloadDir, saveName);
        
        await download.saveAs(savePath);
        
        if (fs.existsSync(savePath)) {
          const stats = fs.statSync(savePath);
          console.log(`   ✅ SUCCESS!`);
          console.log(`   📍 Saved: ${savePath}`);
          console.log(`   📊 Size: ${Math.round(stats.size / 1024)} KB`);
        } else {
          console.log(`   ❌ File not found after download`);
        }
      }
      
      await page.waitForTimeout(1000);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Resume download complete!');
    console.log(`📂 Check: ${path.join(process.cwd(), 'downloads', 'resumes')}`);
    
    await browser.close();
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await browser.close();
    process.exit(1);
  }
})();

