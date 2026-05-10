/**
 * @module retry-policy/retry-policy.module
 * @description 重试策略模块，提供智能重试策略、错误分类和统计接口。
 * 注册为全局模块，使得 RetryPolicyService 和 ErrorClassifier 在整个应用中可用。
 */

import { Global, Module } from '@nestjs/common';
import { RetryPolicyService } from './retry-policy.service';
import { ErrorClassifier } from './error-classifier';
import { RetryPolicyController } from './retry-policy.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [RetryPolicyController],
  providers: [RetryPolicyService, ErrorClassifier],
  exports: [RetryPolicyService, ErrorClassifier],
})
export class RetryPolicyModule {}
