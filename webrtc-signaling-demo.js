/**
 * WebRTC Signaling Server Demo
 * Demonstrates the signaling server functionality for the distributed coordinator
 */

const {
  SignalingServerService,
} = require('./frontend/src/app/services/signaling-server.service');

class WebRTCSignalingDemo {
  constructor() {
    this.signalingServer = new SignalingServerService();
    this.demoSessions = new Map();
  }

  async runDemo() {
    console.log('🌐 WebRTC Signaling Server Demo\n');

    // Step 1: Start the signaling server
    console.log('📡 Step 1: Starting Signaling Server');
    await this.startSignalingServer();
    this.displayServerStatus();

    // Step 2: Simulate multiple parties joining sessions
    console.log('\n👥 Step 2: Simulating Party Connections');
    await this.simulatePartyConnections();

    // Step 3: Simulate message broadcasting
    console.log('\n📢 Step 3: Simulating Message Broadcasting');
    await this.simulateMessageBroadcasting();

    // Step 4: Simulate party disconnections
    console.log('\n🚪 Step 4: Simulating Party Disconnections');
    await this.simulatePartyDisconnections();

    // Step 5: Stop the signaling server
    console.log('\n🛑 Step 5: Stopping Signaling Server');
    await this.stopSignalingServer();

    console.log('\n✅ Demo completed successfully!');
  }

  async startSignalingServer() {
    try {
      await this.signalingServer.startServer(8080);
      console.log('✅ Signaling server started on port 8080');
    } catch (error) {
      console.error('❌ Failed to start signaling server:', error.message);
    }
  }

  async stopSignalingServer() {
    try {
      await this.signalingServer.stopServer();
      console.log('✅ Signaling server stopped');
    } catch (error) {
      console.error('❌ Failed to stop signaling server:', error.message);
    }
  }

  displayServerStatus() {
    const status = this.signalingServer.getServerStatus();
    console.log(`📊 Server Status:`);
    console.log(`   Running: ${status.isRunning ? '🟢 Yes' : '🔴 No'}`);
    console.log(`   Port: ${status.port}`);
    console.log(`   URL: ${status.url}`);
    console.log(`   Connected Clients: ${status.connectedClients}`);
    console.log(`   Active Sessions: ${status.sessions.size}`);
  }

  async simulatePartyConnections() {
    const sessions = [
      { id: 'session-1', parties: [1, 2, 3] },
      { id: 'session-2', parties: [4, 5] },
      { id: 'session-3', parties: [6, 7, 8, 9] },
    ];

    for (const session of sessions) {
      console.log(`\n   📋 Session: ${session.id}`);

      for (const partyId of session.parties) {
        // Simulate party joining
        this.signalingServer.simulateClientJoin(session.id, partyId);
        console.log(`      Party ${partyId} joined session ${session.id}`);

        // Add delay to simulate real connection time
        await this.delay(200);
      }

      this.demoSessions.set(session.id, session.parties);
    }

    this.displayServerStatus();
  }

  async simulateMessageBroadcasting() {
    const messageTypes = [
      'offer',
      'answer',
      'ice_candidate',
      'propose',
      'vote',
      'commit',
    ];

    for (const [sessionId, parties] of this.demoSessions) {
      console.log(`\n   📡 Broadcasting in session: ${sessionId}`);

      for (const messageType of messageTypes) {
        const fromParty = parties[Math.floor(Math.random() * parties.length)];
        const payload = {
          type: messageType,
          data: `Sample ${messageType} data`,
          timestamp: Date.now(),
        };

        console.log(`      Party ${fromParty} broadcasting: ${messageType}`);
        this.signalingServer.simulateBroadcast(
          sessionId,
          fromParty,
          messageType,
          payload
        );

        await this.delay(100);
      }
    }
  }

  async simulatePartyDisconnections() {
    for (const [sessionId, parties] of this.demoSessions) {
      console.log(`\n   🚪 Disconnecting parties from session: ${sessionId}`);

      // Disconnect half the parties from each session
      const partiesToDisconnect = parties.slice(
        0,
        Math.ceil(parties.length / 2)
      );

      for (const partyId of partiesToDisconnect) {
        this.signalingServer.simulateClientLeave(sessionId, partyId);
        console.log(`      Party ${partyId} left session ${sessionId}`);

        await this.delay(150);
      }
    }

    this.displayServerStatus();
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Run the demo
async function main() {
  const demo = new WebRTCSignalingDemo();
  await demo.runDemo();
}

// Check if this file is being run directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { WebRTCSignalingDemo };
