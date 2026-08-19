import crypto from 'node:crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Derives a 32-byte key from the configured ENCRYPTION_KEY or SESSION_SECRET.
 */
function getEncryptionKey(): Buffer {
  const secret = env.ENCRYPTION_KEY || env.SESSION_SECRET;
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts sensitive text (e.g. SMTP passwords) at rest using AES-256-GCM.
 * Output format: iv:authTag:encryptedCiphertext (hex encoded)
 */
export function encryptText(plainText: string): string {
  if (!plainText) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts AES-256-GCM encrypted text.
 * Falls back gracefully to raw plainText if the string is not encrypted (e.g., legacy migration).
 */
export function decryptText(cipherText: string): string {
  if (!cipherText) return '';
  
  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    // Not encrypted or plaintext fallback
    return cipherText;
  }

  try {
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    if (iv.length !== IV_LENGTH || authTag.length !== TAG_LENGTH) {
      return cipherText;
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch {
    // If decryption fails, return as-is
    return cipherText;
  }
}

/**
 * Masks an email address for safe, compliant structured logging.
 * Example: john.doe@example.com -> j***e@example.com
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local.charAt(0)}***@${domain}`;
  }
  return `${local.charAt(0)}***${local.charAt(local.length - 1)}@${domain}`;
}
