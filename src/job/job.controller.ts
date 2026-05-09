import { Controller, Get, Post, Body, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JobService } from './job.service';
import { CreateJobDto, BatchCreateJobDto, BatchJobIdsDto } from './dto/create-job.dto';
import { JobStatus } from '@prisma/client';

@ApiTags('jobs')
@Controller('jobs')
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @Post()
  @ApiOperation({ summary: '提交任务' })
  @ApiResponse({ status: 201, description: '任务提交成功' })
  create(@Body() createJobDto: CreateJobDto) {
    return this.jobService.create(createJobDto);
  }

  @Post('batch')
  @ApiOperation({ summary: '批量提交任务' })
  @ApiResponse({ status: 201, description: '任务批量提交成功' })
  batchCreate(@Body() batchCreateJobDto: BatchCreateJobDto) {
    return this.jobService.batchCreate(batchCreateJobDto);
  }

  @Get()
  @ApiOperation({ summary: '获取任务列表' })
  @ApiQuery({ name: 'queueId', description: '队列ID', required: false })
  @ApiQuery({ name: 'status', description: '任务状态', required: false, enum: JobStatus })
  @ApiQuery({ name: 'skip', description: '跳过数量', required: false, example: 0 })
  @ApiQuery({ name: 'take', description: '获取数量', required: false, example: 50 })
  @ApiResponse({ status: 200, description: '返回任务列表' })
  findAll(
    @Query('queueId') queueId?: string,
    @Query('status') status?: JobStatus,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const takeNum = take ? parseInt(take, 10) : 50;
    return this.jobService.findAll(queueId, status, skipNum, takeNum);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取任务详情' })
  @ApiParam({ name: 'id', description: '任务ID' })
  @ApiResponse({ status: 200, description: '返回任务详情' })
  @ApiResponse({ status: 404, description: '任务不存在' })
  findOne(@Param('id') id: string) {
    return this.jobService.findOne(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除任务' })
  @ApiParam({ name: 'id', description: '任务ID' })
  @ApiResponse({ status: 200, description: '任务删除成功' })
  @ApiResponse({ status: 404, description: '任务不存在' })
  remove(@Param('id') id: string) {
    return this.jobService.remove(id);
  }

  @Post('batch/delete')
  @ApiOperation({ summary: '批量删除任务' })
  @ApiResponse({ status: 200, description: '返回删除的任务数量' })
  batchDelete(@Body() batchJobIdsDto: BatchJobIdsDto) {
    return this.jobService.batchRemove(batchJobIdsDto.jobIds);
  }

  @Post(':id/retry')
  @ApiOperation({ summary: '手动重试失败任务' })
  @ApiParam({ name: 'id', description: '任务ID' })
  @ApiResponse({ status: 200, description: '任务重试成功' })
  @ApiResponse({ status: 400, description: '只能重试失败的任务' })
  @ApiResponse({ status: 404, description: '任务不存在' })
  retry(@Param('id') id: string) {
    return this.jobService.retry(id);
  }

  @Post('batch/retry')
  @ApiOperation({ summary: '批量重试失败任务' })
  @ApiResponse({ status: 200, description: '返回重试的任务数量' })
  batchRetry(@Body() batchJobIdsDto: BatchJobIdsDto) {
    return this.jobService.batchRetry(batchJobIdsDto.jobIds);
  }

  @Get('queue/:queueId/status/:status')
  @ApiOperation({ summary: '根据队列和状态获取任务' })
  @ApiParam({ name: 'queueId', description: '队列ID' })
  @ApiParam({ name: 'status', description: '任务状态', enum: JobStatus })
  @ApiResponse({ status: 200, description: '返回任务列表' })
  getJobsByStatus(
    @Param('queueId') queueId: string,
    @Param('status') status: JobStatus,
  ) {
    return this.jobService.getJobsByStatus(queueId, status);
  }
}
