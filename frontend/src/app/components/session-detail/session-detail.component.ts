import { ClipboardModule } from '@angular/cdk/clipboard';
import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ApiService, Session, WebhookLog } from '../../services/api.service';
import {
  IndexedDBService,
  WalletReconstructionData,
} from '../../services/indexeddb.service';
import { PartyService } from '../../services/party.service';
import {
  CryptoService,
  WalletReconstruction,
} from '../../services/crypto.service';

@Component({
  imports: [
    ClipboardModule,
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatDividerModule,
    MatExpansionModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTabsModule,
    MatTooltipModule,
    RouterLink,
  ],
  selector: 'app-session-detail',
  standalone: true,
  styleUrls: ['./session-detail.component.scss'],
  templateUrl: './session-detail.component.html',
})
export class SessionDetailComponent implements OnInit, OnDestroy {
  creatingSignature = false;
  displayedColumns = ['timestamp', 'partyId', 'direction', 'event', 'success']; // For webhook logs
  partiesColumns = ['party', 'status', 'lastSeen']; // For parties table
  initiatingDkg = false;
  loading = true;
  loadingLogs = false;
  partyWalletAddresses = new Map<number, string>(); // Cache for party wallet addresses
  reconstructingKey = false;
  reconstructionError: string | null = null;
  reconstructionResult: {
    walletAddress: string;
    sharesCount: number;
    status: string;
  } | null = null;
  session: Session | null = null;
  signatureError: string | null = null;
  signatureMessage = 'Sign this message to prove ownership.';
  signatureResult: { messageHash: string; status: string } | null = null;
  thisPartyId: number | null = null;
  webhookLogs: WebhookLog[] = [];

  // Wallet reconstruction data
  walletReconstructions: WalletReconstructionData[] = [];
  regeneratedAddress: string | null = null;
  regenerating = false;

  // TSS demonstration data
  commitments: Array<{
    sessionId: string;
    partyId: number;
    commitment: string;
    timestamp: Date;
  }> = [];
  reconstructedWallets: WalletReconstruction[] = [];

  // Additional properties used in template
  sessionId: string | null = null;
  isActingAsParty = false;
  currentPartyId: number | null = null;
  currentWalletAddress: string | null = null;
  reconstructionColumns = ['timestamp', 'walletAddress', 'parties', 'verified'];

  constructor(
    private route: ActivatedRoute,
    private apiService: ApiService,
    private indexedDBService: IndexedDBService,
    private partyService: PartyService,
    private snackBar: MatSnackBar,
    private cryptoService: CryptoService
  ) {}

  ngOnInit() {
    const sessionId = this.route.snapshot.paramMap.get('id');

    if (!sessionId) return;

    this.sessionId = sessionId;
    this.isActingAsParty = this.partyService.isActingAsParty();
    this.currentPartyId = this.partyService.getCurrentPartyId();

    this.loadAllData(sessionId);
  }

  ngOnDestroy() {
    // Stop polling for webhook events if this user is participating as a party
    if (!this.partyService.isActingAsParty()) return;

    this.partyService.stopPolling();
    console.log('🛑 Stopped polling for webhook events');
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
        this.checkAndStartPartyParticipation(sessionId),
        this.loadWalletReconstructionData(),
        this.loadTSSData(),
      ]);
    } catch (error) {
      console.error('Error loading session data:', error);
      this.snackBar.open('Failed to load session data', 'Close', {
        duration: 3000,
      });
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

      const sessionPromise = firstValueFrom(
        this.apiService.getSession(sessionId)
      );
      const session = (await Promise.race([
        sessionPromise,
        timeoutPromise,
      ])) as Session;

      if (!session) throw new Error('Session not found');

      this.session = session;

      console.log('✅ Session loaded successfully:', session);
    } catch (error: any) {
      console.error('❌ Failed to load session:', error);

      throw new Error(
        `Failed to load session: ${error.message || 'Unknown error'}`
      );
    }
  }

  async loadWebhookLogs(sessionId: string) {
    this.loadingLogs = true;

    try {
      // Add a timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 5000); // 5 second timeout
      });

      const logsPromise = firstValueFrom(
        this.apiService.getWebhookLogs(sessionId)
      );
      const logs = (await Promise.race([
        logsPromise,
        timeoutPromise,
      ])) as WebhookLog[];

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

      await firstValueFrom(
        this.apiService.initiateDkg(this.session.sessionId, blockchain)
      );

      // Reload session to get updated status
      await this.loadSession(this.session.sessionId);

      this.snackBar.open(
        'Distributed key generation initiated! Parties will generate their own shares.',
        'Close',
        { duration: 5000 }
      );
    } catch (error: any) {
      console.error('❌ DKG initiation failed:', error);

      this.snackBar.open(`DKG initiation failed: ${error.message}`, 'Close', {
        duration: 5000,
      });
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
      const result = await firstValueFrom(
        this.apiService.createSignature(
          this.session.sessionId,
          this.signatureMessage
        )
      );

      if (!result) return;

      this.signatureResult = {
        messageHash: result.messageHash || '',
        status: result.status,
      };

      await this.loadSession(this.session.sessionId);

      this.snackBar.open(
        'Threshold signature request sent to all parties!',
        'Close',
        { duration: 3000 }
      );
    } catch (error: any) {
      this.signatureError =
        error.error?.message || 'Failed to create signature';

      console.error('❌ Failed to create signature:', error);

      this.snackBar.open(
        `Signature creation failed: ${this.signatureError}`,
        'Close',
        { duration: 5000 }
      );
    } finally {
      this.creatingSignature = false;
    }
  }

  async reconstructKey() {
    if (!this.session) return;

    this.reconstructingKey = true;
    this.reconstructionError = null;
    this.reconstructionResult = null;

    try {
      const result = await firstValueFrom(
        this.apiService.reconstructKey(this.session.sessionId)
      );

      if (!result) return;

      this.reconstructionResult = {
        walletAddress: result.walletAddress,
        sharesCount: result.sharesCount,
        status: result.status,
      };

      await this.loadSession(this.session.sessionId);

      this.snackBar.open(
        `Key reconstruction completed! Wallet: ${result.walletAddress}`,
        'Close',
        { duration: 5000 }
      );
    } catch (error: any) {
      this.reconstructionError =
        error.error?.message || 'Failed to reconstruct key';

      console.error('❌ Failed to reconstruct key:', error);

      this.snackBar.open(
        `Key reconstruction failed: ${this.reconstructionError}`,
        'Close',
        { duration: 5000 }
      );
    } finally {
      this.reconstructingKey = false;
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'initialized':
        return 'accent';
      case 'dkg_initiated':
        return 'primary';
      case 'dkg_completed':
        return 'primary';
      case 'signing_in_progress':
        return 'warn';
      case 'signature_completed':
        return 'primary';
      case 'failed':
        return 'warn';
      default:
        return 'primary';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'initialized':
        return 'schedule';
      case 'dkg_initiated':
        return 'vpn_key';
      case 'dkg_completed':
        return 'verified';
      case 'signing_in_progress':
        return 'edit';
      case 'signature_completed':
        return 'done';
      case 'failed':
        return 'error';
      default:
        return 'info';
    }
  }

  getOperationColor(operation: string): string {
    switch (operation) {
      case 'key_generation':
        return 'primary';
      case 'signature':
        return 'warn';
      default:
        return 'primary';
    }
  }

  getPartyStatusIcon(status: string): string {
    switch (status) {
      case 'pending':
        return 'schedule';
      case 'share_committed':
        return 'lock';
      case 'ready':
        return 'check_circle';
      case 'connected':
        return 'wifi';
      case 'completed':
        return 'check_circle';
      case 'failed':
        return 'error';
      default:
        return 'help';
    }
  }

  getPartyStatusColor(status: string): string {
    switch (status) {
      case 'pending':
        return 'accent';
      case 'share_committed':
        return 'primary';
      case 'ready':
        return 'primary';
      case 'connected':
        return 'primary';
      case 'completed':
        return 'primary';
      case 'failed':
        return 'warn';
      default:
        return 'primary';
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
          const config = await this.indexedDBService.getPartyConfig(
            party.partyId
          );

          if (!config?.walletAddress) continue;

          this.partyWalletAddresses.set(party.partyId, config.walletAddress);
        } catch (error) {
          console.warn(
            `Could not load party config for party ${party.partyId}:`,
            error
          );
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
    if (!this.partyService.isActingAsParty()) {
      console.log('👤 User is not participating as a party in this session');
      return;
    }

    this.thisPartyId = this.partyService.getCurrentPartyId();
    console.log(
      `🎭 User is participating as Party ${this.thisPartyId} in session ${sessionId}`
    );

    // Start polling for webhook events
    this.partyService.startPollingForSession(sessionId);

    // Subscribe to webhook events for UI updates
    this.partyService.getWebhookEvents().subscribe((event) => {
      console.log(`📡 Received webhook event in UI:`, event);
      // You can add UI updates here based on webhook events
    });
  }

  /**
   * Handle copy success feedback
   */
  onCopySuccess() {
    this.snackBar.open('Wallet address copied to clipboard!', 'Close', {
      duration: 2000,
    });
  }

  /**
   * Load wallet reconstructions from IndexedDB
   */
  async loadWalletReconstructionData() {
    if (!this.sessionId) return;

    try {
      const reconstruction =
        await this.indexedDBService.getWalletReconstruction(this.sessionId);
      if (reconstruction) {
        this.walletReconstructions = [reconstruction];
      }
    } catch (error) {
      console.error('Error loading wallet reconstruction data:', error);
    }
  }

  /**
   * Load TSS commitments and other demonstration data
   */
  async loadTSSData() {
    if (!this.sessionId) return;

    try {
      // For now, this would be demo data - in a real implementation,
      // commitments would be loaded from the session data or a secure store
      console.log('🔍 Loading TSS demonstration data...');
    } catch (error) {
      console.error('Error loading TSS data:', error);
    }
  }

  /**
   * Regenerate the same wallet address deterministically
   */
  async regenerateWalletAddress() {
    if (!this.sessionId || !this.currentPartyId) return;

    this.regenerating = true;
    try {
      const regeneratedAddress =
        await this.partyService.regenerateWalletAddress(this.sessionId);

      if (regeneratedAddress) {
        this.regeneratedAddress = regeneratedAddress;
        this.currentWalletAddress = regeneratedAddress;

        this.snackBar.open(
          'Wallet address regenerated successfully!',
          'Close',
          { duration: 3000 }
        );
      } else {
        this.snackBar.open('No stored shares found for regeneration', 'Close', {
          duration: 3000,
        });
      }
    } catch (error: any) {
      console.error('Error regenerating wallet address:', error);
      this.snackBar.open(
        `Failed to regenerate wallet address: ${error.message}`,
        'Close',
        { duration: 5000 }
      );
    } finally {
      this.regenerating = false;
    }
  }

  /**
   * Demonstrate wallet reconstruction using multiple parties
   */
  async demonstrateWalletReconstruction() {
    if (!this.sessionId) return;

    try {
      // Generate demo shares for demonstration
      const demoShares = [
        {
          partyId: 0,
          share: this.cryptoService.generateDeterministicShare(
            0,
            this.sessionId
          ),
        },
        {
          partyId: 1,
          share: this.cryptoService.generateDeterministicShare(
            1,
            this.sessionId
          ),
        },
        {
          partyId: 2,
          share: this.cryptoService.generateDeterministicShare(
            2,
            this.sessionId
          ),
        },
      ];

      // Reconstruct wallet from shares
      const reconstruction = this.cryptoService.reconstructWalletFromShares(
        demoShares,
        this.sessionId
      );

      // Store in IndexedDB
      await this.indexedDBService.storeWalletReconstruction({
        sessionId: this.sessionId,
        walletAddress: reconstruction.walletAddress,
        publicKey: reconstruction.publicKey,
        reconstructionTimestamp: reconstruction.reconstructionTimestamp,
        participatingParties: reconstruction.participatingParties,
        threshold: demoShares.length,
        verified: true,
      });

      this.walletReconstructions = [
        {
          sessionId: this.sessionId,
          walletAddress: reconstruction.walletAddress,
          publicKey: reconstruction.publicKey,
          reconstructionTimestamp: reconstruction.reconstructionTimestamp,
          participatingParties: reconstruction.participatingParties,
          threshold: demoShares.length,
          verified: true,
        },
      ];

      this.snackBar.open(
        `Wallet reconstruction demonstrated! Address: ${reconstruction.walletAddress}`,
        'Close',
        { duration: 5000 }
      );
    } catch (error: any) {
      console.error('Error demonstrating wallet reconstruction:', error);
      this.snackBar.open(
        `Wallet reconstruction failed: ${error.message}`,
        'Close',
        { duration: 5000 }
      );
    }
  }

  /**
   * Clear cryptographic material from memory (security feature)
   */
  async clearCryptographicMaterial() {
    if (!this.currentPartyId) return;

    try {
      await this.partyService.clearCryptographicMaterial();
      this.cryptoService.clearAllCryptographicMaterial();

      this.snackBar.open(
        'Cryptographic material cleared from memory',
        'Close',
        { duration: 3000 }
      );
    } catch (error: any) {
      console.error('Error clearing cryptographic material:', error);
      this.snackBar.open(
        `Failed to clear material: ${error.message}`,
        'Close',
        { duration: 3000 }
      );
    }
  }

  /**
   * Test commitment verification (TSS MCP demonstration)
   */
  async testCommitmentVerification() {
    if (!this.sessionId || !this.currentPartyId) return;

    try {
      // Generate a share and commitment for demonstration
      const share = this.cryptoService.generateDeterministicShare(
        this.currentPartyId,
        this.sessionId
      );

      const commitment = this.cryptoService.generateShareCommitment(
        share,
        this.sessionId,
        this.currentPartyId
      );

      // Verify the commitment
      const isValid = this.cryptoService.verifyShareCommitment(
        share,
        commitment,
        this.sessionId,
        this.currentPartyId
      );

      this.commitments.push({
        sessionId: this.sessionId,
        partyId: this.currentPartyId,
        commitment: commitment,
        timestamp: new Date(),
      });

      const message = isValid
        ? 'Commitment generated and verified successfully!'
        : 'Commitment generated but verification failed!';

      this.snackBar.open(message, 'Close', { duration: 3000 });
    } catch (error: any) {
      console.error('Error testing commitment verification:', error);
      this.snackBar.open(`Commitment test failed: ${error.message}`, 'Close', {
        duration: 5000,
      });
    }
  }

  formatAddress(address: string | undefined): string {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }

  formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString();
  }

  formatParticipatingParties(parties: number[]): string {
    return parties.map((p) => `Party ${p}`).join(', ');
  }

  copyToClipboard(text: string | undefined) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.snackBar.open('Copied to clipboard', 'Close', { duration: 2000 });
    });
  }
}
