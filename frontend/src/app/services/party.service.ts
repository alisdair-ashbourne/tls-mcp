import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, firstValueFrom, interval } from 'rxjs';
import {
  IndexedDBService,
  WalletReconstructionData,
} from './indexeddb.service';
import { CryptoService, WalletReconstruction } from './crypto.service';
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
  walletAddress?: string;
  shareCommitment?: string;
}

export interface WebhookEvent {
  sessionId: string;
  partyId: number;
  event: string;
  timestamp: string;
  payload: any;
}

@Injectable({
  providedIn: 'root',
})
export class PartyService {
  private partyId: number | null = null;
  private webhookUrl: string | null = null;
  private webhookEvents = new Subject<WebhookEvent>();
  private pollingInterval: any = null;
  private currentSessionId: string | null = null;
  private walletAddress: string | null = null;

  constructor(
    private http: HttpClient,
    private indexedDBService: IndexedDBService,
    private cryptoService: CryptoService,
    private apiService: ApiService
  ) {}

  /**
   * Initialize this frontend as a party with enhanced TSS MCP security
   */
  async initializeAsParty(
    partyId: number,
    webhookUrl: string,
    sessionId?: string
  ): Promise<void> {
    this.partyId = partyId;
    this.webhookUrl = webhookUrl;
    this.currentSessionId = sessionId || null;

    // Generate deterministic wallet address for threshold operations
    if (sessionId) {
      const walletAddress = this.generateDeterministicWalletAddress(
        sessionId,
        partyId
      );
      this.walletAddress = walletAddress;
    } else {
      // Fallback to random address if no session
      this.walletAddress = this.cryptoService.generateThresholdWalletAddress();
    }

    console.log(
      `🎭 Initialized as Party ${partyId} with webhook URL: ${webhookUrl}`
    );
    console.log(`💰 Generated wallet address: ${this.walletAddress}`);

    // Store party configuration in IndexedDB (non-sensitive)
    await this.indexedDBService.storePartyConfig({
      partyId,
      webhookUrl,
      walletAddress: this.walletAddress,
      initializedAt: new Date(),
      sessionId: sessionId,
    });

    // Only register with coordinator if this is not a browser party
    if (!webhookUrl.startsWith('browser://')) {
      await this.registerWithCoordinator(
        partyId,
        webhookUrl,
        this.walletAddress
      );
    } else {
      console.log(
        `🌐 Browser party ${partyId} - skipping coordinator registration`
      );
    }

    // Ensure database health after party initialization
    await this.indexedDBService.ensureDatabaseHealth();
  }

  /**
   * Generate deterministic wallet address for a party in a specific session
   */
  private generateDeterministicWalletAddress(
    sessionId: string,
    partyId: number
  ): string {
    // Generate deterministic share for this party/session combination
    const share = this.cryptoService.generateDeterministicShare(
      partyId,
      sessionId
    );

    // Derive wallet address from the share
    const walletAddress = this.cryptoService.deriveAddressFromShare(share);

    console.log(
      `✅ Generated deterptoServministic wallet address for Party ${partyId} in session ${sessionId}: ${walletAddress}`
    );

    return walletAddress;
  }

  /**
   * Register this party with the coordinator
   */
  private async registerWithCoordinator(
    partyId: number,
    webhookUrl: string,
    walletAddress: string
  ): Promise<void> {
    try {
      // Send registration directly to coordinator's registration endpoint
      const registrationData = {
        partyId,
        webhookUrl,
        walletAddress,
        timestamp: new Date().toISOString(),
      };

      // Use the API service to register with coordinator
      await this.apiService.registerParty(registrationData).toPromise();

      console.log(`✅ Party ${partyId} registered with coordinator`);
    } catch (error) {
      console.error(
        `❌ Failed to register party ${partyId} with coordinator:`,
        error
      );
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

    console.log(
      `🔄 Started polling for webhook events in session ${sessionId}`
    );
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
      const events = await firstValueFrom(
        this.apiService.getWebhookEvents(sessionId, this.partyId)
      );

      if (events) {
        for (const event of events) {
          // Check if we've already processed this event by timestamp
          const existingEvents =
            await this.indexedDBService.getPartyWebhookEvents(this.partyId!);

          const alreadyProcessed = existingEvents.some(
            (e) =>
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
              payload: event.payload,
            });

            // Store the event to avoid reprocessing (for audit/debugging)
            await this.indexedDBService.storeWebhookEvent({
              sessionId,
              partyId: this.partyId,
              event: event.event,
              timestamp: event.timestamp,
              payload: event.payload,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error polling for webhook events:', error);
    }
  }

  /**
   * Creates a new session with the specified parameters
   */
  async createSession(
    sessionId: string,
    totalParties: number,
    threshold?: number
  ): Promise<void> {
    if (!this.partyId) {
      throw new Error('Party not initialized');
    }

    const sessionThreshold = threshold || Math.ceil(totalParties / 2);

    const session: PartySession = {
      sessionId,
      partyId: this.partyId,
      status: 'initialized',
      operation: 'session_created',
      metadata: {
        createdBy: this.partyId,
        threshold: sessionThreshold,
      },
      threshold: sessionThreshold,
      totalParties,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store session in IndexedDB
    await this.indexedDBService.storeSession({
      sessionId,
      status: 'initialized',
      operation: 'session_created',
      metadata: {
        createdBy: this.partyId,
        threshold: sessionThreshold,
        totalParties: totalParties,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      threshold: sessionThreshold,
      totalParties: totalParties,
      participatingParties: [this.partyId],
    });

    console.log(`✅ Created session ${sessionId} with ${totalParties} parties`);
  }

  /**
   * Get the current party ID
   */
  getCurrentPartyId(): number | null {
    return this.partyId;
  }

  /**
   * Get the current wallet address
   */
  getCurrentWalletAddress(): string | null {
    return this.walletAddress;
  }

  /**
   * Check if this frontend is acting as a party
   */
  isActingAsParty(): boolean {
    return this.partyId !== null;
  }

  /**
   * Enhanced webhook event handler with TSS MCP security features
   */
  async handleWebhookEvent(event: WebhookEvent): Promise<void> {
    console.log(
      `📨 Processing webhook event: ${event.event} for Party ${event.partyId}`
    );

    try {
      // Emit the event to subscribers
      this.webhookEvents.next(event);

      // Update session tracking in IndexedDB
      await this.updateSessionTracking(event);

      // Handle specific event types
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
          console.log(`ℹ️ Unhandled event type: ${event.event}`);
      }
    } catch (error) {
      console.error(`❌ Error handling webhook event ${event.event}:`, error);
    }
  }

  /**
   * Update session tracking information
   */
  private async updateSessionTracking(event: WebhookEvent): Promise<void> {
    if (!this.partyId) return;

    try {
      // Update party session data
      const newStatus = this.getStatusFromEvent(event.event);
      await this.indexedDBService.updatePartySession(
        event.sessionId,
        this.partyId,
        {
          status: newStatus as
            | 'initialized'
            | 'share_committed'
            | 'ready'
            | 'completed'
            | 'failed',
          updatedAt: new Date(),
        }
      );

      // Update main session data if we have the information
      await this.indexedDBService.updateSession({
        sessionId: event.sessionId,
        status: this.getStatusFromEvent(event.event),
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('❌ Error updating session tracking:', error);
    }
  }

  /**
   * Map event types to session status
   */
  private getStatusFromEvent(eventType: string): string {
    switch (eventType) {
      case 'session_initialized':
        return 'initialized';
      case 'dkg_initiated':
      case 'signature_requested':
      case 'reconstruction_requested':
        return 'processing';
      case 'session_completed':
        return 'completed';
      case 'session_failed':
        return 'failed';
      default:
        return 'active';
    }
  }

  /**
   * Get webhook events observable
   */
  getWebhookEvents(): Observable<WebhookEvent> {
    return this.webhookEvents.asObservable();
  }

  private async handleSessionInitialized(event: WebhookEvent): Promise<void> {
    console.log(
      `🎬 Session ${event.sessionId} initialized for Party ${event.partyId}`
    );

    if (!this.partyId) return;

    // Store session information in IndexedDB
    await this.indexedDBService.storePartySession({
      sessionId: event.sessionId,
      partyId: this.partyId,
      status: 'initialized',
      operation: event.payload.operation || 'unknown',
      metadata: event.payload,
      threshold: event.payload.threshold || 3,
      totalParties: event.payload.totalParties || 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Send acknowledgment to coordinator
    await this.sendResponseToCoordinator(
      event.sessionId,
      'session_acknowledged',
      {
        partyId: this.partyId,
        status: 'ready',
        walletAddress: this.walletAddress,
        timestamp: new Date().toISOString(),
      }
    );
  }

  private async handleDKGInitiated(event: WebhookEvent): Promise<void> {
    console.log(
      `🔑 DKG initiated for Party ${event.partyId} in session ${event.sessionId}`
    );

    if (!this.partyId) return;

    try {
      // Generate deterministic share for this session
      const share = this.cryptoService.generateDeterministicShare(
        this.partyId,
        event.sessionId // Use sessionId as sharedSeed
      );

      // Generate commitment to the share (don't reveal the share itself)
      const commitment = this.cryptoService.generateShareCommitment(
        share,
        event.sessionId,
        this.partyId
      );

      // Update party session with commitment
      await this.indexedDBService.updatePartySession(
        event.sessionId,
        this.partyId,
        {
          status: 'share_committed',
          shareCommitment: commitment,
          updatedAt: new Date(),
        }
      );

      // Send commitment to coordinator (never send actual share)
      await this.sendResponseToCoordinator(event.sessionId, 'share_committed', {
        partyId: this.partyId,
        commitment: commitment,
        timestamp: new Date().toISOString(),
        // Note: Never include the actual share in network communications
      });

      console.log(`✅ Share commitment sent for Party ${this.partyId}`);
    } catch (error) {
      console.error(`❌ Error in DKG for Party ${this.partyId}:`, error);

      // Send failure response
      await this.sendResponseToCoordinator(event.sessionId, 'dkg_failed', {
        partyId: this.partyId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  private async handleSignatureRequested(event: WebhookEvent): Promise<void> {
    console.log(
      `✍️ Signature requested for Party ${event.partyId} in session ${event.sessionId}`
    );

    if (!this.partyId) return;

    try {
      const messageToSign = event.payload.message;
      if (!messageToSign) {
        throw new Error('No message provided for signing');
      }

      // Get the share for this session
      const share = this.cryptoService.generateDeterministicShare(
        this.partyId,
        event.sessionId
      );

      // Generate signature component using the share
      const messageHash = await this.cryptoService.hashMessage(messageToSign);
      const signatureComponent = await this.generateSignatureComponent(
        share,
        messageHash
      );

      // Send signature component to coordinator
      await this.sendResponseToCoordinator(
        event.sessionId,
        'signature_provided',
        {
          partyId: this.partyId,
          signatureComponent,
          messageHash,
          timestamp: new Date().toISOString(),
        }
      );

      console.log(`✅ Signature component provided for Party ${this.partyId}`);
    } catch (error) {
      console.error(
        `❌ Error generating signature for Party ${this.partyId}:`,
        error
      );

      await this.sendResponseToCoordinator(
        event.sessionId,
        'signature_failed',
        {
          partyId: this.partyId,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        }
      );
    }
  }

  /**
   * Enhanced reconstruction handler with wallet restoration
   */
  private async handleReconstructionRequested(
    event: WebhookEvent
  ): Promise<void> {
    console.log(
      `🔄 Reconstruction requested for Party ${event.partyId} in session ${event.sessionId}`
    );

    if (!this.partyId) return;

    try {
      // Get the share for this session
      const share = this.cryptoService.generateDeterministicShare(
        this.partyId,
        event.sessionId
      );

      // Provide share for reconstruction
      await this.sendResponseToCoordinator(event.sessionId, 'share_provided', {
        partyId: this.partyId,
        share: share, // Only for reconstruction - normally shares are never transmitted
        timestamp: new Date().toISOString(),
      });

      // Attempt local wallet reconstruction if we have enough information
      await this.attemptWalletReconstruction(event.sessionId);

      console.log(
        `✅ Share provided for reconstruction by Party ${this.partyId}`
      );
    } catch (error) {
      console.error(
        `❌ Error in reconstruction for Party ${this.partyId}:`,
        error
      );

      await this.sendResponseToCoordinator(
        event.sessionId,
        'reconstruction_failed',
        {
          partyId: this.partyId,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        }
      );
    }
  }

  /**
   * Attempt to reconstruct wallet from available shares
   */
  private async attemptWalletReconstruction(sessionId: string): Promise<void> {
    try {
      // Get all webhook events for this session to find shared shares
      const sessionEvents =
        await this.indexedDBService.getSessionWebhookEvents(sessionId);

      // Find share_provided events
      const shareEvents = sessionEvents.filter(
        (e) => e.event === 'share_provided'
      );

      if (shareEvents.length >= 2) {
        // Need at least 2 shares for demo
        // Extract shares from events
        const shares = shareEvents.map((e) => ({
          partyId: e.payload.partyId,
          share: e.payload.share,
        }));

        // Add our own share
        if (this.partyId !== null) {
          shares.push({
            partyId: this.partyId,
            share: this.cryptoService.generateDeterministicShare(
              this.partyId,
              sessionId
            ),
          });
        }

        // Reconstruct wallet
        const reconstruction = this.cryptoService.reconstructWalletFromShares(
          shares,
          sessionId
        );

        // Store reconstruction in IndexedDB
        await this.indexedDBService.storeWalletReconstruction({
          sessionId,
          walletAddress: reconstruction.walletAddress,
          publicKey: reconstruction.publicKey,
          reconstructionTimestamp: reconstruction.reconstructionTimestamp,
          participatingParties: reconstruction.participatingParties,
          threshold: shares.length,
          verified: true,
        });

        // Update session with reconstructed wallet address
        await this.indexedDBService.updateSession({
          sessionId,
          walletAddress: reconstruction.walletAddress,
          status: 'completed',
        });

        console.log(
          `🎉 Wallet successfully reconstructed for session ${sessionId}: ${reconstruction.walletAddress}`
        );
      }
    } catch (error) {
      console.error(`❌ Error attempting wallet reconstruction:`, error);
    }
  }

  private async handleSessionCompleted(event: WebhookEvent): Promise<void> {
    console.log(
      `✅ Session ${event.sessionId} completed for Party ${event.partyId}`
    );

    if (!this.partyId) return;

    // Update session status
    await this.indexedDBService.updatePartySession(
      event.sessionId,
      this.partyId,
      {
        status: 'completed',
        updatedAt: new Date(),
      }
    );

    // Stop polling for this session
    if (this.currentSessionId === event.sessionId) {
      this.stopPolling();
    }
  }

  private async handleSessionFailed(event: WebhookEvent): Promise<void> {
    console.log(
      `❌ Session ${event.sessionId} failed for Party ${event.partyId}`
    );

    if (!this.partyId) return;

    // Update session status
    await this.indexedDBService.updatePartySession(
      event.sessionId,
      this.partyId,
      {
        status: 'failed',
        updatedAt: new Date(),
      }
    );

    // Stop polling for this session
    if (this.currentSessionId === event.sessionId) {
      this.stopPolling();
    }
  }

  private async handleHeartbeat(event: WebhookEvent): Promise<void> {
    // Respond to heartbeat to show we're alive
    await this.sendResponseToCoordinator(
      event.sessionId,
      'heartbeat_response',
      {
        partyId: this.partyId,
        status: 'active',
        timestamp: new Date().toISOString(),
      }
    );
  }

  /**
   * Send response to coordinator
   */
  private async sendResponseToCoordinator(
    sessionId: string,
    event: string,
    payload: any
  ): Promise<void> {
    try {
      // Don't send response if partyId is null
      if (this.partyId === null) {
        console.warn('Cannot send response to coordinator: partyId is null');
        return;
      }

      const response = {
        sessionId,
        partyId: this.partyId,
        event,
        payload,
        timestamp: new Date().toISOString(),
      };

      // Use API service to send response
      await this.apiService.sendPartyResponse(response).toPromise();

      console.log(`📤 Response sent to coordinator: ${event}`);
    } catch (error) {
      console.error(`❌ Failed to send response to coordinator:`, error);
      // Don't rethrow - this is not critical for party operation
    }
  }

  /**
   * Generate a fresh share for DKG (deterministic based on session)
   */
  private async generateFreshShare(): Promise<string> {
    if (!this.currentSessionId || this.partyId === null) {
      throw new Error('No active session or party ID');
    }

    return this.cryptoService.generateDeterministicShare(
      this.partyId,
      this.currentSessionId
    );
  }

  /**
   * Generate commitment to a share
   */
  private async generateCommitment(share: string): Promise<string> {
    if (!this.currentSessionId || this.partyId === null) {
      throw new Error('No active session or party ID');
    }

    return this.cryptoService.generateShareCommitment(
      share,
      this.currentSessionId,
      this.partyId
    );
  }

  /**
   * Generate a cryptographic nonce
   */
  private async generateNonce(): Promise<string> {
    // Generate random nonce for signatures
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(randomBytes, (byte) =>
      byte.toString(16).padStart(2, '0')
    ).join('');
  }

  /**
   * Generate signature component using share and message hash
   */
  private async generateSignatureComponent(
    share: string,
    messageHash: string
  ): Promise<string> {
    // In a real TSS implementation, this would use proper threshold signature algorithms
    // For demo purposes, we'll create a deterministic signature component
    const combinedData = `${share}-${messageHash}`;
    const signatureHash = await this.cryptoService.hashMessage(combinedData);
    return signatureHash;
  }

  /**
   * Get party sessions with enhanced information
   */
  async getPartySessions(): Promise<PartySession[]> {
    if (!this.partyId) return [];

    try {
      const sessions = await this.indexedDBService.getAllPartySessions(
        this.partyId
      );
      return sessions.map((session) => ({
        sessionId: session.sessionId,
        partyId: session.partyId,
        status: session.status,
        operation: session.operation,
        metadata: session.metadata,
        threshold: session.threshold,
        totalParties: session.totalParties,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        walletAddress: session.walletAddress,
        shareCommitment: session.shareCommitment,
      }));
    } catch (error) {
      console.error('❌ Error getting party sessions:', error);
      return [];
    }
  }

  /**
   * Get wallet reconstructions for this party's sessions
   */
  async getWalletReconstructions(): Promise<WalletReconstructionData[]> {
    try {
      return await this.indexedDBService.getAllWalletReconstructions();
    } catch (error) {
      console.error('❌ Error getting wallet reconstructions:', error);
      return [];
    }
  }

  /**
   * Regenerate wallet address for a specific session
   */
  async regenerateWalletAddress(sessionId: string): Promise<string | null> {
    try {
      // Try to regenerate from crypto service first
      const regeneratedAddress =
        this.cryptoService.regenerateWalletAddress(sessionId);

      if (regeneratedAddress) {
        // Update session with regenerated address
        await this.indexedDBService.updateSession({
          sessionId,
          walletAddress: regeneratedAddress,
        });

        return regeneratedAddress;
      }

      // If no local shares, try to regenerate from deterministic method
      if (this.partyId !== null) {
        const address = this.generateDeterministicWalletAddress(
          sessionId,
          this.partyId
        );

        // Update session with regenerated address
        await this.indexedDBService.updateSession({
          sessionId,
          walletAddress: address,
        });

        return address;
      }

      return null;
    } catch (error) {
      console.error('❌ Error regenerating wallet address:', error);
      return null;
    }
  }

  /**
   * Get party webhook events
   */
  async getPartyWebhookEvents(): Promise<WebhookEvent[]> {
    if (!this.partyId) return [];

    try {
      const events = await this.indexedDBService.getPartyWebhookEvents(
        this.partyId
      );

      return events.map((event) => ({
        sessionId: event.sessionId,
        partyId: event.partyId,
        event: event.event,
        timestamp: event.timestamp,
        payload: event.payload,
      }));
    } catch (error) {
      console.error('❌ Error getting party webhook events:', error);
      return [];
    }
  }

  /**
   * Clear all cryptographic material for security
   */
  async clearCryptographicMaterial(): Promise<void> {
    this.cryptoService.clearAllCryptographicMaterial();
    console.log('🔒 All cryptographic material cleared for security');
  }
}
