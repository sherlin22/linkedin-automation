// server.js - UPDATED VERSION WITH CANDIDATE WORKFLOW LOGGING
const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const { CandidateWorkflowLogger } = require('./scripts/helpers/candidate-workflow-logger');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

let workflowLogger = null;

async function initializeServer() {
  console.log('\n🚀 INITIALIZING SERVER');
  console.log('='.repeat(60));
  
  workflowLogger = new CandidateWorkflowLogger();
  const initialized = await workflowLogger.initialize();
  
  if (initialized) {
    await workflowLogger.ensureHeaders();
    console.log('✅ Candidate Workflow Logger ready\n');
  } else {
    console.log('⚠️  Google Sheets not available\n');
  }

  startServer();
}

function startServer() {
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(express.static(path.join(__dirname)));

  // ✅ PROPOSAL SUBMITTED
  // Called from step7_submit_proposal_loop.js
  // ✅ IMPROVED server.js
app.post('/api/automation/proposal-submitted', async (req, res) => {
  try {
    const { clientName, threadId } = req.body;

    // ✅ VALIDATE NAME
    if (!clientName || typeof clientName !== 'string' || clientName.length < 2) {
      console.warn(`⚠️  Invalid clientName received: ${clientName}`);
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid clientName' 
      });
    }

    console.log(`📝 Proposal submitted: ${clientName}`);

    if (workflowLogger) {
      const result = await workflowLogger.logProposal(clientName, threadId);
      if (!result.success) {
        console.warn('⚠️  Sheet logging failed:', result.error);
      }
    }

    res.json({
      success: true,
      sheetsLogged: workflowLogger ? true : false
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/automation/followup-sent', async (req, res) => {
  try {
    const { clientName, threadId } = req.body;

    // ✅ VALIDATE NAME
    if (!clientName || typeof clientName !== 'string' || clientName.length < 2) {
      console.warn(`⚠️  Invalid clientName received: ${clientName}`);
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid clientName' 
      });
    }

    console.log(`💬 Follow-up sent: ${clientName}`);

    if (workflowLogger) {
      const result = await workflowLogger.logFollowup(clientName, threadId);
      if (!result.success) {
        console.warn('⚠️  Sheet logging failed:', result.error);
      }
    }

    res.json({
      success: true,
      sheetsLogged: workflowLogger ? true : false
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/automation/resume-downloaded', async (req, res) => {
  try {
    const { clientName, resumeStatus, emailId, threadId } = req.body;

    // ✅ VALIDATE NAME
    if (!clientName || typeof clientName !== 'string' || clientName.length < 2) {
      console.warn(`⚠️  Invalid clientName received: ${clientName}`);
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid clientName' 
      });
    }

    console.log(`📥 Resume downloaded: ${clientName} (${resumeStatus})`);

    if (workflowLogger) {
      const result = await workflowLogger.logResumeDownload(
        clientName,
        resumeStatus,
        emailId,
        threadId
      );
      if (!result.success) {
        console.warn('⚠️  Sheet logging failed:', result.error);
      }
    }

    res.json({
      success: true,
      sheetsLogged: workflowLogger ? true : false
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/automation/draft-created', async (req, res) => {
  try {
    const { clientName, draftStatus } = req.body;

    // ✅ VALIDATE NAME
    if (!clientName || typeof clientName !== 'string' || clientName.length < 2) {
      console.warn(`⚠️  Invalid clientName received: ${clientName}`);
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid clientName' 
      });
    }

    console.log(`✉️  Draft created: ${clientName}`);

    if (workflowLogger) {
      const result = await workflowLogger.logMailDraft(
        clientName,
        draftStatus || 'Success'
      );
      if (!result.success) {
        console.warn('⚠️  Sheet logging failed:', result.error);
      }
    }

    res.json({
      success: true,
      sheetsLogged: workflowLogger ? true : false
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
  // ✅ FOLLOW-UP SENT
  // Called from step8_followup_message_loop.js
  app.post('/api/automation/followup-sent', async (req, res) => {
    try {
      const { clientName, threadId } = req.body;

      console.log(`💬 Follow-up sent: ${clientName}`);

      if (workflowLogger) {
        const result = await workflowLogger.logFollowup(clientName, threadId);
        if (!result.success) {
          console.warn('⚠️  Sheet logging failed:', result.error);
        }
      }

      res.json({
        success: true,
        sheetsLogged: workflowLogger ? true : false
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ✅ RESUME DOWNLOADED
  // Called from step9_complete_resume_workflow.js
  // resumeStatus should be "Success/Readable", "Success/Unreadable", or "Failed"
  app.post('/api/automation/resume-downloaded', async (req, res) => {
    try {
      const { clientName, resumeStatus, emailId, threadId } = req.body;

      console.log(`📥 Resume downloaded: ${clientName} (${resumeStatus})`);

      if (workflowLogger) {
        const result = await workflowLogger.logResumeDownload(
          clientName,
          resumeStatus,
          emailId,
          threadId
        );
        if (!result.success) {
          console.warn('⚠️  Sheet logging failed:', result.error);
        }
      }

      res.json({
        success: true,
        sheetsLogged: workflowLogger ? true : false
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ✅ GMAIL DRAFT CREATED
  // Called from gmail_draft.js
  app.post('/api/automation/draft-created', async (req, res) => {
    try {
      const { clientName, draftStatus } = req.body;

      console.log(`✉️  Draft created: ${clientName}`);

      if (workflowLogger) {
        const result = await workflowLogger.logMailDraft(
          clientName,
          draftStatus || 'Success'
        );
        if (!result.success) {
          console.warn('⚠️  Sheet logging failed:', result.error);
        }
      }

      res.json({
        success: true,
        sheetsLogged: workflowLogger ? true : false
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ✅ ADD NOTES
  app.post('/api/automation/add-note', async (req, res) => {
    try {
      const { clientName, note } = req.body;

      if (workflowLogger) {
        const result = await workflowLogger.addNote(clientName, note);
        if (!result.success) {
          console.warn('⚠️  Sheet logging failed:', result.error);
        }
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ENDPOINTS FOR STATUS
  app.get('/api/sheets/status', async (req, res) => {
    if (!workflowLogger) {
      return res.json({ status: 'error', message: 'Not initialized' });
    }
    const rowCount = await workflowLogger.getRowCount();
    res.json({
      status: 'connected',
      sheetId: workflowLogger.sheetId,
      sheetName: workflowLogger.sheetName,
      totalRows: rowCount
    });
  });

  app.get('/health', (req, res) => {
    res.json({
      status: 'OK',
      sheetsConnected: workflowLogger ? true : false
    });
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  const server = app.listen(PORT, () => {
    console.log(`\n✅ Server running on http://localhost:${PORT}`);
    console.log(`📡 Webhook Endpoints:`);
    console.log(`   POST /api/automation/proposal-submitted`);
    console.log(`   POST /api/automation/followup-sent`);
    console.log(`   POST /api/automation/resume-downloaded`);
    console.log(`   POST /api/automation/draft-created`);
    console.log(`\n✨ Ready for automation updates...\n`);
  });

  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down...');
    server.close(() => process.exit(0));
  });
}

initializeServer();