import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BullmqService implements OnModuleDestroy {
  private connection: Redis;
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private queueEvents: Map<string, QueueEvents> = new Map();

  constructor(private configService: ConfigService) {
    this.connection = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      maxRetriesPerRequest: null,
    });
  }

  async onModuleDestroy() {
    for (const worker of this.workers.values()) {
      await worker.close();
    }
    for (const queueEvents of this.queueEvents.values()) {
      await queueEvents.close();
    }
    for (const queue of this.queues.values()) {
      await queue.close();
    }
    await this.connection.quit();
  }

  getConnection(): Redis {
    return this.connection;
  }

  getQueue(queueName: string): Queue {
    if (!this.queues.has(queueName)) {
      const queue = new Queue(queueName, {
        connection: this.connection,
      });
      this.queues.set(queueName, queue);
    }
    return this.queues.get(queueName);
  }

  async createWorker(
    queueName: string,
    processor: (job: Job) => Promise<any>,
    options: { concurrency?: number } = {},
  ): Promise<Worker> {
    if (this.workers.has(queueName)) {
      return this.workers.get(queueName);
    }

    const worker = new Worker(queueName, processor, {
      connection: this.connection,
      concurrency: options.concurrency || 1,
    });

    this.workers.set(queueName, worker);
    return worker;
  }

  getWorker(queueName: string): Worker | undefined {
    return this.workers.get(queueName);
  }

  getAllWorkers(): Map<string, Worker> {
    return this.workers;
  }

  async removeWorker(queueName: string): Promise<void> {
    const worker = this.workers.get(queueName);
    if (worker) {
      await worker.close();
      this.workers.delete(queueName);
    }
  }

  getQueueEvents(queueName: string): QueueEvents {
    if (!this.queueEvents.has(queueName)) {
      const queueEvents = new QueueEvents(queueName, {
        connection: this.connection,
      });
      this.queueEvents.set(queueName, queueEvents);
    }
    return this.queueEvents.get(queueName);
  }

  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.pause();
  }

  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.resume();
  }

  async isQueuePaused(queueName: string): Promise<boolean> {
    const queue = this.getQueue(queueName);
    return queue.isPaused();
  }

  async getQueueCounts(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const queue = this.getQueue(queueName);
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);
    return { waiting, active, completed, failed, delayed };
  }
}
