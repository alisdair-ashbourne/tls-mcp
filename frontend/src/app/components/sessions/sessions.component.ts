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
import { firstValueFrom } from 'rxjs';

@Component({
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
    RouterLink,
  ],
  selector: 'app-sessions',
  standalone: true,
  styleUrls: ['./sessions.component.scss'],
  templateUrl: './sessions.component.html',
})
export class SessionsComponent implements OnInit, AfterViewInit {
  displayedColumns: string[] = [
    'sessionId',
    'status',
    'operation',
    'createdAt',
    'actions',
  ];
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

      if (!response) return;

      this.sessions = response;
      this.dataSource.data = this.sessions;
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      this.loading = false;
    }
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;

    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (!this.dataSource.paginator) return;

    this.dataSource.paginator.firstPage();
  }

  async createSignature(sessionId: string) {
    const message = prompt('Enter message to sign:');
    if (message) {
      try {
        const response = await firstValueFrom(
          this.apiService.createSignature(sessionId, message)
        );

        if (!response) return;

        alert('Signature created successfully!');
        this.loadSessions();
      } catch (error) {
        alert('Failed to create signature.');
        console.error(error);
      }
    }
  }
}
