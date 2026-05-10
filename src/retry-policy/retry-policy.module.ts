import { Module, Global } from '@nestjs/common';
import { RetryPolicyService } from './retry-policy.service';
import { ErrorClassifier } from './error-classifier.service';
import { RetryPolicyController } from './retry-policy.controller';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * 重试策略模块
 * 全局模块，提供智能重试策略服务
 * 包含错误分类器和重试策略配置
 */
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [RetryPolicyController],
  providers: [RetryPolicyService, ErrorClassifier],
  exports: [RetryPolicyService, ErrorClassifier],
})
export class RetryPolicyModule {}
