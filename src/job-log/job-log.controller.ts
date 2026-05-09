import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JobLogService } from './job-log.service';

@ApiTags('logs')
@Controller('logs')
export class JobLogController {
  constructor(private readonly jobLogService: JobLogService) {}

  @Get()
  @ApiOperation({ summary: '获取所有任务日志' })
  @ApiQuery({ name: 'jobId', description: '任务ID', required: false })
  @ApiQuery({ name: 'skip', description: '跳过数量', required: false, example: 0 })
  @ApiQuery({ name: 'take', description: '获取数量', required: false, example: 50 })
  @ApiResponse({ status: 200, description: '返回任务日志列表' })
  findAll(
    @Query('jobId') jobId?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const takeNum = take ? parseInt(take, 10) : 50;
    return this.jobLogService.findAll(jobId, skipNum, takeNum);
  }

  @Get('job/:jobId')
  @ApiOperation({ summary: '获取指定任务的所有日志' })
  @ApiParam({ name: 'jobId', description: '任务ID' })
  @ApiResponse({ status: 200, description: '返回任务日志列表' })
  findByJobId(@Param('jobId') jobId: string) {
    return this.jobLogService.findByJobId(jobId);
  }

  @Get('job/:jobId/summary')
  @ApiOperation({ summary: '获取任务执行摘要' })
  @ApiParam({ name: 'jobId', description: '任务ID' })
  @ApiResponse({ status: 200, description: '返回任务执行摘要' })
  getJobExecutionSummary(@Param('jobId') jobId: string) {
    return this.jobLogService.getJobExecutionSummary(jobId);
  }

  @Get('errors/recent')
  @ApiOperation({ summary: '获取最近的错误日志' })
  @ApiQuery({ name: 'limit', description: '返回数量限制', required: false, example: 20 })
  @ApiResponse({ status: 200, description: '返回最近的错误日志列表' })
  getRecentErrors(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.jobLogService.getRecentErrors(limitNum);
  }
}
