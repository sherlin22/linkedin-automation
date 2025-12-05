# Complete LinkedIn Automation Setup

This document provides the complete setup instructions for your production-ready LinkedIn automation system.

See the following files for details:

## Core Documentation

1. **`public/AUTOMATION_USAGE_GUIDE.md`** - Comprehensive daily operations guide
2. **`public/RESUME_AUTOMATION_README.md`** - Quick start and reference
3. **`INTEGRATION_GUIDE.md`** - Integration instructions for existing scripts
4. **`SEND_CONFIRMATION_TROUBLESHOOTING.md`** - Debugging help

## System Components

### Playwright Scripts
- `scripts/step7_submit_proposal_loop.js` - Proposal submission (update required)
- `scripts/step8_followup_message_loop_FIXED.js` - Follow-up messages
- `scripts/step9_resume_to_email_loop.js` - Resume processing
- `scripts/getRecipientNameAndConfirmSend.js` - Name extraction helper

### Helper Modules (NEW)
- `scripts/config.js` - Central configuration
- `scripts/helpers/pricing.js` - Experience → Price mapping
- `scripts/helpers/resume-parser.js` - PDF/DOCX text extraction
- `scripts/helpers/google-services.js` - Drive, Sheets, Gmail APIs
- `scripts/helpers/openai-service.js` - AI critique generation
- `scripts/helpers/state-manager.js` - State persistence & daily limits

### n8n Workflow
- `n8n/workflows/ResumeHandlingCritique.json` - Complete automation workflow

### Test Files
- `scripts/test_integration.js` - Test name extraction
- `scripts/usage_examples.js` - Usage examples

## Quick Start

```bash
# 1. Install dependencies
npm install playwright pdf-parse mammoth googleapis

# 2. Install Playwright browser
npx playwright install chromium

# 3. LinkedIn login (one-time)
node scripts/step7_submit_proposal_loop.js --headful=true --auth=./linkedin_profile

# 4. Setup Google OAuth
# - Get credentials from https://console.cloud.google.com
# - Enable: Drive API, Sheets API, Gmail API
# - Download as google_credentials.json
node scripts/setup/google_auth.js

# 5. Add OpenAI key
echo "OPENAI_API_KEY=sk-your-key-here" >> .env

# 6. Install and start n8n
npm install -g n8n
n8n start

# 7. Import n8n workflow
# Open http://localhost:5678
# Import: n8n/workflows/ResumeHandlingCritique.json

# 8. Test
node scripts/step7_submit_proposal_loop.js --dry-run --headful=true --limit=2

# 9. Run production
node scripts/step7_submit_proposal_loop.js --confirm --limit=20
```

## Configuration

All settings are in `scripts/config.js`:

- `DAILY_LIMIT: 20` - Max proposals per day
- `FOLLOWUP_DELAY_HOURS: 5` - Follow-up timing
- `PROPOSAL_TEMPLATE` - Your proposal message (already configured with Deepa's template)
- `EMAIL_BODY_TEMPLATE` - Gmail draft template
- `PRICING_CHART` - Experience tiers and prices

## Integration Required

You need to integrate the new helper modules into your existing scripts:

### Step 7 (Proposal Submission)
Replace the current name detection and template code with:

```javascript
const { getRecipientNameAndConfirmSend } = require('./getRecipientNameAndConfirmSend');
const config = require('./config');
const stateManager = require('./helpers/state-manager');

// ... in your main loop:

// Load state and check daily limit
let state = stateManager.loadState();
state = stateManager.resetDailyCountIfNeeded(state);

if (stateManager.isDailyLimitReached(state)) {
  console.log(`🛑 Daily limit reached: ${stateManager.getTodayCount(state)}/${config.DAILY_LIMIT}`);
  process.exit(0);
}

// Get recipient name and fill proposal
const { name, sendStatus, debugFiles } = await getRecipientNameAndConfirmSend(
  page,
  dialog,
  cardInfo,
  {
    performSend: CONFIRM_MODE,
    proposalText: config.PROPOSAL_TEMPLATE.replace('(client_name)', name || 'there'),
    submitButtonSelector: config.SELECTORS.submitButton,
    maxWaitForClose: config.SUBMIT_CONFIRMATION_TIMEOUT,
    retryOnce: true
  }
);

// Add to state
if (sendStatus === 'success') {
  stateManager.addProposal(state, {
    proposal_id: `prop_${Date.now()}`,
    linkedin_thread_id: threadId,
    recipient_name: name,
    recipient_profile_url: profileUrl,
    submitted_at: new Date().toISOString(),
    debug_files: debugFiles
  });
  
  // Post to n8n webhook
  await fetch(config.N8N_WEBHOOK_PROPOSAL_SUBMITTED, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      proposal_id: `prop_${Date.now()}`,
      linkedin_thread_id: threadId,
      recipient_name: name,
      recipient_profile_url: profileUrl,
      submitted_at: new Date().toISOString()
    })
  });
}
```

See `INTEGRATION_GUIDE.md` for complete integration patches.

## Daily Operations

```bash
# Start n8n (Terminal 1)
n8n start

# Run automation (Terminal 2)
node scripts/step7_submit_proposal_loop.js --confirm

# Pause if needed
touch /tmp/linkedin_pause

# Resume
rm /tmp/linkedin_pause
node scripts/step7_submit_proposal_loop.js --confirm

# Check today's count
cat automation_state.json | jq '.proposals | map(select(.date == "'$(date +%Y-%m-%d)'")) | length'
```

## Monitoring

- **Console**: Real-time progress logs
- **Google Sheet**: Complete audit trail (configure sheet ID in n8n)
- **Gmail Drafts**: Review before sending
- **debug_artifacts/**: Screenshots + HTML on errors

## Support

For detailed documentation, see:
- `public/AUTOMATION_USAGE_GUIDE.md` - Complete usage guide
- `public/RESUME_AUTOMATION_README.md` - Quick reference
- `INTEGRATION_GUIDE.md` - Integration patches
- `SEND_CONFIRMATION_TROUBLESHOOTING.md` - Debugging

## System Flow

```
1. Playwright detects LinkedIn requests
   ↓
2. Opens proposal modal & fills template
   ↓
3. Extracts recipient name
   ↓
4. Sends proposal (if --confirm)
   ↓
5. Posts to n8n webhook
   ↓
6. n8n waits 5 hours
   ↓
7. Checks if resume received
   ↓
8. If not, sends follow-up
   ↓
9. When resume received:
   - Upload to Drive
   - OpenAI critique
   - Create Gmail draft
   - Log to Google Sheet
```

## Files Created

This setup created the following new files:

1. `scripts/config.js` - Central configuration
2. `scripts/helpers/pricing.js` - Pricing logic
3. `scripts/helpers/resume-parser.js` - Resume text extraction
4. `scripts/helpers/google-services.js` - Google API wrapper
5. `scripts/helpers/openai-service.js` - OpenAI critique
6. `scripts/helpers/state-manager.js` - State & limits
7. `n8n/workflows/ResumeHandlingCritique.json` - n8n workflow
8. This file - Complete setup guide

## Next Steps

1. ✅ Review `scripts/config.js` and adjust settings
2. ✅ Complete Google OAuth setup
3. ✅ Add OpenAI API key
4. ✅ Import n8n workflow
5. ✅ Create `attachments/Linkedin Services_Glossary_2025.docx`
6. ✅ Integrate helpers into step7/step8/step9 (see INTEGRATION_GUIDE.md)
7. ✅ Test with `--dry-run`
8. ✅ Run production

---

**System is ready!** Start with test mode:
```bash
node scripts/step7_submit_proposal_loop.js --dry-run --headful=true --limit=2
```
