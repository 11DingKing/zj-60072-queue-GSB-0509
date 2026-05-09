import { Injectable } from '@nestjs/common';
import { QueueService } from '../queue/queue.service';
import { WorkerService } from '../worker/worker.service';
import { PrismaService } from '../prisma/prisma.service';
import { JobStatus } from '@prisma/client';

@Injectable()
export class MonitorService {
  private previousCounts: Map<string, { completed: number; timestamp: number }> = new Map();

  constructor(
    private prisma: PrismaService,
    private queueService: QueueService,
    private workerService: WorkerService,
  ) {}

  async getSystemOverview(): Promise<{
    queues: { total: number; paused: number; active: number };
    jobs: {
      total: number;
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
    };
    workers: { total: number; running: number; stopped: number };
    deadLetters: { total: number };
  }> {
    const queues = await this.queueService.findAll();
    const jobsByStatus = await this.getJobsCountByStatus();
    const workers = await this.workerService.findAll();
    const deadLetters = await this.prisma.deadLetterJob.count();

    return {
      queues: {
        total: queues.length,
        paused: queues.filter(q => q.isPaused).length,
        active: queues.filter(q => !q.isPaused).length,
      },
      jobs: jobsByStatus,
      workers: {
        total: workers.length,
        running: workers.filter(w => w.status === 'running').length,
        stopped: workers.filter(w => w.status === 'stopped').length,
      },
      deadLetters: {
        total: deadLetters,
      },
    };
  }

  private async getJobsCountByStatus(): Promise<{
    total: number;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [total, waiting, active, completed, failed, delayed] = await Promise.all([
      this.prisma.job.count(),
      this.prisma.job.count({ where: { status: JobStatus.WAITING } }),
      this.prisma.job.count({ where: { status: JobStatus.ACTIVE } }),
      this.prisma.job.count({ where: { status: JobStatus.COMPLETED } }),
      this.prisma.job.count({ where: { status: JobStatus.FAILED } }),
      this.prisma.job.count({ where: { status: JobStatus.DELAYED } }),
    ]);

    return { total, waiting, active, completed, failed, delayed };
  }

  async getQueueStatsWithRate(queueId: string, queueName: string): Promise<any> {
    const stats = await this.queueService.getQueueStats(queueId);
    const now = Date.now();
    const prev = this.previousCounts.get(queueId);

    let jobsPerMinute = 0;
    if (prev && prev.completed !== undefined) {
      const completedDiff = stats.counts.completed - prev.completed;
      const timeDiffMinutes = (now - prev.timestamp) / 60000;
      if (timeDiffMinutes > 0) {
        jobsPerMinute = completedDiff / timeDiffMinutes;
      }
    }

    this.previousCounts.set(queueId, {
      completed: stats.counts.completed,
      timestamp: now,
    });

    return {
      ...stats,
      jobsPerMinute: Math.round(jobsPerMinute * 100) / 100,
    };
  }

  async getAllQueuesStats(): Promise<any[]> {
    const queues = await this.queueService.findAll();
    const allStats: any[] = [];

    for (const queue of queues) {
      const stats = await this.getQueueStatsWithRate(queue.id, queue.name);
      allStats.push(stats);
    }

    return allStats;
  }

  async getRecentActivity(limit: number = 20): Promise<{
    recentJobs: any[];
    recentLogs: any[];
  }> {
    const recentJobs = await this.prisma.job.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { queue: true },
    });

    const recentLogs = await this.prisma.jobLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { job: { include: { queue: true } } },
    });

    return { recentJobs, recentLogs };
  }
}
