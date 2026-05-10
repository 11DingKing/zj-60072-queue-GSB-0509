import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RetryStrategy, RetryStats, ErrorDistribution, ErrorCategory } from './types';
import { ErrorClassifier } from './error-classifier.service';

/**
 * 重试策略控制器
 * 提供统计接口，用于监控重试策略的执行情况
 */
@Controller('retry-policy')
export class RetryPolicyController {
  constructor(
    private prisma: PrismaService,
    private errorClassifier: ErrorClassifier,
  ) {}

  /**
   * 获取重试统计数据
   * 按策略类型聚合重试次数和成功率
   *
   * @returns 各策略类型的重试统计数据
   */
  @Get('stats')
  async getRetryStats(): Promise<RetryStats[]> {
    const jobLogs = await this.prisma.jobLog.findMany({
      where: {
        retryCount: {
          gt: 0,
        },
      },
      include: {
        job: {
          include: {
            queue: true,
          },
        },
      },
    });

    const statsMap = new Map<RetryStrategy, { total: number; success: number; failure: number }>();

    for (const log of jobLogs) {
      const strategy = this.extractRetryStrategy(log.job);

      if (!statsMap.has(strategy)) {
        statsMap.set(strategy, { total: 0, success: 0, failure: 0 });
      }

      const stats = statsMap.get(strategy)!;
      stats.total += log.retryCount;

      if (log.status === 'COMPLETED') {
        stats.success += log.retryCount;
      } else if (log.status === 'FAILED') {
        stats.failure += log.retryCount;
      }
    }

    const result: RetryStats[] = [];

    for (const [strategy, data] of statsMap.entries()) {
      result.push({
        strategy,
        totalRetries: data.total,
        successCount: data.success,
        failureCount: data.failure,
        successRate: data.total > 0 ? Math.round((data.success / data.total) * 100) / 100 : 0,
      });
    }

    return result;
  }

  /**
   * 获取近 24 小时错误分布
   * 按小时聚合不同类型错误的数量
   *
   * @returns 近 24 小时的错误分布数据
   */
  @Get('errors')
  async getErrorDistribution(): Promise<ErrorDistribution[]> {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const errorLogs = await this.prisma.jobLog.findMany({
      where: {
        status: 'FAILED',
        error: {
          not: null,
        },
        createdAt: {
          gte: twentyFourHoursAgo,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const distributionMap = new Map<string, ErrorDistribution>();

    for (const log of errorLogs) {
      const hourKey = this.formatHourKey(log.createdAt);

      if (!distributionMap.has(hourKey)) {
        distributionMap.set(hourKey, {
          time: hourKey,
          transient: 0,
          permanent: 0,
          unknown: 0,
        });
      }

      const dist = distributionMap.get(hourKey)!;
      const category = this.classifyError(log.error || '');

      switch (category) {
        case ErrorCategory.TRANSIENT:
          dist.transient++;
          break;
        case ErrorCategory.PERMANENT:
          dist.permanent++;
          break;
        case ErrorCategory.UNKNOWN:
          dist.unknown++;
          break;
      }
    }

    return Array.from(distributionMap.values());
  }

  /**
   * 从作业中提取重试策略类型
   *
   * @param job - 作业对象
   * @returns 重试策略类型
   */
  private extractRetryStrategy(job: any): RetryStrategy {
    try {
      const data = job.data as any;
      if (data && data.retryStrategy) {
        return data.retryStrategy as RetryStrategy;
      }
    } catch {
      // ignore
    }

    return RetryStrategy.FIXED;
  }

  /**
   * 格式化时间为小时粒度的键
   *
   * @param date - 日期对象
   * @returns 格式化的时间字符串，如 "2024-01-15 14:00"
   */
  private formatHourKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:00`;
  }

  /**
   * 分类错误消息
   *
   * @param errorMessage - 错误消息
   * @returns 错误分类
   */
  private classifyError(errorMessage: string): ErrorCategory {
    const result = this.errorClassifier.classify(new Error(errorMessage));
    return result.category;
  }
}
