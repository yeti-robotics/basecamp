import { timingSafeEqual } from 'node:crypto';
import { decodeSeed, generateAttendanceCode } from '@repo/attendance-code';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AttendanceCodeService {
  private readonly logger = new Logger(AttendanceCodeService.name);
  private readonly seed: string;

  constructor(config: ConfigService) {
    this.seed = config.getOrThrow<string>('ATTENDANCE_TOTP_SECRET');
    decodeSeed(this.seed);
  }

  async verify(
    code: string,
    nowMs = Date.now(),
    command: 'signin' | 'signout' | 'unknown' = 'unknown',
  ): Promise<boolean> {
    if (!/^[0-9]{4}$/.test(code)) {
      this.logger.warn(
        `Attendance code rejected: command=${command} reason=format length=${code.length}`,
      );
      return false;
    }

    let valid = false;
    for (const shift of [-30_000, 0, 30_000]) {
      if (nowMs + shift < 0) continue;
      const candidate = await generateAttendanceCode(this.seed, nowMs + shift);
      valid = timingSafeEqual(Buffer.from(code), Buffer.from(candidate)) || valid;
    }
    if (valid) return true;

    // Diagnose clock drift without recording the submitted code or the seed.
    let nearbyStepOffset: number | null = null;
    for (const offset of [-2, 2, -3, 3, -4, 4, -5, 5]) {
      if (nowMs + offset * 30_000 < 0) continue;
      const candidate = await generateAttendanceCode(this.seed, nowMs + offset * 30_000);
      if (timingSafeEqual(Buffer.from(code), Buffer.from(candidate))) {
        nearbyStepOffset = offset;
        break;
      }
    }
    this.logger.warn(
      `Attendance code rejected: command=${command} reason=no-match serverStep=${Math.floor(nowMs / 30_000)} nearbyStepOffset=${nearbyStepOffset ?? 'none'}`,
    );
    return false;
  }
}
