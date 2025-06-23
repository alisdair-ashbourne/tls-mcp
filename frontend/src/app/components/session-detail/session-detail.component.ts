import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialogModule } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { ApiService, Session, WebhookLog } from '../../services/api.service';
import { CryptoService } from '../../services/crypto.service';
import { IndexedDBService } from '../../services/indexeddb.service';
import { PartyService } from '../../services/party.service';
import { Wallet } from 'ethers';

@Component({
  selector: 'app-session-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTabsModule,
    MatListModule,
    MatChipsModule,
    MatExpansionModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatDialogModule,
    FormsModule
  ],
  template: `
    <div class="session-detail-container">
      <div class="header">
        <button mat-icon-button routerLink="/sessions">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h1>Session Details</h1>
      </div>

      <div *ngIf="loading" class="loading">
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
        <p>Loading session details...</p>
      </div>

      <div *ngIf="!loading && session" class="content">
        <!-- Session Overview -->
        <mat-card class="overview-card">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>info</mat-icon>
              Session Overview
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="overview-grid">
              <div class="overview-item">
                <span class="label">Session ID:</span>
                <span class="value">{{ session.sessionId }}</span>
              </div>
              <div class="overview-item">
                <span class="label">Status:</span>
                <span class="value">
                  <mat-chip [color]="getStatusColor(session.status)" selected>
                    {{ session.status }}
                  </mat-chip>
                </span>
              </div>
              <div class="overview-item">
                <span class="label">Operation:</span>
                <span class="value">
                  <mat-chip [color]="getOperationColor(session.operation)" selected>
                    {{ session.operation | titlecase }}
                  </mat-chip>
                </span>
              </div>
              <div class="overview-item">
                <span class="label">Created:</span>
                <span class="value">{{ session.createdAt | date:'medium' }}</span>
              </div>
              <div class="overview-item">
                <span class="label">Expires:</span>
                <span class="value">{{ session.expiresAt | date:'medium' }}</span>
              </div>
              <div class="overview-item" *ngIf="session.metadata?.walletAddress">
                <span class="label">Wallet Address:</span>
                <span class="value">{{ session.metadata.walletAddress }}</span>
              </div>
              <div class="overview-item" *ngIf="session.metadata?.blockchain">
                <span class="label">Blockchain:</span>
                <span class="value">{{ session.metadata.blockchain }}</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Parties Status -->
        <mat-card class="parties-card">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>people</mat-icon>
              Parties Status
            </mat-card-title>
            <mat-card-subtitle>{{ session.parties.length }} parties involved</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="parties-grid">
              <div *ngFor="let party of session.parties" class="party-item">
                <div class="party-header">
                  <mat-icon [class]="getPartyStatusIcon(party.status)">{{ getPartyStatusIcon(party.status) }}</mat-icon>
                  <div class="party-info">
                    <div class="party-name">{{ party.partyName }}</div>
                    <div class="party-id">Party {{ party.partyId }}</div>
                  </div>
                  <mat-chip [color]="getPartyStatusColor(party.status)" selected>
                    {{ party.status }}
                  </mat-chip>
                </div>
                <div class="party-details" *ngIf="party.lastSeen">
                  <small>Last seen: {{ party.lastSeen | date:'short' }}</small>
                </div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Operations -->
        <mat-card class="operations-card">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>build</mat-icon>
              Operations
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="operations-grid">
              <button 
                *ngIf="session.status === 'pending'"
                mat-raised-button 
                color="primary" 
                (click)="generateKey()"
                [disabled]="generatingKey">
                <mat-icon>vpn_key</mat-icon>
                {{ generatingKey ? 'Generating...' : 'Generate Key' }}
              </button>
              
              <button 
                *ngIf="session.status === 'active'"
                mat-raised-button 
                color="accent" 
                (click)="reconstructKey()"
                [disabled]="reconstructingKey">
                <mat-icon>key</mat-icon>
                {{ reconstructingKey ? 'Reconstructing...' : 'Reconstruct Key' }}
              </button>
              
              <button 
                *ngIf="session.status === 'active'"
                mat-raised-button 
                color="warn" 
                (click)="createSignature()"
                [disabled]="creatingSignature">
                <mat-icon>edit</mat-icon>
                {{ creatingSignature ? 'Creating...' : 'Create Signature' }}
              </button>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Results -->
        <mat-card *ngIf="session.finalSignature || session.secret" class="results-card">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>check_circle</mat-icon>
              Results
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <mat-expansion-panel *ngIf="session.finalSignature">
              <mat-expansion-panel-header>
                <mat-panel-title>Signature Result</mat-panel-title>
              </mat-expansion-panel-header>
              <div class="result-content">
                <div class="result-item">
                  <span class="label">Signature:</span>
                  <code class="value">{{ session.finalSignature.signature }}</code>
                </div>
                <div class="result-item">
                  <span class="label">Message Hash:</span>
                  <code class="value">{{ session.finalSignature.messageHash }}</code>
                </div>
                <div class="result-item">
                  <span class="label">Participants:</span>
                  <span class="value">{{ session.finalSignature.participants.join(', ') }}</span>
                </div>
                <div class="result-item">
                  <span class="label">Timestamp:</span>
                  <span class="value">{{ session.finalSignature.timestamp | date:'medium' }}</span>
                </div>
              </div>
            </mat-expansion-panel>
            
            <mat-expansion-panel *ngIf="session.secret">
              <mat-expansion-panel-header>
                <mat-panel-title>Reconstructed Key</mat-panel-title>
              </mat-expansion-panel-header>
              <div class="result-content">
                <div class="result-item">
                  <span class="label">Private Key:</span>
                  <code class="value">{{ session.secret }}</code>
                </div>
              </div>
            </mat-expansion-panel>
          </mat-card-content>
        </mat-card>

        <!-- Webhook Logs -->
        <mat-card class="logs-card">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>list_alt</mat-icon>
              Webhook Logs
            </mat-card-title>
            <mat-card-subtitle>{{ webhookLogs.length }} logs</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div *ngIf="loadingLogs" class="loading">
              <mat-progress-bar mode="indeterminate"></mat-progress-bar>
              <p>Loading logs...</p>
            </div>
            
            <div *ngIf="!loadingLogs && webhookLogs.length === 0" class="empty-state">
              <mat-icon>inbox</mat-icon>
              <p>No webhook logs found for this session.</p>
            </div>
            
            <mat-list *ngIf="!loadingLogs && webhookLogs.length > 0">
              <mat-list-item *ngFor="let log of webhookLogs" class="log-item">
                <mat-icon matListItemIcon [class]="log.success ? 'success' : 'error'">
                  {{ log.success ? 'check_circle' : 'error' }}
                </mat-icon>
                <div matListItemTitle>
                  {{ log.direction | titlecase }} - {{ log.event }}
                </div>
                <div matListItemLine>
                  Party {{ log.partyId }} • {{ log.timestamp | date:'short' }}
                  <span *ngIf="log.duration">• {{ log.duration }}ms</span>
                </div>
                <div matListItemMeta>
                  <mat-chip [color]="log.success ? 'primary' : 'warn'" selected>
                    {{ log.success ? 'Success' : 'Failed' }}
                  </mat-chip>
                </div>
              </mat-list-item>
            </mat-list>
          </mat-card-content>
        </mat-card>
      </div>

      <div *ngIf="!loading && !session" class="error-state">
        <mat-icon>error</mat-icon>
        <p>Session not found</p>
        <button mat-raised-button routerLink="/sessions">Back to Sessions</button>
      </div>
    </div>
  `,
  styles: [`
    .session-detail-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }

    .header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;
    }

    h1 {
      margin: 0;
      color: #333;
    }

    .loading {
      text-align: center;
      padding: 40px;
    }

    .error-state {
      text-align: center;
      padding: 60px 20px;
      color: #666;
    }

    .error-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
    }

    .overview-card, .parties-card, .operations-card, .results-card, .logs-card {
      margin-bottom: 20px;
    }

    .overview-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 16px;
    }

    .overview-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }

    .overview-item:last-child {
      border-bottom: none;
    }

    .label {
      font-weight: 500;
      color: #666;
    }

    .value {
      font-family: 'Courier New', monospace;
      word-break: break-all;
    }

    .parties-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 16px;
    }

    .party-item {
      padding: 16px;
      border: 1px solid #eee;
      border-radius: 8px;
      background: #fafafa;
    }

    .party-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }

    .party-info {
      flex: 1;
    }

    .party-name {
      font-weight: 500;
    }

    .party-id {
      font-size: 12px;
      color: #666;
    }

    .party-details {
      margin-top: 8px;
      color: #666;
    }

    .operations-grid {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }

    .result-content {
      padding: 16px 0;
    }

    .result-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 16px;
    }

    .result-item .label {
      font-weight: 500;
      color: #666;
    }

    .result-item .value {
      font-family: 'Courier New', monospace;
      background: #f5f5f5;
      padding: 8px;
      border-radius: 4px;
      word-break: break-all;
    }

    .log-item {
      border-bottom: 1px solid #eee;
    }

    .log-item:last-child {
      border-bottom: none;
    }

    .empty-state {
      text-align: center;
      padding: 40px;
      color: #666;
    }

    .empty-state mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
    }

    mat-card-header {
      margin-bottom: 16px;
    }

    mat-card-title {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .success {
      color: #4caf50;
    }

    .error {
      color: #f44336;
    }
  `]
})
export class SessionDetailComponent implements OnInit, OnDestroy {
  session: Session | null = null;
  webhookLogs: WebhookLog[] = [];
  loading = true;
  loadingLogs = false;
  reconstructingKey = false;
  creatingSignature = false;
  thisPartyId: number | null = null; // Will be set from PartyService
  generatingKey = false;

  // Client-side crypto properties
  reconstructedWallet: Wallet | null = null;
  encryptionPlaintext = 'This is a secret message.';
  encryptionCiphertext: string | null = null;
  encryptionDecryptedtext: string | null = null;
  encryptionError: string | null = null;
  communicationKey: { publicKey: string, privateKey: string } | null = null;
  isCommKeyLoading = false;

  signatureMessage = 'Sign this message to prove ownership.';
  signatureResult: { signature: string, digest: string } | null = null;
  signatureError: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private apiService: ApiService,
    private cryptoService: CryptoService,
    private indexedDBService: IndexedDBService,
    private partyService: PartyService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    // Get party ID from PartyService if this browser is acting as a party
    this.thisPartyId = this.partyService.getCurrentPartyId();
    
    this.route.params.subscribe(params => {
      const sessionId = params['id'];
      if (sessionId) {
        this.loadAllData(sessionId);
        
        // Start polling for webhook events if this browser is acting as a party
        if (this.thisPartyId !== null) {
          this.partyService.startPollingForSession(sessionId);
        }
      }
    });
  }

  ngOnDestroy() {
    // Stop polling when component is destroyed
    this.partyService.stopPolling();
  }

  async loadAllData(sessionId: string) {
    this.loading = true;
    try {
      await this.loadSession(sessionId);
      await this.loadWebhookLogs(sessionId);
      // Only set up comms key if the session loaded successfully and we have a party ID
      if (this.session && this.thisPartyId !== null) {
        await this.setupCommunicationKey(sessionId, this.thisPartyId);
      }
    } catch (error: any) {
      this.snackBar.open(`Failed to load session data: ${error.message}`, 'Close', { duration: 5000 });
      console.error(error);
    } finally {
      this.loading = false;
    }
  }

  async loadSession(sessionId: string) {
    try {
      const session = await firstValueFrom(this.apiService.getSession(sessionId));
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
      const logs = await firstValueFrom(this.apiService.getWebhookLogs(sessionId));
      this.webhookLogs = logs || [];
      console.log('✅ Webhook logs loaded:', this.webhookLogs.length);
    } catch (error: any) {
      console.error('❌ Failed to load webhook logs:', error);
      this.webhookLogs = [];
    } finally {
      this.loadingLogs = false;
    }
  }

  async setupCommunicationKey(sessionId: string, partyId: number) {
    this.isCommKeyLoading = true;
    try {
      const privateKey = await this.indexedDBService.getCommunicationKey(sessionId, partyId);
      if (privateKey) {
        const wallet = this.cryptoService.getWalletFromPrivateKey(privateKey);
        this.communicationKey = wallet ? { publicKey: wallet.publicKey, privateKey } : null;
        console.log(`✅ Communication key loaded from IndexedDB for party ${partyId}`);
      } else {
        console.log(`🤷 No communication key found for party ${partyId}. Generating a new one.`);
        const newWallet = this.cryptoService.generateNewWallet();
        
        // Get public key in the correct format for communication
        const publicKey = this.cryptoService.getPublicKeyForEncryption(newWallet);
        console.log(`🔑 Generated public key: ${publicKey.substring(0, 20)}...`);
        
        this.communicationKey = { publicKey: newWallet.publicKey, privateKey: newWallet.privateKey };
        await this.indexedDBService.storeCommunicationKey(sessionId, partyId, newWallet.privateKey);
        console.log(`🔒 New communication key stored in IndexedDB for party ${partyId}`);

        const updatedSession = await firstValueFrom(this.apiService.addCommunicationPublicKey(sessionId, partyId, publicKey));
        if(updatedSession) {
          this.session = updatedSession;
        }
        console.log(`🚀 Communication public key published for party ${partyId}`);
        this.snackBar.open(`Communication key for Party ${partyId} published!`, 'Close', { duration: 3000 });
      }
    } catch (error: any) {
      console.error('Error setting up communication key:', error);
      this.snackBar.open(`Error setting up communication key: ${error.message}`, 'Close', { duration: 5000 });
    } finally {
      this.isCommKeyLoading = false;
    }
  }

  getPartyCommKey(partyId: number): string {
    if (!this.session?.communicationPubKeys) return 'N/A';
    const partyKey = this.session.communicationPubKeys.find(p => p.partyId === partyId);
    return partyKey ? partyKey.publicKey.substring(0, 20) + '...' : 'Not Published Yet';
  }

  async reconstructKey() {
    if (!this.session) return;
    this.reconstructingKey = true;
    this.reconstructedWallet = null;
    try {
      const result = await firstValueFrom(this.apiService.reconstructKey(this.session.sessionId));
      if (result && result.privateKey) {
        this.reconstructedWallet = this.cryptoService.getWalletFromPrivateKey(result.privateKey);
        await this.loadSession(this.session.sessionId);
      }
    } catch (error: any) {
      console.error('❌ Failed to reconstruct key:', error);
      this.snackBar.open(`Failed to reconstruct key: ${error.message}`, 'Close', { duration: 5000 });
    } finally {
      this.reconstructingKey = false;
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
        this.signatureResult = { signature: result.signature, digest: result.digest };
        await this.loadSession(this.session.sessionId);
      }
    } catch (error: any) {
      this.signatureError = error.error?.message || 'Failed to create signature';
      console.error('❌ Failed to create signature:', error);
    } finally {
      this.creatingSignature = false;
    }
  }

  async encrypt() {
    if (!this.reconstructedWallet) return;
    this.encryptionError = null;
    this.encryptionCiphertext = null;
    try {
      const publicKey = this.reconstructedWallet.publicKey.substring(4); // Use uncompressed public key
      this.encryptionCiphertext = await this.cryptoService.encryptMessage(this.encryptionPlaintext, publicKey);
    } catch (error: any) {
      console.error('Encryption failed:', error);
      this.encryptionError = error.message || 'Encryption failed.';
    }
  }

  async decrypt() {
    if (!this.reconstructedWallet || !this.encryptionCiphertext) return;
    this.encryptionError = null;
    this.encryptionDecryptedtext = null;
    try {
      this.encryptionDecryptedtext = await this.cryptoService.decryptMessage(this.encryptionCiphertext, this.reconstructedWallet.privateKey);
    } catch (error: any) {
      console.error('Decryption failed:', error);
      this.encryptionError = error.message || 'Decryption failed.';
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'pending': return 'accent';
      case 'active': return 'primary';
      case 'completed': return 'primary';
      case 'failed': return 'warn';
      default: return 'primary';
    }
  }

  getOperationColor(operation: string): string {
    switch (operation) {
      case 'key_generation': return 'primary';
      case 'key_reconstruction': return 'accent';
      case 'signature': return 'warn';
      case 'verification': return 'primary';
      default: return 'primary';
    }
  }

  getPartyStatusIcon(status: string): string {
    switch (status) {
      case 'pending': return 'schedule';
      case 'connected': return 'wifi';
      case 'ready': return 'check_circle';
      case 'completed': return 'check_circle';
      case 'failed': return 'error';
      default: return 'help';
    }
  }

  getPartyStatusColor(status: string): string {
    switch (status) {
      case 'pending': return 'accent';
      case 'connected': return 'primary';
      case 'ready': return 'primary';
      case 'completed': return 'primary';
      case 'failed': return 'warn';
      default: return 'primary';
    }
  }

  async generateKey() {
    if (!this.session) return;
    this.generatingKey = true;
    try {
      const walletAddress = this.session.metadata?.walletAddress;
      const blockchain = this.session.metadata?.blockchain;
      
      await firstValueFrom(this.apiService.generateKey(this.session.sessionId, walletAddress, blockchain));
      // Reload session to get updated status
      await this.loadSession(this.session.sessionId);
      this.snackBar.open('Key generation initiated successfully!', 'Close', { duration: 3000 });
    } catch (error: any) {
      console.error('❌ Key generation failed:', error);
      this.snackBar.open(`Key generation failed: ${error.message}`, 'Close', { duration: 5000 });
    } finally {
      this.generatingKey = false;
    }
  }
} 