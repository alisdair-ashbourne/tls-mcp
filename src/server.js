require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');

const sessionService = require('./services/sessionService');

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

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('Connected to MongoDB');
})
.catch((error) => {
  console.error('MongoDB connection error:', error);
  process.exit(1);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API Routes

// Session management
app.post('/api/sessions', async (req, res) => {
  try {
    const { operation, parties, metadata } = req.body;
    
    if (!operation || !parties || !Array.isArray(parties) || parties.length !== 3) {
      return res.status(400).json({
        error: 'Invalid request. Operation and exactly 3 parties are required.'
      });
    }

    const session = await sessionService.createSession(operation, parties, metadata);
    
    res.status(201).json({
      success: true,
      sessionId: session.sessionId,
      status: session.status,
      message: 'Session created successfully'
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({
      error: 'Failed to create session',
      message: error.message
    });
  }
});

app.get('/api/sessions', async (req, res) => {
  try {
    const { status, limit } = req.query;
    const sessions = await sessionService.listSessions(status, parseInt(limit) || 50);
    
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

app.get('/api/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await sessionService.getSessionStatus(sessionId);
    
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

// Key generation
app.post('/api/sessions/:sessionId/generate-key', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { walletAddress, blockchain } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({
        error: 'Wallet address is required'
      });
    }

    const result = await sessionService.generateKey(sessionId, walletAddress, blockchain);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error generating key:', error);
    res.status(500).json({
      error: 'Failed to generate key',
      message: error.message
    });
  }
});

// Key reconstruction
app.post('/api/sessions/:sessionId/reconstruct-key', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = await sessionService.reconstructKey(sessionId);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error reconstructing key:', error);
    res.status(500).json({
      error: 'Failed to reconstruct key',
      message: error.message
    });
  }
});

// Signature creation
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

    console.log(`🔍 Calling sessionService.createSignature for session: ${sessionId}`);
    const result = await sessionService.createSignature(sessionId, message);
    console.log(`✅ Signature creation successful for session: ${sessionId}`);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('❌ Error creating signature:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      error: 'Failed to create signature',
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

    const result = await sessionService.handlePartyResponse(
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
    
    // Provide more specific error messages
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

// Webhook logs
app.get('/api/webhook-logs/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit } = req.query;
    
    const WebhookLog = require('./models/WebhookLog');
    const logs = await WebhookLog.getSessionLogs(sessionId, parseInt(limit) || 100);
    
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

// Scheduled tasks
cron.schedule('0 */6 * * *', async () => {
  // Cleanup expired sessions every 6 hours
  try {
    const result = await sessionService.cleanupExpiredSessions();
    console.log(`Cleaned up ${result.modifiedCount} expired sessions`);
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await mongoose.connection.close();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`TLS-MCP Coordinator Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
}); 