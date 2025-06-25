import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../../services/api.service';

interface WebRTCPeer {
  partyId: number;
  partyName: string;
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'failed';
  dataChannelState?: 'open' | 'closed' | 'connecting';
}

interface WebRTCSession {
  sessionId: string;
  webrtcRoom: string;
  peers: WebRTCPeer[];
  localPartyId: number;
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
}

@Component({
  imports: [CommonModule, FormsModule],
  selector: 'app-webrtc-session',
  standalone: true,
  styleUrls: ['./webrtc-session.component.scss'],
  templateUrl: './webrtc-session.component.html',
})
export class WebRTCSessionComponent implements OnInit, OnDestroy {
  // Session creation
  localPartyId: number = 1;
  sessionIdToJoin: string = '';
  operation: string = 'threshold_signature';
  threshold: number = 2;
  totalParties: number = 3;

  // Current session
  currentSession: WebRTCSession | null = null;
  mpcMessages: Array<{
    from: number;
    event: string;
    payload?: any;
    timestamp: Date;
  }> = [];
  newMessage: string = '';

  // Connection state
  connectionLog: Array<{
    level: 'info' | 'warn' | 'error' | 'success';
    message: string;
    timestamp: Date;
  }> = [];

  // WebRTC state (simulated for demo)
  private peerConnections: Map<number, any> = new Map();
  private dataChannels: Map<number, any> = new Map();

  constructor(private apiService: ApiService) {}

  ngOnInit() {
    this.log('info', 'WebRTC Session component initialized');
  }

  ngOnDestroy() {
    this.leaveSession();
  }

  get canCreateSession(): boolean {
    return (
      this.localPartyId > 0 &&
      this.threshold >= 2 &&
      this.totalParties >= this.threshold &&
      this.threshold <= this.totalParties
    );
  }

  get connectedPeersCount(): number {
    if (!this.currentSession) return 0;
    return this.currentSession.peers.filter(
      (p) => p.connectionState === 'connected'
    ).length;
  }

  async createOrJoinSession() {
    try {
      this.log(
        'info',
        `Attempting to ${this.sessionIdToJoin ? 'join' : 'create'} session...`
      );

      if (this.sessionIdToJoin) {
        await this.joinExistingSession();
      } else {
        await this.createNewSession();
      }
    } catch (error) {
      this.log(
        'error',
        `Failed to ${this.sessionIdToJoin ? 'join' : 'create'} session: ${error}`
      );
    }
  }

  private async createNewSession() {
    // Create parties configuration
    const parties = Array.from({ length: this.totalParties }, (_, i) => ({
      name: `Party ${i + 1}`,
      webhookUrl: `http://localhost:${3001 + i}/webhook`,
      webrtcEnabled: true, // All parties support WebRTC in this demo
    }));

    // Create session via API
    const result = await this.apiService
      .createSession({
        operation: this.operation,
        parties,
        threshold: this.threshold,
        totalParties: this.totalParties,
        metadata: {
          description: 'WebRTC-enabled MPC session',
          webrtcEnabled: true,
        },
      })
      .toPromise();

    if (!result) {
      throw new Error('Failed to create session - no response from API');
    }

    this.log('success', `Session created: ${result.sessionId}`);

    // Initialize WebRTC session
    await this.initializeWebRTCSession(result.sessionId);
  }

  private async joinExistingSession() {
    // In a real implementation, you'd fetch session details from the coordinator
    this.log('info', `Joining existing session: ${this.sessionIdToJoin}`);

    // For demo purposes, create a mock session
    await this.initializeWebRTCSession(this.sessionIdToJoin);
  }

  private async initializeWebRTCSession(sessionId: string) {
    // Initialize current session
    this.currentSession = {
      sessionId,
      webrtcRoom: `mpc-session-${sessionId}`,
      localPartyId: this.localPartyId,
      connectionStatus: 'connecting',
      peers: Array.from({ length: this.totalParties }, (_, i) => ({
        partyId: i + 1,
        partyName: `Party ${i + 1}`,
        connectionState: 'disconnected' as const,
      })),
    };

    this.log('info', `Initializing WebRTC session: ${sessionId}`);

    // Simulate WebRTC connection process
    await this.simulateWebRTCConnection();

    this.log('success', 'WebRTC session initialized successfully');
  }

  private async simulateWebRTCConnection() {
    if (!this.currentSession) return;

    // Simulate connection to signaling server
    this.log('info', 'Connecting to WebRTC signaling server...');
    await this.delay(1000);

    // Simulate peer discovery
    this.log('info', 'Discovering peers...');
    await this.delay(500);

    // Simulate establishing peer connections
    for (const peer of this.currentSession.peers) {
      if (peer.partyId === this.localPartyId) {
        peer.connectionState = 'connected';
        peer.dataChannelState = 'open';
        continue;
      }

      this.log('info', `Establishing connection with Party ${peer.partyId}...`);
      peer.connectionState = 'connecting';

      await this.delay(500 + Math.random() * 1000);

      // Simulate successful connection (in real implementation, this would depend on actual WebRTC)
      peer.connectionState = 'connected';
      peer.dataChannelState = 'open';

      this.log('success', `Connected to Party ${peer.partyId}`);
    }

    this.currentSession.connectionStatus = 'connected';
    this.log('success', 'All peer connections established');
  }

  async sendMPCMessage() {
    if (!this.newMessage.trim() || !this.currentSession) return;

    const message = {
      from: this.localPartyId,
      event: this.newMessage,
      payload: { timestamp: Date.now() },
      timestamp: new Date(),
    };

    this.mpcMessages.push(message);
    this.log('info', `Sent MPC message: ${this.newMessage}`);

    // Simulate receiving response from other parties
    setTimeout(
      () => {
        this.simulatePeerResponse(message);
      },
      500 + Math.random() * 1000
    );

    this.newMessage = '';
  }

  private simulatePeerResponse(originalMessage: any) {
    if (!this.currentSession) return;

    // Simulate responses from other parties
    const otherParties = this.currentSession.peers.filter(
      (p) => p.partyId !== this.localPartyId
    );

    otherParties.forEach((party) => {
      const response = {
        from: party.partyId,
        event: `response_to_${originalMessage.event}`,
        payload: {
          originalMessage: originalMessage.event,
          partyId: party.partyId,
          timestamp: Date.now(),
        },
        timestamp: new Date(),
      };

      this.mpcMessages.push(response);
      this.log('info', `Received response from Party ${party.partyId}`);
    });
  }

  async leaveSession() {
    if (!this.currentSession) return;

    this.log('info', 'Leaving WebRTC session...');

    // Close peer connections
    this.peerConnections.forEach((connection, partyId) => {
      if (connection) {
        connection.close();
        this.log('info', `Closed connection to Party ${partyId}`);
      }
    });

    // Clear state
    this.peerConnections.clear();
    this.dataChannels.clear();
    this.currentSession = null;
    this.mpcMessages = [];
    this.newMessage = '';

    this.log('success', 'Successfully left WebRTC session');
  }

  private log(level: 'info' | 'warn' | 'error' | 'success', message: string) {
    this.connectionLog.push({
      level,
      message,
      timestamp: new Date(),
    });

    // Keep only last 50 log entries
    if (this.connectionLog.length > 50) {
      this.connectionLog = this.connectionLog.slice(-50);
    }

    console.log(`[WebRTC] ${level.toUpperCase()}: ${message}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
