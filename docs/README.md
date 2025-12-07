# LinkedIn Automation System

A comprehensive automation system for managing LinkedIn service requests, proposals, follow-ups, and resume processing.

## 🎯 What This Does

This system automates your entire LinkedIn service request workflow:

1. **Step 7**: Automatically sends personalized proposals to service requests
2. **Step 8**: Sends follow-up messages after proposals
3. **Step 9**: Downloads and processes candidate resumes, generates AI critiques, uploads to Google Drive, and creates Gmail drafts

## ✨ Key Features

- **Smart Name Detection**: Extracts client names from LinkedIn messages for personalization
- **Deduplication**: Prevents sending duplicate messages to the same person
- **Resume Processing**: Downloads PDFs, parses content, generates AI feedback
- **Google Integration**: Uploads to Drive, creates organized folders, generates Gmail drafts
- **State Management**: Tracks all proposals, follow-ups, and processed resumes
- **Error Recovery**: Handles failures gracefully with detailed logging

## 📋 Prerequisites

- **Node.js**: Version 16 or higher
- **Chrome/Chromium**: Required for Playwright browser automation
- **Google Account**: For Drive and Gmail integration
- **OpenAI Account**: For AI-powered resume critiques
- **LinkedIn Account**: With access to Services

## 🚀 Quick Start

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/sherlin22/linkedin-automation.git
cd linkedin-automation

# Install dependencies
npm install
```

### 2. Configuration

Create a `.env` file (see `.env.example`):

```env
OPENAI_API_KEY=your_openai_api_key_here
GOOGLE_DRIVE_FOLDER_ID=your_google_drive_folder_id
```

### 3. Google OAuth Setup

```bash
# Run the OAuth setup wizard
node linkedin-automation-backend/scripts/setup_oauth.js
```

This will:
- Guide you through Google Cloud Console setup
- Help you create OAuth credentials
- Authenticate your Google account
- Save tokens securely

### 4. LinkedIn Authentication

```bash
# Save your LinkedIn session
node linkedin-automation-backend/scripts/login_and_save_state.js
```

This opens a browser where you:
- Log into LinkedIn normally
- The session is saved for automation

## 📖 Usage

### Submit Proposals (Step 7)

```bash
node linkedin-automation-backend/scripts/step7_submit_proposal_loop.js
```

**What it does:**
- Opens LinkedIn Services → Requests
- Extracts client names from conversation history
- Fills proposal forms with personalized content
- Tracks sent proposals in `proposals_state.json`
- Prevents duplicate submissions

**Features:**
- Automatic name detection from messages
- Smart selector fallbacks for form fields
- Screenshot debugging on failures
- Dry-run mode for testing

### Send Follow-ups (Step 8)

```bash
node linkedin-automation-backend/scripts/step8_followup_message_loop.js
```

**What it does:**
- Checks proposals from last 7 days
- Sends follow-up messages if no response
- Deduplicates based on conversation history
- Updates state to prevent re-sending

**Features:**
- Configurable follow-up delay (default: 3 days)
- Intelligent message detection
- Automatic conversation verification
- State tracking in `state_followups.json`

### Process Resumes (Step 9)

```bash
node linkedin-automation-backend/scripts/step9_complete_resume_workflow.js
```

**What it does:**
- Downloads resumes from LinkedIn conversations
- Parses PDF content (education, experience, skills)
- Generates AI critique using OpenAI
- Uploads to Google Drive in organized folders
- Creates Gmail drafts with resume attached
- Tracks processing in `resume_processing_state.json`

**Features:**
- Smart resume detection in conversations
- Robust PDF parsing with fallbacks
- AI-powered constructive feedback
- Organized Drive folder structure:
  ```
  Client Resumes/
  ├── Pending Review/
  ├── Reviewed/
  └── Rejected/
  ```
- Gmail drafts ready to send

## 🔧 Configuration Files

### proposals_state.json
Tracks all sent proposals:
```json
{
  "profile_url": {
    "name": "Client Name",
    "proposal_sent": true,
    "sent_at": "2024-12-05T10:30:00Z",
    "followup_sent": false
  }
}
```

### state_followups.json
Tracks follow-up messages:
```json
{
  "profile_url": {
    "followup_sent": true,
    "sent_at": "2024-12-05T10:30:00Z",
    "message_count": 5
  }
}
```

### resume_processing_state.json
Tracks processed resumes:
```json
{
  "profile_url": {
    "resume_downloaded": true,
    "drive_uploaded": true,
    "draft_created": true,
    "processed_at": "2024-12-05T10:30:00Z"
  }
}
```

## 🛠️ Advanced Usage

### Verify Drive Structure

```bash
node linkedin-automation-backend/scripts/verify_drive_structure.js
```

Ensures your Google Drive folder structure is correct.

### Check Authentication

```bash
node linkedin-automation-backend/scripts/check_auth.js
```

Verifies Google OAuth tokens are valid.

### Debug Specific Conversation

```bash
node linkedin-automation-backend/scripts/debug_conversation.js
```

Inspects a specific LinkedIn conversation for debugging.

## 📁 Project Structure

```
linkedin-automation/
├── linkedin-automation-backend/
│   └── scripts/
│       ├── step7_submit_proposal_loop.js    # Send proposals
│       ├── step8_followup_message_loop.js   # Send follow-ups
│       ├── step9_complete_resume_workflow.js # Process resumes
│       ├── setup_oauth.js                   # Google auth setup
│       └── helpers/
│           ├── google_drive.js              # Drive operations
│           ├── gmail_draft.js               # Gmail operations
│           ├── openai_critique.js           # AI feedback
│           └── resume-parser.js             # PDF parsing
├── data/
│   └── requests_log.json                    # Service requests cache
├── proposals_state.json                     # Proposal tracking
├── state_followups.json                     # Follow-up tracking
├── resume_processing_state.json             # Resume tracking
├── auth_state.json                          # LinkedIn session
└── google_token.json                        # Google OAuth tokens
```

## 🔐 Security Notes

**Never commit these files to Git:**
- `auth_state.json` - LinkedIn session
- `google_token.json` - Google OAuth tokens
- `google_credentials.json` - OAuth client secret
- `*.json` files in root (state files contain client data)
- `.env` - API keys

These are protected by `.gitignore`.

## 🐛 Troubleshooting

### "LinkedIn session expired"
```bash
node linkedin-automation-backend/scripts/login_and_save_state.js
```

### "Google tokens invalid"
```bash
node linkedin-automation-backend/scripts/setup_oauth.js
```

### "Can't find proposal form"
- Check if LinkedIn UI changed
- Review debug screenshots in root directory
- Update selectors in scripts

### "Resume download failed"
- Verify conversation has an attachment
- Check file permissions in downloads folder
- Review debug output for specific error

### "OpenAI API error"
- Verify API key in `.env`
- Check OpenAI account has credits
- Review rate limits

## 📊 Monitoring

All scripts log to console with timestamps and status updates:

```
[2024-12-05 10:30:00] ✓ Found 5 service requests
[2024-12-05 10:30:15] → Processing: John Doe
[2024-12-05 10:30:30] ✓ Proposal sent successfully
[2024-12-05 10:30:45] ✗ Already sent to Jane Smith
```

## 🤝 Support

For issues or questions:
1. Check troubleshooting section above
2. Review debug screenshots and logs
3. Contact system administrator

## 📝 License

Private project - All rights reserved

## ⚠️ Disclaimer

This tool automates LinkedIn interactions. Use responsibly and in accordance with LinkedIn's Terms of Service. The authors are not responsible for any account restrictions or violations that may result from use of this tool.

---

**Last Updated**: December 2024  
**Version**: 2.0  
**Maintainer**: Rashmi Sherlin