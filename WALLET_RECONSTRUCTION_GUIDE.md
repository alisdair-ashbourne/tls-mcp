# Wallet Address Reconstruction Guide

## Overview

This guide explains how the TLS-MCP system enables wallet address reconstruction from distributed shares. The system implements a deterministic approach where the same wallet address can be consistently generated from the same set of shares.

## How It Works

### 1. Share Generation and Storage

During the Distributed Key Generation (DKG) process:

1. **Each party generates a cryptographic share** using `generateRandomShare()`
2. **Shares are stored locally** in each party's memory (not transmitted to coordinator)
3. **Commitments are sent to coordinator** instead of actual shares for security
4. **Shares are preserved** for later reconstruction requests

### 2. Deterministic Wallet Address Generation

The system uses a deterministic algorithm to generate wallet addresses:

```javascript
// Combine all shares in a consistent order
const sortedShares = shares.sort((a, b) => a.partyId - b.partyId);
const combinedShares = sortedShares.map((share) => share.share).join('');

// Generate deterministic private key from combined shares
const privateKeyBytes = crypto
  .createHash('sha256')
  .update(combinedShares)
  .digest();

// Generate wallet address from private key
const addressBytes = crypto
  .createHash('sha256')
  .update(privateKeyBytes)
  .digest()
  .slice(0, 20);
const walletAddress = `0x${addressBytes.toString('hex')}`;
```

### 3. Reconstruction Process

When reconstruction is requested:

1. **Coordinator requests shares** from all parties via `reconstruction_requested` event
2. **Parties provide their shares** via `share_provided` event
3. **Coordinator collects shares** and reconstructs the wallet address
4. **Same wallet address is generated** as long as the same shares are provided

## Key Features

### ✅ Deterministic Reconstruction

- Same shares always produce the same wallet address
- Consistent across multiple reconstruction attempts
- Independent of reconstruction timing

### ✅ Security

- Shares are only transmitted during reconstruction
- Commitments are used for DKG verification
- No persistent storage of shares in coordinator

### ✅ Threshold Support

- Works with any threshold configuration
- Requires minimum number of shares for reconstruction
- Graceful handling of missing parties

## API Endpoints

### Reconstruction Endpoint

```http
POST /api/sessions/{sessionId}/reconstruct-key
```

**Response:**

```json
{
  "success": true,
  "sessionId": "session-123",
  "walletAddress": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
  "sharesCount": 3,
  "status": "reconstructed",
  "message": "Key successfully reconstructed from existing shares"
}
```

### Session Status Endpoint

```http
GET /api/sessions/{sessionId}
```

**Response includes:**

```json
{
  "metadata": {
    "walletAddress": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6"
  }
}
```

## Testing the Reconstruction

### 1. Start the Services

```bash
# Start coordinator
node src/server.js

# Start party simulators (in separate terminals)
node party-simulator/src/party-simulator.js --party=a --port=3001
node party-simulator/src/party-simulator.js --party=b --port=3002
node party-simulator/src/party-simulator.js --party=c --port=3003
```

### 2. Run the Demo

```bash
node wallet-reconstruction-demo.js
```

### 3. Expected Output

```
🔑 Wallet Address Reconstruction Demo
=====================================

📋 Initializing session...
✅ Session initialized: session-abc123

🔐 Initiating distributed key generation...
✅ DKG initiated
📊 Status: dkg_initiated

⏳ Waiting for DKG completion...
💰 Original wallet address: 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6

🔓 Testing wallet address reconstruction...
✅ Key reconstruction completed
📊 Status: reconstructed
📦 Shares used: 3
🔓 Reconstructed wallet address: 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6
✅ SUCCESS: Wallet addresses match!
```

## Implementation Details

### Coordinator Service Methods

#### `reconstructWalletAddressFromShares(shares)`

- Combines shares in deterministic order
- Generates wallet address using cryptographic hash
- Returns consistent address for same shares

#### `generateDeterministicWalletAddress(session)`

- Extracts shares from session
- Calls reconstruction method
- Handles session state management

#### `reconstructKeyFromShares(sessionId)`

- Orchestrates reconstruction process
- Requests shares from parties
- Returns reconstruction result

### Party Simulator Methods

#### `handleReconstructionRequested(sessionId, payload)`

- Retrieves stored share for session
- Sends share to coordinator
- Maintains share confidentiality

#### `generateRandomShare()`

- Creates cryptographically secure random share
- Used for both DKG and reconstruction
- Ensures share uniqueness

## Security Considerations

### Share Protection

- Shares are never stored in coordinator
- Only commitments are transmitted during DKG
- Shares are only sent during reconstruction requests

### Deterministic Generation

- Same input shares always produce same output
- No randomness in wallet address generation
- Consistent across system restarts

### Threshold Security

- Minimum threshold enforcement
- Graceful degradation with missing parties
- Audit trail of reconstruction attempts

## Production Considerations

### Real-World Implementation

In a production environment, you would:

1. **Use proper threshold cryptography** (e.g., Shamir's Secret Sharing)
2. **Implement elliptic curve operations** for Ethereum address generation
3. **Add share verification** using zero-knowledge proofs
4. **Implement secure communication** between parties
5. **Add rate limiting** for reconstruction requests

### Cryptographic Improvements

```javascript
// Production-ready wallet generation
const { ethers } = require('ethers');

function generateEthereumAddress(privateKeyBytes) {
  const wallet = new ethers.Wallet(privateKeyBytes);
  return wallet.address;
}
```

## Troubleshooting

### Common Issues

1. **Shares not matching**: Ensure parties are using the same shares from DKG
2. **Reconstruction timing**: Wait for DKG completion before reconstruction
3. **Party connectivity**: Ensure all parties are online during reconstruction
4. **Session expiration**: Check session validity before reconstruction

### Debug Commands

```bash
# Check party status
curl http://localhost:3001/status
curl http://localhost:3002/status
curl http://localhost:3003/status

# Check session status
curl http://localhost:3000/api/sessions/{sessionId}

# Check webhook logs
curl http://localhost:3000/api/webhook-logs/{sessionId}
```

## Conclusion

The wallet address reconstruction system provides a secure, deterministic way to recover wallet addresses from distributed shares. The same wallet address is consistently generated as long as the same shares are provided, enabling reliable recovery mechanisms in threshold wallet systems.
