import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { BotTokenCipher } from './bot-token-cipher.js';

const key = Buffer.alloc(32, 7).toString('base64');
const token = 'discord-bot-token-secret';

describe('BotTokenCipher', () => {
  it('encrypts with authenticated encryption and a fresh nonce', () => {
    const cipher = new BotTokenCipher(new ConfigService({ BOT_SETTINGS_ENCRYPTION_KEY: key }));

    const first = cipher.encrypt(token);
    const second = cipher.encrypt(token);

    expect(first).not.toContain(token);
    expect(first).not.toBe(second);
    expect(cipher.decrypt(first)).toBe(token);
  });

  it('fails closed when no key is configured', () => {
    const cipher = new BotTokenCipher(new ConfigService({}));

    expect(() => cipher.encrypt(token)).toThrow('BOT_SETTINGS_ENCRYPTION_KEY must be configured');
    expect(() => cipher.decrypt('v1:malformed')).toThrow(
      'BOT_SETTINGS_ENCRYPTION_KEY must be configured',
    );
  });

  it('fails closed with the wrong key without exposing the token or ciphertext', () => {
    const encryptor = new BotTokenCipher(new ConfigService({ BOT_SETTINGS_ENCRYPTION_KEY: key }));
    const ciphertext = encryptor.encrypt(token);
    const decryptor = new BotTokenCipher(
      new ConfigService({ BOT_SETTINGS_ENCRYPTION_KEY: Buffer.alloc(32, 8).toString('base64') }),
    );

    expect(() => decryptor.decrypt(ciphertext)).toThrow('Unable to decrypt bot token');
    try {
      decryptor.decrypt(ciphertext);
    } catch (error) {
      expect((error as Error).message).not.toContain(token);
      expect((error as Error).message).not.toContain(ciphertext);
    }
  });

  it('rejects malformed and unauthenticated ciphertext', () => {
    const cipher = new BotTokenCipher(new ConfigService({ BOT_SETTINGS_ENCRYPTION_KEY: key }));

    expect(() => cipher.decrypt('invalid')).toThrow('Unable to decrypt bot token');
    expect(() => cipher.decrypt('v1:AA==:AA==:AA==')).toThrow('Unable to decrypt bot token');
  });
});
