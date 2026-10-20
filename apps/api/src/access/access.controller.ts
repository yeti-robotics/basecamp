import {
  Body,
  Controller,
  ForbiddenException,
  Inject,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { AUTH } from '../auth/auth.module.js';
import type { Auth } from '../auth.js';
import { SeasonAuthorizationService } from '../seasons/season-authorization.service.js';
import { AccessService } from './access.service.js';

@Controller('api/access/users')
export class AccessController {
  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    private readonly access: AccessService,
    private readonly authorization: SeasonAuthorizationService,
  ) {}

  @Post(':userId/suspend')
  async suspend(
    @Req() request: Request,
    @Param('userId') userId: string,
    @Body() body: { reason?: string },
  ) {
    const actorId = await this.adminActor(request);
    await this.access.suspend(actorId, userId, body?.reason);
    return { userId, suspended: true };
  }

  @Post(':userId/restore')
  async restore(@Req() request: Request, @Param('userId') userId: string) {
    const actorId = await this.adminActor(request);
    await this.access.restore(actorId, userId);
    return { userId, suspended: false };
  }

  private async adminActor(request: Request): Promise<string> {
    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!session || (await this.access.isSuspended(session.user.id))) {
      throw new UnauthorizedException();
    }
    const permissions = await this.authorization.accessFor(session.user.id);
    if (!permissions.canManage) throw new ForbiddenException('Team Admin access is required');
    return session.user.id;
  }
}
