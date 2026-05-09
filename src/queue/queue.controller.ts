import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { QueueService } from './queue.service';
import { CreateQueueDto } from './dto/create-queue.dto';
import { UpdateQueueDto } from './dto/update-queue.dto';

@ApiTags('queues')
@Controller('queues')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Post()
  @ApiOperation({ summary: '创建队列' })
  @ApiResponse({ status: 201, description: '队列创建成功' })
  @ApiResponse({ status: 409, description: '队列名称已存在' })
  create(@Body() createQueueDto: CreateQueueDto) {
    return this.queueService.create(createQueueDto);
  }

  @Get()
  @ApiOperation({ summary: '获取所有队列' })
  @ApiResponse({ status: 200, description: '返回所有队列列表' })
  findAll() {
    return this.queueService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '根据ID获取队列' })
  @ApiParam({ name: 'id', description: '队列ID' })
  @ApiResponse({ status: 200, description: '返回队列信息' })
  @ApiResponse({ status: 404, description: '队列不存在' })
  findOne(@Param('id') id: string) {
    return this.queueService.findOne(id);
  }

  @Get('name/:name')
  @ApiOperation({ summary: '根据名称获取队列' })
  @ApiParam({ name: 'name', description: '队列名称' })
  @ApiResponse({ status: 200, description: '返回队列信息' })
  @ApiResponse({ status: 404, description: '队列不存在' })
  findByName(@Param('name') name: string) {
    return this.queueService.findByName(name);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新队列配置' })
  @ApiParam({ name: 'id', description: '队列ID' })
  @ApiResponse({ status: 200, description: '队列更新成功' })
  @ApiResponse({ status: 404, description: '队列不存在' })
  update(@Param('id') id: string, @Body() updateQueueDto: UpdateQueueDto) {
    return this.queueService.update(id, updateQueueDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除队列' })
  @ApiParam({ name: 'id', description: '队列ID' })
  @ApiResponse({ status: 200, description: '队列删除成功' })
  @ApiResponse({ status: 404, description: '队列不存在' })
  remove(@Param('id') id: string) {
    return this.queueService.remove(id);
  }

  @Post(':id/pause')
  @ApiOperation({ summary: '暂停队列' })
  @ApiParam({ name: 'id', description: '队列ID' })
  @ApiResponse({ status: 200, description: '队列已暂停' })
  @ApiResponse({ status: 404, description: '队列不存在' })
  pause(@Param('id') id: string) {
    return this.queueService.pause(id);
  }

  @Post(':id/resume')
  @ApiOperation({ summary: '恢复队列' })
  @ApiParam({ name: 'id', description: '队列ID' })
  @ApiResponse({ status: 200, description: '队列已恢复' })
  @ApiResponse({ status: 404, description: '队列不存在' })
  resume(@Param('id') id: string) {
    return this.queueService.resume(id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: '获取队列统计信息' })
  @ApiParam({ name: 'id', description: '队列ID' })
  @ApiResponse({ status: 200, description: '返回队列统计信息，包括等待/处理中/完成/失败/延迟任务数量' })
  @ApiResponse({ status: 404, description: '队列不存在' })
  getStats(@Param('id') id: string) {
    return this.queueService.getQueueStats(id);
  }

  @Post(':id/drain')
  @ApiOperation({ summary: '清空队列' })
  @ApiParam({ name: 'id', description: '队列ID' })
  @ApiResponse({ status: 200, description: '队列已清空' })
  @ApiResponse({ status: 404, description: '队列不存在' })
  drain(@Param('id') id: string) {
    return this.queueService.drain(id);
  }

  @Post(':id/clean')
  @ApiOperation({ summary: '清理已完成/失败的任务' })
  @ApiParam({ name: 'id', description: '队列ID' })
  @ApiQuery({ name: 'grace', description: '保留时间(毫秒)', required: false, example: 3600000 })
  @ApiResponse({ status: 200, description: '返回清理的任务数量' })
  @ApiResponse({ status: 404, description: '队列不存在' })
  clean(
    @Param('id') id: string,
    @Query('grace') grace?: string,
  ) {
    const graceMs = grace ? parseInt(grace, 10) : 3600000;
    return this.queueService.clean(id, graceMs);
  }
}
