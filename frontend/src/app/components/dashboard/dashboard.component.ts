import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatListModule } from '@angular/material/list';
import { RouterLink } from '@angular/router';
import { ApiService, SessionSummary } from '../../services/api.service';
import { MatTabsModule } from '@angular/material/tabs';

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
            <button mat-raised-button (click)="loadIndexedDBData()" [disabled]="showDebugInfo">
              <mat-icon>bug_report</mat-icon>
              Load IndexedDB Data
            </button>
            <button mat-raised-button (click)="showDebugInfo = !showDebugInfo">
              <mat-icon>{{ showDebugInfo ? 'visibility_off' : 'visibility' }}</mat-icon>
              {{ showDebugInfo ? 'Hide' : 'Show' }} Debug Info
            </button>
          </div>
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
                <h4>Sessions ({{ indexedDBData.sessions?.length || 0 }})</h4>
                <pre *ngIf="indexedDBData.sessions?.length">{{ indexedDBData.sessions | json }}</pre>
                <p *ngIf="!indexedDBData.sessions?.length">No sessions found</p>
              </div>
            </mat-tab>
            
            <mat-tab label="Shares">
              <div class="debug-content">
                <h4>Shares ({{ indexedDBData.shares?.length || 0 }})</h4>
                <pre *ngIf="indexedDBData.shares?.length">{{ indexedDBData.shares | json }}</pre>
                <p *ngIf="!indexedDBData.shares?.length">No shares found</p>
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
            <mat-list-item *ngFor="let session of recentSessions" [routerLink]="['/sessions', session.sessionId]">
              <mat-icon matListItemIcon [class]="getStatusIcon(session.status)">{{ getStatusIcon(session.status) }}</mat-icon>
              <div matListItemTitle>{{ session.operation | titlecase }}</div>
              <div matListItemLine>
                {{ session.readyParties }}/{{ session.parties }} parties ready • 
                {{ session.createdAt | date:'short' }}
              </div>
              <div matListItemMeta>
                <span class="status-badge" [class]="session.status">{{ session.status }}</span>
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

    .status-card, .actions-card, .sessions-card, .stats-card {
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
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  loading = false;
  healthChecking = false;
  coordinatorHealthy = false;
  partyAHealthy = false;
  partyBHealthy = false;
  partyCHealthy = false;
  lastHealthCheck?: Date;
  recentSessions: SessionSummary[] = [];
  totalSessions = 0;
  activeSessions = 0;
  completedSessions = 0;
  failedSessions = 0;
  private healthCheckInterval?: any;
  
  // Debug properties
  showDebugInfo = false;
  indexedDBData: any = {};
  indexedDBError?: string;

  constructor(private apiService: ApiService) {}

  ngOnInit() {
    this.checkSystemHealth();
    this.loadRecentSessions();
    
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
    this.healthChecking = true;
    console.log('🏥 Starting system health check...');
    
    try {
      console.log('🔍 Checking coordinator health...');
      const health = await this.apiService.getHealth().toPromise();
      this.coordinatorHealthy = health?.status === 'healthy';
      console.log('✅ Coordinator health check:', health);
    } catch (error) {
      console.error('💥 Coordinator health check failed:', error);
      this.coordinatorHealthy = false;
    }

    // Check party health by making actual HTTP requests
    console.log('🔍 Checking party health...');
    await Promise.all([
      this.checkPartyHealth('A', 3001),
      this.checkPartyHealth('B', 3002),
      this.checkPartyHealth('C', 3003)
    ]);
    this.healthChecking = false;
    this.lastHealthCheck = new Date();
    console.log('✅ System health check completed');
  }

  private async checkPartyHealth(partyName: string, port: number): Promise<void> {
    console.log(`🔍 Checking Party ${partyName} health on port ${port}...`);
    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const startTime = Date.now();
      const response = await fetch(`http://localhost:${port}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });
      const responseTime = Date.now() - startTime;
      
      clearTimeout(timeoutId);
      
      console.log(`📡 Party ${partyName} response:`, {
        status: response.status,
        ok: response.ok,
        responseTime: `${responseTime}ms`
      });
      
      if (response.ok) {
        const health = await response.json();
        const isHealthy = health.status === 'healthy';
        
        console.log(`✅ Party ${partyName} health check:`, health);
        this.setPartyHealth(partyName, isHealthy);
      } else {
        console.warn(`❌ Party ${partyName} returned status ${response.status}`);
        this.setPartyHealth(partyName, false);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`⏰ Party ${partyName} health check timed out`);
      } else {
        console.error(`💥 Failed to check Party ${partyName} health:`, error);
      }
      this.setPartyHealth(partyName, false);
    }
  }

  private setPartyHealth(partyName: string, healthy: boolean): void {
    switch (partyName) {
      case 'A':
        this.partyAHealthy = healthy;
        break;
      case 'B':
        this.partyBHealthy = healthy;
        break;
      case 'C':
        this.partyCHealthy = healthy;
        break;
    }
  }

  async loadRecentSessions() {
    this.loading = true;
    try {
      const response = await this.apiService.getSessions(undefined, 10).toPromise();
      if (response?.success) {
        this.recentSessions = response.sessions;
        this.calculateStats();
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      this.loading = false;
    }
  }

  calculateStats() {
    this.totalSessions = this.recentSessions.length;
    this.activeSessions = this.recentSessions.filter(s => s.status === 'active').length;
    this.completedSessions = this.recentSessions.filter(s => s.status === 'completed').length;
    this.failedSessions = this.recentSessions.filter(s => s.status === 'failed').length;
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

  // Debug method to load IndexedDB data
  async loadIndexedDBData() {
    try {
      this.indexedDBError = undefined;
      
      // Access IndexedDB directly
      const dbName = 'tls-mcp-db';
      const dbVersion = 1;
      
      const request = indexedDB.open(dbName, dbVersion);
      
      request.onerror = (event) => {
        this.indexedDBError = 'Failed to open IndexedDB';
        console.error('IndexedDB error:', event);
      };
      
      request.onsuccess = (event: any) => {
        const db = event.target.result;
        const transaction = db.transaction(['sessions', 'shares'], 'readonly');
        
        const sessionsStore = transaction.objectStore('sessions');
        const sharesStore = transaction.objectStore('shares');
        
        const sessionsRequest = sessionsStore.getAll();
        const sharesRequest = sharesStore.getAll();
        
        sessionsRequest.onsuccess = () => {
          this.indexedDBData.sessions = sessionsRequest.result;
        };
        
        sharesRequest.onsuccess = () => {
          this.indexedDBData.shares = sharesRequest.result;
        };
        
        transaction.oncomplete = () => {
          console.log('IndexedDB data loaded:', this.indexedDBData);
        };
        
        transaction.onerror = () => {
          this.indexedDBError = 'Failed to read IndexedDB data';
        };
      };
      
    } catch (error) {
      this.indexedDBError = `Error accessing IndexedDB: ${error}`;
      console.error('IndexedDB access error:', error);
    }
  }
} 