/**
 * Draft Test Email with Resume Critique
 * Generates a Gmail-ready email with your custom critique template
 * 
 * Usage: node scripts/draft_test_email.js
 */

const template = require('./helpers/resume-critique-template');
const fs = require('fs');

// Test candidate data
const testCandidate = {
  name: 'John Doe',
  email: 'john.doe@example.com'
};

console.log('='.repeat(60));
console.log('DRAFT EMAIL WITH RESUME CRITIQUE');
console.log('='.repeat(60));

// Generate Gmail-ready critique
const emailBody = template.getGmailCritique(testCandidate.name, 'Your Recruiting Team');

console.log('\n📧 EMAIL PREVIEW');
console.log('-'.repeat(60));
console.log(`To: ${testCandidate.email}`);
console.log(`Subject: Resume Review Feedback`);
console.log('-'.repeat(60));
console.log(emailBody);
console.log('-'.repeat(60));

// Save to email_drafts folder
const outputDir = 'email_drafts';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const timestamp = Date.now();
const filename = `draft_${testCandidate.name.replace(/\s+/g, '_')}_${timestamp}.txt`;
const filePath = `${outputDir}/${filename}`;

fs.writeFileSync(filePath, `TO: ${testCandidate.email}
SUBJECT: Resume Review Feedback

${emailBody}`);

console.log(`\n💾 Email saved to: ${filePath}`);

// Also display short version
console.log('\n' + '='.repeat(60));
console.log('📝 SHORT VERSION (4 Points)');
console.log('='.repeat(60));
const shortVersion = template.getShortCritique(testCandidate.name);
console.log(shortVersion);

console.log('\n' + '='.repeat(60));
console.log('✅ TEST EMAIL GENERATED SUCCESSFULLY!');
console.log('='.repeat(60));
console.log(`\n📌 Next Steps:`);
console.log(`   1. Copy email from: ${filePath}`);
console.log(`   2. Open Gmail`);
console.log(`   3. Draft new email to: ${testCandidate.email}`);
console.log(`   4. Paste the content and send`);
console.log(`\n🎯 All resumes get the same template - no AI needed!\n`);

