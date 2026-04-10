1) WORKFLOW OVERVIEW
The automation system follows a multi-step sequential workflow:
┌─────────────────────────────────────────────────────────────────┐
│                    LINKEDIN AUTOMATION WORKFLOW                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  STEP 7 → STEP 8 → STEP 9 → STEP 10 → STEP 11                  │
│   📝       💬       📄        ✉️        📧                        │
│ Proposals Follow-ups  Resumes   Drafts   Manual                 │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  SCHEDULE (via N8N): 8AM | 2PM | 6PM                           │
└─────────────────────────────────────────────────────────────────┘

Step Details:
| Step    |               Script              |                              Purpose                        |        Output     |
|-------- |-----------------------------------|-------------------------------------------------------------|-------------------|
| Step 7  | step7_submit_proposal_loop.js     | Find service requests → Send personalized proposals         | Proposals sent    |
| Step 8  | step8_followup_message_loop.js    | Send follow-ups asking for resumes                          | Follow-ups sent   |
| Step 9  | step9_complete_resume_workflow.js | Download resumes → AI critique → Gmail draft → Drive upload | Drafts created    |
| Step 10 | step10_send_draft_followup_v2.js  | Send LinkedIn follow-up to draft recipients                 | LinkedIn messages |
| Step 11 | step11_manual_draft_followup.js   | Manual draft follow-ups                                     | Manual tracking   |

2) IMPORTANT FILES LIST
Core Workflow Scripts:
📁 linkedin-automation-backend/scripts/
├── step7_submit_proposal_loop.js      ✅ Main proposal sender
├── step8_followup_message_loop.js    ✅ Follow-up sender  
├── step9_complete_resume_workflow.js ✅ Resume processor (AI + Drive + Gmail)
├── step10_send_draft_followup_v2.js ✅ Draft follow-up verifier
├── step11_manual_draft_followup.js  ✅ Manual follow-up handler
└── helpers/
    ├── validation-helpers.js         ✅ Name validation (critical)
    ├── metrics-handler.js            ✅ Metrics tracking
    ├── gmail_sent_checker.js         ✅ Gmail verification
    ├── gmail_draft.js                ✅ Gmail draft creation
    ├── google_drive.js               ✅ Drive upload
    ├── openai_critique.js           ✅ AI resume analysis
    ├── resume-parser.js              ✅ PDF text extraction
    └── candidate-workflow-logger.js  ✅ Google Sheets logging



Backend Server:

📁 linkedin-automation-backend/
├── server.js                         ✅ Express API server (webhooks)
├── package.json                      ✅ Dependencies
└── api/
    ├── automation-events.js          ✅ Webhook endpoints
    ├── n8n-metrics.js                ✅ Metrics API
    └── sheets-logger.js             ✅ Sheets logging


Configuration:

📁 ./
├── .env                             ✅ API keys & credentials
├── google_token.json               ✅ Google OAuth tokens
├── auth_state.json                 ✅ LinkedIn session
├── n8n_metrics.json               ✅ Workflow metrics
└── data/
    ├── linkedin-storage.json       ✅ LinkedIn cookies
    ├── requests_list.json          ✅ Service requests
    ├── requests_queue.json         ✅ Pending requests
    └── requests_log.json           ✅ Request history


Documentation:

📁 docs/
├── WORKFLOW.md                     ✅ N8N setup
├── SETUP.md                        ✅ Installation guide
├── README.md                       ✅ Quick start
├── HowToUse(DayToDay).md          ✅ Daily usage
└── TROUBLESHOOTING.md             ✅ Problem solving
