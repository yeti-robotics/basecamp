import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const sessionLifetimeMs = 43_200_000;

export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  const matches = header
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`));
  if (matches.length !== 1) return null;
  try {
    return decodeURIComponent(matches[0].slice(name.length + 1));
  } catch {
    return null;
  }
}

@Injectable()
export class DisplaySessionService {
  private readonly password: string;
  private readonly sessionSecret: string;

  constructor(config: ConfigService) {
    this.password = config.getOrThrow<string>('ATTENDANCE_DISPLAY_PASSWORD');
    this.sessionSecret = config.getOrThrow<string>('ATTENDANCE_DISPLAY_SESSION_SECRET');
  }

  checkPassword(candidate: string): boolean {
    const supplied = createHash('sha256').update(candidate).digest();
    const expected = createHash('sha256').update(this.password).digest();
    return timingSafeEqual(supplied, expected);
  }

  create(nowMs = Date.now()): string {
    const expiry = nowMs + sessionLifetimeMs;
    return `${expiry}.${this.mac(expiry).toString('base64url')}`;
  }

  verify(token: string, nowMs = Date.now()): number | null {
    const match = /^(\d+)\.([A-Za-z0-9_-]+)$/.exec(token);
    if (!match) return null;
    const expiry = Number(match[1]);
    if (!Number.isSafeInteger(expiry) || expiry <= nowMs) return null;
    const received = Buffer.from(match[2], 'base64url');
    const expected = this.mac(expiry);
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
    return expiry;
  }

  private mac(expiry: number): Buffer {
    return createHmac('sha256', this.sessionSecret).update(`attendance-display:${expiry}`).digest();
  }
}
