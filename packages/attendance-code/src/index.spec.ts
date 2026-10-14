import { describe, expect, it } from 'vitest';
import { generateAttendanceCode } from './index.js';

const seed = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('attendance TOTP', () => {
  it('matches the RFC SHA-1 vector truncated to four digits', async () => {
    expect(await generateAttendanceCode(seed, 59_000)).toBe('7082');
  });

  it('preserves leading zeroes', async () => {
    expect(await generateAttendanceCode(seed, 270_000)).toBe('0489');
  });
});
