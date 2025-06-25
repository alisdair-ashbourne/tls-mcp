import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatListModule } from '@angular/material/list';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  MatDialogModule,
  MatDialog,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { WebRTCService } from '../../services/webrtc.service';
import {
  BrowserSignalingService,
  BrowserSignalingStatus,
} from '../../services/browser-signaling.service';

interface Peer {
  id: number;
  status: 'connected' | 'disconnected' | 'connecting';
  lastSeen: Date;
  sessionId: string;
}

interface ConsensusProposal {
  id: string;
  operation: string;
  proposer: number;
  votes: Map<number, boolean>;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: Date;
}

interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  partyId?: number;
}

@Component({
  selector: 'app-distributed-coordinator',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule,
    MatChipsModule,
    MatListModule,
    MatExpansionModule,
    MatTooltipModule,
    MatDialogModule,
  ],
  templateUrl: './distributed-coordinator.component.html',
  styleUrls: ['./distributed-coordinator.component.scss'],
})
export class DistributedCoordinatorComponent implements OnInit, OnDestroy {
  // Form data
  partyId: number = 1;
  sessionId: string = 'test-session-123';
  serverPort: number = 8080;

  // State
  isConnected: boolean = false;
  peers: Peer[] = [];
  proposals: ConsensusProposal[] = [];
  logs: LogEntry[] = [];
  signalingStatus: BrowserSignalingStatus;

  // Subscriptions
  private statusSubscription: any;
  private messageSubscription: any;

  constructor(
    private webrtcService: WebRTCService,
    private browserSignaling: BrowserSignalingService,
    private dialog: MatDialog
  ) {
    this.signalingStatus = this.browserSignaling.getStatus();
  }

  ngOnInit() {
    this.statusSubscription = this.browserSignaling
      .onStatusChange()
      .subscribe((status) => {
        this.signalingStatus = status;
        this.addLog(
          'info',
          `Browser signaling status changed: ${status.isRunning ? 'Running' : 'Stopped'} (${status.method})`
        );
      });

    this.messageSubscription = this.browserSignaling
      .onMessage()
      .subscribe((message) => {
        this.handleSignalingMessage(message);
      });

    this.addLog('info', 'Distributed Coordinator initialized');
  }

  ngOnDestroy() {
    if (this.statusSubscription) {
      this.statusSubscription.unsubscribe();
    }
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
    }
    this.disconnect();
  }

  async startSignaling() {
    try {
      await this.browserSignaling.startSignaling();
      this.addLog(
        'success',
        `Browser signaling started using ${this.signalingStatus.method}`
      );
    } catch (error) {
      this.addLog('error', `Failed to start browser signaling: ${error}`);
    }
  }

  async stopSignaling() {
    try {
      await this.browserSignaling.stopSignaling();
      this.addLog('info', 'Browser signaling stopped');
    } catch (error) {
      this.addLog('error', `Failed to stop browser signaling: ${error}`);
    }
  }

  async joinSession() {
    if (!this.signalingStatus.isRunning) {
      return;
    }

    try {
      // Send join message via browser signaling
      await this.browserSignaling.sendMessage({
        type: 'join',
        from: this.partyId,
        sessionId: this.sessionId,
        payload: { partyId: this.partyId, sessionId: this.sessionId },
      });

      this.isConnected = true;

      // Simulate peer discovery
      this.simulatePeerDiscovery();

      this.addLog(
        'success',
        `Joined session ${this.sessionId} as Party ${this.partyId}`
      );
    } catch (error) {
      this.addLog('error', `Failed to join session: ${error}`);
    }
  }

  disconnect() {
    if (this.isConnected) {
      this.browserSignaling.sendMessage({
        type: 'leave',
        from: this.partyId,
        sessionId: this.sessionId,
        payload: { partyId: this.partyId },
      });
    }

    this.isConnected = false;
    this.peers = [];
    this.proposals = [];
    this.addLog('info', 'Disconnected from session');
  }

  proposeOperation(operation: string) {
    if (!this.isConnected) {
      return;
    }

    const proposal: ConsensusProposal = {
      id: Math.random().toString(36).substr(2, 9),
      operation,
      proposer: this.partyId,
      votes: new Map(),
      status: 'pending',
      timestamp: new Date(),
    };

    this.proposals.push(proposal);
    this.addLog('info', `Proposed operation: ${operation}`, this.partyId);

    // Send proposal via browser signaling
    this.browserSignaling.sendMessage({
      type: 'propose',
      from: this.partyId,
      sessionId: this.sessionId,
      payload: { proposal },
    });

    // Simulate voting from other peers
    this.simulateVoting(proposal);
  }

  voteOnProposal(proposalId: string, vote: 'approve' | 'reject') {
    const proposal = this.proposals.find((p) => p.id === proposalId);
    if (proposal && proposal.status === 'pending') {
      proposal.votes.set(this.partyId, vote === 'approve');
      this.addLog(
        'info',
        `Voted ${vote} on proposal ${proposalId}`,
        this.partyId
      );

      // Send vote via browser signaling
      this.browserSignaling.sendMessage({
        type: 'vote',
        from: this.partyId,
        sessionId: this.sessionId,
        payload: { proposalId, vote: vote === 'approve' },
      });

      // Check if consensus is reached
      this.checkConsensus(proposal);
    }
  }

  private handleSignalingMessage(message: any) {
    console.log(
      '[DistributedCoordinator] Received signaling message:',
      message
    );

    switch (message.type) {
      case 'join':
        this.handlePeerJoin(message);
        break;
      case 'leave':
        this.handlePeerLeave(message);
        break;
      case 'propose':
        this.handleProposal(message);
        break;
      case 'vote':
        this.handleVote(message);
        break;
    }
  }

  private handlePeerJoin(message: any) {
    const { partyId } = message.payload;
    if (partyId !== this.partyId) {
      const peer: Peer = {
        id: partyId,
        status: 'connected',
        lastSeen: new Date(),
        sessionId: message.sessionId,
      };
      this.peers.push(peer);
      this.addLog('info', `Peer Party ${partyId} joined the session`, partyId);
    }
  }

  private handlePeerLeave(message: any) {
    const { partyId } = message.payload;
    this.peers = this.peers.filter((p) => p.id !== partyId);
    this.addLog('info', `Peer Party ${partyId} left the session`, partyId);
  }

  private handleProposal(message: any) {
    const { proposal } = message.payload;
    if (message.from !== this.partyId) {
      this.proposals.push(proposal);
      this.addLog(
        'info',
        `Received proposal: ${proposal.operation} from Party ${message.from}`,
        message.from
      );
    }
  }

  private handleVote(message: any) {
    const { proposalId, vote } = message.payload;
    const proposal = this.proposals.find((p) => p.id === proposalId);
    if (proposal && message.from !== this.partyId) {
      proposal.votes.set(message.from, vote);
      this.addLog(
        'info',
        `Received vote from Party ${message.from}: ${vote ? 'approve' : 'reject'}`,
        message.from
      );
      this.checkConsensus(proposal);
    }
  }

  private simulatePeerDiscovery() {
    // Simulate other parties joining
    const otherParties = [2, 3, 4].filter((id) => id !== this.partyId);

    otherParties.forEach((partyId) => {
      setTimeout(
        () => {
          const peer: Peer = {
            id: partyId,
            status: 'connected',
            lastSeen: new Date(),
            sessionId: this.sessionId,
          };
          this.peers.push(peer);
          this.addLog(
            'info',
            `Peer Party ${partyId} joined the session`,
            partyId
          );
        },
        Math.random() * 2000 + 1000
      );
    });
  }

  private simulateVoting(proposal: ConsensusProposal) {
    this.peers.forEach((peer) => {
      setTimeout(
        () => {
          const vote = Math.random() > 0.3 ? 'approve' : 'reject';
          proposal.votes.set(peer.id, vote === 'approve');
          this.addLog(
            'info',
            `Peer Party ${peer.id} voted ${vote} on proposal ${proposal.id}`,
            peer.id
          );
          this.checkConsensus(proposal);
        },
        Math.random() * 3000 + 1000
      );
    });
  }

  private checkConsensus(proposal: ConsensusProposal) {
    const totalVotes = proposal.votes.size + 1; // +1 for our own vote
    let approveVotes = Array.from(proposal.votes.values()).filter(
      (v) => v
    ).length;

    if (proposal.votes.get(this.partyId)) {
      approveVotes++;
    }

    const approvalRate = approveVotes / totalVotes;

    if (approvalRate >= 0.67) {
      // 2/3 majority
      proposal.status = 'approved';
      this.addLog(
        'success',
        `Proposal ${proposal.id} approved with ${approvalRate * 100}% consensus`
      );
      this.executeOperation(proposal.operation);
    } else if (approvalRate <= 0.33) {
      proposal.status = 'rejected';
      this.addLog(
        'warn',
        `Proposal ${proposal.id} rejected with ${approvalRate * 100}% consensus`
      );
    }
  }

  private executeOperation(operation: string) {
    this.addLog('success', `Executing operation: ${operation}`, this.partyId);
    // Here you would implement the actual MPC operation
  }

  private addLog(
    level: 'info' | 'warn' | 'error' | 'success',
    message: string,
    partyId?: number
  ) {
    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      partyId,
    };
    this.logs.unshift(logEntry);

    // Keep only last 100 logs
    if (this.logs.length > 100) {
      this.logs = this.logs.slice(0, 100);
    }
  }

  getLogLevelClass(level: string): string {
    switch (level) {
      case 'error':
        return 'error-log';
      case 'warn':
        return 'warn-log';
      case 'success':
        return 'success-log';
      default:
        return 'info-log';
    }
  }

  getLogLevelColor(level: string): string {
    switch (level) {
      case 'error':
        return 'warn';
      case 'warn':
        return 'warn';
      case 'success':
        return 'accent';
      default:
        return 'primary';
    }
  }

  getLogLevelIcon(level: string): string {
    switch (level) {
      case 'error':
        return 'error';
      case 'warn':
        return 'warning';
      case 'success':
        return 'check_circle';
      default:
        return 'info';
    }
  }

  getApprovalRate(proposal: ConsensusProposal): number {
    const totalVotes = proposal.votes.size + 1; // +1 for our own vote
    let approveVotes = Array.from(proposal.votes.values()).filter(
      (v) => v
    ).length;

    if (proposal.votes.get(this.partyId)) {
      approveVotes++;
    }

    return approveVotes / totalVotes;
  }

  getActiveSessions(): string[] {
    return Array.from(this.signalingStatus.sessions.keys());
  }

  getSessionParties(sessionId: string): number[] {
    const session = this.signalingStatus.sessions.get(sessionId);
    return session ? Array.from(session) : [];
  }

  get pendingProposals() {
    return this.proposals.filter((p) => p.status === 'pending');
  }

  get approvedProposals() {
    return this.proposals.filter((p) => p.status === 'approved');
  }

  showBrowserSignalingHelp() {
    const instructions =
      this.browserSignaling.getBrowserSignalingInstructions();

    this.dialog.open(BrowserSignalingHelpDialog, {
      width: '800px',
      maxHeight: '90vh',
      data: { instructions },
    });
  }
}

// Dialog component for browser signaling help
@Component({
  selector: 'browser-signaling-help-dialog',
  template: `
    <h2 mat-dialog-title>
      <mat-icon>help</mat-icon>
      Browser-Based WebRTC Signaling
    </h2>
    <mat-dialog-content class="help-dialog-content">
      <pre>{{ instructions }}</pre>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
})
export class BrowserSignalingHelpDialog {
  instructions: string;

  constructor(@Inject(MAT_DIALOG_DATA) public data: { instructions: string }) {
    this.instructions = data.instructions;
  }
}
