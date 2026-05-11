import { Injectable } from '@nestjs/common';
import { ErrorClassification } from './types';
import { errorClassificationRules, unknownErrorMaxRetries } from '../../config/error-classifier.config';

/**
 * 错误分类器服务
 * 负责将错误分类为 TRANSIENT（可重试）、PERMANENT（不可重试）或 UNKNOWN（未知）
 */
@Injectable()
export class ErrorClassifierService {
  private readonly rules = errorClassificationRules;
  private readonly maxUnknownRetries = unknownErrorMaxRetries;

  /**
   * 对错误进行分类
   * @param error - 需要分类的错误对象
   * @returns 错误分类结果
   */
  classify(error: unknown): ErrorClassification {
    if (error instanceof Error) {
      return this.classifyError(error);
    }

    return ErrorClassification.UNKNOWN;
  }

  /**
   * 对 Error 对象进行分类
   * @param error - Error 实例
   * @returns 错误分类结果
   */
  private classifyError(error: Error): ErrorClassification {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name;
    const errorCode = (error as any).code;
    const statusCode = (error as any).statusCode || (error as any).status;

    for (const rule of this.rules) {
      if (this.matchesRule(error, rule, errorMessage, errorName, errorCode, statusCode)) {
        return rule.classification as ErrorClassification;
      }
    }

    return ErrorClassification.UNKNOWN;
  }

  /**
   * 检查错误是否匹配某条分类规则
   * @param error - 错误对象
   * @param rule - 分类规则
   * @param errorMessage - 错误消息（小写）
   * @param errorName - 错误名称
   * @param errorCode - 错误代码
   * @param statusCode - HTTP 状态码
   * @returns 是否匹配
   */
  private matchesRule(
    error: Error,
    rule: any,
    errorMessage: string,
    errorName: string,
    errorCode: string | undefined,
    statusCode: number | undefined,
  ): boolean {
    if (rule.messagePatterns) {
      for (const pattern of rule.messagePatterns) {
        if (errorMessage.includes(pattern.toLowerCase())) {
          return true;
        }
      }
    }

    if (rule.namePatterns) {
      for (const pattern of rule.namePatterns) {
        if (errorName.toLowerCase().includes(pattern.toLowerCase())) {
          return true;
        }
      }
    }

    if (rule.errorCodes && errorCode) {
      if (rule.errorCodes.includes(errorCode)) {
        return true;
      }
    }

    if (rule.httpStatusCodes && statusCode) {
      if (rule.httpStatusCodes.includes(statusCode)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 获取未知错误的最大重试次数
   * @returns 最大重试次数
   */
  getMaxUnknownRetries(): number {
    return this.maxUnknownRetries;
  }

  /**
   * 判断错误是否应该重试
   * @param error - 错误对象
   * @param attemptCount - 当前重试次数
   * @returns 是否应该重试
   */
  shouldRetry(error: unknown, attemptCount: number): boolean {
    const classification = this.classify(error);

    switch (classification) {
      case ErrorClassification.TRANSIENT:
        return true;
      case ErrorClassification.PERMANENT:
        return false;
      case ErrorClassification.UNKNOWN:
        return attemptCount < this.maxUnknownRetries;
      default:
        return false;
    }
  }

  /**
   * 从错误消息中提取错误类型标识符
   * @param error - 错误对象
   * @returns 错误类型标识符
   */
  getErrorType(error: unknown): string {
    if (error instanceof Error) {
      return error.name || 'UnknownError';
    }
    if (typeof error === 'string') {
      return 'StringError';
    }
    return 'UnknownError';
  }
}
