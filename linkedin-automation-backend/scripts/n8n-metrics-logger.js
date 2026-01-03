// scripts/n8n-metrics-logger.js
const { updateMetric } = require('./helpers/metrics-handler');

/**
 * Log metrics from n8n workflow
 * Usage from n8n: Call HTTP endpoint or execute this script
 * 
 * Example: node scripts/n8n-metrics-logger.js --slot=slot1 --metric=proposals --value=1
 */

const minimist = require('minimist');

const args = minimist(process.argv.slice(2), {
  string: ['slot', 'metric'],
  number: ['value'],
  default: {
    slot: 'slot1',
    metric: 'proposals',
    value: 1
  }
});

function logMetric() {
  const { slot, metric, value } = args;
  
  const validSlots = ['slot1', 'slot2', 'slot3'];
  const validMetrics = ['proposals', 'followups', 'downloads', 'drafts'];
  
  if (!validSlots.includes(slot)) {
    console.error(`❌ Invalid slot: ${slot}. Must be one of: ${validSlots.join(', ')}`);
    process.exit(1);
  }
  
  if (!validMetrics.includes(metric)) {
    console.error(`❌ Invalid metric: ${metric}. Must be one of: ${validMetrics.join(', ')}`);
    process.exit(1);
  }
  
  const result = updateMetric(slot, metric, value);
  
  if (result) {
    console.log(`✅ Updated ${slot} - ${metric}: +${value}`);
    console.log(`📊 Current ${slot}: ${JSON.stringify(result.slots[slot], null, 2)}`);
  } else {
    console.error('❌ Failed to update metric');
    process.exit(1);
  }
}

logMetric();