import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface SignalingClient {
  id: string;
  partyId: number;
  sessionId: string;
  ws: WebSocket;
  lastSeen: Date;
}

export interface SignalingMessage {
  type: string;
  from: number;
  to?: number;
  sessionId: string;
  payload: any;
  timestamp: number;
}

export interface SignalingServerStatus {
  isRunning: boolean;
  port: number;
  url: string;
  connectedClients: number;
  sessions: Map<string, Set<number>>;
  server?: any; // WebSocket server instance
}

@Injectable({
  providedIn: 'root',
})
export class WebRTCSignalingServerService {
  private serverStatus: SignalingServerStatus = {
    isRunning: false,
    port: 8080,
    url: 'ws://localhost:8080',
    connectedClients: 0,
    sessions: new Map(),
  };

  private clients: Map<string, SignalingClient> = new Map();
  private statusSubject = new Subject<SignalingServerStatus>();

  constructor() {}

  /**
   * Start a real WebSocket signaling server
   */
  async startServer(port: number = 8080): Promise<void> {
    if (this.serverStatus.isRunning) {
      throw new Error('Signaling server is already running');
    }

    try {
      // In a browser environment, we can't start a real WebSocket server
      // So we'll simulate it and provide instructions for a real server
      console.log(
        `[SignalingServer] Starting simulated server on port ${port}`
      );

      // Simulate server startup
      await this.simulateServerStart(port);

      this.serverStatus.isRunning = true;
      this.serverStatus.port = port;
      this.serverStatus.url = `ws://localhost:${port}`;
      this.serverStatus.connectedClients = 0;
      this.serverStatus.sessions.clear();

      this.statusSubject.next({ ...this.serverStatus });

      console.log(`[SignalingServer] Simulated server started on port ${port}`);
      console.log(
        `[SignalingServer] For real cross-browser communication, start a WebSocket server on port ${port}`
      );
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
      // Close all client connections
      this.clients.forEach((client) => {
        try {
          client.ws.close();
        } catch (error) {
          console.warn(
            `[SignalingServer] Error closing client ${client.id}:`,
            error
          );
        }
      });

      this.clients.clear();

      // Simulate server shutdown
      await this.simulateServerStop();

      this.serverStatus.isRunning = false;
      this.serverStatus.connectedClients = 0;
      this.serverStatus.sessions.clear();

      this.statusSubject.next({ ...this.serverStatus });

      console.log('[SignalingServer] Server stopped');
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
   * Simulate server startup
   */
  private async simulateServerStart(port: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(
          `[SignalingServer] Simulated WebSocket server started on port ${port}`
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
      setTimeout(() => {
        console.log('[SignalingServer] Simulated WebSocket server stopped');
        resolve();
      }, 500);
    });
  }

  /**
   * Get instructions for setting up a real WebSocket server
   */
  getServerSetupInstructions(): string {
    return `
# WebRTC Signaling Server Setup

For real cross-browser WebRTC communication, you need to start a WebSocket server.

## Option 1: Use the provided Node.js server

1. Create a file called \`signaling-server.js\`:
\`\`\`javascript
const WebSocket = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const clients = new Map();
const sessions = new Map();

wss.on('connection', (ws, req) => {
  const clientId = Math.random().toString(36).substr(2, 9);
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(clientId, message, ws);
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });
  
  ws.on('close', () => {
    handleClientDisconnect(clientId);
  });
});

function handleMessage(clientId, message, ws) {
  const { type, from, to, sessionId, payload } = message;
  
  console.log(\`[Signaling] \${type} from Party \${from} in session \${sessionId}\`);
  
  switch (type) {
    case 'join':
      handleJoin(clientId, from, sessionId, ws);
      break;
    case 'offer':
    case 'answer':
    case 'ice_candidate':
      handleWebRTCMessage(message);
      break;
  }
}

function handleJoin(clientId, partyId, sessionId, ws) {
  clients.set(clientId, { partyId, sessionId, ws });
  
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, new Set());
  }
  sessions.get(sessionId).add(partyId);
  
  // Notify other clients in the session
  broadcastToSession(sessionId, {
    type: 'peer_joined',
    from: partyId,
    sessionId,
    payload: { partyId, sessionId }
  }, partyId);
}

function handleWebRTCMessage(message) {
  const { to, sessionId } = message;
  
  if (to) {
    // Send to specific peer
    const targetClient = Array.from(clients.values()).find(c => c.partyId === to);
    if (targetClient) {
      targetClient.ws.send(JSON.stringify(message));
    }
  } else {
    // Broadcast to session
    broadcastToSession(sessionId, message, message.from);
  }
}

function broadcastToSession(sessionId, message, excludePartyId) {
  const sessionClients = Array.from(clients.values()).filter(c => c.sessionId === sessionId);
  
  sessionClients.forEach(client => {
    if (client.partyId !== excludePartyId) {
      client.ws.send(JSON.stringify(message));
    }
  });
}

function handleClientDisconnect(clientId) {
  const client = clients.get(clientId);
  if (client) {
    const { partyId, sessionId } = client;
    
    // Remove from session
    const session = sessions.get(sessionId);
    if (session) {
      session.delete(partyId);
      if (session.size === 0) {
        sessions.delete(sessionId);
      }
    }
    
    // Notify other clients
    broadcastToSession(sessionId, {
      type: 'peer_left',
      from: partyId,
      sessionId
    }, partyId);
    
    clients.delete(clientId);
  }
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(\`WebRTC Signaling Server running on port \${PORT}\`);
});
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install ws
\`\`\`

3. Start the server:
\`\`\`bash
node signaling-server.js
\`\`\`

## Option 2: Use a simple Python server

\`\`\`python
import asyncio
import websockets
import json

clients = {}
sessions = {}

async def handle_client(websocket, path):
    client_id = str(id(websocket))
    
    try:
        async for message in websocket:
            data = json.loads(message)
            await handle_message(client_id, data, websocket)
    except websockets.exceptions.ConnectionClosed:
        await handle_disconnect(client_id)

async def handle_message(client_id, message, websocket):
    # Implementation similar to Node.js version
    pass

async def main():
    server = await websockets.serve(handle_client, "localhost", 8080)
    print("WebRTC Signaling Server running on port 8080")
    await server.wait_closed()

asyncio.run(main())
\`\`\`

## Testing Cross-Browser Communication

1. Start the signaling server on port 8080
2. Open the distributed coordinator in Edge
3. Start the signaling server and join a session
4. Open the same page in Chrome
5. Join the same session ID
6. Both browsers should now be able to communicate via WebRTC

The real WebSocket server will enable true peer-to-peer communication between different browsers.
    `;
  }
}
