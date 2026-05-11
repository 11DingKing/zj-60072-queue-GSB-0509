import { Controller, Get } from '@nestjs/common';
import { RetryPolicyService } from './retry-policy.service';
import { RetryStats, DailyErrorDistribution } from './types';

/**
 * 重试策略控制器
 * 提供重试策略相关的统计查询接口
 */
@Controller('retry-policy')
export class RetryPolicyController {
  constructor(private readonly retryPolicyService: RetryPolicyService) {}

  /**
   * 获取按策略类型聚合的重试统计
   * 包含各策略的重试次数、成功次数、失败次数和成功率
   * @returns 各策略的统计数据
   */
  @Get('stats')
  async getRetryStats(): Promise<{
    success: boolean;
    data: RetryStats[];
  }> {
    const stats = await this.retryPolicyService.getRetryStats();
    return {
      success: true,
      data: stats,
    };
  }

  /**
   * 获取近 24 小时错误分布统计
   * 包含按小时分布、按错误分类的统计信息
   * @returns 错误分布统计
   */
  @Get('errors')
  async getErrorDistribution(): Promise<{
    success: boolean;
    data: DailyErrorDistribution;
  }> {
    const distribution = await this.retryPolicyService.getErrorDistribution();
    return {
      success: true,
      data: distribution,
    };
  }
}
