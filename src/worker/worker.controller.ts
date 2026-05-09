import { Controller, Get, Post, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { WorkerService } from './worker.service';

@ApiTags('workers')
@Controller('workers')
export class WorkerController {
  constructor(private readonly workerService: WorkerService) {}

  @Post('register/:queueId')
  @ApiOperation({ summary: '为队列注册 Worker' })
  @ApiParam({ name: 'queueId', description: '队列ID' })
  @ApiResponse({ status: 201, description: 'Worker 注册成功' })
  @ApiResponse({ status: 404, description: '队列不存在' })
  registerWorker(@Param('queueId') queueId: string) {
    return this.workerService.registerWorker(queueId);
  }

  @Get()
  @ApiOperation({ summary: '获取所有 Worker' })
  @ApiResponse({ status: 200, description: '返回所有 Worker 列表' })
  findAll() {
    return this.workerService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '获取 Worker 详情' })
  @ApiParam({ name: 'id', description: 'Worker ID' })
  @ApiResponse({ status: 200, description: '返回 Worker 详情' })
  @ApiResponse({ status: 404, description: 'Worker 不存在' })
  findOne(@Param('id') id: string) {
    return this.workerService.findOne(id);
  }

  @Post(':id/stop')
  @ApiOperation({ summary: '停止 Worker' })
  @ApiParam({ name: 'id', description: 'Worker ID' })
  @ApiResponse({ status: 200, description: 'Worker 已停止' })
  @ApiResponse({ status: 404, description: 'Worker 不存在' })
  stopWorker(@Param('id') id: string) {
    return this.workerService.stopWorker(id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: '获取 Worker 统计信息' })
  @ApiParam({ name: 'id', description: 'Worker ID' })
  @ApiResponse({ status: 200, description: '返回 Worker 统计信息' })
  @ApiResponse({ status: 404, description: 'Worker 不存在' })
  getWorkerStats(@Param('id') id: string) {
    return this.workerService.getWorkerStats(id);
  }

  @Get('stats/all')
  @ApiOperation({ summary: '获取所有 Worker 统计信息' })
  @ApiResponse({ status: 200, description: '返回所有 Worker 统计信息' })
  getAllWorkersStats() {
    return this.workerService.getAllWorkersStats();
  }
}
