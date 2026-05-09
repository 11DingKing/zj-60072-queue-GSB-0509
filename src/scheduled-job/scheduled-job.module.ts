import { Module } from '@nestjs/common';
import { ScheduledJobService } from './scheduled-job.service';
import { ScheduledJobController } from './scheduled-job.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [PrismaModule, QueueModule],
  controllers: [ScheduledJobController],
  providers: [ScheduledJobService],
  exports: [ScheduledJobService],
})
export class ScheduledJobModule {}
