// api/n8n-metrics.js - N8N metrics tracking
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const METRICS_FILE = path.join(__dirname, '..', 'n8n_metrics.json');

function loadMetrics() {
  try {
    if (fs.existsSync(METRICS_FILE)) {
      return JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('Could not load metrics:', e.message);
  }
  
  return {
    slots: {
      slot1: { time: '8am', proposals: 0, followups: 0, downloads: 0, drafts: 0 },
      slot2: { time: '2pm', proposals: 0, followups: 0, downloads: 0, drafts: 0 },
      slot3: { time: '6pm', proposals: 0, followups: 0, downloads: 0, drafts: 0 }
    },
    lastUpdate: new Date().toISOString()
  };
}

function saveMetrics(data) {
  try {
    fs.writeFileSync(METRICS_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Could not save metrics:', e.message);
    return false;
  }
}

// GET all metrics
router.get('/metrics', (req, res) => {
  console.log('📊 Fetching all metrics');
  const metrics = loadMetrics();
  res.json(metrics);
});

// GET specific slot
router.get('/metrics/:slot', (req, res) => {
  const metrics = loadMetrics();
  const slot = metrics.slots[req.params.slot];
  
  if (!slot) {
    return res.status(404).json({ error: 'Slot not found' });
  }
  
  res.json(slot);
});

// POST log slot completion
router.post('/slot-complete', (req, res) => {
  try {
    const { slotName, status, itemsProcessed, duration, message } = req.body;
    
    if (!slotName) {
      return res.status(400).json({ error: 'slotName required' });
    }

    const metrics = loadMetrics();
    
    metrics.slots[slotName] = {
      name: slotName,
      status: status || 'completed',
      itemsProcessed: itemsProcessed || 0,
      duration: duration || 0,
      message: message || '',
      timestamp: new Date().toISOString()
    };

    metrics.lastUpdate = new Date().toISOString();
    saveMetrics(metrics);

    console.log(`✅ N8N Slot recorded: ${slotName} (${status})`);
    res.json({ success: true, slot: metrics.slots[slotName] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;