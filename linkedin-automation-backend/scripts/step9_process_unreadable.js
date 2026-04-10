// scripts/step9_process_unreadable.js - Process Local Unreadable Files Only
// Fixed: Uses HIGH-CONVERSION prompt from groq-resume-critique.js

const fs = require("fs");
const path = require("path");
const minimist = require("minimist");
const mammoth = require('mammoth');

require('dotenv').config();

const args = minimist(process.argv.slice(2), {
  string: ["state"],
  boolean: ["confirm", "test"],
  default: {
    state: "resume_processing_state_ALL.json",
    confirm: false,
    test: false,
    max: 100
  }
});

args.max = Number(args.max) || 100;

// Import helper modules
const { uploadToGoogleDrive } = require('./helpers/google_drive');
const { createGmailDraft } = require('./helpers/gmail_draft');
const { extractEmailFromResume, extractExperienceYears, parsePDF } = require('./helpers/resume-parser');
const { CandidateWorkflowLogger } = require('./helpers/candidate-workflow-logger');
// Use the HIGH-CONVERSION prompt module!
const { generateHighConversionCritique, RESUME_CRITIQUE_SYSTEM_PROMPT, RESUME_CRITIQUE_USER_PROMPT } = require('./helpers/groq-resume-critique');

function log(...a) { console.log(...a); }

let logger = null;

// Base path for resumes
const RESUMES_BASE_PATH = path.join(process.cwd(), 'downloads', 'resumes');

/**
 * Generate critique using HIGH-CONVERSION Groq prompt
 */
async function generateCritiqueWithGroq(resumeText, candidateName) {
  try {
    // Use the HIGH-CONVERSION prompt from groq-resume-critique.js
    const result = await generateHighConversionCritique(resumeText, candidateName);
    
    if (result.success) {
      return { 
        success: true, 
        critique: result.critique, 
        tokens: result.tokens || 0 
      };
    } else {
      return { success: false, error: result.error, critique: '' };
    }
  } catch (e) {
    return { success: false, error: e.message, critique: '' };
  }
}

/**
 * Initialize the Google Sheet logger
 */
async function initLogger() {
  logger = new CandidateWorkflowLogger();
  const ready = await logger.initialize();
  if (ready) {
    await logger.ensureHeaders();
    log('✅ Google Sheet logger initialized');
  } else {
    log('⚠️  Google Sheet not available');
  }
  return ready;
}

/**
 * Parse any file type and return text
 */
async function parseResumeFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  try {
    if (ext === '.docx') {
      const result = await mammoth.extractRawText({ path: filePath });
      return { success: true, text: result.value, method: 'mammoth' };
    } else if (ext === '.pdf') {
      const result = await parsePDF(filePath);
      return result;
    } else {
      return { success: false, error: 'Unsupported file type: ' + ext };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Search for a file by candidate name in the resumes folder
 */
function findFileByName(candidateName) {
  try {
    const files = fs.readdirSync(RESUMES_BASE_PATH);
    
    for (const file of files) {
      const fileLower = file.toLowerCase();
      const nameLower = candidateName.toLowerCase();
      
      const nameParts = nameLower.split(' ').filter(p => p.length > 1);
      
      let match = nameParts.length > 0 && nameParts.every(part => {
        const partClean = part.replace(/[^a-z0-9]/g, '');
        return partClean.length > 2 && fileLower.includes(partClean);
      });
      
      if (match) {
        const fullPath = path.join(RESUMES_BASE_PATH, file);
        log(`   🔍 Found: ${file}`);
        return fullPath;
      }
    }
    
    log(`   ⚠️  No file found for: ${candidateName}`);
    return null;
  } catch (e) {
    log(`   ❌ Error finding file: ${e.message}`);
    return null;
  }
}

/**
 * Load unreadable files from state
 */
function loadUnreadableFiles() {
  const statePath = path.join(process.cwd(), args.state);
  
  if (!fs.existsSync(statePath)) {
    log('❌ State file not found:', args.state);
    return [];
  }

  try {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const unreadable = state.unreadable || [];
    log(`📁 Found ${unreadable.length} unreadable entries in state\n`);
    
    const filesWithPaths = unreadable.map(file => {
      const actualPath = findFileByName(file.name);
      return {
        ...file,
        foundPath: actualPath,
        localPath: actualPath || file.localPath
      };
    }).filter(f => f.foundPath);
    
    log(`📊 Found matching files for ${filesWithPaths.length} candidates\n`);
    return filesWithPaths;
  } catch (e) {
    log('❌ Error reading state file:', e.message);
    return [];
  }
}

function getFileExtension(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ext || '.pdf';
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

async function updateGoogleSheet(name, email, fileName) {
  if (!logger || !logger.isInitialized) {
    log('   ⚠️  Logger not available - skipping sheet update');
    return false;
  }
  
  try {
    const rowIndex = await logger.findOrCreateCandidateRow(name);
    if (!rowIndex) {
      log('   ⚠️  Could not find/create row in sheet');
      return false;
    }
    
    const range = `'${logger.sheetName}'!G${rowIndex}:J${rowIndex}`;
    await logger.sheets.spreadsheets.values.update({
      spreadsheetId: logger.sheetId,
      range: range,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[name, 'Success/Readable', email || 'N/A', 'Yes']]
      }
    });
    
    const draftStatusRange = `'${logger.sheetName}'!K${rowIndex}`;
    await logger.sheets.spreadsheets.values.update({
      spreadsheetId: logger.sheetId,
      range: draftStatusRange,
      valueInputOption: 'RAW',
      requestBody: {
        values: [['Success']]
      }
    });
    
    log(`   ✅ Updated Google Sheet: Row ${rowIndex}`);
    return true;
  } catch (e) {
    log(`   ❌ Sheet update error: ${e.message}`);
    return false;
  }
}

async function processLocalResume(fileInfo) {
  const { name, fileName, foundPath: localPath } = fileInfo;
  
  log(`\n${"=".repeat(60)}`);
  log(`🔄 Processing: ${name}`);
  log(`   File: ${fileName}`);
  log(`   Path: ${localPath}`);
  log(`${"=".repeat(60)}`);
  
  if (!fs.existsSync(localPath)) {
    log(`   ❌ File not found: ${localPath}`);
    return { success: false, error: 'File not found' };
  }
  
  const ext = getFileExtension(localPath);
  log(`   📄 Extension: ${ext}`);
  
  // Step 1: Parse and extract email
  log(`\n1️⃣  PARSING RESUME`);
  const emailResult = await extractEmailFromResume(localPath, ext);
  
  let email = null;
  if (emailResult.success) {
    email = emailResult.email;
    log(`   ✅ Email: ${email}`);
  } else {
    log(`   ⚠️  No email found`);
  }
  
  // Step 2: Extract experience
  log(`\n2️⃣  EXTRACTING EXPERIENCE`);
  const expResult = await extractExperienceYears(localPath, ext);
  
  let years = 0;
  if (expResult.success && expResult.years) {
    years = expResult.years;
    log(`   ✅ Experience: ${years} years`);
  } else {
    log(`   ⚠️  Experience unknown`);
  }
  
  const pricing = calculatePricing(years);
  log(`   💰 Pricing - Resume: ₹${pricing.resume_price}, LinkedIn: ₹${pricing.linkedin_price}`);
  
  // Step 3: Parse file and generate critique using HIGH-CONVERSION Groq prompt
  log(`\n3️⃣  GENERATING CRITIQUE (HIGH-CONVERSION PROMPT)`);
  
  const parseResult = await parseResumeFile(localPath);
  if (!parseResult.success) {
    log(`   ❌ Parse failed: ${parseResult.error}`);
    return { success: false, error: 'Parse failed' };
  }
  
  log(`   📄 Parsed ${parseResult.text.length} characters using ${parseResult.method}`);
  
  // Call Groq with HIGH-CONVERSION prompt
  const critiqueResult = await generateCritiqueWithGroq(parseResult.text, name);
  
  let critique = '';
  if (critiqueResult.success) {
    critique = critiqueResult.critique;
    log(`   ✅ Critique generated (${critique.length} chars, ${critiqueResult.tokens} tokens)`);
  } else {
    log(`   ❌ Critique failed: ${critiqueResult.error}`);
    return { success: false, error: 'Critique failed' };
  }
  
  // Step 4: Upload to Drive
  log(`\n4️⃣  UPLOADING TO GOOGLE DRIVE`);
  const driveResult = await uploadToGoogleDrive(localPath, path.basename(localPath), name, true);
  
  if (driveResult.success) {
    log(`   ✅ Drive: ${driveResult.driveLink}`);
  } else {
    log(`   ⚠️  Drive upload failed`);
  }
  
  // Step 5: Create Gmail draft
  log(`\n5️⃣  CREATING GMAIL DRAFT`);
  const draftResult = await createGmailDraft({
    clientName: name,
    clientEmail: email,
    resumePrice: pricing.resume_price,
    linkedinPrice: pricing.linkedin_price,
    resumeCritique: critique
  });
  
  let draftId = null;
  let draftLink = null;
  if (draftResult.success) {
    draftId = draftResult.draftId;
    draftLink = draftResult.draftLink;
    log(`   ✅ Draft created: ${draftLink}`);
  } else if (draftResult.skipped) {
    log(`   ⏭️  Skipped: ${draftResult.message}`);
  } else {
    log(`   ❌ Draft failed: ${draftResult.error}`);
    return { success: false, error: 'Draft creation failed' };
  }
  
  // Step 6: Update Google Sheet
  log(`\n6️⃣  UPDATING GOOGLE SHEET`);
  await updateGoogleSheet(name, email, path.basename(localPath));
  
  log(`\n✅ COMPLETE: ${name}`);
  
  return {
    success: true,
    name,
    fileName: path.basename(localPath),
    email,
    years,
    pricing,
    critique,
    driveLink: driveResult.driveLink,
    draftId,
    draftLink
  };
}

function saveMapping(result) {
  try {
    const mappingPath = path.join(process.cwd(), 'draft_linkedin_mapping.json');
    let mappingData = [];
    
    if (fs.existsSync(mappingPath)) {
      try {
        mappingData = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
        if (!Array.isArray(mappingData)) mappingData = [];
      } catch (e) {
        mappingData = [];
      }
    }
    
    const firstName = result.name.split(' ')[0];
    
    const record = {
      draftId: result.draftId,
      linkedinName: result.name,
      linkedinThreadId: 'N/A - processed from unreadable',
      clientEmail: result.email,
      firstName: firstName,
      status: 'draft_pending',
      reprocessed: true,
      source: 'unreadable_reprocess',
      createdAt: new Date().toISOString()
    };
    
    mappingData.push(record);
    fs.writeFileSync(mappingPath, JSON.stringify(mappingData, null, 2), 'utf8');
    log(`   📝 Saved mapping for ${result.name}`);
    return true;
  } catch (e) {
    log(`   ❌ Failed to save mapping: ${e.message}`);
    return false;
  }
}

function updateState(name) {
  try {
    const statePath = path.join(process.cwd(), args.state);
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    
    const unreadable = state.unreadable || [];
    const index = unreadable.findIndex(u => u.name === name);
    
    if (index >= 0) {
      const file = unreadable[index];
      unreadable.splice(index, 1);
      
      if (!state.readable) state.readable = [];
      state.readable.push({
        ...file,
        reprocessed: true,
        reprocessedAt: new Date().toISOString()
      });
      
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
      log(`   📁 Moved ${name} from unreadable to readable`);
      return true;
    }
    
    return false;
  } catch (e) {
    log(`   ❌ Failed to update state: ${e.message}`);
    return false;
  }
}

// Main function
(async () => {
  log('\n🚀 STEP 9: Process Unreadable Files - HIGH-CONVERSION PROMPT');
  log('='.repeat(60));
  log('Processing resumes from local storage\n');
  
  if (!fs.existsSync(RESUMES_BASE_PATH)) {
    log(`❌ Resumes folder not found: ${RESUMES_BASE_PATH}`);
    process.exit(1);
  }
  
  const filesInFolder = fs.readdirSync(RESUMES_BASE_PATH).length;
  log(`📁 Resumes folder: ${RESUMES_BASE_PATH}`);
  log(`📊 Files in folder: ${filesInFolder}\n`);
  
  log('📊 Initializing Google Sheet logger...');
  await initLogger();
  
  const unreadableFiles = loadUnreadableFiles();
  
  if (unreadableFiles.length === 0) {
    log('⚠️  No matching files found in resumes folder');
    process.exit(0);
  }
  
  log(`📊 Total files to process: ${unreadableFiles.length}`);
  log(`📊 Max to process: ${args.max}\n`);
  
  if (args.test) {
    log('🧪 TEST MODE - Will not create actual drafts\n');
  }
  
  let processed = 0;
  let success = 0;
  let failed = 0;
  
  for (const fileInfo of unreadableFiles) {
    if (processed >= args.max) {
      log(`\n⚠️  Reached max limit: ${args.max}`);
      break;
    }
    
    try {
      if (args.test) {
        log(`\n🧪 Would process: ${fileInfo.name} - ${fileInfo.fileName}`);
        processed++;
        continue;
      }
      
      const result = await processLocalResume(fileInfo);
      
      if (result.success) {
        success++;
        saveMapping(result);
        updateState(fileInfo.name);
      } else {
        failed++;
        log(`\n❌ Failed: ${fileInfo.name} - ${result.error}`);
      }
      
    } catch (e) {
      failed++;
      log(`\n❌ Error processing ${fileInfo.name}: ${e.message}`);
    }
    
    processed++;
    await new Promise(r => setTimeout(r, 1000));
  }
  
  log(`\n${"=".repeat(60)}`);
  log(`🏁 PROCESSING COMPLETE`);
  log(`${"=".repeat(60)}`);
  log(`   • Total processed: ${processed}`);
  log(`   • Success: ${success}`);
  log(`   • Failed: ${failed}`);
  
  if (!args.confirm && !args.test) {
    log(`\n💡 This was a DRY RUN`);
    log(`   Use --confirm=true to actually process files`);
  }
  
})();

