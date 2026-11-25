import { createApp } from './app';
import { config } from './config/env';
import { connectDatabase, disconnectDatabase } from './db/prisma';

async function bootstrap() {
  try {
    console.log('[Bootstrap] Connecting to database...');
    await connectDatabase();
    console.log('[Bootstrap] Database connected successfully.');

    const app = createApp();

    const server = app.listen(config.port, () => {
      console.log(`=======================================================`);
      console.log(` Zong Reverse Flow SOAP Service is running!`);
      console.log(` Environment : ${config.nodeEnv}`);
      console.log(` Port        : ${config.port}`);
      console.log(` WSDL URL    : http://localhost:${config.port}/api/zong?wsdl`);
      console.log(` SOAP Endpoint: http://localhost:${config.port}/api/zong`);
      console.log(` Health Check : http://localhost:${config.port}/health`);
      console.log(`=======================================================`);
    });

    const shutdown = async (signal: string) => {
      console.log(`[Bootstrap] Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        await disconnectDatabase();
        console.log('[Bootstrap] Server and database closed. Bye!');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('[Bootstrap] Failed to start application:', error);
    process.exit(1);
  }
}

bootstrap();
