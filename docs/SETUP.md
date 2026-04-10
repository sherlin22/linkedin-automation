# 🎯 Setup Guide - LinkedIn Automation System

**Complete setup guide integrating the detailed technical setup with user-friendly instructions.**

**Repository:** https://github.com/deeparajan890-dev/linkedin-automation

---

## 📋 Setup Overview

This guide covers:
1. Prerequisites (what you need)
2. Installation (getting the code)
3. Environment Configuration (.env setup)
4. Google Cloud Setup (Drive, Gmail, Sheets)
5. Google OAuth Authentication
6. OpenAI API Setup
7. LinkedIn Authentication
8. Verification & Testing
9. Post-Setup Configuration
10. Security Checklist

**Estimated time:** 45-60 minutes

---

## 1. Prerequisites

### Required Software

```bash
✓ Node.js v16 or higher
✓ npm (comes with Node.js)
✓ Git (optional, for version control)
✓ VS Code (recommended, or any text editor)
✓ Chrome or Firefox browser
```

### Accounts You Need

| Service        | Type      | Cost | Purpose             |
|----------------|-----------|------|---------------------|
| Google Account | Free/Paid | Free | Drive, Gmail, Sheets|
| OpenAI         | Paid      | $5+  | AI resume critiques |
| LinkedIn       | Premium   | Paid | Service marketplace |

### Verify You Have:

```bash
# Check Node.js installed
node --version
# Should show v16.0.0 or higher

# Check npm installed
npm --version
# Should show 7.0.0 or higher
```

---

## 2. Installation

### Step 2.1: Get the Code

**Option A: Clone with Git (Recommended)**

```bash
git clone https://github.com/deeparajan890-dev/linkedin-automation.git
cd linkedin-automation
```

**Option B: Download ZIP**

1. Go to: https://github.com/deeparajan890-dev/linkedin-automation
2. Click "Code" (green button)
3. Click "Download ZIP"
4. Extract the folder
5. Open Command Prompt in that folder

### Step 2.2: Install Node.js Dependencies

```bash
# Install all required packages
npm install

# This installs:
# - playwright: Browser automation (300MB)
# - googleapis: Google Drive, Gmail, Sheets
# - dotenv: Environment variables
# - pdf-parse, pdf2json: PDF reading
# - open: Browser automation
# - And others (total ~700MB)
```

**Expected output:**
```
added 234 packages, and audited 235 packages
```

### Step 2.3: Install Playwright Browsers

```bash
# Download browser binary (~300MB)
npx playwright install chromium
```

This downloads the Chromium browser needed for LinkedIn automation.

### Verify Installation

```bash
# Check all packages installed
npm list --depth=0

# Should show:
# ├── playwright
# ├── googleapis
# ├── dotenv
# ├── pdf-parse
# └── ... (other packages)
```

---

## 3. Environment Configuration

### Step 3.1: Create .env File

The `.env` file stores your API keys and configuration.

**Using Command Prompt:**

```bash
# Windows - create empty file
type nul > .env

# Or use Notepad and save as .env
# (Important: change "Save as type" to "All Files")
```

### Step 3.2: Add Configuration to .env

Copy this template and fill in your credentials:

```bash
# ============================================
# GOOGLE OAUTH CONFIGURATION (REQUIRED)
# ============================================
# Get from: https://console.cloud.google.com/
GOOGLE_CLIENT_ID=xxxxxxxxxxxx-xxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxx
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback

# ============================================
# OPENAI CONFIGURATION (REQUIRED)
# ============================================
# Get from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ============================================
# OPTIONAL: GOOGLE SHEETS LOGGING
# ============================================
# Get ID from: https://docs.google.com/spreadsheets/d/[ID]/edit
# GOOGLE_SHEET_ID=your-spreadsheet-id-here

# ============================================
# OPTIONAL: N8N WEBHOOK CONFIGURATION
# ============================================
# N8N_WEBHOOK_URL=http://localhost:5678/webhook
```

### Important Notes

- **Never commit to Git** - Add `.env` to `.gitignore`
- **Keep private** - Don't share this file
- **Update credentials** - Replace `xxxx` with real values
- **Check file location** - Must be in project root

---

## 4. Google Cloud Setup

### Step 4.1: Create Google Cloud Project

1. Go to: https://console.cloud.google.com/
2. Sign in with Google account
3. At top left, click "Select a project"
4. Click "New Project"
5. **Name:** `LinkedIn Automation`
6. Click "Create"
7. Wait 30 seconds for project creation

### Step 4.2: Enable Required APIs

You need to enable 3 APIs. Do this for each:

**Google Drive API:**
1. Search box at top: `Google Drive API`
2. Click result
3. Click "Enable" (blue button)
4. Wait for completion

**Gmail API:**
1. Search box: `Gmail API`
2. Click result
3. Click "Enable"
4. Wait for completion

**Google Sheets API:**
1. Search box: `Google Sheets API`
2. Click result
3. Click "Enable"
4. Wait for completion

### Step 4.3: Create OAuth 2.0 Credentials

1. **Left sidebar → Click "Credentials"**

2. **Click "Create Credentials" button (blue, top right)**

3. **Select "OAuth client ID"**

4. **If prompted about "OAuth consent screen":**
   - Click "Create OAuth consent screen"
   - Select "External"
   - Click "Create"
   - Fill in form:
     ```
     App name: LinkedIn Automation
     User support email: your-email@gmail.com
     Developer contact: your-email@gmail.com
     ```
   - Click "Save and Continue"
   - Click "Add or Remove Scopes"
   - Search and select:
     - `https://www.googleapis.com/auth/drive`
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/spreadsheets`
   - Click "Update"
   - Click "Save and Continue"
   - Click "Back to Dashboard"

5. **Create OAuth Client:**
   - Click "Create Credentials" again
   - Select "OAuth client ID"
   - **Application type:** "Desktop application"
   - Click "Create"

6. **Copy Your Credentials:**
   ```
   Client ID: (copy this)
   Client Secret: (copy this)
   ```

### Step 4.4: Save Credentials to .env

Replace in your `.env` file:

```bash
GOOGLE_CLIENT_ID=paste_client_id_here
GOOGLE_CLIENT_SECRET=paste_client_secret_here
```

### Step 4.5: Run OAuth Setup Script

```bash
node scripts/setup_oauth.js
```

**What happens:**
1. Browser opens automatically
2. You see Google login screen
3. Sign in with your Google account
4. You see: "LinkedIn Automation wants access"
5. Click "Allow" or "Grant access"
6. Check boxes for permissions
7. Success! You'll see completion message
8. File `google_token.json` is created

**Expected success message:**
```
✅ Setup complete! Ready to upload resumes.

Google Sheets API - Ready ✓
Gmail API - Ready ✓
Google Drive API - Ready ✓
```

### Troubleshooting Google Setup

**Browser doesn't open:**
```bash
# Manually open the URL from terminal
# Visit it in your browser
# Complete the authentication
```

**"Access blocked" error:**
```bash
# Add yourself as test user:
# Google Cloud Console 
# → OAuth consent screen 
# → Test users 
# → Add your email

# Then try again
```

**Token expired:**
```bash
# Delete old token
rm google_token.json

# Re-run setup
node scripts/setup_oauth.js
```

---

## 5. OpenAI API Setup

### Step 5.1: Create OpenAI Account

1. Go to: https://platform.openai.com/
2. Click "Sign up"
3. Create account or sign in
4. **Add payment method** (required for API)
   - Go to: https://platform.openai.com/settings/organization/billing/overview
   - Add credit card
   - Add $5-10 credit

### Step 5.2: Generate API Key

1. Go to: https://platform.openai.com/api-keys
2. Click "Create new secret key"
3. Name it: `LinkedIn Automation`
4. **Copy the key immediately!** (won't show again)
   ```
   sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

### Step 5.3: Add to .env

```bash
OPENAI_API_KEY=sk-proj-xxxxx...
```

### Cost Estimation

Per resume critique:
```
- Model: GPT-4o-mini
- Cost: ~$0.002 per resume
- 100 resumes = ~$0.20/month
- 1000 resumes = ~$2.00/month
```

Very affordable! ✅

### Verify OpenAI Works

```bash
# Check API key is valid
echo $OPENAI_API_KEY

# Should show: sk-proj-xxxxx...
```

---

## 6. LinkedIn Authentication

### Step 6.1: Setup LinkedIn Session

Run a script in headful mode (shows browser):

```bash
node scripts/step7_submit_proposal_loop.js --headful=true --max=1
```

**What to do:**
1. Browser opens automatically
2. If not logged in, login to LinkedIn
3. Use your career coaching account
4. Complete any 2FA if prompted
5. Press `Ctrl + C` to stop the script

**Browser stays open, but script stops recording.**

### Step 6.2: Session Saved

File `auth_state.json` is created with:
- LinkedIn cookies
- Session tokens
- Valid for ~30 days

### Step 6.3: Verify Authentication

```bash
# Check file exists
ls -la auth_state.json

# Should show the file
```

### Re-authenticate When Expired

```bash
# Delete old session
rm auth_state.json

# Re-login
node scripts/step7_submit_proposal_loop.js --headful=true --max=1
```

---

## 7. Verification & Testing

### Run Verification Script

```bash
node scripts/verify_system.js
```

**You should see ✅ for:**
```
✅ google_token.json exists
✅ auth_state.json exists
✅ .env file exists
✅ GOOGLE_CLIENT_ID configured
✅ GOOGLE_CLIENT_SECRET configured
✅ OPENAI_API_KEY configured
✅ All npm packages installed
✅ Playwright installed
```

**If you see ❌**, the message tells you what's missing. Fix that and try again.

### Test Each Component

```bash
# 1. Test Google Drive
node scripts/verify_drive_structure.js
# Should list your Drive folders

# 2. Test LinkedIn
node scripts/step7_submit_proposal_loop.js --max=1
# Should find proposals (or say none available)

# 3. Full dry-run (no actual sending)
node scripts/step7_submit_proposal_loop.js --max=5
# Should show what would happen

# 4. Small test (actually send 1)
node scripts/step7_submit_proposal_loop.js --confirm=true --max=1
# Should send 1 proposal, log it, done
```

### File Structure After Setup

```
linkedin-automation/
├── .env                        ✅ Created
├── google_token.json           ✅ Created
├── auth_state.json             ✅ Created
├── package.json                ✅ Original
├── node_modules/               ✅ Created (large)
├── scripts/
│   ├── step7_submit_proposal_loop.js
│   ├── step8_followup_message_loop.js
│   ├── step9_complete_resume_workflow.js
│   ├── helpers/                ✅ All working
│   └── ...
├── downloads/                  ✅ Auto-created
│   └── resumes/
├── README.md                   ✅ Original
├── SETUP.md                    ✅ This guide
└── ...other docs
```

---

## 8. Troubleshooting Setup

### Common Issues & Solutions

**Issue: "Cannot find module 'playwright'"**
```bash
# Solution
npm install
npx playwright install chromium
```

**Issue: ".env file not found"**
```bash
# Check file exists
cat .env

# If empty or not found:
# - Recreate it with right name
# - Make sure it has a dot: .env
# - Add configuration from section 3
```

**Issue: "GOOGLE_CLIENT_ID not configured"**
```bash
# Check .env has the key
grep GOOGLE_CLIENT_ID .env

# Should show: GOOGLE_CLIENT_ID=xxx...
# If not, add it from section 4
```

**Issue: "google_token.json missing"**
```bash
# Run OAuth setup
node scripts/setup_oauth.js

# Follow browser prompts
# File will be created
```

**Issue: "Chromium not found"**
```bash
# Install Playwright browsers
npx playwright install chromium
```

**Issue: "OpenAI API error: 401"**
```bash
# Check API key
echo $OPENAI_API_KEY

# Verify at platform.openai.com
# Create new key if invalid
# Update .env with new key
```

**Issue: "LinkedIn redirects to login"**
```bash
# Delete old session
rm auth_state.json

# Re-authenticate
node scripts/step7_submit_proposal_loop.js --headful=true
```

**Issue: "Port 3000 already in use"**
```bash
# Windows:
netstat -ano | findstr :3000
taskkill /PID <number> /F

# Or use different port in .env:
GOOGLE_REDIRECT_URI=http://localhost:3001/oauth2callback
```

---

## 9. Post-Setup Configuration

### Customize Templates (Optional)

Edit proposal message in:
```bash
scripts/step7_submit_proposal_loop.js
# Find: const MSG_TEMPLATE = `...`
# Customize the template
```

### Customize Pricing (Optional)

Edit pricing in:
```bash
scripts/step9_complete_resume_workflow.js
# Find: function calculatePricing(years)
# Update the pricing chart
```

### Enable Google Sheets Logging (Optional)

1. Create Google Sheet: https://docs.google.com/spreadsheets/
2. Copy ID from URL
3. Add to .env:
   ```bash
   GOOGLE_SHEET_ID=your-sheet-id-here
   ```
4. All data now logs to your sheet

---

## 10. Security Checklist

### Before Using in Production

```bash
# ✅ Add credentials to .gitignore
echo ".env" >> .gitignore
echo "google_token.json" >> .gitignore
echo "auth_state.json" >> .gitignore
echo "*_state.json" >> .gitignore

# ✅ Verify files not committed
git status
# Should NOT show any .env or *token.json

# ✅ Set file permissions
chmod 600 .env
chmod 600 google_token.json

# ✅ Monitor API costs
# OpenAI: https://platform.openai.com/usage
# Google Cloud: Console → Billing

# ✅ Rotate credentials periodically
# Every 90 days: regenerate API keys
```

---

## ✅ Setup Complete!

If all steps passed:

- [x] Node.js and npm installed
- [x] Project code downloaded
- [x] Dependencies installed
- [x] .env configured
- [x] Google Cloud project created
- [x] OAuth authentication working
- [x] OpenAI API configured
- [x] LinkedIn session authenticated
- [x] Verification tests passed
- [x] Security checklist complete

**You're ready to use the automation!**

---

## 🚀 Next Steps

1. **Start the servers:**
   ```bash
   # Terminal 1:
   npm start
   
   # Terminal 2:
   n8n start
   ```

2. **Access N8N Dashboard:**
   - Open: http://localhost:5678
   - Press 'O' to see executions

3. **Or run scripts manually:**
   ```bash
   # Send proposals
   node scripts/step7_submit_proposal_loop.js --confirm=true --max=5
   
   # Send follow-ups
   node scripts/step8_followup_message_loop.js --confirm=true --max=5
   
   # Process resumes
   node scripts/step9_complete_resume_workflow.js --confirm=true --max=5
   ```

4. **Read documentation:**
   - README.md - Daily usage guide
   - WORKFLOW.md - N8N configuration
   - API.md - API reference
   - TROUBLESHOOTING.md - Problem solving

---

## 📚 Additional Resources

| Resource           | Purpose                   |
|--------------------|---------------------------|
| README.md.         | Quick start & daily usage |
| WORKFLOW.md.       | N8N automation setup      |
| API.md             | API endpoints reference   |
| TROUBLESHOOTING.md | Problem solving.          |

---

**Setup Version:** 2.0 (Combined Technical + User-Friendly)
**Last Updated:** January 2025
**Repository:** https://github.com/deeparajan890-dev/linkedin-automation