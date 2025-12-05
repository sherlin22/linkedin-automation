//step9_check_all_conversations.js
const fs = require("fs");
const path = require("path");
const minimist = require("minimist");
const playwright = require("playwright");

require('dotenv').config();

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
    max: 30
  }
});

args.max = Number(args.max) || 30;

// Import helper modules
const { uploadToGoogleDrive } = require('./helpers/google_drive');
const { logToGoogleSheet } = require('./helpers/google_sheets');
const { createGmailDraft } = require('./helpers/gmail_draft');
const { extractEmailFromResume, extractExperienceYears } = require('./helpers/resume-parser');
const { generateResumeCritique } = require('./helpers/openai_critique');
const { saveDebugArtifacts } = require('./helpers/debug_utils');

let RESUME_STATE = { processed: [] };

function log(...a) { console.log(...a); }

function loadResumeState() {
  try {
    if (args.state && fs.existsSync(args.state)) {
      RESUME_STATE = JSON.parse(fs.readFileSync(args.state, "utf8"));
      log('📁 Loaded resume state:', RESUME_STATE.processed?.length || 0, 'processed conversations');
    }
  } catch (e) {
    log('⚠️  Starting with fresh resume state');
    RESUME_STATE = { processed: [] };
  }
}

// 🔥 TEMPORARY TESTING MODE - BYPASSES ELIGIBILITY CHECKS
function loadEligibleCandidates() {
  // TEMPORARY: Return ALL conversations to test attachment detection
  // This bypasses Step 7/8 eligibility checks
  log(`📋 TESTING MODE: Checking ALL conversations`);
  log(`   • Bypassing Step 7/8 eligibility checks`);
  log(`   • Will check all 20 conversations for attachments`);
  
  // Return a dummy array that makes the script check ALL conversations
  return Array.from({ length: 100 }, (_, i) => `Candidate_${i + 1}`);
}

function saveResumeState() {
  try {
    fs.writeFileSync(args.state, JSON.stringify(RESUME_STATE, null, 2), "utf8");
  } catch (e) {
    log('❌ Failed to save resume state:', e.message);
  }
}

// Get conversation name
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

// ENHANCED: Better attachment detection that actually works
async function findLinkedInAttachments(page) {
  return await page.evaluate(() => {
    console.log('🔍 ENHANCED: Comprehensive attachment scanning...');
    const files = [];
    
    // STRATEGY 1: Look for "sent an attachment" messages (MOST RELIABLE)
    const allTextElements = Array.from(document.querySelectorAll('*'));
    const attachmentMessages = allTextElements.filter(el => {
      const text = (el.innerText || el.textContent || '').toLowerCase();
      return text.includes('sent an attachment') && text.length < 200;
    });
    
    attachmentMessages.forEach(element => {
      const text = (element.innerText || element.textContent || '').trim();
      console.log('📩 Found attachment message:', text);
      files.push({
        fileName: `Attachment_${Date.now()}.pdf`,
        fullText: text,
        hasAttachment: true,
        element: element,
        type: 'attachment_message',
        confidence: 'HIGH'
      });
    });
    
    // STRATEGY 2: Look for file cards/previews
    const fileCards = document.querySelectorAll('[class*="attachment"], [class*="file"], .msg-s-message-list__attachment');
    fileCards.forEach(card => {
      const text = (card.innerText || card.textContent || '').trim();
      if (text && (text.includes('.pdf') || text.includes('KB') || text.includes('MB'))) {
        console.log('📄 Found file card:', text.substring(0, 100));
        files.push({
          fileName: text.split('\n')[0] || `File_${Date.now()}`,
          fullText: text,
          hasAttachment: true,
          element: card,
          type: 'file_card',
          confidence: 'HIGH'
        });
      }
    });
    
    // STRATEGY 3: Look for any clickable download elements
    const downloadElements = document.querySelectorAll('button, a, [role="button"]');
    downloadElements.forEach(element => {
      const text = (element.innerText || element.textContent || '').toLowerCase();
      if (text.includes('download') && text.length < 100) {
        console.log('⬇️ Found download element:', text);
        files.push({
          fileName: `Download_${Date.now()}.pdf`,
          fullText: text,
          hasAttachment: true,
          element: element,
          type: 'download_button',
          confidence: 'MEDIUM'
        });
      }
    });
    
    console.log('🔍 Total findings:', files.length);
    return files;
  });
}

// Fixed download function
async function downloadLinkedInFile(page, conversationName, fileInfo) {
  try {
    const downloadsDir = path.join(process.cwd(), 'downloads', 'resumes');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    log(`   🚀 Attempting to download attachment...`);
    
    // Set up download listener FIRST
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    
    let clicked = false;
    
    if (fileInfo.element) {
      try {
        // Use standard scrollIntoView instead of scrollIntoViewIfNeeded
        await page.evaluate((element) => {
          element.scrollIntoView();
        }, fileInfo.element);
        
        await page.waitForTimeout(1000);
        await fileInfo.element.click();
        clicked = true;
        log(`   ✅ Clicked attachment element directly`);
      } catch (e) {
        log(`   ⚠️  Direct click failed: ${e.message}`);
      }
    }
    
    if (!clicked) {
      // Fallback: Look for any download button
      clicked = await page.evaluate(() => {
        const downloadButtons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
        for (const btn of downloadButtons) {
          const text = (btn.innerText || btn.textContent || '').toLowerCase();
          const isVisible = btn.offsetParent !== null;
          
          if (isVisible && (text.includes('download') || text.includes('.pdf'))) {
            try {
              btn.click();
              return true;
            } catch (e) {
              // Continue to next button
            }
          }
        }
        return false;
      });
      
      if (clicked) {
        log(`   ✅ Clicked via fallback method`);
      }
    }
    
    if (!clicked) {
      log(`   ❌ Could not trigger download`);
      return null;
    }
    
    // Wait for download to start
    let download;
    try {
      download = await downloadPromise;
    } catch (e) {
      log(`   ❌ Download timeout - no download started`);
      return null;
    }
    
    // Create safe filename
    const safeName = conversationName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
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
    } else {
      log(`   ❌ File not found after download`);
      return null;
    }
    
  } catch (e) {
    log(`   ❌ Download failed:`, e.message);
    return null;
  }
}

// Calculate pricing based on experience
function calculatePricing(yearsOfExperience) {
  const pricingChart = {
    "0-3": { resume: 2500, linkedin: 2000 },
    "4-6": { resume: 3000, linkedin: 2500 }, 
    "6-8": { resume: 4000, linkedin: 2500 },
    "8-10": { resume: 6000, linkedin: 3000 },
    "10-12": { resume: 7000, linkedin: 3500 },
    "12+": { resume: 8000, linkedin: 4000 }
  };
  
  let range = "0-3";
  
  if (yearsOfExperience >= 12) range = "12+";
  else if (yearsOfExperience >= 10) range = "10-12";
  else if (yearsOfExperience >= 8) range = "8-10";
  else if (yearsOfExperience >= 6) range = "6-8";
  else if (yearsOfExperience >= 4) range = "4-6";
  
  return {
    resume_price: pricingChart[range].resume,
    linkedin_price: pricingChart[range].linkedin,
    experience_range: range,
    years_experience: yearsOfExperience
  };
}

// Fixed resume processing workflow
async function processResumeWorkflow(page, fileInfo, clientName, linkedinThreadId) {
  const workflowResult = {
    clientName: clientName,
    linkedinThreadId: linkedinThreadId,
    fileName: fileInfo.fileName,
    fileSizeKB: fileInfo.sizeKB,
    fileExtension: fileInfo.extension,
    timestamp: fileInfo.timestamp,
    localPath: fileInfo.localPath,
    
    stages: {
      downloaded: true,
      driveUploaded: false,
      emailExtracted: false,
      experienceExtracted: false,
      critiqueGenerated: false,
      draftCreated: false
    },
    
    driveInfo: null,
    clientEmail: null,
    yearsExperience: null,
    pricing: null,
    resumeCritique: null,
    draftInfo: null,
    debugArtifacts: null
  };
  
  try {
    log(`   🔄 Starting automated workflow for ${clientName}...`);
    
    // 1. Upload to Google Drive (skip if service account fails)
    log(`   ☁️  Uploading to Google Drive...`);
    try {
      const driveResult = await uploadToGoogleDrive(fileInfo.localPath, fileInfo.fileName);
      if (driveResult && driveResult.success) {
        workflowResult.stages.driveUploaded = true;
        workflowResult.driveInfo = driveResult;
        log(`   ✅ Uploaded to Drive: ${driveResult.driveLink}`);
      } else {
        log(`   ⚠️  Drive upload skipped (service account limitation)`);
      }
    } catch (driveError) {
      log(`   ⚠️  Drive upload failed: ${driveError.message}`);
    }
    
    // 2. Extract email from resume
    log(`   📧 Extracting contact information...`);
    try {
      const emailResult = await extractEmailFromResume(fileInfo.localPath, fileInfo.extension);
      if (emailResult && emailResult.email) {
        workflowResult.stages.emailExtracted = true;
        workflowResult.clientEmail = emailResult.email;
        log(`   ✅ Extracted email: ${emailResult.email}`);
      } else {
        log(`   ⚠️  No email found in resume`);
      }
    } catch (emailError) {
      log(`   ❌ Email extraction failed: ${emailError.message}`);
    }
    
    // 3. Extract years of experience
    log(`   📊 Analyzing experience...`);
    try {
      const experienceResult = await extractExperienceYears(fileInfo.localPath, fileInfo.extension);
      if (experienceResult && experienceResult.years !== null) {
        workflowResult.stages.experienceExtracted = true;
        workflowResult.yearsExperience = experienceResult.years;
        log(`   ✅ Experience: ${experienceResult.years} years`);
      } else {
        workflowResult.yearsExperience = null;
        log(`   ⚠️  Could not determine experience years`);
      }
    } catch (expError) {
      log(`   ❌ Experience extraction failed: ${expError.message}`);
      workflowResult.yearsExperience = null;
    }
    
    // 4. Calculate pricing
    workflowResult.pricing = calculatePricing(workflowResult.yearsExperience || 0);
    log(`   💰 Pricing - Resume: ₹${workflowResult.pricing.resume_price}, LinkedIn: ₹${workflowResult.pricing.linkedin_price}`);
    
    // 5. Generate AI critique
    log(`   🤖 Generating professional critique...`);
    try {
      const critiqueResult = await generateResumeCritique(fileInfo.localPath, fileInfo.extension, clientName);
      if (critiqueResult && critiqueResult.critique) {
        workflowResult.stages.critiqueGenerated = true;
        workflowResult.resumeCritique = critiqueResult.critique;
        log(`   ✅ Generated professional critique`);
      } else {
        log(`   ❌ Critique generation failed`);
      }
    } catch (critiqueError) {
      log(`   ❌ Critique generation failed: ${critiqueError.message}`);
    }
    
    // 6. Create Gmail draft
    if (workflowResult.stages.critiqueGenerated) {
      log(`   📧 Creating Gmail draft...`);
      try {
        const draftResult = await createGmailDraft({
          clientName: clientName,
          clientEmail: workflowResult.clientEmail,
          resumePrice: workflowResult.pricing.resume_price,
          linkedinPrice: workflowResult.pricing.linkedin_price,
          resumeCritique: workflowResult.resumeCritique
        });
        
        if (draftResult && draftResult.success) {
          workflowResult.stages.draftCreated = true;
          workflowResult.draftInfo = draftResult;
          log(`   ✅ Created Gmail draft: ${draftResult.draftId}`);
        } else {
          log(`   ❌ Draft creation failed`);
        }
      } catch (draftError) {
        log(`   ❌ Draft creation failed: ${draftError.message}`);
      }
    }
    
    // 7. Save debug artifacts
    try {
      workflowResult.debugArtifacts = await saveDebugArtifacts(page, clientName, 'resume_workflow');
    } catch (debugError) {
      log(`   ⚠️  Debug artifacts failed: ${debugError.message}`);
    }
    
    // 8. Log to Google Sheets
    log(`   📊 Logging to Google Sheets...`);
    try {
      await logToGoogleSheet(workflowResult);
      log(`   ✅ Logged to Google Sheets`);
    } catch (sheetError) {
      log(`   ❌ Google Sheets logging failed: ${sheetError.message}`);
    }
    
    if (workflowResult.stages.draftCreated) {
      log(`   🎉 WORKFLOW COMPLETE for ${clientName}!`);
    } else {
      log(`   ⚠️  Workflow partially completed for ${clientName}`);
    }
    
    return workflowResult;
    
  } catch (error) {
    log(`   ❌ Workflow failed for ${clientName}:`, error.message);
    workflowResult.error = error.message;
    try {
      workflowResult.debugArtifacts = await saveDebugArtifacts(page, clientName, 'workflow_error');
    } catch (e) {
      // Ignore debug errors
    }
    return workflowResult;
  }
}

// Main execution
(async () => {
  loadResumeState();
  
  log('🚀 STEP 9: FIXED Resume Automation');
  log('==================================');
  
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
      log("❌ Not logged in. Please check auth state.");
      await browser.close();
      process.exit(1);
    }

    // Get ALL conversations
    const threads = await page.$$('li.msg-conversation-listitem');
    log(`📊 Found ${threads.length} total conversations - checking for attachments`);
    
    let processed = 0;
    let attachmentsFound = 0;
    let successfulWorkflows = 0;
    const workflowResults = [];

    // Process conversations to find ones with attachments
    for (const thread of threads) {
      if (processed >= args.max) break;

      const name = await getConversationName(thread);
      if (!name) {
        processed++;
        continue;
      }
      
      // Check if already processed
      if (RESUME_STATE.processed.includes(name)) {
        log(`⏭️  Already processed: ${name}`);
        processed++;
        continue;
      }

      log(`\n🔍 Checking: ${name}`);
      await thread.click();
      await page.waitForTimeout(3000);

      // Scroll to load all messages
      await page.evaluate(async () => {
        const messageList = document.querySelector('.msg-s-message-list__list');
        if (messageList) {
          for (let i = 0; i < 5; i++) {
            messageList.scrollTop = messageList.scrollHeight;
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      });
      await page.waitForTimeout(2000);

      // Look for attachments
      const attachments = await findLinkedInAttachments(page);
      
      if (attachments.length > 0) {
        log(`   ✅ FOUND ${attachments.length} ATTACHMENT(S)!`);
        
        attachments.forEach((file, idx) => {
          log(`      [${idx}] ${file.type}: ${file.fileName}`);
        });

        if (args.confirm) {
          // Download and process the first attachment found
          const downloadResult = await downloadLinkedInFile(page, name, attachments[0]);
          
          if (downloadResult) {
            // Generate thread ID for logging
            const threadId = await thread.evaluate(el => el.getAttribute('data-urn') || el.id || `thread-${Date.now()}`);
            
            const workflowResult = await processResumeWorkflow(page, downloadResult, name, threadId);
            workflowResults.push(workflowResult);
            
            if (workflowResult.stages.draftCreated) {
              successfulWorkflows++;
            }
            
            // Update state
            if (!RESUME_STATE.processed) RESUME_STATE.processed = [];
            RESUME_STATE.processed.push(name);
            saveResumeState();
            
            attachmentsFound++;
          }
        } else {
          log(`   💡 Dry run: Would process ${attachments.length} attachment(s)`);
          attachmentsFound += attachments.length;
        }
      } else {
        log(`   ⏭️  No attachments found in this conversation`);
      }

      processed++;
      await page.waitForTimeout(2000);
    }

    // Final Summary
    log(`\n${"=".repeat(60)}`);
    log(`🏁 STEP 9 COMPLETE!`);
    log(`📊 FINAL RESULTS:`);
    log(`   • Conversations checked: ${processed}`);
    log(`   • Conversations with attachments: ${attachmentsFound}`);
    log(`   • Complete workflows: ${successfulWorkflows}`);
    log(`   • Total processed in this run: ${workflowResults.length}`);
    
    if (workflowResults.length > 0) {
      log(`\n📈 DETAILED WORKFLOW STATISTICS:`);
      const drives = workflowResults.filter(r => r.stages.driveUploaded).length;
      const emails = workflowResults.filter(r => r.stages.emailExtracted).length;
      const experiences = workflowResults.filter(r => r.stages.experienceExtracted).length;
      const critiques = workflowResults.filter(r => r.stages.critiqueGenerated).length;
      const drafts = workflowResults.filter(r => r.stages.draftCreated).length;
      
      log(`   • Drive Uploads: ${drives}/${workflowResults.length}`);
      log(`   • Email Extractions: ${emails}/${workflowResults.length}`);
      log(`   • Experience Analysis: ${experiences}/${workflowResults.length}`);
      log(`   • AI Critiques: ${critiques}/${workflowResults.length}`);
      log(`   • Gmail Drafts: ${drafts}/${workflowResults.length}`);
    }
    
    if (args.confirm && successfulWorkflows > 0) {
      log(`\n✅ SUCCESS! Completed ${successfulWorkflows} full automation workflows!`);
      log(`   📁 Local files: downloads/resumes/`);
      if (attachmentsFound > 0) {
        log(`   📧 Gmail: Drafts created in your account`);
        log(`   📊 Logs: Added to Google Sheets`);
      }
    } else if (!args.confirm && attachmentsFound > 0) {
      log(`\n💡 Run with --confirm=true to process ${attachmentsFound} attachments found`);
    }

    await browser.close();
    log(`\n✨ Step 9 Fixed - Ready for production!`);

  } catch (e) {
    console.error("❌ Fatal Error:", e);
    await browser.close();
    process.exit(1);
  }
})();