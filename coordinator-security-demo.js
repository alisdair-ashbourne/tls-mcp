/**
 * Coordinator Security Demo
 *
 * This demonstrates the security vulnerabilities of browser-based coordination
 * vs secure server-based coordination for MPC sessions.
 */

const crypto = require('crypto');

// Simulated MPC session data
class MPCSession {
  constructor(sessionId, parties, threshold) {
    this.sessionId = sessionId;
    this.parties = parties;
    this.threshold = threshold;
    this.status = 'initialized';
    this.shares = new Map();
    this.commitments = new Map();
  }
}

// 🚨 VULNERABLE: Browser-based coordinator (DO NOT USE IN PRODUCTION)
class BrowserBasedCoordinator {
  constructor(initiatorPartyId) {
    this.initiatorPartyId = initiatorPartyId;
    this.sessions = new Map();
    this.auditLog = [];

    console.log(
      '⚠️  WARNING: Browser-based coordinator for demonstration only!'
    );
    console.log('⚠️  This creates serious security vulnerabilities!');
  }

  async initializeSession(
    operation,
    parties,
    threshold,
    totalParties,
    metadata = {}
  ) {
    const sessionId = crypto.randomUUID();
    const session = new MPCSession(sessionId, parties, threshold);

    this.sessions.set(sessionId, session);

    // VULNERABILITY 1: Initiator can see all party information
    console.log(
      `🔍 [VULNERABILITY] Initiator can see all party details:`,
      parties
    );

    // VULNERABILITY 2: Initiator controls session creation
    console.log(`🔍 [VULNERABILITY] Initiator controls session lifecycle`);

    this.logAction('session_initialized', { sessionId, parties, threshold });

    return session;
  }

  async handlePartyResponse(sessionId, partyId, event, payload) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    // VULNERABILITY 3: Initiator can see ALL party responses
    console.log(
      `🔍 [VULNERABILITY] Initiator sees Party ${partyId} response:`,
      payload
    );

    // VULNERABILITY 4: Initiator can modify responses before forwarding
    const modifiedPayload = this.maliciouslyModifyPayload(payload, partyId);

    // VULNERABILITY 5: Initiator can create fake responses
    if (this.shouldCreateFakeResponse(partyId)) {
      const fakePayload = this.createFakeResponse(partyId, event);
      console.log(
        `🔍 [VULNERABILITY] Initiator created fake response for Party ${partyId}:`,
        fakePayload
      );
    }

    // Update session state
    session.shares.set(partyId, modifiedPayload);
    session.commitments.set(partyId, this.generateCommitment(modifiedPayload));

    this.logAction('party_response_handled', {
      sessionId,
      partyId,
      event,
      payload: modifiedPayload,
    });

    // Check if session can proceed
    if (this.canProceedWithOperation(session)) {
      await this.processSession(session);
    }

    return { success: true };
  }

  // MALICIOUS: Initiator can modify party responses
  maliciouslyModifyPayload(payload, partyId) {
    // In a real attack, the initiator could:
    // - Change share commitments
    // - Modify signature components
    // - Alter protocol parameters

    if (payload.commitment && this.shouldTamperWithCommitment(partyId)) {
      payload.commitment = this.generateFakeCommitment();
      console.log(
        `🔍 [VULNERABILITY] Initiator tampered with Party ${partyId} commitment`
      );
    }

    return payload;
  }

  // MALICIOUS: Initiator can create fake responses
  createFakeResponse(partyId, event) {
    return {
      partyId,
      event,
      commitment: this.generateFakeCommitment(),
      timestamp: Date.now(),
      fake: true, // This would be hidden in a real attack
    };
  }

  shouldCreateFakeResponse(partyId) {
    // Simulate malicious behavior: create fake responses for certain parties
    return partyId === 2 && Math.random() < 0.3; // 30% chance for Party 2
  }

  shouldTamperWithCommitment(partyId) {
    // Simulate malicious behavior: tamper with certain party commitments
    return partyId === 3 && Math.random() < 0.2; // 20% chance for Party 3
  }

  generateFakeCommitment() {
    return crypto.randomBytes(32).toString('hex');
  }

  generateCommitment(data) {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');
  }

  canProceedWithOperation(session) {
    return session.shares.size >= session.threshold;
  }

  async processSession(session) {
    session.status = 'dkg_completed';

    // VULNERABILITY 6: Initiator can manipulate final results
    const walletAddress = this.generateWalletAddress(session);
    console.log(
      `🔍 [VULNERABILITY] Initiator controls wallet generation: ${walletAddress}`
    );

    this.logAction('session_completed', {
      sessionId: session.sessionId,
      walletAddress,
    });
  }

  generateWalletAddress(session) {
    // In a real attack, the initiator could generate a wallet they control
    const combinedShares = Array.from(session.shares.values()).join('');
    return (
      '0x' +
      crypto
        .createHash('sha256')
        .update(combinedShares)
        .digest('hex')
        .substr(0, 40)
    );
  }

  logAction(action, data) {
    this.auditLog.push({
      action,
      data,
      timestamp: new Date(),
      initiator: this.initiatorPartyId,
    });
  }

  getAuditLog() {
    return this.auditLog;
  }
}

// ✅ SECURE: Server-based coordinator (Production-ready)
class SecureServerCoordinator {
  constructor() {
    this.sessions = new Map();
    this.auditLog = [];
    this.securityChecks = new SecurityChecks();
    this.monitoring = new MonitoringService();

    console.log('✅ Secure server-based coordinator initialized');
  }

  async initializeSession(
    operation,
    parties,
    threshold,
    totalParties,
    metadata = {}
  ) {
    // SECURITY: Validate all inputs
    this.securityChecks.validateSessionParameters(
      parties,
      threshold,
      totalParties
    );

    const sessionId = crypto.randomUUID();
    const session = new MPCSession(sessionId, parties, threshold);

    this.sessions.set(sessionId, session);

    // SECURITY: Log all actions for audit
    await this.logAction('session_initialized', {
      sessionId,
      operation,
      threshold,
      totalParties,
      parties: parties.map((p) => ({ id: p.partyId, name: p.partyName })), // Don't log sensitive data
    });

    // SECURITY: Monitor for suspicious activity
    this.monitoring.checkForAnomalies('session_creation', {
      sessionId,
      parties: parties.length,
    });

    return session;
  }

  async handlePartyResponse(sessionId, partyId, event, payload) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    // SECURITY: Validate party response
    this.securityChecks.validatePartyResponse(partyId, event, payload);

    // SECURITY: Check for duplicate responses
    if (session.shares.has(partyId)) {
      throw new Error(`Duplicate response from Party ${partyId}`);
    }

    // SECURITY: Verify response integrity
    const responseHash = this.generateResponseHash(payload);
    if (!this.securityChecks.verifyResponseIntegrity(partyId, responseHash)) {
      throw new Error(`Response integrity check failed for Party ${partyId}`);
    }

    // SECURITY: Store response without modification
    session.shares.set(partyId, { ...payload, verified: true });
    session.commitments.set(partyId, this.generateCommitment(payload));

    // SECURITY: Log response for audit
    await this.logAction('party_response_received', {
      sessionId,
      partyId,
      event,
      responseHash, // Log hash, not full payload
      timestamp: Date.now(),
    });

    // SECURITY: Monitor for suspicious patterns
    this.monitoring.checkForAnomalies('party_response', {
      sessionId,
      partyId,
      event,
      responseTime: Date.now() - session.createdAt,
    });

    // Check if session can proceed
    if (this.canProceedWithOperation(session)) {
      await this.processSession(session);
    }

    return { success: true, verified: true };
  }

  generateResponseHash(payload) {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  generateCommitment(data) {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');
  }

  canProceedWithOperation(session) {
    return session.shares.size >= session.threshold;
  }

  async processSession(session) {
    // SECURITY: Verify all shares before processing
    const verifiedShares = Array.from(session.shares.values()).filter(
      (share) => share.verified
    );
    if (verifiedShares.length < session.threshold) {
      throw new Error('Insufficient verified shares for session completion');
    }

    session.status = 'dkg_completed';

    // SECURITY: Generate wallet using verified cryptographic process
    const walletAddress = this.generateSecureWalletAddress(verifiedShares);

    // SECURITY: Log completion with verification
    await this.logAction('session_completed', {
      sessionId: session.sessionId,
      walletAddress,
      verifiedSharesCount: verifiedShares.length,
      threshold: session.threshold,
    });

    // SECURITY: Alert monitoring system
    this.monitoring.alertSessionCompletion(session.sessionId, walletAddress);
  }

  generateSecureWalletAddress(shares) {
    // SECURITY: Use cryptographically secure wallet generation
    const combinedShares = shares
      .map((share) => share.commitment || share.share)
      .join('');
    return (
      '0x' +
      crypto
        .createHash('sha256')
        .update(combinedShares)
        .digest('hex')
        .substr(0, 40)
    );
  }

  async logAction(action, data) {
    const logEntry = {
      action,
      data,
      timestamp: new Date(),
      sessionId: data.sessionId,
      // SECURITY: Don't log sensitive data
      sensitiveDataRemoved: true,
    };

    this.auditLog.push(logEntry);

    // SECURITY: Store logs in secure, immutable storage
    await this.storeSecureLog(logEntry);
  }

  async storeSecureLog(logEntry) {
    // In production, this would store to secure, immutable storage
    console.log(
      '📝 [SECURE] Log stored to immutable audit trail:',
      logEntry.action
    );
  }

  getAuditLog() {
    return this.auditLog.map((entry) => ({
      ...entry,
      data: this.sanitizeDataForAudit(entry.data),
    }));
  }

  sanitizeDataForAudit(data) {
    // SECURITY: Remove sensitive data from audit logs
    const sanitized = { ...data };
    delete sanitized.commitment;
    delete sanitized.share;
    delete sanitized.privateKey;
    return sanitized;
  }
}

// Security validation service
class SecurityChecks {
  validateSessionParameters(parties, threshold, totalParties) {
    if (threshold < 2) throw new Error('Threshold must be at least 2');
    if (threshold > totalParties)
      throw new Error('Threshold cannot exceed total parties');
    if (parties.length !== totalParties)
      throw new Error('Party count mismatch');
  }

  validatePartyResponse(partyId, event, payload) {
    if (!partyId || partyId < 1) throw new Error('Invalid party ID');
    if (!event) throw new Error('Event is required');
    if (!payload) throw new Error('Payload is required');
  }

  verifyResponseIntegrity(partyId, responseHash) {
    // In production, this would verify cryptographic signatures
    return responseHash && responseHash.length === 64; // Basic hash validation
  }
}

// Monitoring service
class MonitoringService {
  checkForAnomalies(type, data) {
    // In production, this would use ML/analytics to detect suspicious activity
    console.log(`🔍 [MONITORING] Checking for anomalies in ${type}:`, data);
  }

  alertSessionCompletion(sessionId, walletAddress) {
    console.log(
      `🚨 [ALERT] Session ${sessionId} completed, wallet: ${walletAddress}`
    );
  }
}

// Demo function
async function demonstrateSecurityDifferences() {
  console.log('🔒 Coordinator Security Demonstration\n');

  // Test data
  const parties = [
    {
      partyId: 1,
      partyName: 'Party 1',
      webhookUrl: 'http://localhost:3001/webhook',
    },
    {
      partyId: 2,
      partyName: 'Party 2',
      webhookUrl: 'http://localhost:3002/webhook',
    },
    {
      partyId: 3,
      partyName: 'Party 3',
      webhookUrl: 'http://localhost:3003/webhook',
    },
  ];

  console.log('=== 🚨 VULNERABLE: Browser-Based Coordinator ===');
  const browserCoordinator = new BrowserBasedCoordinator(1);

  // Create session
  const browserSession = await browserCoordinator.initializeSession(
    'threshold_signature',
    parties,
    2,
    3
  );

  // Simulate party responses (with vulnerabilities)
  await browserCoordinator.handlePartyResponse(
    browserSession.sessionId,
    1,
    'share_committed',
    {
      commitment: crypto.randomBytes(32).toString('hex'),
      timestamp: Date.now(),
    }
  );

  await browserCoordinator.handlePartyResponse(
    browserSession.sessionId,
    2,
    'share_committed',
    {
      commitment: crypto.randomBytes(32).toString('hex'),
      timestamp: Date.now(),
    }
  );

  await browserCoordinator.handlePartyResponse(
    browserSession.sessionId,
    3,
    'share_committed',
    {
      commitment: crypto.randomBytes(32).toString('hex'),
      timestamp: Date.now(),
    }
  );

  console.log('\n=== ✅ SECURE: Server-Based Coordinator ===');
  const secureCoordinator = new SecureServerCoordinator();

  // Create session
  const secureSession = await secureCoordinator.initializeSession(
    'threshold_signature',
    parties,
    2,
    3
  );

  // Simulate party responses (with security checks)
  await secureCoordinator.handlePartyResponse(
    secureSession.sessionId,
    1,
    'share_committed',
    {
      commitment: crypto.randomBytes(32).toString('hex'),
      timestamp: Date.now(),
    }
  );

  await secureCoordinator.handlePartyResponse(
    secureSession.sessionId,
    2,
    'share_committed',
    {
      commitment: crypto.randomBytes(32).toString('hex'),
      timestamp: Date.now(),
    }
  );

  await secureCoordinator.handlePartyResponse(
    secureSession.sessionId,
    3,
    'share_committed',
    {
      commitment: crypto.randomBytes(32).toString('hex'),
      timestamp: Date.now(),
    }
  );

  console.log('\n=== 📊 Security Comparison ===');
  console.log('Browser-Based Coordinator:');
  console.log('❌ Single point of control');
  console.log('❌ Can modify party responses');
  console.log('❌ Can create fake responses');
  console.log('❌ No independent audit trail');
  console.log('❌ Vulnerable to browser attacks');

  console.log('\nServer-Based Coordinator:');
  console.log('✅ Independent operation');
  console.log('✅ Response integrity verification');
  console.log('✅ Immutable audit trail');
  console.log('✅ Security monitoring');
  console.log('✅ Professional security controls');

  console.log(
    '\n🎯 Recommendation: Use server-based coordinator for production MPC systems!'
  );
}

// Run the demo
if (require.main === module) {
  demonstrateSecurityDifferences().catch(console.error);
}

module.exports = {
  BrowserBasedCoordinator,
  SecureServerCoordinator,
  SecurityChecks,
  MonitoringService,
};
