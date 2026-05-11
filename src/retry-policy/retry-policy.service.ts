import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { RetryStrategyType, ErrorClassification, RetryStats, DailyErrorDistribution } from './types';
import { ErrorClassifierService } from './error-classifier.service';

const FIVE_MINUTES = 5 * 60 * 1000;
const DEFAULT_BASE_DELAY = 1000;
const DEFAULT_MAX_DELAY = FIVE_MINUTES;

@Injectable()
export class RetryPolicyService {
  constructor(
    private prisma: PrismaService,
    private errorClassifier: ErrorClassifierService,
  ) {}

  /**
   * 计算下次重试的延迟时间
   * @param job - BullMQ 任务对象
   * @param error - 错误对象
   * @param attemptCount - 当前重试次数（从 1 开始）
   * @returns 下次重试的延迟毫秒数
   */
  calculateNextDelay(job: Job, error: unknown, attemptCount: number): number {
    const strategy = this.getRetryStrategy(job);
    const baseDelay = this.getBaseDelay(job);
    const maxDelay = this.getMaxDelay(job);

    let delay: number;

    switch (strategy) {
      case RetryStrategyType.FIXED:
        delay = this.calculateFixedDelay(baseDelay);
        break;
      case RetryStrategyType.EXPONENTIAL:
        delay = this.calculateExponentialDelay(baseDelay, attemptCount, maxDelay);
        break;
      case RetryStrategyType.LINEAR:
        delay = this.calculateLinearDelay(baseDelay, attemptCount, maxDelay);
        break;
      case RetryStrategyType.CUSTOM:
        delay = this.calculateCustomDelay(job, attemptCount, baseDelay);
        break;
      default:
        delay = this.calculateFixedDelay(baseDelay);
    }

    return Math.min(delay, maxDelay);
  }

  /**
   * 获取任务配置的重试策略
   * @param job - BullMQ 任务对象
   * @returns 重试策略类型
   */
  private getRetryStrategy(job: Job): RetryStrategyType {
    const opts = job.opts as any;
    const strategy = opts?.retryStrategy?.toUpperCase?.();

    if (strategy && Object.values(RetryStrategyType).includes(strategy)) {
      return strategy as RetryStrategyType;
    }

    return RetryStrategyType.FIXED;
  }

  /**
   * 获取基础延迟时间
   * @param job - BullMQ 任务对象
   * @returns 基础延迟毫秒数
   */
  private getBaseDelay(job: Job): number {
    const opts = job.opts as any;
    return opts?.baseDelay || opts?.backoff?.delay || DEFAULT_BASE_DELAY;
  }

  /**
   * 获取最大延迟时间
   * @param job - BullMQ 任务对象
   * @returns 最大延迟毫秒数
   */
  private getMaxDelay(job: Job): number {
    const opts = job.opts as any;
    return opts?.maxDelay || DEFAULT_MAX_DELAY;
  }

  /**
   * 计算固定间隔延迟
   * @param baseDelay - 基础延迟
   * @returns 延迟毫秒数
   */
  private calculateFixedDelay(baseDelay: number): number {
    return baseDelay;
  }

  /**
   * 计算指数退避延迟
   * 公式: baseDelay * 2^attempt，不超过 maxDelay
   * @param baseDelay - 基础延迟
   * @param attemptCount - 重试次数
   * @param maxDelay - 最大延迟
   * @returns 延迟毫秒数
   */
  private calculateExponentialDelay(baseDelay: number, attemptCount: number, maxDelay: number): number {
    const multiplier = Math.pow(2, attemptCount);
    const delay = baseDelay * multiplier;
    return Math.min(delay, maxDelay);
  }

  /**
   * 计算线性增长延迟
   * 公式: baseDelay * attempt
   * @param baseDelay - 基础延迟
   * @param attemptCount - 重试次数
   * @param maxDelay - 最大延迟
   * @returns 延迟毫秒数
   */
  private calculateLinearDelay(baseDelay: number, attemptCount: number, maxDelay: number): number {
    const delay = baseDelay * attemptCount;
    return Math.min(delay, maxDelay);
  }

  /**
   * 计算自定义延迟
   * 从 job.data.retryDelays 数组按下标取值
   * @param job - BullMQ 任务对象
   * @param attemptCount - 重试次数
   * @param fallbackDelay - 回退延迟
   * @returns 延迟毫秒数
   */
  private calculateCustomDelay(job: Job, attemptCount: number, fallbackDelay: number): number {
    const retryDelays = (job.data as any)?.retryDelays;

    if (Array.isArray(retryDelays) && retryDelays.length > 0) {
      const index = Math.min(attemptCount - 1, retryDelays.length - 1);
      return retryDelays[index];
    }

    return fallbackDelay;
  }

  /**
   * 判断任务是否应该重试
   * @param job - BullMQ 任务对象
   * @param error - 错误对象
   * @param attemptCount - 当前重试次数
   * @param maxRetries - 最大重试次数
   * @returns 是否应该重试
   */
  shouldRetry(job: Job, error: unknown, attemptCount: number, maxRetries: number): boolean {
    const classification = this.errorClassifier.classify(error);

    if (classification === ErrorClassification.PERMANENT) {
      return false;
    }

    if (classification === ErrorClassification.UNKNOWN) {
      const maxUnknownRetries = this.errorClassifier.getMaxUnknownRetries();
      return attemptCount < maxUnknownRetries;
    }

    return attemptCount < maxRetries;
  }

  /**
   * 获取错误分类
   * @param error - 错误对象
   * @returns 错误分类
   */
  classifyError(error: unknown): ErrorClassification {
    return this.errorClassifier.classify(error);
  }

  /**
   * 获取按策略类型聚合的重试统计
   * @returns 各策略的重试次数和成功率
   */
  async getRetryStats(): Promise<RetryStats[]> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const failedLogs = await this.prisma.jobLog.findMany({
      where: {
        status: 'FAILED',
        createdAt: { gte: twentyFourHoursAgo },
      },
      include: { job: true },
    });

    const completedLogs = await this.prisma.jobLog.findMany({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: twentyFourHoursAgo },
      },
      include: { job: true },
    });

    const statsMap = new Map<RetryStrategyType, { retries: number; successes: number; failures: number }>();

    for (const strategy of Object.values(RetryStrategyType)) {
      statsMap.set(strategy, { retries: 0, successes: 0, failures: 0 });
    }

    for (const log of failedLogs) {
      if (log.retryCount > 0) {
        const strategy = RetryStrategyType.FIXED;
        const stats = statsMap.get(strategy)!;
        stats.retries += log.retryCount;
        stats.failures++;
      }
    }

    for (const log of completedLogs) {
      if (log.retryCount > 0) {
        const strategy = RetryStrategyType.FIXED;
        const stats = statsMap.get(strategy)!;
        stats.retries += log.retryCount;
        stats.successes++;
      }
    }

    const result: RetryStats[] = [];
    for (const [strategy, stats] of statsMap.entries()) {
      const total = stats.successes + stats.failures;
      result.push({
        strategy,
        totalRetries: stats.retries,
        successCount: stats.successes,
        failureCount: stats.failures,
        successRate: total > 0 ? Math.round((stats.successes / total) * 10000) / 100 : 0,
      });
    }

    return result;
  }

  /**
   * 获取近 24 小时错误分布
   * @returns 错误分布统计
   */
  async getErrorDistribution(): Promise<DailyErrorDistribution> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const failedLogs = await this.prisma.jobLog.findMany({
      where: {
        status: 'FAILED',
        createdAt: { gte: twentyFourHoursAgo },
        error: { not: null },
      },
      orderBy: { createdAt: 'asc' },
    });

    const hourlyDistribution: { hour: number; count: number }[] = [];
    for (let i = 0; i < 24; i++) {
      hourlyDistribution.push({ hour: i, count: 0 });
    }

    const classificationCounts: Record<ErrorClassification, number> = {
      [ErrorClassification.TRANSIENT]: 0,
      [ErrorClassification.PERMANENT]: 0,
      [ErrorClassification.UNKNOWN]: 0,
    };

    const errorTypeCounts: Record<string, number> = {};

    for (const log of failedLogs) {
      const hour = log.createdAt.getHours();
      hourlyDistribution[hour].count++;

      const classification = log.error ? this.classifyError(new Error(log.error)) : ErrorClassification.UNKNOWN;
      classificationCounts[classification]++;

      const errorType = this.errorClassifier.getErrorType(log.error || 'Unknown');
      errorTypeCounts[errorType] = (errorTypeCounts[errorType] || 0) + 1;
    }

    const totalErrors = failedLogs.length;

    const byClassification = Object.entries(classificationCounts).map(([classification, count]) => ({
      classification: classification as ErrorClassification,
      count,
      percentage: totalErrors > 0 ? Math.round((count / totalErrors) * 10000) / 100 : 0,
      details: Object.entries(errorTypeCounts)
        .map(([errorType, typeCount]) => ({ errorType, count: typeCount }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    }));

    return {
      date: new Date().toISOString().split('T')[0],
      totalErrors,
      hourlyDistribution,
      byClassification,
    };
  }
}
