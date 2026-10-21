import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SeasonAuthorizationService } from '../seasons/season-authorization.service.js';
import type { AuthenticatedRequest } from './session.guard.js';

@Injectable()
export class TeamAdminGuard implements CanActivate {
  constructor(private readonly authorization: SeasonAuthorizationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { authUserId } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!authUserId) throw new UnauthorizedException();
    const permissions = await this.authorization.accessFor(authUserId);
    if (!permissions.canManage) {
      throw new ForbiddenException('Team Admin access is required');
    }
    return true;
  }
}
