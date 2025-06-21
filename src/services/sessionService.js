const { v4: uuidv4 } = require('uuid');
const TLSMCP = require('../crypto/tls-mcp');
const Session = require('../models/Session');
const webhookService = require('./webhookService');

class SessionService {
  constructor() {
    this.tlsMCP = new TLSMCP(3, 3); // (3,3) threshold scheme
  }

  /**
   * Create a new TLS-MCP session
   */
  async createSession(operation, parties, metadata = {}) {
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const session = new Session({
      sessionId,
      operation,
      parties: parties.map((party, index) => ({
        partyId: index + 1,
        partyName: party.name,
        webhookUrl: party.webhookUrl,
        status: 'pending'
      })),
      threshold: 3,
      totalParties: 3,
      metadata,
      expiresAt
    });

    await session.save();

    // Initialize session with all parties
    await webhookService.initializeSession(sessionId, session.parties, operation, metadata);

    return session;
  }

  /**
   * Generate a new private key and distribute shares
   */
  async generateKey(sessionId, walletAddress, blockchain = 'ethereum') {
    const session = await Session.findOne({ sessionId });
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status !== 'pending') {
      throw new Error('Session is not in pending state');
    }

    try {
      // Generate a new private key
      const privateKey = this.tlsMCP.generatePrivateKey();
      
      // Split the private key into shares
      const secretSharing = this.tlsMCP.splitSecret(privateKey);
      
      // Create commitments for each share
      const sharesWithCommitments = secretSharing.shares.map(share => {
        const nonce = require('crypto').randomBytes(16).toString('hex');
        const commitment = this.tlsMCP.createCommitment(share.share, nonce);
        
        return {
          ...share,
          commitment,
          nonce
        };
      });

      // Update session with shares and commitments
      session.secret = privateKey;
      session.shares = sharesWithCommitments.map(share => ({
        partyId: share.partyId,
        share: share.share
      }));
      session.commitments = sharesWithCommitments.map(share => ({
        partyId: share.partyId,
        commitment: share.commitment,
        nonce: share.nonce
      }));
      session.metadata.walletAddress = walletAddress;
      session.metadata.blockchain = blockchain;
      session.status = 'active';

      await session.save();

      // Distribute shares to parties
      await webhookService.distributeShares(sessionId, session.parties, sharesWithCommitments);

      return {
        sessionId,
        walletAddress,
        blockchain,
        status: 'active',
        message: 'Key generation initiated. Shares distributed to parties.'
      };

    } catch (error) {
      session.status = 'failed';
      await session.save();
      
      await webhookService.notifySessionFailed(sessionId, session.parties, error);
      throw error;
    }
  }

  /**
   * Reconstruct the private key from shares
   */
  async reconstructKey(sessionId) {
    const session = await Session.findOne({ sessionId });
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status !== 'active') {
      throw new Error('Session is not in active state');
    }

    try {
      // Request shares from all parties
      const shareRequests = session.parties.map(party => ({
        partyId: party.partyId,
        webhookUrl: party.webhookUrl
      }));

      await webhookService.broadcastToParties(
        sessionId,
        shareRequests,
        'reconstruction_requested',
        { timestamp: new Date().toISOString() }
      );

      // For PoC, we'll use the stored shares
      // In production, parties would send their shares via webhook
      const shares = session.shares.map(share => ({
        partyId: share.partyId,
        share: share.share,
        x: share.partyId
      }));

      if (shares.length < session.threshold) {
        throw new Error(`Insufficient shares. Need ${session.threshold}, got ${shares.length}`);
      }

      // Reconstruct the secret
      const reconstructedSecret = this.tlsMCP.reconstructSecret(shares);

      // Verify reconstruction
      if (reconstructedSecret !== session.secret) {
        throw new Error('Secret reconstruction failed - verification mismatch');
      }

      session.status = 'completed';
      await session.save();

      await webhookService.notifySessionComplete(sessionId, session.parties, {
        success: true,
        walletAddress: session.metadata.walletAddress,
        message: 'Key reconstruction completed successfully'
      });

      return {
        sessionId,
        walletAddress: session.metadata.walletAddress,
        privateKey: reconstructedSecret,
        status: 'completed'
      };

    } catch (error) {
      session.status = 'failed';
      await session.save();
      
      await webhookService.notifySessionFailed(sessionId, session.parties, error);
      throw error;
    }
  }

  /**
   * Create a threshold signature
   */
  async createSignature(sessionId, message) {
    console.log(`🔍 Creating signature for session: ${sessionId}, message: ${message}`);
    
    const session = await Session.findOne({ sessionId });
    if (!session) {
      console.error(`❌ Session not found: ${sessionId}`);
      throw new Error('Session not found');
    }

    console.log(`✅ Found session: ${sessionId}, status: ${session.status}, operation: ${session.operation}`);

    if (session.status !== 'active') {
      console.error(`❌ Session is not in active state. Current status: ${session.status}`);
      throw new Error(`Session is not in active state. Current status: ${session.status}`);
    }

    if (!session.shares || session.shares.length === 0) {
      console.error(`❌ No shares found for session: ${sessionId}`);
      throw new Error('No shares found for session. Key generation must be completed first.');
    }

    console.log(`📦 Found ${session.shares.length} shares for session: ${sessionId}`);

    try {
      // Request signature components from all parties
      console.log(`📡 Requesting signature components from parties...`);
      await webhookService.requestSignature(sessionId, session.parties, message);

      // For PoC, we'll generate signature components using stored shares
      // In production, parties would compute and send their components
      console.log(`🔐 Generating signature components using stored shares...`);
      const shares = session.shares.map(share => ({
        partyId: share.partyId,
        share: share.share,
        x: share.partyId
      }));

      const signatureComponents = this.tlsMCP.generateThresholdSignatureComponents(message, shares);
      console.log(`✅ Generated ${signatureComponents.length} signature components`);

      // Combine signature components
      console.log(`🔗 Combining signature components...`);
      const finalSignature = this.tlsMCP.combineThresholdSignature(signatureComponents, message);
      console.log(`✅ Combined signature components successfully`);

      // Use atomic update to avoid version conflicts
      const updateData = {
        signatureComponents: signatureComponents.map(comp => ({
          partyId: comp.partyId,
          component: comp.component,
          messageHash: comp.messageHash,
          timestamp: new Date()
        })),
        finalSignature: {
          signature: finalSignature.signature,
          messageHash: finalSignature.messageHash,
          participants: finalSignature.participants,
          timestamp: new Date()
        },
        status: 'completed',
        updatedAt: new Date()
      };

      console.log(`💾 Updating session ${sessionId} with atomic update...`);
      const updateResult = await Session.findOneAndUpdate(
        { sessionId },
        updateData,
        { new: true, runValidators: true }
      );

      if (!updateResult) {
        throw new Error('Failed to update session');
      }

      console.log(`✅ Session ${sessionId} updated successfully with completed status`);

      await webhookService.notifySessionComplete(sessionId, session.parties, {
        success: true,
        signature: finalSignature.signature,
        messageHash: finalSignature.messageHash,
        message,
        participants: finalSignature.participants
      });

      console.log(`✅ Signature creation completed for session: ${sessionId}`);

      return {
        sessionId,
        signature: finalSignature.signature,
        messageHash: finalSignature.messageHash,
        message,
        participants: finalSignature.participants,
        status: 'completed'
      };

    } catch (error) {
      console.error(`❌ Error creating signature for session ${sessionId}:`, error);
      
      // Use atomic update to set failed status
      try {
        await Session.findOneAndUpdate(
          { sessionId },
          { status: 'failed', updatedAt: new Date() }
        );
      } catch (updateError) {
        console.error(`❌ Failed to update session status to failed:`, updateError);
      }
      
      await webhookService.notifySessionFailed(sessionId, session.parties, error);
      throw error;
    }
  }

  /**
   * Handle party response (share confirmation, signature component, etc.)
   */
  async handlePartyResponse(sessionId, partyId, event, payload) {
    console.log(`🔍 Looking up session: ${sessionId}`);
    const session = await Session.findOne({ sessionId });
    if (!session) {
      console.error(`❌ Session not found: ${sessionId}`);
      throw new Error('Session not found');
    }

    console.log(`✅ Found session: ${sessionId}, status: ${session.status}`);
    
    const party = session.getPartyById(partyId);
    if (!party) {
      console.error(`❌ Party ${partyId} not found in session ${sessionId}`);
      throw new Error('Party not found in session');
    }

    console.log(`✅ Found party: ${partyId}, current status: ${party.status}`);

    switch (event) {
      case 'share_confirmed':
        party.status = 'ready';
        party.share = payload.share;
        console.log(`📝 Updated party ${partyId} status to 'ready'`);
        break;

      case 'signature_component':
        session.signatureComponents.push({
          partyId,
          component: payload.component,
          messageHash: payload.messageHash,
          timestamp: new Date()
        });
        console.log(`📝 Added signature component from party ${partyId}`);
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

    await session.save();
    console.log(`💾 Session ${sessionId} saved successfully`);

    // Check if we can proceed with the operation
    if (session.canProceed()) {
      console.log(`🚀 Session ${sessionId} can proceed with operation`);
      await this.processSession(session);
    }

    return { success: true, sessionStatus: session.status };
  }

  /**
   * Process session based on current state
   */
  async processSession(session) {
    // This method would handle the logic to proceed with operations
    // when enough parties are ready
    console.log(`Processing session ${session.sessionId} with ${session.parties.filter(p => p.status === 'ready').length} ready parties`);
  }

  /**
   * Get session status
   */
  async getSessionStatus(sessionId) {
    const session = await Session.findOne({ sessionId });
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
    const query = {};
    if (status) {
      query.status = status;
    }

    const sessions = await Session.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);

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
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions() {
    const result = await Session.cleanupExpiredSessions();
    return result;
  }
}

module.exports = new SessionService(); 