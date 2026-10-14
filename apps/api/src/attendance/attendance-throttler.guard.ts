import { Injectable } from '@nestjs/common';
import { ThrottlerException, ThrottlerGuard, type ThrottlerRequest } from '@nestjs/throttler';
import { NecordExecutionContext, type SlashCommandContext } from 'necord';

@Injectable()
export class AttendanceThrottlerGuard extends ThrottlerGuard {
  protected override async handleRequest({
    context,
    limit,
    ttl,
    throttler,
    blockDuration,
  }: ThrottlerRequest): Promise<boolean> {
    const [interaction] = NecordExecutionContext.create(context).getContext<SlashCommandContext>();
    const key = `attendance-code:${interaction.user.id}`;
    const result = await this.storageService.increment(
      key,
      ttl,
      limit,
      blockDuration,
      throttler.name ?? 'default',
    );
    if (result.isBlocked) throw new ThrottlerException('Too many code attempts');
    return true;
  }
}
