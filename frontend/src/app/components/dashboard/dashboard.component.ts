import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import {
  ApiService,
  Session,
  SessionSummary,
} from '../../services/api.service';
import { IndexedDBService } from '../../services/indexeddb.service';
import { PartyService } from '../../services/party.service';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressBarModule,
    MatDividerModule,
    RouterLink,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
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
  partyWebhookEvents: any[] = [];

  systemHealth = {
    status: 'pending',
    checking: false,
    api: 'pending',
    db: 'pending',
    lastCheck: new Date(),
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
        'http://localhost:3003/health',
      ];

      const partyHealthChecks = await Promise.allSettled(
        partyUrls.map((url) => fetch(url))
      );

      this.partyAHealthy =
        partyHealthChecks[0].status === 'fulfilled' &&
        partyHealthChecks[0].value.ok;
      this.partyBHealthy =
        partyHealthChecks[1].status === 'fulfilled' &&
        partyHealthChecks[1].value.ok;
      this.partyCHealthy =
        partyHealthChecks[2].status === 'fulfilled' &&
        partyHealthChecks[2].value.ok;

      // Overall system health
      const allHealthy =
        this.coordinatorHealthy &&
        this.partyAHealthy &&
        this.partyBHealthy &&
        this.partyCHealthy;

      this.systemHealth = {
        ...this.systemHealth,
        status: allHealthy ? 'OK' : 'Error',
        api: this.coordinatorHealthy ? 'OK' : 'Error',
        db: 'OK', // Assuming DB is ok if coordinator is ok
        lastCheck: new Date(),
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
        lastCheck: new Date(),
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
    this.activeSessions = this.recentSessions.filter(
      (s) => s.status === 'dkg_initiated' || s.status === 'signing_in_progress'
    ).length;
    this.completedSessions = this.recentSessions.filter(
      (s) => s.status === 'signature_completed'
    ).length;
    this.failedSessions = this.recentSessions.filter(
      (s) => s.status === 'failed'
    ).length;
  }

  getReadyPartiesCount(session: Session | SessionSummary): number {
    // Handle both Session (with parties array) and SessionSummary (with parties number)
    if (Array.isArray(session.parties)) {
      return session.parties.filter((p) => p.status === 'ready').length;
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
      case 'initialized':
        return 'schedule';
      case 'dkg_initiated':
        return 'vpn_key';
      case 'dkg_completed':
        return 'verified';
      case 'signing_in_progress':
        return 'edit';
      case 'signature_completed':
        return 'check_circle';
      case 'failed':
        return 'error';
      default:
        return 'help';
    }
  }

  // Method to manually refresh system health
  async refreshHealth() {
    this.healthChecking = true;
    await this.checkSystemHealth();
    this.healthChecking = false;
  }

  // Method to manually sync server data to local storage
  async manualSync() {
    try {
      console.log('🔄 Manual sync triggered...');
      await this.syncServerToIndexedDB();
      console.log('✅ Manual sync completed');
    } catch (error) {
      console.error('❌ Manual sync failed:', error);
    }
  }

  // Method to manually sync server data to local storage
  async syncServerToIndexedDB() {
    try {
      console.log('🔄 Syncing server data to local storage...');

      // Load server data first
      await this.loadServerData();

      if (this.serverData.sessions?.data) {
        // Clear existing local data
        await this.indexedDBService.debugClearAllData();

        // Store each session in local storage (metadata only)
        for (const session of this.serverData.sessions.data) {
          await this.indexedDBService.storeSession({
            sessionId: session.sessionId,
            status: session.status,
            operation: session.operation,
            metadata: {
              parties: session.parties,
              readyParties: session.readyParties,
              createdAt: session.createdAt,
              expiresAt: session.expiresAt,
            },
            createdAt: new Date(session.createdAt),
            updatedAt: new Date(),
          });
        }

        console.log(
          `✅ Synced ${this.serverData.sessions.data.length} sessions to local storage`
        );

        // Reload local data
        await this.loadIndexedDBData();
      }
    } catch (error) {
      console.error('❌ Error syncing server data to local storage:', error);
    }
  }

  // Debug method to load all data (both server and local storage)
  async loadAllDebugData() {
    await Promise.all([this.loadServerData(), this.loadIndexedDBData()]);
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
      // Note: We no longer store cryptographic shares in local storage for security
      // Shares are generated fresh for each operation
      this.partyWebhookEvents = await this.partyService.getPartyWebhookEvents();
    } catch (error) {
      console.error('Failed to load party data:', error);
    }
  }

  async resetIndexedDB() {
    try {
      console.log('🔄 Clearing all local data...');
      await this.indexedDBService.resetDatabase();
      console.log('✅ All local data cleared');

      // Refresh the local data display
      await this.loadIndexedDBData();
    } catch (error) {
      console.error('❌ Failed to clear local data:', error);
    }
  }

  // Method to manually refresh local data
  async refreshIndexedDB() {
    try {
      console.log('🔄 Refreshing local data...');
      await this.loadIndexedDBData();
      console.log('✅ Local data refreshed');
    } catch (error) {
      console.error('❌ Failed to refresh local data:', error);
    }
  }

  // Test method to add sample session data
  async addTestData() {
    try {
      console.log('🧪 Adding test session data...');

      // Add a test session (metadata only - no cryptographic material)
      await this.indexedDBService.storeSession({
        sessionId: 'test-session-123',
        status: 'dkg_completed',
        operation: 'key_generation',
        metadata: {
          parties: 3,
          readyParties: 2,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Note: We no longer store cryptographic shares in IndexedDB for security
      // Shares are generated fresh for each operation

      console.log('✅ Test session data added successfully');

      // Refresh the local data display
      await this.loadIndexedDBData();
    } catch (error) {
      console.error('❌ Failed to add test session data:', error);
    }
  }

  // Debug method to load local data
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
      this.indexedDBError = `Error accessing local data: ${error.message}`;
      console.error('Local data access error:', error);

      // If there's a version mismatch error, suggest resetting
      if (
        error.message.includes('object stores was not found') ||
        error.message.includes('transaction') ||
        error.message.includes('upgrade')
      ) {
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
          data: sessionsResponse || [],
        },
        timestamp: new Date().toISOString(),
      };

      console.log('🔍 Server Data:', this.serverData);
    } catch (error: any) {
      this.serverError = `Error loading server data: ${error.message}`;
      console.error(this.serverError);
    }
  }
}
