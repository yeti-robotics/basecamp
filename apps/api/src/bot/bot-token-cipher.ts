import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const ALGORITHM = 'aes-256-gcm';
const NONCE_BYTES = 12;
const AUTH_TAG_BYTES = 16;

@Injectable()
export class BotTokenCipher {
  constructor(private readonly config: ConfigService) {}

  encrypt(token: string): string {
    const nonce = randomBytes(NONCE_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key(), nonce);
    const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `v1:${nonce.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  decrypt(ciphertext: string): string {
    const key = this.key();
    try {
      const [version, nonceEncoded, tagEncoded, payloadEncoded, ...extra] = ciphertext.split(':');
      if (version !== 'v1' || !nonceEncoded || !tagEncoded || !payloadEncoded || extra.length) {
        throw new Error('invalid token ciphertext');
      }

      const nonce = Buffer.from(nonceEncoded, 'base64');
      const authTag = Buffer.from(tagEncoded, 'base64');
      if (nonce.length !== NONCE_BYTES || authTag.length !== AUTH_TAG_BYTES) {
        throw new Error('invalid token ciphertext');
      }

      const decipher = createDecipheriv(ALGORITHM, key, nonce);
      decipher.setAuthTag(authTag);
      return Buffer.concat([
        decipher.update(Buffer.from(payloadEncoded, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new Error('Unable to decrypt bot token');
    }
  }

  private key(): Buffer {
    const encoded = this.config.get<string>('BOT_SETTINGS_ENCRYPTION_KEY')?.trim();
    if (!encoded) throw new Error('BOT_SETTINGS_ENCRYPTION_KEY must be configured');

    const key = Buffer.from(encoded, 'base64');
    if (key.length !== 32 || key.toString('base64') !== encoded) {
      throw new Error('BOT_SETTINGS_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
    }
    return key;
  }
}
