// scripts/step9_reprocess_failed_resumes.js
// Re-downloads specific resumes from LinkedIn and processes them for critique + email drafts
// Targets: Harihararaman M, Niklesh Ajeete, Pushpak Sonar

const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const playwright = require('playwright');

require('dotenv').config();

// Import helper modules
const { extractEmailFromResume, extractExperienceYears } = require('./helpers/resume-parser');
const { generateResumeCritique } = require('./helpers/openai_critique');
const { createGmailDraft } = require('./helpers/gmail_draft');
const { uploadToGoogleDrive } = require('./helpers/google_drive');

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
    slowMo: "100"
  }
});

// Target candidates that need reprocessing
const TARGET_CANDIDATES = [
  'Harihararaman M',
  'Niklesh Ajeete',
  'Pushpak Sonar'
];

function log(...a) { console.log(...a); }

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
      const sels = ['h3.msg-conversation-listitem__participant-names', '.msg-conversation-listitem__participant-names', 'h3 span', 'h4 span'];
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
  log('   Searching for attachments...');
  await page.waitForTimeout(2000);
  
  const attachments = await page.evaluate(() => {
    const results = [];
    const attachmentButtons = document.querySelectorAll('.msg-s-event-listitem__download-attachment-button');
    
    attachmentButtons.forEach(btn => {
      if (btn.offsetParent === null) return;
      const filenameEl = btn.querySelector('.ui-attachment__filename');
      const filesizeEl = btn.querySelector('.ui-attachment__filesize');
      const filename = filenameEl ? filenameEl.innerText.trim() : '';
      const filesize = filesizeEl ? filesizeEl.innerText.trim() : '';
      const isPDF = btn.classList.contains('ui-attachment--pdf') || filename.toLowerCase().endsWith('.pdf');
      
      if (filename && (filesize || filename.toLowerCase().endsWith('.pdf'))) {
        results.push({ type: 'linkedin-attachment', filename, filesize, isPDF, text: `${filename} ${filesize}`.trim(), button: btn });
      }
    });
    
    const unique = [];
    const seen = new Set();
    results.forEach(r => {
      const key = r.filename.toLowerCase();
      if (!seen.has(key)) { seen.add(key); unique.push(r); }
    });
    return unique;
  });
  
  log(`   Detection results: ${attachments.length} attachment(s)`);
  attachments.forEach((att, i) => { log(`      [${i+1}] ${att.filename} (${att.filesize})`); });
  return attachments;
}

async function downloadLinkedInFile(page, name, attachmentInfo) {
  try {
    const dir = path.join(process.cwd(), 'downloads', 'resumes');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    log(`   Attempting download...`);
    log(`   File: ${attachmentInfo.filename} (${attachmentInfo.filesize})`);
    
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    
    let clicked = false;
    if (attachmentInfo.button) {
      try { await attachmentInfo.button.click(); clicked = true; log('   Clicked attachment button'); }
      catch (e) { log(`   Direct click failed: ${e.message}`); }
    }
    
    if (!clicked) {
      clicked = await page.evaluate(() => {
        const btn = document.querySelector('.msg-s-event-listitem__download-attachment-button');
        if (btn) { try { btn.click(); return true; } catch {} }
        return false;
      });
      if (clicked) log('   Clicked via selector fallback');
    }
    
    if (!clicked) { log(`   Could not click download button`); return null; }
    
    log('   Waiting for download to start...');
    const download = await downloadPromise.catch((err) => { log(`   Download timeout: ${err.message}`); return null; });
    
    if (!download) { log(`   Download did not start`); return null; }
    
    const safeName = name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const ts = Date.now();
    const suggestedName = download.suggestedFilename();
    const ext = path.extname(suggestedName) || '.pdf';
    const fileName = `resume_${safeName}_${ts}${ext}`;
    const savePath = path.join(dir, fileName);
    
    log(`   Saving as: ${fileName}`);
    await download.saveAs(savePath);
    
    if (fs.existsSync(savePath)) {
      const stats = fs.statSync(savePath);
      log(`   Downloaded: ${fileName} (${Math.round(stats.size / 1024)} KB)`);
      return { localPath: savePath, fileName, originalName: suggestedName, size: stats.size, sizeKB: Math.round(stats.size / 1024), extension: ext.toLowerCase(), timestamp: new Date().toISOString() };
    }
    
    return null;
  } catch (e) {
    log(`   Download failed: ${e.message}`);
    return null;
  }
}

async function isResumeReadable(filePath) {
  try {
    const { parsePDF } = require('./helpers/resume-parser');
    const result = await parsePDF(filePath);
    if (!result.success) { console.log(`   Not readable: ${result.error}`); return false; }
    const text = result.text || '';
    const hasContent = text.trim().length > 100;
    const hasKeywords = /(experience|education|skills|work|project|email|phone)/i.test(text);
    console.log(`   Readable: ${hasContent && hasKeywords}`);
    return hasContent && hasKeywords;
  } catch (error) {
    console.log(`   Readability error: ${error.message}`);
    return false;
  }
}

async function processResumeWorkflow(page, fileInfo, clientName, threadId) {
  const result = {
    clientName, linkedinThreadId: threadId, fileName: fileInfo.fileName, fileSizeKB: fileInfo.sizeKB,
    fileExtension: fileInfo.extension, timestamp: fileInfo.timestamp, localPath: fileInfo.localPath,
    stages: { downloaded: true, readable: false, driveUploaded: false, emailExtracted: false, experienceExtracted: false, critiqueGenerated: false, draftCreated: false }
  };
  
  try {
    log(`\n============================================================`);
    log(`WORKFLOW START: ${clientName}`);
    log(`============================================================`);
    
    log(`1. READABILITY CHECK`);
    const readable = await isResumeReadable(fileInfo.localPath);
    result.stages.readable = readable;
    
    if (!readable) {
      log(`   Resume NOT readable`);
      log(`\n============================================================`);
      log(`WORKFLOW INCOMPLETE: Resume unreadable`);
      log(`============================================================\n`);
      return result;
    }
    
    log(`   Resume is readable`);
    
    log(`\n2. EMAIL EXTRACTION`);
    const email = await extractEmailFromResume(fileInfo.localPath, fileInfo.extension);
    if (email?.success) { result.stages.emailExtracted = true; result.clientEmail = email.email; log(`   Email: ${email.email}`); }
    else { log(`   No email found`); result.clientEmail = null; }
    
    log(`\n3. EXPERIENCE ANALYSIS`);
    const exp = await extractExperienceYears(fileInfo.localPath, fileInfo.extension);
    if (exp?.success && exp.years !== null) { result.stages.experienceExtracted = true; result.yearsExperience = exp.years; log(`   Experience: ${exp.years} years`); }
    else { result.yearsExperience = 0; log(`   Experience unknown, using 0`); }
    
    result.pricing = calculatePricing(result.yearsExperience || 0);
    log(`   Pricing - Resume: INR ${result.pricing.resume_price}, LinkedIn: INR ${result.pricing.linkedin_price}`);
    
    log(`\n4. AI CRITIQUE GENERATION`);
    const critique = await generateResumeCritique(fileInfo.localPath, fileInfo.extension, clientName);
    if (critique?.success) { result.stages.critiqueGenerated = true; result.resumeCritique = critique.critique; log(`   Critique generated (${critique.critique.length} chars)`); }
    else { log(`   Critique failed: ${critique?.error}`); result.resumeCritique = 'AI critique generation failed. Manual review required.'; }
    
    log(`\n5. GMAIL DRAFT CREATION`);
    if (result.stages.critiqueGenerated) {
      const draft = await createGmailDraft({ clientName, clientEmail: result.clientEmail, resumePrice: result.pricing.resume_price, linkedinPrice: result.pricing.linkedin_price, resumeCritique: result.resumeCritique });
      if (draft?.success) { result.stages.draftCreated = true; result.draftInfo = draft; log(`   Gmail Draft: ${draft.draftLink}`); }
      else if (draft?.skipped) { log(`   Draft skipped: ${draft.message}`); }
      else { log(`   Draft failed: ${draft?.error}`); }
    } else { log(`   Skipping draft (no critique)`); }
    
    log(`\n============================================================`);
    log(result.stages.draftCreated ? `WORKFLOW COMPLETE: ${clientName}` : `WORKFLOW INCOMPLETE: ${clientName}`);
    log(`============================================================\n`);
    
    return result;
  } catch (error) {
    log(`\nWORKFLOW ERROR: ${error.message}`);
    result.error = error.message;
    return result;
  }
}

async function findAndClickConversation(page, name) {
  log(`   Looking for conversation: ${name}`);
  
  // Try to find in current list
  const threads = await page.$$('li.msg-conversation-listitem');
  for (const thread of threads) {
    const threadName = await getConversationName(thread);
    if (threadName && threadName.includes(name)) {
      log(`   Found: ${threadName}`);
      await thread.click();
      await page.waitForTimeout(3000);
      return true;
    }
  }
  
  // Scroll and try again
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => {
      const list = document.querySelector('.msg-conversations-container__conversations-list, [class*="conversations-list"]');
      if (list) list.scrollTop = list.scrollHeight;
    });
    await page.waitForTimeout(1000);
    
    const updatedThreads = await page.$$('li.msg-conversation-listitem');
    for (const thread of updatedThreads) {
      const threadName = await getConversationName(thread);
      if (threadName && threadName.includes(name)) {
        log(`   Found (after scroll): ${threadName}`);
        await thread.click();
        await page.waitForTimeout(3000);
        return true;
      }
    }
  }
  
  return false;
}

(async () => {
  log('\n============================================================');
  log('RE-DOWNLOAD & PROCESS FAILED RESUMES');
  log('============================================================');
  log(`Targets: ${TARGET_CANDIDATES.join(', ')}`);
  log(`Confirm mode: ${args.confirm}`);
  log('');
  
  const browser = await playwright.chromium.launch({ headless: false, slowMo: Number(args.slowMo) });
  const context = await browser.newContext({ storageState: args.auth, acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  try {
    log('Opening LinkedIn Messaging...');
    await page.goto("https://www.linkedin.com/messaging/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);

    if (/\/login|checkpoint/.test(page.url())) {
      log("Not logged in");
      await browser.close();
      process.exit(1);
    }

    // Load more conversations
    const conversationList = await page.$('.msg-conversations-container__conversations-list, [class*="conversations-list"]');
    if (conversationList) {
      log('Loading conversations...');
      for (let i = 0; i < 10; i++) {
        await conversationList.evaluate(el => el.scrollTop = el.scrollHeight);
        await page.waitForTimeout(1500);
      }
    }

    let successCount = 0;
    let failCount = 0;

    for (const candidateName of TARGET_CANDIDATES) {
      log(`\n${'='.repeat(60)}`);
      log(`PROCESSING: ${candidateName}`);
      log(`${'='.repeat(60)}`);
      
      const found = await findAndClickConversation(page, candidateName);
      
      if (!found) {
        log(`   Conversation not found`);
        failCount++;
        continue;
      }
      
      // Load messages
      await page.evaluate(async () => {
        const list = document.querySelector('.msg-s-message-list__list');
        if (list) {
          list.scrollTop = 0;
          for (let i = 0; i < 5; i++) { list.scrollTop = list.scrollHeight; await new Promise(r => setTimeout(r, 500)); }
        }
      });
      await page.waitForTimeout(2000);
      
      const attachments = await findLinkedInAttachments(page);
      
      if (attachments.length === 0) {
        log(`   No attachments found`);
        failCount++;
        continue;
      }
      
      if (!args.confirm) {
        log(`   DRY RUN - Would download: ${attachments[0].filename}`);
        continue;
      }
      
      const downloadedFile = await downloadLinkedInFile(page, candidateName, attachments[0]);
      
      if (!downloadedFile) {
        log(`   Download failed`);
        failCount++;
        continue;
      }
      
      const threadId = await page.evaluate(e => e.getAttribute('data-urn') || e.id || `t${Date.now()}`, await page.$('li.msg-conversation-listitem'));
      
      const workflowResult = await processResumeWorkflow(page, downloadedFile, candidateName, threadId);
      
      if (workflowResult.stages.draftCreated) {
        successCount++;
        log(`\nDRAFT CREATED: ${candidateName}`);
        log(`Link: ${workflowResult.draftInfo.draftLink}`);
      } else {
        failCount++;
      }
    }

    log(`\n============================================================`);
    log('PROCESSING COMPLETE');
    log(`Successful: ${successCount}`);
    log(`Failed: ${failCount}`);
    log('============================================================');

    await browser.close();
    process.exit(0);

  } catch (e) {
    console.error("Fatal error:", e);
    await browser.close();
    process.exit(1);
  }
})();
