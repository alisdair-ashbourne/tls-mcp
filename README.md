# TLS-MCP (Threshold Linear Secret Sharing - Multi-Party Computation)

A proof of concept implementation of a threshold cryptography system for secure multi-party key management, specifically designed for cryptocurrency wallet security.

## Overview

This system implements a (3,3) threshold scheme where:
- **Party A, Party B, Party C**: The three participating parties (can be external services or the frontend itself)
- **Coordinator**: A central server that orchestrates the multi-party operations
- **Frontend**: Angular application that can optionally participate as a party
- **Threshold**: All three parties must participate for any operation to succeed

## Quick Start

```bash
# 1. Install dependencies
npm install
cd frontend && npm install && cd ..

# 2. Set up environment
cp env.example .env
# Edit .env with your MongoDB connection string

# 3. Start all services (in separate terminals)
# Terminal 1 - Coordinator
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
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │
       └──────────────────┼──────────────────┘
                          │
                   ┌──────▼──────┐
                   │ Coordinator │
                   │ (Port 3000) │
                   └──────┬──────┘
                          │
                   ┌──────▼──────┐
                   │   MongoDB   │
                   │   Atlas     │
                   └─────────────┘
                          │
                   ┌──────▼──────┐
                   │   Frontend  │
                   │ (Port 4200) │
                   │ IndexedDB   │
                   └─────────────┘
```

## Features

- **Key Generation**: Generate private keys and distribute shares among parties
- **Key Reconstruction**: Reconstruct private keys from shares (development only)
- **Threshold Signatures**: Create signatures requiring all parties
- **Webhook Communication**: Real-time communication between coordinator and parties
- **Session Management**: Track and manage multi-party sessions
- **Audit Logging**: Comprehensive logging of all operations
- **Client-Side Cryptography**: Cryptographic operations performed in the browser
- **IndexedDB Storage**: Local storage for encrypted shares and communication keys
- **Frontend Party Participation**: Frontend can optionally act as one or more parties
- **Real-time Health Monitoring**: Automatic health checks of all services
- **MongoDB Storage**: Server-side session and log storage

## Prerequisites

- Node.js 22+
- MongoDB Atlas account with replica set
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

# Edit .env with your MongoDB connection string
# MONGODB_URI=mongodb://user:pass@localhost:27017/tls-mcp?directConnection=true&authSource=admin&replicaSet=rs0
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

# MongoDB Configuration
MONGODB_URI=

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
- **Key Generation**: Multi-step wizard for creating new sessions with party participation options
- **Signature Creation**: Create threshold signatures with active sessions
- **Webhook Logs**: View detailed communication logs between coordinator and parties
- **Party Participation**: Option to participate as one or more parties during session creation
- **IndexedDB Management**: Local storage management for encrypted data
- **Client-Side Cryptography**: Secure key generation, encryption, and decryption in the browser

**Health Checking**: The dashboard automatically checks the health of all services every 30 seconds and provides manual refresh capability. Health checks include response times and detailed error reporting.

**Party Participation**: During session creation, you can choose which parties the frontend should participate as. The frontend will handle all cryptographic operations locally and communicate with the coordinator via webhooks.

## API Endpoints

### Session Management

- `POST /api/sessions` - Create a new session
- `GET /api/sessions` - List all sessions
- `GET /api/sessions/:sessionId` - Get session details

### Key Operations

- `POST /api/sessions/:sessionId/generate-key` - Generate and distribute key shares
- `POST /api/sessions/:sessionId/reconstruct-key` - Reconstruct private key (development only)
- `POST /api/sessions/:sessionId/sign` - Create threshold signature

### Webhook Management

- `POST /api/webhook/:sessionId/:partyId` - Handle party responses
- `GET /api/webhook-logs/:sessionId` - Get webhook logs

### Health Check

- `GET /health` - System health status

## Usage Examples

### 1. Create a Session with Frontend Participation

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
      "description": "Test wallet key generation with frontend participation"
    }
  }'
```

### 2. Generate a Key

```bash
curl -X POST http://localhost:3000/api/sessions/{sessionId}/generate-key \
  -H "Content-Type: application/json" \
  -d '{
    "blockchain": "ethereum"
  }'
```

### 3. Create a Signature

```bash
curl -X POST http://localhost:3000/api/sessions/{sessionId}/sign \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, World!"
  }'
```

## Cryptographic Implementation

### Client-Side Cryptography

The system now performs cryptographic operations in the browser for enhanced security:

- **Key Generation**: Private keys are generated client-side using cryptographically secure random number generation
- **Key Derivation**: Communication keys are derived from the master private key
- **Encryption/Decryption**: All sensitive data is encrypted before storage using ECC encryption
- **IndexedDB Storage**: Encrypted shares and communication keys are stored locally in IndexedDB

### Shamir's Secret Sharing

The system uses Shamir's Secret Sharing with the following properties:

- **Threshold**: 3 parties required
- **Total Parties**: 3 parties
- **Field**: Large prime number for finite field operations
- **Polynomial**: Random coefficients for security

### Key Features

1. **Secret Splitting**: Private keys are split into shares using polynomial interpolation
2. **Commitment Scheme**: Shares are committed to prevent tampering
3. **Threshold Signatures**: Signatures require all parties to participate
4. **Verification**: Cryptographic verification of all operations
5. **Client-Side Security**: No private keys are stored on the server

## Security Considerations

### Production Recommendations

1. **Encryption**: All stored shares and sensitive data are encrypted client-side
2. **Authentication**: Implement proper authentication for all parties
3. **Webhook Signatures**: Validate webhook signatures
4. **Network Security**: Use HTTPS for all communications
5. **Key Management**: Implement proper key rotation and backup procedures
6. **Audit Logging**: Comprehensive audit trails for compliance
7. **Client-Side Security**: Private keys never leave the client

### Current Limitations (PoC)

1. **Simplified Crypto**: Uses basic implementations for demonstration
2. **No Authentication**: Parties are not authenticated
3. **Development Key Reconstruction**: Key reconstruction is only available in development mode
4. **Single Point of Failure**: Coordinator is a single point of failure

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