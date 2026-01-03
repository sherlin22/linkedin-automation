// scripts/debug-logging.js - Test activity logging system

const fs = require('fs');
const path = require('path');

const LOGS_FILE = path.join(__dirname, '..', 'activity_logs.json');
const METRICS_FILE = path.join(__dirname, '..', 'n8n_metrics.json');

function loadLogs() {
  try {
    if (fs.existsSync(LOGS_FILE)) {
      return JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('Could not load logs:', e.message);
  }
  return { proposals: [], followups: [], downloads: [], drafts: [] };
}

function loadMetrics() {
  try {
    if (fs.existsSync(METRICS_FILE)) {
      return JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('Could not load metrics:', e.message);
  }
  return null;
}

async function testWebhooks() {
  console.log('\n🧪 Testing Activity Logging Webhooks\n');
  
  const testData = [
    {
      endpoint: '/api/automation/proposal-submitted',
      payload: {
        clientName: 'Test Proposal Client',
        email: 'proposal@test.com',
        threadId: 'test-thread-1',
        status: 'success'
      }
    },
    {
      endpoint: '/api/automation/followup-sent',
      payload: {
        clientName: 'Test Followup Client',
        email: 'followup@test.com',
        message: 'Test follow-up message',
        threadId: 'test-thread-2',
        status: 'success'
      }
    },
    {
      endpoint: '/api/automation/resume-downloaded',
      payload: {
        clientName: 'Test Download Client',
        fileName: 'test_resume.pdf',
        size: '150 KB',
        threadId: 'test-thread-3',
        status: 'success'
      }
    },
    {
      endpoint: '/api/automation/draft-created',
      payload: {
        clientName: 'Test Draft Client',
        email: 'draft@test.com',
        draftId: 'test-draft-123',
        subject: 'Test Resume Enhancement',
        status: 'success'
      }
    }
  ];

  for (const test of testData) {
    try {
      console.log(`📤 Testing: ${test.endpoint}`);
      
      const response = await fetch(`http://localhost:3000${test.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(test.payload)
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ Success: ${data.message}`);
        console.log(`   📊 Total: ${data.total}\n`);
      } else {
        console.log(`   ❌ Failed: ${response.status}\n`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }
  }
}

async function analyzeFiles() {
  console.log('\n📊 Analyzing Activity Logs and Metrics\n');
  
  // Load logs
  const logs = loadLogs();
  console.log('📝 Activity Logs:');
  console.log(`   Proposals: ${logs.proposals.length}`);
  console.log(`   Follow-ups: ${logs.followups.length}`);
  console.log(`   Downloads: ${logs.downloads.length}`);
  console.log(`   Drafts: ${logs.drafts.length}`);
  
  // Show sample entries
  if (logs.proposals.length > 0) {
    console.log('\n   Sample Proposal:');
    const sample = logs.proposals[logs.proposals.length - 1];
    console.log(`     Name: ${sample.name}`);
    console.log(`     Email: ${sample.email}`);
    console.log(`     Time: ${sample.timestamp}`);
  }
  
  // Load metrics
  const metrics = loadMetrics();
  if (metrics) {
    console.log('\n📈 Metrics:');
    Object.entries(metrics.slots).forEach(([slotName, data]) => {
      console.log(`\n   ${slotName} (${data.time}):`);
      console.log(`     Proposals: ${data.proposals}`);
      console.log(`     Follow-ups: ${data.followups}`);
      console.log(`     Downloads: ${data.downloads}`);
      console.log(`     Drafts: ${data.drafts}`);
    });
  }
  
  // Data validation
  console.log('\n✅ Validation:');
  const allNames = [
    ...logs.proposals.map(p => p.name),
    ...logs.followups.map(f => f.name),
    ...logs.downloads.map(d => d.name),
    ...logs.drafts.map(d => d.name)
  ];
  
  const validNames = allNames.filter(name => name && name.trim().length > 0 && name !== '=');
  const invalidNames = allNames.filter(name => !name || name.trim().length === 0 || name === '=');
  
  console.log(`   Valid entries: ${validNames.length}`);
  console.log(`   Invalid entries: ${invalidNames.length}`);
  
  if (invalidNames.length > 0) {
    console.log('\n   ⚠️  Issue: Found entries with invalid names (empty or "=")');
    console.log('   💡 Fix: Ensure N8N is sending proper clientName values\n');
  }
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🔧 DEBUG - Activity Logging System');
  console.log('='.repeat(60));
  
  // Check if server is running
  try {
    const response = await fetch('http://localhost:3000/health');
    if (response.ok) {
      console.log('\n✅ Server is running\n');
    }
  } catch (error) {
    console.log('\n❌ Server is not running!');
    console.log('   Start it with: npm start\n');
    process.exit(1);
  }
  
  // Run tests
  await testWebhooks();
  await analyzeFiles();
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  console.log('   1. Check N8N workflow field mappings');
  console.log('   2. Ensure clientName is passed with actual names (not empty or "=")');
  console.log('   3. Verify server logs show "✅ Proposal logged: NAME"');
  console.log('   4. Refresh dashboard at http://localhost:3000/dashboard.html\n');
}

main().catch(console.error);