/**
 * Create Gmail Draft with Your Custom Critique Template
 * Creates an actual draft in your Gmail account
 * 
 * Usage: node scripts/create_gmail_draft.js
 * 
 * Requirements:
 * - google_token.json (OAuth credentials)
 * - GOOGLE_CLIENT_ID in .env
 * - GOOGLE_CLIENT_SECRET in .env
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Load your custom critique template
const template = require('./helpers/resume-critique-template');

// Configuration
const CONFIG = {
  testEmail: 'john.doe@example.com',  // Replace with your email to test
  subject: 'Resume Review Feedback - Your Custom Critique',
  senderName: 'Your Recruiting Team'
};

/**
 * Build RFC 2822 email message
 */
function buildEmailMessage(options = {}) {
  const { to, subject, body } = options;
  const boundary = 'boundary_' + Date.now();

  const messageParts = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    body,
    '',
    `--${boundary}--`
  ];

  return messageParts.join('\r\n');
}

/**
 * Create Gmail draft
 */
async function createGmailDraftWithTemplate(candidateName, candidateEmail) {
  console.log('\n' + '='.repeat(60));
  console.log('CREATING GMAIL DRAFT WITH YOUR CRITIQUE TEMPLATE');
  console.log('='.repeat(60));

  try {
    // Check for OAuth token
    const tokenPath = 'google_token.json';
    if (!fs.existsSync(tokenPath)) {
      console.log('\n❌ ERROR: google_token.json not found!');
      console.log('\n📋 To set up Gmail API:');
      console.log('   1. Go to Google Cloud Console: https://console.cloud.google.com');
      console.log('   2. Create a project or select existing');
      console.log('   3. Enable Gmail API');
      console.log('   4. Create OAuth 2.0 credentials');
      console.log('   5. Download and save as: google_token.json');
      console.log('\n   Or run: node scripts/setup_oauth.js');
      return { success: false, error: 'Missing google_token.json' };
    }

    console.log('\n✅ google_token.json found');

    // Load credentials
    const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback'
    );

    oauth2Client.setCredentials(tokenData);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Generate email body using your template
    console.log('📝 Generating email with your custom template...');
    const emailBody = template.getGmailCritique(candidateName, CONFIG.senderName);

    // Build raw message
    const rawMessage = buildEmailMessage({
      to: candidateEmail,
      subject: CONFIG.subject.replace('{name}', candidateName),
      body: emailBody
    });

    // Encode to base64url
    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    // Create draft
    console.log('📧 Creating Gmail draft...');
    const response = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          raw: encodedMessage
        }
      }
    });

    const draftId = response.data.id;
    const draftLink = `https://mail.google.com/mail/u/0/#drafts/${draftId}`;

    console.log('\n' + '✅'.repeat(30));
    console.log('\n🎉 GMAIL DRAFT CREATED SUCCESSFULLY!\n');
    console.log('✅ Draft ID:', draftId);
    console.log('\n📬 View your draft:');
    console.log('   ' + draftLink);
    console.log('\n   OR');
    console.log('   1. Open Gmail');
    console.log('   2. Click "Drafts" folder');
    console.log('   3. Find the email to: ' + candidateEmail);

    // Also save to file
    const outputDir = 'email_drafts';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const filename = `gmail_draft_${candidateName.replace(/\s+/g, '_')}_${Date.now()}.txt`;
    const filePath = `${outputDir}/${filename}`;
    fs.writeFileSync(filePath, `GMAIL DRAFT SAVED
=====================
Draft ID: ${draftId}
Link: ${draftLink}
To: ${candidateEmail}
Subject: ${CONFIG.subject.replace('{name}', candidateName)}

${emailBody}
`);
    console.log(`\n💾 Also saved to: ${filePath}`);

    return {
      success: true,
      draftId: draftId,
      draftLink: draftLink,
      to: candidateEmail,
      subject: CONFIG.subject
    };

  } catch (error) {
    console.error('\n❌ Error creating draft:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Quick check - verify Gmail credentials
 */
async function checkGmailStatus() {
  console.log('\n📋 Gmail API Status Check');
  console.log('-'.repeat(40));

  // Check .env
  if (!process.env.GOOGLE_CLIENT_ID) {
    console.log('⚠️  GOOGLE_CLIENT_ID not set in .env');
  } else {
    console.log('✅ GOOGLE_CLIENT_ID configured');
  }

  if (!process.env.GOOGLE_CLIENT_SECRET) {
    console.log('⚠️  GOOGLE_CLIENT_SECRET not set in .env');
  } else {
    console.log('✅ GOOGLE_CLIENT_SECRET configured');
  }

  // Check token
  if (!fs.existsSync('google_token.json')) {
    console.log('⚠️  google_token.json not found');
    console.log('   Run: node scripts/setup_oauth.js');
  } else {
    console.log('✅ google_token.json found');
  }

  console.log('');
}

// Main execution
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('GMAIL DRAFT WITH CUSTOM CRITIQUE TEMPLATE');
  console.log('='.repeat(60));

  // Check status
  await checkGmailStatus();

  // Create draft for test candidate
  const testCandidate = {
    name: 'John Doe',
    email: CONFIG.testEmail
  };

  console.log(`\n📧 Creating draft for: ${testCandidate.name} <${testCandidate.email}>`);

  const result = await createGmailDraftWithTemplate(testCandidate.name, testCandidate.email);

  console.log('\n' + '='.repeat(60));
  if (result.success) {
    console.log('✅ DRAFT CREATED - Check your Gmail!');
  } else {
    console.log('❌ Failed to create draft');
    console.log('   Follow setup instructions above');
  }
  console.log('='.repeat(60) + '\n');
}

main().catch(console.error);

