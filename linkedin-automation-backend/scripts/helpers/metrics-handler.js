// scripts/helpers/metrics-handler.js
const fs = require('fs');
const path = require('path');

const METRICS_FILE = path.join(process.cwd(), 'n8n_metrics.json');

function loadMetrics() {
  try {
    if (fs.existsSync(METRICS_FILE)) {
      return JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('Failed to load metrics:', e.message);
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

function saveMetrics(metrics) {
  try {
    fs.writeFileSync(METRICS_FILE, JSON.stringify(metrics, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Failed to save metrics:', e.message);
    return false;
  }
}

function updateMetric(slot, metricType, increment = 1) {
  const metrics = loadMetrics();
  
  if (metrics.slots[slot] && metrics.slots[slot][metricType] !== undefined) {
    metrics.slots[slot][metricType] += increment;
    metrics.lastUpdate = new Date().toISOString();
    saveMetrics(metrics);
    return metrics;
  }
  
  return null;
}

module.exports = {
  loadMetrics,
  saveMetrics,
  updateMetric
};