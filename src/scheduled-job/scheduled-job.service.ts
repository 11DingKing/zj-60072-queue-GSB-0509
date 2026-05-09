import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BullmqService } from '../bullmq/bullmq.service';
import { QueueService } from '../queue/queue.service';
import { CreateScheduledJobDto } from './dto/create-scheduled-job.dto';
import { ScheduledJob } from '@prisma/client';

@Injectable()
export class ScheduledJobService {
  constructor(
    private prisma: PrismaService,
    private bullmqService: BullmqService,
    private queueService: QueueService,
  ) {}

  async create(createScheduledJobDto: CreateScheduledJobDto): Promise<ScheduledJob> {
    const queue = await this.queueService.findOne(createScheduledJobDto.queueId);

    if (createScheduledJobDto.isRecurring && !createScheduledJobDto.cron) {
      throw new BadRequestException('Cron expression is required for recurring jobs');
    }

    if (!createScheduledJobDto.isRecurring && !createScheduledJobDto.delay) {
      throw new BadRequestException('Delay is required for one-time delayed jobs');
    }

    const bullmqQueue = this.bullmqService.getQueue(queue.name);
    
    let nextRunAt: Date | undefined;
    let bullmqJobId: string | undefined;

    if (createScheduledJobDto.isRecurring && createScheduledJobDto.cron) {
      const repeatableJob = await bullmqQueue.add(
        createScheduledJobDto.name,
        {
          ...(createScheduledJobDto.data as Record<string, any>),
          _jobName: createScheduledJobDto.name,
          _queueId: queue.id,
          _isScheduled: true,
        },
        {
          repeat: {
            pattern: createScheduledJobDto.cron,
          },
          jobId: `scheduled-${createScheduledJobDto.name}-${Date.now()}`,
        },
      );
      bullmqJobId = repeatableJob.id;
      
      const repeatableJobs = await bullmqQueue.getRepeatableJobs();
      const repeatable = repeatableJobs.find(r => r.name === createScheduledJobDto.name);
      if (repeatable) {
        nextRunAt = new Date(repeatable.next);
      }
    } else if (createScheduledJobDto.delay) {
      const delayedJob = await bullmqQueue.add(
        createScheduledJobDto.name,
        {
          ...(createScheduledJobDto.data as Record<string, any>),
          _jobName: createScheduledJobDto.name,
          _queueId: queue.id,
          _isScheduled: true,
        },
        {
          delay: createScheduledJobDto.delay,
          jobId: `delayed-${createScheduledJobDto.name}-${Date.now()}`,
        },
      );
      bullmqJobId = delayedJob.id;
      nextRunAt = new Date(Date.now() + createScheduledJobDto.delay);
    }

    return this.prisma.scheduledJob.create({
      data: {
        name: createScheduledJobDto.name,
        queueId: createScheduledJobDto.queueId,
        data: createScheduledJobDto.data,
        cron: createScheduledJobDto.cron,
        delay: createScheduledJobDto.delay,
        isRecurring: createScheduledJobDto.isRecurring || false,
        nextRunAt,
        bullmqJobId,
        isActive: true,
      },
    });
  }

  async findAll(queueId?: string, isActive?: boolean): Promise<ScheduledJob[]> {
    const where: any = {};
    if (queueId) where.queueId = queueId;
    if (isActive !== undefined) where.isActive = isActive;

    return this.prisma.scheduledJob.findMany({
      where,
      include: { queue: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<ScheduledJob & { queue: any }> {
    const scheduledJob = await this.prisma.scheduledJob.findUnique({
      where: { id },
      include: { queue: true },
    });

    if (!scheduledJob) {
      throw new NotFoundException(`Scheduled job with ID "${id}" not found`);
    }

    return scheduledJob;
  }

  async update(id: string, updateData: Partial<CreateScheduledJobDto>): Promise<ScheduledJob> {
    const scheduledJob = await this.findOne(id);
    
    await this.remove(id);
    
    const updateDataJson = updateData.data as Record<string, any>;
    const scheduledJobJson = scheduledJob.data as Record<string, any>;
    
    return this.create({
      name: scheduledJob.name,
      queueId: scheduledJob.queueId,
      data: updateDataJson || scheduledJobJson,
      cron: updateData.cron || (scheduledJob.cron as string) || undefined,
      delay: updateData.delay || (scheduledJob.delay as number) || undefined,
      isRecurring: updateData.isRecurring ?? scheduledJob.isRecurring,
    });
  }

  async remove(id: string): Promise<void> {
    const scheduledJob = await this.findOne(id);

    if (scheduledJob.bullmqJobId && scheduledJob.queue) {
      const bullmqQueue = this.bullmqService.getQueue(scheduledJob.queue.name);
      
      if (scheduledJob.isRecurring) {
        const repeatableJobs = await bullmqQueue.getRepeatableJobs();
        for (const repeatable of repeatableJobs) {
          if (repeatable.name === scheduledJob.name) {
            await bullmqQueue.removeRepeatable(repeatable.name, {
              pattern: repeatable.pattern,
            });
          }
        }
      } else {
        const job = await bullmqQueue.getJob(scheduledJob.bullmqJobId);
        if (job) {
          await job.remove();
        }
      }
    }

    await this.prisma.scheduledJob.delete({
      where: { id },
    });
  }

  async pause(id: string): Promise<ScheduledJob> {
    const scheduledJob = await this.findOne(id);
    
    if (scheduledJob.bullmqJobId && scheduledJob.queue) {
      const bullmqQueue = this.bullmqService.getQueue(scheduledJob.queue.name);
      
      if (scheduledJob.isRecurring) {
        const repeatableJobs = await bullmqQueue.getRepeatableJobs();
        for (const repeatable of repeatableJobs) {
          if (repeatable.name === scheduledJob.name) {
            await bullmqQueue.removeRepeatable(repeatable.name, {
              pattern: repeatable.pattern,
            });
          }
        }
      } else {
        const job = await bullmqQueue.getJob(scheduledJob.bullmqJobId);
        if (job) {
          await job.remove();
        }
      }
    }

    return this.prisma.scheduledJob.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async resume(id: string): Promise<ScheduledJob> {
    const scheduledJob = await this.findOne(id);
    
    if (scheduledJob.isActive) {
      return scheduledJob;
    }

    const queue = await this.queueService.findOne(scheduledJob.queueId);
    const bullmqQueue = this.bullmqService.getQueue(queue.name);
    
    let nextRunAt: Date | undefined;
    let bullmqJobId: string | undefined;

    if (scheduledJob.isRecurring && scheduledJob.cron) {
      const repeatableJob = await bullmqQueue.add(
        scheduledJob.name,
        {
          ...(scheduledJob.data as Record<string, any>),
          _jobName: scheduledJob.name,
          _queueId: scheduledJob.queueId,
          _isScheduled: true,
        },
        {
          repeat: {
            pattern: scheduledJob.cron,
          },
          jobId: `scheduled-${scheduledJob.name}-${Date.now()}`,
        },
      );
      bullmqJobId = repeatableJob.id;
      
      const repeatableJobs = await bullmqQueue.getRepeatableJobs();
      const repeatable = repeatableJobs.find(r => r.name === scheduledJob.name);
      if (repeatable) {
        nextRunAt = new Date(repeatable.next);
      }
    } else if (scheduledJob.delay) {
      const delayedJob = await bullmqQueue.add(
        scheduledJob.name,
        {
          ...(scheduledJob.data as Record<string, any>),
          _jobName: scheduledJob.name,
          _queueId: scheduledJob.queueId,
          _isScheduled: true,
        },
        {
          delay: scheduledJob.delay,
          jobId: `delayed-${scheduledJob.name}-${Date.now()}`,
        },
      );
      bullmqJobId = delayedJob.id;
      nextRunAt = new Date(Date.now() + scheduledJob.delay);
    }

    return this.prisma.scheduledJob.update({
      where: { id },
      data: { 
        isActive: true,
        bullmqJobId,
        nextRunAt,
      },
    });
  }

  async getNextRunTime(cron: string): Promise<Date> {
    const now = new Date();
    return new Date(now.getTime() + 60000);
  }
}
