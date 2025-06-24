import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { FormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { firstValueFrom } from 'rxjs';
import { ApiService, Session, WebhookLog } from '../../services/api.service';
import { CryptoService } from '../../services/crypto.service';
import { IndexedDBService } from '../../services/indexeddb.service';
import { PartyService } from '../../services/party.service';
import { MatDividerModule } from '@angular/material/divider';

@Component({
  selector: 'app-session-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressBarModule,
    MatTableModule,
    MatDividerModule,
    FormsModule,
    RouterLink,
    MatTooltipModule,
    ClipboardModule,
  ],
  templateUrl: './session-detail.component.html',
  styleUrls: ['./session-detail.component.scss']
})
export class SessionDetailComponent implements OnInit, OnDestroy {
  session: Session | null = null;
  webhookLogs: WebhookLog[] = [];
  loading = true;
  loadingLogs = false;
  creatingSignature = false;
  thisPartyId: number | null = null;
  initiatingDkg = false;
  signatureMessage = 'Sign this message to prove ownership.';
  signatureResult: { messageHash: string, status: string } | null = null;
  signatureError: string | null = null;
  displayedColumns = ['timestamp', 'partyId', 'direction', 'event', 'success'];
  partyWalletAddresses = new Map<number, string>(); // Cache for party wallet addresses

  constructor(
    private route: ActivatedRoute,
    private apiService: ApiService,
    private cryptoService: CryptoService,
    private indexedDBService: IndexedDBService,
    private partyService: PartyService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    const sessionId = this.route.snapshot.paramMap.get('id');
    if (sessionId) {
      this.loadAllData(sessionId);
    }
  }

  ngOnDestroy() {
    // Stop polling for webhook events if this user is participating as a party
    if (this.partyService.isActingAsParty()) {
      this.partyService.stopPolling();
      console.log('🛑 Stopped polling for webhook events');
    }
  }

  async loadAllData(sessionId: string) {
    try {
      this.loading = true;
      
      // Load session data - this is critical, so if it fails, we stop
      await this.loadSession(sessionId);
      
      // Load other data in parallel - these are not critical
      await Promise.allSettled([
        this.loadWebhookLogs(sessionId),
        this.loadPartyConfigurations(),
        this.checkAndStartPartyParticipation(sessionId)
      ]);
      
    } catch (error) {
      console.error('Error loading session data:', error);
      this.snackBar.open('Failed to load session data', 'Close', { duration: 3000 });
    } finally {
      this.loading = false;
    }
  }

  async loadSession(sessionId: string) {
    try {
      // Add a timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 10000); // 10 second timeout
      });
      
      const sessionPromise = firstValueFrom(this.apiService.getSession(sessionId));
      const session = await Promise.race([sessionPromise, timeoutPromise]) as Session;
      
      if (session) {
        this.session = session;
        console.log('✅ Session loaded successfully:', session);
      } else {
        throw new Error('Session not found');
      }
    } catch (error: any) {
      console.error('❌ Failed to load session:', error);
      throw new Error(`Failed to load session: ${error.message || 'Unknown error'}`);
    }
  }

  async loadWebhookLogs(sessionId: string) {
    this.loadingLogs = true;
    try {
      // Add a timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 5000); // 5 second timeout
      });
      
      const logsPromise = firstValueFrom(this.apiService.getWebhookLogs(sessionId));
      const logs = await Promise.race([logsPromise, timeoutPromise]) as WebhookLog[];
      
      this.webhookLogs = logs || [];
      console.log('✅ Webhook logs loaded:', this.webhookLogs.length);
    } catch (error: any) {
      console.error('❌ Failed to load webhook logs:', error);
      this.webhookLogs = [];
    } finally {
      this.loadingLogs = false;
    }
  }

  async initiateDkg() {
    if (!this.session) return;
    this.initiatingDkg = true;
    try {
      const blockchain = this.session.metadata?.blockchain;
      const result = await firstValueFrom(this.apiService.initiateDkg(this.session.sessionId, blockchain));
      
      // Reload session to get updated status
      await this.loadSession(this.session.sessionId);
      this.snackBar.open('Distributed key generation initiated! Parties will generate their own shares.', 'Close', { duration: 5000 });
    } catch (error: any) {
      console.error('❌ DKG initiation failed:', error);
      this.snackBar.open(`DKG initiation failed: ${error.message}`, 'Close', { duration: 5000 });
    } finally {
      this.initiatingDkg = false;
    }
  }

  async createSignature() {
    if (!this.session) return;
    this.creatingSignature = true;
    this.signatureError = null;
    this.signatureResult = null;
    try {
      const result = await firstValueFrom(this.apiService.createSignature(this.session.sessionId, this.signatureMessage));
      if (result) {
        this.signatureResult = { 
          messageHash: result.messageHash || '', 
          status: result.status 
        };
        await this.loadSession(this.session.sessionId);
        this.snackBar.open('Threshold signature request sent to all parties!', 'Close', { duration: 3000 });
      }
    } catch (error: any) {
      this.signatureError = error.error?.message || 'Failed to create signature';
      console.error('❌ Failed to create signature:', error);
      this.snackBar.open(`Signature creation failed: ${this.signatureError}`, 'Close', { duration: 5000 });
    } finally {
      this.creatingSignature = false;
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'initialized': return 'accent';
      case 'dkg_initiated': return 'primary';
      case 'dkg_completed': return 'primary';
      case 'signing_in_progress': return 'warn';
      case 'signature_completed': return 'primary';
      case 'failed': return 'warn';
      default: return 'primary';
    }
  }

  getOperationColor(operation: string): string {
    switch (operation) {
      case 'key_generation': return 'primary';
      case 'signature': return 'warn';
      default: return 'primary';
    }
  }

  getPartyStatusIcon(status: string): string {
    switch (status) {
      case 'pending': return 'schedule';
      case 'share_committed': return 'lock';
      case 'ready': return 'check_circle';
      case 'connected': return 'wifi';
      case 'completed': return 'check_circle';
      case 'failed': return 'error';
      default: return 'help';
    }
  }

  getPartyStatusColor(status: string): string {
    switch (status) {
      case 'pending': return 'accent';
      case 'share_committed': return 'primary';
      case 'ready': return 'primary';
      case 'connected': return 'primary';
      case 'completed': return 'primary';
      case 'failed': return 'warn';
      default: return 'primary';
    }
  }

  getPartyWalletAddress(partyId: number): string | null {
    // Return the cached wallet address if available
    return this.partyWalletAddresses.get(partyId) || null;
  }

  /**
   * Load party configurations and their wallet addresses
   */
  async loadPartyConfigurations() {
    if (!this.session) return;
    
    try {
      // Load wallet addresses for all parties in the session
      for (const party of this.session.parties) {
        try {
          const config = await this.indexedDBService.getPartyConfig(party.partyId);
          if (config && config.walletAddress) {
            this.partyWalletAddresses.set(party.partyId, config.walletAddress);
          }
        } catch (error) {
          console.warn(`Could not load party config for party ${party.partyId}:`, error);
          // Continue loading other party configs even if one fails
        }
      }
    } catch (error) {
      console.error('Error loading party configurations:', error);
      // Don't throw here - this is not critical for the session to load
    }
  }

  /**
   * Check if this user is participating as a party and start polling if needed
   */
  async checkAndStartPartyParticipation(sessionId: string) {
    if (this.partyService.isActingAsParty()) {
      this.thisPartyId = this.partyService.getCurrentPartyId();
      console.log(`🎭 User is participating as Party ${this.thisPartyId} in session ${sessionId}`);
      
      // Start polling for webhook events
      this.partyService.startPollingForSession(sessionId);
      
      // Subscribe to webhook events for UI updates
      this.partyService.getWebhookEvents().subscribe(event => {
        console.log(`📡 Received webhook event in UI:`, event);
        // You can add UI updates here based on webhook events
      });
    } else {
      console.log('👤 User is not participating as a party in this session');
    }
  }

  /**
   * Handle copy success feedback
   */
  onCopySuccess() {
    this.snackBar.open('Wallet address copied to clipboard!', 'Close', { duration: 2000 });
  }
} 