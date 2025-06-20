const mongoose = require('mongoose');

const webhookLogSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  partyId: {
    type: Number,
    required: true
  },
  direction: {
    type: String,
    enum: ['inbound', 'outbound'],
    required: true
  },
  event: {
    type: String,
    required: true
  },
  url: String,
  method: {
    type: String,
    enum: ['GET', 'POST', 'PUT', 'DELETE'],
    default: 'POST'
  },
  requestBody: mongoose.Schema.Types.Mixed,
  responseBody: mongoose.Schema.Types.Mixed,
  statusCode: Number,
  headers: mongoose.Schema.Types.Mixed,
  responseHeaders: mongoose.Schema.Types.Mixed,
  duration: Number, // Response time in milliseconds
  success: {
    type: Boolean,
    default: false
  },
  error: {
    message: String,
    code: String,
    stack: String
  },
  retryCount: {
    type: Number,
    default: 0
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Indexes
webhookLogSchema.index({ sessionId: 1, timestamp: -1 });
webhookLogSchema.index({ partyId: 1, timestamp: -1 });
webhookLogSchema.index({ success: 1, timestamp: -1 });
webhookLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 86400 * 30 }); // Auto-delete after 30 days

// Static methods
webhookLogSchema.statics.logInbound = function(sessionId, partyId, event, requestBody, headers) {
  return this.create({
    sessionId,
    partyId,
    direction: 'inbound',
    event,
    requestBody,
    headers,
    success: true,
    timestamp: new Date()
  });
};

webhookLogSchema.statics.logOutbound = function(sessionId, partyId, event, url, requestBody, responseBody, statusCode, duration, success, error = null) {
  return this.create({
    sessionId,
    partyId,
    direction: 'outbound',
    event,
    url,
    requestBody,
    responseBody,
    statusCode,
    duration,
    success,
    error,
    timestamp: new Date()
  });
};

webhookLogSchema.statics.getSessionLogs = function(sessionId, limit = 100) {
  return this.find({ sessionId })
    .sort({ timestamp: -1 })
    .limit(limit);
};

webhookLogSchema.statics.getFailedWebhooks = function(since) {
  const query = { success: false };
  if (since) {
    query.timestamp = { $gte: since };
  }
  return this.find(query).sort({ timestamp: -1 });
};

module.exports = mongoose.model('WebhookLog', webhookLogSchema); 