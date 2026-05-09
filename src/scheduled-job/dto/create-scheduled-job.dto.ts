import { IsString, IsOptional, IsInt, Min, IsObject, IsBoolean, Validate } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IsCronExpression {
  validate(value: string): boolean {
    const cronRegex = /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/[0-9]+) (\*|([0-9]|1[0-9]|2[0-3])|\*\/[0-9]+) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/[0-9]+) (\*|([1-9]|1[0-2])|\*\/[0-9]+) (\*|[0-6]|\*\/[0-9]+)$/;
    return cronRegex.test(value);
  }
}

export class CreateScheduledJobDto {
  @ApiProperty({ description: '定时任务名称', example: 'daily-report' })
  @IsString()
  name: string;

  @ApiProperty({ description: '队列ID', example: 'clx1abc123...' })
  @IsString()
  queueId: string;

  @ApiProperty({ description: '任务数据', example: { reportType: 'daily', recipients: ['admin@example.com'] } })
  @IsObject()
  data: Record<string, any>;

  @ApiPropertyOptional({ description: 'Cron 表达式 (用于重复任务)', example: '0 9 * * *' })
  @IsOptional()
  @IsString()
  cron?: string;

  @ApiPropertyOptional({ description: '延迟执行时间(毫秒，用于一次性延迟任务)', example: 3600000, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  delay?: number;

  @ApiPropertyOptional({ description: '是否为重复任务', example: false })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;
}
