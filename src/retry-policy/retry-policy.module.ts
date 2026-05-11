import { Module, Global } from '@nestjs/common';
import { RetryPolicyService } from './retry-policy.service';
import { ErrorClassifierService } from './error-classifier.service';
import { RetryPolicyController } from './retry-policy.controller';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * 重试策略模块
 * 全局模块，提供智能重试策略服务和错误分类服务
 */
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [RetryPolicyController],
  providers: [RetryPolicyService, ErrorClassifierService],
  exports: [RetryPolicyService, ErrorClassifierService],
})
export class RetryPolicyModule {}
