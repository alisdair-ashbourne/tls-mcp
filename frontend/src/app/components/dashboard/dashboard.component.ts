import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink } from '@angular/router';
import { ApiService, Session, SessionSummary } from '../../services/api.service';
import { IndexedDBService } from '../../services/indexeddb.service';
import { PartyService } from '../../services/party.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTabsModule,
    MatListModule,
    RouterLink
  ],
  template: `
    <div class="dashboard-container">
      <h1>TLS-MCP Dashboard</h1>
      
      <!-- System Status -->
      <mat-card class="status-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>monitor_heart</mat-icon>
            System Status
          </mat-card-title>
          <mat-card-subtitle *ngIf="lastHealthCheck">
            Last checked: {{ lastHealthCheck | date:'short' }}
          </mat-card-subtitle>
          <button mat-icon-button (click)="refreshHealth()" matTooltip="Refresh health status" [disabled]="healthChecking">
            <mat-icon [class.rotating]="healthChecking">{{ healthChecking ? 'hourglass_empty' : 'refresh' }}</mat-icon>
          </button>
        </mat-card-header>

        <mat-card-content>
          <div class="status-grid">
            <div class="status-item">
              <span class="status-label">Coordinator:</span>
              <span class="status-value" [class.healthy]="coordinatorHealthy">
                {{ coordinatorHealthy ? '🟢 Healthy' : '🔴 Offline' }}
              </span>
            </div>
            <div class="status-item">
              <span class="status-label">Party A:</span>
              <span class="status-value" [class.healthy]="partyAHealthy">
                {{ partyAHealthy ? '🟢 Online' : '🔴 Offline' }}
              </span>
            </div>
            <div class="status-item">
              <span class="status-label">Party B:</span>
              <span class="status-value" [class.healthy]="partyBHealthy">
                {{ partyBHealthy ? '🟢 Online' : '🔴 Offline' }}
              </span>
            </div>
            <div class="status-item">
              <span class="status-label">Party C:</span>
              <span class="status-value" [class.healthy]="partyCHealthy">
                {{ partyCHealthy ? '🟢 Online' : '🔴 Offline' }}
              </span>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Quick Actions -->
      <mat-card class="actions-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>flash_on</mat-icon>
            Quick Actions
          </mat-card-title>
        </mat-card-header>

        <mat-card-content>
          <div class="actions-grid">
            <button mat-raised-button color="primary" routerLink="/key-generation">
              <mat-icon>add</mat-icon>
              New Session
            </button>
            <button mat-raised-button color="accent" routerLink="/sessions">
              <mat-icon>list</mat-icon>
              View Sessions
            </button>
            <button mat-raised-button color="warn" routerLink="/signature">
              <mat-icon>edit</mat-icon>
              Create Signature
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- IndexedDB Management -->
      <mat-card class="indexeddb-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>storage</mat-icon>
            IndexedDB Management
          </mat-card-title>
          <mat-card-subtitle>Manage local database and data synchronization</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <div class="actions-grid">
            <button mat-raised-button (click)="loadIndexedDBData()" [disabled]="showDebugInfo">
              <mat-icon>bug_report</mat-icon>
              Load IndexedDB Data
            </button>

            <button mat-raised-button (click)="refreshIndexedDB()" [disabled]="showDebugInfo">
              <mat-icon>refresh</mat-icon>
              Refresh IndexedDB
            </button>

            <button mat-raised-button (click)="addTestData()" [disabled]="showDebugInfo">
              <mat-icon>add</mat-icon>
              Add Test Data
            </button>

            <button mat-raised-button (click)="syncServerToIndexedDB()" [disabled]="showDebugInfo">
              <mat-icon>sync</mat-icon>
              Sync Server to IndexedDB
            </button>

            <button mat-raised-button (click)="resetIndexedDB()" [disabled]="showDebugInfo" color="warn">
              <mat-icon>delete_forever</mat-icon>
              Reset Database
            </button>

            <button mat-raised-button (click)="showDebugInfo = !showDebugInfo">
              <mat-icon>{{ showDebugInfo ? 'visibility_off' : 'visibility' }}</mat-icon>
              {{ showDebugInfo ? 'Hide' : 'Show' }} Debug Info
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- IndexedDB Summary -->
      <mat-card *ngIf="showDebugInfo" class="summary-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>storage</mat-icon>
            IndexedDB Summary
          </mat-card-title>
          <mat-card-subtitle>Overview of all local database tables</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-number">{{ indexedDBData.sessions?.count || 0 }}</div>
              <div class="summary-label">Sessions</div>
            </div>
            <div class="summary-item">
              <div class="summary-number">{{ indexedDBData.shares?.count || 0 }}</div>
              <div class="summary-label">Shares</div>
            </div>
            <div class="summary-item">
              <div class="summary-number">{{ indexedDBData.partySessions?.count || 0 }}</div>
              <div class="summary-label">Party Sessions</div>
            </div>
            <div class="summary-item">
              <div class="summary-number">{{ indexedDBData.partyShares?.count || 0 }}</div>
              <div class="summary-label">Party Shares</div>
            </div>
            <div class="summary-item">
              <div class="summary-number">{{ indexedDBData.communicationKeys?.count || 0 }}</div>
              <div class="summary-label">Comm Keys</div>
            </div>
            <div class="summary-item">
              <div class="summary-number">{{ indexedDBData.webhookEvents?.count || 0 }}</div>
              <div class="summary-label">Webhook Events</div>
            </div>
            <div class="summary-item">
              <div class="summary-number">{{ indexedDBData.partyConfig?.count || 0 }}</div>
              <div class="summary-label">Party Configs</div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Party View (when acting as a party) -->
      <mat-card *ngIf="isActingAsParty" class="party-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>person</mat-icon>
            Party {{ currentPartyId! + 1 }} Dashboard
          </mat-card-title>
          <mat-card-subtitle>You are participating as Party {{ currentPartyId! + 1 }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="party-stats">
            <div class="party-stat">
              <div class="stat-number">{{ partySessions.length }}</div>
              <div class="stat-label">Active Sessions</div>
            </div>
            <div class="party-stat">
              <div class="stat-number">{{ partyShares.length }}</div>
              <div class="stat-label">Shares Held</div>
            </div>
            <div class="party-stat">
              <div class="stat-number">{{ partyWebhookEvents.length }}</div>
              <div class="stat-label">Webhook Events</div>
            </div>
          </div>

          <mat-tab-group>
            <mat-tab label="Sessions">
              <div class="party-content">
                <div *ngFor="let session of partySessions" class="party-session-item">
                  <div class="session-header">
                    <span class="session-id">{{ session.sessionId.substring(0, 8) }}...</span>
                    <span class="session-status" [class]="session.status">{{ session.status }}</span>
                  </div>
                  <div class="session-details">
                    <span>Operation: {{ session.operation }}</span>
                    <span>Created: {{ session.createdAt | date:'short' }}</span>
                  </div>
                </div>
                <p *ngIf="partySessions.length === 0">No sessions found</p>
              </div>
            </mat-tab>
            
            <mat-tab label="Shares">
              <div class="party-content">
                <div *ngFor="let share of partyShares" class="party-share-item">
                  <div class="share-header">
                    <span class="session-id">{{ share.sessionId.substring(0, 8) }}...</span>
                    <span class="share-received">{{ share.receivedAt | date:'short' }}</span>
                  </div>
                  <div class="share-details">
                    <span>Share: {{ share.share.substring(0, 20) }}...</span>
                    <span>Commitment: {{ share.commitment.substring(0, 20) }}...</span>
                  </div>
                </div>
                <p *ngIf="partyShares.length === 0">No shares found</p>
              </div>
            </mat-tab>
            
            <mat-tab label="Webhook Events">
              <div class="party-content">
                <div *ngFor="let event of partyWebhookEvents.slice(0, 10)" class="party-event-item">
                  <div class="event-header">
                    <span class="event-type">{{ event.event }}</span>
                    <span class="event-time">{{ event.timestamp | date:'short' }}</span>
                  </div>
                  <div class="event-session">{{ event.sessionId.substring(0, 8) }}...</div>
                </div>
                <p *ngIf="partyWebhookEvents.length === 0">No webhook events found</p>
              </div>
            </mat-tab>
          </mat-tab-group>
        </mat-card-content>
      </mat-card>

      <!-- Debug Information -->
      <mat-card *ngIf="showDebugInfo" class="debug-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>bug_report</mat-icon>
            Debug Information
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div *ngIf="indexedDBError" class="error-message">
            <mat-icon>error</mat-icon>
            {{ indexedDBError }}
          </div>
          
          <mat-tab-group>
            <mat-tab label="Sessions">
              <div class="debug-content">
                <h4>Sessions ({{ indexedDBData.sessions?.count || 0 }})</h4>
                <pre *ngIf="indexedDBData.sessions?.data?.length">{{ indexedDBData.sessions.data | json }}</pre>
                <p *ngIf="!indexedDBData.sessions?.data?.length">No sessions found</p>
              </div>
            </mat-tab>
            
            <mat-tab label="Shares">
              <div class="debug-content">
                <h4>Shares ({{ indexedDBData.shares?.count || 0 }})</h4>
                <pre *ngIf="indexedDBData.shares?.data?.length">{{ indexedDBData.shares.data | json }}</pre>
                <p *ngIf="!indexedDBData.shares?.data?.length">No shares found</p>
              </div>
            </mat-tab>

            <mat-tab label="Party Sessions">
              <div class="debug-content">
                <h4>Party Sessions ({{ indexedDBData.partySessions?.count || 0 }})</h4>
                <pre *ngIf="indexedDBData.partySessions?.data?.length">{{ indexedDBData.partySessions.data | json }}</pre>
                <p *ngIf="!indexedDBData.partySessions?.data?.length">No party sessions found</p>
              </div>
            </mat-tab>

            <mat-tab label="Party Shares">
              <div class="debug-content">
                <h4>Party Shares ({{ indexedDBData.partyShares?.count || 0 }})</h4>
                <pre *ngIf="indexedDBData.partyShares?.data?.length">{{ indexedDBData.partyShares.data | json }}</pre>
                <p *ngIf="!indexedDBData.partyShares?.data?.length">No party shares found</p>
              </div>
            </mat-tab>

            <mat-tab label="Communication Keys">
              <div class="debug-content">
                <h4>Communication Keys ({{ indexedDBData.communicationKeys?.count || 0 }})</h4>
                <pre *ngIf="indexedDBData.communicationKeys?.data?.length">{{ indexedDBData.communicationKeys.data | json }}</pre>
                <p *ngIf="!indexedDBData.communicationKeys?.data?.length">No communication keys found</p>
              </div>
            </mat-tab>

            <mat-tab label="Webhook Events">
              <div class="debug-content">
                <h4>Webhook Events ({{ indexedDBData.webhookEvents?.count || 0 }})</h4>
                <pre *ngIf="indexedDBData.webhookEvents?.data?.length">{{ indexedDBData.webhookEvents.data | json }}</pre>
                <p *ngIf="!indexedDBData.webhookEvents?.data?.length">No webhook events found</p>
              </div>
            </mat-tab>

            <mat-tab label="Party Config">
              <div class="debug-content">
                <h4>Party Configuration ({{ indexedDBData.partyConfig?.count || 0 }})</h4>
                <pre *ngIf="indexedDBData.partyConfig?.data?.length">{{ indexedDBData.partyConfig.data | json }}</pre>
                <p *ngIf="!indexedDBData.partyConfig?.data?.length">No party configuration found</p>
              </div>
            </mat-tab>
          </mat-tab-group>
        </mat-card-content>
      </mat-card>

      <!-- Recent Sessions -->
      <mat-card class="sessions-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>history</mat-icon>
            Recent Sessions
          </mat-card-title>
          <mat-card-subtitle>{{ recentSessions.length }} sessions found</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div *ngIf="loading" class="loading">
            <mat-progress-bar mode="indeterminate"></mat-progress-bar>
            <p>Loading sessions...</p>
          </div>
          
          <div *ngIf="!loading && recentSessions.length === 0" class="empty-state">
            <mat-icon>inbox</mat-icon>
            <p>No sessions found. Create your first session to get started.</p>
          </div>
          
          <mat-list *ngIf="!loading && recentSessions.length > 0">
            <mat-list-item *ngFor="let session of recentSessions">
              <mat-icon matListItemIcon>{{ getStatusIcon(session.status) }}</mat-icon>
              <div matListItemTitle>{{ session.operation }} - {{ session.sessionId.substring(0, 8) }}...</div>
              <div matListItemLine>
                <span>Status: {{ session.status }}</span>
                <span class="spacer"></span>
                <span>Parties: {{ getReadyPartiesCount(session) }}/{{ getTotalPartiesCount(session) }}</span>
                <span class="spacer"></span>
                <span>Created: {{ session.createdAt | date:'short' }}</span>
              </div>
            </mat-list-item>
          </mat-list>
        </mat-card-content>
      </mat-card>

      <!-- Statistics -->
      <mat-card class="stats-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>analytics</mat-icon>
            Statistics
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-number">{{ totalSessions }}</div>
              <div class="stat-label">Total Sessions</div>
            </div>
            <div class="stat-item">
              <div class="stat-number">{{ activeSessions }}</div>
              <div class="stat-label">Active Sessions</div>
            </div>
            <div class="stat-item">
              <div class="stat-number">{{ completedSessions }}</div>
              <div class="stat-label">Completed</div>
            </div>
            <div class="stat-item">
              <div class="stat-number">{{ failedSessions }}</div>
              <div class="stat-label">Failed</div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .dashboard-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }

    h1 {
      margin-bottom: 30px;
      color: #333;
    }

    .status-card, .actions-card, .indexeddb-card, .sessions-card, .stats-card {
      margin-bottom: 20px;
    }

    .status-card, .actions-card, .indexeddb-card, .party-card, .sessions-card, .stats-card {
      margin-bottom: 20px;
    }

    .status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
    }

    .status-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px;
      background: #f5f5f5;
      border-radius: 4px;
    }

    .status-label {
      font-weight: 500;
    }

    .status-value.healthy {
      color: #4caf50;
    }

    .status-value:not(.healthy) {
      color: #f44336;
    }

    .rotating {
      animation: rotate 1s linear infinite;
    }

    @keyframes rotate {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .actions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
    }

    .actions-grid button {
      height: 60px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .loading {
      text-align: center;
      padding: 20px;
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

    .status-badge {
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;
    }

    .status-badge.pending {
      background: #fff3cd;
      color: #856404;
    }

    .status-badge.active {
      background: #d1ecf1;
      color: #0c5460;
    }

    .status-badge.completed {
      background: #d4edda;
      color: #155724;
    }

    .status-badge.failed {
      background: #f8d7da;
      color: #721c24;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 20px;
    }

    .stat-item {
      text-align: center;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 8px;
    }

    .stat-number {
      font-size: 2em;
      font-weight: bold;
      color: #1976d2;
    }

    .stat-label {
      margin-top: 8px;
      color: #666;
      font-size: 14px;
    }

    mat-card-header {
      margin-bottom: 16px;
    }

    mat-card-title {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .debug-card {
      margin-top: 20px;
      background-color: #f5f5f5;
      border: 1px solid #ddd;
    }

    .debug-content {
      padding: 16px;
      background-color: white;
      border-radius: 4px;
      margin: 8px 0;
    }

    .debug-content pre {
      background-color: #f8f8f8;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      padding: 12px;
      overflow-x: auto;
      font-size: 12px;
      line-height: 1.4;
      max-height: 400px;
      overflow-y: auto;
    }

    .error-message {
      color: #d32f2f;
      background-color: #ffebee;
      border: 1px solid #ffcdd2;
      border-radius: 4px;
      padding: 12px;
      margin: 8px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .debug-content h4 {
      margin: 0 0 12px 0;
      color: #333;
      font-weight: 500;
    }

    .party-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 20px;
      margin-bottom: 20px;
    }

    .party-stat {
      text-align: center;
      padding: 16px;
      background: #e3f2fd;
      border-radius: 8px;
      border: 1px solid #bbdefb;
    }

    .party-content {
      padding: 16px 0;
    }

    .party-session-item, .party-share-item, .party-event-item {
      padding: 12px;
      margin-bottom: 8px;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      background: #fafafa;
    }

    .session-header, .share-header, .event-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .session-id, .share-received, .event-time {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      color: #666;
    }

    .session-status {
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;
    }

    .session-status.initialized {
      background: #fff3cd;
      color: #856404;
    }

    .session-status.share_received {
      background: #d1ecf1;
      color: #0c5460;
    }

    .session-status.ready {
      background: #d4edda;
      color: #155724;
    }

    .session-status.completed {
      background: #d4edda;
      color: #155724;
    }

    .session-status.failed {
      background: #f8d7da;
      color: #721c24;
    }

    .session-details, .share-details {
      display: flex;
      gap: 16px;
      font-size: 14px;
      color: #666;
    }

    .event-type {
      font-weight: 500;
      color: #333;
    }

    .event-session {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      color: #666;
    }

    .summary-card {
      margin-top: 20px;
      background-color: #f5f5f5;
      border: 1px solid #ddd;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 20px;
    }

    .summary-item {
      text-align: center;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 8px;
      border: 1px solid #bbdefb;
    }

    .summary-number {
      font-size: 2em;
      font-weight: bold;
      color: #1976d2;
    }

    .summary-label {
      margin-top: 8px;
      color: #666;
      font-size: 14px;
    }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  private healthCheckInterval?: any;

  activeSessions = 0;
  completedSessions = 0;
  coordinatorHealthy = false;
  failedSessions = 0;
  healthChecking = false;
  lastHealthCheck?: Date;
  loading = false;
  partyAHealthy = false;
  partyBHealthy = false;
  partyCHealthy = false;
  recentSessions: (Session | SessionSummary)[] = [];
  totalSessions = 0;
  
  // Debug properties
  showDebugInfo = false;
  indexedDBData: any = {};
  indexedDBError?: string;
  serverData: any = {};
  serverError?: string;
  
  // Party-specific properties
  isActingAsParty = false;
  currentPartyId: number | null = null;
  partySessions: any[] = [];
  partyShares: any[] = [];
  partyWebhookEvents: any[] = [];
  
  systemHealth = {
    status: 'pending',
    checking: false,
    api: 'pending',
    db: 'pending',
    lastCheck: new Date()
  };

  constructor(
    private apiService: ApiService,
    private indexedDBService: IndexedDBService,
    private partyService: PartyService
  ) {}

  ngOnInit() {
    this.checkSystemHealth();
    this.loadRecentSessions();
    this.loadAllDebugData();
    this.syncServerToIndexedDB(); // Automatically sync server data to IndexedDB
    this.checkPartyStatus(); // Check if acting as a party

    // Set up periodic health checks every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.checkSystemHealth();
    }, 30000);
  }

  ngOnDestroy() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }

  async checkSystemHealth() {
    this.systemHealth.checking = true;

    try {
      // Check coordinator health
      const coordinatorResponse = await fetch('http://localhost:3000/health');
      this.coordinatorHealthy = coordinatorResponse.ok;

      // Check party health
      const partyUrls = [
        'http://localhost:3001/health',
        'http://localhost:3002/health', 
        'http://localhost:3003/health'
      ];

      const partyHealthChecks = await Promise.allSettled(
        partyUrls.map(url => fetch(url))
      );

      this.partyAHealthy = partyHealthChecks[0].status === 'fulfilled' && partyHealthChecks[0].value.ok;
      this.partyBHealthy = partyHealthChecks[1].status === 'fulfilled' && partyHealthChecks[1].value.ok;
      this.partyCHealthy = partyHealthChecks[2].status === 'fulfilled' && partyHealthChecks[2].value.ok;

      // Overall system health
      const allHealthy = this.coordinatorHealthy && this.partyAHealthy && this.partyBHealthy && this.partyCHealthy;

      this.systemHealth = {
        ...this.systemHealth,
        status: allHealthy ? 'OK' : 'Error',
        api: this.coordinatorHealthy ? 'OK' : 'Error',
        db: 'OK', // Assuming DB is ok if coordinator is ok
        lastCheck: new Date()
      };

      this.lastHealthCheck = new Date();
    } catch (error) {
      this.coordinatorHealthy = false;
      this.partyAHealthy = false;
      this.partyBHealthy = false;
      this.partyCHealthy = false;

      this.systemHealth = {
        ...this.systemHealth,
        status: 'Error',
        api: 'Error',
        db: 'Unknown',
        lastCheck: new Date()
      };

      console.error('System health check failed:', error);
    } finally {
      this.systemHealth.checking = false;
    }
  }

  async loadRecentSessions() {
    try {
      const response = await this.apiService.getSessions().toPromise();
      if (response) {
        this.recentSessions = response.slice(0, 10);
        this.calculateStats();
      }
    } catch (error) {
      console.error('Failed to load recent sessions:', error);
    }
  }

  calculateStats() {
    this.totalSessions = this.recentSessions.length;
    this.activeSessions = this.recentSessions.filter(s => s.status === 'active').length;
    this.completedSessions = this.recentSessions.filter(s => s.status === 'completed').length;
    this.failedSessions = this.recentSessions.filter(s => s.status === 'failed').length;
  }

  getReadyPartiesCount(session: Session | SessionSummary): number {
    // Handle both Session (with parties array) and SessionSummary (with parties number)
    if (Array.isArray(session.parties)) {
      return session.parties.filter(p => p.status === 'ready').length;
    } else if (typeof session.parties === 'number') {
      // For SessionSummary, use readyParties if available, otherwise assume all parties are ready
      return (session as any).readyParties || session.parties;
    }
    return 0;
  }

  getTotalPartiesCount(session: Session | SessionSummary): number {
    // Handle both Session (with parties array) and SessionSummary (with parties number)
    if (Array.isArray(session.parties)) {
      return session.parties.length;
    } else if (typeof session.parties === 'number') {
      return session.parties;
    }
    return 0;
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'pending': return 'schedule';
      case 'active': return 'play_circle';
      case 'completed': return 'check_circle';
      case 'failed': return 'error';
      default: return 'help';
    }
  }

  // Method to manually refresh system health
  async refreshHealth() {
    if (this.healthChecking) return; // Prevent multiple simultaneous checks
    await this.checkSystemHealth();
  }

  // Method to manually sync server data to IndexedDB
  async manualSync() {
    try {
      console.log('🔄 Manual sync triggered...');
      await this.syncServerToIndexedDB();
      console.log('✅ Manual sync completed');
    } catch (error) {
      console.error('❌ Manual sync failed:', error);
    }
  }

  // Method to manually refresh IndexedDB data
  async refreshIndexedDB() {
    try {
      console.log('🔄 Refreshing IndexedDB data...');
      await this.loadIndexedDBData();
      console.log('✅ IndexedDB data refreshed');
    } catch (error) {
      console.error('❌ Failed to refresh IndexedDB data:', error);
    }
  }

  // Test method to add sample data to IndexedDB
  async addTestData() {
    try {
      console.log('🧪 Adding test data to IndexedDB...');
      
      // Add a test session
      await this.indexedDBService.storeSession({
        sessionId: 'test-session-123',
        status: 'active',
        operation: 'key_generation',
        metadata: {
          parties: 3,
          readyParties: 2,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Add a test share
      await this.indexedDBService.storeShare({
        sessionId: 'test-session-123',
        partyId: 1,
        share: 'test-share-data',
        commitment: 'test-commitment',
        nonce: 'test-nonce',
        createdAt: new Date()
      });

      console.log('✅ Test data added successfully');
      
      // Refresh the IndexedDB data display
      await this.loadIndexedDBData();
      
    } catch (error) {
      console.error('❌ Failed to add test data:', error);
    }
  }

  // Debug method to load IndexedDB data
  async loadIndexedDBData() {
    try {
      this.indexedDBError = undefined;
      
      // First validate the database
      const isValid = await this.indexedDBService.validateDatabase();
      
      if (!isValid) {
        console.log('⚠️ Database validation failed, resetting...');
        await this.indexedDBService.resetDatabase();
      }
      
      // Use the IndexedDB service instead of direct access
      const debugData = await this.indexedDBService.debugViewAllData();
      this.indexedDBData = debugData;
      
    } catch (error: any) {
      this.indexedDBError = `Error accessing IndexedDB: ${error.message}`;
      console.error('IndexedDB access error:', error);
      
      // If there's a version mismatch error, suggest resetting
      if (error.message.includes('object stores was not found') || 
          error.message.includes('transaction') ||
          error.message.includes('upgrade')) {
        this.indexedDBError = `Database version mismatch. Please reset the database.`;
      }
      
      // If there's still an error, try resetting the database
      try {
        console.log('🔄 Attempting database reset due to error...');
        await this.indexedDBService.resetDatabase();
        const debugData = await this.indexedDBService.debugViewAllData();
        this.indexedDBData = debugData;
        this.indexedDBError = undefined;
      } catch (resetError) {
        this.indexedDBError = `Database reset failed: ${resetError}`;
        console.error('Database reset error:', resetError);
      }
    }
  }

  // Debug method to load server data
  async loadServerData() {
    try {
      this.serverError = undefined;
      
      // Get sessions from server
      const sessionsResponse = await this.apiService.getSessions().toPromise();
      
      this.serverData = {
        sessions: {
          count: sessionsResponse?.length || 0,
          data: sessionsResponse || []
        },
        timestamp: new Date().toISOString()
      };
      
      console.log('🔍 Server Data:', this.serverData);
      
    } catch (error: any) {
      this.serverError = `Error loading server data: ${error.message}`;
      console.error(this.serverError);
    }
  }

  // Debug method to sync server data to IndexedDB
  async syncServerToIndexedDB() {
    try {
      console.log('🔄 Syncing server data to IndexedDB...');
      
      // Load server data first
      await this.loadServerData();
      
      if (this.serverData.sessions?.data) {
        // Clear existing IndexedDB data
        await this.indexedDBService.debugClearAllData();
        
        // Store each session in IndexedDB
        for (const session of this.serverData.sessions.data) {
          await this.indexedDBService.storeSession({
            sessionId: session.sessionId,
            status: session.status,
            operation: session.operation,
            metadata: {
              parties: session.parties,
              readyParties: session.readyParties,
              createdAt: session.createdAt,
              expiresAt: session.expiresAt
            },
            createdAt: new Date(session.createdAt),
            updatedAt: new Date()
          });
        }
        
        console.log(`✅ Synced ${this.serverData.sessions.data.length} sessions to IndexedDB`);
        
        // Reload IndexedDB data
        await this.loadIndexedDBData();
      }
      
    } catch (error) {
      console.error('❌ Error syncing server data to IndexedDB:', error);
    }
  }

  // Debug method to load all data (both server and IndexedDB)
  async loadAllDebugData() {
    await Promise.all([
      this.loadServerData(),
      this.loadIndexedDBData()
    ]);
  }

  async checkPartyStatus() {
    this.isActingAsParty = this.partyService.isActingAsParty();
    this.currentPartyId = this.partyService.getCurrentPartyId();
    
    if (this.isActingAsParty) {
      await this.loadPartyData();
      
      // Subscribe to webhook events
      this.partyService.getWebhookEvents().subscribe(async (event) => {
        console.log('📡 Received webhook event:', event);
        await this.loadPartyData(); // Refresh party data
      });
    }
  }

  async loadPartyData() {
    if (!this.isActingAsParty) return;
    
    try {
      this.partySessions = await this.partyService.getPartySessions();
      this.partyShares = await this.partyService.getPartyShares();
      this.partyWebhookEvents = await this.partyService.getPartyWebhookEvents();
    } catch (error) {
      console.error('Failed to load party data:', error);
    }
  }

  async resetIndexedDB() {
    try {
      console.log('🔄 Resetting IndexedDB...');
      await this.indexedDBService.resetDatabase();
      console.log('✅ IndexedDB reset');
      
      // Refresh the IndexedDB data display
      await this.loadIndexedDBData();
    } catch (error) {
      console.error('❌ Failed to reset IndexedDB:', error);
    }
  }
} 