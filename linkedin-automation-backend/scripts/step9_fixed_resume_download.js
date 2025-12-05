//step9_fixed_resume_download.js 
const fs = require("fs");
const path = require("path");
const minimist = require("minimist");
const playwright = require("playwright");

const args = minimist(process.argv.slice(2), {
  string: ["auth", "state", "browser", "slowMo"],
  boolean: ["headful", "confirm"],
  default: {
    auth: "auth_state.json",
    state: "resume_processing_state.json",
    browser: "chromium",
    headful: true,
    confirm: false,
    slowMo: "150",
    max: 5
  }
});

args.max = Number(args.max) || 5;

let RESUME_STATE = { processed: [] };

function log(...a) { console.log(...a); }

function loadResumeState() {
  try {
    if (args.state && fs.existsSync(args.state)) {
      RESUME_STATE = JSON.parse(fs.readFileSync(args.state, "utf8"));
      log('📁 Loaded resume state:', RESUME_STATE.processed?.length || 0, 'processed');
    }
  } catch (e) {
    RESUME_STATE = { processed: [] };
  }
}

function saveResumeState() {
  try {
    fs.writeFileSync(args.state, JSON.stringify(RESUME_STATE, null, 2), "utf8");
  } catch (e) {
    log('❌ Failed to save state');
  }
}

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

// FIXED: Better attachment detection that finds REAL download buttons
async function findRealAttachments(page) {
  return await page.evaluate(() => {
    console.log('🔍 FIXED: Looking for REAL download buttons...');
    
    const downloadButtons = [];
    
    // Strategy 1: Look for actual download buttons with proper selectors
    const buttonSelectors = [
      '.msg-s-event-listitem__download-attachment-button',
      'button[aria-label*="download" i]',
      'button[aria-label*="attachment" i]',
      '[data-test-download-attachment]',
      'button:has(svg)',
      'button[class*="download"]',
      'button[class*="attachment"]'
    ];
    
    buttonSelectors.forEach(selector => {
      const buttons = Array.from(document.querySelectorAll(selector));
      buttons.forEach(btn => {
        if (btn.offsetParent !== null) { // Visible check
          const text = (btn.innerText || btn.textContent || '').toLowerCase();
          const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
          
          if (text.includes('download') || ariaLabel.includes('download') || 
              text.includes('attachment') || ariaLabel.includes('attachment')) {
            downloadButtons.push({
              element: btn,
              type: 'download_button',
              text: text,
              ariaLabel: ariaLabel,
              selector: selector,
              confidence: 'HIGH'
            });
          }
        }
      });
    });
    
    // Strategy 2: Look for file cards with download actions
    const fileCards = Array.from(document.querySelectorAll('[class*="attachment"], [class*="file"]'));
    fileCards.forEach(card => {
      const text = (card.innerText || card.textContent || '').toLowerCase();
      if (text.includes('.pdf') || text.includes('kb') || text.includes('mb')) {
        // Find download button within this card
        const downloadBtn = card.querySelector('button');
        if (downloadBtn && downloadBtn.offsetParent !== null) {
          downloadButtons.push({
            element: downloadBtn,
            type: 'file_card_button',
            text: text.substring(0, 100),
            confidence: 'MEDIUM'
          });
        }
      }
    });
    
    console.log('✅ Found', downloadButtons.length, 'real download buttons');
    return downloadButtons;
  });
}

// FIXED: Better download function
async function downloadResumeFile(page, clientName) {
  try {
    const downloadsDir = path.join(process.cwd(), 'downloads', 'resumes');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    log(`   🔍 Looking for download buttons...`);
    
    // Wait a bit for page to settle
    await page.waitForTimeout(2000);
    
    // Find REAL download buttons (not text messages)
    const downloadButtons = await findRealAttachments(page);
    
    if (downloadButtons.length === 0) {
      log(`   ⚠️  No download buttons found`);
      return null;
    }
    
    log(`   ✅ Found ${downloadButtons.length} download button(s)`);
    
    // Set up download listener BEFORE clicking
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
    
    // Try each download button
    for (const buttonInfo of downloadButtons) {
      try {
        log(`   🖱️  Clicking download button: ${buttonInfo.type}`);
        
        // Click the button
        await buttonInfo.element.click();
        
        // Wait for download to start
        let download;
        try {
          download = await downloadPromise;
          log(`   📥 Download started: ${download.suggestedFilename()}`);
        } catch (e) {
          log(`   ⏱️  Download timeout, trying next button...`);
          continue;
        }
        
        // Create safe filename
        const safeName = clientName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
        const timestamp = Date.now();
        const originalExt = path.extname(download.suggestedFilename()) || '.pdf';
        const fileName = `resume_${safeName}_${timestamp}${originalExt}`;
        const savePath = path.join(downloadsDir, fileName);
        
        // Save the file
        await download.saveAs(savePath);
        
        // Verify download
        if (fs.existsSync(savePath)) {
          const stats = fs.statSync(savePath);
          const fileSizeKB = Math.round(stats.size / 1024);
          
          log(`   ✅ SUCCESS: Downloaded ${fileName} (${fileSizeKB} KB)`);
          
          return {
            localPath: savePath,
            fileName: fileName,
            originalName: download.suggestedFilename(),
            size: stats.size,
            sizeKB: fileSizeKB,
            extension: originalExt.toLowerCase(),
            timestamp: new Date().toISOString()
          };
        }
        
      } catch (clickError) {
        log(`   ⚠️  Button click failed: ${clickError.message}`);
        continue;
      }
    }
    
    log(`   ❌ All download attempts failed`);
    return null;
    
  } catch (e) {
    log(`   ❌ Download failed:`, e.message);
    return null;
  }
}

// Simple test workflow (without AI/Google integration for now)
async function testResumeWorkflow(page, fileInfo, clientName) {
  log(`   🔄 Testing workflow for: ${clientName}`);
  log(`   📁 File: ${fileInfo.fileName} (${fileInfo.sizeKB} KB)`);
  log(`   📍 Location: ${fileInfo.localPath}`);
  
  // For now, just verify the file exists and is readable
  if (fs.existsSync(fileInfo.localPath)) {
    log(`   ✅ File verified and ready for processing`);
    return {
      success: true,
      clientName: clientName,
      fileInfo: fileInfo,
      stages: {
        downloaded: true,
        ready_for_ai: true,
        ready_for_drive: true,
        ready_for_email: true
      }
    };
  } else {
    log(`   ❌ File not found`);
    return { success: false };
  }
}

// Main execution
(async () => {
  loadResumeState();
  
  log('🚀 STEP 9 FIXED: Resume Download Test');
  log('=====================================');
  
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

  try {
    log('📱 Opening LinkedIn Messaging...');
    await page.goto("https://www.linkedin.com/messaging/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);

    if (/\/login|checkpoint/.test(page.url())) {
      log("❌ Not logged in");
      await browser.close();
      process.exit(1);
    }

    // Get conversations
    const threads = await page.$$('li.msg-conversation-listitem');
    log(`📊 Found ${threads.length} conversations`);
    
    let processed = 0;
    let downloadsAttempted = 0;
    let downloadsSuccessful = 0;

    // Check recent conversations for attachments
    for (const thread of threads.slice(0, args.max)) {
      const name = await getConversationName(thread);
      if (!name) {
        processed++;
        continue;
      }
      
      // Skip if already processed
      if (RESUME_STATE.processed.includes(name)) {
        log(`⏭️  Already processed: ${name}`);
        processed++;
        continue;
      }

      log(`\n🔍 Checking: ${name}`);
      await thread.click();
      await page.waitForTimeout(3000);

      // Scroll to load messages
      await page.evaluate(async () => {
        const messageList = document.querySelector('.msg-s-message-list__list');
        if (messageList) {
          for (let i = 0; i < 3; i++) {
            messageList.scrollTop = messageList.scrollHeight;
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      });
      await page.waitForTimeout(2000);

      // Try to download any attachments
      if (args.confirm) {
        const downloadResult = await downloadResumeFile(page, name);
        
        if (downloadResult) {
          downloadsAttempted++;
          downloadsSuccessful++;
          
          // Test the workflow
          const workflowResult = await testResumeWorkflow(page, downloadResult, name);
          
          if (workflowResult.success) {
            log(`   🎉 READY FOR FULL AUTOMATION: ${name}`);
            
            // Update state
            if (!RESUME_STATE.processed) RESUME_STATE.processed = [];
            RESUME_STATE.processed.push(name);
            saveResumeState();
          }
        } else {
          downloadsAttempted++;
          log(`   ❌ No downloadable attachments found`);
        }
      } else {
        log(`   💡 Dry run - would check for attachments`);
        downloadsAttempted++;
      }

      processed++;
      await page.waitForTimeout(2000);
    }

    // Final Summary
    log(`\n${"=".repeat(50)}`);
    log(`🏁 STEP 9 FIXED - RESULTS:`);
    log(`   • Conversations checked: ${processed}`);
    log(`   • Download attempts: ${downloadsAttempted}`);
    log(`   • Successful downloads: ${downloadsSuccessful}`);
    
    if (downloadsSuccessful > 0) {
      log(`\n✅ SUCCESS! Downloaded ${downloadsSuccessful} resume(s)`);
      log(`   📁 Location: downloads/resumes/`);
      log(`\n💡 Next: Integrate with Google Drive, OpenAI, and Gmail`);
    } else if (!args.confirm) {
      log(`\n💡 Run with --confirm=true to attempt actual downloads`);
    } else {
      log(`\n⚠️  No attachments found in checked conversations`);
      log(`   • Clients may not have sent resumes yet`);
      log(`   • Or resumes are in different conversations`);
    }

    await browser.close();

  } catch (e) {
    console.error("❌ Fatal Error:", e);
    await browser.close();
    process.exit(1);
  }
})();
