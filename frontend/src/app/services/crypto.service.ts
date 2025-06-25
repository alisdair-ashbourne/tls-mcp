import { Injectable } from '@angular/core';
import { Wallet } from 'ethers';
import * as eccrypto from 'eccrypto';

// Helper to convert Buffer to hex string
const toHex = (data: Buffer): string => `0x${data.toString('hex')}`;

export interface SessionCommitment {
  sessionId: string;
  partyId: number;
  commitment: string;
  timestamp: Date;
  share?: string; // Only stored locally, never transmitted
  // Enhanced metadata for session-agnostic operations
  sharedSeed: string; // The deterministic seed used
  walletAddress?: string; // Derived wallet address
  operation: string; // What this was used for
  participatingParties: number[]; // Who else was involved
  isActive: boolean; // Can this still be used?
}

export interface WalletReconstruction {
  sessionId: string;
  walletAddress: string;
  publicKey: string;
  reconstructionTimestamp: Date;
  participatingParties: number[];
  sharedSeed: string; // Link back to commitment seed
  operation: string; // What operation created this
}

export interface CommitmentGroup {
  sharedSeed: string;
  walletAddress: string;
  participatingParties: number[];
  commitments: SessionCommitment[];
  lastUsed: Date;
  operationsCount: number;
  canReconstruct: boolean; // Do we have enough shares?
}

@Injectable({
  providedIn: 'root',
})
export class CryptoService {
  private sessionCommitments = new Map<string, SessionCommitment>();
  private reconstructedWallets = new Map<string, WalletReconstruction>();

  // New: Track commitment groups for session-agnostic operations
  private commitmentGroups = new Map<string, CommitmentGroup>();

  constructor() {
    this.loadCommitmentsFromStorage();
  }

  /**
   * Simple synchronous hash function for demonstration purposes
   * In production, you would use Web Crypto API or a proper crypto library
   */
  private simpleHash(data: string): string {
    let hash = 0;

    if (data.length === 0) return '0'.repeat(64);

    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);

      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Create a more complex hash by combining multiple transformations
    const hash1 = Math.abs(hash).toString(16);
    const hash2 = Math.abs(hash * 31).toString(16);
    const hash3 = Math.abs(hash * 37).toString(16);
    const hash4 = Math.abs(hash * 41).toString(16);

    const combined = (hash1 + hash2 + hash3 + hash4).padStart(64, '0');

    return combined.substring(0, 64);
  }

  /**
   * Generates a new random wallet for testing.
   * @returns A new Wallet instance with random private key.
   */
  generateNewWallet(): Wallet {
    return Wallet.createRandom();
  }

  /**
   * Creates a wallet from a private key string.
   * @param privateKey The private key (with or without 0x prefix).
   * @returns Wallet instance or null if invalid.
   */
  getWalletFromPrivateKey(privateKey: string): Wallet | null {
    try {
      // Ensure proper format
      const formattedKey = privateKey.startsWith('0x')
        ? privateKey
        : `0x${privateKey}`;

      return new Wallet(formattedKey);
    } catch (error) {
      console.error('Invalid private key:', error);
      return null;
    }
  }

  /**
   * Generates a deterministic share for a party in a session-agnostic way.
   * Uses shared seed instead of session ID for consistency across sessions.
   *
   * @param partyId The party identifier
   * @param sharedSeed The shared seed for this commitment group
   * @param entropy Additional entropy (optional)
   * @returns A deterministic private key for this party
   */
  generateDeterministicShare(
    partyId: number,
    sharedSeed: string,
    entropy?: string
  ): string {
    // Create deterministic seed using shared seed + party ID
    const seed = `${sharedSeed}-party-${partyId}-${entropy || 'default'}`;

    // Generate deterministic private key using simple hash
    const privateKeyHex = this.simpleHash(seed);

    // Ensure the private key is valid for secp256k1 (32 bytes, less than curve order)
    if (privateKeyHex.length === 64) {
      try {
        const wallet = new Wallet(`0x${privateKeyHex}`);
        return `0x${privateKeyHex}`;
      } catch (error) {
        // Fallback: add timestamp to ensure validity
        const fallbackSeed = `${seed}-${Date.now()}`;
        const fallbackHash = this.simpleHash(fallbackSeed);
        return `0x${fallbackHash}`;
      }
    }

    // Final fallback if hash is not 64 characters
    const fallbackSeed = `${seed}-fallback-${Date.now()}`;
    const fallbackHash = this.simpleHash(fallbackSeed);
    return `0x${fallbackHash}`;
  }

  /**
   * Generates a commitment to a share without revealing the share itself.
   * Uses hash of the share as the commitment.
   *
   * @param share The share to commit to
   * @param sharedSeed The shared seed for this commitment group
   * @param partyId The party making the commitment
   * @returns The commitment hash
   */
  generateShareCommitment(
    share: string,
    sharedSeed: string,
    partyId: number
  ): string {
    console.log(`🔒 generateShareCommitment called with:`, {
      share: share.substring(0, 10) + '...',
      sharedSeed,
      partyId,
    });

    const commitmentData = `${share}-${sharedSeed}-${partyId}`;
    const commitment = this.simpleHash(commitmentData);

    // Store the commitment with enhanced metadata
    const commitmentKey = `${sharedSeed}-${partyId}`;
    const sessionCommitment: SessionCommitment = {
      sessionId: '', // Will be set when used in a session
      partyId,
      commitment,
      timestamp: new Date(),
      share, // Store locally only
      sharedSeed,
      operation: 'commitment_generated',
      participatingParties: [partyId], // Will be updated when other parties join
      isActive: true,
    };

    this.sessionCommitments.set(commitmentKey, sessionCommitment);
    this.updateCommitmentGroup(sessionCommitment);
    this.saveCommitmentsToStorage();

    console.log(
      `🔒 Generated commitment for Party ${partyId} with seed ${sharedSeed}`
    );
    console.log(`📊 Total commitment groups: ${this.commitmentGroups.size}`);
    return commitment;
  }

  /**
   * Verifies a share commitment.
   * @param share The share to verify
   * @param commitment The commitment to verify against
   * @param sharedSeed The shared seed used
   * @param partyId The party ID
   * @returns True if the commitment is valid
   */
  verifyShareCommitment(
    share: string,
    commitment: string,
    sharedSeed: string,
    partyId: number
  ): boolean {
    const expectedCommitmentData = `${share}-${sharedSeed}-${partyId}`;
    const expectedCommitment = this.simpleHash(expectedCommitmentData);

    const isValid = expectedCommitment === commitment;

    if (isValid) {
      console.log(`✅ Commitment verified for Party ${partyId}`);
    } else {
      console.warn(`❌ Commitment verification failed for Party ${partyId}`);
    }

    return isValid;
  }

  /**
   * Reconstructs a wallet from multiple shares using session-agnostic approach.
   *
   * @param shares Array of shares with party IDs
   * @param sharedSeed The shared seed used for this commitment group
   * @returns Wallet reconstruction information
   */
  reconstructWalletFromShares(
    shares: Array<{ partyId: number; share: string }>,
    sharedSeed: string
  ): WalletReconstruction {
    // Combine shares to reconstruct the private key
    // In a real TSS implementation, this would use Shamir's Secret Sharing
    // For demonstration, we'll combine the shares deterministically
    const combinedShares = shares
      .sort((a, b) => a.partyId - b.partyId)
      .map((s) => s.share)
      .join('-');

    // Generate deterministic private key from combined shares
    const reconstructedPrivateKey = `0x${this.simpleHash(combinedShares)}`;

    // Create wallet from reconstructed private key
    const wallet = new Wallet(reconstructedPrivateKey);

    const reconstruction: WalletReconstruction = {
      sessionId: '', // Will be set when used in a session
      walletAddress: wallet.address,
      publicKey: wallet.publicKey,
      reconstructionTimestamp: new Date(),
      participatingParties: shares.map((s) => s.partyId),
      sharedSeed,
      operation: 'wallet_reconstruction',
    };

    // Update commitment group with wallet address
    this.updateCommitmentGroupWallet(sharedSeed, wallet.address);

    // Store reconstruction for future reference
    this.reconstructedWallets.set(sharedSeed, reconstruction);

    console.log(`🔄 Wallet reconstructed from shared seed ${sharedSeed}:`);
    console.log(`   Address: ${wallet.address}`);
    console.log(`   Public Key: ${wallet.publicKey.substring(0, 20)}...`);
    console.log(
      `   Participating Parties: [${reconstruction.participatingParties.join(', ')}]`
    );

    this.saveCommitmentsToStorage();
    return reconstruction;
  }

  /**
   * Gets all commitment groups for management interface.
   * @returns Array of commitment groups
   */
  getAllCommitmentGroups(): CommitmentGroup[] {
    return Array.from(this.commitmentGroups.values()).sort(
      (a, b) => b.lastUsed.getTime() - a.lastUsed.getTime()
    );
  }

  /**
   * Gets a specific commitment group by shared seed.
   * @param sharedSeed The shared seed identifier
   * @returns The commitment group if found
   */
  getCommitmentGroup(sharedSeed: string): CommitmentGroup | undefined {
    return this.commitmentGroups.get(sharedSeed);
  }

  /**
   * Creates a new session using existing commitments.
   * @param sharedSeed The shared seed of existing commitments
   * @param newSessionId The new session ID for coordination
   * @param operation The operation to perform
   * @returns Success status
   */
  createSessionFromCommitments(
    sharedSeed: string,
    newSessionId: string,
    operation: string
  ): boolean {
    const group = this.commitmentGroups.get(sharedSeed);
    if (!group || !group.canReconstruct) {
      console.error(
        `❌ Cannot create session: insufficient commitments for seed ${sharedSeed}`
      );
      return false;
    }

    // Update all commitments in this group with the new session ID
    group.commitments.forEach((commitment) => {
      commitment.sessionId = newSessionId;
      commitment.operation = operation;
      commitment.timestamp = new Date();
    });

    group.lastUsed = new Date();
    group.operationsCount++;

    this.saveCommitmentsToStorage();
    console.log(
      `✅ Created new session ${newSessionId} from existing commitments`
    );
    return true;
  }

  /**
   * Gets wallet address from existing commitments without full reconstruction.
   * @param sharedSeed The shared seed identifier
   * @returns The wallet address if available
   */
  getWalletAddressFromCommitments(sharedSeed: string): string | null {
    const group = this.commitmentGroups.get(sharedSeed);
    if (!group || !group.canReconstruct) {
      return null;
    }

    // If we already have the wallet address, return it
    if (group.walletAddress) {
      return group.walletAddress;
    }

    // Otherwise, reconstruct it
    const shares = group.commitments
      .filter((c) => c.share)
      .map((c) => ({ partyId: c.partyId, share: c.share! }));

    if (shares.length < 2) {
      // Assuming 2-of-3 threshold
      return null;
    }

    const reconstruction = this.reconstructWalletFromShares(shares, sharedSeed);
    return reconstruction.walletAddress;
  }

  /**
   * Updates or creates a commitment group.
   * @param commitment The commitment to add/update
   */
  private updateCommitmentGroup(commitment: SessionCommitment): void {
    const { sharedSeed } = commitment;
    let group = this.commitmentGroups.get(sharedSeed);

    if (!group) {
      group = {
        sharedSeed,
        walletAddress: '',
        participatingParties: [],
        commitments: [],
        lastUsed: new Date(),
        operationsCount: 0,
        canReconstruct: false,
      };
      this.commitmentGroups.set(sharedSeed, group);
    }

    // Update or add commitment
    const existingIndex = group.commitments.findIndex(
      (c) => c.partyId === commitment.partyId
    );
    if (existingIndex >= 0) {
      group.commitments[existingIndex] = commitment;
    } else {
      group.commitments.push(commitment);
    }

    // Update participating parties
    const allParties = new Set(group.commitments.map((c) => c.partyId));
    group.participatingParties = Array.from(allParties).sort();

    // Update reconstruction capability (assuming 2-of-3 threshold)
    group.canReconstruct = group.commitments.filter((c) => c.share).length >= 2;

    group.lastUsed = new Date();
  }

  /**
   * Updates the wallet address for a commitment group.
   * @param sharedSeed The shared seed identifier
   * @param walletAddress The wallet address
   */
  private updateCommitmentGroupWallet(
    sharedSeed: string,
    walletAddress: string
  ): void {
    const group = this.commitmentGroups.get(sharedSeed);
    if (group) {
      group.walletAddress = walletAddress;
      group.lastUsed = new Date();
    }
  }

  /**
   * Saves commitments to localStorage for persistence.
   */
  private saveCommitmentsToStorage(): void {
    try {
      const commitmentData = {
        commitments: Array.from(this.sessionCommitments.entries()),
        groups: Array.from(this.commitmentGroups.entries()),
        reconstructions: Array.from(this.reconstructedWallets.entries()),
      };
      localStorage.setItem(
        'tss-mcp-commitments',
        JSON.stringify(commitmentData)
      );
    } catch (error) {
      console.error('Failed to save commitments to storage:', error);
    }
  }

  /**
   * Loads commitments from localStorage.
   */
  private loadCommitmentsFromStorage(): void {
    try {
      const stored = localStorage.getItem('tss-mcp-commitments');
      console.log(
        `📦 Loading commitments from storage, found:`,
        stored ? 'data exists' : 'no data'
      );

      if (stored) {
        const data = JSON.parse(stored);
        console.log(`📦 Parsed storage data:`, data);

        // Restore commitments
        if (data.commitments) {
          this.sessionCommitments = new Map(
            data.commitments.map(([key, value]: [string, any]) => [
              key,
              { ...value, timestamp: new Date(value.timestamp) },
            ])
          );
        }

        // Restore groups
        if (data.groups) {
          this.commitmentGroups = new Map(
            data.groups.map(([key, value]: [string, any]) => [
              key,
              {
                ...value,
                lastUsed: new Date(value.lastUsed),
                commitments: value.commitments.map((c: any) => ({
                  ...c,
                  timestamp: new Date(c.timestamp),
                })),
              },
            ])
          );
        }

        // Restore reconstructions
        if (data.reconstructions) {
          this.reconstructedWallets = new Map(
            data.reconstructions.map(([key, value]: [string, any]) => [
              key,
              {
                ...value,
                reconstructionTimestamp: new Date(
                  value.reconstructionTimestamp
                ),
              },
            ])
          );
        }

        console.log(
          `📦 Loaded ${this.commitmentGroups.size} commitment groups from storage`
        );
        console.log(
          `📦 Loaded ${this.sessionCommitments.size} session commitments`
        );
      }
    } catch (error) {
      console.error('Failed to load commitments from storage:', error);
    }
  }

  /**
   * Gets a previously reconstructed wallet for a session.
   *
   * @param sessionId The session identifier
   * @returns The wallet reconstruction if it exists
   */
  getReconstructedWallet(sessionId: string): WalletReconstruction | undefined {
    return this.reconstructedWallets.get(sessionId);
  }

  /**
   * Regenerates the same wallet address for a session using stored commitments.
   * This demonstrates that the same address can be consistently generated.
   *
   * @param sessionId The session identifier
   * @returns The regenerated wallet address or null if no commitments exist
   */
  regenerateWalletAddress(sessionId: string): string | null {
    // Find all commitments for this session
    const sessionCommitments = Array.from(
      this.sessionCommitments.values()
    ).filter((c) => c.sessionId === sessionId && c.share);

    if (sessionCommitments.length === 0) {
      console.warn(`⚠️ No stored shares found for session ${sessionId}`);
      return null;
    }

    // Extract shares and reconstruct
    const shares = sessionCommitments.map((c) => ({
      partyId: c.partyId,
      share: c.share!,
    }));

    const reconstruction = this.reconstructWalletFromShares(
      shares,
      sessionCommitments[0].sharedSeed
    );

    console.log(
      `🔄 Regenerated wallet address for session ${sessionId}: ${reconstruction.walletAddress}`
    );
    return reconstruction.walletAddress;
  }

  /**
   * Generates a threshold wallet address for this party's participation.
   * @returns A new wallet address for threshold operations.
   */
  generateThresholdWalletAddress(): string {
    const wallet = this.generateNewWallet();
    return wallet.address;
  }

  /**
   * Derives a wallet address from a share (for threshold wallet reconstruction).
   * In a real implementation, this would use the actual threshold scheme.
   * For now, we'll create a deterministic address from the share.
   * @param share The share to derive the address from.
   * @returns A wallet address derived from the share.
   */
  deriveAddressFromShare(share: string): string {
    // In a real threshold implementation, this would use the actual threshold scheme
    // to reconstruct the private key and derive the address.
    // For now, we'll create a deterministic address from the share hash.
    const wallet = new Wallet(share);
    return wallet.address;
  }

  /**
   * Gets the public key in the format expected by eccrypto.
   * @param wallet The wallet instance.
   * @returns The public key as a hex string without '0x' prefix.
   */
  getPublicKeyForEncryption(wallet: Wallet): string {
    // Get the uncompressed public key from the signing key
    const signingKey = (wallet as any)._signingKey;
    const publicKey = signingKey.publicKey;

    // Remove 0x prefix if present
    return publicKey.startsWith('0x') ? publicKey.substring(2) : publicKey;
  }

  /**
   * Encrypts a message using the recipient's public key.
   * @param message The message to encrypt (string).
   * @param publicKey The recipient's public key (uncompressed, hex string, without '0x').
   * @returns The encrypted message structure as a base64 string.
   */
  async encryptMessage(message: string, publicKey: string): Promise<string> {
    const publicKeyBuffer = Buffer.from(publicKey, 'hex');
    const messageBuffer = Buffer.from(message);

    const encrypted = await eccrypto.encrypt(publicKeyBuffer, messageBuffer);

    // Stringify the encrypted object and convert to base64
    const encryptedString = JSON.stringify({
      iv: encrypted.iv.toString('hex'),
      ephemPublicKey: encrypted.ephemPublicKey.toString('hex'),
      ciphertext: encrypted.ciphertext.toString('hex'),
      mac: encrypted.mac.toString('hex'),
    });

    return Buffer.from(encryptedString).toString('base64');
  }

  /**
   * Decrypts a message using the recipient's private key.
   * @param encryptedMessageBase64 The base64 encoded encrypted message structure.
   * @param privateKey The recipient's private key (hex string, with '0x').
   * @returns The decrypted message as a UTF-8 string.
   */
  async decryptMessage(
    encryptedMessageBase64: string,
    privateKey: string
  ): Promise<string> {
    const privateKeyBuffer = Buffer.from(privateKey.substring(2), 'hex');

    // Decode from base64 and parse the stringified object
    const encryptedString = Buffer.from(
      encryptedMessageBase64,
      'base64'
    ).toString('utf8');
    const encrypted = JSON.parse(encryptedString);

    // Convert hex strings back to buffers
    const encryptedBuffer = {
      iv: Buffer.from(encrypted.iv, 'hex'),
      ephemPublicKey: Buffer.from(encrypted.ephemPublicKey, 'hex'),
      ciphertext: Buffer.from(encrypted.ciphertext, 'hex'),
      mac: Buffer.from(encrypted.mac, 'hex'),
    };

    const decryptedBuffer = await eccrypto.decrypt(
      privateKeyBuffer,
      encryptedBuffer
    );
    return decryptedBuffer.toString('utf8');
  }

  /**
   * Hashes a message using SHA-256.
   * @param message The message to hash.
   * @returns The hex string of the hash.
   */
  async hashMessage(message: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return hashHex;
  }

  /**
   * Gets all commitments for debugging and verification purposes.
   * @returns All stored commitments (without shares for security)
   */
  getAllCommitments(): Array<Omit<SessionCommitment, 'share'>> {
    return Array.from(this.sessionCommitments.values()).map((c) => ({
      sessionId: c.sessionId,
      partyId: c.partyId,
      commitment: c.commitment,
      timestamp: c.timestamp,
      sharedSeed: c.sharedSeed,
      walletAddress: c.walletAddress,
      operation: c.operation,
      participatingParties: c.participatingParties,
      isActive: c.isActive,
    }));
  }

  /**
   * Gets all reconstructed wallets for debugging purposes.
   * @returns All reconstructed wallet information
   */
  getAllReconstructedWallets(): WalletReconstruction[] {
    return Array.from(this.reconstructedWallets.values());
  }

  /**
   * Clears all stored cryptographic material (for security).
   * This should be called when the user wants to reset their local state.
   */
  clearAllCryptographicMaterial(): void {
    this.sessionCommitments.clear();
    this.reconstructedWallets.clear();
    this.commitmentGroups.clear();
    localStorage.removeItem('tss-mcp-commitments');
    console.log(
      '🗑️ All cryptographic material cleared from memory and storage'
    );
  }
}
