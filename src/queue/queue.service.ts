import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BullmqService } from '../bullmq/bullmq.service';
import { CreateQueueDto } from './dto/create-queue.dto';
import { UpdateQueueDto } from './dto/update-queue.dto';
import { Queue, Job } from '@prisma/client';

@Injectable()
export class QueueService {
  constructor(
    private prisma: PrismaService,
    private bullmqService: BullmqService,
  ) {}

  async create(createQueueDto: CreateQueueDto): Promise<Queue> {
    const existingQueue = await this.prisma.queue.findUnique({
      where: { name: createQueueDto.name },
    });

    if (existingQueue) {
      throw new ConflictException(`Queue with name "${createQueueDto.name}" already exists`);
    }

    const queue = await this.prisma.queue.create({
      data: {
        name: createQueueDto.name,
        description: createQueueDto.description,
        concurrency: createQueueDto.concurrency || 1,
        maxRetries: createQueueDto.maxRetries ?? 3,
        retryDelay: createQueueDto.retryDelay ?? 1000,
        timeout: createQueueDto.timeout ?? 30000,
        isPaused: createQueueDto.isPaused || false,
      },
    });

    const bullmqQueue = this.bullmqService.getQueue(queue.name);
    if (queue.isPaused) {
      await this.bullmqService.pauseQueue(queue.name);
    }

    return queue;
  }

  async findAll(): Promise<Queue[]> {
    return this.prisma.queue.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<Queue> {
    const queue = await this.prisma.queue.findUnique({
      where: { id },
    });

    if (!queue) {
      throw new NotFoundException(`Queue with ID "${id}" not found`);
    }

    return queue;
  }

  async findByName(name: string): Promise<Queue> {
    const queue = await this.prisma.queue.findUnique({
      where: { name },
    });

    if (!queue) {
      throw new NotFoundException(`Queue with name "${name}" not found`);
    }

    return queue;
  }

  async update(id: string, updateQueueDto: UpdateQueueDto): Promise<Queue> {
    const queue = await this.findOne(id);

    const updatedQueue = await this.prisma.queue.update({
      where: { id },
      data: {
        description: updateQueueDto.description,
        concurrency: updateQueueDto.concurrency,
        maxRetries: updateQueueDto.maxRetries,
        retryDelay: updateQueueDto.retryDelay,
        timeout: updateQueueDto.timeout,
        isPaused: updateQueueDto.isPaused,
      },
    });

    if (updateQueueDto.isPaused !== undefined) {
      if (updateQueueDto.isPaused) {
        await this.bullmqService.pauseQueue(queue.name);
      } else {
        await this.bullmqService.resumeQueue(queue.name);
      }
    }

    return updatedQueue;
  }

  async remove(id: string): Promise<void> {
    const queue = await this.findOne(id);

    const bullmqQueue = this.bullmqService.getQueue(queue.name);
    await bullmqQueue.drain();
    await bullmqQueue.obliterate({ force: true });

    await this.prisma.queue.delete({
      where: { id },
    });
  }

  async pause(id: string): Promise<Queue> {
    const queue = await this.findOne(id);
    await this.bullmqService.pauseQueue(queue.name);

    return this.prisma.queue.update({
      where: { id },
      data: { isPaused: true },
    });
  }

  async resume(id: string): Promise<Queue> {
    const queue = await this.findOne(id);
    await this.bullmqService.resumeQueue(queue.name);

    return this.prisma.queue.update({
      where: { id },
      data: { isPaused: false },
    });
  }

  async getQueueStats(id: string): Promise<{
    queue: Queue;
    counts: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
    };
    isPaused: boolean;
  }> {
    const queue = await this.findOne(id);
    const counts = await this.bullmqService.getQueueCounts(queue.name);
    const isPaused = await this.bullmqService.isQueuePaused(queue.name);

    return { queue, counts, isPaused };
  }

  async drain(id: string): Promise<void> {
    const queue = await this.findOne(id);
    const bullmqQueue = this.bullmqService.getQueue(queue.name);
    await bullmqQueue.drain();
  }

  async clean(id: string, grace: number = 3600000): Promise<number> {
    const queue = await this.findOne(id);
    const bullmqQueue = this.bullmqService.getQueue(queue.name);
    
    const cleanedJobs = await bullmqQueue.clean(grace, 100, 'completed');
    await bullmqQueue.clean(grace, 100, 'failed');
    
    return cleanedJobs.length;
  }
}
