import { IsString, IsOptional, IsInt, Min, Max, IsObject, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateJobDto {
  @ApiProperty({ description: '任务名称', example: 'send-welcome-email' })
  @IsString()
  name: string;

  @ApiProperty({ description: '队列ID', example: 'clx1abc123...' })
  @IsString()
  queueId: string;

  @ApiProperty({ description: '任务数据', example: { email: 'user@example.com', template: 'welcome' } })
  @IsObject()
  data: Record<string, any>;

  @ApiPropertyOptional({ description: '任务优先级 (1-10，默认5，越高越优先)', example: 5, minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  priority?: number;

  @ApiPropertyOptional({ description: '延迟执行时间(毫秒)', example: 5000, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  delay?: number;

  @ApiPropertyOptional({ description: '父任务ID (用于任务依赖)', example: 'clx1def456...' })
  @IsOptional()
  @IsString()
  parentJobId?: string;
}

export class BatchCreateJobDto {
  @ApiProperty({ description: '任务列表', type: [CreateJobDto] })
  @ValidateNested({ each: true })
  @Type(() => CreateJobDto)
  jobs: CreateJobDto[];
}

export class BatchJobIdsDto {
  @ApiProperty({ description: '任务ID列表', example: ['clx1abc123...', 'clx1def456...'] })
  jobIds: string[];
}
