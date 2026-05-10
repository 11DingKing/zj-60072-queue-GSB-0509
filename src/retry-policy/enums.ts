/**
 * @module retry-policy/enums
 * @description 重试策略模块使用的枚举类型定义
 */

/**
 * 重试策略类型枚举，通过 job.opts.retryStrategy 字段选择策略
 */
export enum RetryStrategyType {
  /** 固定间隔重试：每次重试延迟相同 */
  FIXED = 'FIXED',
  /** 指数退避重试：延迟按 baseDelay * 2^attempt 增长，最大 5 分钟封顶 */
  EXPONENTIAL = 'EXPONENTIAL',
  /** 线性增长重试：延迟按 baseDelay * attempt 增长 */
  LINEAR = 'LINEAR',
  /** 自定义重试：从 job.data.retryDelays 数组按下标取延迟值 */
  CUSTOM = 'CUSTOM',
}
