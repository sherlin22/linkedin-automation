/**
 * Gmail Draft Demo Script
 * 
 * This script demonstrates how the Gmail draft system works:
 * 1. Parse a sample resume (Vakul Sharma)
 * 2. Generate a critique using the template
 * 3. Create the email body
 * 4. Save the draft locally
 * 
 * Run: node scripts/demo_gmail_draft.js
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import helpers
const { getCritique, extractCandidateName } = require('./helpers/resume-critique-template');
const { parsePDF } = require('./helpers/resume-parser');
const { cleanMarkdownForEmail } = require('./helpers/gmail_draft');

// Gmail template
const GMAIL_TEMPLATE = `Dear {name},

Greetings!!!

PFA the proposal attached with the details needed to proceed further with the services.

Pls share a confirmation on the services you opt-in for:
- Resume Writing – Rs {resumePrice}/- INR – (As per the Experience, Customised Resume with a Result Oriented approach attracting opportunities)
- LinkedIn Optimisation – Rs {linkedinPrice}/- INR – (Help you Position yourself and will make stand out from the crowd)

To proceed, I've reviewed your resume and noticed areas for improvement that can significantly enhance its impact:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESUME CRITIQUE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{critique}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Next Steps

To proceed, kindly:
1. Confirm which services you would like to avail
2. Make a 80% advance payment to: UPI: deepas2093@sbi
3. Fill out and return the attached LinkedIn Glossary Sheet

Excited to support your career journey and help you unlock high-level opportunities!

Let's get started!

To Your Success,
Deepa Rajan
+91 9036846673
deeparajan890@gmail.com`;

// Configuration
const CONFIG = {
  sampleResumePath: path.join(__dirname, '../samples/sample_resume.pdf'),
  attachmentPath: path.join(__dirname, '../Linkedin Services_Glossary_2025.docx'),
  resumePrice: 2500,
  linkedinPrice: 2000
};

async function demoGmailDraft() {
  console.log('\n' + '='.repeat(70));
  console.log('📧 GMAIL DRAFT DEMO - How the Code Works');
  console.log('='.repeat(70));

  // Step 1: Parse the sample resume
  console.log('\n📄 STEP 1: Parsing Sample Resume');
  console.log('-'.repeat(50));
  
  const sampleResumePath = CONFIG.sampleResumePath;
  console.log('   Resume: ' + path.basename(sampleResumePath));
  
  if (!fs.existsSync(sampleResumePath)) {
    console.log('   ❌ Resume file not found!');
    return;
  }
  
  const parseResult = await parsePDF(sampleResumePath);
  if (!parseResult.success) {
    console.log('   ❌ Failed to parse resume');
    return;
  }
  
  console.log('   ✅ Resume parsed successfully');
  console.log('   📊 Length: ' + parseResult.text.length + ' characters');

  // Step 2: Extract candidate name
  console.log('\n👤 STEP 2: Extracting Candidate Name');
  console.log('-'.repeat(50));
  
  const candidateName = extractCandidateName(parseResult.text);
  console.log('   Candidate: ' + candidateName);

  // Step 3: Generate critique
  console.log('\n📝 STEP 3: Generating Resume Critique');
  console.log('-'.repeat(50));
  
  // Using the custom template (same for all resumes - no AI needed)
  const critiqueText = getCritique(candidateName);
  console.log('   ✅ Generated template-based critique');
  console.log('   📊 Length: ' + critiqueText.length + ' characters');

  // Step 4: Clean markdown (if using AI critique)
  console.log('\n🧹 STEP 4: Cleaning Markdown (if needed)');
  console.log('-'.repeat(50));
  
  const cleanedCritique = cleanMarkdownForEmail(critiqueText);
  console.log('   ✅ Markdown cleaned');
  console.log('   📊 Cleaned length: ' + cleanedCritique.length + ' characters');

  // Step 5: Build email body
  console.log('\n📧 STEP 5: Building Email Body');
  console.log('-'.repeat(50));
  
  let emailBody = GMAIL_TEMPLATE
    .replace('{name}', candidateName)
    .replace('{resumePrice}', CONFIG.resumePrice)
    .replace('{linkedinPrice}', CONFIG.linkedinPrice)
    .replace('{critique}', cleanedCritique);
  
  console.log('   ✅ Email body created');
  console.log('   📊 Total length: ' + emailBody.length + ' characters');

  // Step 6: Check attachment
  console.log('\n📎 STEP 6: Checking Attachment');
  console.log('-'.repeat(50));
  
  if (fs.existsSync(CONFIG.attachmentPath)) {
    console.log('   ✅ Attachment found: ' + path.basename(CONFIG.attachmentPath));
    const fileStats = fs.statSync(CONFIG.attachmentPath);
    console.log('   📊 Size: ' + (fileStats.size / 1024).toFixed(2) + ' KB');
  } else {
    console.log('   ⚠️ Attachment not found: ' + CONFIG.attachmentPath);
  }

  // Step 7: Save draft locally
  console.log('\n💾 STEP 7: Saving Draft Locally');
  console.log('-'.repeat(50));
  
  const outputDir = 'email_drafts';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const timestamp = Date.now();
  const filename = `demo_draft_${candidateName.replace(/\s+/g, '_')}_${timestamp}.txt`;
  const filePath = path.join(outputDir, filename);
  
  const draftContent = `GMAIL DRAFT DEMO
================================================================================
Generated: ${new Date().toISOString()}
Candidate: ${candidateName}
Resume: ${path.basename(sampleResumePath)}
================================================================================

TO: [recipient@example.com]
SUBJECT: Resume & LinkedIn Profile Enhancement Proposal for ${candidateName}

${emailBody}

================================================================================
ATTACHMENT: ${path.basename(CONFIG.attachmentPath)}
================================================================================
`;
  
  fs.writeFileSync(filePath, draftContent);
  console.log('   ✅ Draft saved to: ' + filePath);

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));
  console.log(`   Candidate:      ${candidateName}`);
  console.log(`   Resume:         ${path.basename(sampleResumePath)}`);
  console.log(`   Resume chars:   ${parseResult.text.length}`);
  console.log(`   Critique:       Template-based (8 points)`);
  console.log(`   Email length:   ${emailBody.length} characters`);
  console.log(`   Draft saved:    ${filePath}`);
  console.log('');
  console.log('📋 NEXT STEPS (to send to Gmail):');
  console.log('   1. Ensure google_token.json exists (OAuth credentials)');
  console.log('   2. Ensure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env');
  console.log('   3. Run: node scripts/create_gmail_draft.js');
  console.log('');
  console.log('💡 To use AI critique instead of template:');
  console.log('   1. Set GROQ_API_KEY in .env (get from https://console.groq.com)');
  console.log('   2. AI will generate personalized critique using Llama 3.3 70B');
  console.log('='.repeat(70) + '\n');

  return {
    candidateName,
    emailBody,
    critiqueText,
    draftPath: filePath
  };
}

// Run demo
demoGmailDraft()
  .then(result => {
    console.log('\n✅ Demo completed successfully!');
    console.log('\n📄 Preview the draft:');
    console.log('   cat ' + result.draftPath);
  })
  .catch(error => {
    console.error('\n❌ Demo failed:', error.message);
  });

