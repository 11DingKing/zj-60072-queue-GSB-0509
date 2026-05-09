import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { MonitorService } from './monitor.service';

@ApiTags('monitor')
@Controller('monitor')
export class MonitorController {
  constructor(private readonly monitorService: MonitorService) {}

  @Get('overview')
  @ApiOperation({ summary: '获取系统概览' })
  @ApiResponse({ status: 200, description: '返回系统概览信息' })
  getSystemOverview() {
    return this.monitorService.getSystemOverview();
  }

  @Get('queues-stats')
  @ApiOperation({ summary: '获取所有队列统计信息' })
  @ApiResponse({ status: 200, description: '返回所有队列统计信息' })
  getAllQueuesStats() {
    return this.monitorService.getAllQueuesStats();
  }

  @Get('recent-activity')
  @ApiOperation({ summary: '获取最近活动' })
  @ApiQuery({ name: 'limit', description: '返回数量限制', required: false, example: 20 })
  @ApiResponse({ status: 200, description: '返回最近的任务和日志活动' })
  getRecentActivity(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.monitorService.getRecentActivity(limitNum);
  }
}
