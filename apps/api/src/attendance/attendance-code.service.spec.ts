import { Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AttendanceCodeService } from './attendance-code.service.js';

const seed = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('AttendanceCodeService', () => {
  it('accepts a zero-padded code in its own and adjacent time steps only', async () => {
    const service = new AttendanceCodeService({
      getOrThrow: () => seed,
    } as never);

    expect(await service.verify('0489', 240_000)).toBe(true);
    expect(await service.verify('0489', 270_000)).toBe(true);
    expect(await service.verify('0489', 300_000)).toBe(true);
    expect(await service.verify('0489', 330_000)).toBe(false);
  });

  it('logs a nearby clock offset for rejected codes without exposing the code or seed', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    try {
      const service = new AttendanceCodeService({ getOrThrow: () => seed } as never);

      expect(await service.verify('0489', 360_000, 'signout')).toBe(false);
      const message = String(warn.mock.lastCall?.[0]);
      expect(message).toContain('command=signout');
      expect(message).toContain('nearbyStepOffset=-3');
      expect(message).not.toContain('0489');
      expect(message).not.toContain(seed);
    } finally {
      warn.mockRestore();
    }
  });
});
