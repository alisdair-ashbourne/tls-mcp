import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { ApiService, SessionSummary } from '../../services/api.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { FormsModule } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-sessions',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    RouterLink,
    MatProgressSpinnerModule,
    MatCardModule,
    MatMenuModule,
    FormsModule,
    MatTooltipModule
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
          <mat-form-field appearance="outline">
            <mat-label>Search</mat-label>
            <input matInput (keyup)="applyFilter($event)" placeholder="Search by ID, operation, etc.">
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>
        </mat-card-content>
      </mat-card>

      <!-- Sessions Table -->
      <div class="mat-elevation-z8">
        <table mat-table [dataSource]="dataSource" matSort>
          <!-- Session ID Column -->
          <ng-container matColumnDef="sessionId">
            <th mat-header-cell *matHeaderCellDef mat-sort-header> Session ID </th>
            <td mat-cell *matCellDef="let row"> {{row.sessionId.substring(0, 8)}}... </td>
          </ng-container>

          <!-- Status Column -->
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef mat-sort-header> Status </th>
            <td mat-cell *matCellDef="let row"> {{row.status}} </td>
          </ng-container>

          <!-- Operation Column -->
          <ng-container matColumnDef="operation">
            <th mat-header-cell *matHeaderCellDef mat-sort-header> Operation </th>
            <td mat-cell *matCellDef="let row"> {{row.operation}} </td>
          </ng-container>

          <!-- Created Date Column -->
          <ng-container matColumnDef="createdAt">
            <th mat-header-cell *matHeaderCellDef mat-sort-header> Created </th>
            <td mat-cell *matCellDef="let row"> {{row.createdAt | date:'short'}} </td>
          </ng-container>

          <!-- Actions Column -->
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef> Actions </th>
            <td mat-cell *matCellDef="let row">
              <button mat-icon-button [routerLink]="['/sessions', row.sessionId]" matTooltip="View Details">
                <mat-icon>visibility</mat-icon>
              </button>
              <button 
                *ngIf="row.status === 'active'" 
                mat-icon-button 
                (click)="createSignature(row.sessionId)"
                matTooltip="Create Signature">
                <mat-icon>edit</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
          <tr class="mat-row" *matNoDataRow>
            <td class="mat-cell" colspan="5">No data matching the filter</td>
          </tr>
        </table>
        <mat-paginator [pageSizeOptions]="[5, 10, 25, 100]"></mat-paginator>
      </div>
    </div>
  `,
  styles: [`
    .sessions-container {
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .header h1 {
      margin: 0;
      color: #333;
    }

    .filters-card {
      margin-bottom: 20px;
    }

    .mat-elevation-z8 {
      border-radius: 8px;
      overflow: hidden;
    }

    table {
      width: 100%;
    }

    .mat-column-actions {
      width: 120px;
      text-align: center;
    }

    .mat-column-sessionId {
      width: 200px;
    }

    .mat-column-status {
      width: 100px;
    }

    .mat-column-operation {
      width: 150px;
    }

    .mat-column-createdAt {
      width: 150px;
    }

    mat-paginator {
      border-top: 1px solid #e0e0e0;
    }
  `]
})
export class SessionsComponent implements OnInit, AfterViewInit {
  displayedColumns: string[] = ['sessionId', 'status', 'operation', 'createdAt', 'actions'];
  dataSource: MatTableDataSource<SessionSummary>;
  sessions: SessionSummary[] = [];
  loading = true;

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(private apiService: ApiService) {
    this.dataSource = new MatTableDataSource(this.sessions);
  }

  ngOnInit() {
    this.loadSessions();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  async loadSessions() {
    this.loading = true;
    try {
      const response = await this.apiService.getSessions().toPromise();
      if (response) {
        this.sessions = response;
        this.dataSource.data = this.sessions;
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      this.loading = false;
    }
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  async createSignature(sessionId: string) {
    const message = prompt('Enter message to sign:');
    if (message) {
      try {
        const response = await this.apiService.createSignature(sessionId, message).toPromise();
        if (response) {
          alert('Signature created successfully!');
          this.loadSessions();
        }
      } catch (error) {
        alert('Failed to create signature.');
        console.error(error);
      }
    }
  }
}