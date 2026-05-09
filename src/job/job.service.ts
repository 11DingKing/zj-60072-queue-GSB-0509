import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BullmqService } from '../bullmq/bullmq.service';
import { QueueService } from '../queue/queue.service';
import { CreateJobDto, BatchCreateJobDto } from './dto/create-job.dto';
import { Job, JobStatus, JobLog } from '@prisma/client';

@Injectable()
export class JobService {
  constructor(
    private prisma: PrismaService,
    private bullmqService: BullmqService,
    private queueService: QueueService,
  ) {}

  async create(createJobDto: CreateJobDto): Promise<Job> {
    const queue = await this.queueService.findOne(createJobDto.queueId);

    if (createJobDto.parentJobId) {
      const parentJob = await this.prisma.job.findUnique({
        where: { id: createJobDto.parentJobId },
      });
      if (!parentJob) {
        throw new NotFoundException(`Parent job with ID "${createJobDto.parentJobId}" not found`);
      }
    }

    const bullmqQueue = this.bullmqService.getQueue(queue.name);
    
    const jobOptions: any = {
      priority: 11 - (createJobDto.priority || 5),
    };

    if (createJobDto.delay && createJobDto.delay > 0) {
      jobOptions.delay = createJobDto.delay;
    }

    let parentJobBullmqId: string | undefined;
    if (createJobDto.parentJobId) {
      const parentJob = await this.prisma.job.findUnique({
        where: { id: createJobDto.parentJobId },
      });
      if (parentJob?.bullmqJobId) {
        parentJobBullmqId = parentJob.bullmqJobId;
      }
    }

    const bullmqJob = await bullmqQueue.add(
      createJobDto.name,
      {
        ...createJobDto.data,
        _jobName: createJobDto.name,
        _queueId: queue.id,
        _parentJobId: createJobDto.parentJobId,
      },
      {
        ...jobOptions,
        attempts: queue.maxRetries + 1,
        backoff: {
          type: 'fixed',
          delay: queue.retryDelay,
        },
      },
    );

    const job = await this.prisma.job.create({
      data: {
        name: createJobDto.name,
        queueId: createJobDto.queueId,
        data: createJobDto.data,
        priority: createJobDto.priority || 5,
        delay: createJobDto.delay,
        parentJobId: createJobDto.parentJobId,
        isDependency: !!createJobDto.parentJobId,
        bullmqJobId: bullmqJob.id,
        status: createJobDto.delay ? JobStatus.DELAYED : JobStatus.WAITING,
      },
    });

    await this.createJobLog(
      job.id,
      job.status,
      `Job created with priority ${job.priority}`,
      undefined,
      0,
    );

    return job;
  }

  async batchCreate(batchCreateJobDto: BatchCreateJobDto): Promise<Job[]> {
    const createdJobs: Job[] = [];
    for (const jobDto of batchCreateJobDto.jobs) {
      const job = await this.create(jobDto);
      createdJobs.push(job);
    }
    return createdJobs;
  }

  async findAll(
    queueId?: string,
    status?: JobStatus,
    skip: number = 0,
    take: number = 50,
  ): Promise<{ jobs: Job[]; total: number }> {
    const where: any = {};
    if (queueId) where.queueId = queueId;
    if (status) where.status = status;

    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          queue: true,
          parentJob: true,
          childJobs: true,
        },
      }),
      this.prisma.job.count({ where }),
    ]);

    return { jobs, total };
  }

  async findOne(id: string): Promise<Job & {
    queue: any;
    parentJob: any;
    childJobs: any;
    logs: JobLog[];
  }> {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        queue: true,
        parentJob: true,
        childJobs: true,
        logs: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`Job with ID "${id}" not found`);
    }

    return job;
  }

  async remove(id: string): Promise<void> {
    const job = await this.findOne(id);
    
    if (job.bullmqJobId && job.queue) {
      const bullmqQueue = this.bullmqService.getQueue(job.queue.name);
      const bullmqJob = await bullmqQueue.getJob(job.bullmqJobId);
      if (bullmqJob) {
        await bullmqJob.remove();
      }
    }

    await this.prisma.job.delete({
      where: { id },
    });
  }

  async batchRemove(jobIds: string[]): Promise<number> {
    let count = 0;
    for (const jobId of jobIds) {
      try {
        await this.remove(jobId);
        count++;
      } catch (e) {
        // Skip if job not found
      }
    }
    return count;
  }

  async retry(id: string): Promise<Job> {
    const job = await this.findOne(id);
    
    if (job.status !== JobStatus.FAILED) {
      throw new BadRequestException('Only failed jobs can be retried');
    }

    if (!job.bullmqJobId || !job.queue) {
      throw new BadRequestException('Cannot retry this job');
    }

    const bullmqQueue = this.bullmqService.getQueue(job.queue.name);
    const bullmqJob = await bullmqQueue.getJob(job.bullmqJobId);
    
    if (bullmqJob) {
      await bullmqJob.retry();
    }

    const updatedJob = await this.prisma.job.update({
      where: { id },
      data: {
        status: JobStatus.WAITING,
        retryCount: { increment: 1 },
        failedAt: null,
      },
    });

    await this.createJobLog(
      id,
      JobStatus.WAITING,
      `Job retried manually. Retry count: ${updatedJob.retryCount}`,
      undefined,
      updatedJob.retryCount,
    );

    return updatedJob;
  }

  async batchRetry(jobIds: string[]): Promise<number> {
    let count = 0;
    for (const jobId of jobIds) {
      try {
        await this.retry(jobId);
        count++;
      } catch (e) {
        // Skip if job cannot be retried
      }
    }
    return count;
  }

  async createJobLog(
    jobId: string,
    status: JobStatus,
    message?: string,
    error?: string,
    retryCount: number = 0,
    startTime?: Date,
    endTime?: Date,
  ): Promise<JobLog> {
    const duration = startTime && endTime 
      ? endTime.getTime() - startTime.getTime()
      : undefined;

    return this.prisma.jobLog.create({
      data: {
        jobId,
        status,
        message,
        error,
        retryCount,
        startTime,
        endTime,
        duration,
      },
    });
  }

  async updateJobStatus(
    bullmqJobId: string,
    status: JobStatus,
    error?: string,
    startTime?: Date,
    endTime?: Date,
  ): Promise<Job | null> {
    const job = await this.prisma.job.findFirst({
      where: { bullmqJobId },
    });

    if (!job) {
      return null;
    }

    const updateData: any = { status };
    
    if (status === JobStatus.COMPLETED) {
      updateData.completedAt = endTime || new Date();
    }
    if (status === JobStatus.FAILED) {
      updateData.failedAt = endTime || new Date();
    }

    const updatedJob = await this.prisma.job.update({
      where: { id: job.id },
      data: updateData,
    });

    await this.createJobLog(
      job.id,
      status,
      undefined,
      error,
      job.retryCount,
      startTime,
      endTime,
    );

    return updatedJob;
  }

  async getJobsByStatus(queueId: string, status: JobStatus): Promise<Job[]> {
    return this.prisma.job.findMany({
      where: { queueId, status },
      orderBy: { createdAt: 'desc' },
      include: { queue: true },
    });
  }
}
