import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatListModule } from '@angular/material/list';
import { RouterLink } from '@angular/router';
import { ApiService, SessionSummary } from '../../services/api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
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
            <mat-icon>monitor</mat-icon>
            System Status
          </mat-card-title>
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
              <mat-icon>vpn_key</mat-icon>
              Generate Key
            </button>
            <button mat-raised-button color="accent" routerLink="/signature">
              <mat-icon>edit</mat-icon>
              Create Signature
            </button>
            <button mat-raised-button routerLink="/sessions">
              <mat-icon>list</mat-icon>
              View Sessions
            </button>
          </div>
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
  `]
})
export class DashboardComponent implements OnInit {
  loading = false;
  coordinatorHealthy = false;
  partyAHealthy = false;
  partyBHealthy = false;
  partyCHealthy = false;
  recentSessions: SessionSummary[] = [];
  totalSessions = 0;
  activeSessions = 0;
  completedSessions = 0;
  failedSessions = 0;

  constructor(private apiService: ApiService) {}

  ngOnInit() {
    this.checkSystemHealth();
    this.loadRecentSessions();
  }

  async checkSystemHealth() {
    try {
      const health = await this.apiService.getHealth().toPromise();
      this.coordinatorHealthy = health?.status === 'healthy';
    } catch (error) {
      this.coordinatorHealthy = false;
    }

    // Check party health (simplified for demo)
    this.partyAHealthy = true;
    this.partyBHealthy = true;
    this.partyCHealthy = true;
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
} 