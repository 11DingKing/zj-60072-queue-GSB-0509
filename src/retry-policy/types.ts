/**
 * 重试策略类型
 */
export enum RetryStrategyType {
  /** 固定间隔重试 */
  FIXED = 'FIXED',
  /** 指数退避重试 */
  EXPONENTIAL = 'EXPONENTIAL',
  /** 线性增长重试 */
  LINEAR = 'LINEAR',
  /** 自定义延迟数组 */
  CUSTOM = 'CUSTOM',
}

/**
 * 错误分类类型
 */
export enum ErrorClassification {
  /** 瞬时错误，可重试 */
  TRANSIENT = 'TRANSIENT',
  /** 永久错误，不可重试 */
  PERMANENT = 'PERMANENT',
  /** 未知错误，有限重试 */
  UNKNOWN = 'UNKNOWN',
}

/**
 * 重试策略配置
 */
export interface RetryPolicyConfig {
  /** 重试策略类型 */
  strategy: RetryStrategyType;
  /** 基础延迟（毫秒） */
  baseDelay?: number;
  /** 最大延迟（毫秒），默认 5 分钟 */
  maxDelay?: number;
  /** 自定义延迟数组（用于 CUSTOM 策略） */
  customDelays?: number[];
  /** 最大重试次数 */
  maxRetries?: number;
}

/**
 * 重试决策
 */
export interface RetryDecision {
  /** 是否应该重试 */
  shouldRetry: boolean;
  /** 下次重试延迟（毫秒） */
  delay?: number;
  /** 错误分类 */
  classification: ErrorClassification;
  /** 决策原因 */
  reason?: string;
}

/**
 * 重试统计数据
 */
export interface RetryStats {
  /** 策略类型 */
  strategy: RetryStrategyType;
  /** 总重试次数 */
  totalRetries: number;
  /** 成功次数（重试后成功） */
  successCount: number;
  /** 失败次数（重试后仍然失败） */
  failureCount: number;
  /** 成功率 */
  successRate: number;
}

/**
 * 错误分布统计
 */
export interface ErrorDistribution {
  /** 错误分类 */
  classification: ErrorClassification;
  /** 错误数量 */
  count: number;
  /** 占比 */
  percentage: number;
  /** 具体错误类型分布 */
  details: { errorType: string; count: number }[];
}

/**
 * 24小时错误分布统计
 */
export interface DailyErrorDistribution {
  /** 统计时间 */
  date: string;
  /** 总错误数 */
  totalErrors: number;
  /** 按小时分布 */
  hourlyDistribution: { hour: number; count: number }[];
  /** 按错误分类分布 */
  byClassification: ErrorDistribution[];
}
