import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatStepperModule } from '@angular/material/stepper';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiService, Party } from '../../services/api.service';

@Component({
  selector: 'app-key-generation',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatStepperModule,
    MatProgressBarModule,
    MatChipsModule,
    MatDividerModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  template: `
    <div class="key-generation-container">
      <div class="header">
        <h1>Generate New Key</h1>
        <p>Create a new TLS-MCP session and generate a private key distributed among parties</p>
      </div>

      <mat-stepper #stepper [linear]="true" class="stepper">
        <!-- Step 1: Session Configuration -->
        <mat-step [stepControl]="sessionForm" label="Session Configuration">
          <form [formGroup]="sessionForm">
            <div class="step-content">
              <mat-card>
                <mat-card-header>
                  <mat-card-title>
                    <mat-icon>settings</mat-icon>
                    Session Settings
                  </mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="form-grid">
                    <mat-form-field appearance="outline">
                      <mat-label>Operation Type</mat-label>
                      <mat-select formControlName="operation" required>
                        <mat-option value="key_generation">Key Generation</mat-option>
                        <mat-option value="key_reconstruction">Key Reconstruction</mat-option>
                        <mat-option value="signature">Signature</mat-option>
                      </mat-select>
                      <mat-error *ngIf="sessionForm.get('operation')?.hasError('required')">
                        Operation type is required
                      </mat-error>
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                      <mat-label>Description</mat-label>
                      <input matInput formControlName="description" placeholder="Brief description of this session">
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                      <mat-label>Blockchain</mat-label>
                      <mat-select formControlName="blockchain">
                        <mat-option value="ethereum">Ethereum</mat-option>
                        <mat-option value="bitcoin">Bitcoin</mat-option>
                        <mat-option value="polygon">Polygon</mat-option>
                        <mat-option value="arbitrum">Arbitrum</mat-option>
                      </mat-select>
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                      <mat-label>Wallet Address</mat-label>
                      <input matInput formControlName="walletAddress" placeholder="0x...">
                      <mat-hint>Optional: Associated wallet address</mat-hint>
                    </mat-form-field>
                  </div>
                </mat-card-content>
              </mat-card>
            </div>
            <div class="step-actions">
              <button mat-button matStepperNext [disabled]="!sessionForm.valid">
                Next
                <mat-icon>arrow_forward</mat-icon>
              </button>
            </div>
          </form>
        </mat-step>

        <!-- Step 2: Party Configuration -->
        <mat-step [stepControl]="partiesForm" label="Party Configuration">
          <form [formGroup]="partiesForm">
            <div class="step-content">
              <mat-card>
                <mat-card-header>
                  <mat-card-title>
                    <mat-icon>people</mat-icon>
                    Configure Parties
                  </mat-card-title>
                  <mat-card-subtitle>Set up the three parties that will participate in the TLS-MCP session</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <div class="parties-grid">
                    <div *ngFor="let party of parties; let i = index" class="party-card">
                      <h3>Party {{ i + 1 }}</h3>
                      <div class="party-form">
                        <mat-form-field appearance="outline">
                          <mat-label>Party Name</mat-label>
                          <input matInput [formControlName]="'party' + i + 'Name'" placeholder="e.g., Party A">
                          <mat-error *ngIf="partiesForm.get('party' + i + 'Name')?.hasError('required')">
                            Party name is required
                          </mat-error>
                        </mat-form-field>

                        <mat-form-field appearance="outline">
                          <mat-label>Webhook URL</mat-label>
                          <input matInput [formControlName]="'party' + i + 'Url'" placeholder="http://localhost:3001/webhook">
                          <mat-error *ngIf="partiesForm.get('party' + i + 'Url')?.hasError('required')">
                            Webhook URL is required
                          </mat-error>
                          <mat-error *ngIf="partiesForm.get('party' + i + 'Url')?.hasError('pattern')">
                            Please enter a valid URL
                          </mat-error>
                        </mat-form-field>
                      </div>
                    </div>
                  </div>

                  <mat-divider></mat-divider>

                  <div class="party-info">
                    <h4>Party Information</h4>
                    <p>Each party will receive a share of the private key. All three parties must participate for any operation to succeed.</p>
                    <mat-chip-set>
                      <mat-chip color="primary" selected>Threshold: 3</mat-chip>
                      <mat-chip color="accent" selected>Total Parties: 3</mat-chip>
                      <mat-chip color="warn" selected>All parties required</mat-chip>
                    </mat-chip-set>
                  </div>
                </mat-card-content>
              </mat-card>
            </div>
            <div class="step-actions">
              <button mat-button matStepperPrevious>
                <mat-icon>arrow_back</mat-icon>
                Back
              </button>
              <button mat-button matStepperNext [disabled]="!partiesForm.valid">
                Next
                <mat-icon>arrow_forward</mat-icon>
              </button>
            </div>
          </form>
        </mat-step>

        <!-- Step 3: Review and Create -->
        <mat-step label="Review and Create">
          <div class="step-content">
            <mat-card>
              <mat-card-header>
                <mat-card-title>
                  <mat-icon>preview</mat-icon>
                  Review Configuration
                </mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div class="review-section">
                  <h4>Session Details</h4>
                  <div class="review-grid">
                    <div class="review-item">
                      <span class="label">Operation:</span>
                      <span class="value">{{ sessionForm.get('operation')?.value | titlecase }}</span>
                    </div>
                    <div class="review-item">
                      <span class="label">Description:</span>
                      <span class="value">{{ sessionForm.get('description')?.value || 'No description' }}</span>
                    </div>
                    <div class="review-item">
                      <span class="label">Blockchain:</span>
                      <span class="value">{{ sessionForm.get('blockchain')?.value || 'Not specified' }}</span>
                    </div>
                    <div class="review-item" *ngIf="sessionForm.get('walletAddress')?.value">
                      <span class="label">Wallet Address:</span>
                      <span class="value">{{ sessionForm.get('walletAddress')?.value }}</span>
                    </div>
                  </div>
                </div>

                <mat-divider></mat-divider>

                <div class="review-section">
                  <h4>Parties</h4>
                  <div class="parties-review">
                    <div *ngFor="let party of parties; let i = index" class="party-review-item">
                      <div class="party-review-header">
                        <mat-icon>person</mat-icon>
                        <span class="party-name">{{ partiesForm.get('party' + i + 'Name')?.value }}</span>
                      </div>
                      <div class="party-url">{{ partiesForm.get('party' + i + 'Url')?.value }}</div>
                    </div>
                  </div>
                </div>

                <mat-divider></mat-divider>

                <div class="review-section">
                  <h4>Security Information</h4>
                  <div class="security-info">
                    <p>This session will use Shamir's Secret Sharing with a (3,3) threshold scheme:</p>
                    <ul>
                      <li>Private key will be split into 3 shares</li>
                      <li>All 3 parties must participate for any operation</li>
                      <li>Shares are distributed via secure webhooks</li>
                      <li>Session expires in 24 hours</li>
                    </ul>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
          </div>
          <div class="step-actions">
            <button mat-button matStepperPrevious>
              <mat-icon>arrow_back</mat-icon>
              Back
            </button>
            <button mat-raised-button color="primary" (click)="createSession()" [disabled]="creating">
              <mat-icon>create</mat-icon>
              {{ creating ? 'Creating Session...' : 'Create Session' }}
            </button>
          </div>
        </mat-step>
      </mat-stepper>

      <!-- Success Dialog -->
      <div *ngIf="sessionCreated" class="success-overlay">
        <mat-card class="success-card">
          <mat-card-header>
            <mat-card-title>
              <mat-icon class="success-icon">check_circle</mat-icon>
              Session Created Successfully!
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="success-content">
              <p>Your TLS-MCP session has been created and is ready for key generation.</p>
              <div class="session-info">
                <div class="info-item">
                  <span class="label">Session ID:</span>
                  <code class="value">{{ createdSessionId }}</code>
                </div>
                <div class="info-item">
                  <span class="label">Status:</span>
                  <span class="value">Pending</span>
                </div>
              </div>
            </div>
          </mat-card-content>
          <mat-card-actions>
            <button mat-button (click)="resetForm()">Create Another Session</button>
            <button mat-raised-button color="primary" [routerLink]="['/sessions', createdSessionId]">
              View Session
            </button>
            <button mat-raised-button color="accent" routerLink="/sessions">
              All Sessions
            </button>
          </mat-card-actions>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .key-generation-container {
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

    .stepper {
      background: transparent;
    }

    .step-content {
      margin-bottom: 20px;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 16px;
    }

    .parties-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 20px;
    }

    .party-card {
      border: 1px solid #eee;
      border-radius: 8px;
      padding: 16px;
      background: #fafafa;
    }

    .party-card h3 {
      margin-top: 0;
      margin-bottom: 16px;
      color: #333;
    }

    .party-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .party-info {
      margin-top: 20px;
    }

    .party-info h4 {
      margin-bottom: 8px;
      color: #333;
    }

    .party-info p {
      color: #666;
      margin-bottom: 16px;
    }

    .step-actions {
      display: flex;
      justify-content: space-between;
      margin-top: 20px;
    }

    .review-section {
      margin-bottom: 24px;
    }

    .review-section h4 {
      margin-bottom: 16px;
      color: #333;
    }

    .review-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 12px;
    }

    .review-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }

    .review-item:last-child {
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

    .parties-review {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 16px;
    }

    .party-review-item {
      padding: 12px;
      border: 1px solid #eee;
      border-radius: 6px;
      background: #f9f9f9;
    }

    .party-review-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }

    .party-name {
      font-weight: 500;
    }

    .party-url {
      font-size: 12px;
      color: #666;
      font-family: 'Courier New', monospace;
    }

    .security-info {
      background: #f5f5f5;
      padding: 16px;
      border-radius: 6px;
    }

    .security-info p {
      margin-bottom: 12px;
      color: #333;
    }

    .security-info ul {
      margin: 0;
      padding-left: 20px;
    }

    .security-info li {
      margin-bottom: 4px;
      color: #666;
    }

    .success-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .success-card {
      max-width: 500px;
      width: 90%;
    }

    .success-icon {
      color: #4caf50;
      margin-right: 8px;
    }

    .success-content {
      text-align: center;
    }

    .session-info {
      margin-top: 20px;
      text-align: left;
    }

    .info-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .info-item .label {
      font-weight: 500;
    }

    .info-item .value {
      font-family: 'Courier New', monospace;
      background: #f5f5f5;
      padding: 4px 8px;
      border-radius: 4px;
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
export class KeyGenerationComponent {
  sessionForm: FormGroup;
  partiesForm: FormGroup;
  parties = [0, 1, 2];
  
  creating = false;
  sessionCreated = false;
  createdSessionId = '';

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private router: Router
  ) {
    this.sessionForm = this.fb.group({
      operation: ['key_generation', Validators.required],
      description: [''],
      blockchain: ['ethereum'],
      walletAddress: ['']
    });

    this.partiesForm = this.fb.group({
      party0Name: ['Party A', Validators.required],
      party0Url: ['http://localhost:3001/webhook', [Validators.required, Validators.pattern('https?://.+')]],
      party1Name: ['Party B', Validators.required],
      party1Url: ['http://localhost:3002/webhook', [Validators.required, Validators.pattern('https?://.+')]],
      party2Name: ['Party C', Validators.required],
      party2Url: ['http://localhost:3003/webhook', [Validators.required, Validators.pattern('https?://.+')]]
    });
  }

  async createSession() {
    if (!this.sessionForm.valid || !this.partiesForm.valid) {
      return;
    }

    this.creating = true;
    try {
      const parties: Party[] = [
        {
          name: this.partiesForm.get('party0Name')?.value,
          webhookUrl: this.partiesForm.get('party0Url')?.value
        },
        {
          name: this.partiesForm.get('party1Name')?.value,
          webhookUrl: this.partiesForm.get('party1Url')?.value
        },
        {
          name: this.partiesForm.get('party2Name')?.value,
          webhookUrl: this.partiesForm.get('party2Url')?.value
        }
      ];

      const metadata = {
        description: this.sessionForm.get('description')?.value,
        blockchain: this.sessionForm.get('blockchain')?.value,
        walletAddress: this.sessionForm.get('walletAddress')?.value
      };

      const response = await this.apiService.createSession(
        this.sessionForm.get('operation')?.value,
        parties,
        metadata
      ).toPromise();

      if (response?.success) {
        this.createdSessionId = response.sessionId;
        this.sessionCreated = true;
      }
    } catch (error) {
      console.error('Failed to create session:', error);
      // You could add error handling here (snackbar, etc.)
    } finally {
      this.creating = false;
    }
  }

  resetForm() {
    this.sessionForm.reset({
      operation: 'key_generation',
      description: '',
      blockchain: 'ethereum',
      walletAddress: ''
    });

    this.partiesForm.reset({
      party0Name: 'Party A',
      party0Url: 'http://localhost:3001/webhook',
      party1Name: 'Party B',
      party1Url: 'http://localhost:3002/webhook',
      party2Name: 'Party C',
      party2Url: 'http://localhost:3003/webhook'
    });

    this.sessionCreated = false;
    this.createdSessionId = '';
  }
} 