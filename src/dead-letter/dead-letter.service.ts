import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DeadLetterJob } from '@prisma/client';
import { QueueService } from '../queue/queue.service';
import { BullmqService } from '../bullmq/bullmq.service';

@Injectable()
export class DeadLetterService {
  constructor(
    private prisma: PrismaService,
    private queueService: QueueService,
    private bullmqService: BullmqService,
  ) {}

  async findAll(queueId?: string): Promise<DeadLetterJob[]> {
    const where: any = {};
    if (queueId) where.queueId = queueId;

    return this.prisma.deadLetterJob.findMany({
      where,
      include: { queue: true },
      orderBy: { movedAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<DeadLetterJob & { queue: any }> {
    const deadLetterJob = await this.prisma.deadLetterJob.findUnique({
      where: { id },
      include: { queue: true },
    });

    if (!deadLetterJob) {
      throw new NotFoundException(`Dead letter job with ID "${id}" not found`);
    }

    return deadLetterJob;
  }

  async requeue(id: string, reviewedBy: string = 'system'): Promise<void> {
    const deadLetterJob = await this.findOne(id);
    const queue = await this.queueService.findOne(deadLetterJob.queueId);

    const bullmqQueue = this.bullmqService.getQueue(queue.name);
    const jobData = deadLetterJob.data as Record<string, any>;
    await bullmqQueue.add(
      deadLetterJob.name,
      {
        ...jobData,
        _isRequeued: true,
        _originalJobId: deadLetterJob.originalJobId,
      },
      {
        attempts: queue.maxRetries + 1,
        backoff: {
          type: 'fixed',
          delay: queue.retryDelay,
        },
      },
    );

    await this.prisma.deadLetterJob.update({
      where: { id },
      data: {
        reviewedBy,
        reviewedAt: new Date(),
        action: 'requeue',
      },
    });
  }

  async delete(id: string, reviewedBy: string = 'system'): Promise<void> {
    const deadLetterJob = await this.findOne(id);

    await this.prisma.deadLetterJob.update({
      where: { id },
      data: {
        reviewedBy,
        reviewedAt: new Date(),
        action: 'delete',
      },
    });

    await this.prisma.deadLetterJob.delete({
      where: { id },
    });
  }

  async batchRequeue(ids: string[], reviewedBy: string = 'system'): Promise<number> {
    let count = 0;
    for (const id of ids) {
      try {
        await this.requeue(id, reviewedBy);
        count++;
      } catch (e) {
        // Skip if job not found
      }
    }
    return count;
  }

  async batchDelete(ids: string[], reviewedBy: string = 'system'): Promise<number> {
    let count = 0;
    for (const id of ids) {
      try {
        await this.delete(id, reviewedBy);
        count++;
      } catch (e) {
        // Skip if job not found
      }
    }
    return count;
  }

  async getStatistics(): Promise<{
    total: number;
    byQueue: { queueId: string; queueName: string; count: number }[];
    unreviewed: number;
  }> {
    const total = await this.prisma.deadLetterJob.count();
    const unreviewed = await this.prisma.deadLetterJob.count({
      where: { reviewedAt: null },
    });

    const jobsByQueue = await this.prisma.deadLetterJob.groupBy({
      by: ['queueId'],
      _count: { queueId: true },
    });

    const queueIds = jobsByQueue.map(j => j.queueId);
    const queues = await this.prisma.queue.findMany({
      where: { id: { in: queueIds } },
      select: { id: true, name: true },
    });

    const queueMap = new Map(queues.map(q => [q.id, q.name]));

    const byQueue = jobsByQueue.map(j => ({
      queueId: j.queueId,
      queueName: queueMap.get(j.queueId) || 'Unknown',
      count: j._count.queueId,
    }));

    return { total, byQueue, unreviewed };
  }
}
