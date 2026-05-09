import { Module } from '@nestjs/common';
import { DeadLetterService } from './dead-letter.service';
import { DeadLetterController } from './dead-letter.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [PrismaModule, QueueModule],
  controllers: [DeadLetterController],
  providers: [DeadLetterService],
  exports: [DeadLetterService],
})
export class DeadLetterModule {}
