import 'reflect-metadata';
import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';
import type { MemberContextService } from '../roster/member-context.service.js';
import { AttendanceController } from './attendance.controller.js';
import type { AttendanceService } from './attendance.service.js';

describe('AttendanceController', () => {
  it('rejects unauthenticated requests before querying attendance', async () => {
    const authenticate = vi.fn().mockRejectedValue(new UnauthorizedException());
    const overview = vi.fn();
    const controller = new AttendanceController(
      { authenticate } as unknown as MemberContextService,
      { overview } as unknown as AttendanceService,
    );
    await expect(controller.overview({ headers: {} } as Request)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(overview).not.toHaveBeenCalled();
  });

  it('uses the authenticated user even if another user ID is supplied', async () => {
    const authenticate = vi.fn().mockResolvedValue('member-a');
    const overview = vi.fn().mockResolvedValue({ hours: { total: 2.5 } });
    const controller = new AttendanceController(
      { authenticate } as unknown as MemberContextService,
      { overview } as unknown as AttendanceService,
    );
    const result = await controller.overview({
      headers: { cookie: 'session=test' },
      query: { userId: 'member-b' },
    } as unknown as Request);
    expect(overview).toHaveBeenCalledWith('member-a');
    expect(result.hours.total).toBe(2.5);
    expect(authenticate).toHaveBeenCalledWith({ cookie: 'session=test' });
  });
});
