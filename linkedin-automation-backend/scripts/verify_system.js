// scripts/verify_system.js - COMPLETE SYSTEM VERIFICATION

const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(70));
console.log('🔍 LINKEDIN AUTOMATION - COMPLETE SYSTEM VERIFICATION');
console.log('='.repeat(70) + '\n');

const checks = {
  files: [],
  configs: [],
  data: [],
  status: 'ALL SYSTEMS GO ✅'
};

// ==================== FILE CHECKS ====================
console.log('📁 CHECKING FILES...\n');

const requiredFiles = [
  { path: 'google_token.json', desc: 'Google OAuth Token' },
  { path: 'auth_state.json', desc: 'LinkedIn Auth State' },
  { path: '.env', desc: 'Environment Variables' },
  { path: 'n8n_metrics.json', desc: 'Metrics File' },
  { path: 'activity_logs.json', desc: 'Activity Logs' },
  { path: 'proposals_state.json', desc: 'Proposals State' },
  { path: 'state_followups.json', desc: 'Follow-ups State' }
];

requiredFiles.forEach(file => {
  const exists = fs.existsSync(file.path);
  const status = exists ? '✅' : '⚠️';
  console.log(`${status} ${file.desc.padEnd(30)} - ${file.path}`);
  checks.files.push({ file: file.path, exists });
});

// ==================== HELPER FILES ====================
console.log('\n📚 CHECKING HELPER MODULES...\n');

const helperFiles = [
  'scripts/helpers/metrics-handler.js',
  'scripts/helpers/gmail_draft.js',
  'scripts/helpers/google_drive.js',
  'scripts/helpers/activity_logger.js',
  'scripts/helpers/resume-parser.js',
  'scripts/helpers/openai_critique.js'
];

helperFiles.forEach(file => {
  const exists = fs.existsSync(file);
  const status = exists ? '✅' : '❌';
  const name = file.split('/').pop();
  console.log(`${status} ${name}`);
  if (!exists) checks.status = 'MISSING FILES ❌';
});

// ==================== STEP SCRIPTS ====================
console.log('\n🚀 CHECKING AUTOMATION SCRIPTS...\n');

const stepScripts = [
  'scripts/step7_submit_proposal_loop.js',
  'scripts/step8_followup_message_loop.js',
  'scripts/step9_complete_resume_workflow.js'
];

stepScripts.forEach(file => {
  const exists = fs.existsSync(file);
  const status = exists ? '✅' : '❌';
  const name = file.split('/').pop();
  console.log(`${status} ${name}`);
  if (!exists) checks.status = 'MISSING SCRIPTS ❌';
});

// ==================== CONFIGURATION CHECK ====================
console.log('\n⚙️ CHECKING CONFIGURATIONS...\n');

// Check .env
if (fs.existsSync('.env')) {
  const env = fs.readFileSync('.env', 'utf8');
  const required = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'OPENAI_API_KEY'
  ];
  
  required.forEach(key => {
    const has = env.includes(key);
    console.log(`${has ? '✅' : '❌'} .env has ${key}`);
    checks.configs.push({ key, present: has });
  });
}

// Check n8n_metrics.json structure
if (fs.existsSync('n8n_metrics.json')) {
  try {
    const metrics = JSON.parse(fs.readFileSync('n8n_metrics.json', 'utf8'));
    const hasSlots = metrics.slots && 
                     metrics.slots.slot1 && 
                     metrics.slots.slot2 && 
                     metrics.slots.slot3;
    console.log(`${hasSlots ? '✅' : '❌'} Metrics has all 3 slots`);
    checks.data.push({ file: 'n8n_metrics.json', valid: hasSlots });
  } catch (e) {
    console.log('❌ Metrics JSON is invalid');
    checks.data.push({ file: 'n8n_metrics.json', valid: false });
  }
}

// Check activity_logs.json structure
if (fs.existsSync('activity_logs.json')) {
  try {
    const logs = JSON.parse(fs.readFileSync('activity_logs.json', 'utf8'));
    const hasLogs = logs.proposals && logs.followups && logs.downloads && logs.drafts;
    console.log(`${hasLogs ? '✅' : '❌'} Activity logs has all 4 categories`);
    console.log(`   • Proposals: ${logs.proposals?.length || 0}`);
    console.log(`   • Follow-ups: ${logs.followups?.length || 0}`);
    console.log(`   • Downloads: ${logs.downloads?.length || 0}`);
    console.log(`   • Drafts: ${logs.drafts?.length || 0}`);
    checks.data.push({ file: 'activity_logs.json', valid: hasLogs });
  } catch (e) {
    console.log('❌ Activity logs JSON is invalid');
    checks.data.push({ file: 'activity_logs.json', valid: false });
  }
}

// ==================== METRICS SUMMARY ====================
console.log('\n📊 METRICS SUMMARY...\n');

if (fs.existsSync('n8n_metrics.json')) {
  try {
    const metrics = JSON.parse(fs.readFileSync('n8n_metrics.json', 'utf8'));
    const slots = metrics.slots;
    
    let totalProposals = 0;
    let totalFollowups = 0;
    let totalDownloads = 0;
    let totalDrafts = 0;
    
    Object.entries(slots).forEach(([key, slot]) => {
      console.log(`\n${key.toUpperCase()} (${slot.time}):`);
      console.log(`   📝 Proposals: ${slot.proposals}`);
      console.log(`   💬 Follow-ups: ${slot.followups}`);
      console.log(`   ⬇️ Downloads: ${slot.downloads}`);
      console.log(`   ✉️ Drafts: ${slot.drafts}`);
      
      totalProposals += slot.proposals;
      totalFollowups += slot.followups;
      totalDownloads += slot.downloads;
      totalDrafts += slot.drafts;
    });
    
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`TOTALS ACROSS ALL SLOTS:`);
    console.log(`   📝 Total Proposals: ${totalProposals}`);
    console.log(`   💬 Total Follow-ups: ${totalFollowups}`);
    console.log(`   ⬇️ Total Downloads: ${totalDownloads}`);
    console.log(`   ✉️ Total Drafts: ${totalDrafts}`);
  } catch (e) {
    console.log('❌ Could not read metrics file');
  }
}

// ==================== QUICK COMMANDS ====================
console.log('\n\n🎯 NEXT STEPS - READY TO USE:\n');

console.log('1️⃣  TEST METRICS LOGGING:');
console.log('   $ node scripts/n8n-metrics-logger.js --slot=slot1 --metric=proposals --value=1\n');

console.log('2️⃣  VIEW DASHBOARD:');
console.log('   $ cd linkedin-automation-backend && npm start');
console.log('   Then visit: http://localhost:3000/dashboard.html\n');

console.log('3️⃣  RUN AUTOMATION STEPS:');
console.log('   Step 7 (Proposals):');
console.log('   $ node scripts/step7_submit_proposal_loop.js --auth=auth_state.json --confirm=true\n');

console.log('   Step 8 (Follow-ups):');
console.log('   $ node scripts/step8_followup_message_loop.js --auth=auth_state.json --confirm=true\n');

console.log('   Step 9 (Resumes):');
console.log('   $ node scripts/step9_complete_resume_workflow.js --auth=auth_state.json --confirm=true\n');

console.log('4️⃣  SCHEDULE WITH N8N:');
console.log('   Create workflow triggers for:');
console.log('   • 8:00 AM (slot1)')
console.log('   • 2:00 PM (slot2)');
console.log('   • 6:00 PM (slot3)\n');

// ==================== FINAL STATUS ====================
console.log('='.repeat(70));
console.log(`\n📋 SYSTEM STATUS: ${checks.status}\n`);

const fileIssues = checks.files.filter(f => !f.exists).length;
const configIssues = checks.configs.filter(f => !f.present).length;

if (fileIssues > 0) {
  console.log(`⚠️  MISSING FILES: ${fileIssues}`);
  checks.files.filter(f => !f.exists).forEach(f => {
    console.log(`   - ${f.file}`);
  });
}

if (configIssues > 0) {
  console.log(`\n⚠️  MISSING CONFIGS: ${configIssues}`);
  checks.configs.filter(f => !f.present).forEach(f => {
    console.log(`   - ${f.key}`);
  });
}

if (fileIssues === 0 && configIssues === 0) {
  console.log('✅ ALL SYSTEMS OPERATIONAL');
  console.log('✅ ALL FILES IN PLACE');
  console.log('✅ ALL CONFIGURATIONS SET');
  console.log('✅ READY FOR PRODUCTION\n');
} else {
  console.log('\n⚠️  Please fix the issues above before running automation\n');
}

console.log('='.repeat(70) + '\n');