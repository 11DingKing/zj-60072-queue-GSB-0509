import { Module } from '@nestjs/common';
import { JobLogService } from './job-log.service';
import { JobLogController } from './job-log.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [JobLogController],
  providers: [JobLogService],
  exports: [JobLogService],
})
export class JobLogModule {}
