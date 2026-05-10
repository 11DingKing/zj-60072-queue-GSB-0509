/**
 * @module retry-policy/retry-policy.controller
 * @description 重试策略控制器，提供重试统计和错误分布的查询接口。
 * 数据从 job-log 表聚合。
 */

import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { ErrorClassifier } from './error-classifier';
import { ErrorCategory } from '../config/error-classifier.config';
import {
  RetryStatsResponse,
  RetryStatsItem,
  ErrorDistributionResponse,
  ErrorDistributionItem,
} from './interfaces';
import { RetryStrategyType } from './enums';

@ApiTags('retry-policy')
@Controller('retry-policy')
export class RetryPolicyController {
  constructor(
    private prisma: PrismaService,
    private errorClassifier: ErrorClassifier,
  ) {}

  /**
   * GET /retry-policy/stats
   * 按策略类型聚合重试次数和成功率。
   * 统计逻辑：从 job_log 表中筛选 status=FAILED 且 retryCount>0 的记录，
   * 按 jobId 分组，查找同一 jobId 是否存在 status=COMPLETED 的记录来判断重试是否最终成功。
   * @returns RetryStatsResponse 包含各策略类型的统计信息
   */
  @Get('stats')
  @ApiOperation({ summary: '按策略类型聚合重试次数和成功率' })
  @ApiResponse({
    status: 200,
    description: '返回各策略的重试次数和成功率统计',
  })
  async getRetryStats(): Promise<RetryStatsResponse> {
    const failedLogs = await this.prisma.jobLog.findMany({
      where: {
        status: 'FAILED',
        retryCount: { gt: 0 },
      },
      include: {
        job: true,
      },
    });

    const strategyMap = new Map<RetryStrategyType, { retries: number; successes: number }>();

    for (const log of failedLogs) {
      const strategy = this.inferStrategyFromJob(log.job);
      const entry = strategyMap.get(strategy) || { retries: 0, successes: 0 };

      entry.retries += 1;

      const hasCompleted = await this.prisma.jobLog.findFirst({
        where: {
          jobId: log.jobId,
          status: 'COMPLETED',
        },
      });

      if (hasCompleted) {
        entry.successes += 1;
      }

      strategyMap.set(strategy, entry);
    }

    const stats: RetryStatsItem[] = Object.values(RetryStrategyType).map(
      (strategy) => {
        const entry = strategyMap.get(strategy) || { retries: 0, successes: 0 };
        return {
          strategy,
          totalRetries: entry.retries,
          successCount: entry.successes,
          successRate:
            entry.retries > 0
              ? Math.round((entry.successes / entry.retries) * 10000) / 10000
              : 0,
        };
      },
    );

    return {
      stats,
      generatedAt: new Date(),
    };
  }

  /**
   * GET /retry-policy/errors
   * 近 24 小时错误分布，按错误消息分组统计。
   * 对每条错误记录使用 ErrorClassifier 进行分类。
   * @returns ErrorDistributionResponse 包含错误分布详情
   */
  @Get('errors')
  @ApiOperation({ summary: '近 24 小时错误分布' })
  @ApiResponse({
    status: 200,
    description: '返回近 24 小时错误分布统计',
  })
  async getErrorDistribution(): Promise<ErrorDistributionResponse> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const failedLogs = await this.prisma.jobLog.findMany({
      where: {
        status: 'FAILED',
        error: { not: null },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'asc' },
    });

    const errorMap = new Map<
      string,
      {
        count: number;
        category: ErrorCategory;
        firstOccurrence: Date;
        lastOccurrence: Date;
      }
    >();

    for (const log of failedLogs) {
      const errorType = this.summarizeError(log.error || 'Unknown');

      const classification = this.errorClassifier.classify(
        new Error(log.error || ''),
      );

      const entry = errorMap.get(errorType);
      if (entry) {
        entry.count += 1;
        entry.lastOccurrence = log.createdAt;
      } else {
        errorMap.set(errorType, {
          count: 1,
          category: classification.category,
          firstOccurrence: log.createdAt,
          lastOccurrence: log.createdAt,
        });
      }
    }

    const errors: ErrorDistributionItem[] = Array.from(errorMap.entries())
      .map(([errorType, data]) => ({
        errorType,
        count: data.count,
        category: data.category,
        firstOccurrence: data.firstOccurrence,
        lastOccurrence: data.lastOccurrence,
      }))
      .sort((a, b) => b.count - a.count);

    const totalErrors = errors.reduce((sum, e) => sum + e.count, 0);

    return {
      errors,
      period: { since, until: new Date() },
      totalErrors,
    };
  }

  /**
   * 从 Job 记录推断使用的重试策略类型。
   * 如果 job.data 中包含 retryDelays 数组则推断为 CUSTOM；
   * 否则根据约定回退为 FIXED（默认策略）。
   * @param job - Prisma Job 记录
   * @returns RetryStrategyType 策略类型
   */
  private inferStrategyFromJob(job: any): RetryStrategyType {
    if (!job) return RetryStrategyType.FIXED;

    const jobData = job.data as any;
    if (jobData?.retryDelays && Array.isArray(jobData.retryDelays)) {
      return RetryStrategyType.CUSTOM;
    }

    return RetryStrategyType.FIXED;
  }

  /**
   * 将完整错误消息截取为摘要，用作分组键
   * @param errorMessage - 完整错误消息
   * @param maxLength - 摘要最大长度，默认 120
   * @returns 截取后的错误摘要字符串
   */
  private summarizeError(errorMessage: string, maxLength: number = 120): string {
    const firstLine = errorMessage.split('\n')[0];
    if (firstLine.length <= maxLength) return firstLine;
    return firstLine.substring(0, maxLength) + '...';
  }
}
