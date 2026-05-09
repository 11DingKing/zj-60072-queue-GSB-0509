import { IsOptional, IsInt, Min, Max, IsBoolean, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateQueueDto {
  @ApiPropertyOptional({ description: '队列描述', example: '发送邮件的任务队列' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '并发数', example: 5, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  concurrency?: number;

  @ApiPropertyOptional({ description: '最大重试次数', example: 3, minimum: 0, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  maxRetries?: number;

  @ApiPropertyOptional({ description: '重试延迟时间(毫秒)', example: 1000, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  retryDelay?: number;

  @ApiPropertyOptional({ description: '超时时间(毫秒)', example: 30000, minimum: 1000 })
  @IsOptional()
  @IsInt()
  @Min(1000)
  timeout?: number;

  @ApiPropertyOptional({ description: '是否暂停', example: false })
  @IsOptional()
  @IsBoolean()
  isPaused?: boolean;
}
