# 🔌 API Reference Guide

Complete documentation for all API endpoints used in the LinkedIn automation system.

---

## 📋 Overview

This document describes all available API endpoints you can call to integrate with the automation system, log events, and retrieve metrics.

**Base URL:** `http://localhost:3000`

**All requests use JSON** (Content-Type: application/json)

---

## 🚀 Quick Reference

### **All Endpoints:**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/automation/proposal-submitted` | Log proposal sent |
| POST | `/api/automation/followup-sent` | Log follow-up sent |
| POST | `/api/automation/resume-downloaded` | Log resume download |
| POST | `/api/automation/draft-created` | Log Gmail draft created |
| GET | `/api/sheets/status` | Check Google Sheets connection |
| GET | `/health` | Check server health |

---

## 📡 Automation Endpoints

These endpoints log automation events to Google Sheets and track activity.

---

### **1. POST - Proposal Submitted**

**Endpoint:** `/api/automation/proposal-submitted`

**Purpose:** Log when a proposal is sent to a client

**Request:**
```json
{
  "clientName": "John Smith",
  "threadId": "thread-12345",
  "email": "john@example.com"
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `clientName` | String | ✅ Yes | Name of the person receiving proposal (must be valid name) |
| `threadId` | String | ❌ No | LinkedIn thread/conversation ID |
| `email` | String | ❌ No | Client's email address (if available) |

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/automation/proposal-submitted \
  -H "Content-Type: application/json" \
  -d '{
    "clientName": "Sarah Johnson",
    "threadId": "conn-98765",
    "email": "sarah@company.com"
  }'
```

**Success Response (200):**
```json
{
  "success": true,
  "sheetsLogged": true,
  "message": "Proposal logged successfully"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Invalid clientName - must be a valid person's name"
}
```

**What It Does:**
1. ✅ Validates the client name format
2. ✅ Logs to Google Sheets (if configured)
3. ✅ Updates `activity_logs.json`
4. ✅ Increments metrics count
5. ✅ Records timestamp

**Used By:**
- `step7_submit_proposal_loop.js`
- N8N workflow Step 7

---

### **2. POST - Follow-up Sent**

**Endpoint:** `/api/automation/followup-sent`

**Purpose:** Log when a follow-up message is sent

**Request:**
```json
{
  "clientName": "John Smith",
  "threadId": "thread-12345",
  "email": "john@example.com",
  "message": "Hi, Pls share your Resume to proceed further discussion."
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `clientName` | String | ✅ Yes | Name receiving follow-up |
| `threadId` | String | ❌ No | LinkedIn thread ID |
| `email` | String | ❌ No | Client's email |
| `message` | String | ❌ No | Follow-up message sent |

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/automation/followup-sent \
  -H "Content-Type: application/json" \
  -d '{
    "clientName": "Michael Chen",
    "threadId": "conn-54321",
    "message": "Hi, Pls share your Resume to proceed further discussion."
  }'
```

**Success Response (200):**
```json
{
  "success": true,
  "sheetsLogged": true
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Invalid clientName"
}
```

**What It Does:**
1. ✅ Validates client name
2. ✅ Logs to Google Sheets
3. ✅ Updates `activity_logs.json`
4. ✅ Increments followup metrics
5. ✅ Tracks follow-up history

**Used By:**
- `step8_followup_message_loop.js`
- N8N workflow Step 8

---

### **3. POST - Resume Downloaded**

**Endpoint:** `/api/automation/resume-downloaded`

**Purpose:** Log when a resume is downloaded and processed

**Request:**
```json
{
  "clientName": "Sarah Williams",
  "resumeStatus": "Success/Readable",
  "emailId": "sarah.williams@email.com",
  "threadId": "thread-67890"
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `clientName` | String | ✅ Yes | Person whose resume was downloaded |
| `resumeStatus` | String | ✅ Yes | "Success/Readable" or "Success/Unreadable" |
| `emailId` | String | ❌ No | Email extracted from resume |
| `threadId` | String | ❌ No | LinkedIn thread ID |

**Resume Status Values:**
- `Success/Readable` - PDF parsed successfully, contains useful content
- `Success/Unreadable` - Downloaded but couldn't parse PDF
- `Failed` - Download failed

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/automation/resume-downloaded \
  -H "Content-Type: application/json" \
  -d '{
    "clientName": "Alex Rodriguez",
    "resumeStatus": "Success/Readable",
    "emailId": "alex.rodriguez@company.com",
    "threadId": "conv-11111"
  }'
```

**Success Response (200):**
```json
{
  "success": true,
  "sheetsLogged": true
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Invalid clientName"
}
```

**What It Does:**
1. ✅ Validates client name
2. ✅ Logs to Google Sheets with readable/unreadable status
3. ✅ Updates `activity_logs.json`
4. ✅ Increments download metrics
5. ✅ Records email extracted from resume
6. ✅ Organizes resume in Drive (readable/unreadable folders)

**Used By:**
- `step9_complete_resume_workflow.js`
- Resume processing pipeline

---

### **4. POST - Draft Created**

**Endpoint:** `/api/automation/draft-created`

**Purpose:** Log when a Gmail draft is created with proposal and critique

**Request:**
```json
{
  "clientName": "Emily Davis",
  "draftStatus": "Success",
  "email": "emily.davis@email.com",
  "draftId": "draft-abc123"
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `clientName` | String | ✅ Yes | Person receiving the draft email |
| `draftStatus` | String | ✅ Yes | "Success" or "Failed" |
| `email` | String | ❌ No | Client's email address |
| `draftId` | String | ❌ No | Gmail draft ID |

**Draft Status Values:**
- `Success` - Draft created successfully
- `Failed` - Draft creation failed
- `Skipped` - No critique available, skipped

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/automation/draft-created \
  -H "Content-Type: application/json" \
  -d '{
    "clientName": "David Thompson",
    "draftStatus": "Success",
    "email": "david.thompson@email.com",
    "draftId": "draft-xyz789"
  }'
```

**Success Response (200):**
```json
{
  "success": true,
  "sheetsLogged": true
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Invalid clientName"
}
```

**What It Does:**
1. ✅ Validates client name
2. ✅ Logs to Google Sheets with draft status
3. ✅ Updates `activity_logs.json`
4. ✅ Increments draft metrics
5. ✅ Records Gmail draft ID for tracking
6. ✅ Links draft to client record

**Used By:**
- `step9_complete_resume_workflow.js`
- Gmail draft creation function

---

## 📊 Metrics & Status Endpoints

Check system health and retrieve metrics.

---

### **5. GET - Google Sheets Status**

**Endpoint:** `/api/sheets/status`

**Purpose:** Check if Google Sheets logging is connected and working

**Request:**
```bash
curl http://localhost:3000/api/sheets/status
```

**Success Response (200):**
```json
{
  "status": "connected",
  "sheetId": "1BxiMVs0XRA5nFMKUVUuzqz6J_9...",
  "sheetName": "Sheet1",
  "totalRows": 145
}
```

**Disconnected Response (200):**
```json
{
  "status": "error",
  "message": "Not initialized"
}
```

**What It Shows:**
- `status` - "connected" or "error"
- `sheetId` - Google Sheet ID being used
- `sheetName` - Active sheet name
- `totalRows` - Number of records logged

**When to Use:**
- Verify Google Sheets integration is working
- Check how many records have been logged
- Troubleshoot connection issues

---

### **6. GET - Health Check**

**Endpoint:** `/health`

**Purpose:** Basic server health check (used by N8N)

**Request:**
```bash
curl http://localhost:3000/health
```

**Success Response (200):**
```json
{
  "status": "OK",
  "sheetsConnected": true
}
```

**Error Response (200):**
```json
{
  "status": "OK",
  "sheetsConnected": false
}
```

**What It Shows:**
- `status` - Server is running ("OK")
- `sheetsConnected` - Google Sheets logging available

**When to Use:**
- Check if server is running
- Verify before running N8N workflows
- Monitoring/alerting systems

---

## 🔄 Complete Request/Response Examples

### **Example 1: Full Proposal Logging Flow**

```bash
# 1. Proposal Submitted
curl -X POST http://localhost:3000/api/automation/proposal-submitted \
  -H "Content-Type: application/json" \
  -d '{
    "clientName": "John Smith",
    "threadId": "thread-001",
    "email": "john@example.com"
  }'

# Response:
{
  "success": true,
  "sheetsLogged": true
}

# This creates an entry in:
# - Google Sheets (if configured)
# - activity_logs.json
# - n8n_metrics.json (increments proposals count)
```

---

### **Example 2: Complete Resume Processing Flow**

```bash
# 1. Resume Downloaded
curl -X POST http://localhost:3000/api/automation/resume-downloaded \
  -H "Content-Type: application/json" \
  -d '{
    "clientName": "Sarah Johnson",
    "resumeStatus": "Success/Readable",
    "emailId": "sarah@company.com",
    "threadId": "thread-002"
  }'

# 2. Draft Created with Critique
curl -X POST http://localhost:3000/api/automation/draft-created \
  -H "Content-Type: application/json" \
  -d '{
    "clientName": "Sarah Johnson",
    "draftStatus": "Success",
    "email": "sarah@company.com",
    "draftId": "draft-12345"
  }'

# Results in:
# - Resume stored in Google Drive (/Readable/2025-01-17/)
# - Gmail draft created with AI critique
# - Activity logged to Sheets
# - Metrics updated
```

---

## 🔐 Authentication & Security

### **Current Setup (No Auth Required)**

The current API runs on `localhost:3000` and requires **no authentication** because:
- ✅ Only accessible locally
- ✅ Used by scripts on same machine
- ✅ N8N runs on same server
- ✅ Not exposed to internet

### **If You Need to Secure It**

Add basic authentication:

```javascript
// In server.js (example)
const basicAuth = require('express-basic-auth');

app.use(basicAuth({
  users: { 'admin': 'your-password' }
}));
```

Then call API with auth:
```bash
curl -X POST http://localhost:3000/api/automation/proposal-submitted \
  -u admin:your-password \
  -H "Content-Type: application/json" \
  -d '{"clientName": "John Smith"}'
```

---

## 📝 Request Validation

### **Client Name Validation Rules**

All endpoints validate `clientName` using these rules:

✅ **Valid Names:**
- "John Smith" (normal format)
- "SURAJ NARAYAN" (all caps)
- "Sarah O'Brien" (apostrophe)
- "Mary-Jane Watson" (hyphenated)
- "Jean Dubois" (2-3 words)

❌ **Invalid Names:**
- "Resume Writing" (service term)
- "For Business" (company term)
- "UNKNOWN" (placeholder)
- "John" (single word)
- "123 456" (numbers)

### **Validation Code:**

```javascript
function isValidCandidateName(name) {
  if (!name || typeof name !== 'string') return false;
  if (name.length < 2 || name.length > 100) return false;
  
  const words = name.trim().split(/\s+/);
  if (words.length < 2 || words.length > 3) return false;
  
  const validPattern = /^[A-Z][a-z'-]*$/;
  return words.every(word => validPattern.test(word));
}
```

---

## 📊 Response Status Codes

### **Standard HTTP Status Codes Used:**

| Code | Meaning | When Used |
|------|---------|-----------|
| 200 | OK | Endpoint executed successfully |
| 400 | Bad Request | Invalid parameters (e.g., bad name) |
| 404 | Not Found | Endpoint doesn't exist |
| 500 | Server Error | Unexpected error in processing |

### **Response Structure:**

**Success (200):**
```json
{
  "success": true,
  "sheetsLogged": true,
  "message": "Optional message"
}
```

**Error (400):**
```json
{
  "success": false,
  "error": "Description of what went wrong"
}
```

---

## 🔌 Integration Examples

### **Using JavaScript/Node.js**

```javascript
// Log a proposal
async function logProposal(clientName) {
  const response = await fetch('http://localhost:3000/api/automation/proposal-submitted', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientName: clientName,
      threadId: `thread-${Date.now()}`,
      email: 'unknown@example.com'
    })
  });
  
  const data = await response.json();
  console.log(data);
  return data.success;
}

// Usage
logProposal("John Smith");
```

---

### **Using Python**

```python
import requests
import json

def log_proposal(client_name):
    url = "http://localhost:3000/api/automation/proposal-submitted"
    payload = {
        "clientName": client_name,
        "threadId": f"thread-{int(time.time())}",
        "email": "unknown@example.com"
    }
    
    response = requests.post(
        url,
        json=payload,
        headers={"Content-Type": "application/json"}
    )
    
    return response.json()

# Usage
result = log_proposal("Sarah Johnson")
print(result)
```

---

### **Using cURL**

```bash
# Proposal
curl -X POST http://localhost:3000/api/automation/proposal-submitted \
  -H "Content-Type: application/json" \
  -d '{"clientName":"John Smith"}'

# Follow-up
curl -X POST http://localhost:3000/api/automation/followup-sent \
  -H "Content-Type: application/json" \
  -d '{"clientName":"John Smith"}'

# Resume
curl -X POST http://localhost:3000/api/automation/resume-downloaded \
  -H "Content-Type: application/json" \
  -d '{"clientName":"John Smith","resumeStatus":"Success/Readable"}'

# Draft
curl -X POST http://localhost:3000/api/automation/draft-created \
  -H "Content-Type: application/json" \
  -d '{"clientName":"John Smith","draftStatus":"Success"}'

# Health Check
curl http://localhost:3000/health

# Sheets Status
curl http://localhost:3000/api/sheets/status
```

---

## 📈 Data Flow

### **Complete Proposal to Critque Flow:**

```
Step 7: Send Proposal
    ↓
POST /api/automation/proposal-submitted
    ↓
Logged to:
  - Google Sheets
  - activity_logs.json
  - n8n_metrics.json (proposals++))
    ↓

Step 8: Send Follow-up
    ↓
POST /api/automation/followup-sent
    ↓
Logged to:
  - Google Sheets
  - activity_logs.json
  - n8n_metrics.json (followups++)
    ↓

Step 9: Process Resume
    ↓
POST /api/automation/resume-downloaded
    ↓
Logged to:
  - Google Sheets
  - activity_logs.json
  - n8n_metrics.json (downloads++)
    ↓

Create Gmail Draft
    ↓
POST /api/automation/draft-created
    ↓
Logged to:
  - Google Sheets
  - activity_logs.json
  - n8n_metrics.json (drafts++)
```

---

## 🚨 Error Handling

### **Common Errors & Fixes:**

**Error: "Invalid clientName - must be a valid person's name"**
```
Cause: Name doesn't match validation rules
Fix: Use format like "John Smith" (2-3 words, proper case)
```

**Error: "Cannot POST /api/automation/proposal-submitted"**
```
Cause: Server not running
Fix: Run "npm start" in Terminal 1
```

**Error: "sheetsLogged": false**
```
Cause: Google Sheets not configured
Fix: Data still logged locally, configure GOOGLE_SHEET_ID in .env
```

**Error: "Connection timeout"**
```
Cause: Server not responding
Fix: Check if npm start is running, restart if needed
```

---

## 📋 Activity Logs Structure

### **What Gets Saved in activity_logs.json:**

```json
{
  "proposals": [
    {
      "name": "John Smith",
      "email": "john@example.com",
      "threadId": "thread-001",
      "status": "success",
      "timestamp": "2025-01-17T08:15:30.000Z"
    }
  ],
  "followups": [
    {
      "name": "Sarah Johnson",
      "email": "unknown@example.com",
      "message": "Hi, Pls share your Resume...",
      "threadId": "thread-002",
      "status": "success",
      "timestamp": "2025-01-17T08:25:45.000Z"
    }
  ],
  "downloads": [
    {
      "name": "Michael Chen",
      "fileName": "resume_michael_chen_1705484330000.pdf",
      "status": "success",
      "timestamp": "2025-01-17T08:35:20.000Z"
    }
  ],
  "drafts": [
    {
      "name": "Emily Davis",
      "email": "emily.davis@email.com",
      "draftId": "draft-12345",
      "subject": "Resume & LinkedIn Profile Enhancement Proposal for Emily Davis",
      "status": "success",
      "timestamp": "2025-01-17T08:45:10.000Z"
    }
  ]
}
```

---

## 📊 Metrics Structure

### **What Gets Tracked in n8n_metrics.json:**

```json
{
  "slots": {
    "slot1": {
      "time": "8am",
      "proposals": 45,
      "followups": 32,
      "downloads": 18,
      "drafts": 15,
      "lastRun": "2025-01-17T08:47:30Z",
      "runDuration": 47
    },
    "slot2": {
      "time": "2pm",
      "proposals": 38,
      "followups": 28,
      "downloads": 12,
      "drafts": 10,
      "lastRun": "2025-01-17T14:52:15Z",
      "runDuration": 52
    },
    "slot3": {
      "time": "6pm",
      "proposals": 52,
      "followups": 35,
      "downloads": 14,
      "drafts": 12,
      "lastRun": "2025-01-17T18:41:45Z",
      "runDuration": 41
    }
  },
  "lastUpdate": "2025-01-17T18:41:45Z"
}
```

---

## 🔧 Extending the API

### **Adding a New Endpoint**

Example: Log a custom event

```javascript
// In server.js
app.post('/api/automation/custom-event', async (req, res) => {
  try {
    const { eventName, clientName, data } = req.body;
    
    // Validate
    if (!clientName || !eventName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    // Log
    console.log(`Custom event: ${eventName} for ${clientName}`);
    
    // Store
    // ... add to activity_logs.json
    
    // Respond
    res.json({
      success: true,
      message: `Custom event logged: ${eventName}`
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

Call it:
```bash
curl -X POST http://localhost:3000/api/automation/custom-event \
  -H "Content-Type: application/json" \
  -d '{"eventName":"test","clientName":"John Smith"}'
```

---

## ✅ API Checklist

### **Before Using API:**
- [ ] Server is running (`npm start`)
- [ ] Can access `http://localhost:3000`
- [ ] Can access `http://localhost:3000/health`
- [ ] All parameters are correct format
- [ ] Client names follow validation rules

### **When Creating Integrations:**
- [ ] Handle all possible response codes
- [ ] Validate client names before sending
- [ ] Log API responses for debugging
- [ ] Implement retry logic for failures
- [ ] Monitor API performance

---

## 📞 Support

### **API Issues:**

**Server not responding:**
```bash
# Check if running
npm start

# Check health
curl http://localhost:3000/health

# Check sheets status
curl http://localhost:3000/api/sheets/status
```

**Invalid requests:**
- Verify Content-Type header: `application/json`
- Check clientName format (2-3 word names only)
- Review request body JSON syntax

**Logging not working:**
- Check `activity_logs.json` exists
- Verify permissions on file
- Check server console for errors

---

## 📚 Related Documentation

- **README.md** - Setup and daily usage
- **WORKFLOW.md** - N8N workflow configuration
- **TROUBLESHOOTING.md** - Common issues and fixes

---

**API Version:** 1.0
**Last Updated:** January 2026
**Base URL:** http://localhost:3000