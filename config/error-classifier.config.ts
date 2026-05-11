/**
 * 错误分类器配置
 * 定义各种错误类型的分类规则，用于判断错误是否可重试
 */

export interface ErrorClassificationRule {
  /** 规则名称 */
  name: string;
  /** 错误分类 */
  classification: 'TRANSIENT' | 'PERMANENT' | 'UNKNOWN';
  /** 匹配规则 - 错误消息包含的关键字（不区分大小写） */
  messagePatterns?: string[];
  /** 匹配规则 - 错误名称包含的关键字 */
  namePatterns?: string[];
  /** 匹配规则 - HTTP 状态码范围 */
  httpStatusCodes?: number[];
  /** 匹配规则 - 错误代码 */
  errorCodes?: string[];
}

export const errorClassificationRules: ErrorClassificationRule[] = [
  {
    name: 'Network Errors',
    classification: 'TRANSIENT',
    messagePatterns: [
      'network',
      'connection refused',
      'timeout',
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED',
      'EHOSTUNREACH',
      'ENETUNREACH',
      'socket hang up',
      'dns',
      'getaddrinfo',
    ],
    namePatterns: ['NetworkError', 'FetchError', 'RequestError'],
  },
  {
    name: 'Database Lock Errors',
    classification: 'TRANSIENT',
    messagePatterns: [
      'deadlock',
      'lock wait timeout',
      'could not serialize access',
      'concurrency',
      'row lock',
      'table lock',
    ],
    errorCodes: ['40P01', '55P03', '55P01'],
  },
  {
    name: 'Redis Connection Errors',
    classification: 'TRANSIENT',
    messagePatterns: [
      'redis',
      'connection closed',
      'connection lost',
      'max number of clients',
      'cluster',
    ],
    namePatterns: ['RedisError', 'ConnectionError'],
  },
  {
    name: 'Rate Limiting Errors',
    classification: 'TRANSIENT',
    messagePatterns: ['rate limit', 'too many requests', '429'],
    httpStatusCodes: [429],
  },
  {
    name: 'Service Unavailable',
    classification: 'TRANSIENT',
    messagePatterns: ['service unavailable', '503', '502', '504'],
    httpStatusCodes: [502, 503, 504],
  },
  {
    name: 'Bad Request Errors',
    classification: 'PERMANENT',
    messagePatterns: ['bad request', 'invalid', 'malformed', '400'],
    httpStatusCodes: [400],
  },
  {
    name: 'Unauthorized Errors',
    classification: 'PERMANENT',
    messagePatterns: ['unauthorized', 'forbidden', '401', '403'],
    httpStatusCodes: [401, 403],
  },
  {
    name: 'Not Found Errors',
    classification: 'PERMANENT',
    messagePatterns: ['not found', '404', 'does not exist'],
    httpStatusCodes: [404],
  },
  {
    name: 'Validation Errors',
    classification: 'PERMANENT',
    namePatterns: ['ValidationError', 'ZodError', 'YupError'],
    messagePatterns: ['validation failed', 'required', 'must be'],
  },
  {
    name: 'Business Logic Errors',
    classification: 'PERMANENT',
    messagePatterns: [
      'cannot',
      'not allowed',
      'permission denied',
      'business rule',
      'duplicate',
      'unique constraint',
    ],
    errorCodes: ['23505'],
  },
];

export const unknownErrorMaxRetries = 2;

export default {
  rules: errorClassificationRules,
  unknownErrorMaxRetries,
};
