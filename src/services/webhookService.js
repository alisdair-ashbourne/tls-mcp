const axios = require('axios');
const WebhookLog = require('../models/WebhookLog');

class WebhookService {
  constructor() {
    this.timeout = parseInt(process.env.WEBHOOK_TIMEOUT) || 30000;
    this.retryAttempts = parseInt(process.env.WEBHOOK_RETRY_ATTEMPTS) || 3;
  }

  /**
   * Send webhook to a specific party
   */
  async sendWebhook(sessionId, partyId, webhookUrl, event, payload) {
    const startTime = Date.now();
    let lastError = null;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await axios.post(webhookUrl, {
          sessionId,
          partyId,
          event,
          timestamp: new Date().toISOString(),
          ...payload
        }, {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'TLS-MCP-Coordinator/1.0',
            'X-Session-ID': sessionId,
            'X-Party-ID': partyId.toString(),
            'X-Event': event
          }
        });

        const duration = Date.now() - startTime;
        
        // Log successful webhook
        await WebhookLog.logOutbound(
          sessionId,
          partyId,
          event,
          webhookUrl,
          payload,
          response.data,
          response.status,
          duration,
          true
        );

        return {
          success: true,
          data: response.data,
          statusCode: response.status,
          duration
        };

      } catch (error) {
        lastError = error;
        const duration = Date.now() - startTime;
        
        // Log failed webhook attempt
        await WebhookLog.logOutbound(
          sessionId,
          partyId,
          event,
          webhookUrl,
          payload,
          null,
          error.response?.status || 0,
          duration,
          false,
          {
            message: error.message,
            code: error.code,
            stack: error.stack
          }
        );

        // If this is the last attempt, throw the error
        if (attempt === this.retryAttempts) {
          throw new Error(`Webhook failed after ${this.retryAttempts} attempts: ${error.message}`);
        }

        // Wait before retrying (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Send webhook to all parties in a session
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
            result
          });
        } catch (error) {
          results.push({
            partyId: party.partyId,
            success: false,
            error: error.message
          });
        }
      }
    }
    
    return results;
  }

  /**
   * Send session initialization to all parties
   */
  async initializeSession(sessionId, parties, operation, metadata) {
    const payload = {
      operation,
      metadata,
      threshold: parties.length,
      totalParties: parties.length
    };

    return this.broadcastToParties(sessionId, parties, 'session_initialized', payload);
  }

  /**
   * Send share distribution to parties
   */
  async distributeShares(sessionId, parties, shares) {
    const results = [];
    
    for (const party of parties) {
      const share = shares.find(s => s.partyId === party.partyId);
      if (share && party.webhookUrl) {
        try {
          const result = await this.sendWebhook(
            sessionId,
            party.partyId,
            party.webhookUrl,
            'share_received',
            {
              share: share.share,
              commitment: share.commitment,
              nonce: share.nonce
            }
          );
          results.push({
            partyId: party.partyId,
            success: true,
            result
          });
        } catch (error) {
          results.push({
            partyId: party.partyId,
            success: false,
            error: error.message
          });
        }
      }
    }
    
    return results;
  }

  /**
   * Request signature components from parties
   */
  async requestSignature(sessionId, parties, message) {
    const payload = {
      message,
      messageHash: require('crypto').createHash('sha256').update(message).digest('hex')
    };

    return this.broadcastToParties(sessionId, parties, 'signature_requested', payload);
  }

  /**
   * Notify parties of session completion
   */
  async notifySessionComplete(sessionId, parties, result) {
    return this.broadcastToParties(sessionId, parties, 'session_completed', result);
  }

  /**
   * Notify parties of session failure
   */
  async notifySessionFailed(sessionId, parties, error) {
    return this.broadcastToParties(sessionId, parties, 'session_failed', { error: error.message });
  }

  /**
   * Send heartbeat to check party status
   */
  async sendHeartbeat(sessionId, parties) {
    return this.broadcastToParties(sessionId, parties, 'heartbeat', { timestamp: new Date().toISOString() });
  }

  /**
   * Validate webhook signature (for inbound webhooks)
   */
  validateWebhookSignature(headers, body, secret) {
    // In production, implement proper webhook signature validation
    // For PoC, we'll skip this for now
    return true;
  }

  /**
   * Process inbound webhook from a party
   */
  async processInboundWebhook(sessionId, partyId, event, payload, headers) {
    // Log inbound webhook
    await WebhookLog.logInbound(sessionId, partyId, event, payload, headers);
    
    return {
      sessionId,
      partyId,
      event,
      payload,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new WebhookService(); 