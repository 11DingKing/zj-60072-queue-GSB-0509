import { Injectable } from '@nestjs/common';
import { ErrorCategory, ErrorClassificationResult } from './types';
import { ErrorClassifierConfig } from '../../config/error-classifier.config';

/**
 * 错误分类器服务
 * 负责将各种错误分类为 TRANSIENT、PERMANENT 或 UNKNOWN
 * 并决定是否应该重试以及最大重试次数
 */
@Injectable()
export class ErrorClassifier {
  /**
   * 分类一个错误
   * 根据错误消息和类型判断错误属于哪一类
   *
   * @param error - 要分类的错误对象
   * @returns 错误分类结果，包含分类类型、是否重试和最大重试次数
   */
  classify(error: unknown): ErrorClassificationResult {
    const errorMessage = this.extractErrorMessage(error);

    if (this.isTransientError(errorMessage)) {
      return {
        category: ErrorCategory.TRANSIENT,
        shouldRetry: true,
        maxRetries: Infinity,
      };
    }

    if (this.isPermanentError(errorMessage)) {
      return {
        category: ErrorCategory.PERMANENT,
        shouldRetry: false,
        maxRetries: 0,
      };
    }

    return {
      category: ErrorCategory.UNKNOWN,
      shouldRetry: true,
      maxRetries: ErrorClassifierConfig.unknownErrorMaxRetries,
    };
  }

  /**
   * 判断是否为临时错误
   * 临时错误通常是网络问题、超时、数据库锁等，重试可能成功
   *
   * @param errorMessage - 错误消息
   * @returns 如果是临时错误返回 true，否则返回 false
   */
  private isTransientError(errorMessage: string): boolean {
    return ErrorClassifierConfig.transientPatterns.some((pattern) =>
      pattern.test(errorMessage),
    );
  }

  /**
   * 判断是否为永久错误
   * 永久错误通常是业务逻辑错误、参数非法等，重试也不会成功
   *
   * @param errorMessage - 错误消息
   * @returns 如果是永久错误返回 true，否则返回 false
   */
  private isPermanentError(errorMessage: string): boolean {
    return ErrorClassifierConfig.permanentPatterns.some((pattern) =>
      pattern.test(errorMessage),
    );
  }

  /**
   * 从错误对象中提取错误消息
   * 处理各种类型的错误输入
   *
   * @param error - 错误对象，可以是 Error、字符串或其他类型
   * @returns 提取的错误消息字符串
   */
  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return `${error.name}: ${error.message}`;
    }

    if (typeof error === 'string') {
      return error;
    }

    if (typeof error === 'object' && error !== null) {
      try {
        return JSON.stringify(error);
      } catch {
        return String(error);
      }
    }

    return String(error);
  }
}
