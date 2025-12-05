/**
 * scripts/step7_log_request.js
 * Usage:
 *  - Append: node step7_log_request.js append '{"threadUrl":"...","name":"...","status":"drafted","proposalPath":"scripts/draft_message.png","followupScheduledAt":"..."}'
 *  - List:   node step7_log_request.js list
 */
const fs = require('fs');
const path = require('path');

const LOG_PATH = path.resolve(__dirname, '..', 'data', 'requests_log.json');

function ensureLog() {
  if (!fs.existsSync(path.dirname(LOG_PATH))) fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  if (!fs.existsSync(LOG_PATH)) fs.writeFileSync(LOG_PATH, '[]', 'utf8');
}

function readLog() {
  ensureLog();
  try {
    const raw = fs.readFileSync(LOG_PATH, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    console.error('Failed to read log:', e);
    return [];
  }
}

function writeLog(arr) {
  fs.writeFileSync(LOG_PATH, JSON.stringify(arr, null, 2), 'utf8');
}

function appendEntry(obj) {
  const logs = readLog();
  logs.push(obj);
  writeLog(logs);
  return obj;
}

function usage() {
  console.log('Usage:');
  console.log('  node step7_log_request.js append \'{"threadUrl":"...","name":"...","status":"drafted"}\'');
  console.log('  node step7_log_request.js list');
  process.exit(1);
}

(async () => {
  const argv = process.argv.slice(2);
  if (!argv[0]) usage();
  const cmd = argv[0];

  if (cmd === 'list') {
    const logs = readLog();
    console.log(`Total entries: ${logs.length}`);
    console.log(JSON.stringify(logs.slice(-20), null, 2));
    process.exit(0);
  }

  if (cmd === 'append') {
    if (!argv[1]) {
      console.error('append requires a JSON object argument');
      usage();
    }
    let entry;
    try {
      entry = JSON.parse(argv[1]);
    } catch (e) {
      console.error('Invalid JSON:', e.message);
      process.exit(1);
    }
    // add timestamp if missing
    if (!entry.timestamp) entry.timestamp = new Date().toISOString();
    appendEntry(entry);
    console.log('Appended entry:', entry);
    process.exit(0);
  }

  usage();
})();
