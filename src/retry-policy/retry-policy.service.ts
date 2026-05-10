import { Injectable, Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  RetryStrategy,
  RetryPolicyOptions,
  BullmqJobOptions,
  BullmqJobData,
} from './types';

/**
 * 默认重试策略配置
 */
const DEFAULT_POLICY: Required<RetryPolicyOptions> = {
  strategy: RetryStrategy.FIXED,
  baseDelay: 1000,
  maxDelay: 5 * 60 * 1000,
  retryDelays: [],
  maxRetries: 3,
};

/**
 * 重试策略服务
 * 核心服务，负责根据作业配置和错误类型计算下次重试的延迟时间
 * 支持 4 种策略：FIXED、EXPONENTIAL、LINEAR、CUSTOM
 */
@Injectable()
export class RetryPolicyService {
  /**
   * 计算下次重试的延迟时间（毫秒）
   * 根据 job.opts.retryStrategy 选择不同的重试策略
   *
   * @param job - BullMQ 作业对象
   * @param error - 导致失败的错误对象
   * @param attemptCount - 当前重试次数（从 1 开始）
   * @returns 下次重试的延迟时间（毫秒），返回 -1 表示不应重试
   */
  calculateNextDelay(
    job: Job,
    error: unknown,
    attemptCount: number,
  ): number {
    const options = this.extractOptions(job);
    const strategy = options.strategy || DEFAULT_POLICY.strategy;

    switch (strategy) {
      case RetryStrategy.FIXED:
        return this.calculateFixedDelay(options);
      case RetryStrategy.EXPONENTIAL:
        return this.calculateExponentialDelay(options, attemptCount);
      case RetryStrategy.LINEAR:
        return this.calculateLinearDelay(options, attemptCount);
      case RetryStrategy.CUSTOM:
        return this.calculateCustomDelay(options, attemptCount);
      default:
        return this.calculateFixedDelay(options);
    }
  }

  /**
   * 从 BullMQ 作业中提取重试策略配置
   * 优先从 job.opts 获取，其次从 job.data 获取
   *
   * @param job - BullMQ 作业对象
   * @returns 重试策略配置选项
   */
  private extractOptions(job: Job): RetryPolicyOptions {
    const opts = (job.opts as BullmqJobOptions) || {};
    const data = (job.data as BullmqJobData) || {};

    return {
      strategy: opts.retryStrategy,
      baseDelay: job.opts?.delay || DEFAULT_POLICY.baseDelay,
      maxDelay: DEFAULT_POLICY.maxDelay,
      retryDelays: data.retryDelays,
      maxRetries: DEFAULT_POLICY.maxRetries,
    };
  }

  /**
   * 计算固定间隔重试延迟
   * 每次重试使用相同的延迟时间
   *
   * @param options - 重试策略配置
   * @returns 延迟时间（毫秒）
   */
  private calculateFixedDelay(options: RetryPolicyOptions): number {
    return options.baseDelay || DEFAULT_POLICY.baseDelay;
  }

  /**
   * 计算指数退避重试延迟
   * 公式：baseDelay * 2^attempt，最大不超过 maxDelay
   *
   * @param options - 重试策略配置
   * @param attemptCount - 当前重试次数（从 1 开始）
   * @returns 延迟时间（毫秒）
   */
  private calculateExponentialDelay(
    options: RetryPolicyOptions,
    attemptCount: number,
  ): number {
    const baseDelay = options.baseDelay || DEFAULT_POLICY.baseDelay;
    const maxDelay = options.maxDelay || DEFAULT_POLICY.maxDelay;
    const delay = baseDelay * Math.pow(2, attemptCount);
    return Math.min(delay, maxDelay);
  }

  /**
   * 计算线性增长重试延迟
   * 公式：baseDelay * attempt
   *
   * @param options - 重试策略配置
   * @param attemptCount - 当前重试次数（从 1 开始）
   * @returns 延迟时间（毫秒）
   */
  private calculateLinearDelay(
    options: RetryPolicyOptions,
    attemptCount: number,
  ): number {
    const baseDelay = options.baseDelay || DEFAULT_POLICY.baseDelay;
    return baseDelay * attemptCount;
  }

  /**
   * 计算自定义重试延迟
   * 从 retryDelays 数组中按下标取延迟值
   * 如果数组长度不足，使用最后一个值
   *
   * @param options - 重试策略配置
   * @param attemptCount - 当前重试次数（从 1 开始）
   * @returns 延迟时间（毫秒）
   */
  private calculateCustomDelay(
    options: RetryPolicyOptions,
    attemptCount: number,
  ): number {
    const retryDelays = options.retryDelays || [];

    if (retryDelays.length === 0) {
      return this.calculateFixedDelay(options);
    }

    const index = Math.min(attemptCount - 1, retryDelays.length - 1);
    return retryDelays[index];
  }
}
