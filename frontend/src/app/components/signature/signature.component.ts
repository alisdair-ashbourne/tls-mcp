import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  ApiService,
  SessionSummary,
  SignatureResponse,
} from '../../services/api.service';

@Component({
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatDividerModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  selector: 'app-signature',
  standalone: true,
  styleUrls: ['./signature.component.scss'],
  templateUrl: './signature.component.html',
})
export class SignatureComponent implements OnInit {
  activeSessions: SessionSummary[] = [];
  creatingSignature = false;
  error: string | null = null;
  loadingSessions = false;
  selectedSessionId: string | null = null;
  signatureForm: FormGroup;
  signatureResult: SignatureResponse | null = null;

  constructor(
    private apiService: ApiService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar
  ) {
    this.signatureForm = this.fb.group({
      sessionId: ['', Validators.required],
      message: ['', Validators.required],
    });
  }

  ngOnInit() {
    this.loadActiveSessions();
  }

  async loadActiveSessions() {
    this.loadingSessions = true;

    try {
      const response = await firstValueFrom(this.apiService.getSessions());

      this.activeSessions = response.filter(
        (s: SessionSummary) => s.status === 'dkg_completed'
      );
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
    return this.activeSessions.find(
      (s) => s.sessionId === this.selectedSessionId
    );
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
    if (this.signatureForm.invalid) return;

    this.creatingSignature = true;
    this.error = null;

    try {
      const sessionId = this.signatureForm.get('sessionId')?.value;
      const message = this.signatureForm.get('message')?.value;
      const response = await firstValueFrom(
        this.apiService.createSignature(sessionId, message)
      );

      if (!response) return;

      this.signatureResult = response;
      this.snackBar.open('Signature created successfully!', 'Close', {
        duration: 3000,
      });
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
      messageHash: this.signatureResult.messageHash,
    };

    navigator.clipboard
      .writeText(JSON.stringify(signatureData, null, 2))
      .then(() => {
        this.snackBar.open('Signature data copied to clipboard!', 'Close', {
          duration: 3000,
        });
      })
      .catch(() => {
        this.snackBar.open('Failed to copy signature data', 'Close', {
          duration: 3000,
        });
      });
  }

  clearError() {
    this.error = null;
  }
}
