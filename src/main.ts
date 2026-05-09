import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  const config = new DocumentBuilder()
    .setTitle('Distributed Task Queue Management System')
    .setDescription('API documentation for the distributed task queue management system based on BullMQ')
    .setVersion('1.0')
    .addTag('queues', '队列管理')
    .addTag('jobs', '任务管理')
    .addTag('scheduled-jobs', '定时任务')
    .addTag('workers', 'Worker管理')
    .addTag('monitor', '实时监控')
    .addTag('dead-letter', '死信队列')
    .addTag('logs', '任务日志')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 13072;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger API documentation: http://localhost:${port}/api/docs`);
}
bootstrap();
