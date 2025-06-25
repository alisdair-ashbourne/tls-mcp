import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface SignalingMessage {
  type: string;
  from: number;
  to?: number;
  sessionId: string;
  payload: any;
  timestamp: number;
  messageId: string;
}

export interface BrowserSignalingStatus {
  isRunning: boolean;
  method: 'localStorage' | 'broadcastChannel' | 'indexedDB';
  connectedClients: number;
  sessions: Map<string, Set<number>>;
}

@Injectable({
  providedIn: 'root',
})
export class BrowserSignalingService {
  private status: BrowserSignalingStatus = {
    isRunning: false,
    method: 'broadcastChannel',
    connectedClients: 0,
    sessions: new Map(),
  };

  private messageSubject = new Subject<SignalingMessage>();
  private statusSubject = new Subject<BrowserSignalingStatus>();
  private broadcastChannel?: BroadcastChannel;
  private storageKey = 'webrtc-signaling';
  private messageId = 0;
  private clientId: string;

  constructor() {
    this.clientId = Math.random().toString(36).substr(2, 9);
  }

  /**
   * Start browser-based signaling using BroadcastChannel API
   */
  async startSignaling(): Promise<void> {
    if (this.status.isRunning) {
      throw new Error('Signaling is already running');
    }

    try {
      // Try BroadcastChannel first (most efficient)
      if ('BroadcastChannel' in window) {
        await this.startBroadcastChannelSignaling();
      } else {
        // Fallback to localStorage
        await this.startLocalStorageSignaling();
      }

      this.status.isRunning = true;
      this.statusSubject.next({ ...this.status });

      console.log('[BrowserSignaling] Started using', this.status.method);
    } catch (error) {
      console.error('[BrowserSignaling] Failed to start:', error);
      throw error;
    }
  }

  /**
   * Stop browser-based signaling
   */
  async stopSignaling(): Promise<void> {
    if (!this.status.isRunning) {
      return;
    }

    try {
      if (this.broadcastChannel) {
        this.broadcastChannel.close();
        this.broadcastChannel = undefined;
      }

      // Clean up localStorage
      this.cleanupLocalStorage();

      this.status.isRunning = false;
      this.status.connectedClients = 0;
      this.status.sessions.clear();
      this.statusSubject.next({ ...this.status });

      console.log('[BrowserSignaling] Stopped');
    } catch (error) {
      console.error('[BrowserSignaling] Failed to stop:', error);
      throw error;
    }
  }

  /**
   * Send a signaling message
   */
  async sendMessage(
    message: Omit<SignalingMessage, 'messageId' | 'timestamp'>
  ): Promise<void> {
    if (!this.status.isRunning) {
      throw new Error('Signaling is not running');
    }

    const fullMessage: SignalingMessage = {
      ...message,
      messageId: `${this.clientId}-${++this.messageId}`,
      timestamp: Date.now(),
    };

    if (this.status.method === 'broadcastChannel') {
      this.broadcastChannel?.postMessage(fullMessage);
    } else {
      this.sendLocalStorageMessage(fullMessage);
    }

    console.log(
      '[BrowserSignaling] Sent message:',
      fullMessage.type,
      'to session:',
      fullMessage.sessionId
    );
  }

  /**
   * Subscribe to incoming messages
   */
  onMessage(): Observable<SignalingMessage> {
    return this.messageSubject.asObservable();
  }

  /**
   * Subscribe to status changes
   */
  onStatusChange(): Observable<BrowserSignalingStatus> {
    return this.statusSubject.asObservable();
  }

  /**
   * Get current status
   */
  getStatus(): BrowserSignalingStatus {
    return { ...this.status };
  }

  /**
   * Start signaling using BroadcastChannel API
   */
  private async startBroadcastChannelSignaling(): Promise<void> {
    this.status.method = 'broadcastChannel';

    this.broadcastChannel = new BroadcastChannel('webrtc-signaling');

    this.broadcastChannel.onmessage = (event) => {
      const message: SignalingMessage = event.data;
      this.handleIncomingMessage(message);
    };

    // Announce our presence
    await this.sendMessage({
      type: 'announce',
      from: 0, // Will be set by the client
      sessionId: 'global',
      payload: { clientId: this.clientId, timestamp: Date.now() },
    });
  }

  /**
   * Start signaling using localStorage (fallback)
   */
  private async startLocalStorageSignaling(): Promise<void> {
    this.status.method = 'localStorage';

    // Set up storage event listener
    window.addEventListener('storage', (event) => {
      if (event.key === this.storageKey && event.newValue) {
        try {
          const message: SignalingMessage = JSON.parse(event.newValue);
          this.handleIncomingMessage(message);
        } catch (error) {
          console.error(
            '[BrowserSignaling] Failed to parse storage message:',
            error
          );
        }
      }
    });

    // Announce our presence
    await this.sendMessage({
      type: 'announce',
      from: 0,
      sessionId: 'global',
      payload: { clientId: this.clientId, timestamp: Date.now() },
    });

    // Start polling for messages
    this.startLocalStoragePolling();
  }

  /**
   * Send message via localStorage
   */
  private sendLocalStorageMessage(message: SignalingMessage): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(message));
      // Trigger storage event for other tabs
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: this.storageKey,
          newValue: JSON.stringify(message),
        })
      );
    } catch (error) {
      console.error(
        '[BrowserSignaling] Failed to send localStorage message:',
        error
      );
    }
  }

  /**
   * Start polling localStorage for messages
   */
  private startLocalStoragePolling(): void {
    setInterval(() => {
      try {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
          const message: SignalingMessage = JSON.parse(stored);
          // Only process messages not from us
          if (
            message.messageId &&
            !message.messageId.startsWith(this.clientId)
          ) {
            this.handleIncomingMessage(message);
          }
        }
      } catch (error) {
        console.error('[BrowserSignaling] Polling error:', error);
      }
    }, 100); // Poll every 100ms
  }

  /**
   * Handle incoming signaling message
   */
  private handleIncomingMessage(message: SignalingMessage): void {
    console.log(
      '[BrowserSignaling] Received message:',
      message.type,
      'from:',
      message.from
    );

    // Update session tracking
    if (message.sessionId !== 'global') {
      if (!this.status.sessions.has(message.sessionId)) {
        this.status.sessions.set(message.sessionId, new Set());
      }
      this.status.sessions.get(message.sessionId)?.add(message.from);
    }

    // Emit message to subscribers
    this.messageSubject.next(message);
  }

  /**
   * Clean up localStorage
   */
  private cleanupLocalStorage(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.warn('[BrowserSignaling] Failed to cleanup localStorage:', error);
    }
  }

  /**
   * Get instructions for browser-based signaling
   */
  getBrowserSignalingInstructions(): string {
    return `
# Browser-Based WebRTC Signaling

This implementation uses browser APIs to enable WebRTC signaling without a server!

## How It Works

### Method 1: BroadcastChannel API (Recommended)
- Uses the BroadcastChannel API to communicate between browser tabs/windows
- Real-time communication with minimal latency
- Works across different tabs of the same origin

### Method 2: localStorage (Fallback)
- Uses localStorage events to communicate between tabs
- Slightly higher latency but works in older browsers
- Polling-based message detection

## Cross-Browser Communication

### Same Browser, Different Tabs
✅ **Fully Supported**
- Open multiple tabs of your app
- Each tab can join the same session
- Real-time communication via BroadcastChannel

### Different Browsers (Edge ↔ Chrome)
❌ **Not Supported** (Browser Limitation)
- Browsers cannot communicate directly with each other
- Each browser instance is isolated for security reasons

### Same Browser, Different Windows
✅ **Supported**
- Multiple windows of the same browser work
- Uses the same BroadcastChannel API

## Usage

1. **Start Signaling**: Click "Start Signaling" in the distributed coordinator
2. **Join Session**: Enter the same session ID in multiple tabs
3. **Real-time Communication**: Messages are exchanged automatically

## Technical Details

- **No Server Required**: Everything runs in the browser
- **Secure**: Uses browser's built-in security mechanisms
- **Efficient**: BroadcastChannel provides real-time communication
- **Fallback**: localStorage ensures compatibility with older browsers

## Limitations

- Only works within the same browser instance
- Cannot communicate between different browsers (Edge ↔ Chrome)
- Requires same-origin policy compliance
- Limited to browser's storage and messaging capabilities

## Alternative for Cross-Browser Communication

For true cross-browser communication (Edge ↔ Chrome), you still need:
1. A WebSocket server (Node.js, Python, etc.)
2. Or a cloud-based signaling service
3. Or a peer-to-peer relay service

The browser-based approach is perfect for:
- Development and testing
- Single-user multi-tab scenarios
- Demonstrations and prototypes
    `;
  }
}
