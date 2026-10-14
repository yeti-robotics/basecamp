import { describe, expect, it } from 'vitest';
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
});
