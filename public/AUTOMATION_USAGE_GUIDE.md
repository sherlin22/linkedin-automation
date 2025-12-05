# LinkedIn Automation - Complete Usage Guide

## 🚨 IMPORTANT: Start Here First!

### Step 0: Save Your LinkedIn Authentication

**You MUST do this before running any automation:**

```bash
node scripts/save_auth_state.js
```

1. Browser will open with LinkedIn login
2. Sign in completely (including any 2FA)
3. Wait until you see your LinkedIn feed
4. Come back to terminal and press ENTER
5. File `auth_state.json` will be saved

**Verify it worked:**
```bash
node -e 'const fs=require("fs"),f="auth_state.json"; const j=JSON.parse(fs.readFileSync(f)); console.log("✅ Cookies:",j.cookies.length,"Origins:",j.origins.length);'
```

You should see: `✅ Cookies: 40+ Origins: 2+`

If you see `Cookies: 0`, run `save_auth_state.js` again!

---

## Script Files Explained

### 🔐 Authentication Scripts
- **`save_auth_state.js`** ✅ **USE THIS** - Reliable auth saver
- ~~`save_state.js`, `save_playwright_state.js`, `save_linkedin_storage.js`~~ - Old/deprecated (ignore these)

### 🤖 Automation Scripts
- **`step7_submit_proposal_loop.js`** - Submit proposals to service requests
- **`step8_followup_message_loop_FIXED.js`** - Send follow-ups to proposals
- **`step9_resume_to_email_loop.js`** - Process resumes and create emails

### 📁 State Files (Auto-generated - Don't Create Manually)
- `auth_state.json` - Your LinkedIn session (created by save_auth_state.js)
- `proposals_state.json` - Tracks proposals from step7 (auto-created)
- `state_followups.json` - Tracks follow-ups from step8 (auto-created)

---

## Quick Start Commands

### Step 1: Submit Proposals (step7)

```bash
# Dry run (test without sending)
node scripts/step7_submit_proposal_loop.js \
  --auth=auth_state.json \
  --state=proposals_state.json \
  --headful=true \
  --slowMo=150 \
  --confirm=false

# Actually send proposals
node scripts/step7_submit_proposal_loop.js \
  --auth=auth_state.json \
  --state=proposals_state.json \
  --headful=true \
  --slowMo=150 \
  --confirm=true
```

**What it does:**
1. Opens LinkedIn Service Marketplace
2. Finds service requests
3. Fills personalized proposal
4. Saves names to `proposals_state.json`

### Step 2: Send Follow-ups (step8)

**⏰ Wait 1-2 hours after step7 before running this!**

```bash
# Dry run
node scripts/step8_followup_message_loop.js \
  --auth=auth_state.json \
  --state=proposals_state.json \
  --headful=true \
  --confirm=false

# Actually send
node scripts/step8_followup_message_loop.js \
  --auth=auth_state.json \
  --state=proposals_state.json \
  --headful=true \
  --confirm=true
```

**What it does:**
1. Reads `proposals_state.json` to find who got proposals
2. Opens LinkedIn Messages
3. Finds proposal messages with no reply
4. Sends: "Hi, Pls share your Resume to proceed further discussion."

### Step 3: Process Resumes (step9)

**Requires OpenAI API key:**
```bash
export OPENAI_API_KEY=your_key_here
```

```bash
node scripts/step9_resume_to_email_loop.js \
  --auth=auth_state.json \
  --headful=true \
  --confirm=true
```

**What it does:**
1. Checks messages for resume attachments
2. Downloads and analyzes resumes
3. Uses ChatGPT for critique
4. Creates personalized email drafts

---

## Common Issues & Solutions

### ❌ Issue 1: "Login redirect detected" / Cookies: 0

**Problem:** Your authentication file is empty or invalid

**Solution:**
```bash
# 1. Save auth properly
node public/save_auth_state.js

# 2. Log in FULLY (including 2FA if needed)
# 3. Press Enter only AFTER you see your LinkedIn feed
# 4. Verify:
node -e 'const fs=require("fs"),f="auth_state.json"; const j=JSON.parse(fs.readFileSync(f)); console.log("Cookies:",j.cookies.length);'

# Should show: Cookies: 40+ (NOT 0!)
```

### ❌ Issue 2: "Found 0 people who received proposals"

**Problem:** Step8 can't find proposals from step7

**Root Causes:**
1. Haven't run step7 yet
2. Using wrong `--state` file
3. `proposals_state.json` is empty

**Solution:**
```bash
# 1. Check if proposals file exists and has data
cat proposals_state.json

# Should see: {"proposals": [{"name": "...", ...}]}
# If empty or missing, run step7 first!

# 2. Run step7 first
node public/step7_submit_proposal_loop.js \
  --auth=auth_state.json \
  --state=proposals_state.json \
  --confirm=true

# 3. Wait 1-2 hours, then run step8 with SAME files
node public/step8_followup_message_loop_FIXED.js \
  --auth=auth_state.json \
  --state=proposals_state.json \
  --confirm=true
```

### ❌ Issue 3: "detectNameFromDialog error: selectors is not iterable"

**Problem:** Old version of script

**Solution:** You're using the latest version now - this is fixed!

### ❌ Issue 4: Duplicate proposals being sent

**Problem:** Using `--state=auth_state.json` overwrites your auth

**Solution:**
```bash
# ✅ CORRECT - Use separate files
--auth=auth_state.json      # Authentication
--state=proposals_state.json # Tracking

# ❌ WRONG - Don't do this!
--state=auth_state.json  # Will overwrite your login!
```

### ❌ Issue 5: Names showing as "there"

**Problem:** LinkedIn's proposal dialog structure varies

**This is NORMAL!** Some LinkedIn requests don't show names. The script uses "there" as fallback. Follow-ups still work correctly.

---

## File Structure Diagram

```
🔐 auth_state.json (Your LinkedIn session)
   │
   ├──> Step 7 (Submit Proposals)
   │    │
   │    └──> 📄 proposals_state.json
   │         (Saves: name, timestamp, message)
   │         │
   │         ├──> Step 8 (Follow-ups)
   │         │    │
   │         │    └──> 📄 state_followups.json
   │         │         (Saves: names contacted)
   │         │
   │         └──> Step 9 (Resumes)
   │              (Reads both files)
```

---

## Typical Workflow

### Day 1 Morning: Send Proposals
```bash
# Test first
node public/step7_submit_proposal_loop.js \
  --auth=auth_state.json \
  --state=proposals_state.json \
  --headful=true \
  --confirm=false \
  --max=5

# Looks good? Send for real
node public/step7_submit_proposal_loop.js \
  --auth=auth_state.json \
  --state=proposals_state.json \
  --confirm=true \
  --max=20
```

✅ Result: 20 proposals sent, saved to `proposals_state.json`

### Day 1 Afternoon: Send Follow-ups (2+ hours later)
```bash
# Test what will happen
node public/step8_followup_message_loop_FIXED.js \
  --auth=auth_state.json \
  --state=proposals_state.json \
  --confirm=false

# Send follow-ups
node public/step8_followup_message_loop_FIXED.js \
  --auth=auth_state.json \
  --state=proposals_state.json \
  --confirm=true
```

✅ Result: Follow-ups sent, saved to `state_followups.json`

### Day 2+: Process Resumes
```bash
export OPENAI_API_KEY=sk-...
node public/step9_resume_to_email_loop.js \
  --auth=auth_state.json \
  --confirm=true
```

---

## Checking Your State

### View proposals:
```bash
cat proposals_state.json | jq '.proposals[] | {name, timestamp}'
```

### Count proposals:
```bash
cat proposals_state.json | jq '.proposals | length'
```

### View follow-ups:
```bash
cat state_followups.json | jq '.sent'
```

---

## Resetting State (Start Fresh)

```bash
# Backup first
cp proposals_state.json proposals_backup.json
cp state_followups.json followups_backup.json

# Reset
echo '{"proposals":[]}' > proposals_state.json
echo '{"sent":[]}' > state_followups.json

# Keep auth_state.json - DON'T delete it!
```

---

## Success Checklist

Before running automation:
- [ ] Saved auth with `save_auth_state.js`
- [ ] Verified: `Cookies: 40+` (not 0!)
- [ ] Using `--auth=auth_state.json` for authentication
- [ ] Using `--state=proposals_state.json` for tracking
- [ ] Tested with `--confirm=false` first
- [ ] Using `--headful=true` to watch
- [ ] Step7 created `proposals_state.json` successfully
- [ ] Waited 1-2 hours before running step8
- [ ] Step8 using SAME state file as step7

---

## Tips

1. **Always dry run first:** `--confirm=false`
2. **Start small:** `--max=5` for testing
3. **Watch it work:** `--headful=true`
4. **Slow down if needed:** `--slowMo=150`
5. **Check state files** after each step
6. **Never delete** `auth_state.json` - you'll have to log in again
7. **Wait between steps** - don't spam LinkedIn

---

## Quick Reference

| File | Purpose | Created By |
|------|---------|------------|
| `auth_state.json` | LinkedIn session | `save_auth_state.js` |
| `proposals_state.json` | Proposal tracking | step7 (auto) |
| `state_followups.json` | Follow-up tracking | step8 (auto) |

| Script | What It Does | Key Arguments |
|--------|--------------|---------------|
| `save_auth_state.js` | Save LinkedIn login | None - just run it |
| `step7` | Send proposals | `--auth` `--state` `--confirm` |
| `step8` | Send follow-ups | `--auth` `--state` `--confirm` |
| `step9` | Process resumes | `--auth` `--confirm` |
