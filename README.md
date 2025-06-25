# TLS-MCP (Threshold Linear Secret Sharing - Multi-Party Computation)

A proof of concept implementation of a true threshold cryptography system for secure multi-party key management, specifically designed for cryptocurrency wallet security.

## Overview

This system implements a (3,3) threshold scheme where:

- **Party A, Party B, Party C**: The three participating parties that generate their own shares independently
- **Coordinator**: A central server that acts purely as a messenger/orchestrator (no cryptographic material stored)
- **Frontend**: Angular application that can optionally participate as a party
- **Threshold**: All three parties must participate for any operation to succeed

## Key Security Features

- **True Threshold Cryptography**: Each party generates their own share independently
- **No Single Point of Failure**: The coordinator never has access to the complete private key
- **Distributed Key Generation (DKG)**: Parties contribute to generating the master key without any party seeing the complete key
- **Messenger-Only Coordinator**: The backend acts purely as a communication relay
- **Client-Side Cryptography**: All cryptographic operations performed in the browser

## Quick Start

```bash
# 1. Install dependencies
npm install
cd frontend && npm install && cd ..

# 2. Set up environment
cp env.example .env
# Edit .env with your configuration

# 3. Start all services (in separate terminals)
# Terminal 1 - Coordinator (Messenger)
npm run dev

# Terminal 2 - Frontend (can act as parties)
cd frontend && npm start

# 4. Access the system
# Frontend: http://localhost:4200
# Coordinator API: http://localhost:3000
```

## Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Party A   │    │   Party B   │    │   Party C   │
│ (External/  │    │ (External/  │    │ (External/  │
│  Frontend)  │    │  Frontend)  │    │  Frontend)  │
│             │    │             │    │             │
│ • Generates │    │ • Generates │    │ • Generates │
│   own share │    │   own share │    │   own share │
│ • Computes  │    │ • Computes  │    │ • Computes  │
│   signature │    │   signature │    │   signature │
│   components│    │   components│    │   components│
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │
       └──────────────────┼──────────────────┘
                          │
                   ┌──────▼──────┐
                   │ Coordinator │
                   │ (Port 3000) │
                   │             │
                   │ • Messenger │
                   │ • No crypto │
                   │ • In-memory │
                   │   sessions  │
                   └─────────────┘
                          │
                   ┌──────▼──────┐
                   │   Frontend  │
                   │ (Port 4200) │
                   │ IndexedDB   │
                   └─────────────┘
```

## Features

- **Distributed Key Generation**: Parties generate their own shares independently
- **Threshold Signatures**: Create signatures requiring all parties to participate
- **Webhook Communication**: Real-time communication between coordinator and parties
- **Session Management**: Track and manage multi-party sessions
- **Audit Logging**: Comprehensive logging of all operations
- **Client-Side Cryptography**: Cryptographic operations performed in the browser
- **IndexedDB Storage**: Local storage for encrypted shares and communication keys
- **Frontend Party Participation**: Frontend can optionally act as one or more parties
- **Real-time Health Monitoring**: Automatic health checks of all services
- **In-Memory Session Storage**: No database required - sessions stored in memory

## Prerequisites

- Node.js 22+
- Angular CLI (for frontend development)
- Modern browser with IndexedDB support

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd tls-mcp
```

### 2. Backend Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp env.example .env

# Edit .env with your configuration
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Security Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
SESSION_SECRET=your-session-secret-key-change-this-in-production

# Webhook Configuration
WEBHOOK_TIMEOUT=30000
WEBHOOK_RETRY_ATTEMPTS=3

# Party Configuration (for external parties)
PARTY_A_WEBHOOK_URL=http://localhost:3001/webhook
PARTY_B_WEBHOOK_URL=http://localhost:3002/webhook
PARTY_C_WEBHOOK_URL=http://localhost:3003/webhook

# Threshold Configuration
THRESHOLD_TOTAL_PARTIES=3
THRESHOLD_REQUIRED_PARTIES=3

# Crypto Configuration
KEY_SIZE=256
HASH_ALGORITHM=sha256
```

## Running the System

### 1. Start the Coordinator

```bash
# Development mode
npm run dev

# Production mode
npm start
```

The coordinator will be available at `http://localhost:3000`

### 2. Start the Frontend

```bash
cd frontend
npm start
```

The frontend will be available at `http://localhost:4200`

### 3. Optional: Start External Party Simulators

If you want to use external party simulators instead of frontend participation:

```bash
# Terminal 1 - Party A
cd party-simulator
npm run party-a

# Terminal 2 - Party B
cd party-simulator
npm run party-b

# Terminal 3 - Party C
cd party-simulator
npm run party-c
```

## Frontend Features

The Angular frontend includes:

- **Real-time Health Monitoring**: Automatic health checks of coordinator and all parties
- **Dashboard**: System status, recent sessions, and quick actions
- **Session Management**: Create, view, and manage TLS-MCP sessions
- **Distributed Key Generation**: Multi-step wizard for creating new sessions with party participation options
- **Threshold Signatures**: Create threshold signatures with active sessions
- **Webhook Logs**: View detailed communication logs between coordinator and parties
- **Party Participation**: Option to participate as one or more parties during session creation

## API Usage

### 1. Initialize a Session

```bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "key_generation",
    "parties": [
      {"name": "Party A", "webhookUrl": "http://localhost:4200/api/party/webhook"},
      {"name": "Party B", "webhookUrl": "http://localhost:3002/webhook"},
      {"name": "Party C", "webhookUrl": "http://localhost:3003/webhook"}
    ],
    "metadata": {
      "description": "Test distributed key generation",
      "blockchain": "ethereum"
    }
  }'
```

### 2. Initiate Distributed Key Generation

```bash
curl -X POST http://localhost:3000/api/sessions/{sessionId}/initiate-dkg \
  -H "Content-Type: application/json" \
  -d '{
    "blockchain": "ethereum"
  }'
```

### 3. Create a Threshold Signature

```bash
curl -X POST http://localhost:3000/api/sessions/{sessionId}/sign \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, World!"
  }'
```

## Cryptographic Implementation

### True Threshold Cryptography

The system implements proper threshold cryptography where:

- **Each party generates their own share** independently using cryptographically secure random number generation
- **No single entity ever has access to the complete private key**
- **The coordinator acts only as a messenger** between parties
- **All cryptographic operations are performed by the parties themselves**

### Distributed Key Generation (DKG)

1. **Session Initialization**: Coordinator creates a session and notifies all parties
2. **DKG Initiation**: Coordinator requests all parties to begin distributed key generation
3. **Share Generation**: Each party generates their own share independently
4. **Commitment Exchange**: Parties exchange commitments to prove they have valid shares
5. **DKG Completion**: All parties confirm they have generated their shares

### Threshold Signatures

1. **Signature Request**: Coordinator requests signature components from all parties
2. **Component Generation**: Each party computes signature components using their share
3. **Component Collection**: Coordinator collects signature components from all parties
4. **Signature Combination**: Coordinator combines signature components (in a real implementation, this would be done by parties)

### Key Features

1. **Independent Share Generation**: Each party generates their own share without coordination
2. **Commitment Scheme**: Shares are committed to prevent tampering
3. **Threshold Signatures**: Signatures require all parties to participate
4. **No Key Escrow**: The coordinator never has access to cryptographic material

## Security Considerations

- **No Single Point of Failure**: The coordinator never stores cryptographic material
- **Client-Side Cryptography**: All sensitive operations performed in the browser
- **Independent Share Generation**: Each party generates their own share
- **Commitment Verification**: Shares are committed to prevent tampering
- **In-Memory Sessions**: No persistent storage of cryptographic material

## Development Notes

This is a proof-of-concept implementation. For production use, consider:

- Implementing proper DKG protocols (e.g., Pedersen DKG)
- Using established threshold signature schemes (e.g., ECDSA threshold signatures)
- Adding proper authentication and authorization
- Implementing secure communication channels
- Adding proper error handling and recovery mechanisms
- Using hardware security modules (HSMs) for party implementations

## Testing

### Manual Testing

1. Start all services (coordinator, frontend)
2. Create a session via frontend with party participation
3. Generate a key and verify shares are distributed
4. Test signature creation
5. Test key reconstruction (development only)

### Automated Testing

```bash
# Run backend tests
npm test

# Run frontend tests
cd frontend
npm test
```

## Monitoring

### Health Checks

- Coordinator: `http://localhost:3000/health`
- Frontend: `http://localhost:4200/health`
- External Parties: `http://localhost:3001/health`, `http://localhost:3002/health`, `http://localhost:3003/health`

### Logs

All operations are logged to MongoDB with detailed webhook communication logs.

## Troubleshooting

### Common Issues

1. **MongoDB Connection**: Ensure MongoDB Atlas is accessible and credentials are correct
2. **Port Conflicts**: Ensure ports 3000 and 4200 are available
3. **IndexedDB Issues**:
   - Clear browser data if IndexedDB shows errors
   - Use the reset button in the dashboard to reinitialize IndexedDB
   - Check browser console for IndexedDB errors
4. **CORS Issues**:
   - Frontend includes CORS configuration for coordinator communication
   - If frontend shows parties as offline, check that external party simulators are running
   - Verify CORS headers in browser developer tools
   - Check browser console for CORS errors
5. **Webhook Failures**: Verify external party simulators are running and accessible
6. **Health Check Failures**:
   - Check that all services are running on correct ports
   - Verify network connectivity between frontend and coordinator
   - Check browser console for detailed health check logs
   - Use browser developer tools to inspect network requests
7. **Crypto Errors**:
   - Ensure browser supports Web Crypto API
   - Check for polyfill issues in older browsers
   - Verify IndexedDB is available and working

### Debug Mode

Enable debug logging by setting `NODE_ENV=development` in the `.env` file.

### IndexedDB Management

The dashboard includes tools for managing IndexedDB:

- **Sync Data**: Manually sync server data to IndexedDB
- **Reset Database**: Clear and reinitialize IndexedDB
- **View Data**: Inspect stored data for debugging

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- Shamir's Secret Sharing algorithm
- Threshold cryptography research
- Multi-party computation protocols
- Web Crypto API and IndexedDB standards
