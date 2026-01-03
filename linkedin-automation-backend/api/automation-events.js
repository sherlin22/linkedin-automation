// api/automation-events.js - LinkedIn automation events logging
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const LOGS_FILE = path.join(__dirname, '..', 'activity_logs.json');

// Helper: Load logs
function loadLogs() {
  try {
    if (fs.existsSync(LOGS_FILE)) {
      return JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('Failed to load logs:', e.message);
  }
  
  return {
    proposals: [],
    followups: [],
    downloads: [],
    drafts: []
  };
}

// Helper: Save logs
function saveLogs(data) {
  try {
    fs.writeFileSync(LOGS_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Failed to save logs:', e.message);
    return false;
  }
}

// POST proposal submitted
router.post('/proposal-submitted', async (req, res) => {
  try {
    const { clientName, email, threadId, status = 'success' } = req.body;

    console.log('📝 Logging proposal:', clientName);

    const logs = loadLogs();
    
    logs.proposals.push({
      name: clientName || 'Unknown',
      email: email || 'N/A',
      threadId: threadId || 'N/A',
      status: status,
      timestamp: new Date().toISOString()
    });

    saveLogs(logs);

    console.log(`✅ Proposal logged: ${clientName}`);
    res.json({ success: true, message: 'Proposal logged', data: logs.proposals.length });
  } catch (error) {
    console.error('❌ Error logging proposal:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST followup sent
router.post('/followup-sent', async (req, res) => {
  try {
    const { clientName, email, message, threadId, status = 'success' } = req.body;

    console.log('💬 Logging follow-up:', clientName);

    const logs = loadLogs();
    
    logs.followups.push({
      name: clientName || 'Unknown',
      email: email || 'N/A',
      message: message || 'Follow-up message sent',
      threadId: threadId || 'N/A',
      status: status,
      timestamp: new Date().toISOString()
    });

    saveLogs(logs);

    console.log(`✅ Follow-up logged: ${clientName}`);
    res.json({ success: true, message: 'Follow-up logged', data: logs.followups.length });
  } catch (error) {
    console.error('❌ Error logging follow-up:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST resume downloaded
router.post('/resume-downloaded', async (req, res) => {
  try {
    const { clientName, fileName, size, threadId, status = 'success' } = req.body;

    console.log('📥 Logging download:', clientName);

    const logs = loadLogs();
    
    logs.downloads.push({
      name: clientName || 'Unknown',
      fileName: fileName || 'N/A',
      size: size || 'N/A',
      threadId: threadId || 'N/A',
      status: status,
      timestamp: new Date().toISOString()
    });

    saveLogs(logs);

    console.log(`✅ Download logged: ${clientName}`);
    res.json({ success: true, message: 'Download logged', data: logs.downloads.length });
  } catch (error) {
    console.error('❌ Error logging download:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST draft created
router.post('/draft-created', async (req, res) => {
  try {
    const { clientName, email, draftId, subject, status = 'success' } = req.body;

    console.log('✉️  Logging draft:', clientName);

    const logs = loadLogs();
    
    logs.drafts.push({
      name: clientName || 'Unknown',
      email: email || 'N/A',
      draftId: draftId || 'N/A',
      subject: subject || 'Resume & LinkedIn Profile Enhancement',
      status: status,
      timestamp: new Date().toISOString()
    });

    saveLogs(logs);

    console.log(`✅ Draft logged: ${clientName}`);
    res.json({ success: true, message: 'Draft logged', data: logs.drafts.length });
  } catch (error) {
    console.error('❌ Error logging draft:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST batch events
router.post('/batch', async (req, res) => {
  try {
    const { events } = req.body;

    if (!Array.isArray(events)) {
      return res.status(400).json({ error: 'events must be an array' });
    }

    const logs = loadLogs();
    let added = 0;

    for (const event of events) {
      const { type, name, email, status = 'success' } = event;

      if (type === 'proposal') {
        logs.proposals.push({
          name: name || 'Unknown',
          email: email || 'N/A',
          status: status,
          timestamp: new Date().toISOString()
        });
        added++;
      } else if (type === 'followup') {
        logs.followups.push({
          name: name || 'Unknown',
          email: email || 'N/A',
          status: status,
          timestamp: new Date().toISOString()
        });
        added++;
      } else if (type === 'download') {
        logs.downloads.push({
          name: name || 'Unknown',
          status: status,
          timestamp: new Date().toISOString()
        });
        added++;
      } else if (type === 'draft') {
        logs.drafts.push({
          name: name || 'Unknown',
          email: email || 'N/A',
          status: status,
          timestamp: new Date().toISOString()
        });
        added++;
      }
    }

    saveLogs(logs);

    console.log(`✅ Batch logged: ${added} events`);
    res.json({ success: true, eventsLogged: added });
  } catch (error) {
    console.error('❌ Error logging batch:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET all logs
router.get('/logs', (req, res) => {
  try {
    const logs = loadLogs();
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;