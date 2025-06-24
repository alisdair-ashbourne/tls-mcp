import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiService, SessionSummary, SignatureResponse } from '../../services/api.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-signature',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressBarModule,
    MatChipsModule,
    MatDividerModule,
    MatExpansionModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink
  ],
  template: `
    <div class="signature-container">
      <div class="header">
        <h1>Create Threshold Signature</h1>
        <p>Generate a threshold signature using an existing TLS-MCP session</p>
      </div>

      <!-- Session Selection -->
      <mat-card class="session-selection-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>list</mat-icon>
            Select Session
          </mat-card-title>
          <mat-card-subtitle>Choose an active session for signature creation</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div *ngIf="loadingSessions" class="loading">
            <mat-progress-bar mode="indeterminate"></mat-progress-bar>
            <p>Loading sessions...</p>
          </div>

          <div *ngIf="!loadingSessions && activeSessions.length === 0" class="empty-state">
            <mat-icon>inbox</mat-icon>
            <p>No active sessions found. Create a session first to generate signatures.</p>
            <button mat-raised-button color="primary" routerLink="/key-generation">
              Create Session
            </button>
          </div>

          <div *ngIf="!loadingSessions && activeSessions.length > 0" class="sessions-grid">
            <div 
              *ngFor="let session of activeSessions" 
              class="session-card"
              [class.selected]="selectedSessionId === session.sessionId"
              (click)="selectSession(session.sessionId)">
              <div class="session-header">
                <mat-icon>vpn_key</mat-icon>
                <div class="session-info">
                  <div class="session-id">{{ session.sessionId.substring(0, 8) }}...</div>
                  <div class="session-operation">{{ session.operation | titlecase }}</div>
                </div>
                <mat-icon *ngIf="selectedSessionId === session.sessionId" class="selected-icon">check_circle</mat-icon>
              </div>
              <div class="session-details">
                <div class="parties-info">
                  <span class="parties-count">{{ getReadyPartiesCount(session) }}/{{ getTotalPartiesCount(session) }} parties ready</span>
                  <mat-progress-bar 
                    mode="determinate" 
                    [value]="(getReadyPartiesCount(session) / getTotalPartiesCount(session)) * 100"
                    [class]="getProgressColor(getReadyPartiesCount(session), getTotalPartiesCount(session))">
                  </mat-progress-bar>
                </div>
                <div class="session-meta">
                  <span class="created-date">{{ session.createdAt | date:'short' }}</span>
                </div>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Signature Form -->
      <mat-card *ngIf="selectedSessionId" class="signature-form-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>edit</mat-icon>
            Create Signature
          </mat-card-title>
          <mat-card-subtitle>Generate a threshold signature for the selected session</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="signatureForm" (ngSubmit)="onSubmit()">
            <div class="form-grid">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Message to Sign</mat-label>
                <textarea 
                  matInput 
                  formControlName="message" 
                  placeholder="Enter the message you want to sign..."
                  rows="4"
                  required>
                </textarea>
                <mat-error *ngIf="signatureForm.get('message')?.hasError('required')">
                  Message is required
                </mat-error>
                <mat-hint>This message will be signed by all participating parties</mat-hint>
              </mat-form-field>

              <div class="signature-info">
                <h4>Signature Information</h4>
                <div class="info-grid">
                  <div class="info-item">
                    <span class="label">Session ID:</span>
                    <span class="value">{{ selectedSessionId }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">Parties Required:</span>
                    <span class="value">{{ getTotalPartiesCount(getSelectedSession()!) || 0 }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">Ready Parties:</span>
                    <span class="value">{{ getReadyPartiesCount(getSelectedSession()!) || 0 }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">Threshold:</span>
                    <span class="value">3/3 (All parties required)</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="form-actions">
              <button 
                type="submit" 
                mat-raised-button 
                color="primary" 
                [disabled]="!signatureForm.valid || creatingSignature">
                <mat-icon>edit</mat-icon>
                {{ creatingSignature ? 'Creating Signature...' : 'Create Signature' }}
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <!-- Signature Result -->
      <mat-card *ngIf="signatureResult" class="result-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon class="success-icon">check_circle</mat-icon>
            Signature Created Successfully!
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="result-content">
            <div class="result-section">
              <h4>Signature Details</h4>
              <div class="result-grid">
                <div class="result-item">
                  <span class="label">Message:</span>
                  <span class="value">{{ signatureResult.message }}</span>
                </div>
                <div class="result-item">
                  <span class="label">Message Hash:</span>
                  <code class="value">{{ signatureResult.messageHash }}</code>
                </div>
                <div class="result-item">
                  <span class="label">Status:</span>
                  <span class="value">{{ signatureResult.status }}</span>
                </div>
                <div class="result-item">
                  <span class="label">Session ID:</span>
                  <span class="value">{{ signatureResult.sessionId }}</span>
                </div>
              </div>
            </div>

            <mat-divider></mat-divider>

            <div class="result-section">
              <h4>Verification</h4>
              <div class="verification-info">
                <p>This signature was created using Shamir's Secret Sharing with all three parties participating:</p>
                <ul>
                  <li>Message hash: <code>{{ signatureResult.messageHash }}</code></li>
                  <li>Signature components combined from all parties</li>
                  <li>Threshold verification: 3/3 parties participated</li>
                  <li>Signature is cryptographically secure</li>
                </ul>
              </div>
            </div>
          </div>
        </mat-card-content>
        <mat-card-actions>
          <button mat-button (click)="resetForm()">Create Another Signature</button>
          <button mat-raised-button color="primary" [routerLink]="['/sessions', signatureResult.sessionId]">
            View Session
          </button>
          <button mat-raised-button color="accent" (click)="copySignature()">
            <mat-icon>content_copy</mat-icon>
            Copy Signature
          </button>
        </mat-card-actions>
      </mat-card>

      <!-- Error Display -->
      <mat-card *ngIf="error" class="error-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon class="error-icon">error</mat-icon>
            Error
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <p>{{ error }}</p>
        </mat-card-content>
        <mat-card-actions>
          <button mat-button (click)="clearError()">Dismiss</button>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: [`
    .signature-container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 20px;
    }

    .header {
      text-align: center;
      margin-bottom: 30px;
    }

    .header h1 {
      margin-bottom: 8px;
      color: #333;
    }

    .header p {
      color: #666;
      font-size: 16px;
    }

    .session-selection-card, .signature-form-card, .result-card, .error-card {
      margin-bottom: 20px;
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

    .sessions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 16px;
    }

    .session-card {
      border: 2px solid #eee;
      border-radius: 8px;
      padding: 16px;
      cursor: pointer;
      transition: all 0.2s ease;
      background: #fafafa;
    }

    .session-card:hover {
      border-color: #1976d2;
      background: #f0f8ff;
    }

    .session-card.selected {
      border-color: #4caf50;
      background: #f1f8e9;
    }

    .session-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .session-info {
      flex: 1;
    }

    .session-id {
      font-weight: 500;
      font-family: 'Courier New', monospace;
    }

    .session-operation {
      font-size: 12px;
      color: #666;
    }

    .selected-icon {
      color: #4caf50;
    }

    .session-details {
      margin-top: 12px;
    }

    .parties-info {
      margin-bottom: 8px;
    }

    .parties-count {
      font-size: 12px;
      color: #666;
      margin-bottom: 4px;
      display: block;
    }

    .session-meta {
      font-size: 12px;
      color: #999;
    }

    .form-grid {
      display: grid;
      gap: 20px;
    }

    .full-width {
      width: 100%;
    }

    .signature-info {
      background: #f5f5f5;
      padding: 16px;
      border-radius: 6px;
    }

    .signature-info h4 {
      margin-top: 0;
      margin-bottom: 12px;
      color: #333;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 8px;
    }

    .info-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .label {
      font-weight: 500;
      color: #666;
    }

    .value {
      font-family: 'Courier New', monospace;
      font-size: 12px;
    }

    .form-actions {
      margin-top: 20px;
      text-align: center;
    }

    .result-content {
      padding: 16px 0;
    }

    .result-section {
      margin-bottom: 24px;
    }

    .result-section h4 {
      margin-bottom: 16px;
      color: #333;
    }

    .result-grid {
      display: grid;
      gap: 12px;
    }

    .result-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
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

    .verification-info {
      background: #f5f5f5;
      padding: 16px;
      border-radius: 6px;
    }

    .verification-info p {
      margin-bottom: 12px;
      color: #333;
    }

    .verification-info ul {
      margin: 0;
      padding-left: 20px;
    }

    .verification-info li {
      margin-bottom: 4px;
      color: #666;
    }

    .verification-info code {
      background: #e0e0e0;
      padding: 2px 4px;
      border-radius: 3px;
      font-size: 12px;
    }

    .success-icon {
      color: #4caf50;
      margin-right: 8px;
    }

    .error-icon {
      color: #f44336;
      margin-right: 8px;
    }

    mat-card-actions {
      display: flex;
      gap: 8px;
      justify-content: center;
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
export class SignatureComponent implements OnInit {
  loadingSessions = false;
  activeSessions: SessionSummary[] = [];
  selectedSessionId: string | null = null;
  signatureForm: FormGroup;
  creatingSignature = false;
  signatureResult: SignatureResponse | null = null;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {
    this.signatureForm = this.fb.group({
      sessionId: ['', Validators.required],
      message: ['', Validators.required]
    });
  }

  ngOnInit() {
    this.loadActiveSessions();
  }

  async loadActiveSessions() {
    this.loadingSessions = true;
    try {
      const response = await firstValueFrom(this.apiService.getSessions());
      this.activeSessions = response.filter((s: SessionSummary) => s.status === 'active');
    } catch (error) {
      console.error('Failed to load sessions:', error);
      this.error = 'Failed to load sessions';
    } finally {
      this.loadingSessions = false;
    }
  }

  selectSession(sessionId: string) {
    this.selectedSessionId = sessionId;
  }

  getSelectedSession(): SessionSummary | undefined {
    return this.activeSessions.find(s => s.sessionId === this.selectedSessionId);
  }

  getProgressColor(ready: number, total: number): string {
    const ratio = ready / total;
    if (ratio >= 0.8) return 'primary';
    if (ratio >= 0.5) return 'accent';
    return 'warn';
  }

  getReadyPartiesCount(session: SessionSummary): number {
    return session.readyParties;
  }

  getTotalPartiesCount(session: SessionSummary): number {
    return session.parties;
  }

  async onSubmit() {
    if (this.signatureForm.invalid) {
      return;
    }
    this.creatingSignature = true;
    this.error = null;
    
    try {
      const sessionId = this.signatureForm.get('sessionId')?.value;
      const message = this.signatureForm.get('message')?.value;
      const response = await this.apiService.createSignature(sessionId, message).toPromise();

      if (response) {
        this.signatureResult = response;
        this.snackBar.open('Signature created successfully!', 'Close', { duration: 3000 });
      }
    } catch (err: any) {
      this.error = err.error?.message || 'Failed to create signature.';
      console.error(err);
    } finally {
      this.creatingSignature = false;
    }
  }

  resetForm() {
    this.signatureForm.reset();
    this.signatureResult = null;
    this.error = null;
  }

  copySignature() {
    if (!this.signatureResult) return;
    
    const signatureData = {
      sessionId: this.signatureResult.sessionId,
      status: this.signatureResult.status,
      message: this.signatureResult.message,
      messageHash: this.signatureResult.messageHash
    };
    
    navigator.clipboard.writeText(JSON.stringify(signatureData, null, 2))
      .then(() => {
        this.snackBar.open('Signature data copied to clipboard!', 'Close', { duration: 3000 });
      })
      .catch(() => {
        this.snackBar.open('Failed to copy signature data', 'Close', { duration: 3000 });
      });
  }

  clearError() {
    this.error = null;
  }
} 