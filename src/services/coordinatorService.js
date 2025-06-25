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
    console.log(
      `📝 Registering Party ${partyId} with wallet address: ${walletAddress}`
    );

    this.registeredParties.set(partyId, {
      partyId,
      webhookUrl,
      walletAddress,
      registeredAt: new Date(),
      lastSeen: new Date(),
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
  async initializeSession(
    operation,
    parties,
    threshold,
    totalParties,
    metadata = {}
  ) {
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
        lastSeen: null,
      })),
      threshold,
      totalParties,
      metadata,
      status: 'initialized',
      createdAt: new Date(),
      expiresAt,
      // No cryptographic material stored here
      communicationPubKeys: [],
      webhookLogs: [],
    };

    this.sessions.set(sessionId, session);

    // Initialize session with all parties
    await this.broadcastToParties(
      sessionId,
      session.parties,
      'session_initialized',
      {
        sessionId,
        operation,
        threshold: session.threshold,
        totalParties: session.totalParties,
        metadata,
      }
    );

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
      await this.broadcastToParties(
        sessionId,
        session.parties,
        'dkg_initiated',
        {
          sessionId,
          blockchain,
          threshold: session.threshold,
          totalParties: session.totalParties,
        }
      );

      return {
        sessionId,
        status: 'dkg_initiated',
        message:
          'Distributed key generation initiated. Parties will generate their own shares.',
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
    console.log(
      `🔍 Creating threshold signature for session: ${sessionId}, message: ${message}`
    );

    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error(`❌ Session not found: ${sessionId}`);
      throw new Error('Session not found');
    }

    console.log(
      `✅ Found session: ${sessionId}, status: ${session.status}, operation: ${session.operation}`
    );

    if (session.status !== 'dkg_completed') {
      console.error(
        `❌ Session is not ready for signing. Current status: ${session.status}`
      );
      throw new Error(
        `Session is not ready for signing. Current status: ${session.status}`
      );
    }

    console.log(`📡 Requesting signature components from parties...`);

    try {
      // Request signature components from all parties
      await this.broadcastToParties(
        sessionId,
        session.parties,
        'signature_requested',
        {
          sessionId,
          message,
          timestamp: new Date().toISOString(),
        }
      );

      // Update session status
      session.status = 'signing_in_progress';
      session.updatedAt = new Date();

      console.log(
        `✅ Signature request sent to all parties for session: ${sessionId}`
      );

      return {
        sessionId,
        status: 'signing_in_progress',
        message:
          'Signature request sent to all parties. Awaiting signature components.',
        messageHash: this.hashMessage(message),
      };
    } catch (error) {
      console.error(
        `❌ Error requesting signature for session ${sessionId}:`,
        error
      );
      session.status = 'failed';
      session.updatedAt = new Date();
      throw error;
    }
  }

  /**
   * Handle party response to coordinator events
   */
  async handlePartyResponse(sessionId, partyId, event, payload) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Find the party
    const party = session.parties.find((p) => p.partyId === partyId);
    if (!party) {
      throw new Error(`Party ${partyId} not found in session ${sessionId}`);
    }

    // Update party status based on the event
    party.lastSeen = new Date();

    console.log(`📡 Party ${partyId} responded with event: ${event}`);

    // Handle different response events
    switch (event) {
      case 'share_committed':
        // Update party status to share_committed
        party.status = 'share_committed';

        // Store share commitment (not the actual share)
        if (!session.shares) {
          session.shares = new Map();
        }
        session.shares.set(partyId, {
          partyId: partyId,
          commitment: payload.commitment,
          nonce: payload.nonce,
          timestamp: new Date(),
        });
        console.log(`✅ Share commitment received from Party ${partyId}`);
        break;

      case 'share_provided':
        // Update party status to active for reconstruction
        party.status = 'active';

        // Store the actual share for reconstruction
        if (!session.shares) {
          session.shares = new Map();
        }
        session.shares.set(partyId, {
          partyId: partyId,
          share: payload.share,
          commitment: payload.commitment,
          nonce: payload.nonce,
          timestamp: new Date(),
        });
        console.log(`✅ Share provided by Party ${partyId} for reconstruction`);
        break;

      case 'signature_component':
        // Update party status to active
        party.status = 'active';

        // Store signature component
        if (!session.signatureComponents) {
          session.signatureComponents = [];
        }
        session.signatureComponents.push({
          partyId: partyId,
          component: payload.component,
          messageHash: payload.messageHash,
          message: payload.message,
          timestamp: new Date(),
        });
        console.log(`✅ Signature component received from Party ${partyId}`);
        break;

      case 'share_confirmed':
        // Update party status to active
        party.status = 'active';
        console.log(`✅ Share confirmation received from Party ${partyId}`);
        break;

      case 'heartbeat_response':
        // Update party status to connected
        party.status = 'connected';
        console.log(`💓 Heartbeat response received from Party ${partyId}`);
        break;

      default:
        // Update party status to active for unknown events
        party.status = 'active';
        console.log(`📝 Unknown event from Party ${partyId}: ${event}`);
    }

    // Check if we can proceed with the operation
    if (this.canProceedWithOperation(session)) {
      await this.processSession(session);
    }

    return {
      success: true,
      message: `Event ${event} processed for Party ${partyId}`,
      sessionStatus: session.status,
    };
  }

  /**
   * Check if session can proceed with operation
   */
  canProceedWithOperation(session) {
    if (session.status === 'dkg_initiated') {
      // Check if all parties have committed their shares
      const allCommitted = session.parties.every(
        (p) => p.status === 'share_committed'
      );
      console.log(`🔍 DKG Progress Check for session ${session.sessionId}:`);
      console.log(`   - Session status: ${session.status}`);
      console.log(`   - Total parties: ${session.parties.length}`);
      console.log(
        `   - Parties committed: ${session.parties.filter((p) => p.status === 'share_committed').length}`
      );
      session.parties.forEach((p) => {
        console.log(`   - Party ${p.partyId}: ${p.status}`);
      });

      if (allCommitted) {
        console.log(
          `✅ All parties have committed shares. Marking DKG as completed.`
        );
        session.status = 'dkg_completed';
        return true;
      } else {
        console.log(`⏳ Waiting for more parties to commit shares...`);
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

      // Generate a deterministic wallet address from the shares
      const walletAddress = this.generateDeterministicWalletAddress(session);
      session.metadata.walletAddress = walletAddress;

      console.log(
        `💰 Generated deterministic threshold wallet address: ${walletAddress}`
      );

      // Notify all parties that DKG is complete
      await this.broadcastToParties(
        session.sessionId,
        session.parties,
        'dkg_completed',
        {
          sessionId: session.sessionId,
          message: 'Distributed key generation completed successfully',
          walletAddress: walletAddress,
        }
      );
    } else if (session.status === 'signature_completed') {
      console.log(
        `🎉 Threshold signature completed for session ${session.sessionId}`
      );

      // Combine signature components (in a real implementation, this would be done by parties)
      const components = session.signatureComponents;
      const combinedSignature = this.combineSignatureComponents(components);

      // Notify all parties that signature is complete
      await this.broadcastToParties(
        session.sessionId,
        session.parties,
        'signature_completed',
        {
          sessionId: session.sessionId,
          signature: combinedSignature,
          participants: components.map((c) => c.partyId),
        }
      );
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
          const result = await this.sendWebhook(
            sessionId,
            party.partyId,
            party.webhookUrl,
            event,
            payload
          );
          results.push({
            partyId: party.partyId,
            success: true,
            result,
          });
        } catch (error) {
          results.push({
            partyId: party.partyId,
            success: false,
            error: error.message,
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
      timestamp: new Date().toISOString(),
    };

    // Log outbound webhook
    this.logWebhook(sessionId, partyId, 'outbound', event, payload, true);

    // Handle browser parties differently - they poll for events instead of receiving webhooks
    if (webhookUrl && webhookUrl.startsWith('browser://')) {
      console.log(
        `🌐 Browser party ${partyId} - webhook logged for polling: ${event}`
      );
      return {
        success: true,
        message: 'Webhook logged for browser party polling',
      };
    }

    // For regular parties, send HTTP webhook
    if (webhookUrl) {
      const response = await axios.post(webhookUrl, webhookData, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
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
      timestamp: new Date(),
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
      parties: session.parties.map((p) => ({
        partyId: p.partyId,
        partyName: p.partyName,
        status: p.status,
        lastSeen: p.lastSeen,
      })),
      metadata: session.metadata,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    };
  }

  /**
   * List all sessions
   */
  async listSessions(status = null, limit = 50) {
    let sessions = Array.from(this.sessions.values());

    if (status) {
      sessions = sessions.filter((s) => s.status === status);
    }

    sessions = sessions
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);

    return sessions.map((session) => ({
      sessionId: session.sessionId,
      status: session.status,
      operation: session.operation,
      parties: session.parties.length,
      readyParties: session.parties.filter((p) => p.status === 'ready').length,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    }));
  }

  /**
   * Get webhook logs for a session
   */
  async getWebhookLogs(sessionId, limit = 100) {
    const logs = this.webhookLogs.get(sessionId) || [];
    return logs.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  /**
   * Get pending webhook events for browser parties
   */
  async getPendingWebhookEvents(sessionId, partyId) {
    const logs = this.webhookLogs.get(sessionId) || [];
    return logs
      .filter(
        (log) =>
          log.partyId === partyId && log.direction === 'outbound' && log.success
      )
      .map((log) => ({
        event: log.event,
        payload: log.payload,
        timestamp: log.timestamp,
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
      (key) => key.partyId !== partyId
    );

    // Add new key
    session.communicationPubKeys.push({ partyId, publicKey });

    return {
      success: true,
      message: `Communication public key added for party ${partyId}`,
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
      .map((c) => c.component)
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
    const addressBytes = crypto
      .createHash('sha256')
      .update(privateKey)
      .digest()
      .slice(0, 20);
    return `0x${addressBytes.toString('hex')}`;
  }

  /**
   * Generate a deterministic threshold wallet address from session shares
   * @param {Object} session - The session object containing shares
   * @returns {string} The wallet address
   */
  generateDeterministicWalletAddress(session) {
    if (!session.shares || session.shares.size === 0) {
      throw new Error('No shares available for wallet generation');
    }

    // Convert shares Map to array
    const sharesArray = Array.from(session.shares.values());

    // During DKG, parties only send commitments, not actual shares
    // We'll use the commitments to generate a deterministic wallet address
    const sortedShares = sharesArray.sort((a, b) => a.partyId - b.partyId);

    // Use commitments if shares are not available (during DKG)
    const combinedData = sortedShares
      .map((share) => share.commitment || share.share)
      .join('');

    const crypto = require('crypto');
    const privateKeyBytes = crypto
      .createHash('sha256')
      .update(combinedData)
      .digest();
    const addressBytes = crypto
      .createHash('sha256')
      .update(privateKeyBytes)
      .digest()
      .slice(0, 20);
    const walletAddress = `0x${addressBytes.toString('hex')}`;

    console.log(
      `🔑 Generated deterministic wallet address from ${sharesArray.length} commitments: ${walletAddress}`
    );

    return walletAddress;
  }

  /**
   * Reconstruct key from shares by requesting shares from all parties
   * @param {string} sessionId - The session ID
   * @returns {Object} The reconstruction result with wallet address
   */
  async reconstructKeyFromShares(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    console.log(`🔓 Starting key reconstruction for session ${sessionId}`);
    console.log(`📊 Requesting shares from ${session.parties.length} parties`);

    // Request shares from all parties
    await this.broadcastToParties(
      sessionId,
      session.parties,
      'reconstruction_requested',
      {
        sessionId: sessionId,
        message: 'Please provide your share for key reconstruction',
      }
    );

    // Wait for shares to be collected (in a real implementation, you'd wait for responses)
    // For demo purposes, we'll use existing shares if available
    if (session.shares && session.shares.size > 0) {
      console.log(
        `📦 Found ${session.shares.size} existing shares for reconstruction`
      );

      const walletAddress = this.generateDeterministicWalletAddress(session);

      return {
        sessionId: sessionId,
        walletAddress: walletAddress,
        sharesCount: session.shares.size,
        status: 'reconstructed',
        message: 'Key successfully reconstructed from existing shares',
      };
    } else {
      // In a real implementation, you would wait for party responses
      // For now, we'll simulate the reconstruction process
      console.log(`⏳ Waiting for party responses...`);

      // Simulate reconstruction with a delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Generate a new wallet address for demo purposes
      const walletAddress = this.generateThresholdWalletAddress();

      return {
        sessionId: sessionId,
        walletAddress: walletAddress,
        sharesCount: session.parties.length,
        status: 'reconstructed',
        message: 'Key reconstruction completed (simulated)',
      };
    }
  }
}

module.exports = new CoordinatorService();
