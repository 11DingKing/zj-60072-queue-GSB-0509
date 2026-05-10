/**
 * 错误分类配置文件
 * 定义了如何根据错误类型和消息内容将错误分类为不同的类型
 */

/**
 * 错误分类枚举
 * TRANSIENT: 可重试错误 - 通常是临时性问题，重试可能成功
 * PERMANENT: 不可重试错误 - 业务逻辑错误，重试也不会成功
 * UNKNOWN: 未知错误 - 谨慎重试，最多2次
 */
export enum ErrorCategory {
  TRANSIENT = 'TRANSIENT',
  PERMANENT = 'PERMANENT',
  UNKNOWN = 'UNKNOWN',
}

/**
 * 临时错误关键字列表
 * 包含网络错误、数据库锁、Redis连接等临时性错误
 */
export const TRANSIENT_ERROR_PATTERNS: RegExp[] = [
  /network/i,
  /timeout/i,
  /connection/i,
  /econnrefused/i,
  /econnreset/i,
  /etimedout/i,
  /ehostunreach/i,
  /enotfound/i,
  /socket.*hang/i,
  /socket.*closed/i,
  /deadlock/i,
  /lock.*timeout/i,
  /database.*lock/i,
  /serialization.*failure/i,
  /could not connect/i,
  /redis/i,
  /redis.*connection/i,
  /redis.*timeout/i,
  /redis.*closed/i,
  /service.*unavailable/i,
  /5\d{2}/,
  /gateway.*timeout/i,
  /bad.*gateway/i,
  /temporarily.*unavailable/i,
  /rate.*limit/i,
  /too.*many.*requests/i,
  /429/,
  /request.*aborted/i,
  /stream.*ended/i,
  /read.*econnreset/i,
];

/**
 * 永久错误关键字列表
 * 包含业务错误、参数非法、权限问题等不可重试的错误
 */
export const PERMANENT_ERROR_PATTERNS: RegExp[] = [
  /4\d{2}/,
  /bad.*request/i,
  /unauthorized/i,
  /forbidden/i,
  /not.*found/i,
  /404/,
  /invalid/i,
  /validation/i,
  /parameter/i,
  /argument/i,
  /must.*be/i,
  /required/i,
  /missing/i,
  /duplicate/i,
  /unique.*constraint/i,
  /already.*exists/i,
  /cannot.*be.*null/i,
  /not.*null.*constraint/i,
  /foreign.*key.*constraint/i,
  /data.*too.*long/i,
  /out.*of.*range/i,
  /type.*mismatch/i,
  /syntax.*error/i,
  /parsing.*error/i,
  /json.*parse/i,
  /unauthorized/i,
  /permission.*denied/i,
  /access.*denied/i,
  /no.*permission/i,
  /not.*allowed/i,
  /expired/i,
  /token.*expired/i,
  /invalid.*token/i,
];

/**
 * 错误分类配置
 * 包含所有用于错误分类的规则
 */
export const ErrorClassifierConfig = {
  /**
   * 临时错误模式列表
   */
  transientPatterns: TRANSIENT_ERROR_PATTERNS,

  /**
   * 永久错误模式列表
   */
  permanentPatterns: PERMANENT_ERROR_PATTERNS,

  /**
   * 未知错误最大重试次数
   */
  unknownErrorMaxRetries: 2,
};
