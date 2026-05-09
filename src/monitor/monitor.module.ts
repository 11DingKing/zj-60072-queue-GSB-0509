import { Module } from '@nestjs/common';
import { MonitorGateway } from './monitor.gateway';
import { MonitorService } from './monitor.service';
import { MonitorController } from './monitor.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { WorkerModule } from '../worker/worker.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    PrismaModule,
    QueueModule,
    WorkerModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [MonitorController],
  providers: [MonitorGateway, MonitorService],
  exports: [MonitorGateway, MonitorService],
})
export class MonitorModule {}
