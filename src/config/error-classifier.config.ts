/**
 * @module config/error-classifier.config
 * @description 错误分类器配置文件，定义 TRANSIENT（可重试）、PERMANENT（不重试）、UNKNOWN（有限重试）
 * 三种错误类别的匹配规则。通过正则表达式匹配错误消息或错误类名。
 */

/**
 * 错误类别枚举
 */
export enum ErrorCategory {
  /** 可重试的瞬态错误，如网络中断、数据库锁、Redis 连接丢失等 */
  TRANSIENT = 'TRANSIENT',
  /** 不可重试的永久性错误，如参数非法、业务规则违反（400 类）等 */
  PERMANENT = 'PERMANENT',
  /** 未识别的错误类型，允许有限次重试（最多 2 次） */
  UNKNOWN = 'UNKNOWN',
}

/**
 * 单条分类规则定义
 * @property pattern - 正则表达式，用于匹配 error.message
 * @property classNamePattern - 正则表达式，用于匹配 error.constructor.name 或 error.name
 * @property category - 匹配成功时返回的错误类别
 */
export interface ErrorClassifyRule {
  pattern?: RegExp;
  classNamePattern?: RegExp;
  category: ErrorCategory;
}

/**
 * 错误分类规则列表，按优先级从高到低排列，首次匹配即返回
 */
export const ERROR_CLASSIFIER_RULES: ErrorClassifyRule[] = [
  // ===== PERMANENT：不可重试的业务错误 =====
  {
    classNamePattern: /BadRequestException|ValidationError|InvalidArgumentException/i,
    category: ErrorCategory.PERMANENT,
  },
  {
    pattern: /invalid\s+parameter|参数非法|参数错误/i,
    category: ErrorCategory.PERMANENT,
  },
  {
    pattern: /400\s*\(Bad Request\)|HTTP\/.*\s400/i,
    category: ErrorCategory.PERMANENT,
  },
  {
    pattern: /permission\s*denied|权限不足|Forbidden|403/i,
    category: ErrorCategory.PERMANENT,
  },
  {
    pattern: /not\s*found|资源不存在|404/i,
    category: ErrorCategory.PERMANENT,
  },
  {
    pattern: /conflict|数据冲突|409/i,
    category: ErrorCategory.PERMANENT,
  },
  {
    pattern: /unprocessable\s*entity|422/i,
    category: ErrorCategory.PERMANENT,
  },
  {
    classNamePattern: /UnauthorizedException/i,
    category: ErrorCategory.PERMANENT,
  },
  {
    pattern: /authentication\s*failed|认证失败|401/i,
    category: ErrorCategory.PERMANENT,
  },
  {
    pattern: /business\s*rule|业务规则/i,
    category: ErrorCategory.PERMANENT,
  },
  {
    pattern: /duplicate\s*key|唯一约束|unique\s*constraint/i,
    category: ErrorCategory.PERMANENT,
  },

  // ===== TRANSIENT：可重试的瞬态错误 =====
  {
    pattern: /ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EHOSTUNREACH|EPIPE/i,
    category: ErrorCategory.TRANSIENT,
  },
  {
    pattern: /network\s*error|网络错误|连接超时|connection\s*timed?\s*out/i,
    category: ErrorCategory.TRANSIENT,
  },
  {
    pattern: /socket\s*hang\s*up|socket\s*disconnect|连接被重置/i,
    category: ErrorCategory.TRANSIENT,
  },
  {
    pattern: /service\s*unavailable|503|服务不可用/i,
    category: ErrorCategory.TRANSIENT,
  },
  {
    pattern: /bad\s*gateway|502|网关错误/i,
    category: ErrorCategory.TRANSIENT,
  },
  {
    pattern: /gateway\s*timeout|504|网关超时/i,
    category: ErrorCategory.TRANSIENT,
  },
  {
    pattern: /too\s*many\s*requests|429|限流|rate\s*limit/i,
    category: ErrorCategory.TRANSIENT,
  },
  {
    pattern: /database\s*lock|deadlock|死锁|锁等待超时|lock\s*timeout/i,
    category: ErrorCategory.TRANSIENT,
  },
  {
    pattern: /P2034|P2024/i,
    category: ErrorCategory.TRANSIENT,
  },
  {
    pattern: /redis\s*connection|Redis.*disconnect|Redis.*ECONNREFUSED/i,
    category: ErrorCategory.TRANSIENT,
  },
  {
    pattern: /ioredis.*error|MAXREDIS.*retries/i,
    category: ErrorCategory.TRANSIENT,
  },
  {
    pattern: /timeout|超时/i,
    category: ErrorCategory.TRANSIENT,
  },
  {
    classNamePattern: /PrismaClientInitializationError/i,
    category: ErrorCategory.TRANSIENT,
  },
  {
    classNamePattern: /PrismaClientRustPanicError/i,
    category: ErrorCategory.TRANSIENT,
  },
];

/**
 * UNKNOWN 类别的最大重试次数
 */
export const UNKNOWN_MAX_RETRIES = 2;
