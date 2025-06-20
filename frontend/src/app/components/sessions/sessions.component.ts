import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, SessionSummary } from '../../services/api.service';

@Component({
  selector: 'app-sessions',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatPaginatorModule,
    MatChipsModule,
    MatMenuModule,
    FormsModule,
    RouterLink
  ],
  template: `
    <div class="sessions-container">
      <div class="header">
        <h1>TLS-MCP Sessions</h1>
        <button mat-raised-button color="primary" routerLink="/key-generation">
          <mat-icon>add</mat-icon>
          New Session
        </button>
      </div>

      <!-- Filters -->
      <mat-card class="filters-card">
        <mat-card-content>
          <div class="filters-grid">
            <mat-form-field appearance="outline">
              <mat-label>Search</mat-label>
              <input matInput [(ngModel)]="searchTerm" placeholder="Search sessions...">
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Status</mat-label>
              <mat-select [(ngModel)]="statusFilter">
                <mat-option value="">All Statuses</mat-option>
                <mat-option value="pending">Pending</mat-option>
                <mat-option value="active">Active</mat-option>
                <mat-option value="completed">Completed</mat-option>
                <mat-option value="failed">Failed</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Operation</mat-label>
              <mat-select [(ngModel)]="operationFilter">
                <mat-option value="">All Operations</mat-option>
                <mat-option value="key_generation">Key Generation</mat-option>
                <mat-option value="key_reconstruction">Key Reconstruction</mat-option>
                <mat-option value="signature">Signature</mat-option>
                <mat-option value="verification">Verification</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Sessions Table -->
      <mat-card>
        <mat-card-content>
          <div *ngIf="loading" class="loading">
            <mat-progress-bar mode="indeterminate"></mat-progress-bar>
            <p>Loading sessions...</p>
          </div>

          <div *ngIf="!loading && filteredSessions.length === 0" class="empty-state">
            <mat-icon>inbox</mat-icon>
            <p>No sessions found matching your criteria.</p>
            <button mat-raised-button color="primary" routerLink="/key-generation">
              Create Your First Session
            </button>
          </div>

          <div *ngIf="!loading && filteredSessions.length > 0" class="table-container">
            <table mat-table [dataSource]="paginatedSessions" class="sessions-table">
              <!-- Session ID Column -->
              <ng-container matColumnDef="sessionId">
                <th mat-header-cell *matHeaderCellDef>Session ID</th>
                <td mat-cell *matCellDef="let session">
                  <div class="session-id">
                    <code>{{ session.sessionId.substring(0, 8) }}...</code>
                    <button mat-icon-button [matMenuTriggerFor]="menu" class="menu-button">
                      <mat-icon>more_vert</mat-icon>
                    </button>
                    <mat-menu #menu="matMenu">
                      <button mat-menu-item [routerLink]="['/sessions', session.sessionId]">
                        <mat-icon>visibility</mat-icon>
                        View Details
                      </button>
                      <button mat-menu-item (click)="copySessionId(session.sessionId)">
                        <mat-icon>content_copy</mat-icon>
                        Copy ID
                      </button>
                    </mat-menu>
                  </div>
                </td>
              </ng-container>

              <!-- Operation Column -->
              <ng-container matColumnDef="operation">
                <th mat-header-cell *matHeaderCellDef>Operation</th>
                <td mat-cell *matCellDef="let session">
                  <mat-chip-set>
                    <mat-chip [color]="getOperationColor(session.operation)" selected>
                      {{ session.operation | titlecase }}
                    </mat-chip>
                  </mat-chip-set>
                </td>
              </ng-container>

              <!-- Status Column -->
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Status</th>
                <td mat-cell *matCellDef="let session">
                  <div class="status-cell">
                    <mat-icon [class]="getStatusIcon(session.status)">{{ getStatusIcon(session.status) }}</mat-icon>
                    <span class="status-badge" [class]="session.status">{{ session.status }}</span>
                  </div>
                </td>
              </ng-container>

              <!-- Parties Column -->
              <ng-container matColumnDef="parties">
                <th mat-header-cell *matHeaderCellDef>Parties</th>
                <td mat-cell *matCellDef="let session">
                  <div class="parties-info">
                    <span class="parties-count">{{ session.readyParties }}/{{ session.parties }}</span>
                    <mat-progress-bar 
                      mode="determinate" 
                      [value]="(session.readyParties / session.parties) * 100"
                      [class]="getProgressColor(session.readyParties, session.parties)">
                    </mat-progress-bar>
                  </div>
                </td>
              </ng-container>

              <!-- Created Date Column -->
              <ng-container matColumnDef="createdAt">
                <th mat-header-cell *matHeaderCellDef>Created</th>
                <td mat-cell *matCellDef="let session">
                  {{ session.createdAt | date:'short' }}
                </td>
              </ng-container>

              <!-- Actions Column -->
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>Actions</th>
                <td mat-cell *matCellDef="let session">
                  <div class="actions">
                    <button mat-icon-button [routerLink]="['/sessions', session.sessionId]" matTooltip="View Details">
                      <mat-icon>visibility</mat-icon>
                    </button>
                    <button 
                      *ngIf="session.status === 'active'" 
                      mat-icon-button 
                      (click)="reconstructKey(session.sessionId)"
                      matTooltip="Reconstruct Key">
                      <mat-icon>vpn_key</mat-icon>
                    </button>
                    <button 
                      *ngIf="session.status === 'active'" 
                      mat-icon-button 
                      (click)="createSignature(session.sessionId)"
                      matTooltip="Create Signature">
                      <mat-icon>edit</mat-icon>
                    </button>
                  </div>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
            </table>

            <mat-paginator 
              [length]="filteredSessions.length"
              [pageSize]="pageSize"
              [pageSizeOptions]="[5, 10, 25, 50]"
              (page)="onPageChange($event)">
            </mat-paginator>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .sessions-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    h1 {
      margin: 0;
      color: #333;
    }

    .filters-card {
      margin-bottom: 20px;
    }

    .filters-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 16px;
    }

    .loading {
      text-align: center;
      padding: 40px;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #666;
    }

    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
    }

    .table-container {
      overflow-x: auto;
    }

    .sessions-table {
      width: 100%;
    }

    .session-id {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .session-id code {
      font-family: 'Courier New', monospace;
      background: #f5f5f5;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
    }

    .menu-button {
      opacity: 0;
      transition: opacity 0.2s;
    }

    .session-id:hover .menu-button {
      opacity: 1;
    }

    .status-cell {
      display: flex;
      align-items: center;
      gap: 8px;
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

    .parties-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .parties-count {
      font-size: 12px;
      color: #666;
    }

    .actions {
      display: flex;
      gap: 4px;
    }

    mat-paginator {
      margin-top: 16px;
    }

    .mat-column-sessionId {
      width: 200px;
    }

    .mat-column-operation {
      width: 150px;
    }

    .mat-column-status {
      width: 120px;
    }

    .mat-column-parties {
      width: 100px;
    }

    .mat-column-createdAt {
      width: 150px;
    }

    .mat-column-actions {
      width: 120px;
    }
  `]
})
export class SessionsComponent implements OnInit {
  loading = false;
  sessions: SessionSummary[] = [];
  filteredSessions: SessionSummary[] = [];
  paginatedSessions: SessionSummary[] = [];
  
  searchTerm = '';
  statusFilter = '';
  operationFilter = '';
  
  pageSize = 10;
  currentPage = 0;
  
  displayedColumns = ['sessionId', 'operation', 'status', 'parties', 'createdAt', 'actions'];

  constructor(private apiService: ApiService) {}

  ngOnInit() {
    this.loadSessions();
  }

  async loadSessions() {
    this.loading = true;
    try {
      const response = await this.apiService.getSessions(undefined, 100).toPromise();
      if (response?.success) {
        this.sessions = response.sessions;
        this.applyFilters();
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      this.loading = false;
    }
  }

  applyFilters() {
    this.filteredSessions = this.sessions.filter(session => {
      const matchesSearch = !this.searchTerm || 
        session.sessionId.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        session.operation.toLowerCase().includes(this.searchTerm.toLowerCase());
      
      const matchesStatus = !this.statusFilter || session.status === this.statusFilter;
      const matchesOperation = !this.operationFilter || session.operation === this.operationFilter;
      
      return matchesSearch && matchesStatus && matchesOperation;
    });
    
    this.updatePaginatedSessions();
  }

  updatePaginatedSessions() {
    const startIndex = this.currentPage * this.pageSize;
    this.paginatedSessions = this.filteredSessions.slice(startIndex, startIndex + this.pageSize);
  }

  onPageChange(event: PageEvent) {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.updatePaginatedSessions();
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

  getOperationColor(operation: string): string {
    switch (operation) {
      case 'key_generation': return 'primary';
      case 'key_reconstruction': return 'accent';
      case 'signature': return 'warn';
      case 'verification': return 'primary';
      default: return 'primary';
    }
  }

  getProgressColor(ready: number, total: number): string {
    const percentage = (ready / total) * 100;
    if (percentage === 100) return 'success';
    if (percentage >= 66) return 'primary';
    if (percentage >= 33) return 'accent';
    return 'warn';
  }

  copySessionId(sessionId: string) {
    navigator.clipboard.writeText(sessionId);
    // You could add a snackbar notification here
  }

  async reconstructKey(sessionId: string) {
    try {
      const response = await this.apiService.reconstructKey(sessionId).toPromise();
      if (response?.success) {
        console.log('Key reconstructed:', response);
        // You could add a snackbar notification here
      }
    } catch (error) {
      console.error('Failed to reconstruct key:', error);
    }
  }

  async createSignature(sessionId: string) {
    // This would typically open a dialog to input the message
    const message = prompt('Enter message to sign:');
    if (message) {
      try {
        const response = await this.apiService.createSignature(sessionId, { message }).toPromise();
        if (response?.success) {
          console.log('Signature created:', response);
          // You could add a snackbar notification here
        }
      } catch (error) {
        console.error('Failed to create signature:', error);
      }
    }
  }
} 