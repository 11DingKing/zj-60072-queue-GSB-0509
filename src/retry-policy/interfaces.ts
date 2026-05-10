/**
 * @module retry-policy/interfaces
 * @description 重试策略模块的接口定义
 */

import { RetryStrategyType } from './enums';
import { ErrorCategory } from '../config/error-classifier.config';

/**
 * 重试策略选项，存储在 job.opts.retryStrategy 中
 * @property strategy - 选择的策略类型
 * @property baseDelay - 基础延迟毫秒数，默认 1000
 */
export interface RetryStrategyOptions {
  strategy: RetryStrategyType;
  baseDelay?: number;
}

/**
 * 错误分类结果
 * @property category - 错误类别（TRANSIENT / PERMANENT / UNKNOWN）
 * @property maxRetries - 该类别允许的最大重试次数，PERMANENT 为 0
 * @property matchedRule - 匹配到的规则描述，用于调试
 */
export interface ErrorClassificationResult {
  category: ErrorCategory;
  maxRetries: number;
  matchedRule?: string;
}

/**
 * 重试策略统计项
 * @property strategy - 策略类型
 * @property totalRetries - 总重试次数
 * @property successCount - 重试后成功的次数
 * @property successRate - 成功率（0-1 之间的小数）
 */
export interface RetryStatsItem {
  strategy: RetryStrategyType;
  totalRetries: number;
  successCount: number;
  successRate: number;
}

/**
 * 重试统计响应
 */
export interface RetryStatsResponse {
  stats: RetryStatsItem[];
  generatedAt: Date;
}

/**
 * 错误分布项
 * @property errorType - 错误类型/消息摘要
 * @property count - 出现次数
 * @property category - 错误分类
 * @property firstOccurrence - 首次出现时间
 * @property lastOccurrence - 最近出现时间
 */
export interface ErrorDistributionItem {
  errorType: string;
  count: number;
  category: ErrorCategory;
  firstOccurrence: Date;
  lastOccurrence: Date;
}

/**
 * 错误分布响应
 */
export interface ErrorDistributionResponse {
  errors: ErrorDistributionItem[];
  period: { since: Date; until: Date };
  totalErrors: number;
}
