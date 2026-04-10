// Complete Resume Processing Workflow
// Downloads resume, parses it, saves to sheets, creates draft email
// Run: node scripts/process_complete_resume.js --name="Akash"

const { chromium } = require('playwright');
const minimist = require('minimist');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

// Import helpers
const { uploadToGoogleDrive } = require('./helpers/google_drive');
const { createGmailDraft } = require('./helpers/gmail_draft');
const { extractEmailFromResume, extractExperienceYears } = require('./helpers/resume-parser');
const { generateResumeCritique } = require('./helpers/openai_critique');
const { isValidCandidateName } = require('./helpers/validation-helpers');
const { appendToSheet } = require('../api/sheets-logger');

const args = minimist(process.argv.slice(2), {
  string: ["auth", "name"],
  default: {
    auth: "auth_state.json",
    name: ""
  }
});

// Helper: Check if resume is readable
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

// Helper: Calculate pricing based on experience
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

// MAIN WORKFLOW
(async () => {
  console.log('\n🚀 COMPLETE RESUME WORKFLOW');
  console.log('='.repeat(70));
  
  if (!args.name) {
    console.log('❌ Usage: node scripts/process_complete_resume.js --name="Akash"');
    process.exit(1);
  }
  
  const candidateName = args.name;
  console.log(`🎯 Processing: "${candidateName}"\n`);
  
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
    // STEP 1: Open LinkedIn and find conversation
    console.log('📱 Opening LinkedIn Messaging...');
    await page.goto("https://www.linkedin.com/messaging/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    
    if (/\/login|checkpoint/.test(page.url())) {
      throw new Error('Not logged in!');
    }
    
    console.log('🔍 Finding conversation...');
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
      throw new Error(`Could not find conversation with "${candidateName}"`);
    }
    
    // Open conversation
    await foundThread.click();
    await page.waitForTimeout(3000);
    
    // Load messages
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
    
    // STEP 2: Find and download attachment
    console.log('\n🔍 Looking for attachments...\n');
    
    const attachments = await page.evaluate(() => {
      const results = [];
      const buttons = document.querySelectorAll('.msg-s-event-listitem__download-attachment-button');
      
      buttons.forEach((btn, i) => {
        const filenameEl = btn.querySelector('.ui-attachment__filename');
        const filename = filenameEl ? filenameEl.innerText.trim() : `Attachment_${i + 1}`;
        const filesizeEl = btn.querySelector('.ui-attachment__filesize');
        const filesize = filesizeEl ? filesizeEl.innerText.trim() : '';
        
        results.push({
          index: i,
          filename: filename,
          filesize: filesize,
          button: btn
        });
      });
      return results;
    });
    
    if (attachments.length === 0) {
      throw new Error('No attachments found in conversation!');
    }
    
    console.log(`Found ${attachments.length} attachment(s):`);
    attachments.forEach((att, i) => {
      console.log(`   [${i + 1}] ${att.filename} (${att.filesize})`);
    });
    
    // Download the first attachment
    const att = attachments[0];
    console.log(`\n📥 Downloading: ${att.filename}...`);
    
    // Setup download directory
    const downloadDir = path.join(process.cwd(), 'downloads', 'resumes');
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }
    
    // Wait for download
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await att.button.click();
    
    const download = await downloadPromise;
    
    // Save file
    const safeName = candidateName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
    const ts = Date.now();
    const ext = path.extname(download.suggestedFilename()) || '.pdf';
    const fileName = `resume_${safeName}_${ts}${ext}`;
    const localPath = path.join(downloadDir, fileName);
    
    await download.saveAs(localPath);
    
    if (!fs.existsSync(localPath)) {
      throw new Error('Download failed - file not saved!');
    }
    
    const stats = fs.statSync(localPath);
    console.log(`✅ Downloaded: ${fileName} (${Math.round(stats.size / 1024)} KB)`);
    
    await browser.close();
    
    // STEP 3: Check readability
    console.log('\n📖 Checking resume readability...\n');
    const readable = await isResumeReadable(localPath);
    
    // STEP 4: Organize into readable/unreadable folder
    const category = readable ? 'readable' : 'unreadable';
    const categoryDir = path.join(downloadDir, category);
    if (!fs.existsSync(categoryDir)) {
      fs.mkdirSync(categoryDir, { recursive: true });
    }
    
    const finalPath = path.join(categoryDir, fileName);
    fs.copyFileSync(localPath, finalPath);
    console.log(`📁 Moved to: downloads/resumes/${category}/${fileName}`);
    
    // If unreadable, we're done (can't process further)
    if (!readable) {
      console.log('\n⚠️  Resume is not readable - workflow stopped here.');
      console.log(`   File saved at: ${finalPath}`);
      process.exit(0);
    }
    
    // STEP 5: Extract email from resume
    console.log('\n📧 Extracting email...\n');
    const emailResult = await extractEmailFromResume(finalPath, ext);
    const email = emailResult?.success ? emailResult.email : 'Not found';
    console.log(`   Email: ${email}`);
    
    // STEP 6: Extract experience
    console.log('\n📊 Extracting experience...\n');
    const expResult = await extractExperienceYears(finalPath, ext);
    const years = (expResult?.success && expResult.years !== null) ? expResult.years : 0;
    console.log(`   Experience: ${years} years`);
    
    // Calculate pricing
    const pricing = calculatePricing(years);
    console.log(`   💰 Resume Price: ₹${pricing.resume_price}`);
    console.log(`   💰 LinkedIn Price: ₹${pricing.linkedin_price}`);
    
    // STEP 7: Generate AI critique
    console.log('\n🤖 Generating AI critique...\n');
    const critiqueResult = await generateResumeCritique(finalPath, ext, candidateName);
    
    if (critiqueResult?.success) {
      console.log(`   ✅ Critique generated (${critiqueResult.critique.length} chars)`);
      console.log(`   📊 Tokens used: ${critiqueResult.tokens}`);
    } else {
      console.log(`   ❌ Critique failed: ${critiqueResult?.error}`);
    }
    
    // STEP 8: Upload to Google Drive
    console.log('\n☁️  Uploading to Google Drive...\n');
    const driveResult = await uploadToGoogleDrive(finalPath, fileName, candidateName, true);
    
    if (driveResult?.success) {
      console.log(`   ✅ Drive: ${driveResult.driveLink}`);
    } else {
      console.log(`   ⚠️  Drive upload failed or skipped`);
    }
    
    // STEP 9: Save to Google Sheets
    console.log('\n📗 Saving to Google Sheets...\n');
    
    try {
      const sheetData = {
        name: candidateName,
        email: email,
        experience_years: years,
        experience_range: pricing.experience_range,
        resume_price: pricing.resume_price,
        linkedin_price: pricing.linkedin_price,
        resume_path: `downloads/resumes/readable/${fileName}`,
        drive_link: driveResult?.driveLink || 'N/A',
        status: 'Processed',
        timestamp: new Date().toISOString()
      };
      
      const sheetResult = await appendToSheet(sheetData);
      if (sheetResult?.success) {
        console.log(`   ✅ Saved to Google Sheets`);
      } else {
        console.log(`   ⚠️  Sheet save failed: ${sheetResult?.error}`);
      }
    } catch (e) {
      console.log(`   ⚠️  Google Sheets error: ${e.message}`);
    }
    
    // STEP 10: Create Gmail draft
    console.log('\n📝 Creating Gmail draft...\n');
    const draftResult = await createGmailDraft({
      clientName: candidateName,
      clientEmail: email,
      resumePrice: pricing.resume_price,
      linkedinPrice: pricing.linkedin_price,
      resumeCritique: critiqueResult?.critique || 'Critique not available'
    });
    
    if (draftResult?.success) {
      console.log(`   ✅ Gmail Draft: ${draftResult.draftLink}`);
    } else if (draftResult?.skipped) {
      console.log(`   ⏭️  Skipped: ${draftResult.message}`);
    } else {
      console.log(`   ❌ Draft failed: ${draftResult?.error}`);
    }
    
    // FINAL SUMMARY
    console.log('\n' + '='.repeat(70));
    console.log('✅ WORKFLOW COMPLETE!');
    console.log('='.repeat(70));
    console.log('\n📋 SUMMARY:');
    console.log(`   Name: ${candidateName}`);
    console.log(`   Email: ${email}`);
    console.log(`   Experience: ${years} years (${pricing.experience_range})`);
    console.log(`   Resume: ${readable ? '✅ Readable' : '❌ Unreadable'}`);
    console.log(`   Drive: ${driveResult?.success ? '✅ Uploaded' : '❌ Failed'}`);
    console.log(`   Sheets: ${sheetResult?.success ? '✅ Saved' : '❌ Failed'}`);
    console.log(`   Draft: ${draftResult?.success ? '✅ Created' : draftResult?.skipped ? '⏭️ Skipped' : '❌ Failed'}`);
    console.log(`\n📁 Files: downloads/resumes/${category}/${fileName}`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await browser.close();
    process.exit(1);
  }
})();

