/**
 * @module retry-policy/error-classifier
 * @description 异常分类器服务，将错误分为 TRANSIENT（可重试）、PERMANENT（不重试）、UNKNOWN（有限重试）三类。
 * 分类规则通过 config/error-classifier.config.ts 声明。
 */

import { Injectable } from '@nestjs/common';
import {
  ErrorCategory,
  ERROR_CLASSIFIER_RULES,
  UNKNOWN_MAX_RETRIES,
} from '../config/error-classifier.config';
import { ErrorClassificationResult } from './interfaces';

@Injectable()
export class ErrorClassifier {
  /**
   * 对错误进行分类，返回分类结果及允许的最大重试次数
   * @param error - 捕获到的异常对象
   * @returns ErrorClassificationResult 包含类别、最大重试次数和匹配规则信息
   *
   * @example
   * ```ts
   * const result = classifier.classify(new Error('ECONNREFUSED'));
   * // result.category === ErrorCategory.TRANSIENT, result.maxRetries === Infinity
   * ```
   */
  classify(error: any): ErrorClassificationResult {
    const errorMessage = this.extractErrorMessage(error);
    const errorClassName = this.extractErrorClassName(error);

    for (const rule of ERROR_CLASSIFIER_RULES) {
      const messageMatch =
        rule.pattern && errorMessage
          ? rule.pattern.test(errorMessage)
          : false;
      const classMatch =
        rule.classNamePattern && errorClassName
          ? rule.classNamePattern.test(errorClassName)
          : false;

      if (messageMatch || classMatch) {
        const matchedRule =
          (rule.pattern?.source || rule.classNamePattern?.source || 'unknown');

        return {
          category: rule.category,
          maxRetries: rule.category === ErrorCategory.PERMANENT ? 0 : Infinity,
          matchedRule,
        };
      }
    }

    return {
      category: ErrorCategory.UNKNOWN,
      maxRetries: UNKNOWN_MAX_RETRIES,
      matchedRule: 'no-match-fallback',
    };
  }

  /**
   * 从异常对象中提取错误消息字符串
   * @param error - 任意异常对象
   * @returns 错误消息字符串
   */
  private extractErrorMessage(error: any): string {
    if (!error) return '';
    if (typeof error === 'string') return error;
    if (error.message) return String(error.message);
    if (error.msg) return String(error.msg);
    return String(error);
  }

  /**
   * 从异常对象中提取类名（constructor.name 或 name 属性）
   * @param error - 任意异常对象
   * @returns 错误类名字符串
   */
  private extractErrorClassName(error: any): string {
    if (!error) return '';
    if (error.constructor?.name && error.constructor.name !== 'Object') {
      return error.constructor.name;
    }
    if (error.name) return String(error.name);
    return '';
  }

  /**
   * 判断给定的重试次数是否已超过该错误类别允许的最大值
   * @param category - 错误类别
   * @param attemptCount - 当前已重试次数
   * @returns 超过最大重试次数时返回 true
   */
  isMaxRetriesExceeded(category: ErrorCategory, attemptCount: number): boolean {
    switch (category) {
      case ErrorCategory.PERMANENT:
        return true;
      case ErrorCategory.UNKNOWN:
        return attemptCount >= UNKNOWN_MAX_RETRIES;
      case ErrorCategory.TRANSIENT:
      default:
        return false;
    }
  }
}
