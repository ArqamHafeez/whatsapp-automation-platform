import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  
  const port = 3001;
  await app.listen(port);
  console.log(`🧪 Auth test server running on http://localhost:${port}`);
}
bootstrap();
