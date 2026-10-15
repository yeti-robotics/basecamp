import { timingSafeEqual } from 'node:crypto';
import { decodeSeed, generateAttendanceCode } from '@repo/attendance-code';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AttendanceCodeService {
  private readonly seed: string;

  constructor(config: ConfigService) {
    this.seed = config.getOrThrow<string>('ATTENDANCE_TOTP_SECRET');
    decodeSeed(this.seed);
  }

  async verify(code: string, nowMs = Date.now()): Promise<boolean> {
    if (!/^[0-9]{4}$/.test(code)) return false;

    let valid = false;
    for (const shift of [-30_000, 0, 30_000]) {
      if (nowMs + shift < 0) continue;
      const candidate = await generateAttendanceCode(this.seed, nowMs + shift);
      valid = timingSafeEqual(Buffer.from(code), Buffer.from(candidate)) || valid;
    }
    return valid;
  }
}
