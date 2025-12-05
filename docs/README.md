Main Documentation 
# LinkedIn Automation System

> **Complete end-to-end automation for LinkedIn service marketplace - from proposal submission to resume analysis and client communication**

## 🎯 What This System Does

This automation handles the entire client acquisition and resume processing workflow:

```
LinkedIn Service Request → Submit Proposal → Send Follow-up → 
Download Resume → Analyze → Upload to Drive → AI Critique → 
Gmail Draft with Pricing
```

### Business Impact

- **Time Saved**: 95% reduction in manual work (from 2 hours to 6 minutes per client)
- **Scale**: Process 50+ resumes per day
- **Accuracy**: Automated pricing, no calculation errors
- **Organization**: All resumes organized in Google Drive by date and readability

### Key Features

✅ **Automated Proposal Submission** - Finds and submits personalized proposals  
✅ **Smart Follow-ups** - Sends "Share your resume" messages automatically  
✅ **Resume Download** - Detects and downloads resume attachments  
✅ **AI Analysis** - OpenAI-powered resume critique  
✅ **Dynamic Pricing** - Experience-based pricing (0-12+ years)  
✅ **Google Drive Integration** - Organized folder structure  
✅ **Gmail Drafts** - Ready-to-send proposals with pricing  
✅ **State Management** - Never duplicate work  

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    LINKEDIN AUTOMATION FLOW                      │
└─────────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │  LinkedIn    │
    │  Marketplace │
    └──────┬───────┘
           │
           ▼
    ┌──────────────────┐
    │   STEP 7         │  ← Submit Proposals
    │   Playwright     │    • Detect client names
    │   Browser Auto   │    • Fill forms
    └────────┬─────────┘    • Track state
             │
             ▼
    ┌──────────────────┐
    │   STEP 8         │  ← Follow-up Messages
    │   Message Loop   │    • Find conversations
    │                  │    • Send resume request
    └────────┬─────────┘    • Prevent duplicates
             │
             ▼
    ┌──────────────────┐
    │   STEP 9         │  ← Complete Workflow
    │   6-Stage        │    • Download resume
    │   Pipeline       │    • Check readability
    └────────┬─────────┘    • Process everything
             │
             ├─────────────────────────────────────┐
             │                                     │
             ▼                                     ▼
    ┌─────────────────┐                 ┌─────────────────┐
    │  Google Drive   │                 │   OpenAI API    │
    │  Upload         │                 │   Generate      │
    │  Organize       │                 │   Critique      │
    └─────────────────┘                 └────────┬────────┘
             │                                    │
             │                                    ▼
             │                          ┌─────────────────┐
             │                          │   Gmail API     │
             │                          │   Create Draft  │
             │                          │   with Pricing  │
             └─────────┬────────────────┴─────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Google Sheets   │
              │ (Optional Log)  │
              └─────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

```bash
✓ Node.js v16+ installed
✓ Google Cloud account (free)
✓ OpenAI API account (paid)
✓ LinkedIn Premium with Service Marketplace access
```

### Installation

```bash
# 1. Install dependencies
npm install playwright minimist dotenv googleapis pdf-parse pdf2json open

# 2. Install browsers
npx playwright install chromium

# 3. Create .env file (see SETUP.md for details)
cp .env.example .env
# Edit .env with your credentials

# 4. Setup Google OAuth
node scripts/setup_oauth.js

# 5. Run first dry-run
node scripts/step7_submit_proposal_loop.js
```

---

## 📋 Three Main Steps

### Step 7: Submit Proposals

```bash
# Dry run (test mode)
node scripts/step7_submit_proposal_loop.js

# Submit 10 proposals
node scripts/step7_submit_proposal_loop.js --confirm=true --max=10

# Reset and start fresh
node scripts/step7_submit_proposal_loop.js --reset
```

**What happens:**
1. Opens LinkedIn Service Marketplace
2. Finds "Submit Proposal" buttons
3. Detects client names (6 detection strategies)
4. Fills personalized proposal
5. Submits and tracks state

**State file:** `proposals_state.json`

---

### Step 8: Send Follow-ups

```bash
# Dry run
node scripts/step8_followup_message_loop.js

# Send 15 follow-ups
node scripts/step8_followup_message_loop.js --confirm=true --max=15

# Reset follow-up state
node scripts/step8_followup_message_loop.js --reset
```

**What happens:**
1. Opens LinkedIn Messaging
2. Finds conversations with proposal recipients
3. Checks if follow-up already sent
4. Checks if resume already received
5. Sends "Share your resume" message

**State file:** `state_followups.json`

---

### Step 9: Process Resumes

```bash
# Dry run (detect only)
node scripts/step9_complete_resume_workflow.js

# Process all resumes
node scripts/step9_complete_resume_workflow.js --confirm=true

# Reset and reprocess
node scripts/step9_complete_resume_workflow.js --reset --confirm=true
```

**6-Stage Pipeline:**

```
Stage 1: Download     → Detect and download resume from LinkedIn
Stage 2: Readability  → Check if PDF is parseable
Stage 3: Drive Upload → Upload to organized folder structure
Stage 4: Email Extract→ Find email address in resume
Stage 5: Experience   → Calculate years and pricing tier
Stage 6: AI + Gmail   → Generate critique + create draft
```

**State file:** `resume_processing_state_ALL.json`

**Output:**
```
✅ WORKFLOW COMPLETE: John Doe
   • Resume: ✓ Readable
   • Drive: https://drive.google.com/file/d/xxx
   • Email: john.doe@example.com
   • Experience: 5 years
   • Pricing: ₹3,000 (resume) + ₹2,500 (LinkedIn)
   • Draft: https://mail.google.com/mail/u/0/#drafts/xxx
```

---

## 📊 Pricing Chart

Automatically calculated based on experience:

| Experience | Resume Price | LinkedIn Price |
|-----------|--------------|----------------|
| 0-3 years | ₹2,500 | ₹2,000 |
| 4-6 years | ₹3,000 | ₹2,500 |
| 6-8 years | ₹4,000 | ₹2,500 |
| 8-10 years | ₹6,000 | ₹3,000 |
| 10-12 years | ₹7,000 | ₹3,500 |
| 12+ years | ₹8,000 | ₹4,000 |

---

## 🗂️ File Structure

```
linkedin-automation/
│
├── docs/
│   ├── README.md              ← You are here
│   ├── SETUP.md               ← Setup instructions
│   ├── WORKFLOW.md            ← Detailed workflow guide
│   └── API_REFERENCE.md       ← Code documentation
│
├── scripts/
│   ├── step7_submit_proposal_loop.js
│   ├── step8_followup_message_loop.js
│   ├── step9_complete_resume_workflow.js
│   ├── setup_oauth.js
│   ├── verify_drive_structure.js
│   │
│   └── helpers/
│       ├── google_drive.js
│       ├── gmail_draft.js
│       ├── openai_critique.js
│       ├── resume-parser.js
│       ├── google_sheets.js
│       └── debug_utils.js
│
├── downloads/
│   └── resumes/
│       ├── readable/
│       └── unreadable/
│
├── .env                       ← Configuration
├── google_token.json          ← OAuth token
├── auth_state.json            ← LinkedIn session
├── proposals_state.json       ← Step 7 state
├── state_followups.json       ← Step 8 state
└── resume_processing_state_ALL.json  ← Step 9 state
```

---

## 📚 Documentation Files

1. **README.md** (this file) - Overview and quick start
2. **SETUP.md** - Detailed setup instructions
3. **WORKFLOW.md** - Step-by-step usage guide
4. **API_REFERENCE.md** - Code documentation and API details

---

## 🔧 Common Commands

```bash
# Setup
node scripts/setup_oauth.js

# Daily workflow
node scripts/step7_submit_proposal_loop.js --confirm=true --max=10
node scripts/step8_followup_message_loop.js --confirm=true --max=15
node scripts/step9_complete_resume_workflow.js --confirm=true

# Check Drive structure
node scripts/verify_drive_structure.js

# Reset everything
rm proposals_state.json state_followups.json resume_processing_state_ALL.json

# Debug mode
node scripts/step9_complete_resume_workflow.js --headful=true --slowMo=500
```

---

## ⚠️ Important Notes

### Rate Limits
- **LinkedIn**: Don't submit more than 20 proposals per hour
- **OpenAI**: ~50 requests per minute (GPT-4o-mini)
- **Google APIs**: 10,000 requests per day

### State Management
- State files prevent duplicate work
- Never delete state files during a run
- Use `--reset` flag to intentionally clear state

### Security
- Never commit `.env` to Git
- Keep `google_token.json` private
- Rotate API keys monthly

---

## 🐛 Troubleshooting

### Quick Fixes

```bash
# Issue: Not logged in to LinkedIn
node scripts/step7_submit_proposal_loop.js --headful=true
# → Login manually, session saves automatically

# Issue: Google OAuth error
rm google_token.json
node scripts/setup_oauth.js
# → Re-authenticate

# Issue: PDF parsing fails
# → System auto-categorizes as "unreadable"
# → Manual review required

# Issue: Duplicate proposals
rm proposals_state.json
# → Start fresh

# Issue: OpenAI error
# → Check API key in .env
# → Verify credits at platform.openai.com
```

For detailed troubleshooting, see **WORKFLOW.md**

---

## 📈 Analytics

### View Statistics

```bash
# Count proposals submitted
cat proposals_state.json | jq '.submittedNames | length'

# Count follow-ups sent
cat state_followups.json | jq '.sent | length'

# Count resumes processed
cat resume_processing_state_ALL.json | jq '.processed | length'

# Check Drive uploads
node scripts/verify_drive_structure.js
```

---

## 🎓 Learning Resources

- **Playwright Docs**: https://playwright.dev/
- **Google Drive API**: https://developers.google.com/drive
- **Gmail API**: https://developers.google.com/gmail
- **OpenAI API**: https://platform.openai.com/docs

---

## 📝 Changelog

### Version 1.0.0 (Current)
- ✅ Complete automation pipeline
- ✅ State management
- ✅ Google integrations
- ✅ AI critique generation
- ✅ Dynamic pricing

### Planned Features
- [ ] Google Sheets logging
- [ ] Multi-account support
- [ ] Performance dashboard
- [ ] Email auto-send
- [ ] Slack notifications

---

## 🤝 Support

For issues or questions:
1. Check documentation files
2. Review state files
3. Enable debug mode
4. Check error logs

---

## ⚖️ Legal & Ethics

**Disclaimer**: Use responsibly and ensure compliance with:
- LinkedIn Terms of Service
- Google Cloud Terms
- OpenAI Usage Policies

This tool is for legitimate business automation only.

---

**Version**: 1.0.0  
**Last Updated**: November 30, 2025  
**License**: Commercial Use

---

## Next Steps

1. Read **SETUP.md** for detailed configuration
2. Read **WORKFLOW.md** for usage examples
3. Check **API_REFERENCE.md** for code details
4. Run your first automation!

**Ready to get started? → See SETUP.md**