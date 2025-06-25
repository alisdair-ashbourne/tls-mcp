import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface SignalingServerStatus {
  isRunning: boolean;
  port: number;
  url: string;
  connectedClients: number;
  sessions: Map<string, Set<number>>;
}

export interface SignalingMessage {
  type: string;
  from: number;
  to?: number;
  payload: any;
  sessionId: string;
}

@Injectable({
  providedIn: 'root',
})
export class SignalingServerService {
  private serverStatus: SignalingServerStatus = {
    isRunning: false,
    port: 8080,
    url: 'ws://localhost:8080',
    connectedClients: 0,
    sessions: new Map(),
  };

  private statusSubject = new Subject<SignalingServerStatus>();
  private messageSubject = new Subject<SignalingMessage>();

  constructor() {}

  /**
   * Start the signaling server
   */
  async startServer(port: number = 8080): Promise<void> {
    if (this.serverStatus.isRunning) {
      throw new Error('Signaling server is already running');
    }

    try {
      // In a real implementation, this would start an actual WebSocket server
      // For now, we'll simulate the server startup
      await this.simulateServerStart(port);

      this.serverStatus.isRunning = true;
      this.serverStatus.port = port;
      this.serverStatus.url = `ws://localhost:${port}`;
      this.serverStatus.connectedClients = 0;
      this.serverStatus.sessions.clear();

      this.statusSubject.next({ ...this.serverStatus });

      console.log(`[SignalingServer] Started on port ${port}`);
    } catch (error) {
      console.error('[SignalingServer] Failed to start server:', error);
      throw error;
    }
  }

  /**
   * Stop the signaling server
   */
  async stopServer(): Promise<void> {
    if (!this.serverStatus.isRunning) {
      return;
    }

    try {
      // Simulate server shutdown
      await this.simulateServerStop();

      this.serverStatus.isRunning = false;
      this.serverStatus.connectedClients = 0;
      this.serverStatus.sessions.clear();

      this.statusSubject.next({ ...this.serverStatus });

      console.log('[SignalingServer] Stopped');
    } catch (error) {
      console.error('[SignalingServer] Failed to stop server:', error);
      throw error;
    }
  }

  /**
   * Get current server status
   */
  getServerStatus(): SignalingServerStatus {
    return { ...this.serverStatus };
  }

  /**
   * Subscribe to server status changes
   */
  onStatusChange(): Observable<SignalingServerStatus> {
    return this.statusSubject.asObservable();
  }

  /**
   * Subscribe to signaling messages
   */
  onMessage(): Observable<SignalingMessage> {
    return this.messageSubject.asObservable();
  }

  /**
   * Simulate server startup (in a real implementation, this would start an actual WebSocket server)
   */
  private async simulateServerStart(port: number): Promise<void> {
    return new Promise((resolve) => {
      // Simulate server startup delay
      setTimeout(() => {
        console.log(
          `[SignalingServer] Simulated server started on port ${port}`
        );
        resolve();
      }, 1000);
    });
  }

  /**
   * Simulate server shutdown
   */
  private async simulateServerStop(): Promise<void> {
    return new Promise((resolve) => {
      // Simulate server shutdown delay
      setTimeout(() => {
        console.log('[SignalingServer] Simulated server stopped');
        resolve();
      }, 500);
    });
  }

  /**
   * Simulate a client joining a session
   */
  simulateClientJoin(sessionId: string, partyId: number): void {
    if (!this.serverStatus.isRunning) return;

    if (!this.serverStatus.sessions.has(sessionId)) {
      this.serverStatus.sessions.set(sessionId, new Set());
    }

    this.serverStatus.sessions.get(sessionId)!.add(partyId);
    this.serverStatus.connectedClients++;

    this.statusSubject.next({ ...this.serverStatus });

    console.log(
      `[SignalingServer] Party ${partyId} joined session ${sessionId}`
    );
  }

  /**
   * Simulate a client leaving a session
   */
  simulateClientLeave(sessionId: string, partyId: number): void {
    if (!this.serverStatus.isRunning) return;

    const session = this.serverStatus.sessions.get(sessionId);
    if (session) {
      session.delete(partyId);
      if (session.size === 0) {
        this.serverStatus.sessions.delete(sessionId);
      }
    }

    this.serverStatus.connectedClients = Math.max(
      0,
      this.serverStatus.connectedClients - 1
    );

    this.statusSubject.next({ ...this.serverStatus });

    console.log(`[SignalingServer] Party ${partyId} left session ${sessionId}`);
  }

  /**
   * Simulate broadcasting a message to all parties in a session
   */
  simulateBroadcast(
    sessionId: string,
    from: number,
    type: string,
    payload: any
  ): void {
    if (!this.serverStatus.isRunning) return;

    const session = this.serverStatus.sessions.get(sessionId);
    if (session) {
      session.forEach((partyId) => {
        if (partyId !== from) {
          this.messageSubject.next({
            type,
            from,
            payload,
            sessionId,
          });
        }
      });
    }
  }
}
