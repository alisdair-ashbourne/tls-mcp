import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, interval } from 'rxjs';
import { IndexedDBService } from './indexeddb.service';
import { CryptoService } from './crypto.service';
import { ApiService } from './api.service';

export interface PartyShare {
  sessionId: string;
  partyId: number;
  share: string;
  commitment: string;
  nonce: string;
  receivedAt: Date;
}

export interface PartySession {
  sessionId: string;
  partyId: number;
  status: 'initialized' | 'share_received' | 'ready' | 'completed' | 'failed';
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
    
    console.log(`🎭 Initialized as Party ${partyId} with webhook URL: ${webhookUrl}`);
    
    // Store party configuration in IndexedDB
    await this.indexedDBService.storePartyConfig({
      partyId,
      webhookUrl,
      initializedAt: new Date()
    });
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
            
            // Store the event to avoid reprocessing
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
    
    // Store the webhook event
    await this.indexedDBService.storeWebhookEvent(event);
    
    // Emit the event for UI updates
    this.webhookEvents.next(event);
    
    // Handle different event types
    switch (event.event) {
      case 'session_initialized':
        await this.handleSessionInitialized(event);
        break;
      case 'share_received':
        await this.handleShareReceived(event);
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
   * Handle share received
   */
  private async handleShareReceived(event: WebhookEvent): Promise<void> {
    const { sessionId, payload } = event;
    
    // Store the share
    const share: PartyShare = {
      sessionId,
      partyId: this.partyId!,
      share: payload.share,
      commitment: payload.commitment,
      nonce: payload.nonce,
      receivedAt: new Date()
    };
    
    await this.indexedDBService.storePartyShare(share);
    
    // Update session status
    await this.indexedDBService.updatePartySession(sessionId, this.partyId!, {
      status: 'share_received',
      updatedAt: new Date()
    });
    
    // Send confirmation back to coordinator
    await this.sendResponseToCoordinator(sessionId, 'share_confirmed', {
      share: payload.share,
      confirmed: true
    });
  }

  /**
   * Handle signature request
   */
  private async handleSignatureRequested(event: WebhookEvent): Promise<void> {
    const { sessionId, payload } = event;
    
    // Get the stored share
    const share = await this.indexedDBService.getPartyShare(sessionId, this.partyId!);
    if (!share) {
      throw new Error('No share found for this session');
    }
    
    // Generate signature component (simplified for demo)
    const messageHash = await this.cryptoService.hashMessage(payload.message);
    const component = await this.generateSignatureComponent(share.share, messageHash);
    
    // Send signature component back to coordinator
    await this.sendResponseToCoordinator(sessionId, 'signature_component', {
      component: component,
      messageHash: messageHash,
      message: payload.message
    });
  }

  /**
   * Handle reconstruction request
   */
  private async handleReconstructionRequested(event: WebhookEvent): Promise<void> {
    const { sessionId } = event;
    
    // Get the stored share
    const share = await this.indexedDBService.getPartyShare(sessionId, this.partyId!);
    if (!share) {
      throw new Error('No share found for this session');
    }
    
    // Send share for reconstruction
    await this.sendResponseToCoordinator(sessionId, 'share_provided', {
      share: share.share,
      commitment: share.commitment,
      nonce: share.nonce
    });
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
  }

  /**
   * Handle heartbeat
   */
  private async handleHeartbeat(event: WebhookEvent): Promise<void> {
    const { sessionId } = event;
    
    // Respond to heartbeat
    await this.sendResponseToCoordinator(sessionId, 'heartbeat_response', {
      timestamp: new Date().toISOString(),
      status: 'alive'
    });
  }

  /**
   * Send response back to coordinator
   */
  private async sendResponseToCoordinator(sessionId: string, event: string, payload: any): Promise<void> {
    if (!this.webhookUrl) {
      throw new Error('No webhook URL configured');
    }
    
    const response = {
      sessionId,
      partyId: this.partyId,
      event,
      timestamp: new Date().toISOString(),
      ...payload
    };
    
    try {
      await this.http.post(this.webhookUrl, response).toPromise();
      console.log(`✅ Sent ${event} response to coordinator`);
    } catch (error) {
      console.error(`❌ Failed to send ${event} response:`, error);
      throw error;
    }
  }

  /**
   * Generate signature component (simplified for demo)
   */
  private async generateSignatureComponent(share: string, messageHash: string): Promise<string> {
    // In a real implementation, this would use proper threshold signature algorithms
    const combined = share + messageHash;
    return await this.cryptoService.hashMessage(combined);
  }

  /**
   * Get all party sessions
   */
  async getPartySessions(): Promise<PartySession[]> {
    const sessions = await this.indexedDBService.getAllPartySessions(this.partyId!);
    return sessions.map(session => ({
      ...session,
      status: session.status as 'initialized' | 'share_received' | 'ready' | 'completed' | 'failed'
    }));
  }

  /**
   * Get party shares
   */
  async getPartyShares(): Promise<PartyShare[]> {
    const shares = await this.indexedDBService.getAllPartyShares(this.partyId!);
    return shares.map(share => ({
      sessionId: share.sessionId,
      partyId: share.partyId,
      share: share.share,
      commitment: share.commitment,
      nonce: share.nonce,
      receivedAt: share.receivedAt
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