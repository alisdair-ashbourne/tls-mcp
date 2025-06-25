import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { Router } from '@angular/router';

import {
  CommitmentGroup,
  CryptoService,
  SessionCommitment,
} from '../../services/crypto.service';
import { PartyService } from '../../services/party.service';

@Component({
  selector: 'app-commitment-manager',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatTableModule,
    MatIconModule,
    MatChipsModule,
    MatExpansionModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatDividerModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    FormsModule,
  ],
  templateUrl: './commitment-manager.component.html',
  styleUrls: ['./commitment-manager.component.scss'],
})
export class CommitmentManagerComponent implements OnInit {
  commitmentGroups: CommitmentGroup[] = [];
  selectedGroup: CommitmentGroup | null = null;
  loading = false;

  // New session creation from commitments
  newSessionId = '';
  selectedOperation = 'signature';
  operations = [
    { value: 'signature', label: 'Create Signature' },
    { value: 'address_derivation', label: 'Derive Address' },
    { value: 'key_recovery', label: 'Key Recovery' },
    { value: 'wallet_ops', label: 'Wallet Operations' },
  ];

  // Table columns
  groupsColumns = [
    'sharedSeed',
    'walletAddress',
    'parties',
    'lastUsed',
    'operations',
    'status',
    'actions',
  ];
  commitmentsColumns = ['partyId', 'operation', 'timestamp', 'status'];

  constructor(
    private cryptoService: CryptoService,
    private partyService: PartyService,
    private snackBar: MatSnackBar,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCommitmentGroups();
  }

  /**
   * Loads all commitment groups from the crypto service
   */
  loadCommitmentGroups(): void {
    this.loading = true;
    try {
      this.commitmentGroups = this.cryptoService.getAllCommitmentGroups();
      console.log(
        `🔍 Commitment Manager loaded ${this.commitmentGroups.length} groups:`,
        this.commitmentGroups
      );
    } catch (error) {
      console.error('Error loading commitment groups:', error);
      this.snackBar.open('Failed to load commitments', 'Close', {
        duration: 3000,
      });
    } finally {
      this.loading = false;
    }
  }

  /**
   * Gets the status text for a commitment group
   */
  getGroupStatus(group: CommitmentGroup): string {
    if (!group.canReconstruct) {
      return 'INSUFFICIENT_SHARES';
    }
    if (group.walletAddress) {
      return 'READY';
    }
    return 'PENDING';
  }

  /**
   * Gets the status color for a commitment group
   */
  getGroupStatusColor(group: CommitmentGroup): string {
    const status = this.getGroupStatus(group);
    switch (status) {
      case 'READY':
        return 'primary';
      case 'PENDING':
        return 'accent';
      case 'INSUFFICIENT_SHARES':
        return 'warn';
      default:
        return '';
    }
  }

  /**
   * Selects a commitment group for detailed view
   */
  selectGroup(group: CommitmentGroup): void {
    this.selectedGroup = group;
  }

  /**
   * Derives wallet address from existing commitments
   */
  deriveWalletAddress(group: CommitmentGroup): void {
    if (!group.canReconstruct) {
      this.snackBar.open(
        'Insufficient shares to derive wallet address',
        'Close',
        { duration: 3000 }
      );
      return;
    }

    this.loading = true;
    try {
      const walletAddress = this.cryptoService.getWalletAddressFromCommitments(
        group.sharedSeed
      );

      if (walletAddress) {
        group.walletAddress = walletAddress;
        this.snackBar.open(
          `Wallet address derived: ${walletAddress}`,
          'Close',
          { duration: 5000 }
        );
        console.log(`💼 Derived wallet address: ${walletAddress}`);
      } else {
        this.snackBar.open('Failed to derive wallet address', 'Close', {
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Error deriving wallet address:', error);
      this.snackBar.open('Error deriving wallet address', 'Close', {
        duration: 3000,
      });
    } finally {
      this.loading = false;
    }
  }

  /**
   * Creates a new session from existing commitments
   */
  createSessionFromCommitments(group: CommitmentGroup): void {
    if (!this.newSessionId.trim()) {
      this.snackBar.open('Please enter a session ID', 'Close', {
        duration: 3000,
      });
      return;
    }

    if (!group.canReconstruct) {
      this.snackBar.open('Insufficient shares to create session', 'Close', {
        duration: 3000,
      });
      return;
    }

    this.loading = true;
    try {
      const success = this.cryptoService.createSessionFromCommitments(
        group.sharedSeed,
        this.newSessionId,
        this.selectedOperation
      );

      if (success) {
        // Create session in party service
        this.partyService.createSession(
          this.newSessionId,
          group.participatingParties.length
        );

        // Update group metadata
        group.lastUsed = new Date();
        group.operationsCount++;

        this.snackBar
          .open(
            `Session ${this.newSessionId} created successfully!`,
            'Go to Session',
            { duration: 5000 }
          )
          .onAction()
          .subscribe(() => {
            this.router.navigate([
              '/server-coordinator/sessions',
              this.newSessionId,
            ]);
          });

        console.log(`✅ Created session ${this.newSessionId} from commitments`);

        // Reset form
        this.newSessionId = '';
        this.selectedOperation = 'signature';
      } else {
        this.snackBar.open(
          'Failed to create session from commitments',
          'Close',
          { duration: 3000 }
        );
      }
    } catch (error) {
      console.error('Error creating session from commitments:', error);
      this.snackBar.open('Error creating session', 'Close', { duration: 3000 });
    } finally {
      this.loading = false;
    }
  }

  /**
   * Gets shortened version of shared seed for display
   */
  getShortSeed(seed: string): string {
    return seed.length > 16
      ? `${seed.substring(0, 8)}...${seed.substring(seed.length - 8)}`
      : seed;
  }

  /**
   * Gets shortened version of wallet address for display
   */
  getShortAddress(address: string): string {
    if (!address) return 'Not derived';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }

  /**
   * Gets full wallet address for display
   */
  getFullAddress(address: string): string {
    return address || 'Not derived yet';
  }

  /**
   * Copies text to clipboard
   */
  copyToClipboard(text: string, label: string): void {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        this.snackBar.open(`${label} copied to clipboard`, 'Close', {
          duration: 2000,
        });
      })
      .catch((error) => {
        console.error('Failed to copy to clipboard:', error);
        this.snackBar.open('Failed to copy to clipboard', 'Close', {
          duration: 3000,
        });
      });
  }

  /**
   * Formats date for display
   */
  formatDate(date: Date): string {
    return (
      new Date(date).toLocaleDateString() +
      ' ' +
      new Date(date).toLocaleTimeString()
    );
  }

  /**
   * Gets commitment status for display
   */
  getCommitmentStatus(commitment: SessionCommitment): string {
    if (!commitment.isActive) return 'INACTIVE';
    if (commitment.share) return 'READY';
    return 'PENDING';
  }

  /**
   * Gets commitment status color
   */
  getCommitmentStatusColor(commitment: SessionCommitment): string {
    const status = this.getCommitmentStatus(commitment);
    switch (status) {
      case 'READY':
        return 'primary';
      case 'PENDING':
        return 'accent';
      case 'INACTIVE':
        return 'warn';
      default:
        return '';
    }
  }

  /**
   * Navigates to create a new commitment group
   */
  createNewCommitmentGroup(): void {
    this.router.navigate(['/server-coordinator/key-generation']);
  }

  /**
   * Refreshes the commitment groups
   */
  refreshGroups(): void {
    this.loadCommitmentGroups();
    this.snackBar.open('Commitment groups refreshed', 'Close', {
      duration: 2000,
    });
  }

  /**
   * Clears all commitments (with confirmation)
   */
  clearAllCommitments(): void {
    if (
      confirm(
        'Are you sure you want to clear all cryptographic material? This action cannot be undone.'
      )
    ) {
      try {
        this.cryptoService.clearAllCryptographicMaterial();
        this.commitmentGroups = [];
        this.selectedGroup = null;
        this.snackBar.open('All commitments cleared', 'Close', {
          duration: 3000,
        });
      } catch (error) {
        console.error('Error clearing commitments:', error);
        this.snackBar.open('Failed to clear commitments', 'Close', {
          duration: 3000,
        });
      }
    }
  }

  /**
   * Resets the new session form
   */
  resetSessionForm(): void {
    this.newSessionId = '';
    this.selectedOperation = 'signature';
  }

  /**
   * Opens session detail for a group's current session
   */
  openSessionDetail(group: CommitmentGroup): void {
    // Find the most recent session ID from commitments
    const recentCommitment = group.commitments
      .filter((c) => c.sessionId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

    if (recentCommitment && recentCommitment.sessionId) {
      this.router.navigate([
        '/server-coordinator/sessions',
        recentCommitment.sessionId,
      ]);
    } else {
      this.snackBar.open(
        'No active session found for this commitment group',
        'Close',
        { duration: 3000 }
      );
    }
  }

  // Test function to create a dummy commitment for debugging
  onCreateTestCommitment() {
    const testSessionId = 'test-session-' + Date.now();

    // Create commitments for multiple parties with the same shared seed
    // This will allow reconstruction
    for (let partyId = 0; partyId < 3; partyId++) {
      const testShare = this.cryptoService.generateDeterministicShare(
        partyId,
        testSessionId,
        'test'
      );
      const testCommitment = this.cryptoService.generateShareCommitment(
        testShare,
        testSessionId,
        partyId
      );

      console.log(
        `🧪 Created test commitment for Party ${partyId}:`,
        testCommitment
      );
    }

    this.snackBar.open(
      'Test commitment group with 3 parties created! Check browser console for details.',
      'Close',
      { duration: 3000 }
    );
    this.loadCommitmentGroups();
  }

  // Add more parties to existing commitment group
  onAddPartiesToExistingGroup(group: CommitmentGroup) {
    if (!group) {
      this.snackBar.open('Please select a commitment group first', 'Close', {
        duration: 3000,
      });
      return;
    }

    // Add parties 0 and 1 to the existing shared seed
    for (let partyId = 0; partyId < 2; partyId++) {
      // Skip if party already exists
      if (group.participatingParties.includes(partyId)) continue;

      const testShare = this.cryptoService.generateDeterministicShare(
        partyId,
        group.sharedSeed,
        'test'
      );
      const testCommitment = this.cryptoService.generateShareCommitment(
        testShare,
        group.sharedSeed,
        partyId
      );

      console.log(
        `🔗 Added Party ${partyId} to existing group:`,
        testCommitment
      );
    }

    this.snackBar.open('Added more parties to existing group!', 'Close', {
      duration: 3000,
    });
    this.loadCommitmentGroups();
  }
}
