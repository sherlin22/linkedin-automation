# Setup Guide - LinkedIn Automation

> **Complete step-by-step instructions to set up the automation system from scratch**

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Environment Configuration](#environment-configuration)
4. [Google Cloud Setup](#google-cloud-setup)
5. [OpenAI Setup](#openai-setup)
6. [LinkedIn Authentication](#linkedin-authentication)
7. [Verification](#verification)
8. [Troubleshooting Setup](#troubleshooting-setup)

---

## 1. Prerequisites

### Required Software

```bash
✓ Node.js v16 or higher
✓ npm (comes with Node.js)
✓ Git (optional, for version control)
✓ Text editor (VS Code recommended)
```

### Accounts You Need

| Service | Type | Cost | Purpose |
|---------|------|------|---------|
| Google Cloud | Free tier OK | Free | Drive, Gmail, Sheets |
| OpenAI | Paid | ~$0.002/resume | AI critique |
| LinkedIn | Premium | Paid | Service marketplace |

---

## 2. Installation

### Step 2.1: Download/Clone Project

```bash
# If using Git
git clone <your-repo-url>
cd linkedin-automation

# OR download ZIP and extract
```

### Step 2.2: Install Node.js Dependencies

```bash
# Install all required packages
npm install playwright minimist dotenv googleapis pdf-parse pdf2json open

# This installs:
# - playwright: Browser automation
# - minimist: Command-line arguments
# - dotenv: Environment variables
# - googleapis: Google Drive, Gmail, Sheets
# - pdf-parse, pdf2json: PDF parsing
# - open: Open browser for OAuth
```

### Step 2.3: Install Playwright Browsers

```bash
# Install Chromium browser
npx playwright install chromium

# This downloads ~300MB browser binary
# Only needed once per machine
```

### Verify Installation

```bash
# Check Node.js version
node --version
# Should show v16.0.0 or higher

# Check npm
npm --version
# Should show 7.0.0 or higher

# List installed packages
npm list --depth=0
```

---

## 3. Environment Configuration

### Step 3.1: Create .env File

Create a file named `.env` in the project root:

```bash
# Create .env file
touch .env

# Or on Windows
type nul > .env
```

### Step 3.2: Add Configuration

Copy this template into `.env`:

```bash
# ============================================
# OPENAI CONFIGURATION
# ============================================
# Get from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ============================================
# GOOGLE OAUTH CONFIGURATION
# ============================================
# Get from: https://console.cloud.google.com/
GOOGLE_CLIENT_ID=xxxxxxxxxxxx-xxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxx
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback

# ============================================
# OPTIONAL: GOOGLE SHEETS LOGGING
# ============================================
# Get Sheet ID from URL:
# https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit
# GOOGLE_SHEET_ID=your-spreadsheet-id-here

# ============================================
# OPTIONAL: SERVICE ACCOUNT (NOT RECOMMENDED)
# ============================================
# Only use if you understand service accounts
# OAuth method is better for most users
# GOOGLE_SERVICE_ACCOUNT_FILE=google_service_account.json
# GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

### Important Notes

- **Never commit .env to Git** (add to .gitignore)
- Replace `xxxx` with your actual credentials
- Keep this file secure and private

---

## 4. Google Cloud Setup

### Step 4.1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name: "LinkedIn Automation"
4. Click "Create"

### Step 4.2: Enable Required APIs

Enable these 3 APIs:

```bash
1. Google Drive API
   → https://console.cloud.google.com/apis/library/drive.googleapis.com

2. Gmail API
   → https://console.cloud.google.com/apis/library/gmail.googleapis.com

3. Google Sheets API
   → https://console.cloud.google.com/apis/library/sheets.googleapis.com
```

**For each API:**
- Click "Enable"
- Wait for confirmation

### Step 4.3: Create OAuth 2.0 Credentials

1. Go to [Credentials page](https://console.cloud.google.com/apis/credentials)
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure consent screen:
   - User Type: External
   - App name: "LinkedIn Automation"
   - Support email: Your email
   - Scopes: Add these scopes:
     - `https://www.googleapis.com/auth/drive`
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/spreadsheets`
   - Test users: Add your email
   - Save and continue

4. Create OAuth client:
   - Application type: **Desktop app**
   - Name: "LinkedIn Automation Desktop"
   - Click "Create"

5. Copy credentials:
   ```
   Client ID: xxxxxxxxxxxx-xxxxxxxxxxxxxxxx.apps.googleusercontent.com
   Client Secret: GOCSPX-xxxxxxxxxxxxxxxxxxxxxx
   ```

6. Add to `.env` file:
   ```bash
   GOOGLE_CLIENT_ID=<paste-client-id>
   GOOGLE_CLIENT_SECRET=<paste-client-secret>
   ```

### Step 4.4: Run OAuth Setup Script

```bash
# Run the OAuth authentication
node scripts/setup_oauth.js
```

**What happens:**
1. Opens browser automatically
2. Prompts you to login to Google
3. Shows permission request
4. Click "Allow"
5. Saves `google_token.json`

**Expected output:**
```
🔐 GOOGLE OAUTH SETUP
============================================================
✓ Credentials loaded from .env
   Client ID: xxxxxxxxxxxx...
   Redirect URI: http://localhost:3000/oauth2callback

🌐 Opening browser for authorization...
✓ Local server listening on http://localhost:3000
   Waiting for authorization callback...

✓ Authorization code received
🔍 Exchanging code for tokens...
✓ Tokens received
✅ Token saved to: google_token.json

📊 Token details:
   Access Token: ya29.xxxxxxxxxxxxxx...
   Token Type: Bearer
   Expiry: 12/1/2025, 2:30:00 PM
   ✓ Refresh Token: 1//xxxxxxxxxxxxxx...

🧪 Testing token...
✅ Token is valid and working
   Drive access confirmed

✅ Setup complete! Ready to upload resumes to Google Drive
```

### Troubleshooting OAuth

**Issue: Browser doesn't open**
```bash
# Manually visit the URL shown in terminal
# Example: https://accounts.google.com/o/oauth2/v2/auth?...
```

**Issue: "Access blocked" error**
```bash
# Solution 1: Add yourself as test user
# Go to: OAuth consent screen → Test users → Add your email

# Solution 2: Publish app (if needed)
# Go to: OAuth consent screen → Publish app
```

**Issue: Token expired**
```bash
# Delete and re-authenticate
rm google_token.json
node scripts/setup_oauth.js
```

---

## 5. OpenAI Setup

### Step 5.1: Create OpenAI Account

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or login
3. Add payment method (required for API access)

### Step 5.2: Create API Key

1. Go to [API Keys page](https://platform.openai.com/api-keys)
2. Click "Create new secret key"
3. Name: "LinkedIn Automation"
4. Copy the key (starts with `sk-proj-`)
5. **Save immediately** (won't show again)

### Step 5.3: Add to .env

```bash
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Step 5.4: Add Credits

1. Go to [Billing](https://platform.openai.com/settings/organization/billing)
2. Add at least $5-10
3. Set usage limits if desired

### Cost Estimation

**Per resume critique:**
- Model: GPT-4o-mini
- Tokens: ~800-1000 per request
- Cost: ~$0.002 per resume

**Monthly estimate:**
- 100 resumes/month = $0.20
- 500 resumes/month = $1.00
- 1000 resumes/month = $2.00

Very affordable! 🎉

### Verify OpenAI Setup

```bash
# Test with a simple call
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Should return list of models
```

---

## 6. LinkedIn Authentication

### Step 6.1: Login to LinkedIn

```bash
# Run Step 7 in headful mode
node scripts/step7_submit_proposal_loop.js --headful=true
```

**What to do:**
1. Browser opens automatically
2. Navigate to LinkedIn.com
3. Login with your credentials
4. **Enable Premium/Service Marketplace** if needed
5. Once logged in, press `Ctrl+C` in terminal

### Step 6.2: Session Saved

Session cookies are saved to:
```bash
auth_state.json
```

**This file contains:**
- LinkedIn cookies
- Session tokens
- Valid for ~30 days

### Step 6.3: Verify Authentication

```bash
# Run again to verify
node scripts/step7_submit_proposal_loop.js

# Should NOT redirect to login
# Should show "Found X request cards"
```

### Re-authentication

If session expires (after ~30 days):

```bash
# Delete old session
rm auth_state.json

# Login again
node scripts/step7_submit_proposal_loop.js --headful=true
```

---

## 7. Verification

### Verify Complete Setup

Run this checklist:

```bash
# ✓ Check .env exists
cat .env

# ✓ Check Node packages
npm list --depth=0

# ✓ Check Google token
ls -lh google_token.json

# ✓ Check LinkedIn session
ls -lh auth_state.json

# ✓ Test Drive access
node scripts/verify_drive_structure.js

# ✓ Run dry-run test
node scripts/step7_submit_proposal_loop.js --max=1
```

### Expected File Structure

```
linkedin-automation/
├── .env                    ✓ Created
├── google_token.json       ✓ Created
├── auth_state.json         ✓ Created
├── package.json            ✓ Exists
├── node_modules/           ✓ Exists (large folder)
├── scripts/                ✓ Exists
│   ├── step7_submit_proposal_loop.js
│   ├── step8_followup_message_loop.js
│   ├── step9_complete_resume_workflow.js
│   └── helpers/
└── docs/                   ✓ Exists
    ├── README.md
    ├── SETUP.md (this file)
    ├── WORKFLOW.md
    └── API_REFERENCE.md
```

### Test Each Component

```bash
# 1. Test Google Drive
node scripts/setup_oauth.js
# Should say "Token is valid"

# 2. Test LinkedIn
node scripts/step7_submit_proposal_loop.js
# Should NOT redirect to login

# 3. Test OpenAI (will happen in Step 9)
echo $OPENAI_API_KEY
# Should show your key
```

---

## 8. Troubleshooting Setup

### Common Setup Issues

#### Issue 1: "Module not found"

**Error:**
```
Error: Cannot find module 'playwright'
```

**Solution:**
```bash
# Reinstall dependencies
npm install

# Check installation
npm list playwright
```

#### Issue 2: "GOOGLE_CLIENT_ID not found"

**Error:**
```
❌ Missing credentials in .env file
```

**Solution:**
```bash
# Check .env exists
ls -la .env

# Check content
cat .env | grep GOOGLE_CLIENT_ID

# Should show: GOOGLE_CLIENT_ID=xxxx...
# If empty, add your credentials
```

#### Issue 3: "Token file not found"

**Error:**
```
Token file not found: google_token.json
```

**Solution:**
```bash
# Run OAuth setup
node scripts/setup_oauth.js

# Follow browser prompts
# Token will be created automatically
```

#### Issue 4: "chromium browser not found"

**Error:**
```
browserType.launch: Executable doesn't exist
```

**Solution:**
```bash
# Install Playwright browsers
npx playwright install chromium

# Or install all browsers
npx playwright install
```

#### Issue 5: "OpenAI API error: 401"

**Error:**
```
❌ OpenAI API error: 401 Unauthorized
```

**Solution:**
```bash
# Check API key
echo $OPENAI_API_KEY

# Verify key at platform.openai.com
# Generate new key if invalid

# Update .env
OPENAI_API_KEY=sk-proj-NEW-KEY-HERE
```

#### Issue 6: "Access blocked: LinkedIn Automation hasn't verified"

**Solution:**
```bash
# Option 1: Add yourself as test user
# Go to: Google Cloud Console → OAuth consent screen
# → Test users → Add users → Add your email

# Option 2: Publish app (only if sharing with others)
# Go to: OAuth consent screen → Publish app
```

#### Issue 7: Port 3000 already in use

**Error:**
```
EADDRINUSE: address already in use :::3000
```

**Solution:**
```bash
# Find process using port 3000
lsof -i :3000  # Mac/Linux
netstat -ano | findstr :3000  # Windows

# Kill process
kill -9 <PID>  # Mac/Linux
taskkill /PID <PID> /F  # Windows

# Or change port in .env
GOOGLE_REDIRECT_URI=http://localhost:3001/oauth2callback
```

### Getting Help

If setup fails:

1. **Check error message carefully**
2. **Review this guide again**
3. **Check prerequisites are met**
4. **Verify credentials are correct**
5. **Try setup steps in order**

---

## 9. Post-Setup Configuration

### Optional: Configure Templates

Edit message templates in scripts:

```javascript
// scripts/step7_submit_proposal_loop.js
const MSG_TEMPLATE = `Hello {name}, ...`;

// scripts/step8_followup_message_loop.js
const FOLLOWUP_MSG = `Hi, Pls share your Resume...`;

// scripts/helpers/gmail_draft.js
const GMAIL_TEMPLATE = `Dear {name}, ...`;
```

### Optional: Configure Pricing

Edit pricing chart in:

```javascript
// scripts/step9_complete_resume_workflow.js
function calculatePricing(years) {
  const chart = {
    "0-3": { resume: 2500, linkedin: 2000 },
    "4-6": { resume: 3000, linkedin: 2500 },
    // ... modify as needed
  };
}
```

### Optional: Google Sheets Logging

If you want to log data to Google Sheets:

1. Create a Google Sheet
2. Copy the ID from URL:
   ```
   https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit
   ```
3. Add to .env:
   ```bash
   GOOGLE_SHEET_ID=your-sheet-id-here
   ```
4. Initialize headers:
   ```bash
   node scripts/helpers/google_sheets.js
   ```

---

## 10. Security Checklist

Before using in production:

```bash
# ✓ Add .env to .gitignore
echo ".env" >> .gitignore
echo "google_token.json" >> .gitignore
echo "auth_state.json" >> .gitignore
echo "*_state.json" >> .gitignore

# ✓ Never commit credentials
git status
# Should NOT show .env or *token.json

# ✓ Keep credentials secure
chmod 600 .env
chmod 600 google_token.json

# ✓ Set up token refresh (already handled)
# OAuth tokens auto-refresh

# ✓ Monitor API usage
# Check: platform.openai.com/usage
```

---

## ✅ Setup Complete!

If you've completed all steps:

- [x] Node.js and dependencies installed
- [x] .env configured with all keys
- [x] Google Cloud project created
- [x] OAuth authentication working
- [x] OpenAI API key added
- [x] LinkedIn session authenticated
- [x] All verification tests passed

**You're ready to start automating!**

### Next Steps

1. Read **WORKFLOW.md** for usage instructions
2. Run your first automation:
   ```bash
   node scripts/step7_submit_proposal_loop.js --confirm=true --max=5
   ```
3. Check **API_REFERENCE.md** for code details

---

**Questions? Issues?**  
→ Check WORKFLOW.md for troubleshooting  
→ Review error messages carefully  
→ Verify all credentials are correct  
