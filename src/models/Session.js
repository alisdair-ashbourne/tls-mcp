const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'completed', 'failed', 'expired'],
    default: 'pending'
  },
  operation: {
    type: String,
    enum: ['key_generation', 'key_reconstruction', 'signature', 'verification'],
    required: true
  },
  parties: [{
    partyId: {
      type: Number,
      required: true
    },
    partyName: {
      type: String,
      required: true
    },
    webhookUrl: String,
    status: {
      type: String,
      enum: ['pending', 'connected', 'ready', 'completed', 'failed'],
      default: 'pending'
    },
    lastSeen: Date,
    share: String, // Encrypted share for this party
    commitment: String, // Commitment to the share
    nonce: String // Nonce for commitment verification
  }],
  threshold: {
    type: Number,
    default: 3
  },
  totalParties: {
    type: Number,
    default: 3
  },
  shares: [{
    partyId: Number,
    share: String
    // Note: Encryption should be handled at the application level
  }],
  commitments: [{
    partyId: Number,
    commitment: String,
    nonce: String
  }],
  communicationPubKeys: [{
    partyId: Number,
    publicKey: String
  }],
  signatureComponents: [{
    partyId: Number,
    component: String,
    messageHash: String,
    timestamp: Date
  }],
  finalSignature: {
    signature: String,
    messageHash: String,
    participants: [Number],
    timestamp: Date
  },
  metadata: {
    walletAddress: String,
    blockchain: String,
    message: String,
    description: String
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
sessionSchema.index({ status: 1, createdAt: -1 });
sessionSchema.index({ 'parties.partyId': 1, status: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save middleware to update updatedAt
sessionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Instance methods
sessionSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt;
};

sessionSchema.methods.canProceed = function() {
  const readyParties = this.parties.filter(p => p.status === 'ready' || p.status === 'completed');
  return readyParties.length >= this.threshold;
};

sessionSchema.methods.getPartyById = function(partyId) {
  return this.parties.find(p => p.partyId === partyId);
};

sessionSchema.methods.updatePartyStatus = function(partyId, status) {
  const party = this.getPartyById(partyId);
  if (party) {
    party.status = status;
    party.lastSeen = new Date();
  }
  return party;
};

// Static methods
sessionSchema.statics.findActiveSessions = function() {
  return this.find({
    status: { $in: ['pending', 'active'] },
    expiresAt: { $gt: new Date() }
  });
};

sessionSchema.statics.cleanupExpiredSessions = function() {
  return this.updateMany(
    { expiresAt: { $lt: new Date() } },
    { status: 'expired' }
  );
};

module.exports = mongoose.model('Session', sessionSchema); 