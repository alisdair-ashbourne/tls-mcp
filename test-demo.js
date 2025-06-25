const axios = require('axios');

const COORDINATOR_URL = 'http://localhost:3000';
const PARTY_URLS = [
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
];

class TLSMCPDemo {
  constructor() {
    this.sessionId = null;
  }

  async delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async checkHealth() {
    console.log('🔍 Checking system health...');

    try {
      const coordinatorHealth = await axios.get(`${COORDINATOR_URL}/health`);
      console.log('✅ Coordinator is healthy:', coordinatorHealth.data.status);

      for (let i = 0; i < PARTY_URLS.length; i++) {
        const partyHealth = await axios.get(`${PARTY_URLS[i]}/health`);
        console.log(`✅ Party ${i + 1} is healthy:`, partyHealth.data.status);
      }

      return true;
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      return false;
    }
  }

  async createSession() {
    console.log('\n📝 Creating new TLS-MCP session...');

    try {
      const response = await axios.post(`${COORDINATOR_URL}/api/sessions`, {
        operation: 'key_generation',
        parties: [
          { name: 'Party A', webhookUrl: `${PARTY_URLS[0]}/webhook` },
          { name: 'Party B', webhookUrl: `${PARTY_URLS[1]}/webhook` },
          { name: 'Party C', webhookUrl: `${PARTY_URLS[2]}/webhook` },
        ],
        metadata: {
          description: 'Demo wallet key generation',
          blockchain: 'ethereum',
        },
      });

      this.sessionId = response.data.sessionId;
      console.log('✅ Session created:', this.sessionId);
      console.log('📊 Session status:', response.data.status);

      return true;
    } catch (error) {
      console.error(
        '❌ Failed to create session:',
        error.response?.data || error.message
      );
      return false;
    }
  }

  async generateKey() {
    console.log('\n🔑 Generating private key and distributing shares...');

    try {
      const response = await axios.post(
        `${COORDINATOR_URL}/api/sessions/${this.sessionId}/generate-key`,
        {
          walletAddress: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
          blockchain: 'ethereum',
        }
      );

      console.log('✅ Key generation initiated');
      console.log('📊 Status:', response.data.status);
      console.log('💰 Wallet address:', response.data.walletAddress);

      // Wait for shares to be distributed
      console.log('⏳ Waiting for shares to be distributed...');
      await this.delay(2000);

      return true;
    } catch (error) {
      console.error(
        '❌ Failed to generate key:',
        error.response?.data || error.message
      );
      return false;
    }
  }

  async checkSessionStatus() {
    console.log('\n📊 Checking session status...');

    try {
      const response = await axios.get(
        `${COORDINATOR_URL}/api/sessions/${this.sessionId}`
      );
      const session = response.data.session;

      console.log('📋 Session details:');
      console.log('   Status:', session.status);
      console.log('   Operation:', session.operation);
      console.log('   Parties:', session.parties.length);
      console.log(
        '   Ready parties:',
        session.parties.filter((p) => p.status === 'ready').length
      );

      session.parties.forEach((party) => {
        console.log(
          `   Party ${party.partyId} (${party.partyName}): ${party.status}`
        );
      });

      return session;
    } catch (error) {
      console.error(
        '❌ Failed to get session status:',
        error.response?.data || error.message
      );
      return null;
    }
  }

  async createSignature() {
    console.log('\n✍️ Creating threshold signature...');

    try {
      const message = 'Hello, TLS-MCP World!';
      const response = await axios.post(
        `${COORDINATOR_URL}/api/sessions/${this.sessionId}/sign`,
        {
          message: message,
        }
      );

      console.log('✅ Signature created successfully');
      console.log('📝 Message:', response.data.message);
      console.log(
        '🔐 Signature:',
        response.data.signature.substring(0, 20) + '...'
      );
      console.log('📊 Message hash:', response.data.messageHash);
      console.log('👥 Participants:', response.data.participants);

      return true;
    } catch (error) {
      console.error(
        '❌ Failed to create signature:',
        error.response?.data || error.message
      );
      return false;
    }
  }

  async reconstructKey() {
    console.log('\n🔓 Reconstructing private key...');

    try {
      const response = await axios.post(
        `${COORDINATOR_URL}/api/sessions/${this.sessionId}/reconstruct-key`
      );

      console.log('✅ Key reconstruction completed');
      console.log('💰 Wallet address:', response.data.walletAddress);
      console.log(
        '🔑 Private key:',
        response.data.privateKey.substring(0, 20) + '...'
      );
      console.log('📊 Status:', response.data.status);

      return true;
    } catch (error) {
      console.error(
        '❌ Failed to reconstruct key:',
        error.response?.data || error.message
      );
      return false;
    }
  }

  async checkWebhookLogs() {
    console.log('\n📋 Checking webhook logs...');

    try {
      const response = await axios.get(
        `${COORDINATOR_URL}/api/webhook-logs/${this.sessionId}?limit=10`
      );

      console.log(`📊 Found ${response.data.count} webhook logs`);

      response.data.logs.slice(0, 5).forEach((log) => {
        console.log(
          `   ${log.direction.toUpperCase()} | Party ${log.partyId} | ${log.event} | ${log.success ? '✅' : '❌'}`
        );
      });

      return true;
    } catch (error) {
      console.error(
        '❌ Failed to get webhook logs:',
        error.response?.data || error.message
      );
      return false;
    }
  }

  async runDemo() {
    console.log('🚀 Starting TLS-MCP Demo\n');
    console.log('=' * 50);

    // Step 1: Health Check
    const healthOk = await this.checkHealth();
    if (!healthOk) {
      console.log(
        '❌ System health check failed. Please ensure all services are running.'
      );
      return;
    }

    // Step 2: Create Session
    const sessionCreated = await this.createSession();
    if (!sessionCreated) {
      console.log('❌ Failed to create session. Demo cannot continue.');
      return;
    }

    // Step 3: Generate Key
    const keyGenerated = await this.generateKey();
    if (!keyGenerated) {
      console.log('❌ Failed to generate key. Demo cannot continue.');
      return;
    }

    // Step 4: Check Status
    await this.checkSessionStatus();

    // Step 5: Create Signature
    const signatureCreated = await this.createSignature();
    if (!signatureCreated) {
      console.log('❌ Failed to create signature.');
    }

    // Step 6: Reconstruct Key
    const keyReconstructed = await this.reconstructKey();
    if (!keyReconstructed) {
      console.log('❌ Failed to reconstruct key.');
    }

    // Step 7: Check Logs
    await this.checkWebhookLogs();

    console.log('\n🎉 Demo completed successfully!');
    console.log('=' * 50);
    console.log('\n📚 Next steps:');
    console.log('   - Explore the frontend at http://localhost:4200');
    console.log('   - Check individual party statuses');
    console.log('   - Review the comprehensive README.md');
    console.log('   - Experiment with different operations');
  }
}

// Run the demo
async function main() {
  const demo = new TLSMCPDemo();

  try {
    await demo.runDemo();
  } catch (error) {
    console.error('💥 Demo failed with error:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Ensure all services are running (coordinator, parties)');
    console.log('   2. Check MongoDB connection');
    console.log('   3. Verify ports 3000-3003 are available');
    console.log('   4. Review the README.md for setup instructions');
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = TLSMCPDemo;
