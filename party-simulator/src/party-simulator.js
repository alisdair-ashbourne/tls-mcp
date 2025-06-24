const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

// Parse command line arguments
const args = process.argv.slice(2);
const partyArg = args.find(arg => arg.startsWith('--party='))?.split('=')[1] || 'a';
const portArg = args.find(arg => arg.startsWith('--port='))?.split('=')[1] || '3001';

const PARTY_ID = partyArg === 'a' ? 1 : partyArg === 'b' ? 2 : 3;
const PORT = parseInt(portArg);
const COORDINATOR_URL = 'http://localhost:3000';

class PartySimulator {
  constructor() {
    this.app = express();
    this.sessions = new Map();
    this.shares = new Map();
    this.coordinatorUrl = COORDINATOR_URL;
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // CORS middleware to allow requests from Angular frontend
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', 'http://localhost:4200');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      
      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
    
    this.app.use(express.json());
    this.app.use((req, res, next) => {
      console.log(`[Party ${PARTY_ID}] ${req.method} ${req.path}`, req.body);
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        partyId: PARTY_ID,
        status: 'healthy',
        timestamp: new Date().toISOString()
      });
    });

    // Webhook endpoint for coordinator communication
    this.app.post('/webhook', async (req, res) => {
      try {
        const { sessionId, partyId, event, timestamp, ...payload } = req.body;
        
        console.log(`[Party ${PARTY_ID}] Received webhook: ${event} for session ${sessionId}`);
        
        // Handle different events
        switch (event) {
          case 'session_initialized':
            await this.handleSessionInitialized(sessionId, payload);
            break;
          
          case 'dkg_initiated':
            await this.handleDKGInitiated(sessionId, payload);
            break;
          
          case 'share_received':
            await this.handleShareReceived(sessionId, payload);
            break;
          
          case 'signature_requested':
            await this.handleSignatureRequested(sessionId, payload);
            break;
          
          case 'reconstruction_requested':
            await this.handleReconstructionRequested(sessionId, payload);
            break;
          
          case 'session_completed':
            await this.handleSessionCompleted(sessionId, payload);
            break;
          
          case 'session_failed':
            await this.handleSessionFailed(sessionId, payload);
            break;
          
          case 'heartbeat':
            await this.handleHeartbeat(sessionId, payload);
            break;
          
          default:
            console.log(`[Party ${PARTY_ID}] Unknown event: ${event}`);
        }
        
        res.json({ success: true, partyId: PARTY_ID });
        
      } catch (error) {
        console.error(`[Party ${PARTY_ID}] Error handling webhook:`, error);
        res.status(500).json({ error: error.message });
      }
    });

    // Manual trigger endpoints for testing
    this.app.post('/trigger/:event', async (req, res) => {
      try {
        const { event } = req.params;
        const { sessionId, ...payload } = req.body;
        
        if (!sessionId) {
          return res.status(400).json({ error: 'sessionId is required' });
        }
        
        await this.sendResponseToCoordinator(sessionId, event, payload);
        res.json({ success: true, event, sessionId });
        
      } catch (error) {
        console.error(`[Party ${PARTY_ID}] Error triggering event:`, error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get party status
    this.app.get('/status', (req, res) => {
      res.json({
        partyId: PARTY_ID,
        sessions: Array.from(this.sessions.keys()),
        shares: Array.from(this.shares.keys()),
        timestamp: new Date().toISOString()
      });
    });
  }

  async handleSessionInitialized(sessionId, payload) {
    console.log(`[Party ${PARTY_ID}] Session initialized:`, payload);
    this.sessions.set(sessionId, {
      status: 'initialized',
      operation: payload.operation,
      metadata: payload.metadata,
      threshold: payload.threshold,
      totalParties: payload.totalParties,
      createdAt: new Date()
    });
  }

  async handleDKGInitiated(sessionId, payload) {
    console.log(`[Party ${PARTY_ID}] DKG initiated for session ${sessionId}`);
    
    // Generate fresh cryptographic material (simplified for PoC)
    const share = this.generateRandomShare();
    const commitment = this.generateCommitment(share);
    const nonce = this.generateNonce();
    
    // Store the share
    this.shares.set(sessionId, {
      share: share,
      commitment: commitment,
      nonce: nonce,
      receivedAt: new Date()
    });

    // Update session status
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'share_committed';
    }

    // Send share commitment to coordinator (NOT the actual share)
    await this.sendResponseToCoordinator(sessionId, 'share_committed', {
      commitment: commitment,
      nonce: nonce
    });
    
    console.log(`[Party ${PARTY_ID}] Share committed for session ${sessionId}`);
  }

  async handleShareReceived(sessionId, payload) {
    console.log(`[Party ${PARTY_ID}] Share received for session ${sessionId}`);
    
    // Store the share
    this.shares.set(sessionId, {
      share: payload.share,
      commitment: payload.commitment,
      nonce: payload.nonce,
      receivedAt: new Date()
    });

    // Update session status
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'share_received';
      session.share = payload.share;
    }

    // Confirm share receipt
    await this.sendResponseToCoordinator(sessionId, 'share_confirmed', {
      share: payload.share,
      confirmed: true
    });
  }

  async handleSignatureRequested(sessionId, payload) {
    console.log(`[Party ${PARTY_ID}] Signature requested for session ${sessionId}:`, payload.message);
    
    const share = this.shares.get(sessionId);
    if (!share) {
      throw new Error('No share found for this session');
    }

    // Generate signature component (simplified for PoC)
    const messageHash = crypto.createHash('sha256').update(payload.message).digest('hex');
    const component = this.generateSignatureComponent(share.share, messageHash);

    // Send signature component
    await this.sendResponseToCoordinator(sessionId, 'signature_component', {
      component: component,
      messageHash: messageHash,
      message: payload.message
    });
  }

  async handleReconstructionRequested(sessionId, payload) {
    console.log(`[Party ${PARTY_ID}] Reconstruction requested for session ${sessionId}`);
    
    const share = this.shares.get(sessionId);
    if (!share) {
      throw new Error('No share found for this session');
    }

    // Send share for reconstruction
    await this.sendResponseToCoordinator(sessionId, 'share_provided', {
      share: share.share,
      commitment: share.commitment,
      nonce: share.nonce
    });
  }

  async handleSessionCompleted(sessionId, payload) {
    console.log(`[Party ${PARTY_ID}] Session completed:`, payload);
    
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'completed';
      session.result = payload;
    }
  }

  async handleSessionFailed(sessionId, payload) {
    console.log(`[Party ${PARTY_ID}] Session failed:`, payload);
    
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'failed';
      session.error = payload.error;
    }
  }

  async handleHeartbeat(sessionId, payload) {
    console.log(`[Party ${PARTY_ID}] Heartbeat received for session ${sessionId}`);
    
    // Respond to heartbeat
    await this.sendResponseToCoordinator(sessionId, 'heartbeat_response', {
      timestamp: new Date().toISOString(),
      status: 'alive'
    });
  }

  generateSignatureComponent(share, messageHash) {
    // Simplified signature component generation for PoC
    // In production, this would use proper threshold signature algorithms
    const combined = share + messageHash;
    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  generateRandomShare() {
    // Generate a random 32-byte share (simplified for PoC)
    return crypto.randomBytes(32).toString('hex');
  }

  generateCommitment(share) {
    // Generate a commitment to the share (simplified for PoC)
    return crypto.createHash('sha256').update(share).digest('hex');
  }

  generateNonce() {
    // Generate a random nonce
    return crypto.randomBytes(16).toString('hex');
  }

  async sendResponseToCoordinator(sessionId, event, payload) {
    try {
      const response = await axios.post(`${this.coordinatorUrl}/api/webhook/${sessionId}/${PARTY_ID}`, {
        event,
        payload,
        timestamp: new Date().toISOString()
      });
      
      console.log(`[Party ${PARTY_ID}] Response sent to coordinator: ${event}`);
      return response.data;
      
    } catch (error) {
      console.error(`[Party ${PARTY_ID}] Error sending response to coordinator:`, error.message);
      throw error;
    }
  }

  start() {
    this.app.listen(PORT, () => {
      console.log(`Party ${PARTY_ID} simulator running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`Status: http://localhost:${PORT}/status`);
      console.log(`Webhook endpoint: http://localhost:${PORT}/webhook`);
    });
  }
}

// Start the party simulator
const simulator = new PartySimulator();
simulator.start(); 