/**
 * Create Complete Gmail Draft with Your Full Template
 * Includes services, pricing, resume critique, and experience analysis
 * 
 * Usage: node scripts/create_complete_draft.js
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { parsePDF } = require('./helpers/resume-parser');
require('dotenv').config();

// Load your custom critique template
const critiqueTemplate = require('./helpers/resume-critique-template');

// Configuration
const CONFIG = {
  resumePrice: 3000,
  linkedinPrice: 2500,
  senderName: 'Deepa Rajan',
  senderEmail: 'deeparajan890@gmail.com',
  upiId: 'deepas2093@sbi',
  phone: '+91 9036846673'
};

/**
 * Extract years of experience from resume
 */
function extractExperience(text) {
  const patterns = [
    /(\d{4})\s*[-–to]+\s*(\d{4}|present|current)/gi,
    /(\d+)\+?\s*years?\s*(of\s*)?(experience|exp)/gi
  ];

  let maxYears = 0;
  patterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(m => {
        const yearMatch = m.match(/(\d{4})/g);
        if (yearMatch && yearMatch.length >= 2) {
          const start = parseInt(yearMatch[0]);
          const end = yearMatch[1].toLowerCase() === 'present' ? 2025 : parseInt(yearMatch[1]);
          maxYears = Math.max(maxYears, end - start);
        }
        const expMatch = m.match(/(\d+)/);
        if (expMatch) maxYears = Math.max(maxYears, parseInt(expMatch[1]));
      });
    }
  });

  return maxYears || 0;
}

/**
 * Extract candidate name from resume
 */
function extractName(text) {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    if (firstLine.length > 2 && firstLine.length < 50 && !/[@•\-\d]/.test(firstLine)) {
      return firstLine;
    }
  }
  return 'Candidate';
}

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
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    body,
    ''
  ];

  // Add attachment if exists
  const attachmentPath = path.join(__dirname, '../../Linkedin Services_Glossary_2025.docx');
  if (fs.existsSync(attachmentPath)) {
    const fileContent = fs.readFileSync(attachmentPath);
    const attachmentContent = fileContent.toString('base64');
    const attachmentName = path.basename(attachmentPath);

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

  return messageParts.join('\r\n');
}

/**
 * Generate HTML email body with your complete template
 */
function generateEmailBody(candidateName, experienceYears, critique) {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background: #f5f5f5; padding: 15px; border-radius: 5px; }
    .services { background: #e8f4fc; padding: 15px; border-radius: margin: 15 5px;px 0; }
    .services h3 { margin-top: 0; color: #1a73e8; }
    .critique { background: #fff8e1; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #ffc107; }
    .critique h3 { margin-top: 0; color: #f57c00; }
    .next-steps { background: #e8f5e9; padding: 15px; border-radius: 5px; margin: 15px 0; }
    .next-steps h3 { margin-top: 0; color: #388e3c; }
    .footer { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-top: 15px; text-align: center; }
    .signature { font-weight: bold; color: #1a73e8; }
    .experience { font-weight: bold; color: #1976d2; }
  </style>
</head>
<body>
  <p>Dear <strong>${candidateName}</strong>,</p>
  
  <p>Greetings!!!</p>
  
  <p>PFA the proposal attached with the details needed to proceed further with the services.</p>
  
  <div class="services">
    <h3>Pls share a confirmation on the services you opt-in for:</h3>
    <p><strong>Resume Writing</strong> – Rs ${CONFIG.resumePrice}/- INR – (As per the Experience, Customised Resume with a Result Oriented approach attracting opportunities)</p>
    <p><strong>LinkedIn Optimisation</strong> – Rs ${CONFIG.linkedinPrice}/- INR – (Help you Position yourself and will make stand out from the crowd)</p>
  </div>
  
  <p>To proceed, I've reviewed your resume and noticed areas for improvement that can significantly enhance its impact:</p>
  
  <div class="critique">
    <h3>Profile Summary: ${experienceYears} Years of Experience</h3>
    <p class="experience">Analyzed Experience: ${experienceYears}+ years</p>
    <hr>
    <h3>Resume Critique</h3>
    ${critique.replace(/\n/g, '<br>').replace(/•/g, '&#8226;')}
  </div>
  
  <div class="next-steps">
    <h3>Next Steps</h3>
    <p>To proceed, kindly:</p>
    <ol>
      <li>Confirm which services you would like to avail</li>
      <li>Make a 80% advance payment to the details below:</li>
      <p><strong>UPI:</strong> ${CONFIG.upiId}</p>
      <li>Fill out and return the attached LinkedIn Glossary Sheet</li>
    </ol>
  </div>
  
  <p>Excited to support your leadership journey and help you unlock high-level opportunities across IT infrastructure, service delivery, and enterprise systems.</p>
  
  <p>Let's get started!</p>
  
  <div class="footer">
    <p class="signature">To Your Success,<br>${CONFIG.senderName}<br>${CONFIG.phone}<br>${CONFIG.senderEmail}</p>
  </div>
</body>
</html>`;
}

/**
 * Create Gmail draft
 */
async function createCompleteDraft(candidateName, candidateEmail, resumePath) {
  console.log('\n' + '='.repeat(60));
  console.log('CREATING COMPLETE GMAIL DRAFT');
  console.log('='.repeat(60));

  try {
    // Load OAuth token
    if (!fs.existsSync('google_token.json')) {
      return { success: false, error: 'google_token.json not found' };
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

    // Parse resume if path provided
    let experienceYears = 0;
    let resumeText = '';

    if (resumePath && fs.existsSync(resumePath)) {
      console.log(`\n📄 Parsing resume: ${path.basename(resumePath)}`);
      const result = await parsePDF(resumePath);
      if (result.success) {
        resumeText = result.text;
        experienceYears = extractExperience(resumeText);
        console.log(`   ✅ Extracted ${experienceYears} years of experience`);
      }
    }

    // Extract name if not provided
    if (resumeText && !candidateName) {
      candidateName = extractName(resumeText);
    }

    // Generate critique using your template
    console.log('📝 Generating critique with your template...');
    const critique = critiqueTemplate.getCritique(candidateName);

    // Generate email body
    const emailBody = generateEmailBody(candidateName, experienceYears, critique);

    // Build raw message
    const subject = `Resume & LinkedIn Profile Enhancement Proposal for ${candidateName}`;
    const rawMessage = buildEmailMessage({
      to: candidateEmail,
      subject: subject,
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

    // Save to file
    const outputDir = 'email_drafts';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `complete_draft_${candidateName.replace(/\s+/g, '_')}_${Date.now()}.txt`;
    const filePath = `${outputDir}/${filename}`;
    fs.writeFileSync(filePath, `COMPLETE EMAIL DRAFT
======================
To: ${candidateEmail}
Subject: ${subject}
Experience: ${experienceYears} years
Draft ID: ${draftId}
Link: ${draftLink}

${emailBody.replace(/<[^>]*>/g, '')}
`);
    console.log(`\n💾 Also saved to: ${filePath}`);

    console.log('\n' + '✅'.repeat(30));
    console.log('\n🎉 COMPLETE DRAFT CREATED SUCCESSFULLY!\n');
    console.log(`✅ Draft ID: ${draftId}`);
    console.log(`\n📬 View your draft:`);
    console.log(`   ${draftLink}`);
    console.log('\n   OR');
    console.log('   1. Open Gmail');
    console.log('   2. Click "Drafts" folder');
    console.log(`   3. Find email to: ${candidateEmail}`);

    return {
      success: true,
      draftId: draftId,
      draftLink: draftLink,
      candidateName: candidateName,
      experienceYears: experienceYears
    };

  } catch (error) {
    console.error('\n❌ Error creating draft:', error.message);
    return { success: false, error: error.message };
  }
}

// Main execution
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('COMPLETE GMAIL DRAFT WITH YOUR TEMPLATE');
  console.log('='.repeat(60));

  // Test with sample data (replace with actual candidate info)
  const testCandidate = {
    name: 'Yohan Akalanka',
    email: 'yohan.akalanka@example.com',  // Replace with actual email
    resumePath: 'downloads/resumes/resume_Yohan_1770630000000.pdf'  // Optional: path to resume PDF
  };

  console.log(`\n📧 Creating draft for: ${testCandidate.name} <${testCandidate.email}>`);
  console.log(`📄 Resume: ${testCandidate.resumePath || 'Not provided'}`);

  const result = await createCompleteDraft(
    testCandidate.name,
    testCandidate.email,
    testCandidate.resumePath
  );

  console.log('\n' + '='.repeat(60));
  if (result.success) {
    console.log('✅ DRAFT CREATED - Check your Gmail!');
  } else {
    console.log('❌ Failed to create draft');
  }
  console.log('='.repeat(60) + '\n');
}

main().catch(console.error);

// Export for use in other scripts
module.exports = {
  createCompleteDraft,
  generateEmailBody,
  extractExperience,
  extractName,
  CONFIG
};

