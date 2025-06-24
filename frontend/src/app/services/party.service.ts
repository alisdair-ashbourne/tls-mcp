import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, interval } from 'rxjs';
import { IndexedDBService } from './indexeddb.service';
import { CryptoService } from './crypto.service';
import { ApiService } from './api.service';

export interface PartySession {
  sessionId: string;
  partyId: number;
  status: 'initialized' | 'share_committed' | 'ready' | 'completed' | 'failed';
  operation: string;
  metadata: any;
  threshold: number;
  totalParties: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookEvent {
  sessionId: string;
  partyId: number;
  event: string;
  timestamp: string;
  payload: any;
}

@Injectable({
  providedIn: 'root'
})
export class PartyService {
  private partyId: number | null = null;
  private webhookUrl: string | null = null;
  private webhookEvents = new Subject<WebhookEvent>();
  private pollingInterval: any = null;
  private currentSessionId: string | null = null;

  constructor(
    private http: HttpClient,
    private indexedDBService: IndexedDBService,
    private cryptoService: CryptoService,
    private apiService: ApiService
  ) {}

  /**
   * Initialize this frontend as a party
   */
  async initializeAsParty(partyId: number, webhookUrl: string): Promise<void> {
    this.partyId = partyId;
    this.webhookUrl = webhookUrl;
    
    // Generate a wallet address for this party's participation
    const walletAddress = this.cryptoService.generateThresholdWalletAddress();
    
    console.log(`🎭 Initialized as Party ${partyId} with webhook URL: ${webhookUrl}`);
    console.log(`💰 Generated wallet address: ${walletAddress}`);
    
    // Store party configuration in IndexedDB (non-sensitive)
    await this.indexedDBService.storePartyConfig({
      partyId,
      webhookUrl,
      walletAddress,
      initializedAt: new Date()
    });

    // Only register with coordinator if this is not a browser party
    if (!webhookUrl.startsWith('browser://')) {
      await this.registerWithCoordinator(partyId, webhookUrl, walletAddress);
    } else {
      console.log(`🌐 Browser party ${partyId} - skipping coordinator registration`);
    }
  }

  /**
   * Register this party with the coordinator
   */
  private async registerWithCoordinator(partyId: number, webhookUrl: string, walletAddress: string): Promise<void> {
    try {
      // Send registration directly to coordinator's registration endpoint
      const registrationData = {
        partyId,
        webhookUrl,
        walletAddress,
        timestamp: new Date().toISOString()
      };
      
      // Use the API service to register with coordinator
      await this.apiService.registerParty(registrationData).toPromise();
      
      console.log(`✅ Party ${partyId} registered with coordinator`);
    } catch (error) {
      console.error(`❌ Failed to register party ${partyId} with coordinator:`, error);
      // Don't throw here - party can still function without coordinator registration
    }
  }

  /**
   * Start polling for webhook events for a specific session
   */
  startPollingForSession(sessionId: string): void {
    this.currentSessionId = sessionId;
    
    // Stop any existing polling
    this.stopPolling();
    
    // Start polling every 2 seconds
    this.pollingInterval = interval(2000).subscribe(() => {
      this.pollForWebhookEvents(sessionId);
    });
    
    console.log(`🔄 Started polling for webhook events in session ${sessionId}`);
  }

  /**
   * Stop polling for webhook events
   */
  stopPolling(): void {
    if (this.pollingInterval) {
      this.pollingInterval.unsubscribe();
      this.pollingInterval = null;
      console.log(`⏹️ Stopped polling for webhook events`);
    }
  }

  /**
   * Poll for webhook events
   */
  private async pollForWebhookEvents(sessionId: string): Promise<void> {
    if (!this.partyId || !this.currentSessionId) return;
    
    try {
      const events = await this.apiService.getWebhookEvents(sessionId, this.partyId).toPromise();
      
      if (events) {
        for (const event of events) {
          // Check if we've already processed this event by timestamp
          const existingEvents = await this.indexedDBService.getPartyWebhookEvents(this.partyId!);
          const alreadyProcessed = existingEvents.some(e => 
            e.sessionId === sessionId && 
            e.partyId === this.partyId && 
            e.timestamp === event.timestamp
          );
          
          if (!alreadyProcessed) {
            // Process the new event
            await this.handleWebhookEvent({
              sessionId,
              partyId: this.partyId,
              event: event.event,
              timestamp: event.timestamp,
              payload: event.payload
            });
            
            // Store the event to avoid reprocessing (for audit/debugging)
            await this.indexedDBService.storeWebhookEvent({
              sessionId,
              partyId: this.partyId,
              event: event.event,
              timestamp: event.timestamp,
              payload: event.payload
            });
          }
        }
      }
    } catch (error) {
      console.error('Error polling for webhook events:', error);
    }
  }

  /**
   * Get the current party ID
   */
  getCurrentPartyId(): number | null {
    return this.partyId;
  }

  /**
   * Check if this frontend is acting as a party
   */
  isActingAsParty(): boolean {
    return this.partyId !== null;
  }

  /**
   * Handle incoming webhook events
   */
  async handleWebhookEvent(event: WebhookEvent): Promise<void> {
    console.log(`📡 Party ${this.partyId} received webhook:`, event);
    
    // Emit the event for UI updates
    this.webhookEvents.next(event);
    
    // Handle different event types
    switch (event.event) {
      case 'session_initialized':
        await this.handleSessionInitialized(event);
        break;
      case 'dkg_initiated':
        await this.handleDKGInitiated(event);
        break;
      case 'signature_requested':
        await this.handleSignatureRequested(event);
        break;
      case 'reconstruction_requested':
        await this.handleReconstructionRequested(event);
        break;
      case 'session_completed':
        await this.handleSessionCompleted(event);
        break;
      case 'session_failed':
        await this.handleSessionFailed(event);
        break;
      case 'heartbeat':
        await this.handleHeartbeat(event);
        break;
      default:
        console.warn(`Unknown webhook event: ${event.event}`);
    }
  }

  /**
   * Get webhook events as observable
   */
  getWebhookEvents(): Observable<WebhookEvent> {
    return this.webhookEvents.asObservable();
  }

  /**
   * Handle session initialization
   */
  private async handleSessionInitialized(event: WebhookEvent): Promise<void> {
    const { sessionId, payload } = event;
    
    // Store session metadata (non-sensitive)
    const session: PartySession = {
      sessionId,
      partyId: this.partyId!,
      status: 'initialized',
      operation: payload.operation,
      metadata: payload.metadata,
      threshold: payload.threshold,
      totalParties: payload.totalParties,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await this.indexedDBService.storePartySession(session);
    
    // Send confirmation back to coordinator
    await this.sendResponseToCoordinator(sessionId, 'session_confirmed', {
      partyId: this.partyId,
      confirmed: true
    });
  }

  /**
   * Handle DKG initiation - generate fresh share and commitment
   */
  private async handleDKGInitiated(event: WebhookEvent): Promise<void> {
    const { sessionId, payload } = event;
    
    console.log(`🔐 Party ${this.partyId} generating fresh share for DKG...`);
    
    // Generate fresh cryptographic material (NOT stored in IndexedDB)
    const share = await this.generateFreshShare();
    const commitment = await this.generateCommitment(share);
    const nonce = await this.generateNonce();
    
    // Update session status to indicate share commitment
    await this.indexedDBService.updatePartySession(sessionId, this.partyId!, {
      status: 'share_committed',
      updatedAt: new Date()
    });
    
    // Send share commitment to coordinator (NOT the actual share)
    await this.sendResponseToCoordinator(sessionId, 'share_committed', {
      partyId: this.partyId,
      commitment: commitment,
      nonce: nonce,
      // Note: We do NOT send the actual share here
      // The share will only be used locally for signatures/reconstruction when requested
    });
    
    console.log(`✅ Party ${this.partyId} committed share for session ${sessionId}`);
  }

  /**
   * Handle signature request - generate signature component using fresh share
   */
  private async handleSignatureRequested(event: WebhookEvent): Promise<void> {
    const { sessionId, payload } = event;
    
    console.log(`✍️ Party ${this.partyId} generating signature component...`);
    
    // Generate fresh share for this signature (NOT stored)
    const share = await this.generateFreshShare();
    
    // Generate signature component
    const messageHash = await this.cryptoService.hashMessage(payload.message);
    const component = await this.generateSignatureComponent(share, messageHash);
    
    // Send signature component back to coordinator
    await this.sendResponseToCoordinator(sessionId, 'signature_component', {
      partyId: this.partyId,
      component: component,
      messageHash: messageHash,
      message: payload.message
    });
    
    console.log(`✅ Party ${this.partyId} sent signature component for session ${sessionId}`);
  }

  /**
   * Handle reconstruction request - provide share for reconstruction
   */
  private async handleReconstructionRequested(event: WebhookEvent): Promise<void> {
    const { sessionId } = event;
    
    console.log(`🔧 Party ${this.partyId} providing share for reconstruction...`);
    
    // Generate fresh share for reconstruction (NOT stored)
    const share = await this.generateFreshShare();
    const commitment = await this.generateCommitment(share);
    const nonce = await this.generateNonce();
    
    // Send share for reconstruction
    await this.sendResponseToCoordinator(sessionId, 'share_provided', {
      partyId: this.partyId,
      share: share,
      commitment: commitment,
      nonce: nonce
    });
    
    console.log(`✅ Party ${this.partyId} provided share for reconstruction in session ${sessionId}`);
  }

  /**
   * Handle session completion
   */
  private async handleSessionCompleted(event: WebhookEvent): Promise<void> {
    const { sessionId, payload } = event;
    
    await this.indexedDBService.updatePartySession(sessionId, this.partyId!, {
      status: 'completed',
      updatedAt: new Date()
    });
    
    console.log(`✅ Session ${sessionId} completed for Party ${this.partyId}`);
  }

  /**
   * Handle session failure
   */
  private async handleSessionFailed(event: WebhookEvent): Promise<void> {
    const { sessionId, payload } = event;
    
    await this.indexedDBService.updatePartySession(sessionId, this.partyId!, {
      status: 'failed',
      updatedAt: new Date()
    });
    
    console.log(`❌ Session ${sessionId} failed for Party ${this.partyId}`);
  }

  /**
   * Handle heartbeat
   */
  private async handleHeartbeat(event: WebhookEvent): Promise<void> {
    const { sessionId } = event;
    
    // Respond to heartbeat
    await this.sendResponseToCoordinator(sessionId, 'heartbeat_response', {
      partyId: this.partyId,
      timestamp: new Date().toISOString(),
      status: 'alive'
    });
  }

  /**
   * Send response back to coordinator
   */
  private async sendResponseToCoordinator(sessionId: string, event: string, payload: any): Promise<void> {
    if (!this.partyId) {
      throw new Error('No party ID configured');
    }
    
    const response = {
      sessionId,
      partyId: this.partyId,
      event,
      timestamp: new Date().toISOString(),
      ...payload
    };
    
    try {
      // Send response to coordinator's webhook endpoint
      await this.http.post(`http://localhost:3000/api/webhook/${sessionId}/${this.partyId}`, response).toPromise();
      console.log(`✅ Sent ${event} response to coordinator`);
    } catch (error) {
      console.error(`❌ Failed to send ${event} response:`, error);
      throw error;
    }
  }

  // ===== CRYPTOGRAPHIC OPERATIONS (Fresh generation, no storage) =====

  /**
   * Generate a fresh cryptographic share
   * In a real implementation, this would use proper threshold cryptography algorithms
   */
  private async generateFreshShare(): Promise<string> {
    // Generate a random 32-byte share
    const shareBytes = crypto.getRandomValues(new Uint8Array(32));
    return `0x${Array.from(shareBytes).map(b => b.toString(16).padStart(2, '0')).join('')}`;
  }

  /**
   * Generate a commitment for a share
   */
  private async generateCommitment(share: string): Promise<string> {
    // In a real implementation, this would be a proper cryptographic commitment
    // For demo purposes, we'll use a hash of the share
    return await this.cryptoService.hashMessage(share);
  }

  /**
   * Generate a fresh nonce
   */
  private async generateNonce(): Promise<string> {
    const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
    return `0x${Array.from(nonceBytes).map(b => b.toString(16).padStart(2, '0')).join('')}`;
  }

  /**
   * Generate signature component (simplified for demo)
   */
  private async generateSignatureComponent(share: string, messageHash: string): Promise<string> {
    // In a real implementation, this would use proper threshold signature algorithms
    const combined = share + messageHash;
    return await this.cryptoService.hashMessage(combined);
  }

  // ===== DATA RETRIEVAL METHODS =====

  /**
   * Get all party sessions
   */
  async getPartySessions(): Promise<PartySession[]> {
    const sessions = await this.indexedDBService.getAllPartySessions(this.partyId!);
    return sessions.map(session => ({
      sessionId: session.sessionId,
      partyId: session.partyId,
      status: session.status as 'initialized' | 'share_committed' | 'ready' | 'completed' | 'failed',
      operation: session.operation,
      metadata: session.metadata,
      threshold: session.threshold,
      totalParties: session.totalParties,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    }));
  }

  /**
   * Get party webhook events
   */
  async getPartyWebhookEvents(): Promise<WebhookEvent[]> {
    const events = await this.indexedDBService.getPartyWebhookEvents(this.partyId!);
    return events.map(event => ({
      sessionId: event.sessionId,
      partyId: event.partyId,
      event: event.event,
      timestamp: event.timestamp,
      payload: event.payload
    }));
  }
} 