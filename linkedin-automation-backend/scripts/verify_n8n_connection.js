// scripts/verify_n8n_connection.js - CHECK N8N INTEGRATION

const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('\n' + '='.repeat(80));
console.log('🔗 N8N INTEGRATION VERIFICATION');
console.log('='.repeat(80) + '\n');

// ==================== CHECK 1: N8N FILE ====================
console.log('1️⃣  CHECKING N8N FILES...\n');

const n8nFiles = [
  { path: 'n8n_workflows/linkedin_automation.json', desc: 'Main Workflow' },
  { path: 'n8n_credentials.json', desc: 'N8N Credentials' }
];

let hasN8nFiles = false;
n8nFiles.forEach(file => {
  const exists = fs.existsSync(file.path);
  const status = exists ? '✅' : '⚠️';
  console.log(`${status} ${file.desc.padEnd(30)} - ${file.path}`);
  if (exists) hasN8nFiles = true;
});

// ==================== CHECK 2: N8N SERVICE RUNNING ====================
console.log('\n2️⃣  CHECKING IF N8N IS RUNNING...\n');

const checkN8nPort = (port) => {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/v1/workflows`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000);
  });
};

(async () => {
  const n8nPort = 5678; // Default N8N port
  const isRunning = await checkN8nPort(n8nPort);
  
  if (isRunning) {
    console.log(`✅ N8N IS RUNNING on http://localhost:${n8nPort}`);
    console.log(`   Access N8N: http://localhost:${n8nPort}/`);
  } else {
    console.log(`❌ N8N IS NOT RUNNING on port ${n8nPort}`);
    console.log(`   To start N8N: npm start (in n8n directory)`);
    console.log(`   Or: docker run -it -p 5678:5678 n8nio/n8n\n`);
  }

  // ==================== CHECK 3: WEBHOOK SETUP ====================
  console.log('\n3️⃣  CHECKING WEBHOOK CONFIGURATION...\n');

  const webhookConfig = {
    trigger_endpoint: 'http://localhost:3000/api/n8n/trigger',
    metrics_endpoint: 'http://localhost:3000/api/n8n/metrics',
    webhook_timeout: 30000
  };

  console.log('Expected N8N Webhook Endpoints:');
  console.log(`   • Trigger: ${webhookConfig.trigger_endpoint}`);
  console.log(`   • Metrics: ${webhookConfig.metrics_endpoint}\n`);

  // ==================== CHECK 4: METRIC SYNC ====================
  console.log('4️⃣  CHECKING METRICS SYNC...\n');

  if (fs.existsSync('n8n_metrics.json')) {
    const metrics = JSON.parse(fs.readFileSync('n8n_metrics.json', 'utf8'));
    const lastUpdate = new Date(metrics.lastUpdate);
    const timeSinceUpdate = Date.now() - lastUpdate.getTime();
    const minutesAgo = Math.round(timeSinceUpdate / 60000);

    console.log(`Last Metrics Update: ${minutesAgo} minutes ago`);
    console.log(`   Time: ${lastUpdate.toLocaleString()}\n`);

    if (minutesAgo < 60) {
      console.log('✅ Metrics are being updated (N8N likely connected)');
    } else if (minutesAgo < 1440) {
      console.log('⚠️  Metrics haven\'t been updated in a while');
    } else {
      console.log('❌ Metrics haven\'t been updated in over 24 hours');
    }
  }

  // ==================== CHECK 5: ACTIVITY LOG SYNC ====================
  console.log('\n5️⃣  CHECKING ACTIVITY LOG SYNC...\n');

  if (fs.existsSync('activity_logs.json')) {
    const logs = JSON.parse(fs.readFileSync('activity_logs.json', 'utf8'));
    
    const lastProposal = logs.proposals?.[logs.proposals.length - 1];
    const lastFollowup = logs.followups?.[logs.followups.length - 1];
    const lastDownload = logs.downloads?.[logs.downloads.length - 1];
    const lastDraft = logs.drafts?.[logs.drafts.length - 1];

    console.log('Last Activities Recorded:');
    if (lastProposal) {
      const time = new Date(lastProposal.timestamp).toLocaleString();
      console.log(`   📝 Proposal: ${lastProposal.name} at ${time}`);
    }
    if (lastFollowup) {
      const time = new Date(lastFollowup.timestamp).toLocaleString();
      console.log(`   💬 Follow-up: ${lastFollowup.name} at ${time}`);
    }
    if (lastDownload) {
      const time = new Date(lastDownload.timestamp).toLocaleString();
      console.log(`   ⬇️ Download: ${lastDownload.name} at ${time}`);
    }
    if (lastDraft) {
      const time = new Date(lastDraft.timestamp).toLocaleString();
      console.log(`   ✉️ Draft: ${lastDraft.name} at ${time}`);
    }
  }

  // ==================== CHECK 6: EXPECTED WORKFLOW ====================
  console.log('\n\n6️⃣  EXPECTED N8N WORKFLOW STRUCTURE...\n');

  const expectedWorkflow = `
  ┌─────────────────────────────────────────────────────────────┐
  │                    N8N WORKFLOW SETUP                       │
  ├─────────────────────────────────────────────────────────────┤
  │                                                             │
  │  TRIGGER 1: Every day at 8:00 AM (slot1)                    │
  │  ├─ Execute: Step 7 (Proposals)                             │
  │  │  └─ updateMetric(slot1, 'proposals', count)              │
  │  ├─ Execute: Step 8 (Follow-ups)                            │
  │  │  └─ updateMetric(slot1, 'followups', count)              │
  │  └─ Execute: Step 9 (Downloads)                             │
  │     └─ updateMetric(slot1, 'downloads', count)              │
  │                                                             │
  │  TRIGGER 2: Every day at 2:00 PM (slot2)                    │
  │  ├─ Execute: Step 7, 8, 9                                   │
  │  │  └─ updateMetric(slot2, ...)                             │
  │                                                             │
  │  TRIGGER 3: Every day at 6:00 PM (slot3)                    │
  │  ├─ Execute: Step 7, 8, 9                                   │
  │  │  └─ updateMetric(slot3, ...)                             │
  │                                                             │
  │  SYNC ENDPOINT:                                             │
  │  └─ POST /api/n8n/metrics                                   │
  │     └─ Sync n8n_metrics.json with Dashboard                 │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘
  `;

  console.log(expectedWorkflow);

  // ==================== CHECK 7: CONNECTION STATUS ====================
  console.log('\n7️⃣  CONNECTION STATUS SUMMARY...\n');

  const connectionStates = {
    'N8N Service': isRunning ? '✅' : '❌',
    'Metrics File': fs.existsSync('n8n_metrics.json') ? '✅' : '⚠️',
    'Activity Logs': fs.existsSync('activity_logs.json') ? '✅' : '⚠️',
    'Helper Scripts': fs.existsSync('scripts/helpers/metrics-handler.js') ? '✅' : '❌',
    'Step Scripts': fs.existsSync('scripts/step7_submit_proposal_loop.js') ? '✅' : '❌'
  };

  Object.entries(connectionStates).forEach(([key, status]) => {
    console.log(`${status} ${key.padEnd(20)}`);
  });

  // ==================== SETUP INSTRUCTIONS ====================
  console.log('\n\n' + '='.repeat(80));
  console.log('📋 SETUP INSTRUCTIONS');
  console.log('='.repeat(80) + '\n');

  if (!isRunning) {
    console.log('STEP 1: START N8N\n');
    console.log('Option A - Using npm:');
    console.log('  $ cd /path/to/n8n');
    console.log('  $ npm start\n');
    console.log('Option B - Using Docker:');
    console.log('  $ docker run -it -p 5678:5678 n8nio/n8n\n');
    console.log('Option C - Using Docker Compose:');
    console.log('  $ docker-compose up -d n8n\n');
  }

  console.log('STEP 2: CREATE N8N WORKFLOW\n');
  console.log('1. Go to http://localhost:5678');
  console.log('2. Create a new workflow');
  console.log('3. Add three CRON triggers:\n');

  console.log('   TRIGGER 1 (8:00 AM):');
  console.log('   ├─ Cron: "0 8 * * *"');
  console.log('   ├─ Execute: node scripts/step7_submit_proposal_loop.js --auth=auth_state.json --confirm=true');
  console.log('   ├─ Execute: node scripts/step8_followup_message_loop.js --auth=auth_state.json --confirm=true');
  console.log('   └─ Execute: node scripts/step9_complete_resume_workflow.js --auth=auth_state.json --confirm=true\n');

  console.log('   TRIGGER 2 (2:00 PM):');
  console.log('   ├─ Cron: "0 14 * * *"');
  console.log('   └─ Same execution nodes as above\n');

  console.log('   TRIGGER 3 (6:00 PM):');
  console.log('   ├─ Cron: "0 18 * * *"');
  console.log('   └─ Same execution nodes as above\n');

  console.log('STEP 3: ADD EXECUTION NODES\n');
  console.log('For each trigger, add Execute Command nodes with:\n');

  console.log('   Execute Command 1 (Step 7 - Proposals):');
  console.log('   $ cd /path/to/linkedin-automation-backend && node scripts/step7_submit_proposal_loop.js --auth=auth_state.json --confirm=true\n');

  console.log('   Execute Command 2 (Step 8 - Follow-ups):');
  console.log('   $ cd /path/to/linkedin-automation-backend && node scripts/step8_followup_message_loop.js --auth=auth_state.json --confirm=true\n');

  console.log('   Execute Command 3 (Step 9 - Downloads):');
  console.log('   $ cd /path/to/linkedin-automation-backend && node scripts/step9_complete_resume_workflow.js --auth=auth_state.json --confirm=true\n');

  console.log('STEP 4: ADD METRICS SYNC NODE\n');
  console.log('Add a webhook/HTTP call node:\n');
  console.log('   Method: POST');
  console.log('   URL: http://localhost:3000/api/n8n/metrics');
  console.log('   Body: { "metrics": "<current metrics from n8n_metrics.json>" }\n');

  console.log('STEP 5: TEST CONNECTION\n');
  console.log('1. Click "Test" in N8N');
  console.log('2. Check if metrics update in dashboard');
  console.log('3. Visit: http://localhost:3000/dashboard.html');
  console.log('4. Should see updated metrics after workflow execution\n');

  // ==================== MANUAL TEST ====================
  console.log('\n' + '='.repeat(80));
  console.log('🧪 MANUAL TEST - VERIFY EVERYTHING WORKS');
  console.log('='.repeat(80) + '\n');

  console.log('TEST 1: Update Metrics Manually\n');
  console.log('$ node scripts/n8n-metrics-logger.js --slot=slot1 --metric=proposals --value=1\n');
  console.log('Then check: http://localhost:3000/dashboard.html\n');

  console.log('TEST 2: Run Step Scripts Individually\n');
  console.log('$ node scripts/step7_submit_proposal_loop.js --auth=auth_state.json --headful=true\n');
  console.log('(This will show you if proposals are being submitted)\n');

  console.log('TEST 3: Check Activity Logs Real-Time\n');
  console.log('Watch file changes with:');
  console.log('$ watch -n 1 "cat activity_logs.json | jq"\n');

  // ==================== FINAL STATUS ====================
  console.log('\n' + '='.repeat(80));
  console.log('✅ VERIFICATION COMPLETE');
  console.log('='.repeat(80) + '\n');

  if (isRunning) {
    console.log('✅ YOUR SYSTEM IS READY FOR N8N INTEGRATION');
    console.log('📝 Follow STEP 2-5 above to create your N8N workflow\n');
  } else {
    console.log('⚠️  N8N IS NOT RUNNING YET');
    console.log('🚀 Follow STEP 1 above to start N8N first\n');
  }

  console.log('Dashboard URL: http://localhost:3000/dashboard.html');
  console.log('N8N URL: http://localhost:5678');
  console.log('Metrics File: ./n8n_metrics.json');
  console.log('Activity Logs: ./activity_logs.json\n');

})();