import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BullmqService } from '../bullmq/bullmq.service';
import { QueueService } from '../queue/queue.service';
import { JobService } from '../job/job.service';
import { RetryPolicyService } from '../retry-policy/retry-policy.service';
import { ErrorClassifier } from '../retry-policy/error-classifier';
import { ErrorCategory } from '../config/error-classifier.config';
import { Worker, Job as BullmqJob } from 'bullmq';
import { Worker as WorkerModel, JobStatus } from '@prisma/client';

@Injectable()
export class WorkerService {
  private registeredWorkers: Map<string, Worker> = new Map();
  private processedJobsCount: Map<string, number> = new Map();
  private startTime: Map<string, number> = new Map();

  constructor(
    private prisma: PrismaService,
    private bullmqService: BullmqService,
    private queueService: QueueService,
    private jobService: JobService,
    private retryPolicyService: RetryPolicyService,
    private errorClassifier: ErrorClassifier,
  ) {}

  async registerWorker(queueId: string): Promise<WorkerModel> {
    const queue = await this.queueService.findOne(queueId);
    
    const existingWorker = await this.prisma.worker.findFirst({
      where: { queueId },
    });

    if (existingWorker) {
      return existingWorker;
    }

    const workerName = `worker-${queue.name}`;
    
    const workerProcessor = async (bullmqJob: BullmqJob) => {
      const jobStartTime = new Date();
      const jobId = bullmqJob.id;
      const queueName = queue.name;

      console.log(`[Worker ${workerName}] Processing job: ${bullmqJob.name} (${jobId})`);

      this.processedJobsCount.set(queueId, (this.processedJobsCount.get(queueId) || 0) + 1);

      await this.jobService.updateJobStatus(
        jobId,
        JobStatus.ACTIVE,
        undefined,
        jobStartTime,
      );

      try {
        await this.processJob(bullmqJob, queueName);

        const jobEndTime = new Date();
        await this.jobService.updateJobStatus(
          jobId,
          JobStatus.COMPLETED,
          undefined,
          jobStartTime,
          jobEndTime,
        );

        console.log(`[Worker ${workerName}] Job completed: ${bullmqJob.name} (${jobId})`);
      } catch (error) {
        const jobEndTime = new Date();

        const classification = this.errorClassifier.classify(error);
        const errorMessage = error instanceof Error ? error.message : String(error);

        console.log(
          `[Worker ${workerName}] Error classified as ${classification.category}` +
          ` (matched: ${classification.matchedRule}) for job ${jobId}`,
        );

        if (classification.category === ErrorCategory.PERMANENT) {
          const currentJob = await this.prisma.job.findFirst({
            where: { bullmqJobId: jobId },
          });
          if (currentJob) {
            await this.moveToDeadLetter(currentJob, error);
          }
          await this.jobService.updateJobStatus(
            jobId,
            JobStatus.FAILED,
            errorMessage,
            jobStartTime,
            jobEndTime,
          );
          console.error(
            `[Worker ${workerName}] Job permanently failed (no retry): ${bullmqJob.name} (${jobId})`,
            error,
          );
        } else {
          const currentJob = await this.prisma.job.findFirst({
            where: { bullmqJobId: jobId },
          });

          const nextAttemptCount = (currentJob?.retryCount || 0) + 1;

          const shouldDeadLetter =
            this.errorClassifier.isMaxRetriesExceeded(
              classification.category,
              nextAttemptCount,
            ) ||
            (currentJob && currentJob.retryCount >= queue.maxRetries);

          if (shouldDeadLetter) {
            if (currentJob) {
              await this.moveToDeadLetter(currentJob, error);
            }
            await this.jobService.updateJobStatus(
              jobId,
              JobStatus.FAILED,
              errorMessage,
              jobStartTime,
              jobEndTime,
            );
            console.error(
              `[Worker ${workerName}] Job max retries exceeded, moved to dead-letter: ${bullmqJob.name} (${jobId})`,
              error,
            );
          } else {
            const delay = this.retryPolicyService.calculateNextDelay(
              bullmqJob,
              error,
              nextAttemptCount,
            );

            await bullmqJob.moveToDelayed(Date.now() + delay);

            await this.prisma.job.updateMany({
              where: { bullmqJobId: jobId },
              data: {
                status: JobStatus.DELAYED,
                retryCount: { increment: 1 },
                failedAt: jobEndTime,
              },
            });

            await this.jobService.createJobLog(
              currentJob?.id || jobId,
              JobStatus.FAILED,
              `Retry scheduled with ${classification.category} policy. Next delay: ${delay}ms (attempt ${nextAttemptCount})`,
              errorMessage,
              nextAttemptCount,
              jobStartTime,
              jobEndTime,
            );

            console.log(
              `[Worker ${workerName}] Job retry scheduled: ${bullmqJob.name} (${jobId}),` +
              ` delay=${delay}ms, attempt=${nextAttemptCount}, category=${classification.category}`,
            );
          }
        }

        throw error;
      }
    };

    const bullmqWorker = await this.bullmqService.createWorker(
      queue.name,
      workerProcessor,
      { concurrency: queue.concurrency },
    );

    this.registeredWorkers.set(queueId, bullmqWorker);
    this.processedJobsCount.set(queueId, 0);
    this.startTime.set(queueId, Date.now());

    bullmqWorker.on('error', (err) => {
      console.error(`[Worker ${workerName}] Error:`, err);
    });

    const worker = await this.prisma.worker.create({
      data: {
        queueId: queue.id,
        name: workerName,
        processorName: 'default',
        status: 'running',
      },
    });

    return worker;
  }

  private async processJob(bullmqJob: BullmqJob, queueName: string): Promise<void> {
    const jobData = bullmqJob.data;
    console.log(`Processing job with data:`, jobData);

    switch (queueName) {
      case 'email-queue':
        await this.simulateEmailJob(jobData);
        break;
      case 'notification-queue':
        await this.simulateNotificationJob(jobData);
        break;
      case 'report-queue':
        await this.simulateReportJob(jobData);
        break;
      default:
        await this.simulateGenericJob(jobData);
    }

    await bullmqJob.updateProgress(100);
  }

  private async simulateEmailJob(data: any): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    console.log(`Email sent to: ${data.email || 'unknown'}`);
  }

  private async simulateNotificationJob(data: any): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
    console.log(`Notification sent to: ${data.userId || 'unknown'}`);
  }

  private async simulateReportJob(data: any): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
    console.log(`Report generated: ${data.reportType || 'unknown'}`);
  }

  private async simulateGenericJob(data: any): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1500));
    console.log(`Generic job processed`);
  }

  private async moveToDeadLetter(job: any, error: any): Promise<void> {
    await this.prisma.deadLetterJob.create({
      data: {
        queueId: job.queueId,
        originalJobId: job.id,
        name: job.name,
        data: job.data,
        errorMessage: error instanceof Error ? error.message : String(error),
        failedCount: job.retryCount + 1,
      },
    });
  }

  async findAll(): Promise<(WorkerModel & { queue: any })[]> {
    return this.prisma.worker.findMany({
      include: { queue: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<WorkerModel & { queue: any }> {
    const worker = await this.prisma.worker.findUnique({
      where: { id },
      include: { queue: true },
    });

    if (!worker) {
      throw new NotFoundException(`Worker with ID "${id}" not found`);
    }

    return worker;
  }

  async stopWorker(id: string): Promise<WorkerModel> {
    const worker = await this.findOne(id);
    
    const bullmqWorker = this.registeredWorkers.get(worker.queueId);
    if (bullmqWorker) {
      await bullmqWorker.close();
      this.registeredWorkers.delete(worker.queueId);
    }

    return this.prisma.worker.update({
      where: { id },
      data: { status: 'stopped' },
    });
  }

  async getWorkerStats(id: string): Promise<{
    worker: WorkerModel & { queue: any };
    processedJobs: number;
    processingRate: number;
    uptime: number;
  }> {
    const worker = await this.findOne(id);
    
    const processedJobs = this.processedJobsCount.get(worker.queueId) || 0;
    const startTime = this.startTime.get(worker.queueId) || Date.now();
    const uptimeMs = Date.now() - startTime;
    const uptimeMinutes = uptimeMs / 60000;
    const processingRate = uptimeMinutes > 0 ? processedJobs / uptimeMinutes : 0;

    return {
      worker,
      processedJobs,
      processingRate: Math.round(processingRate * 100) / 100,
      uptime: Math.round(uptimeMs / 1000),
    };
  }

  async getAllWorkersStats(): Promise<{
    workers: (WorkerModel & { queue: any })[];
    totalProcessed: number;
    averageRate: number;
  }> {
    const workers = await this.findAll();
    
    let totalProcessed = 0;
    let totalRate = 0;
    let activeWorkers = 0;

    for (const worker of workers) {
      const processed = this.processedJobsCount.get(worker.queueId) || 0;
      totalProcessed += processed;

      const startTime = this.startTime.get(worker.queueId);
      if (startTime && worker.status === 'running') {
        const uptimeMinutes = (Date.now() - startTime) / 60000;
        if (uptimeMinutes > 0) {
          totalRate += processed / uptimeMinutes;
          activeWorkers++;
        }
      }
    }

    return {
      workers,
      totalProcessed,
      averageRate: activeWorkers > 0 ? Math.round((totalRate / activeWorkers) * 100) / 100 : 0,
    };
  }
}
