import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AttendanceModule } from './attendance/attendance.module';
import { PingModule } from './ping/ping.module';
import { HandbookModule } from './handbook/handbook.module';

@Module({
  imports: [AttendanceModule, PingModule, HandbookModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
