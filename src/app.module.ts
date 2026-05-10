import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { BullmqModule } from './bullmq/bullmq.module';
import { QueueModule } from './queue/queue.module';
import { JobModule } from './job/job.module';
import { ScheduledJobModule } from './scheduled-job/scheduled-job.module';
import { WorkerModule } from './worker/worker.module';
import { MonitorModule } from './monitor/monitor.module';
import { DeadLetterModule } from './dead-letter/dead-letter.module';
import { JobLogModule } from './job-log/job-log.module';
import { RetryPolicyModule } from './retry-policy/retry-policy.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    BullmqModule,
    QueueModule,
    JobModule,
    ScheduledJobModule,
    WorkerModule,
    MonitorModule,
    DeadLetterModule,
    JobLogModule,
    RetryPolicyModule,
  ],
})
export class AppModule {}
