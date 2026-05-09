import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  const emailQueue = await prisma.queue.upsert({
    where: { name: 'email-queue' },
    update: {},
    create: {
      name: 'email-queue',
      description: '发送邮件的任务队列',
      concurrency: 5,
      maxRetries: 3,
      retryDelay: 2000,
      timeout: 30000,
      isPaused: false,
    },
  });
  console.log('Created/Updated email-queue:', emailQueue.id);

  const notificationQueue = await prisma.queue.upsert({
    where: { name: 'notification-queue' },
    update: {},
    create: {
      name: 'notification-queue',
      description: '发送通知的任务队列',
      concurrency: 10,
      maxRetries: 2,
      retryDelay: 1000,
      timeout: 10000,
      isPaused: false,
    },
  });
  console.log('Created/Updated notification-queue:', notificationQueue.id);

  const reportQueue = await prisma.queue.upsert({
    where: { name: 'report-queue' },
    update: {},
    create: {
      name: 'report-queue',
      description: '生成报表的任务队列',
      concurrency: 2,
      maxRetries: 5,
      retryDelay: 5000,
      timeout: 120000,
      isPaused: false,
    },
  });
  console.log('Created/Updated report-queue:', reportQueue.id);

  const highPriorityQueue = await prisma.queue.upsert({
    where: { name: 'high-priority-queue' },
    update: {},
    create: {
      name: 'high-priority-queue',
      description: '高优先级任务队列',
      concurrency: 3,
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 60000,
      isPaused: false,
    },
  });
  console.log('Created/Updated high-priority-queue:', highPriorityQueue.id);

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
