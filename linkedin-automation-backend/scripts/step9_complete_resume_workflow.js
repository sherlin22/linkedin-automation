// scripts/step9_complete_resume_workflow.js - CORRECTED WITH WEBHOOKS
const fs = require("fs");
const path = require("path");
const minimist = require("minimist");
const playwright = require("playwright");
const { updateMetric } = require('./helpers/metrics-handler');
const { isValidCandidateName } = require('./helpers/validation-helpers');

require('dotenv').config();

const args = minimist(process.argv.slice(2), {
  string: ["auth", "state", "browser", "slowMo"],
  boolean: ["headful", "confirm", "reset"],
  default: {
    auth: "auth_state.json",
    state: "resume_processing_state_ALL.json",
    browser: "chromium",
    headless: false,
    headful: true,
    confirm: false,
    reset: false,
    slowMo: "150",
    max: 50
  }
});

args.max = Number(args.max) || 50;

// Import helper modules
const { uploadToGoogleDrive } = require('./helpers/google_drive');
const { createGmailDraft } = require('./helpers/gmail_draft');
const { extractEmailFromResume, extractExperienceYears } = require('./helpers/resume-parser');
const { generateResumeCritique } = require('./helpers/openai_critique');

// ✅ WEBHOOK: Send resume download event
async function sendResumeDownloadWebhook(clientName, resumeStatus, emailId, threadId) {
  try {
    console.log(`📡 Sending resume download webhook for: ${clientName}`);
    
    const payload = {
      clientName: clientName || 'Unknown',
      resumeStatus: resumeStatus || 'Failed',  // "Success/Readable" or "Success/Unreadable"
      emailId: emailId || 'N/A',
      threadId: threadId || null,
      status: 'success',
      timestamp: new Date().toISOString()
    };

    const response = await fetch('http://localhost:3000/api/automation/resume-downloaded', {
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

// ✅ WEBHOOK: Send draft created event
async function sendDraftCreatedWebhook(clientName, draftStatus) {
  try {
    console.log(`📡 Sending draft webhook for: ${clientName}`);
    
    const payload = {
      clientName: clientName || 'Unknown',
      draftStatus: draftStatus || 'Success',
      status: 'success',
      timestamp: new Date().toISOString()
    };

    const response = await fetch('http://localhost:3000/api/automation/draft-created', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log(`   ✅ Draft webhook sent for ${clientName}`);
      return true;
    } else {
      console.log(`   ⚠️  Draft webhook failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log('⚠️  Draft webhook error:', error.message);
    return false;
  }
}

let RESUME_STATE = { 
  processed: [], 
  downloaded: [],
  readable: [],
  unreadable: []
};

function log(...a) { console.log(...a); }

function loadResumeState() {
  try {
    if (fs.existsSync(args.state)) {
      RESUME_STATE = JSON.parse(fs.readFileSync(args.state, "utf8"));
    }
  } catch (e) {
    log('⚠️  Failed to load state:', e.message);
  }
  
  if (args.reset) {
    log('🔄 RESET FLAG DETECTED - Clearing processed state');
    RESUME_STATE = { processed: [], downloaded: [], readable: [], unreadable: [] };
    saveResumeState();
  }
  
  if (!RESUME_STATE.processed) RESUME_STATE.processed = [];
  if (!RESUME_STATE.downloaded) RESUME_STATE.downloaded = [];
  if (!RESUME_STATE.readable) RESUME_STATE.readable = [];
  if (!RESUME_STATE.unreadable) RESUME_STATE.unreadable = [];
  
  log('📁 Loaded state:', RESUME_STATE.processed.length, 'processed');
}

function saveResumeState() {
  try {
    fs.writeFileSync(args.state, JSON.stringify(RESUME_STATE, null, 2), "utf8");
  } catch (e) {
    log('❌ Failed to save state:', e.message);
  }
}

async function isResumeReadable(filePath) {
  try {
    const { parsePDF } = require('./helpers/resume-parser');
    const result = await parsePDF(filePath);
    
    if (!result.success) {
      console.log(`   ❌ Not readable: ${result.error}`);
      return false;
    }
    
    const text = result.text || '';
    const hasContent = text.trim().length > 100;
    const hasKeywords = /(experience|education|skills|work|project|email|phone)/i.test(text);
    
    console.log(`   ✓ Readable: ${hasContent && hasKeywords}`);
    return hasContent && hasKeywords;
    
  } catch (error) {
    console.log(`   ❌ Readability error: ${error.message}`);
    return false;
  }
}

function organizeResumeFile(fileInfo, isReadable) {
  const baseDir = path.join(process.cwd(), 'downloads', 'resumes');
  const readableDir = path.join(baseDir, 'readable');
  const unreadableDir = path.join(baseDir, 'unreadable');
  
  if (!fs.existsSync(readableDir)) fs.mkdirSync(readableDir, { recursive: true });
  if (!fs.existsSync(unreadableDir)) fs.mkdirSync(unreadableDir, { recursive: true });
  
  const sourcePath = fileInfo.localPath;
  const targetDir = isReadable ? readableDir : unreadableDir;
  const targetPath = path.join(targetDir, fileInfo.fileName);
  
  try {
    fs.renameSync(sourcePath, targetPath);
    return {
      ...fileInfo,
      localPath: targetPath,
      category: isReadable ? 'readable' : 'unreadable'
    };
  } catch (error) {
    log(`   ❌ Failed to organize: ${error.message}`);
    return fileInfo;
  }
}

function calculatePricing(years) {
  const chart = {
    "0-3": { resume: 2500, linkedin: 2000 },
    "4-6": { resume: 3000, linkedin: 2500 }, 
    "6-8": { resume: 4000, linkedin: 2500 },
    "8-10": { resume: 6000, linkedin: 3000 },
    "10-12": { resume: 7000, linkedin: 3500 },
    "12+": { resume: 8000, linkedin: 4000 }
  };
  
  let range = "0-3";
  if (years >= 12) range = "12+";
  else if (years >= 10) range = "10-12";
  else if (years >= 8) range = "8-10";
  else if (years >= 6) range = "6-8";
  else if (years >= 4) range = "4-6";
  
  return {
    resume_price: chart[range].resume,
    linkedin_price: chart[range].linkedin,
    experience_range: range,
    years_experience: years
  };
}

async function getConversationName(el) {
  try {
    return await el.evaluate(e => {
      const sels = [
        'h3.msg-conversation-listitem__participant-names',
        '.msg-conversation-listitem__participant-names',
        'h3 span', 'h4 span'
      ];
      for (const s of sels) {
        const n = e.querySelector(s);
        if (n) {
          const t = (n.innerText || n.textContent || '').trim();
          if (t && t.length > 2 && t.length < 100) return t;
        }
      }
      return null;
    });
  } catch { return null; }
}

async function findLinkedInAttachments(page) {
  log('   🔍 Searching for attachments...');
  
  await page.waitForTimeout(2000);
  
  const attachments = await page.evaluate(() => {
    const results = [];
    const allElements = document.querySelectorAll('*');
    
    allElements.forEach(el => {
      const text = (el.innerText || el.textContent || '').trim();
      
      const hasFilePattern = /\.(pdf|doc|docx)/i.test(text);
      const hasSizePattern = /\d+\s*(KB|MB|bytes)/i.test(text);
      const hasDownloadText = /download/i.test(text);
      
      if (hasFilePattern && (hasSizePattern || hasDownloadText)) {
        if (text.length < 300) {
          const hasButton = el.querySelector('button, a[download]') !== null;
          
          if (hasButton || hasDownloadText) {
            results.push({
              type: 'file-with-size',
              text: text.substring(0, 100),
              hasButton: hasButton,
              visible: el.offsetParent !== null
            });
          }
        }
      }
    });
    
    return results;
  });
  
  log(`   📊 Detection results: ${attachments.length} potential attachment(s)`);
  if (attachments.length > 0) {
    attachments.forEach((att, i) => {
      log(`      [${i+1}] Type: ${att.type}, Text: "${att.text}"`);
    });
  }
  
  return attachments;
}

async function downloadLinkedInFile(page, name, attachmentInfo) {
  try {
    const dir = path.join(process.cwd(), 'downloads', 'resumes');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    log(`   🚀 Attempting download...`);
    log(`   📝 Strategy: ${attachmentInfo.type}`);
    
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    
    const clicked = await page.evaluate(() => {
      const selectors = [
        'button[aria-label*="Download"]',
        'button[aria-label*="download"]',
        '.msg-s-event-listitem__download-attachment-button',
        'a[download]'
      ];
      
      for (const sel of selectors) {
        const elements = document.querySelectorAll(sel);
        for (const el of elements) {
          if (el.offsetParent !== null) {
            try {
              el.click();
              return true;
            } catch (e) {
              continue;
            }
          }
        }
      }
      
      const allButtons = document.querySelectorAll('button');
      for (const btn of allButtons) {
        const parent = btn.closest('[class*="msg-s-event"]');
        if (parent) {
          const text = parent.innerText || '';
          if (/\.(pdf|docx?)/i.test(text) && /\d+\s*(KB|MB)/i.test(text)) {
            const ariaLabel = btn.getAttribute('aria-label') || '';
            const btnText = btn.innerText || '';
            if (/download/i.test(ariaLabel + btnText)) {
              try {
                btn.click();
                return true;
              } catch (e) {
                continue;
              }
            }
          }
        }
      }
      
      return false;
    });
    
    if (!clicked) {
      log(`   ❌ No download button found`);
      return null;
    }
    
    log('   ✓ Clicked download button');
    log('   ⏳ Waiting for download to start...');
    
    const download = await downloadPromise.catch((err) => {
      log(`   ❌ Download timeout: ${err.message}`);
      return null;
    });
    
    if (!download) {
      log(`   ❌ Download did not start`);
      return null;
    }
    
    const safeName = name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const ts = Date.now();
    const suggestedName = download.suggestedFilename();
    const ext = path.extname(suggestedName) || '.pdf';
    const fileName = `resume_${safeName}_${ts}${ext}`;
    const savePath = path.join(dir, fileName);
    
    log(`   💾 Saving as: ${fileName}`);
    await download.saveAs(savePath);
    
    if (fs.existsSync(savePath)) {
      const stats = fs.statSync(savePath);
      log(`   ✅ Downloaded: ${fileName} (${Math.round(stats.size / 1024)} KB)`);
      
      return {
        localPath: savePath,
        fileName: fileName,
        originalName: suggestedName,
        size: stats.size,
        sizeKB: Math.round(stats.size / 1024),
        extension: ext.toLowerCase(),
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

// MAIN WORKFLOW
async function processResumeWorkflow(page, fileInfo, clientName, threadId) {
  const result = {
    clientName,
    linkedinThreadId: threadId,
    fileName: fileInfo.fileName,
    fileSizeKB: fileInfo.sizeKB,
    fileExtension: fileInfo.extension,
    timestamp: fileInfo.timestamp,
    localPath: fileInfo.localPath,
    stages: {
      downloaded: true,
      readable: false,
      driveUploaded: false,
      emailExtracted: false,
      experienceExtracted: false,
      critiqueGenerated: false,
      draftCreated: false
    }
  };
  
  try {
    log(`\n${"=".repeat(60)}`);
    log(`🔄 WORKFLOW START: ${clientName}`);
    log(`${"=".repeat(60)}`);
    
    log(`\n1️⃣  READABILITY CHECK`);
    const readable = await isResumeReadable(fileInfo.localPath);
    result.stages.readable = readable;
    
    if (!readable) {
      log(`   ❌ Resume NOT readable`);
      const organized = organizeResumeFile(fileInfo, false);
      result.localPath = organized.localPath;
      
      if (!RESUME_STATE.unreadable) RESUME_STATE.unreadable = [];
      RESUME_STATE.unreadable.push({
        name: clientName,
        fileName: fileInfo.fileName,
        localPath: organized.localPath,
        timestamp: fileInfo.timestamp
      });
      saveResumeState();
      
      log(`\n❌ WORKFLOW INCOMPLETE: Resume unreadable`);
      return result;
    }
    
    log(`   ✅ Resume is readable`);
    const organized = organizeResumeFile(fileInfo, true);
    result.localPath = organized.localPath;
    
    if (!RESUME_STATE.readable) RESUME_STATE.readable = [];
    RESUME_STATE.readable.push({
      name: clientName,
      fileName: fileInfo.fileName,
      localPath: organized.localPath,
      timestamp: fileInfo.timestamp
    });
    saveResumeState();
    
    log(`\n2️⃣  GOOGLE DRIVE UPLOAD`);
    const drive = await uploadToGoogleDrive(
      organized.localPath, 
      fileInfo.fileName, 
      clientName, 
      true
    );
    
    if (drive?.success) {
      result.stages.driveUploaded = true;
      result.driveInfo = drive;
      log(`   ✅ Drive: ${drive.driveLink}`);
    } else {
      log(`   ⚠️  Drive upload skipped or failed`);
    }
    
    log(`\n3️⃣  EMAIL EXTRACTION`);
    const email = await extractEmailFromResume(organized.localPath, fileInfo.extension);
    
    if (email?.success) {
      result.stages.emailExtracted = true;
      result.clientEmail = email.email;
      log(`   ✅ Email: ${email.email}`);
    } else {
      log(`   ⚠️  No email found`);
      result.clientEmail = null;
    }
    
    log(`\n4️⃣  EXPERIENCE ANALYSIS`);
    const exp = await extractExperienceYears(organized.localPath, fileInfo.extension);
    
    if (exp?.success && exp.years !== null) {
      result.stages.experienceExtracted = true;
      result.yearsExperience = exp.years;
      log(`   ✅ Experience: ${exp.years} years`);
    } else {
      result.yearsExperience = 0;
      log(`   ⚠️  Experience unknown, using 0`);
    }
    
    result.pricing = calculatePricing(result.yearsExperience || 0);
    log(`   💰 Pricing - Resume: ₹${result.pricing.resume_price}, LinkedIn: ₹${result.pricing.linkedin_price}`);
    
    log(`\n5️⃣  AI CRITIQUE GENERATION`);
    const critique = await generateResumeCritique(
      organized.localPath, 
      fileInfo.extension, 
      clientName
    );
    
    if (critique?.success) {
      result.stages.critiqueGenerated = true;
      result.resumeCritique = critique.critique;
      log(`   ✅ Critique generated (${critique.critique.length} chars)`);
      log(`   📊 Tokens used: ${critique.tokens}`);
    } else {
      log(`   ❌ Critique failed: ${critique?.error}`);
      result.resumeCritique = 'AI critique generation failed. Manual review required.';
    }
    
    log(`\n6️⃣  GMAIL DRAFT CREATION`);
    if (result.stages.critiqueGenerated) {
      const draft = await createGmailDraft({
        clientName,
        clientEmail: result.clientEmail,
        resumePrice: result.pricing.resume_price,
        linkedinPrice: result.pricing.linkedin_price,
        resumeCritique: result.resumeCritique
      });
      
      if (draft?.success) {
        result.stages.draftCreated = true;
        result.draftInfo = draft;
        log(`   ✅ Gmail Draft: ${draft.draftLink}`);
      } else if (draft?.skipped) {
        log(`   ⏭️  Draft creation skipped: ${draft.message}`);
      } else {
        log(`   ❌ Draft failed: ${draft?.error}`);
      }
    } else {
      log(`   ⏭️  Skipping draft (no critique)`);
    }
    
    log(`\n${"=".repeat(60)}`);
    if (result.stages.draftCreated) {
      log(`✅ WORKFLOW COMPLETE: ${clientName}`);
    } else {
      log(`⚠️  WORKFLOW PARTIAL: ${clientName}`);
    }
    log(`${"=".repeat(60)}\n`);
    
    return result;
    
  } catch (error) {
    log(`\n❌ WORKFLOW ERROR: ${error.message}`);
    result.error = error.message;
    return result;
  }
}

// MAIN FUNCTION
(async () => {
  loadResumeState();
  
  log('\n🚀 STEP 9: Complete Resume Workflow');
  log('='.repeat(60));
  log('Processing ALL LinkedIn conversations for resumes\n');
  
  if (args.reset) {
    log('⚠️  RESET MODE: Will process ALL conversations again\n');
  }
  
  const browser = await playwright.chromium.launch({ 
    headless: false,
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

    log('📜 Loading more conversations by scrolling...');
    const conversationList = await page.$('.msg-conversations-container__conversations-list, [class*="conversations-list"]');
    if (conversationList) {
      console.log('📜 Loading more conversations by scrolling...');
      let previousCount = 0;
      let stableCount = 0;
      
      for (let i = 0; i < 15; i++) {
        await conversationList.evaluate(el => {
          el.scrollTop = el.scrollHeight;
        });
        await page.waitForTimeout(2000);
        
        const currentThreads = await page.$$('li.msg-conversation-listitem');
        const currentCount = currentThreads.length;
        
        console.log(`   Scroll ${i + 1}/15 completed - Found ${currentCount} conversations`);
        
        if (currentCount === previousCount) {
          stableCount++;
          if (stableCount >= 3) {
            console.log('   ✅ Reached end of conversations list');
            break;
          }
        } else {
          stableCount = 0;
        }
        
        previousCount = currentCount;
      }
      console.log('   ✅ Finished loading conversations\n');
    }

    const threads = await page.$$('li.msg-conversation-listitem');
    log(`📊 Found ${threads.length} conversations\n`);
    
    let processed = 0;
    let foundAttachments = 0;
    let successDownloads = 0;
    let readableCount = 0;
    let unreadableCount = 0;
    let workflowSuccess = 0;

    for (const thread of threads) {
      if (processed >= args.max) {
        log(`\n⚠️  Reached max limit: ${args.max}`);
        break;
      }

      const name = await getConversationName(thread);
      if (!name) {
        processed++;
        continue;
      }

      if (!isValidCandidateName(name)) {
        log(`   ⚠️  Invalid name: "${name}" - skipping conversation`);
        processed++;
        continue;
      }
      
      if (!args.reset && RESUME_STATE.processed.includes(name)) {
        log(`\n⏭️  Skipping ${name} (already processed)`);
        processed++;
        continue;
      }

      log(`\n${"━".repeat(60)}`);
      log(`🔍 Checking: ${name}`);
      log(`${"━".repeat(60)}`);
      
      await thread.click();
      await page.waitForTimeout(3000);

      log('   📜 Loading messages...');
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

      const attachments = await findLinkedInAttachments(page);
      
      if (attachments.length > 0) {
        log(`   ✅ Found ${attachments.length} attachment(s)`);
        foundAttachments++;
        
        if (args.confirm) {
          const downloadedFile = await downloadLinkedInFile(page, name, attachments[0]);
          
          if (downloadedFile) {
            successDownloads++;
            
            const currentHour = new Date().getHours();
            let slot = 'slot1';
            if (currentHour >= 14 && currentHour < 18) {
              slot = 'slot2';
            } else if (currentHour >= 18) {
              slot = 'slot3';
            }
            
            updateMetric(slot, 'downloads', 1);
            log(`📊 Metrics: Updated ${slot} downloads count`);

            const threadId = await thread.evaluate(e => e.getAttribute('data-urn') || e.id || `t${Date.now()}`);
            
            const workflowResult = await processResumeWorkflow(page, downloadedFile, name, threadId);
            
            // ✅ WEBHOOK 1: Log resume download
            const resumeStatus = workflowResult.stages.readable ? 'Success/Readable' : 'Success/Unreadable';
            if (isValidCandidateName(name)) {
              await sendResumeDownloadWebhook(
                name,
                resumeStatus,
                workflowResult.clientEmail || 'N/A',
                threadId
              );
            } else {
              log(`   ⚠️  Invalid name: "${name}" - resume webhook skipped`);
            }
            
            if (workflowResult.stages.readable) {
              readableCount++;
              if (workflowResult.stages.draftCreated) {
                workflowSuccess++;
                
                // ✅ WEBHOOK 2: Log draft creation
                if (workflowResult.stages.draftCreated) {
                  workflowSuccess++;
                  if (isValidCandidateName(name)) {
                    await sendDraftCreatedWebhook(name, 'Success');
                  } else {
                    log(`   ⚠️  Invalid name: "${name}" - draft webhook skipped`);
                  }
                }
              }
            } else {
              unreadableCount++;
            }
            
            if (!RESUME_STATE.processed.includes(name)) {
              RESUME_STATE.processed.push(name);
            }
            RESUME_STATE.downloaded.push({
              name: name,
              fileName: downloadedFile.fileName,
              timestamp: downloadedFile.timestamp
            });
            
            saveResumeState();
          }
        } else {
          log(`   💡 Dry run - would process this file`);
        }
      } else {
        log(`   📭 No attachments found`);
      }

      processed++;
      await page.waitForTimeout(2000);
    }

    log(`\n${"=".repeat(60)}`);
    log(`🏁 STEP 9 COMPLETE`);
    log(`${"=".repeat(60)}`);
    log(`📊 Statistics:`);
    log(`   • Conversations checked: ${processed}`);
    log(`   • Attachments found: ${foundAttachments}`);
    log(`   • Downloads successful: ${successDownloads}`);
    log(`   • Readable resumes: ${readableCount}`);
    log(`   • Unreadable resumes: ${unreadableCount}`);
    log(`   • Complete workflows: ${workflowSuccess}`);
    
    if (!args.confirm) {
      log(`\n💡 This was a DRY RUN`);
      log(`   Use --confirm=true to actually process files`);
    }

    await browser.close();

  } catch (e) {
    console.error("❌ Fatal error:", e);
    await browser.close();
    process.exit(1);
  }
})();