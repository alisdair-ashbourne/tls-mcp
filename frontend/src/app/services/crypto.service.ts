import { Injectable } from '@angular/core';
import { Wallet } from 'ethers';
import * as eccrypto from 'eccrypto';

// Helper to convert Buffer to hex string
const toHex = (data: Buffer): string => `0x${data.toString('hex')}`;

@Injectable({
  providedIn: 'root'
})
export class CryptoService {

  constructor() {}

  /**
   * Generates a new random wallet.
   * @returns A new Wallet instance.
   */
  generateNewWallet(): Wallet {
    return Wallet.createRandom();
  }

  /**
   * Derives public key and address from a private key.
   * @param privateKey The private key string (with '0x' prefix).
   * @returns A Wallet instance from ethers.js, or null if the key is invalid.
   */
  getWalletFromPrivateKey(privateKey: string): Wallet | null {
    try {
      // ethers.Wallet will automatically handle public key and address derivation.
      return new Wallet(privateKey);
    } catch (error) {
      console.error('Error creating wallet from private key:', error);
      return null;
    }
  }

  /**
   * Generates a wallet address for this party's participation in threshold operations.
   * This address will be derived from the party's share during DKG.
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
      mac: encrypted.mac.toString('hex')
    });

    return Buffer.from(encryptedString).toString('base64');
  }

  /**
   * Decrypts a message using the recipient's private key.
   * @param encryptedMessageBase64 The base64 encoded encrypted message structure.
   * @param privateKey The recipient's private key (hex string, with '0x').
   * @returns The decrypted message as a UTF-8 string.
   */
  async decryptMessage(encryptedMessageBase64: string, privateKey: string): Promise<string> {
    const privateKeyBuffer = Buffer.from(privateKey.substring(2), 'hex');
    
    // Decode from base64 and parse the stringified object
    const encryptedString = Buffer.from(encryptedMessageBase64, 'base64').toString('utf8');
    const encrypted = JSON.parse(encryptedString);

    // Convert hex strings back to buffers
    const encryptedBuffer = {
      iv: Buffer.from(encrypted.iv, 'hex'),
      ephemPublicKey: Buffer.from(encrypted.ephemPublicKey, 'hex'),
      ciphertext: Buffer.from(encrypted.ciphertext, 'hex'),
      mac: Buffer.from(encrypted.mac, 'hex'),
    };

    const decryptedBuffer = await eccrypto.decrypt(privateKeyBuffer, encryptedBuffer);
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
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }
} 