require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');

const coordinatorService = require('./services/coordinatorService');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : ['http://localhost:4200', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    role: 'coordinator-messenger'
  });
});

// API Routes

// Initialize a new threshold session
app.post('/api/sessions', async (req, res) => {
  try {
    const { operation, parties, threshold, totalParties, metadata } = req.body;
    
    if (!operation || !parties || !Array.isArray(parties) || !threshold || !totalParties) {
      return res.status(400).json({
        error: 'Invalid request. Operation, parties, threshold, and totalParties are required.'
      });
    }
    if (parties.length !== totalParties) {
      return res.status(400).json({
        error: `Party count mismatch: got ${parties.length}, expected ${totalParties}`
      });
    }
    if (threshold < 2 || threshold > totalParties) {
      return res.status(400).json({
        error: 'Invalid threshold. Must be at least 2 and at most totalParties.'
      });
    }

    const session = await coordinatorService.initializeSession(operation, parties, threshold, totalParties, metadata);
    
    res.status(201).json({
      success: true,
      sessionId: session.sessionId,
      status: session.status,
      message: 'Session initialized successfully'
    });
  } catch (error) {
    console.error('Error initializing session:', error);
    res.status(500).json({
      error: 'Failed to initialize session',
      message: error.message
    });
  }
});

// Get session status
app.get('/api/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await coordinatorService.getSessionStatus(sessionId);
    
    res.json({
      success: true,
      session
    });
  } catch (error) {
    console.error('Error getting session:', error);
    res.status(404).json({
      error: 'Session not found',
      message: error.message
    });
  }
});

// List active sessions
app.get('/api/sessions', async (req, res) => {
  try {
    const { status, limit } = req.query;
    const sessions = await coordinatorService.listSessions(status, parseInt(limit) || 50);
    
    res.json({
      success: true,
      sessions,
      count: sessions.length
    });
  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({
      error: 'Failed to list sessions',
      message: error.message
    });
  }
});

// Initiate distributed key generation
app.post('/api/sessions/:sessionId/initiate-dkg', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { blockchain } = req.body;
    
    const result = await coordinatorService.initiateDistributedKeyGeneration(sessionId, blockchain);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error initiating DKG:', error);
    res.status(500).json({
      error: 'Failed to initiate distributed key generation',
      message: error.message
    });
  }
});

// Create threshold signature
app.post('/api/sessions/:sessionId/sign', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { message } = req.body;
    
    console.log(`📝 Signature request received for session: ${sessionId}`);
    console.log(`📄 Message: ${message}`);
    
    if (!message) {
      console.error('❌ Message is required');
      return res.status(400).json({
        error: 'Message is required'
      });
    }

    console.log(`🔍 Calling coordinatorService.createThresholdSignature for session: ${sessionId}`);
    const result = await coordinatorService.createThresholdSignature(sessionId, message);
    console.log(`✅ Threshold signature creation successful for session: ${sessionId}`);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('❌ Error creating threshold signature:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      error: 'Failed to create threshold signature',
      message: error.message
    });
  }
});

// Add a party's communication public key
app.post('/api/sessions/:sessionId/parties/:partyId/communication-key', async (req, res) => {
  try {
    const { sessionId, partyId } = req.params;
    const { publicKey } = req.body;

    if (!publicKey) {
      return res.status(400).json({ error: 'Public key is required' });
    }

    const result = await coordinatorService.addCommunicationPublicKey(sessionId, parseInt(partyId), publicKey);
    res.json(result);
  } catch (error) {
    console.error('Error adding communication public key:', error);
    res.status(500).json({ error: error.message });
  }
});

// Register a party with the coordinator
app.post('/api/parties/register', async (req, res) => {
  try {
    const { partyId, webhookUrl, walletAddress, timestamp } = req.body;
    
    console.log(`📝 Party registration received: Party ${partyId}, Wallet: ${walletAddress}`);
    
    if (!partyId || !webhookUrl || !walletAddress) {
      return res.status(400).json({
        error: 'Party ID, webhook URL, and wallet address are required'
      });
    }

    // Store party registration in coordinator service
    await coordinatorService.registerParty(partyId, webhookUrl, walletAddress);
    
    res.json({
      success: true,
      message: `Party ${partyId} registered successfully with wallet address ${walletAddress}`
    });
  } catch (error) {
    console.error('Error registering party:', error);
    res.status(500).json({
      error: 'Failed to register party',
      message: error.message
    });
  }
});

// Webhook endpoint for party responses
app.post('/api/webhook/:sessionId/:partyId', async (req, res) => {
  try {
    const { sessionId, partyId } = req.params;
    const { event, payload } = req.body;
    
    console.log(`📡 Received webhook: ${event} from Party ${partyId} for Session ${sessionId}`);
    
    if (!event || !payload) {
      return res.status(400).json({
        error: 'Event and payload are required'
      });
    }

    const result = await coordinatorService.handlePartyResponse(
      sessionId,
      parseInt(partyId),
      event,
      payload
    );
    
    console.log(`✅ Webhook processed successfully for Session ${sessionId}`);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error(`❌ Error handling webhook for Session ${req.params.sessionId}:`, error);
    
    if (error.message === 'Session not found') {
      res.status(404).json({
        error: 'Session not found',
        message: `Session ${req.params.sessionId} does not exist or has expired`,
        sessionId: req.params.sessionId
      });
    } else if (error.message.includes('Party not found')) {
      res.status(404).json({
        error: 'Party not found',
        message: error.message,
        sessionId: req.params.sessionId,
        partyId: req.params.partyId
      });
    } else {
      res.status(500).json({
        error: 'Failed to handle webhook',
        message: error.message
      });
    }
  }
});

// Get webhook logs for a session
app.get('/api/webhook-logs/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit } = req.query;
    
    const logs = await coordinatorService.getWebhookLogs(sessionId, parseInt(limit) || 100);
    
    res.json({
      success: true,
      logs,
      count: logs.length
    });
  } catch (error) {
    console.error('Error getting webhook logs:', error);
    res.status(500).json({
      error: 'Failed to get webhook logs',
      message: error.message
    });
  }
});

// Get pending webhook events for browser parties
app.get('/api/sessions/:sessionId/parties/:partyId/webhook-events', async (req, res) => {
  try {
    const { sessionId, partyId } = req.params;
    
    const events = await coordinatorService.getPendingWebhookEvents(sessionId, parseInt(partyId));
    
    res.json({
      success: true,
      events
    });
  } catch (error) {
    console.error('Error getting webhook events:', error);
    res.status(500).json({
      error: 'Failed to get webhook events',
      message: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested resource was not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`TLS-MCP Coordinator (Messenger) running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
}); 