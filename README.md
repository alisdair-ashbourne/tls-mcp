# TLS-MCP (Threshold Linear Secret Sharing - Multi-Party Computation)

A proof of concept implementation of a threshold cryptography system for secure multi-party key management, specifically designed for cryptocurrency wallet security.

## Overview

This system implements a (3,3) threshold scheme where:
- **Party A, Party B, Party C**: The three participating parties
- **Coordinator**: A central server that orchestrates the multi-party operations
- **Threshold**: All three parties must participate for any operation to succeed

## Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Party A   │    │   Party B   │    │   Party C   │
│  (Port 3001)│    │  (Port 3002)│    │  (Port 3003)│
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
```

## Features

- **Key Generation**: Generate private keys and distribute shares among parties
- **Key Reconstruction**: Reconstruct private keys from shares
- **Threshold Signatures**: Create signatures requiring all parties
- **Webhook Communication**: Real-time communication between coordinator and parties
- **Session Management**: Track and manage multi-party sessions
- **Audit Logging**: Comprehensive logging of all operations
- **Browser Storage**: IndexedDB for client-side share storage
- **MongoDB Storage**: Server-side session and log storage

## Prerequisites

- Node.js 22+
- MongoDB Atlas account with replica set
- Angular CLI (for frontend development)

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

### 4. Party Simulator Setup

```bash
cd party-simulator
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

# Party Configuration
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

### 2. Start Party Simulators

Open three terminal windows and run:

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

### 3. Start the Frontend

```bash
cd frontend
npm start
```

The frontend will be available at `http://localhost:4200`

## API Endpoints

### Session Management

- `POST /api/sessions` - Create a new session
- `GET /api/sessions` - List all sessions
- `GET /api/sessions/:sessionId` - Get session details

### Key Operations

- `POST /api/sessions/:sessionId/generate-key` - Generate and distribute key shares
- `POST /api/sessions/:sessionId/reconstruct-key` - Reconstruct private key
- `POST /api/sessions/:sessionId/sign` - Create threshold signature

### Webhook Management

- `POST /api/webhook/:sessionId/:partyId` - Handle party responses
- `GET /api/webhook-logs/:sessionId` - Get webhook logs

### Health Check

- `GET /health` - System health status

## Usage Examples

### 1. Create a Session

```bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "key_generation",
    "parties": [
      {"name": "Party A", "webhookUrl": "http://localhost:3001/webhook"},
      {"name": "Party B", "webhookUrl": "http://localhost:3002/webhook"},
      {"name": "Party C", "webhookUrl": "http://localhost:3003/webhook"}
    ],
    "metadata": {
      "description": "Test wallet key generation"
    }
  }'
```

### 2. Generate a Key

```bash
curl -X POST http://localhost:3000/api/sessions/{sessionId}/generate-key \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
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

## Security Considerations

### Production Recommendations

1. **Encryption**: Encrypt all stored shares and sensitive data
2. **Authentication**: Implement proper authentication for all parties
3. **Webhook Signatures**: Validate webhook signatures
4. **Network Security**: Use HTTPS for all communications
5. **Key Management**: Implement proper key rotation and backup procedures
6. **Audit Logging**: Comprehensive audit trails for compliance

### Current Limitations (PoC)

1. **Simplified Crypto**: Uses basic implementations for demonstration
2. **No Authentication**: Parties are not authenticated
3. **No Encryption**: Data is stored in plain text
4. **Single Point of Failure**: Coordinator is a single point of failure

## Testing

### Manual Testing

1. Start all services (coordinator, parties, frontend)
2. Create a session via API or frontend
3. Generate a key and verify shares are distributed
4. Test signature creation
5. Test key reconstruction

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
- Party A: `http://localhost:3001/health`
- Party B: `http://localhost:3002/health`
- Party C: `http://localhost:3003/health`

### Logs

All operations are logged to MongoDB with detailed webhook communication logs.

## Troubleshooting

### Common Issues

1. **MongoDB Connection**: Ensure MongoDB Atlas is accessible and credentials are correct
2. **Port Conflicts**: Ensure ports 3000-3003 are available
3. **CORS Issues**: Check CORS configuration in coordinator
4. **Webhook Failures**: Verify party simulators are running and accessible

### Debug Mode

Enable debug logging by setting `NODE_ENV=development` in the `.env` file.

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