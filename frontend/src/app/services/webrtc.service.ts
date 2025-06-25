import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface WebRTCMessage {
  from: number;
  to?: number; // undefined means broadcast to all
  event: string;
  payload?: any;
  timestamp: number;
}

export interface PeerConnection {
  partyId: number;
  connection: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  connectionState:
    | 'new'
    | 'connecting'
    | 'connected'
    | 'disconnected'
    | 'failed';
  dataChannelState?: 'connecting' | 'open' | 'closing' | 'closed';
}

@Injectable({
  providedIn: 'root',
})
export class WebRTCService {
  private peerConnections: Map<number, PeerConnection> = new Map();
  private localPartyId: number = 0;
  private sessionId: string = '';
  private signalingSocket?: WebSocket;

  // Events
  private messageSubject = new Subject<WebRTCMessage>();
  private connectionStateSubject = new Subject<{
    partyId: number;
    state: string;
  }>();
  private dataChannelStateSubject = new Subject<{
    partyId: number;
    state: string;
  }>();

  // Configuration
  private rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  constructor() {}

  /**
   * Initialize WebRTC service for a session
   */
  async initializeSession(
    sessionId: string,
    localPartyId: number,
    signalingUrl: string
  ): Promise<void> {
    this.sessionId = sessionId;
    this.localPartyId = localPartyId;

    console.log(
      `[WebRTC] Initializing session ${sessionId} for Party ${localPartyId}`
    );

    // Connect to signaling server
    await this.connectToSignalingServer(signalingUrl);

    // Join the session room
    this.sendSignalingMessage('join', {
      sessionId,
      partyId: localPartyId,
      timestamp: Date.now(),
    });
  }

  /**
   * Connect to WebRTC signaling server
   */
  private async connectToSignalingServer(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // For now, we'll simulate the connection since we're using a simulated signaling server
      // In a real implementation, this would connect to an actual WebSocket server
      console.log(`[WebRTC] Simulating connection to signaling server: ${url}`);

      // Simulate connection delay
      setTimeout(() => {
        console.log('[WebRTC] Connected to signaling server (simulated)');
        resolve();
      }, 500);
    });
  }

  /**
   * Handle incoming signaling messages
   */
  private handleSignalingMessage(message: any): void {
    const { type, from, payload } = message;

    console.log(
      `[WebRTC] Received signaling message: ${type} from Party ${from}`
    );

    switch (type) {
      case 'peer_joined':
        this.handlePeerJoined(from, payload);
        break;

      case 'peer_left':
        this.handlePeerLeft(from);
        break;

      case 'offer':
        this.handleOffer(from, payload);
        break;

      case 'answer':
        this.handleAnswer(from, payload);
        break;

      case 'ice_candidate':
        this.handleIceCandidate(from, payload);
        break;

      case 'session_initialized':
      case 'dkg_initiated':
      case 'dkg_completed':
      case 'signature_requested':
        // Forward MPC protocol messages
        this.messageSubject.next({
          from: 0, // Coordinator
          event: type,
          payload,
          timestamp: Date.now(),
        });
        break;
    }
  }

  /**
   * Handle new peer joining the session
   */
  private async handlePeerJoined(partyId: number, payload: any): Promise<void> {
    if (partyId === this.localPartyId) return; // Don't connect to self

    console.log(`[WebRTC] Peer ${partyId} joined, creating connection`);

    // Create peer connection
    const connection = new RTCPeerConnection(this.rtcConfig);
    const peerConnection: PeerConnection = {
      partyId,
      connection,
      connectionState: 'new',
    };

    this.peerConnections.set(partyId, peerConnection);

    // Set up event handlers
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage('ice_candidate', {
          to: partyId,
          candidate: event.candidate,
        });
      }
    };

    connection.onconnectionstatechange = () => {
      const state = connection.connectionState;
      peerConnection.connectionState = state as any;
      this.connectionStateSubject.next({ partyId, state });
      console.log(`[WebRTC] Connection to Party ${partyId}: ${state}`);
    };

    connection.ondatachannel = (event) => {
      this.setupDataChannel(partyId, event.channel);
    };

    // Create data channel for outgoing messages
    const dataChannel = connection.createDataChannel(`mpc-${this.sessionId}`, {
      ordered: true,
    });

    this.setupDataChannel(partyId, dataChannel);

    // Create and send offer
    try {
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);

      this.sendSignalingMessage('offer', {
        to: partyId,
        offer,
      });
    } catch (error) {
      console.error(
        `[WebRTC] Error creating offer for Party ${partyId}:`,
        error
      );
    }
  }

  /**
   * Handle peer leaving the session
   */
  private handlePeerLeft(partyId: number): void {
    console.log(`[WebRTC] Peer ${partyId} left, closing connection`);

    const peerConnection = this.peerConnections.get(partyId);
    if (peerConnection) {
      peerConnection.connection.close();
      this.peerConnections.delete(partyId);
    }
  }

  /**
   * Handle incoming offer
   */
  private async handleOffer(from: number, payload: any): Promise<void> {
    const peerConnection = this.peerConnections.get(from);
    if (!peerConnection) {
      console.error(`[WebRTC] No peer connection found for Party ${from}`);
      return;
    }

    try {
      await peerConnection.connection.setRemoteDescription(payload.offer);

      const answer = await peerConnection.connection.createAnswer();
      await peerConnection.connection.setLocalDescription(answer);

      this.sendSignalingMessage('answer', {
        to: from,
        answer,
      });
    } catch (error) {
      console.error(`[WebRTC] Error handling offer from Party ${from}:`, error);
    }
  }

  /**
   * Handle incoming answer
   */
  private async handleAnswer(from: number, payload: any): Promise<void> {
    const peerConnection = this.peerConnections.get(from);
    if (!peerConnection) {
      console.error(`[WebRTC] No peer connection found for Party ${from}`);
      return;
    }

    try {
      await peerConnection.connection.setRemoteDescription(payload.answer);
    } catch (error) {
      console.error(
        `[WebRTC] Error handling answer from Party ${from}:`,
        error
      );
    }
  }

  /**
   * Handle incoming ICE candidate
   */
  private async handleIceCandidate(from: number, payload: any): Promise<void> {
    const peerConnection = this.peerConnections.get(from);
    if (!peerConnection) {
      console.error(`[WebRTC] No peer connection found for Party ${from}`);
      return;
    }

    try {
      await peerConnection.connection.addIceCandidate(payload.candidate);
    } catch (error) {
      console.error(
        `[WebRTC] Error adding ICE candidate from Party ${from}:`,
        error
      );
    }
  }

  /**
   * Set up data channel for peer communication
   */
  private setupDataChannel(partyId: number, dataChannel: RTCDataChannel): void {
    const peerConnection = this.peerConnections.get(partyId);
    if (!peerConnection) return;

    peerConnection.dataChannel = dataChannel;

    dataChannel.onopen = () => {
      peerConnection.dataChannelState = 'open';
      this.dataChannelStateSubject.next({ partyId, state: 'open' });
      console.log(`[WebRTC] Data channel to Party ${partyId} opened`);
    };

    dataChannel.onclose = () => {
      peerConnection.dataChannelState = 'closed';
      this.dataChannelStateSubject.next({ partyId, state: 'closed' });
      console.log(`[WebRTC] Data channel to Party ${partyId} closed`);
    };

    dataChannel.onmessage = (event) => {
      try {
        const message: WebRTCMessage = JSON.parse(event.data);
        console.log(
          `[WebRTC] Received message from Party ${partyId}:`,
          message.event
        );
        this.messageSubject.next(message);
      } catch (error) {
        console.error(
          `[WebRTC] Error parsing message from Party ${partyId}:`,
          error
        );
      }
    };

    dataChannel.onerror = (error) => {
      console.error(
        `[WebRTC] Data channel error with Party ${partyId}:`,
        error
      );
    };
  }

  /**
   * Send message to specific peer or broadcast to all
   */
  sendMessage(event: string, payload?: any, to?: number): void {
    const message: WebRTCMessage = {
      from: this.localPartyId,
      to,
      event,
      payload,
      timestamp: Date.now(),
    };

    if (to) {
      // Send to specific peer
      const peerConnection = this.peerConnections.get(to);
      if (peerConnection?.dataChannel?.readyState === 'open') {
        peerConnection.dataChannel.send(JSON.stringify(message));
      } else {
        console.warn(
          `[WebRTC] Cannot send message to Party ${to} - data channel not open`
        );
      }
    } else {
      // Broadcast to all peers
      this.peerConnections.forEach((peerConnection, partyId) => {
        if (peerConnection.dataChannel?.readyState === 'open') {
          peerConnection.dataChannel.send(JSON.stringify(message));
        }
      });
    }
  }

  /**
   * Send signaling message
   */
  private sendSignalingMessage(type: string, payload: any): void {
    // For simulated signaling server, we'll just log the message
    // In a real implementation, this would send via WebSocket
    console.log(`[WebRTC] Signaling message: ${type}`, {
      from: this.localPartyId,
      sessionId: this.sessionId,
      payload,
    });

    // Simulate message processing for join messages
    if (type === 'join') {
      // Simulate peer joined notification
      setTimeout(() => {
        this.handleSignalingMessage({
          type: 'peer_joined',
          from: this.localPartyId,
          payload: { sessionId: this.sessionId },
        });
      }, 100);
    }
  }

  /**
   * Get connection state for a peer
   */
  getPeerConnectionState(partyId: number): string | undefined {
    return this.peerConnections.get(partyId)?.connectionState;
  }

  /**
   * Get data channel state for a peer
   */
  getDataChannelState(partyId: number): string | undefined {
    return this.peerConnections.get(partyId)?.dataChannelState;
  }

  /**
   * Get all connected peers
   */
  getConnectedPeers(): number[] {
    return Array.from(this.peerConnections.keys());
  }

  /**
   * Get number of connected peers
   */
  getConnectedPeerCount(): number {
    return this.peerConnections.size;
  }

  /**
   * Observable for incoming messages
   */
  onMessage(): Observable<WebRTCMessage> {
    return this.messageSubject.asObservable();
  }

  /**
   * Observable for connection state changes
   */
  onConnectionStateChange(): Observable<{ partyId: number; state: string }> {
    return this.connectionStateSubject.asObservable();
  }

  /**
   * Observable for data channel state changes
   */
  onDataChannelStateChange(): Observable<{ partyId: number; state: string }> {
    return this.dataChannelStateSubject.asObservable();
  }

  /**
   * Disconnect from session
   */
  disconnect(): void {
    console.log('[WebRTC] Disconnecting from session');

    // Close all peer connections
    this.peerConnections.forEach((peerConnection, partyId) => {
      peerConnection.connection.close();
      console.log(`[WebRTC] Closed connection to Party ${partyId}`);
    });

    this.peerConnections.clear();

    // For simulated signaling server, we don't need to close a real WebSocket
    console.log('[WebRTC] Disconnected from signaling server (simulated)');

    // Reset state
    this.sessionId = '';
    this.localPartyId = 0;
  }
}
