// server.js - With Pino Logger
const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const { CandidateWorkflowLogger } = require('./scripts/helpers/candidate-workflow-logger');
const { logger, createModuleLogger } = require('./logger');
require('dotenv').config();

// Create module loggers
const serverLogger = createModuleLogger('server');
const apiLogger = createModuleLogger('api');

const app = express();
const PORT = process.env.PORT || 3000;

let workflowLogger = null;

async function initializeServer() {
  serverLogger.info('Initializing server');
  
  workflowLogger = new CandidateWorkflowLogger();
  const initialized = await workflowLogger.initialize();
  
  if (initialized) {
    await workflowLogger.ensureHeaders();
    serverLogger.info('Candidate Workflow Logger ready');
  } else {
    serverLogger.warn('Google Sheets not available');
  }

  startServer();
}

function startServer() {
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(express.static(path.join(__dirname)));

  // PROPOSAL SUBMITTED
  app.post('/api/automation/proposal-submitted', async (req, res) => {
    try {
      const { clientName, threadId } = req.body;

      if (!clientName || typeof clientName !== 'string' || clientName.length < 2) {
        apiLogger.warn({ clientName }, 'Invalid clientName received');
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid clientName' 
        });
      }

      apiLogger.info({ clientName, threadId }, 'Proposal submitted');

      if (workflowLogger) {
        const result = await workflowLogger.logProposal(clientName, threadId);
        if (!result.success) {
          apiLogger.warn({ error: result.error }, 'Sheet logging failed');
        }
      }

      res.json({
        success: true,
        sheetsLogged: workflowLogger ? true : false
      });
    } catch (error) {
      apiLogger.error({ error: error.message }, 'Error in proposal-submitted');
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // FOLLOW-UP SENT
  app.post('/api/automation/followup-sent', async (req, res) => {
    try {
      const { clientName, threadId } = req.body;

      if (!clientName || typeof clientName !== 'string' || clientName.length < 2) {
        apiLogger.warn({ clientName }, 'Invalid clientName received');
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid clientName' 
        });
      }

      apiLogger.info({ clientName, threadId }, 'Follow-up sent');

      if (workflowLogger) {
        const result = await workflowLogger.logFollowup(clientName, threadId);
        if (!result.success) {
          apiLogger.warn({ error: result.error }, 'Sheet logging failed');
        }
      }

      res.json({
        success: true,
        sheetsLogged: workflowLogger ? true : false
      });
    } catch (error) {
      apiLogger.error({ error: error.message }, 'Error in followup-sent');
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // RESUME DOWNLOADED
  app.post('/api/automation/resume-downloaded', async (req, res) => {
    try {
      const { clientName, resumeStatus, emailId, threadId } = req.body;

      if (!clientName || typeof clientName !== 'string' || clientName.length < 2) {
        apiLogger.warn({ clientName }, 'Invalid clientName received');
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid clientName' 
        });
      }

      apiLogger.info({ clientName, resumeStatus }, 'Resume downloaded');

      if (workflowLogger) {
        const result = await workflowLogger.logResumeDownload(
          clientName,
          resumeStatus,
          emailId,
          threadId
        );
        if (!result.success) {
          apiLogger.warn({ error: result.error }, 'Sheet logging failed');
        }
      }

      res.json({
        success: true,
        sheetsLogged: workflowLogger ? true : false
      });
    } catch (error) {
      apiLogger.error({ error: error.message }, 'Error in resume-downloaded');
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GMAIL DRAFT CREATED
  app.post('/api/automation/draft-created', async (req, res) => {
    try {
      const { clientName, draftStatus } = req.body;

      if (!clientName || typeof clientName !== 'string' || clientName.length < 2) {
        apiLogger.warn({ clientName }, 'Invalid clientName received');
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid clientName' 
        });
      }

      apiLogger.info({ clientName, draftStatus }, 'Draft created');

      if (workflowLogger) {
        const result = await workflowLogger.logMailDraft(
          clientName,
          draftStatus || 'Success'
        );
        if (!result.success) {
          apiLogger.warn({ error: result.error }, 'Sheet logging failed');
        }
      }

      res.json({
        success: true,
        sheetsLogged: workflowLogger ? true : false
      });
    } catch (error) {
      apiLogger.error({ error: error.message }, 'Error in draft-created');
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // DRAFT FOLLOW-UP SENT (Step 10)
  app.post('/api/automation/draft-followup-sent', async (req, res) => {
    try {
      const { clientName, email, threadId, draftType = 'Auto' } = req.body;

      if (!clientName || typeof clientName !== 'string' || clientName.length < 2) {
        apiLogger.warn({ clientName }, 'Invalid clientName received');
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid clientName' 
        });
      }

      apiLogger.info({ clientName, draftType }, 'Draft follow-up sent');

      if (workflowLogger) {
        const result = await workflowLogger.logDraftFollowup(
          clientName,
          draftType,
          'Success'
        );
        if (!result.success) {
          apiLogger.warn({ error: result.error }, 'Sheet logging failed');
        }
      }

      res.json({
        success: true,
        sheetsLogged: workflowLogger ? true : false
      });
    } catch (error) {
      apiLogger.error({ error: error.message }, 'Error in draft-followup-sent');
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // MANUAL DRAFT FOLLOW-UP (Step 11)
  app.post('/api/automation/manual-draft-followup-sent', async (req, res) => {
    try {
      const { clientName, email, threadId } = req.body;

      if (!clientName || typeof clientName !== 'string' || clientName.length < 2) {
        apiLogger.warn({ clientName }, 'Invalid clientName received');
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid clientName' 
        });
      }

      apiLogger.info({ clientName }, 'Manual draft follow-up sent');

      if (workflowLogger) {
        const result = await workflowLogger.logDraftFollowup(
          clientName,
          'Manual',
          'Success'
        );
        if (!result.success) {
          apiLogger.warn({ error: result.error }, 'Sheet logging failed');
        }
      }

      res.json({
        success: true,
        sheetsLogged: workflowLogger ? true : false
      });
    } catch (error) {
      apiLogger.error({ error: error.message }, 'Error in manual-draft-followup-sent');
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ADD NOTES
  app.post('/api/automation/add-note', async (req, res) => {
    try {
      const { clientName, note } = req.body;

      apiLogger.info({ clientName }, 'Note added');

      if (workflowLogger) {
        const result = await workflowLogger.addNote(clientName, note);
        if (!result.success) {
          apiLogger.warn({ error: result.error }, 'Sheet logging failed');
        }
      }

      res.json({ success: true });
    } catch (error) {
      apiLogger.error({ error: error.message }, 'Error in add-note');
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // STATUS ENDPOINTS
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

  // 404 Handler
  app.use((req, res) => {
    apiLogger.warn({ path: req.path }, 'Route not found');
    res.status(404).json({ error: 'Route not found' });
  });

  const server = app.listen(PORT, () => {
    serverLogger.info({ port: PORT }, 'Server running');
    console.log('\n========================================');
    console.log(`   Server running on http://localhost:${PORT}`);
    console.log('========================================\n');
  });

  process.on('SIGINT', () => {
    serverLogger.info('Shutting down server');
    server.close(() => process.exit(0));
  });
}

initializeServer();

