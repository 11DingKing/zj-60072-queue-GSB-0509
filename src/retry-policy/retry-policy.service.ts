/**
 * @module retry-policy/retry-policy.service
 * @description 重试策略核心服务，提供 calculateNextDelay 方法根据策略计算下次重试延迟。
 * 支持 4 种策略：FIXED（固定间隔）、EXPONENTIAL（指数退避）、LINEAR（线性增长）、CUSTOM（自定义数组）。
 */

import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { RetryStrategyType } from './enums';
import { RetryStrategyOptions } from './interfaces';

/** 指数退避策略的最大延迟封顶值：5 分钟（毫秒） */
const EXPONENTIAL_MAX_DELAY_MS = 5 * 60 * 1000;

/** 默认基础延迟（毫秒） */
const DEFAULT_BASE_DELAY_MS = 1000;

@Injectable()
export class RetryPolicyService {
  /**
   * 根据 job 的 retryStrategy 配置、当前错误和重试次数，计算下次重试的延迟毫秒数
   * @param job - BullMQ Job 实例，从 job.opts 读取 retryStrategy 配置
   * @param _error - 导致失败的异常对象（保留参数，供未来扩展如 jitter 等使用）
   * @param attemptCount - 当前已重试次数（从 1 开始）
   * @returns 下次重试的延迟毫秒数
   *
   * @example
   * ```ts
   * // FIXED: 始终返回 baseDelay
   * service.calculateNextDelay(job, error, 3); // => 1000
   *
   * // EXPONENTIAL: baseDelay * 2^attempt
   * service.calculateNextDelay(job, error, 3); // => 1000 * 8 = 8000
   *
   * // LINEAR: baseDelay * attempt
   * service.calculateNextDelay(job, error, 3); // => 1000 * 3 = 3000
   *
   * // CUSTOM: job.data.retryDelays[attempt - 1]
   * // retryDelays = [1000, 5000, 30000]
   * service.calculateNextDelay(job, error, 2); // => 5000
   * ```
   */
  calculateNextDelay(
    job: Job,
    _error: any,
    attemptCount: number,
  ): number {
    const opts = this.extractStrategyOptions(job);
    const baseDelay = opts.baseDelay ?? DEFAULT_BASE_DELAY_MS;

    switch (opts.strategy) {
      case RetryStrategyType.EXPONENTIAL:
        return this.calculateExponentialDelay(baseDelay, attemptCount);

      case RetryStrategyType.LINEAR:
        return this.calculateLinearDelay(baseDelay, attemptCount);

      case RetryStrategyType.CUSTOM:
        return this.calculateCustomDelay(job, attemptCount, baseDelay);

      case RetryStrategyType.FIXED:
      default:
        return this.calculateFixedDelay(baseDelay);
    }
  }

  /**
   * 从 BullMQ Job 的 opts 中提取 retryStrategy 配置
   * @param job - BullMQ Job 实例
   * @returns RetryStrategyOptions 配置对象
   */
  private extractStrategyOptions(job: Job): RetryStrategyOptions {
    const jobOpts = job.opts as any;
    const retryStrategy = jobOpts?.retryStrategy;

    if (retryStrategy && typeof retryStrategy === 'object') {
      return {
        strategy: retryStrategy.strategy || RetryStrategyType.FIXED,
        baseDelay: retryStrategy.baseDelay,
      };
    }

    return {
      strategy: RetryStrategyType.FIXED,
      baseDelay: DEFAULT_BASE_DELAY_MS,
    };
  }

  /**
   * 固定间隔策略：每次返回相同的 baseDelay
   * @param baseDelay - 基础延迟毫秒数
   * @returns 延迟毫秒数
   */
  private calculateFixedDelay(baseDelay: number): number {
    return baseDelay;
  }

  /**
   * 指数退避策略：延迟按 baseDelay * 2^attempt 增长，最大封顶 5 分钟
   * @param baseDelay - 基础延迟毫秒数
   * @param attemptCount - 当前重试次数
   * @returns 延迟毫秒数，不超过 EXPONENTIAL_MAX_DELAY_MS
   */
  private calculateExponentialDelay(
    baseDelay: number,
    attemptCount: number,
  ): number {
    const delay = baseDelay * Math.pow(2, attemptCount);
    return Math.min(delay, EXPONENTIAL_MAX_DELAY_MS);
  }

  /**
   * 线性增长策略：延迟按 baseDelay * attempt 线性增长
   * @param baseDelay - 基础延迟毫秒数
   * @param attemptCount - 当前重试次数
   * @returns 延迟毫秒数
   */
  private calculateLinearDelay(
    baseDelay: number,
    attemptCount: number,
  ): number {
    return baseDelay * attemptCount;
  }

  /**
   * 自定义策略：从 job.data.retryDelays 数组按下标取延迟值
   * 超出数组范围时回退到 baseDelay
   * @param job - BullMQ Job 实例，从 job.data.retryDelays 取自定义延迟数组
   * @param attemptCount - 当前重试次数
   * @param baseDelay - 基础延迟毫秒数，作为超出数组范围时的回退值
   * @returns 延迟毫秒数
   */
  private calculateCustomDelay(
    job: Job,
    attemptCount: number,
    baseDelay: number,
  ): number {
    const retryDelays = job.data?.retryDelays;
    if (Array.isArray(retryDelays) && retryDelays.length > 0) {
      const index = attemptCount - 1;
      if (index >= 0 && index < retryDelays.length) {
        return Number(retryDelays[index]) || baseDelay;
      }
    }
    return baseDelay;
  }
}
