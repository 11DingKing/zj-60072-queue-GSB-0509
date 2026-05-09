import { Controller, Get, Post, Param, Delete, Query, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { DeadLetterService } from './dead-letter.service';
import { BatchJobIdsDto } from '../job/dto/create-job.dto';

@ApiTags('dead-letter')
@Controller('dead-letter')
export class DeadLetterController {
  constructor(private readonly deadLetterService: DeadLetterService) {}

  @Get()
  @ApiOperation({ summary: '获取所有死信队列任务' })
  @ApiQuery({ name: 'queueId', description: '队列ID', required: false })
  @ApiResponse({ status: 200, description: '返回死信队列任务列表' })
  findAll(@Query('queueId') queueId?: string) {
    return this.deadLetterService.findAll(queueId);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取死信队列任务详情' })
  @ApiParam({ name: 'id', description: '死信任务ID' })
  @ApiResponse({ status: 200, description: '返回死信任务详情' })
  @ApiResponse({ status: 404, description: '死信任务不存在' })
  findOne(@Param('id') id: string) {
    return this.deadLetterService.findOne(id);
  }

  @Post(':id/requeue')
  @ApiOperation({ summary: '重新入队死信任务' })
  @ApiParam({ name: 'id', description: '死信任务ID' })
  @ApiResponse({ status: 200, description: '任务已重新入队' })
  @ApiResponse({ status: 404, description: '死信任务不存在' })
  requeue(@Param('id') id: string) {
    return this.deadLetterService.requeue(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除死信任务' })
  @ApiParam({ name: 'id', description: '死信任务ID' })
  @ApiResponse({ status: 200, description: '任务已删除' })
  @ApiResponse({ status: 404, description: '死信任务不存在' })
  remove(@Param('id') id: string) {
    return this.deadLetterService.delete(id);
  }

  @Post('batch/requeue')
  @ApiOperation({ summary: '批量重新入队死信任务' })
  @ApiResponse({ status: 200, description: '返回重新入队的任务数量' })
  batchRequeue(@Body() batchJobIdsDto: BatchJobIdsDto) {
    return this.deadLetterService.batchRequeue(batchJobIdsDto.jobIds);
  }

  @Post('batch/delete')
  @ApiOperation({ summary: '批量删除死信任务' })
  @ApiResponse({ status: 200, description: '返回删除的任务数量' })
  batchDelete(@Body() batchJobIdsDto: BatchJobIdsDto) {
    return this.deadLetterService.batchDelete(batchJobIdsDto.jobIds);
  }

  @Get('stats/all')
  @ApiOperation({ summary: '获取死信队列统计信息' })
  @ApiResponse({ status: 200, description: '返回死信队列统计信息' })
  getStatistics() {
    return this.deadLetterService.getStatistics();
  }
}
