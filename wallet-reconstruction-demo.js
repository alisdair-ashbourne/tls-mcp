const axios = require('axios');
const crypto = require('crypto');

const COORDINATOR_URL = 'http://localhost:3000';

class WalletReconstructionDemo {
  constructor() {
    this.sessionId = null;
  }

  async run() {
    console.log('🔑 Wallet Address Reconstruction Demo');
    console.log('=====================================\n');

    try {
      // Step 1: Initialize session
      const sessionInitialized = await this.initializeSession();
      if (!sessionInitialized) {
        console.log('❌ Failed to initialize session.');
        return;
      }

      // Step 2: Initiate DKG
      const dkgInitiated = await this.initiateDKG();
      if (!dkgInitiated) {
        console.log('❌ Failed to initiate DKG.');
        return;
      }

      // Step 3: Wait for DKG completion
      console.log('⏳ Waiting for DKG completion...');
      await this.delay(3000);

      // Step 4: Get session status to see the generated wallet address
      const sessionStatus = await this.getSessionStatus();
      if (sessionStatus) {
        console.log(
          '💰 Original wallet address:',
          sessionStatus.metadata.walletAddress
        );
      }

      // Step 5: Test reconstruction
      const reconstructionResult = await this.testReconstruction();
      if (reconstructionResult) {
        console.log(
          '🔓 Reconstructed wallet address:',
          reconstructionResult.walletAddress
        );

        // Compare addresses
        if (
          sessionStatus &&
          sessionStatus.metadata.walletAddress ===
            reconstructionResult.walletAddress
        ) {
          console.log('✅ SUCCESS: Wallet addresses match!');
        } else {
          console.log('❌ FAILED: Wallet addresses do not match!');
        }
      }
    } catch (error) {
      console.error('❌ Demo failed:', error.message);
    }
  }

  async initializeSession() {
    console.log('📋 Initializing session...');

    try {
      const response = await axios.post(`${COORDINATOR_URL}/api/sessions`, {
        operation: 'threshold_wallet',
        parties: [
          {
            partyId: 1,
            partyName: 'Party A',
            webhookUrl: 'http://localhost:3001/webhook',
          },
          {
            partyId: 2,
            partyName: 'Party B',
            webhookUrl: 'http://localhost:3002/webhook',
          },
          {
            partyId: 3,
            partyName: 'Party C',
            webhookUrl: 'http://localhost:3003/webhook',
          },
        ],
        threshold: 2,
        totalParties: 3,
        metadata: {
          description: 'Test threshold wallet session',
          blockchain: 'ethereum',
        },
      });

      this.sessionId = response.data.sessionId;
      console.log('✅ Session initialized:', this.sessionId);
      return true;
    } catch (error) {
      console.error(
        '❌ Failed to initialize session:',
        error.response?.data || error.message
      );
      return false;
    }
  }

  async initiateDKG() {
    console.log('\n🔐 Initiating distributed key generation...');

    try {
      const response = await axios.post(
        `${COORDINATOR_URL}/api/sessions/${this.sessionId}/initiate-dkg`,
        {
          blockchain: 'ethereum',
        }
      );

      console.log('✅ DKG initiated');
      console.log('📊 Status:', response.data.status);
      return true;
    } catch (error) {
      console.error(
        '❌ Failed to initiate DKG:',
        error.response?.data || error.message
      );
      return false;
    }
  }

  async getSessionStatus() {
    try {
      const response = await axios.get(
        `${COORDINATOR_URL}/api/sessions/${this.sessionId}`
      );
      return response.data.session;
    } catch (error) {
      console.error(
        '❌ Failed to get session status:',
        error.response?.data || error.message
      );
      return null;
    }
  }

  async testReconstruction() {
    console.log('\n🔓 Testing wallet address reconstruction...');

    try {
      const response = await axios.post(
        `${COORDINATOR_URL}/api/sessions/${this.sessionId}/reconstruct-key`
      );

      console.log('✅ Key reconstruction completed');
      console.log('📊 Status:', response.data.status);
      console.log('📦 Shares used:', response.data.sharesCount);

      return response.data;
    } catch (error) {
      console.error(
        '❌ Failed to reconstruct key:',
        error.response?.data || error.message
      );
      return null;
    }
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Run the demo
const demo = new WalletReconstructionDemo();
demo.run();
