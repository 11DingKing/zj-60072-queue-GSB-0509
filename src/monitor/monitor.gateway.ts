import { WebSocketGateway, WebSocketServer, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { QueueService } from '../queue/queue.service';
import { WorkerService } from '../worker/worker.service';
import { BullmqService } from '../bullmq/bullmq.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
@Injectable()
export class MonitorGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('MonitorGateway');
  private connectedClients: number = 0;
  private previousCounts: Map<string, { completed: number; timestamp: number }> = new Map();

  constructor(
    private queueService: QueueService,
    private workerService: WorkerService,
    private bullmqService: BullmqService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('Monitor WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.connectedClients++;
    this.logger.log(`Client connected: ${client.id}. Total clients: ${this.connectedClients}`);
    this.broadcastAllQueuesStats();
  }

  handleDisconnect(client: Socket) {
    this.connectedClients--;
    this.logger.log(`Client disconnected: ${client.id}. Total clients: ${this.connectedClients}`);
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async broadcastAllQueuesStats() {
    if (this.connectedClients === 0) return;

    const queues = await this.queueService.findAll();
    const allStats: any[] = [];

    for (const queue of queues) {
      const stats = await this.getQueueStatsWithRate(queue.id, queue.name);
      allStats.push(stats);
    }

    const workersStats = await this.workerService.getAllWorkersStats();

    this.server.emit('queueStats', {
      queues: allStats,
      workers: workersStats,
      timestamp: new Date(),
    });
  }

  private async getQueueStatsWithRate(queueId: string, queueName: string): Promise<any> {
    const stats = await this.queueService.getQueueStats(queueId);
    const now = Date.now();
    const prev = this.previousCounts.get(queueId);

    let jobsPerMinute = 0;
    if (prev && prev.completed !== undefined) {
      const completedDiff = stats.counts.completed - prev.completed;
      const timeDiffMinutes = (now - prev.timestamp) / 60000;
      if (timeDiffMinutes > 0) {
        jobsPerMinute = completedDiff / timeDiffMinutes;
      }
    }

    this.previousCounts.set(queueId, {
      completed: stats.counts.completed,
      timestamp: now,
    });

    return {
      ...stats,
      jobsPerMinute: Math.round(jobsPerMinute * 100) / 100,
    };
  }

  async broadcastJobEvent(event: string, queueId: string, job: any) {
    this.server.emit(event, {
      queueId,
      job,
      timestamp: new Date(),
    });
  }

  async broadcastQueueEvent(event: string, queueId: string, data: any) {
    this.server.emit(event, {
      queueId,
      data,
      timestamp: new Date(),
    });
  }
}
