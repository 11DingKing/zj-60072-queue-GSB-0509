import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JobLog } from '@prisma/client';

@Injectable()
export class JobLogService {
  constructor(private prisma: PrismaService) {}

  async findByJobId(jobId: string): Promise<JobLog[]> {
    return this.prisma.jobLog.findMany({
      where: { jobId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findAll(
    jobId?: string,
    skip: number = 0,
    take: number = 50,
  ): Promise<{ logs: JobLog[]; total: number }> {
    const where: any = {};
    if (jobId) where.jobId = jobId;

    const [logs, total] = await Promise.all([
      this.prisma.jobLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          job: {
            include: { queue: true },
          },
        },
      }),
      this.prisma.jobLog.count({ where }),
    ]);

    return { logs, total };
  }

  async getJobExecutionSummary(jobId: string): Promise<{
    jobId: string;
    totalAttempts: number;
    completedAttempts: number;
    failedAttempts: number;
    averageDuration: number;
    lastExecution: Date | null;
  }> {
    const logs = await this.prisma.jobLog.findMany({
      where: { jobId },
      orderBy: { createdAt: 'asc' },
    });

    if (logs.length === 0) {
      return {
        jobId,
        totalAttempts: 0,
        completedAttempts: 0,
        failedAttempts: 0,
        averageDuration: 0,
        lastExecution: null,
      };
    }

    const completedLogs = logs.filter(l => l.status === 'COMPLETED');
    const failedLogs = logs.filter(l => l.status === 'FAILED');
    const logsWithDuration = logs.filter(l => l.duration !== null);

    const averageDuration = logsWithDuration.length > 0
      ? logsWithDuration.reduce((sum, l) => sum + (l.duration || 0), 0) / logsWithDuration.length
      : 0;

    const lastExecution = logs[logs.length - 1].createdAt;

    return {
      jobId,
      totalAttempts: logs.length,
      completedAttempts: completedLogs.length,
      failedAttempts: failedLogs.length,
      averageDuration: Math.round(averageDuration * 100) / 100,
      lastExecution,
    };
  }

  async getRecentErrors(limit: number = 20): Promise<JobLog[]> {
    return this.prisma.jobLog.findMany({
      where: {
        status: 'FAILED',
        error: { not: null },
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        job: {
          include: { queue: true },
        },
      },
    });
  }
}
