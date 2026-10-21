import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { AUTH } from '../auth/auth.module.js';
import type { Auth } from '../auth.js';
import { AccessService } from './access.service.js';

export interface AuthenticatedRequest extends Request {
  authUserId?: string;
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    private readonly access: AccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    delete request.authUserId;
    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!session || (await this.access.isSuspended(session.user.id))) {
      throw new UnauthorizedException();
    }
    request.authUserId = session.user.id;
    return true;
  }
}
