/**
 * WebRTC + MPC Integration Example
 *
 * This demonstrates how WebRTC could be used for peer-to-peer communication
 * while maintaining a lightweight coordinator for session orchestration.
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');

// WebRTC Signaling Server (replaces webhook routing for peer discovery)
class WebRTCSignalingServer {
  constructor() {
    this.rooms = new Map(); // sessionId -> Set of peer connections
    this.peers = new Map(); // peerId -> peer info
  }

  // Handle WebRTC signaling for session discovery
  handleSignaling(sessionId, peerId, signalType, payload) {
    const room = this.rooms.get(sessionId) || new Set();
    this.rooms.set(sessionId, room);

    switch (signalType) {
      case 'join':
        room.add(peerId);
        this.peers.set(peerId, { sessionId, ...payload });
        // Notify other peers in the room
        this.broadcastToRoom(sessionId, peerId, 'peer_joined', {
          peerId,
          ...payload,
        });
        break;

      case 'offer':
      case 'answer':
      case 'ice_candidate':
        // Forward WebRTC signaling to specific peer
        this.forwardToPeer(sessionId, peerId, signalType, payload);
        break;

      case 'leave':
        room.delete(peerId);
        this.peers.delete(peerId);
        this.broadcastToRoom(sessionId, peerId, 'peer_left', { peerId });
        break;
    }
  }

  broadcastToRoom(sessionId, excludePeerId, event, payload) {
    const room = this.rooms.get(sessionId);
    if (!room) return;

    room.forEach((peerId) => {
      if (peerId !== excludePeerId) {
        // In real implementation, send via WebSocket
        console.log(
          `📡 Signaling: ${event} to ${peerId} in session ${sessionId}`
        );
      }
    });
  }

  forwardToPeer(sessionId, peerId, signalType, payload) {
    // In real implementation, send via WebSocket
    console.log(
      `📡 Forwarding ${signalType} to ${peerId} in session ${sessionId}`
    );
  }
}

// Lightweight Coordinator (focused on orchestration, not message routing)
class LightweightCoordinator {
  constructor() {
    this.sessions = new Map();
    this.signalingServer = new WebRTCSignalingServer();
  }

  async initializeSession(
    operation,
    parties,
    threshold,
    totalParties,
    metadata = {}
  ) {
    const sessionId = uuidv4();

    const session = {
      sessionId,
      operation,
      parties: parties.map((party, index) => ({
        partyId: index + 1,
        partyName: party.name,
        webhookUrl: party.webhookUrl, // Fallback for non-WebRTC parties
        status: 'pending',
        webrtcEnabled: party.webrtcEnabled || false,
      })),
      threshold,
      totalParties,
      metadata,
      status: 'initialized',
      createdAt: new Date(),
      // WebRTC-specific fields
      webrtcRoom: `mpc-session-${sessionId}`,
      peerConnections: new Map(),
    };

    this.sessions.set(sessionId, session);

    // Notify parties about session creation
    await this.notifySessionInitialized(sessionId, session);

    return session;
  }

  async notifySessionInitialized(sessionId, session) {
    const notification = {
      sessionId,
      operation: session.operation,
      threshold: session.threshold,
      totalParties: session.totalParties,
      metadata: session.metadata,
      webrtcRoom: session.webrtcRoom,
      peers: session.parties.map((p) => ({
        partyId: p.partyId,
        partyName: p.partyName,
        webrtcEnabled: p.webrtcEnabled,
      })),
    };

    // For WebRTC-enabled parties, use signaling server
    const webrtcParties = session.parties.filter((p) => p.webrtcEnabled);
    if (webrtcParties.length > 0) {
      webrtcParties.forEach((party) => {
        this.signalingServer.handleSignaling(
          session.webrtcRoom,
          `party-${party.partyId}`,
          'session_initialized',
          notification
        );
      });
    }

    // For non-WebRTC parties, use webhooks (fallback)
    const webhookParties = session.parties.filter((p) => !p.webrtcEnabled);
    for (const party of webhookParties) {
      await this.sendWebhook(
        party.webhookUrl,
        'session_initialized',
        notification
      );
    }
  }

  async initiateDkg(sessionId, blockchain = 'ethereum') {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    session.status = 'dkg_initiated';
    session.metadata.blockchain = blockchain;

    const notification = {
      sessionId,
      blockchain,
      threshold: session.threshold,
      totalParties: session.totalParties,
    };

    // Notify parties via appropriate channels
    await this.broadcastToSession(sessionId, 'dkg_initiated', notification);

    return { sessionId, status: 'dkg_initiated' };
  }

  async broadcastToSession(sessionId, event, payload) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // WebRTC parties
    const webrtcParties = session.parties.filter((p) => p.webrtcEnabled);
    webrtcParties.forEach((party) => {
      this.signalingServer.handleSignaling(
        session.webrtcRoom,
        `party-${party.partyId}`,
        event,
        payload
      );
    });

    // Webhook parties (fallback)
    const webhookParties = session.parties.filter((p) => !p.webrtcEnabled);
    for (const party of webhookParties) {
      await this.sendWebhook(party.webhookUrl, event, payload);
    }
  }

  async sendWebhook(url, event, payload) {
    try {
      // Implementation would use axios or fetch
      console.log(`📡 Webhook to ${url}: ${event}`);
    } catch (error) {
      console.error(`❌ Webhook failed to ${url}:`, error);
    }
  }

  // Handle party responses (still needed for state management)
  async handlePartyResponse(sessionId, partyId, event, payload) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const party = session.parties.find((p) => p.partyId === partyId);
    if (!party) throw new Error('Party not found');

    // Update party status
    party.status = event;
    party.lastSeen = new Date();

    // Check if session can proceed
    if (this.canProceedWithOperation(session)) {
      await this.processSession(session);
    }
  }

  canProceedWithOperation(session) {
    const readyParties = session.parties.filter(
      (p) => p.status === 'share_committed' || p.status === 'ready'
    );
    return readyParties.length >= session.threshold;
  }

  async processSession(session) {
    if (session.status === 'dkg_initiated') {
      session.status = 'dkg_completed';
      await this.broadcastToSession(session.sessionId, 'dkg_completed', {
        sessionId: session.sessionId,
        walletAddress: this.generateThresholdWalletAddress(),
      });
    }
  }

  generateThresholdWalletAddress() {
    // Simplified for example
    return '0x' + Math.random().toString(16).substr(2, 40);
  }
}

// WebRTC-enabled Party Implementation
class WebRTCParty {
  constructor(partyId, sessionId, coordinator) {
    this.partyId = partyId;
    this.sessionId = sessionId;
    this.coordinator = coordinator;
    this.peerConnections = new Map();
    this.dataChannels = new Map();

    // WebRTC configuration
    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };
  }

  async joinSession() {
    // Connect to signaling server
    await this.connectToSignalingServer();

    // Establish peer connections with other parties
    await this.establishPeerConnections();
  }

  async connectToSignalingServer() {
    // In real implementation, this would be a WebSocket connection
    console.log(
      `[Party ${this.partyId}] Connecting to signaling server for session ${this.sessionId}`
    );
  }

  async establishPeerConnections() {
    // Create peer connections with other parties in the session
    // This is where the actual WebRTC connections are established
    console.log(`[Party ${this.partyId}] Establishing peer connections`);
  }

  async sendToPeers(event, payload) {
    // Send message to all connected peers via WebRTC data channels
    this.dataChannels.forEach((channel, peerId) => {
      if (channel.readyState === 'open') {
        channel.send(
          JSON.stringify({
            from: this.partyId,
            event,
            payload,
            timestamp: Date.now(),
          })
        );
      }
    });
  }

  async handlePeerMessage(message) {
    const { from, event, payload } = JSON.parse(message);

    console.log(
      `[Party ${this.partyId}] Received from Party ${from}: ${event}`
    );

    // Handle different MPC protocol messages
    switch (event) {
      case 'share_commitment':
        await this.handleShareCommitment(from, payload);
        break;
      case 'signature_component':
        await this.handleSignatureComponent(from, payload);
        break;
      case 'dkg_completed':
        await this.handleDKGCompleted(payload);
        break;
    }
  }

  async handleShareCommitment(from, payload) {
    // Process share commitment from another party
    console.log(
      `[Party ${this.partyId}] Processing share commitment from Party ${from}`
    );

    // Still notify coordinator for state tracking
    await this.coordinator.handlePartyResponse(
      this.sessionId,
      this.partyId,
      'share_committed',
      { from, commitment: payload.commitment }
    );
  }

  async handleSignatureComponent(from, payload) {
    // Process signature component from another party
    console.log(
      `[Party ${this.partyId}] Processing signature component from Party ${from}`
    );
  }

  async handleDKGCompleted(payload) {
    console.log(
      `[Party ${this.partyId}] DKG completed, wallet address: ${payload.walletAddress}`
    );
  }
}

// Usage Example
async function demonstrateWebRTCMPC() {
  console.log('🚀 WebRTC + MPC Integration Demo\n');

  const coordinator = new LightweightCoordinator();

  // Create session with mixed WebRTC and webhook parties
  const session = await coordinator.initializeSession(
    'threshold_signature',
    [
      {
        name: 'Party 1',
        webhookUrl: 'http://localhost:3001/webhook',
        webrtcEnabled: true,
      },
      {
        name: 'Party 2',
        webhookUrl: 'http://localhost:3002/webhook',
        webrtcEnabled: true,
      },
      {
        name: 'Party 3',
        webhookUrl: 'http://localhost:3003/webhook',
        webrtcEnabled: false,
      },
    ],
    2, // threshold
    3 // total parties
  );

  console.log(`✅ Session created: ${session.sessionId}`);
  console.log(`📡 WebRTC room: ${session.webrtcRoom}`);

  // Simulate WebRTC parties joining
  const party1 = new WebRTCParty(1, session.sessionId, coordinator);
  const party2 = new WebRTCParty(2, session.sessionId, coordinator);

  await party1.joinSession();
  await party2.joinSession();

  // Initiate DKG
  await coordinator.initiateDkg(session.sessionId, 'ethereum');

  console.log('\n📊 Architecture Benefits:');
  console.log('✅ Direct peer-to-peer communication for WebRTC parties');
  console.log('✅ Reduced latency for MPC protocol messages');
  console.log('✅ Fallback to webhooks for non-WebRTC parties');
  console.log('✅ Lightweight coordinator focused on orchestration');
  console.log('✅ Maintains session state and fault tolerance');
}

// Run the demo
if (require.main === module) {
  demonstrateWebRTCMPC().catch(console.error);
}

module.exports = {
  WebRTCSignalingServer,
  LightweightCoordinator,
  WebRTCParty,
};
