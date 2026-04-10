/**
 * Send Gmail Draft Script
 * 
 * Creates an actual Gmail draft for Vakul Sharma
 * with resume critique and proposal attachment
 * 
 * Run: node scripts/send_gmail_draft.js
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
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
  recipientEmail: 'vakulsharma28@gmail.com',  // From the resume
  recipientName: 'Vakul Sharma',
  resumePrice: 2500,
  linkedinPrice: 2000
};

/**
 * Build RFC 2822 formatted message with attachment
 */
function buildRawMessageWithAttachment(options = {}) {
  const { to = '', subject = '', body = '', attachmentPath = '' } = options;
  const boundary = '----=_Part_' + Date.now();
  
  // Read attachment file
  let attachmentContent = '';
  let attachmentName = 'Linkedin Services_Glossary_2025.docx';
  
  if (attachmentPath && fs.existsSync(attachmentPath)) {
    const fileContent = fs.readFileSync(attachmentPath);
    attachmentContent = fileContent.toString('base64');
    attachmentName = path.basename(attachmentPath);
  }

  const messageParts = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    body,
    ''
  ];

  // Add attachment if exists
  if (attachmentContent) {
    messageParts.push(
      `--${boundary}`,
      'Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${attachmentName}"`,
      '',
      attachmentContent,
      ''
    );
  }

  messageParts.push(`--${boundary}--`);

  const message = messageParts.join('\r\n');

  // Encode to base64url
  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function sendGmailDraft() {
  console.log('\n' + '='.repeat(70));
  console.log('📧 SENDING GMAIL DRAFT TO GMAIL');
  console.log('='.repeat(70));

  try {
    // Step 1: Check OAuth token
    console.log('\n🔐 Checking Gmail credentials...');
    const tokenPath = 'google_token.json';
    if (!fs.existsSync(tokenPath)) {
      console.log('❌ google_token.json not found!');
      console.log('   Run: node scripts/setup_oauth.js');
      return;
    }
    console.log('   ✅ google_token.json found');

    // Step 2: Load OAuth token
    const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));

    // Step 3: Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback'
    );

    oauth2Client.setCredentials(tokenData);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Step 4: Parse sample resume
    console.log('\n📄 Parsing sample resume...');
    if (!fs.existsSync(CONFIG.sampleResumePath)) {
      console.log('   ❌ Resume file not found!');
      return;
    }
    const parseResult = await parsePDF(CONFIG.sampleResumePath);
    console.log('   ✅ Resume parsed (' + parseResult.text.length + ' chars)');

    // Step 5: Extract candidate name
    const candidateName = extractCandidateName(parseResult.text);
    console.log('\n👤 Candidate: ' + candidateName);

    // Step 6: Generate critique
    console.log('\n📝 Generating critique...');
    let critiqueText = getCritique(candidateName);
    critiqueText = cleanMarkdownForEmail(critiqueText);
    console.log('   ✅ Critique generated (' + critiqueText.length + ' chars)');

    // Step 7: Build email body
    console.log('\n📧 Building email body...');
    let emailBody = GMAIL_TEMPLATE
      .replace('{name}', candidateName)
      .replace('{resumePrice}', CONFIG.resumePrice)
      .replace('{linkedinPrice}', CONFIG.linkedinPrice)
      .replace('{critique}', critiqueText);
    console.log('   ✅ Email body ready (' + emailBody.length + ' chars)');

    // Step 8: Check attachment
    console.log('\n📎 Checking attachment...');
    if (!fs.existsSync(CONFIG.attachmentPath)) {
      console.log('   ⚠️ Attachment not found, proceeding without it');
    } else {
      console.log('   ✅ Attachment: ' + path.basename(CONFIG.attachmentPath));
    }

    // Step 9: Build raw message
    const subject = `Resume & LinkedIn Profile Enhancement Proposal for ${candidateName}`;
    const rawMessage = buildRawMessageWithAttachment({
      to: CONFIG.recipientEmail,
      subject: subject,
      body: emailBody,
      attachmentPath: CONFIG.attachmentPath
    });
    console.log('\n📨 Message built with attachment');

    // Step 10: Create Gmail draft
    console.log('\n🚀 Creating Gmail draft...');
    const result = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          raw: rawMessage
        }
      }
    });

    const draftId = result.data.id;
    const draftLink = `https://mail.google.com/mail/u/0/#drafts/${draftId}`;

    console.log('\n' + '='.repeat(70));
    console.log('✅ GMAIL DRAFT CREATED SUCCESSFULLY!');
    console.log('='.repeat(70));
    console.log('');
    console.log('📬 Draft ID:    ' + draftId);
    console.log('📧 To:          ' + CONFIG.recipientEmail);
    console.log('👤 Name:        ' + candidateName);
    console.log('📝 Subject:     ' + subject);
    console.log('');
    console.log('🔗 View Draft:  ' + draftLink);
    console.log('');
    console.log('💡 Next Steps:');
    console.log('   1. Open Gmail');
    console.log('   2. Go to Drafts folder');
    console.log('   3. Review and click Send');
    console.log('');
    console.log('📎 Attachment: Linkedin Services_Glossary_2025.docx');
    console.log('='.repeat(70) + '\n');

    // Save draft info
    const draftInfo = {
      draftId,
      draftLink,
      recipientEmail: CONFIG.recipientEmail,
      recipientName: candidateName,
      subject,
      createdAt: new Date().toISOString()
    };
    
    fs.writeFileSync(
      'email_drafts/last_draft_info.json',
      JSON.stringify(draftInfo, null, 2)
    );
    console.log('💾 Draft info saved to: email_drafts/last_draft_info.json');

    return draftInfo;

  } catch (error) {
    console.error('\n❌ Error creating Gmail draft:', error.message);
    console.error(error.stack);
    return { success: false, error: error.message };
  }
}

// Run
sendGmailDraft()
  .then(result => {
    if (result && result.success !== false) {
      console.log('\n✅ Draft created! Check your Gmail drafts.');
    } else {
      console.log('\n❌ Failed to create draft');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n❌ Unexpected error:', error.message);
    process.exit(1);
  });

