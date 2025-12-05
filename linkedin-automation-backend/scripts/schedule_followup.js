/**
 * scripts/schedule_followup.js
 *
 * Scans data/requests_log.json:
 *  - Schedule follow-ups (followupScheduledAt = timestamp + 5 hours) for drafted/proposal_sent items without a schedule.
 *  - Execute follow-ups that are due (followupScheduledAt <= now) by invoking step8_send_followup.js.
 *
 * This script is intended to be run via cron (e.g. every 10 minutes) or manually.
 */
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

const LOG_PATH = path.resolve(__dirname, '..', 'data', 'requests_log.json');
const SETTINGS = require('./scheduler_settings.json');

function ensureLog() {
  if (!fs.existsSync(path.dirname(LOG_PATH))) fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  if (!fs.existsSync(LOG_PATH)) fs.writeFileSync(LOG_PATH, '[]', 'utf8');
}
function readLog(){ ensureLog(); return JSON.parse(fs.readFileSync(LOG_PATH,'utf8')||'[]'); }
function writeLog(arr){ fs.writeFileSync(LOG_PATH, JSON.stringify(arr, null, 2),'utf8'); }

function isoAddHours(iso, h) {
  const d = new Date(iso);
  d.setHours(d.getHours() + h);
  return d.toISOString();
}

function todayDateISO() {
  const d = new Date();
  return d.toISOString().slice(0,10);
}

(async () => {
  const logs = readLog();

  // 1) Schedule any drafted/proposal_sent items that lack followupScheduledAt
  let changed = false;
  for (let i=0;i<logs.length;i++){
    const e = logs[i];
    if ((e.status === 'drafted' || e.status === 'proposal_sent') && !e.followupScheduledAt) {
      // schedule 5 hours after the original timestamp (or now if missing)
      const base = e.timestamp || new Date().toISOString();
      e.followupScheduledAt = isoAddHours(base, 5);
      logs[i] = e;
      changed = true;
      console.log('Scheduled follow-up for index', i, 'at', e.followupScheduledAt);
    }
  }
  if (changed) writeLog(logs);

  // 2) Count how many follow-ups have been sent today
  const today = todayDateISO();
  const sentToday = logs.filter(l => l.followupSentAt && l.followupSentAt.startsWith(today)).length;
  console.log('Follow-ups sent today:', sentToday);

  if (sentToday >= SETTINGS.maxPerDay) {
    console.log('Daily follow-up limit reached. Exiting.');
    process.exit(0);
  }

  // 3) Find due follow-ups (scheduled <= now) and process up to remaining quota
  const now = new Date().toISOString();
  const due = [];
  for (let i=0;i<logs.length;i++){
    const e = logs[i];
    if (e.followupScheduledAt && e.followupScheduledAt <= now && (!e.followupSentAt)) {
      due.push({ index: i, entry: e });
    }
  }

  if (due.length === 0) {
    console.log('No due follow-ups at this time.');
    process.exit(0);
  }

  const remaining = SETTINGS.maxPerDay - sentToday;
  const toProcess = due.slice(0, remaining);
  console.log('Processing', toProcess.length, 'due follow-ups (remaining quota', remaining, ')');

  for (let k=0;k<toProcess.length;k++){
    const item = toProcess[k];
    const idx = item.index;
    const entry = item.entry;
    // Respect a small random delay between actions
    const delay = Math.floor(Math.random()*(SETTINGS.maxDelaySeconds - SETTINGS.minDelaySeconds +1)) + SETTINGS.minDelaySeconds;
    console.log('Waiting', delay, 'seconds before processing index', idx);
    await new Promise(r => setTimeout(r, delay*1000));

    // Determine mode: draft or send
    const sendFlag = SETTINGS.sendMode === 'send' ? '--send' : '--dry-run';
    console.log('Invoking step8_send_followup for index', idx, 'mode', SETTINGS.sendMode);
    try {
      // call step8_send_followup with the log index
      child_process.execSync(`node "${path.join(__dirname,'step8_send_followup.js')}" ${idx} ${sendFlag}`, { stdio: 'inherit' });
      // After run, reload logs to inspect update
      const updated = readLog();
      if (updated[idx] && updated[idx].followupSentAt) {
        console.log('Entry', idx, 'marked followupSentAt', updated[idx].followupSentAt);
      } else if (updated[idx] && updated[idx].followupDraftedAt) {
        console.log('Entry', idx, 'marked followupDraftedAt', updated[idx].followupDraftedAt);
      } else {
        console.log('Entry', idx, 'updated but no followup timestamps found.');
      }
    } catch (err) {
      console.error('Error calling step8_send_followup for index', idx, err);
    }
  }

  console.log('Scheduler run complete.');

})();
