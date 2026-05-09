import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ScheduledJobService } from './scheduled-job.service';
import { CreateScheduledJobDto } from './dto/create-scheduled-job.dto';

@ApiTags('scheduled-jobs')
@Controller('scheduled-jobs')
export class ScheduledJobController {
  constructor(private readonly scheduledJobService: ScheduledJobService) {}

  @Post()
  @ApiOperation({ summary: '创建定时任务' })
  @ApiResponse({ status: 201, description: '定时任务创建成功' })
  @ApiResponse({ status: 400, description: '参数错误' })
  create(@Body() createScheduledJobDto: CreateScheduledJobDto) {
    return this.scheduledJobService.create(createScheduledJobDto);
  }

  @Get()
  @ApiOperation({ summary: '获取所有定时任务' })
  @ApiQuery({ name: 'queueId', description: '队列ID', required: false })
  @ApiQuery({ name: 'isActive', description: '是否激活', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: '返回定时任务列表' })
  findAll(
    @Query('queueId') queueId?: string,
    @Query('isActive') isActive?: string,
  ) {
    const active = isActive !== undefined ? isActive === 'true' : undefined;
    return this.scheduledJobService.findAll(queueId, active);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取定时任务详情' })
  @ApiParam({ name: 'id', description: '定时任务ID' })
  @ApiResponse({ status: 200, description: '返回定时任务详情' })
  @ApiResponse({ status: 404, description: '定时任务不存在' })
  findOne(@Param('id') id: string) {
    return this.scheduledJobService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新定时任务' })
  @ApiParam({ name: 'id', description: '定时任务ID' })
  @ApiResponse({ status: 200, description: '定时任务更新成功' })
  @ApiResponse({ status: 404, description: '定时任务不存在' })
  update(@Param('id') id: string, @Body() updateScheduledJobDto: Partial<CreateScheduledJobDto>) {
    return this.scheduledJobService.update(id, updateScheduledJobDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除定时任务' })
  @ApiParam({ name: 'id', description: '定时任务ID' })
  @ApiResponse({ status: 200, description: '定时任务删除成功' })
  @ApiResponse({ status: 404, description: '定时任务不存在' })
  remove(@Param('id') id: string) {
    return this.scheduledJobService.remove(id);
  }

  @Post(':id/pause')
  @ApiOperation({ summary: '暂停定时任务' })
  @ApiParam({ name: 'id', description: '定时任务ID' })
  @ApiResponse({ status: 200, description: '定时任务已暂停' })
  @ApiResponse({ status: 404, description: '定时任务不存在' })
  pause(@Param('id') id: string) {
    return this.scheduledJobService.pause(id);
  }

  @Post(':id/resume')
  @ApiOperation({ summary: '恢复定时任务' })
  @ApiParam({ name: 'id', description: '定时任务ID' })
  @ApiResponse({ status: 200, description: '定时任务已恢复' })
  @ApiResponse({ status: 404, description: '定时任务不存在' })
  resume(@Param('id') id: string) {
    return this.scheduledJobService.resume(id);
  }

  @Post('next-run-time')
  @ApiOperation({ summary: '计算 cron 表达式下次执行时间' })
  @ApiQuery({ name: 'cron', description: 'Cron 表达式', required: true })
  @ApiResponse({ status: 200, description: '返回下次执行时间' })
  getNextRunTime(@Query('cron') cron: string) {
    return this.scheduledJobService.getNextRunTime(cron);
  }
}
