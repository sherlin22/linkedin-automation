// scripts/helpers/gmail_draft.js 
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { updateMetric } = require('./metrics-handler');
require('dotenv').config();

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

/**
 * ✅ Clean Markdown formatting from OpenAI response
 */
function cleanMarkdownForEmail(text) {
  if (!text) return text;
  
  let cleaned = text;
  
  // Remove ### headings - convert to UPPERCASE
  cleaned = cleaned.replace(/^###\s+(.+)$/gm, (match, heading) => {
    return heading.toUpperCase();
  });
  
  cleaned = cleaned.replace(/^##\s+(.+)$/gm, (match, heading) => {
    return heading.toUpperCase();
  });
  
  cleaned = cleaned.replace(/^#\s+(.+)$/gm, (match, heading) => {
    return heading.toUpperCase();
  });
  
  // Remove ** bold markers - keep text as is
  cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1');
  
  // Remove * italic markers
  cleaned = cleaned.replace(/\*(.+?)\*/g, '$1');
  
  // Remove _ italic markers
  cleaned = cleaned.replace(/_(.+?)_/g, '$1');
  
  // Remove ` code markers
  cleaned = cleaned.replace(/`(.+?)`/g, '$1');
  
  // Clean up bullet points - ensure consistent formatting
  cleaned = cleaned.replace(/^[\*\-]\s+/gm, '• ');
  
  // Remove extra blank lines (more than 2 consecutive)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  return cleaned.trim();
}

/**
 * Create Gmail draft with attachment
 */
async function createGmailDraft(options = {}) {
  try {
    const {
      clientName = 'Client',
      clientEmail = null,
      resumePrice = 2500,
      linkedinPrice = 2000,
      resumeCritique = 'Please provide feedback details'
    } = options;

    console.log('🔍 Checking Gmail credentials...');

    // Load OAuth token
    if (!fs.existsSync('google_token.json')) {
      return {
        success: false,
        skipped: true,
        message: 'google_token.json not found'
      };
    }

    const tokenData = JSON.parse(fs.readFileSync('google_token.json', 'utf8'));

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback'
    );

    oauth2Client.setCredentials(tokenData);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // ✅ Clean the critique before inserting into email
    const cleanedCritique = cleanMarkdownForEmail(resumeCritique);
    
    console.log('   🧹 Cleaned Markdown formatting from critique');

    // Build email body
    let emailBody = GMAIL_TEMPLATE
      .replace('{name}', clientName || 'Client')
      .replace('{resumePrice}', resumePrice)
      .replace('{linkedinPrice}', linkedinPrice)
      .replace('{critique}', cleanedCritique || 'Areas for improvement pending detailed review');

    // Build email with attachment
    const rawMessage = buildRawMessageWithAttachment({
      to: clientEmail || 'recipient@example.com',
      subject: `Resume & LinkedIn Profile Enhancement Proposal for ${clientName}`,
      body: emailBody,
      attachmentPath: path.join(__dirname, '../../Linkedin Services_Glossary_2025.docx')
    });

    console.log('   📄 Using OAuth google_token.json');
    console.log('   📎 Attaching: Linkedin Services_Glossary_2025.docx');

    // Create draft
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
    

    console.log(`   ✅ Gmail Draft created: ${draftId}`);
    console.log(`   ✅ Gmail Draft: ${draftLink}`);

    // 📊 METRICS TRACKING 
    const currentHour = new Date().getHours();
    let slot = 'slot1'; // default 8am
    
    if (currentHour >= 14 && currentHour < 18) {
      slot = 'slot2'; // 2pm slot
    } else if (currentHour >= 18) {
      slot = 'slot3'; // 6pm slot
    }
    
    updateMetric(slot, 'drafts', 1);
    console.log(`📊 Metrics: Updated ${slot} drafts count`);
    // END METRICS

    return {
      success: true,
      draftId: draftId,
      draftLink: draftLink,
      clientEmail: clientEmail,
      clientName: clientName
    };

  } catch (error) {
    console.error('❌ Gmail draft error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

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
  } else {
    console.warn('   ⚠️ Attachment file not found:', attachmentPath);
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

module.exports = {
  createGmailDraft,
  cleanMarkdownForEmail
};