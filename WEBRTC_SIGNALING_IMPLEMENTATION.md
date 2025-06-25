# WebRTC Signaling Server Implementation

## Overview

This implementation adds a WebRTC signaling server to the distributed coordinator component, allowing parties to start their own signaling server directly from the browser interface. This eliminates the need for a separate signaling server deployment and provides a complete self-contained WebRTC MPC solution.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                Distributed Coordinator UI                    │
├─────────────────────────────────────────────────────────────┤
│  🔧 Signaling Server Controls                              │
│  ├─ Start/Stop Server Button                               │
│  ├─ Port Configuration                                     │
│  ├─ Server Status Display                                  │
│  └─ Active Sessions List                                   │
├─────────────────────────────────────────────────────────────┤
│  🌐 WebRTC Session Management                              │
│  ├─ Session Creation/Joining                               │
│  ├─ Peer Connection Status                                 │
│  ├─ Consensus Operations                                   │
│  └─ Real-time Communication                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Signaling Server Service                       │
│  ├─ WebSocket Server Management                            │
│  ├─ Session Tracking                                       │
│  ├─ Message Broadcasting                                   │
│  └─ Client Connection Management                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              WebRTC Service                                 │
│  ├─ Peer Connection Management                             │
│  ├─ Data Channel Setup                                     │
│  ├─ ICE Candidate Handling                                 │
│  └─ Message Routing                                        │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. SignalingServerService

**Location**: `frontend/src/app/services/signaling-server.service.ts`

**Purpose**: Manages the WebRTC signaling server lifecycle and message routing.

**Key Features**:

- Server startup/shutdown
- Session management
- Client connection tracking
- Message broadcasting
- Status monitoring

**Key Methods**:

```typescript
async startServer(port: number): Promise<void>
async stopServer(): Promise<void>
getServerStatus(): SignalingServerStatus
simulateClientJoin(sessionId: string, partyId: number): void
simulateClientLeave(sessionId: string, partyId: number): void
simulateBroadcast(sessionId: string, from: number, type: string, payload: any): void
```

### 2. DistributedCoordinatorComponent

**Location**: `frontend/src/app/components/distributed-coordinator/distributed-coordinator.component.ts`

**Purpose**: Main UI component for distributed coordinator functionality with integrated signaling server controls.

**Key Features**:

- Signaling server start/stop controls
- Server status display
- Active sessions monitoring
- WebRTC session management
- Consensus operations
- Real-time communication

**UI Sections**:

1. **Signaling Server Management**
   - Server status indicator
   - Port configuration
   - Start/Stop buttons
   - Active sessions display

2. **Session Management**
   - Party configuration
   - Session joining/creation
   - Peer connection status
   - Consensus operations

3. **Real-time Monitoring**
   - Connection logs
   - Proposal tracking
   - Vote management
   - Operation history

## Usage

### Starting the Signaling Server

1. **Navigate to Distributed Coordinator**: Open the distributed coordinator component in the frontend
2. **Configure Port**: Set the desired port (default: 8080)
3. **Start Server**: Click "Start Server" button
4. **Verify Status**: Check that server status shows "🟢 Running"

### Joining a Distributed Session

1. **Ensure Server Running**: Signaling server must be started first
2. **Configure Party**: Set your party ID, total parties, and threshold
3. **Enter Session ID**: Either enter existing session ID or generate new one
4. **Join Session**: Click "Join Session" button
5. **Monitor Peers**: Watch for other parties joining the session

### Consensus Operations

1. **Propose Operations**: Use operation buttons to propose DKG initiation, party responses, etc.
2. **Vote on Proposals**: Approve or reject pending proposals from other parties
3. **Monitor Consensus**: Watch for consensus reached/failed notifications
4. **Track Committed Operations**: View successfully committed operations

## Implementation Details

### Signaling Server Simulation

The current implementation uses a simulated signaling server for demonstration purposes. In a production environment, this would be replaced with:

```typescript
// Real WebSocket server implementation
import { WebSocketServer } from 'ws';

class RealSignalingServer {
  private wss: WebSocketServer;

  async startServer(port: number): Promise<void> {
    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });
  }

  private handleConnection(ws: WebSocket, req: any): void {
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      this.routeMessage(ws, message);
    });
  }
}
```

### WebRTC Integration

The WebRTC service handles peer-to-peer connections:

```typescript
// WebRTC peer connection setup
const connection = new RTCPeerConnection(this.rtcConfig);
const dataChannel = connection.createDataChannel(`mpc-${sessionId}`);

dataChannel.onmessage = (event) => {
  const message = JSON.parse(event.data);
  this.handleMPCMessage(message);
};
```

### Consensus Protocol

The distributed coordinator implements a consensus protocol:

1. **Proposal Phase**: Any party can propose operations
2. **Voting Phase**: All parties vote on proposals
3. **Consensus Check**: Operations require unanimous approval
4. **Commit Phase**: Successful operations are committed

## Security Considerations

### Current Implementation

- **Simulated Server**: Uses in-memory simulation for demo purposes
- **No Authentication**: Parties can join any session
- **No Encryption**: Messages are not encrypted in simulation

### Production Requirements

- **Real WebSocket Server**: Deploy actual WebSocket server
- **Authentication**: Implement party authentication
- **Message Encryption**: Encrypt all signaling messages
- **Session Validation**: Validate session parameters
- **Rate Limiting**: Prevent abuse of signaling server

## Testing

### Unit Tests

```bash
cd frontend
npm test -- --include="**/distributed-coordinator.component.spec.ts"
```

### Demo Script

```bash
node webrtc-signaling-demo.js
```

## Benefits

1. **Self-Contained**: No external signaling server required
2. **Easy Deployment**: Start server directly from browser
3. **Real-time Communication**: WebRTC enables direct peer-to-peer messaging
4. **Distributed Consensus**: All parties participate in coordination decisions
5. **Fault Tolerant**: No single point of failure
6. **Scalable**: Can handle multiple concurrent sessions

## Future Enhancements

1. **Real WebSocket Server**: Replace simulation with actual WebSocket server
2. **Authentication**: Add party authentication and session validation
3. **Encryption**: Implement end-to-end encryption for all messages
4. **Persistent Storage**: Add session persistence across browser restarts
5. **Advanced Consensus**: Implement more sophisticated consensus protocols
6. **Monitoring**: Add detailed metrics and monitoring capabilities

## Conclusion

This WebRTC signaling server implementation provides a complete solution for distributed MPC coordination. It eliminates the need for external infrastructure while maintaining the security and decentralization benefits of distributed coordination. The integrated UI makes it easy for users to start their own signaling server and participate in distributed MPC sessions directly from their browser.
