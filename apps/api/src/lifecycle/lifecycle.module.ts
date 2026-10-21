import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { LifecycleService } from './lifecycle.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [LifecycleService],
  exports: [LifecycleService],
})
export class LifecycleModule {}
