/**
 * 重试策略类型定义
 */

/**
 * 重试策略枚举
 * FIXED: 固定间隔重试
 * EXPONENTIAL: 指数退避重试
 * LINEAR: 线性增长重试
 * CUSTOM: 自定义延迟数组
 */
export enum RetryStrategy {
  FIXED = 'FIXED',
  EXPONENTIAL = 'EXPONENTIAL',
  LINEAR = 'LINEAR',
  CUSTOM = 'CUSTOM',
}

/**
 * 重试策略配置选项
 */
export interface RetryPolicyOptions {
  /**
   * 重试策略类型
   * @default RetryStrategy.FIXED
   */
  strategy?: RetryStrategy;

  /**
   * 基础延迟时间（毫秒）
   * @default 1000
   */
  baseDelay?: number;

  /**
   * 最大延迟时间（毫秒）
   * 仅用于 EXPONENTIAL 策略，防止延迟过长
   * @default 300000 (5分钟)
   */
  maxDelay?: number;

  /**
   * 自定义延迟数组
   * 仅用于 CUSTOM 策略，按下标依次取延迟值
   * @example [1000, 5000, 30000]
   */
  retryDelays?: number[];

  /**
   * 最大重试次数
   * @default 3
   */
  maxRetries?: number;
}

/**
 * 错误分类枚举
 * TRANSIENT: 可重试错误
 * PERMANENT: 不可重试错误
 * UNKNOWN: 未知错误
 */
export enum ErrorCategory {
  TRANSIENT = 'TRANSIENT',
  PERMANENT = 'PERMANENT',
  UNKNOWN = 'UNKNOWN',
}

/**
 * 错误分类结果
 */
export interface ErrorClassificationResult {
  /**
   * 错误分类
   */
  category: ErrorCategory;

  /**
   * 是否应该重试
   */
  shouldRetry: boolean;

  /**
   * 最大允许重试次数
   */
  maxRetries: number;
}

/**
 * 重试统计数据
 */
export interface RetryStats {
  /**
   * 策略类型
   */
  strategy: RetryStrategy;

  /**
   * 总重试次数
   */
  totalRetries: number;

  /**
   * 成功次数
   */
  successCount: number;

  /**
   * 失败次数
   */
  failureCount: number;

  /**
   * 成功率（百分比）
   */
  successRate: number;
}

/**
 * 错误分布数据
 */
export interface ErrorDistribution {
  /**
   * 时间点
   */
  time: string;

  /**
   * 临时错误数量
   */
  transient: number;

  /**
   * 永久错误数量
   */
  permanent: number;

  /**
   * 未知错误数量
   */
  unknown: number;
}

/**
 * BullMQ 作业选项扩展
 * 用于在 job.opts 中存储重试策略配置
 */
export interface BullmqJobOptions {
  /**
   * 重试策略
   */
  retryStrategy?: RetryStrategy;

  /**
   * 其他选项
   */
  [key: string]: any;
}

/**
 * BullMQ 作业数据扩展
 * 用于在 job.data 中存储重试相关数据
 */
export interface BullmqJobData {
  /**
   * 自定义重试延迟数组
   */
  retryDelays?: number[];

  /**
   * 其他数据
   */
  [key: string]: any;
}
