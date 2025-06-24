const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

class CoordinatorService {
  constructor() {
    // In-memory storage for session metadata (no cryptographic material)
    this.sessions = new Map();
    this.webhookLogs = new Map();
    this.pendingEvents = new Map();
    this.registeredParties = new Map(); // Store party registrations
  }

  /**
   * Register a party with the coordinator
   */
  async registerParty(partyId, webhookUrl, walletAddress) {
    console.log(`📝 Registering Party ${partyId} with wallet address: ${walletAddress}`);
    
    this.registeredParties.set(partyId, {
      partyId,
      webhookUrl,
      walletAddress,
      registeredAt: new Date(),
      lastSeen: new Date()
    });
    
    console.log(`✅ Party ${partyId} registered successfully`);
    return { success: true, message: 'Party registered successfully' };
  }

  /**
   * Get registered party information
   */
  getRegisteredParty(partyId) {
    return this.registeredParties.get(partyId);
  }

  /**
   * Get all registered parties
   */
  getAllRegisteredParties() {
    return Array.from(this.registeredParties.values());
  }

  /**
   * Initialize a new threshold session
   */
  async initializeSession(operation, parties, threshold, totalParties, metadata = {}) {
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const session = {
      sessionId,
      operation,
      parties: parties.map((party, index) => ({
        partyId: index + 1,
        partyName: party.name,
        webhookUrl: party.webhookUrl,
        status: 'pending',
        lastSeen: null
      })),
      threshold,
      totalParties,
      metadata,
      status: 'initialized',
      createdAt: new Date(),
      expiresAt,
      // No cryptographic material stored here
      communicationPubKeys: [],
      webhookLogs: []
    };

    this.sessions.set(sessionId, session);

    // Initialize session with all parties
    await this.broadcastToParties(sessionId, session.parties, 'session_initialized', {
      sessionId,
      operation,
      threshold: session.threshold,
      totalParties: session.totalParties,
      metadata
    });

    return session;
  }

  /**
   * Initiate distributed key generation
   */
  async initiateDistributedKeyGeneration(sessionId, blockchain = 'ethereum') {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status !== 'initialized') {
      throw new Error('Session is not in initialized state');
    }

    try {
      // Update session status
      session.status = 'dkg_initiated';
      session.metadata.blockchain = blockchain;
      session.updatedAt = new Date();

      // Broadcast DKG initiation to all parties
      await this.broadcastToParties(sessionId, session.parties, 'dkg_initiated', {
        sessionId,
        blockchain,
        threshold: session.threshold,
        totalParties: session.totalParties
      });

      return {
        sessionId,
        status: 'dkg_initiated',
        message: 'Distributed key generation initiated. Parties will generate their own shares.'
      };

    } catch (error) {
      session.status = 'failed';
      session.updatedAt = new Date();
      throw error;
    }
  }

  /**
   * Create threshold signature
   */
  async createThresholdSignature(sessionId, message) {
    console.log(`🔍 Creating threshold signature for session: ${sessionId}, message: ${message}`);
    
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error(`❌ Session not found: ${sessionId}`);
      throw new Error('Session not found');
    }

    console.log(`✅ Found session: ${sessionId}, status: ${session.status}, operation: ${session.operation}`);

    if (session.status !== 'dkg_completed') {
      console.error(`❌ Session is not ready for signing. Current status: ${session.status}`);
      throw new Error(`Session is not ready for signing. Current status: ${session.status}`);
    }

    console.log(`📡 Requesting signature components from parties...`);

    try {
      // Request signature components from all parties
      await this.broadcastToParties(sessionId, session.parties, 'signature_requested', {
        sessionId,
        message,
        timestamp: new Date().toISOString()
      });

      // Update session status
      session.status = 'signing_in_progress';
      session.updatedAt = new Date();

      console.log(`✅ Signature request sent to all parties for session: ${sessionId}`);

      return {
        sessionId,
        status: 'signing_in_progress',
        message: 'Signature request sent to all parties. Awaiting signature components.',
        messageHash: this.hashMessage(message)
      };

    } catch (error) {
      console.error(`❌ Error requesting signature for session ${sessionId}:`, error);
      session.status = 'failed';
      session.updatedAt = new Date();
      throw error;
    }
  }

  /**
   * Handle party response (share commitment, signature component, etc.)
   */
  async handlePartyResponse(sessionId, partyId, event, payload) {
    console.log(`🔍 Handling party response: ${event} from Party ${partyId} for Session ${sessionId}`);
    
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error(`❌ Session not found: ${sessionId}`);
      throw new Error('Session not found');
    }

    console.log(`✅ Found session: ${sessionId}, status: ${session.status}`);
    
    const party = session.parties.find(p => p.partyId === partyId);
    if (!party) {
      console.error(`❌ Party ${partyId} not found in session ${sessionId}`);
      throw new Error('Party not found in session');
    }

    console.log(`✅ Found party: ${partyId}, current status: ${party.status}`);

    // Log the webhook
    this.logWebhook(sessionId, partyId, 'inbound', event, payload, true);

    switch (event) {
      case 'share_commitment':
        party.status = 'share_committed';
        party.shareCommitment = payload.commitment;
        party.nonce = payload.nonce;
        console.log(`📝 Updated party ${partyId} status to 'share_committed'`);
        break;

      case 'signature_component':
        // Store signature component temporarily for combination
        if (!session.signatureComponents) {
          session.signatureComponents = [];
        }
        session.signatureComponents.push({
          partyId,
          component: payload.component,
          messageHash: payload.messageHash,
          timestamp: new Date()
        });
        console.log(`📝 Added signature component from party ${partyId}`);
        break;

      case 'dkg_completed':
        party.status = 'ready';
        party.lastSeen = new Date();
        console.log(`✅ Party ${partyId} completed DKG`);
        break;

      case 'heartbeat_response':
        party.status = 'connected';
        party.lastSeen = new Date();
        console.log(`💓 Updated party ${partyId} heartbeat`);
        break;

      default:
        console.warn(`⚠️ Unknown event: ${event}`);
        throw new Error(`Unknown event: ${event}`);
    }

    session.updatedAt = new Date();

    // Check if we can proceed with the operation
    if (this.canProceedWithOperation(session)) {
      console.log(`🚀 Session ${sessionId} can proceed with operation`);
      await this.processSession(session);
    }

    return { success: true, sessionStatus: session.status };
  }

  /**
   * Check if session can proceed with operation
   */
  canProceedWithOperation(session) {
    if (session.status === 'dkg_initiated') {
      // Check if all parties have committed their shares
      const allCommitted = session.parties.every(p => p.status === 'share_committed');
      if (allCommitted) {
        session.status = 'dkg_completed';
        return true;
      }
    } else if (session.status === 'signing_in_progress') {
      // Check if we have enough signature components
      const components = session.signatureComponents || [];
      if (components.length >= session.threshold) {
        session.status = 'signature_completed';
        return true;
      }
    }
    return false;
  }

  /**
   * Process session based on current state
   */
  async processSession(session) {
    if (session.status === 'dkg_completed') {
      console.log(`🎉 DKG completed for session ${session.sessionId}`);
      
      // Generate a wallet address for the threshold wallet
      const walletAddress = this.generateThresholdWalletAddress();
      session.metadata.walletAddress = walletAddress;
      
      console.log(`💰 Generated threshold wallet address: ${walletAddress}`);
      
      // Notify all parties that DKG is complete
      await this.broadcastToParties(session.sessionId, session.parties, 'dkg_completed', {
        sessionId: session.sessionId,
        message: 'Distributed key generation completed successfully',
        walletAddress: walletAddress
      });
    } else if (session.status === 'signature_completed') {
      console.log(`🎉 Threshold signature completed for session ${session.sessionId}`);
      
      // Combine signature components (in a real implementation, this would be done by parties)
      const components = session.signatureComponents;
      const combinedSignature = this.combineSignatureComponents(components);
      
      // Notify all parties that signature is complete
      await this.broadcastToParties(session.sessionId, session.parties, 'signature_completed', {
        sessionId: session.sessionId,
        signature: combinedSignature,
        participants: components.map(c => c.partyId)
      });
    }
  }

  /**
   * Broadcast message to all parties
   */
  async broadcastToParties(sessionId, parties, event, payload) {
    const results = [];
    
    for (const party of parties) {
      if (party.webhookUrl) {
        try {
          const result = await this.sendWebhook(sessionId, party.partyId, party.webhookUrl, event, payload);
          results.push({
            partyId: party.partyId,
            success: true,
            result
          });
        } catch (error) {
          results.push({
            partyId: party.partyId,
            success: false,
            error: error.message
          });
        }
      }
    }
    
    return results;
  }

  /**
   * Send webhook to a party
   */
  async sendWebhook(sessionId, partyId, webhookUrl, event, payload) {
    const webhookData = {
      sessionId,
      partyId,
      event,
      payload,
      timestamp: new Date().toISOString()
    };

    // Log outbound webhook
    this.logWebhook(sessionId, partyId, 'outbound', event, payload, true);

    // Handle browser parties differently - they poll for events instead of receiving webhooks
    if (webhookUrl && webhookUrl.startsWith('browser://')) {
      console.log(`🌐 Browser party ${partyId} - webhook logged for polling: ${event}`);
      return { success: true, message: 'Webhook logged for browser party polling' };
    }

    // For regular parties, send HTTP webhook
    if (webhookUrl) {
      const response = await axios.post(webhookUrl, webhookData, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    }

    throw new Error('No webhook URL provided');
  }

  /**
   * Log webhook communication
   */
  logWebhook(sessionId, partyId, direction, event, payload, success) {
    const log = {
      sessionId,
      partyId,
      direction,
      event,
      payload,
      success,
      timestamp: new Date()
    };

    if (!this.webhookLogs.has(sessionId)) {
      this.webhookLogs.set(sessionId, []);
    }
    this.webhookLogs.get(sessionId).push(log);
  }

  /**
   * Get session status
   */
  async getSessionStatus(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    return {
      sessionId: session.sessionId,
      status: session.status,
      operation: session.operation,
      parties: session.parties.map(p => ({
        partyId: p.partyId,
        partyName: p.partyName,
        status: p.status,
        lastSeen: p.lastSeen
      })),
      metadata: session.metadata,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt
    };
  }

  /**
   * List all sessions
   */
  async listSessions(status = null, limit = 50) {
    let sessions = Array.from(this.sessions.values());
    
    if (status) {
      sessions = sessions.filter(s => s.status === status);
    }

    sessions = sessions
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);

    return sessions.map(session => ({
      sessionId: session.sessionId,
      status: session.status,
      operation: session.operation,
      parties: session.parties.length,
      readyParties: session.parties.filter(p => p.status === 'ready').length,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt
    }));
  }

  /**
   * Get webhook logs for a session
   */
  async getWebhookLogs(sessionId, limit = 100) {
    const logs = this.webhookLogs.get(sessionId) || [];
    return logs
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get pending webhook events for browser parties
   */
  async getPendingWebhookEvents(sessionId, partyId) {
    const logs = this.webhookLogs.get(sessionId) || [];
    return logs
      .filter(log => 
        log.partyId === partyId && 
        log.direction === 'outbound' && 
        log.success
      )
      .map(log => ({
        event: log.event,
        payload: log.payload,
        timestamp: log.timestamp
      }))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);
  }

  /**
   * Add communication public key for a party
   */
  async addCommunicationPublicKey(sessionId, partyId, publicKey) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Remove existing key for this party
    session.communicationPubKeys = session.communicationPubKeys.filter(
      key => key.partyId !== partyId
    );

    // Add new key
    session.communicationPubKeys.push({ partyId, publicKey });

    return {
      success: true,
      message: `Communication public key added for party ${partyId}`
    };
  }

  /**
   * Hash a message using SHA-256
   */
  hashMessage(message) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(message).digest('hex');
  }

  /**
   * Combine signature components (simplified for demo)
   */
  combineSignatureComponents(components) {
    // In a real implementation, this would use proper threshold signature combination
    // For now, just concatenate the components
    const combined = components
      .sort((a, b) => a.partyId - b.partyId)
      .map(c => c.component)
      .join('');
    
    return this.hashMessage(combined);
  }

  /**
   * Generate a threshold wallet address (simplified for demo)
   */
  generateThresholdWalletAddress() {
    const crypto = require('crypto');
    // Generate a random private key
    const privateKey = crypto.randomBytes(32);
    // In a real implementation, this would derive the address from the threshold public key
    // For demo purposes, we'll create a deterministic address from the hash
    const addressBytes = crypto.createHash('sha256').update(privateKey).digest().slice(0, 20);
    return `0x${addressBytes.toString('hex')}`;
  }
}

module.exports = new CoordinatorService(); 