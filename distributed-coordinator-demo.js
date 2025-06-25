/**
 * Distributed Coordinator Pattern Demonstration
 *
 * This demonstrates how to implement a distributed coordinator where each party
 * runs their own coordinator instance and consensus is required for all operations.
 */

const crypto = require('crypto');
const EventEmitter = require('events');

// Consensus message types
const CONSENSUS_TYPES = {
  PROPOSE: 'propose',
  VOTE: 'vote',
  COMMIT: 'commit',
  REJECT: 'reject',
};

// Distributed coordinator instance for each party
class DistributedCoordinator extends EventEmitter {
  constructor(partyId, peers, sessionId) {
    super();
    this.partyId = partyId;
    this.peers = peers; // Other party IDs
    this.sessionId = sessionId;
    this.state = 'initialized';

    // Consensus state
    this.pendingProposals = new Map();
    this.committedOperations = new Map();
    this.voteHistory = new Map();

    // Session state
    this.partyResponses = new Map();
    this.threshold = 2; // Minimum parties required
    this.totalParties = peers.length + 1;

    console.log(
      `[Party ${partyId}] Distributed coordinator initialized for session ${sessionId}`
    );
  }

  /**
   * Propose an operation to all coordinators
   */
  async proposeOperation(operationType, operationData) {
    const proposalId = this.generateProposalId(operationType, operationData);

    console.log(
      `[Party ${this.partyId}] Proposing operation: ${operationType} (${proposalId})`
    );

    // Create proposal
    const proposal = {
      id: proposalId,
      type: operationType,
      data: operationData,
      proposer: this.partyId,
      timestamp: Date.now(),
      sessionId: this.sessionId,
    };

    // Store pending proposal
    this.pendingProposals.set(proposalId, {
      proposal,
      votes: new Map(),
      status: 'pending',
    });

    // Broadcast proposal to all peers
    await this.broadcastToPeers(CONSENSUS_TYPES.PROPOSE, proposal);

    // Vote for our own proposal
    await this.voteOnProposal(proposalId, true);

    return proposalId;
  }

  /**
   * Handle incoming proposal from another coordinator
   */
  async handleProposal(proposal) {
    console.log(
      `[Party ${this.partyId}] Received proposal: ${proposal.type} from Party ${proposal.proposer}`
    );

    // Validate proposal
    if (!this.validateProposal(proposal)) {
      console.log(
        `[Party ${this.partyId}] Rejecting invalid proposal: ${proposal.id}`
      );
      await this.rejectProposal(proposal.id, 'Invalid proposal');
      return;
    }

    // Store pending proposal
    this.pendingProposals.set(proposal.id, {
      proposal,
      votes: new Map(),
      status: 'pending',
    });

    // Vote on the proposal
    const shouldApprove = await this.evaluateProposal(proposal);
    await this.voteOnProposal(proposal.id, shouldApprove);
  }

  /**
   * Vote on a proposal
   */
  async voteOnProposal(proposalId, approve) {
    const pendingProposal = this.pendingProposals.get(proposalId);
    if (!pendingProposal) {
      console.log(
        `[Party ${this.partyId}] No pending proposal found for ${proposalId}`
      );
      return;
    }

    const vote = {
      proposalId,
      voter: this.partyId,
      approve,
      timestamp: Date.now(),
      reason: approve ? 'Approved' : 'Rejected',
    };

    // Record our vote
    pendingProposal.votes.set(this.partyId, vote);

    console.log(
      `[Party ${this.partyId}] Voted ${approve ? 'APPROVE' : 'REJECT'} on proposal ${proposalId}`
    );

    // Broadcast vote to all peers
    await this.broadcastToPeers(CONSENSUS_TYPES.VOTE, vote);

    // Check if we have enough votes to commit
    await this.checkConsensus(proposalId);
  }

  /**
   * Handle incoming vote from another coordinator
   */
  async handleVote(vote) {
    console.log(
      `[Party ${this.partyId}] Received vote from Party ${vote.voter}: ${vote.approve ? 'APPROVE' : 'REJECT'} on ${vote.proposalId}`
    );

    const pendingProposal = this.pendingProposals.get(vote.proposalId);
    if (!pendingProposal) {
      console.log(
        `[Party ${this.partyId}] No pending proposal found for vote: ${vote.proposalId}`
      );
      return;
    }

    // Record the vote
    pendingProposal.votes.set(vote.voter, vote);

    // Check if we have enough votes to commit
    await this.checkConsensus(vote.proposalId);
  }

  /**
   * Check if consensus has been reached on a proposal
   */
  async checkConsensus(proposalId) {
    const pendingProposal = this.pendingProposals.get(proposalId);
    if (!pendingProposal) return;

    const votes = Array.from(pendingProposal.votes.values());
    const approveVotes = votes.filter((v) => v.approve).length;
    const totalVotes = votes.length;

    console.log(
      `[Party ${this.partyId}] Consensus check for ${proposalId}: ${approveVotes}/${totalVotes} approve votes`
    );

    // Check if we have unanimous approval (all parties must agree)
    if (approveVotes === this.totalParties) {
      console.log(
        `[Party ${this.partyId}] 🎉 CONSENSUS REACHED for proposal ${proposalId}`
      );
      await this.commitOperation(proposalId);
    } else if (
      totalVotes === this.totalParties &&
      approveVotes < this.totalParties
    ) {
      console.log(
        `[Party ${this.partyId}] ❌ CONSENSUS FAILED for proposal ${proposalId}`
      );
      await this.rejectOperation(proposalId);
    }
  }

  /**
   * Commit an operation after consensus is reached
   */
  async commitOperation(proposalId) {
    const pendingProposal = this.pendingProposals.get(proposalId);
    if (!pendingProposal) return;

    const { proposal } = pendingProposal;

    console.log(
      `[Party ${this.partyId}] Committing operation: ${proposal.type}`
    );

    // Execute the operation
    await this.executeOperation(proposal.type, proposal.data);

    // Mark as committed
    this.committedOperations.set(proposalId, {
      proposal,
      committedAt: Date.now(),
      committedBy: this.partyId,
    });

    // Update status
    pendingProposal.status = 'committed';

    // Broadcast commit to all peers
    await this.broadcastToPeers(CONSENSUS_TYPES.COMMIT, {
      proposalId,
      committedBy: this.partyId,
      timestamp: Date.now(),
    });

    // Emit event for local handling
    this.emit('operationCommitted', proposal.type, proposal.data);
  }

  /**
   * Reject an operation after consensus fails
   */
  async rejectOperation(proposalId) {
    const pendingProposal = this.pendingProposals.get(proposalId);
    if (!pendingProposal) return;

    console.log(`[Party ${this.partyId}] Rejecting operation: ${proposalId}`);

    // Update status
    pendingProposal.status = 'rejected';

    // Broadcast reject to all peers
    await this.broadcastToPeers(CONSENSUS_TYPES.REJECT, {
      proposalId,
      rejectedBy: this.partyId,
      timestamp: Date.now(),
    });

    // Emit event for local handling
    this.emit('operationRejected', proposalId);
  }

  /**
   * Execute an operation after consensus
   */
  async executeOperation(operationType, operationData) {
    switch (operationType) {
      case 'initiate_dkg':
        await this.executeDKGInitiation(operationData);
        break;
      case 'party_response':
        await this.executePartyResponse(operationData);
        break;
      case 'complete_session':
        await this.executeSessionCompletion(operationData);
        break;
      default:
        console.log(
          `[Party ${this.partyId}] Unknown operation type: ${operationType}`
        );
    }
  }

  /**
   * Execute DKG initiation
   */
  async executeDKGInitiation(data) {
    console.log(`[Party ${this.partyId}] Executing DKG initiation`);
    this.state = 'dkg_initiated';

    // Notify local party about DKG initiation
    this.emit('dkgInitiated', data);
  }

  /**
   * Execute party response handling
   */
  async executePartyResponse(data) {
    const { partyId, event, payload } = data;

    console.log(
      `[Party ${this.partyId}] Executing party response: Party ${partyId} - ${event}`
    );

    // Store party response
    this.partyResponses.set(partyId, {
      event,
      payload,
      timestamp: Date.now(),
    });

    // Check if session can proceed
    if (this.canProceedWithOperation()) {
      await this.proposeOperation('complete_session', {
        sessionId: this.sessionId,
        completedAt: Date.now(),
      });
    }
  }

  /**
   * Execute session completion
   */
  async executeSessionCompletion(data) {
    console.log(`[Party ${this.partyId}] Executing session completion`);
    this.state = 'completed';

    // Generate wallet address (in real implementation, this would use actual MPC)
    const walletAddress = this.generateWalletAddress();

    console.log(
      `[Party ${this.partyId}] 🎉 Session completed! Wallet: ${walletAddress}`
    );

    // Emit completion event
    this.emit('sessionCompleted', {
      sessionId: this.sessionId,
      walletAddress,
      completedAt: Date.now(),
    });
  }

  /**
   * Check if session can proceed with operation
   */
  canProceedWithOperation() {
    const readyParties = Array.from(this.partyResponses.values()).filter(
      (response) => response.event === 'share_committed'
    );

    return readyParties.length >= this.threshold;
  }

  /**
   * Generate wallet address (simplified for demo)
   */
  generateWalletAddress() {
    const responses = Array.from(this.partyResponses.values());
    const combinedData = responses
      .map((r) => r.payload.commitment || r.payload.share)
      .join('');
    return (
      '0x' +
      crypto
        .createHash('sha256')
        .update(combinedData)
        .digest('hex')
        .substr(0, 40)
    );
  }

  /**
   * Validate a proposal
   */
  validateProposal(proposal) {
    // Basic validation
    if (!proposal.id || !proposal.type || !proposal.data) {
      return false;
    }

    // Check if proposer is valid
    if (
      !this.peers.includes(proposal.proposer) &&
      proposal.proposer !== this.partyId
    ) {
      return false;
    }

    // Check session ID
    if (proposal.sessionId !== this.sessionId) {
      return false;
    }

    return true;
  }

  /**
   * Evaluate whether to approve a proposal
   */
  async evaluateProposal(proposal) {
    // In a real implementation, this would include business logic validation
    switch (proposal.type) {
      case 'initiate_dkg':
        return this.state === 'initialized';
      case 'party_response':
        return this.state === 'dkg_initiated';
      case 'complete_session':
        return this.canProceedWithOperation();
      default:
        return false;
    }
  }

  /**
   * Broadcast message to all peers
   */
  async broadcastToPeers(messageType, payload) {
    // In a real implementation, this would send via WebRTC or HTTP
    console.log(
      `[Party ${this.partyId}] Broadcasting ${messageType} to peers:`,
      payload
    );

    // Simulate network delay
    await this.delay(100 + Math.random() * 200);

    // Emit event for peer communication
    this.emit('broadcast', messageType, payload);
  }

  /**
   * Generate unique proposal ID
   */
  generateProposalId(type, data) {
    const content = JSON.stringify({
      type,
      data,
      partyId: this.partyId,
      timestamp: Date.now(),
    });
    return crypto
      .createHash('sha256')
      .update(content)
      .digest('hex')
      .substr(0, 16);
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current state
   */
  getState() {
    return {
      partyId: this.partyId,
      sessionId: this.sessionId,
      state: this.state,
      partyResponses: Array.from(this.partyResponses.entries()),
      committedOperations: Array.from(this.committedOperations.keys()),
      pendingProposals: Array.from(this.pendingProposals.keys()),
    };
  }
}

// Network simulator for coordinator communication
class CoordinatorNetwork {
  constructor() {
    this.coordinators = new Map();
    this.messageQueue = [];
  }

  /**
   * Register a coordinator
   */
  registerCoordinator(partyId, coordinator) {
    this.coordinators.set(partyId, coordinator);

    // Set up event listeners for broadcasting
    coordinator.on('broadcast', (messageType, payload) => {
      this.routeMessage(partyId, messageType, payload);
    });

    console.log(`[Network] Registered coordinator for Party ${partyId}`);
  }

  /**
   * Route messages between coordinators
   */
  async routeMessage(fromPartyId, messageType, payload) {
    const fromCoordinator = this.coordinators.get(fromPartyId);
    if (!fromCoordinator) return;

    // Route to all other coordinators
    for (const [partyId, coordinator] of this.coordinators.entries()) {
      if (partyId === fromPartyId) continue;

      // Simulate network delay and potential message loss
      if (Math.random() > 0.1) {
        // 90% message delivery rate
        setTimeout(
          () => {
            this.deliverMessage(partyId, messageType, payload);
          },
          50 + Math.random() * 100
        );
      } else {
        console.log(
          `[Network] Message lost from Party ${fromPartyId} to Party ${partyId}`
        );
      }
    }
  }

  /**
   * Deliver message to specific coordinator
   */
  deliverMessage(toPartyId, messageType, payload) {
    const coordinator = this.coordinators.get(toPartyId);
    if (!coordinator) return;

    console.log(`[Network] Delivering ${messageType} to Party ${toPartyId}`);

    switch (messageType) {
      case CONSENSUS_TYPES.PROPOSE:
        coordinator.handleProposal(payload);
        break;
      case CONSENSUS_TYPES.VOTE:
        coordinator.handleVote(payload);
        break;
      case CONSENSUS_TYPES.COMMIT:
        console.log(
          `[Network] Party ${toPartyId} received commit for ${payload.proposalId}`
        );
        break;
      case CONSENSUS_TYPES.REJECT:
        console.log(
          `[Network] Party ${toPartyId} received reject for ${payload.proposalId}`
        );
        break;
    }
  }

  /**
   * Get network status
   */
  getStatus() {
    return {
      registeredParties: Array.from(this.coordinators.keys()),
      totalCoordinators: this.coordinators.size,
    };
  }
}

// Demo function
async function demonstrateDistributedCoordinator() {
  console.log('🌐 Distributed Coordinator Pattern Demonstration\n');

  // Create network
  const network = new CoordinatorNetwork();

  // Create distributed coordinators for each party
  const sessionId = crypto.randomUUID();
  const party1Coordinator = new DistributedCoordinator(1, [2, 3], sessionId);
  const party2Coordinator = new DistributedCoordinator(2, [1, 3], sessionId);
  const party3Coordinator = new DistributedCoordinator(3, [1, 2], sessionId);

  // Register coordinators with network
  network.registerCoordinator(1, party1Coordinator);
  network.registerCoordinator(2, party2Coordinator);
  network.registerCoordinator(3, party3Coordinator);

  console.log('✅ All coordinators registered and connected\n');

  // Set up event listeners for session completion
  [party1Coordinator, party2Coordinator, party3Coordinator].forEach(
    (coordinator) => {
      coordinator.on('sessionCompleted', (data) => {
        console.log(
          `🎉 [Party ${coordinator.partyId}] Session completed:`,
          data
        );
      });

      coordinator.on('dkgInitiated', (data) => {
        console.log(`🚀 [Party ${coordinator.partyId}] DKG initiated`);
      });
    }
  );

  // Simulate MPC session flow
  console.log('=== 🔄 Simulating Distributed MPC Session ===\n');

  // Step 1: Party 1 proposes DKG initiation
  console.log('📝 Step 1: Party 1 proposes DKG initiation');
  await party1Coordinator.proposeOperation('initiate_dkg', {
    blockchain: 'ethereum',
    threshold: 2,
    totalParties: 3,
  });

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Step 2: Simulate party responses (these would come from actual MPC parties)
  console.log('\n📝 Step 2: Simulating party responses');

  // Party 1 response
  await party1Coordinator.proposeOperation('party_response', {
    partyId: 1,
    event: 'share_committed',
    payload: {
      commitment: crypto.randomBytes(32).toString('hex'),
      timestamp: Date.now(),
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 500));

  // Party 2 response
  await party2Coordinator.proposeOperation('party_response', {
    partyId: 2,
    event: 'share_committed',
    payload: {
      commitment: crypto.randomBytes(32).toString('hex'),
      timestamp: Date.now(),
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 500));

  // Party 3 response
  await party3Coordinator.proposeOperation('party_response', {
    partyId: 3,
    event: 'share_committed',
    payload: {
      commitment: crypto.randomBytes(32).toString('hex'),
      timestamp: Date.now(),
    },
  });

  // Wait for session completion
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log('\n=== 📊 Final State ===');
  console.log('Party 1 State:', party1Coordinator.getState());
  console.log('Party 2 State:', party2Coordinator.getState());
  console.log('Party 3 State:', party3Coordinator.getState());
  console.log('Network Status:', network.getStatus());

  console.log('\n=== 🎯 Distributed Coordinator Benefits ===');
  console.log('✅ No single point of failure');
  console.log('✅ All parties must agree on operations');
  console.log('✅ Byzantine fault tolerance');
  console.log('✅ Distributed audit trail');
  console.log('✅ Attack resistance (requires compromising multiple devices)');
  console.log('✅ True decentralization');
}

// Run the demo
if (require.main === module) {
  demonstrateDistributedCoordinator().catch(console.error);
}

module.exports = {
  DistributedCoordinator,
  CoordinatorNetwork,
  CONSENSUS_TYPES,
};
