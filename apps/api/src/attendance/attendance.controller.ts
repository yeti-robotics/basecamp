import { Controller, Get, Header, Inject, Req, UnauthorizedException } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { AUTH } from '../auth/auth.module.js';
import type { Auth } from '../auth.js';
import { AttendanceService } from './attendance.service.js';

@Controller('api/attendance')
export class AttendanceController {
  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    private readonly attendance: AttendanceService,
  ) {}

  @Get('overview')
  @Header('Cache-Control', 'private, no-store')
  async overview(@Req() request: Request) {
    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!session) throw new UnauthorizedException();
    return this.attendance.overview(session.user.id);
  }
}
